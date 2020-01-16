var hypercore = require('hypercore')
var hcrypto = require('hypercore-crypto')
var TinyBox = require('tinybox')
var path = require('path')
var { EventEmitter } = require('events')
var LRU = require('lru')
var { nextTick } = process
var DKEY = 'd!' // hex discovery key to key
var LKEY = 'l!' // local name to hex key
var INV_LKEY = 'L!' // local name to key
var KEY = 'k!' // hex key to empty payload
var FEED = 'f_'

function Storage (storage, opts) {
  if (!(this instanceof Storage)) return new Storage(storage, opts)
  if (!opts) opts = {}
  this._db = new TinyBox(storage('_mstore_db'))
  this._storage = storage
  this._feeds = {} // map hypercore keys to feeds
  this._dkeys = {} // map discovery key to key for loaded feeds
  this._lnames = {} // map local names to key for loaded feeds
  this._pendingLocal = {} // map local names to arrays of callbacks
  this._pendingRemote = {} // map remote keys to arrays of callbacks
  this._delete = opts.delete || noop
}
Storage.prototype = Object.create(EventEmitter.prototype)

Storage.prototype._storageF = function (prefix) {
  var self = this
  return function (p) {
    return self._storage(path.join(prefix, p))
  }
}

// Map a discovery key to a public key.
Storage.prototype.fromDiscoveryKey = function (dkey, cb) {
  var self = this
  var hdkey = asHexStr(dkey)
  if (self._dkeys.hasOwnProperty(hdkey)) {
    return nextTick(cb, null, self._dkeys[hdkey])
  }
  self._db.get(DKEY + hdkey, function (err, node) {
    if (err) return cb(err)
    if (!node) return cb(null, null)
    self._dkeys[hdkey] = node.value
    cb(null, node.value)
  })
}

// Map a local nickname to a public key.
Storage.prototype.fromLocalName = function (localname, cb) {
  if (this._lnames.hasOwnProperty(localname)) {
    return nextTick(cb, null, this._lnames[localname])
  }
  this._db.get(LKEY + localname, function (err, node) {
    if (err) cb(err)
    else cb(null, node === null ? null : node.value)
  })
}

// Create a new hypercore, which can include a local name. (creates + loads)
Storage.prototype.createLocal = function (localname, opts, cb) {
  var self = this
  if (typeof localname === 'object') {
    cb = opts
    opts = localname
  } else if (typeof localname === 'function') {
    cb = localname
    opts = {}
    localname = null
  } else if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!cb) cb = noop
  if (self._pendingLocal.hasOwnProperty(localname)) {
    self._pendingLocal[localname].push(cb)
    return
  }
  self._pendingLocal[localname] = []
  var kp = hcrypto.keyPair()
  var key = kp.publicKey
  var hkey = key.toString('hex')
  var hdkey = asHexStr(hcrypto.discoveryKey(key))
  var store = self._storageF(FEED + hkey)
  var feed = hypercore(store, key, Object.assign({
    secretKey: kp.secretKey
  }, opts))
  feed.once('close', function () {
    delete self._feeds[hkey]
  })
  self._feeds[hkey] = feed
  self._dkeys[hdkey] = key
  var pending = 5, cancelled = false
  if (localname) {
    self._lnames[localname] = key
    pending += 2
    self._db.put(LKEY + localname, key, onput)
    self._db.put(INV_LKEY + localname, key, onput)
  }
  self._db.put(DKEY + hdkey, key, onput)
  self._db.put(KEY + hkey, Buffer.alloc(0), onput)

  self._db.flush(function (err) {
    if (err) error(err)
    else if (--pending === 0) done()
  })
  feed.ready(function () {
    if (--pending === 0) done()
  })
  if (--pending === 0) done()
  function onput (err) {
    if (err) error(err)
    else if (--pending === 0) done()
  }
  function error (err) {
    if (cancelled) return
    var cbs = self._pendingLocal[localname]
    delete self._pendingLocal[localname]
    cb(err)
    cancelled = true
    for (var i = 0; i < cbs.length; i++) {
      cbs[i](err)
    }
  }
  function done () {
    if (cancelled) return
    var cbs = self._pendingLocal[localname]
    delete self._pendingLocal[localname]
    self.emit('create-local', feed)
    cb(null, feed)
    for (var i = 0; i < cbs.length; i++) {
      cbs[i](null, feed)
    }
  }
}

