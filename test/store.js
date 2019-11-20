var test = require('tape')
var Storage = require('../')
var raf = require('random-access-file')
var ram = require('random-access-memory')
var path = require('path')
var tmpdir = require('os').tmpdir
var mkdirp = require('mkdirp')
var { randomBytes } = require('hypercore-crypto')

test('create without name', function (t) {
  t.plan(2)
  var s = Storage(ram)
  var feed = s.create()
  feed.ready(function () {
    s.fromDiscoveryKey(feed.discoveryKey, function (err, key) {
      t.ifError(err)
      t.deepEqual(key, feed.key, 'discovery key')
    })
  })
})

test('create with name', function (t) {
  t.plan(4)
  var s = Storage(ram)
  var feed = s.create('cool')
  feed.ready(function () {
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

test('create and get', function (t) {
  t.plan(4)
  var dir = path.join(tmpdir(), String(randomBytes(8).toString('hex')))
  mkdirp.sync(dir)
  var s = Storage(function (name) {
    return raf(path.join(dir, name))
  })
  var feed0 = s.create()
  feed0.ready(function () {
    feed0.append('hi', function (err) {
      t.ifError(err)
      s.close(feed0.key, function (err) {
        t.ifError(err)
        var feed1 = s.get(feed0.key)
        feed1.get(0, function (err, buf) {
          t.ifError(err)
          t.deepEqual(buf, Buffer.from('hi'))
        })
      })
    })
  })
})

test('create and get from name', function (t) {
  t.plan(6)
  var dir = path.join(tmpdir(), String(randomBytes(8).toString('hex')))
  mkdirp.sync(dir)
  var s = Storage(function (name) {
    return raf(path.join(dir, name))
  })
  var feed0 = s.create('wow')
  feed0.ready(function () {
    feed0.append('hi', function (err) {
      t.ifError(err)
      s.close(feed0.key, function (err) {
        t.ifError(err)
        s.fromLocalName('wow', function (err, key) {
          t.ifError(err)
          t.deepEqual(key, feed0.key, 'key from local name')
          var feed1 = s.get(key)
          feed1.get(0, function (err, buf) {
            t.ifError(err)
            t.deepEqual(buf, Buffer.from('hi'))
          })
        })
      })
    })
  })
})
