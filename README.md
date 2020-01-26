# multifeed-storage

store hypercore feeds and load feeds by local name or discovery key

# example

``` js
var Storage = require('multifeed-storage')
var raf = require('random-access-file')
var path = require('path')
require('mkdirp').sync('/tmp/multifeed-storage')

var s = Storage(function (name) {
  return raf(path.join('/tmp/multifeed-storage', name))
})
s.createLocal('hello', function (err, feed) {
  if (err) return console.error(err)

  s.fromDiscoveryKey(feed.discoveryKey, function (err, key) {
    // key === feed.key
    console.log('from discovery key:', key.toString('hex'))
  })
  s.fromLocalName('hello', function (err, key) {
    // key === feed.key
    console.log('from local name:', key.toString('hex'))
  })
  // append data, close the feed, and open it again with get():
  feed.append('whatever', function (err) {
    s.close(feed.key)
    s.get(feed.key, function (err, feed1) {
      if (err) console.error(err)
      else feed1.get(0, console.log)
    })
  })
})
```

# api

``` js
var Storage = require('multifeed-storage')
```

# var store = new Storage(storeFn, opts)

Create a new multifeed-storage instance `store` from a storage function
`storeFn` and opts:

* `opts.delete(path, cb)` - implementation to recursively delete paths
  This is used by `store.delete(id, cb)` to remove all data associated with a
  feed.

# store.fromDiscoveryKey(discoveryKey, cb)

Find the public key for a managed feed by its discovery key as `cb(err, key)`.

`key` is a Buffer like `feed.key`.

# store.fromLocalName(localName, cb)

Find the public key for a string name `localName` as `cb(err, key)`.

`key` is a Buffer like `feed.key`.

# store.createLocal(localName, opts, cb)

Create a "local" hypercore `feed` from an optional `localName`, `opts` (passed
to hypercore's constructor), as `cb(err, feed)` called after feed metadata has
been written to internal storage and the feed is ready.

"Local" hypercores are feeds where the secret key is stored locally and the
local machine may append messages. A new keypair is created when `createLocal()`
is called.

Emits the `'create-local'` event with the feed.

# store.createRemote(key, opts, cb)

Create a "remote" hypercore `feed` from a hex string or buffer `key`, `opts`
(passed to hypercore's constructor), as `cb(err, feed)` called after feed
metadata has been written to internal storage and the feed is ready.

"Remote" hypercores are feeds where the secret key is not stored locally and the
local machine may not append messages. Use this method to sync a feed created on
a remote machine.

Emits the `'create-remote'` event with the feed.

# store.get(id, opts, cb)

Load a hypercore by its `id`: either a 32-byte buffer or hex string or a local
name string as `cb(err, feed)`.
`opts` are passed along to the hypercore constructor.

If this feed is already open, you will get the opened instance, which may have
been created with different hypercore options than the `opts` you specify.

If a feed is opened (not cached), the `'open'` event will fire with the feed.

# store.has(key, cb)

Determine whether the store has a feed with `key` as `cb(err, hasFeed)` for a
boolean `hasFeed`.

# store.hasLocal(localname, cb)

Determine whether the store has a feed with a `localname` as `cb(err, hasFeed)`
for a boolean `hasFeed`.

# store.getOrCreateRemote(key, opts, cb)

Load a feed as `cb(err, feed)` from a key or if the key doesn't exist, create it
as a "remote" feed (see the createRemote api docs for more info).

An `'open'` or `'create-remote'` event may be fired.

# store.getOrCreateLocal(localName, opts, cb)

Load a feed as `cb(err, feed)` from a key or if the key doesn't exist, create it
as a "local" feed (see the createLocal api docs for more info).

An `'open'` or `'create-local'` event may be fired.

# store.isOpen(key)

Return a boolean: whether the feed identified by `key` is open or not.

# store.close(key, cb)

Close the feed with `key`.

Emits the `'close'` event with the feed.

# store.closeAll(cb)

Close all open feeds.

Emits the `'close'` event for each open feed.

# store.delete(key, cb)

Close and delete all files associated with the feed `key`.

For this to work you must specify an `opts.delete` implementation to the
constructor.

Emits the `'delete'` event with the feed key as a `Buffer`.

# store.on('create-local', function (feed) {})

Emitted when a new local feed is created.

# store.on('create-remote', function (feed) {})

Emitted when a new remote feed is created.

# store.on('open', function (feed) {})

Emitted when a feed is opened that was not already cached.

# store.on('close', function (feed) {})

Emitted when an open feed is closed.

# store.on('delete', function (key) {})

Emitted when a feed is deleted with the feed `key` (`Buffer`).