// Create a new hypercore, which can include a local name. (creates + loads)
Storage.prototype.createRemote = function (key, opts, cb) {
  var self = this
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!opts) opts = {}
  if (!cb) cb = noop
  var hkey = asHexStr(key)
  if (self._pendingRemote.hasOwnProperty(hkey)) {
    self._pendingRemote[hkey].push(cb)
    return
  }
  self._pendingRemote[hkey] = []
  key = asBuffer(key)
  var dkey = hcrypto.discoveryKey(key)
  var hdkey = asHexStr(dkey)
  var store = self._storageF(FEED + hkey)
  var feed = hypercore(store, key, opts)
  feed.once('close', function () {
    delete self._feeds[hkey]
  })
  self._feeds[hkey] = feed
  self._dkeys[hdkey] = key
  var pending = 5, cancelled = false
  if (opts.localname) {
    self._lnames[opts.localname] = key
    pending += 2
    self._db.put(LKEY + opts.localname, key, onput)
    self._db.put(INV_LKEY + opts.localname, key, onput)
  }
  self._db.put(DKEY + hdkey, key, onput)
  self._db.put(KEY + hkey, Buffer.alloc(0), onput)
  self._db.flush(function (err) {
    if (err) error(err)
    else done()
  })
  feed.ready(function () {
    if (--pending === 0) done()
  })
  if (--pending === 0) done()
  function onput (err) {
    if (err) error(err)
    else if (--pending === 0) done()
  }
  function error (err) {
    if (cancelled) return
    var cbs = self._pendingRemote[hkey]
    delete self._pendingRemote[hkey]
    cb(err)
    cancelled = true
    for (var i = 0; i < cbs.length; i++) {
      cbs[i](err)
    }
  }
  function done () {
    if (cancelled) return
    var cbs = self._pendingRemote[hkey]
    delete self._pendingRemote[hkey]
    self.emit('create-remote', feed)
    cb(null, feed)
    for (var i = 0; i < cbs.length; i++) {
      cbs[i](null, feed)
    }
  }
}

// Get an existing hypercore by key or local name. Local names are purely local
// & aren't shared over the network. Loads the core if it isn't loaded.
Storage.prototype.get = function (id, opts, cb) {
  var self = this
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!cb) cb = noop
  var key = asBuffer(id)
  var hkey = asHexStr(id)
  if (self._feeds.hasOwnProperty(hkey)) {
    // hex or buffer key cached
    ready(key, hkey, self._feeds[hkey])
  } else if (/^[0-9A-Fa-f]{64}$/.test(hkey)) {
    // hex or buffer key not cached
    var store = self._storageF(FEED + hkey)
    ready(key, hkey, hypercore(store, key, opts))
  } else if (self._lnames.hasOwnProperty(id)) {
    // local name cached
    key = self._lnames[id]
    hkey = asHexStr(key)
    ready(key, hkey, self._feeds[hkey])
  } else {
    // local name not cached
    self.fromLocalName(id, function (err, key) {
      if (err) return cb(err)
      var hkey = key ? key.toString('hex') : null
      if (key && self._feeds.hasOwnProperty(hkey)) {
        // exists, loaded
        ready(key, hkey, self._feeds[hkey])
      } else if (key) {
        // exists, not loaded
        self._lnames[id] = key
        var hkey = asHexStr(key)
        var store = self._storageF(FEED + hkey)
        ready(key, hkey, hypercore(store, key, opts))
      } else {
        // does not exist
        cb(new Error('feed not found'))
      }
    })
  }
  function ready (key, hkey, feed) {
    var opened = false
    if (!self._feeds.hasOwnProperty(hkey)) {
      opened = true
      self._feeds[hkey] = feed
      var hdkey = hcrypto.discoveryKey(key)
      self._dkeys[hdkey] = key
      feed.once('close', function () {
        delete self._feeds[hkey]
      })
    }
    feed.ready(function () {
      if (opened) self.emit('open', feed)
      cb(null, feed)
    })
  }
}

