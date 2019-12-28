var test = require('tape')
var Storage = require('../')
var raf = require('random-access-file')
var ram = require('random-access-memory')
var path = require('path')
var tmpdir = require('os').tmpdir
var mkdirp = require('mkdirp')
var { randomBytes } = require('hypercore-crypto')

test('create local without name', function (t) {
  t.plan(3)
  var s = Storage(ram)
  s.createLocal(function (err, feed) {
    t.ifError(err)
    s.fromDiscoveryKey(feed.discoveryKey, function (err, key) {
      t.ifError(err)
      t.deepEqual(key, feed.key, 'discovery key')
    })
  })
})

test('create local with name', function (t) {
  t.plan(5)
  var s = Storage(ram)
  s.createLocal('cool', function (err, feed) {
    t.ifError(err)
    s.fromDiscoveryKey(feed.discoveryKey, function (err, key) {
      t.ifError(err)
      t.deepEqual(key, feed.key, 'key from discovery key')
    })
    s.fromLocalName('cool', function (err, key) {
      t.ifError(err)
      t.deepEqual(key, feed.key, 'key from local name')
    })
  })
})

test('create local and get', function (t) {
  t.plan(6)
  var dir = path.join(tmpdir(), randomBytes(8).toString('hex'))
  mkdirp.sync(dir)
  var s = Storage(function (name) {
    return raf(path.join(dir, name))
  })
  s.createLocal(function (err, feed0) {
    t.ifError(err)
    feed0.append('hi', function (err) {
      t.ifError(err)
      s.close(feed0.key, function (err) {
        t.ifError(err)
        s.get(feed0.key, function (err, feed1) {
          t.ifError(err)
          feed1.get(0, function (err, buf) {
            t.ifError(err)
            t.deepEqual(buf, Buffer.from('hi'))
          })
        })
      })
    })
  })
})

test('create local and get from name', function (t) {
  t.plan(8)
  var dir = path.join(tmpdir(), randomBytes(8).toString('hex'))
  mkdirp.sync(dir)
  var s = Storage(function (name) {
    return raf(path.join(dir, name))
  })
  s.createLocal('wow', function (err, feed0) {
    t.ifError(err)
    feed0.append('hi', function (err) {
      t.ifError(err)
      s.close(feed0.key, function (err) {
        t.ifError(err)
        s.fromLocalName('wow', function (err, key) {
          t.ifError(err)
          t.deepEqual(key, feed0.key, 'key from local name')
          s.get(key, function (err, feed1) {
            t.ifError(err)
            feed1.get(0, function (err, buf) {
              t.ifError(err)
              t.deepEqual(buf, Buffer.from('hi'))
            })
          })
        })
      })
    })
  })
})