// Whether a hypercore is stored on disk or in memory
Storage.prototype.has = function (key, cb) {
  if (this.isOpen(key)) return nextTick(cb, null, true)
  this._db.get(KEY + asHexStr(key), function (err, node) {
    if (err) cb(err)
    else cb(null, Boolean(node))
  })
}

// Whether a locally named hypercore is stored on disk or in memory
Storage.prototype.hasLocal = function (localname, cb) {
  if (this._lnames.hasOwnProperty(localname)) return nextTick(cb, null, true)
  this._db.get(LKEY + localname, function (err, node) {
    if (err) cb(err)
    else cb(null, Boolean(node))
  })
}

// Load a feed from a key or create the feed as a remote if it doesn't exist
Storage.prototype.getOrCreateRemote = function (key, opts, cb) {
  var self = this
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!opts) opts = {}
  if (!cb) cb = noop
  var hkey = asHexStr(key)
  self.has(key, function (err, has) {
    if (err) return cb(err)
    if (has) {
      self.get(key, opts, cb)
    } else self.createRemote(key, opts, cb)
  })
}

// Load a feed from a localname or create the feed as a local if it doesn't exist
Storage.prototype.getOrCreateLocal = function (localname, opts, cb) {
  var self = this
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!opts) opts = {}
  if (!cb) cb = noop
  self.hasLocal(localname, function (err, has) {
    if (err) return cb(err)
    if (has) {
      self.get(localname, opts, cb)
    } else self.createLocal(localname, opts, cb)
  })
}

// Returns boolean true/false if core is open.
Storage.prototype.isOpen = function (key, cb) {
  return this._feeds.hasOwnProperty(asHexStr(key))
}

// Unload a hypercore.
Storage.prototype.close = function (key, cb) {
  var hkey = asHexStr(key)
  if (!this._feeds.hasOwnProperty(hkey)) {
    return nextTick(cb, new Error('feed not loaded'))
  }
  var feed = this._feeds[hkey]
  feed.close(cb)
  delete this._feeds[hkey]
  this.emit('close', feed)
}

// Close all hypercores.
Storage.prototype.closeAll = function (cb) {
  var self = this
  var pending = 1, finished = false
  Object.keys(self._feeds).forEach(function (key) {
    pending++
    self._feeds[key].close(function (err) {
      if (!err) {
        self.emit('close', self._feeds[key])
        delete self._feeds[key]
      }
      if (!finished && err) {
        finished = true
        cb(err)
      } else if (!finished && --pending === 0) {
        finished = true
        cb()
      }
    })
  })
  if (--pending === 0 && !finished) {
    finished = true
    cb()
  }
}

// Unload (if necessary) and delete a hypercore.
Storage.prototype.delete = function (key, cb) {
  var self = this
  if (!cb) cb = noop
  var hkey = asHexStr(key)
  var feed = self._feeds[hkey]
  if (self._feeds.hasOwnProperty(hkey)) {
    feed.close(function (err) {
      if (err) return cb(err)
      self.emit('close', feed)
      self._delete(FEED + hkey, function (err) {
        if (err) return cb(err)
        self.emit('delete', feed.key)
        cb(err)
      })
    })
    delete self._dkeys[asHexStr(feed.discoveryKey)]
    var bkey = asBuffer(key)
    Object.keys(self._lnames).forEach(function (key) {
      if (self._lnames[key].equals(bkey)) {
        delete self._lnames[key]
      }
    })
    delete self._feeds[hkey]
  } else {
    self._delete(FEED + hkey, function (err) {
      if (err) return cb(err)
      self.emit('delete', asBuffer(key))
    })
  }
}

module.exports = Storage

function asBuffer (x) {
  if (Buffer.isBuffer(x)) return x
  if (typeof x === 'string' && /^[0-9A-Fa-f]+$/.test(x)) {
    return Buffer.from(x, 'hex')
  }
  return null
}

function asHexStr (x) {
  if (typeof x === 'string' && /^[0-9A-Fa-f]+$/.test(x)) return x
  if (Buffer.isBuffer(x)) return x.toString('hex')
  return null
}

function noop () {}
