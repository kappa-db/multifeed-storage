var test = require('tape')
var pump = require('pump')
var Storage = require('../')
var ram = require('random-access-memory')

test('create local without a name and sync to a remote without a name', function (t) {
  t.plan(12)
  var sA = Storage(ram)
  var sB = Storage(ram)
  sA.createLocal(function (err, feedA) {
    t.ifError(err)
    var pending = 2
    sA.has(feedA.key, function (err, has) {
      t.ifError(err)
      t.equal(has, true, 'A has the feed')
      if (--pending === 0) append(feedA)
    })
    sB.has(feedA.key, function (err, has) {
      t.ifError(err)
      t.equal(has, false, 'B does not have the feed')
      if (--pending === 0) append(feedA)
    })
  })
  function append (feedA) {
    feedA.append('hi', function (err, node) {
      t.ifError(err)
      sB.createRemote(feedA.key, function (err, feedB) {
        t.ifError(err)
        sB.has(feedA.key, function (err, has) {
          t.ifError(err)
          t.equal(has, true, 'B has the feed')
        })
        sync(feedA, feedB)
      })
    })
  }
  function sync (feedA, feedB) {
    var rA = feedA.replicate(true)
    var rB = feedB.replicate(false)
    pump(rA, rB, rA, function (err) {
      t.ifError(err)
      feedB.get(0, function (err, buf) {
        t.ifError(err)
        t.deepEqual(buf, Buffer.from('hi'), 'expected value')
      })
    })
  }
})

test('create local with a name and sync to a remote with a different name', function (t) {
  t.plan(8)
  var sA = Storage(ram)
  var sB = Storage(ram)
  sA.createLocal('x', function (err, feedA) {
    t.ifError(err)
    feedA.append('hi', function (err, node) {
      t.ifError(err)
      sB.createRemote(feedA.key, { localname: 'y' }, function (err, feedB) {
        t.ifError(err)
        var feedA2, feedB2, pending = 2
        sB.get('y', function (err, feed) {
          t.ifError(err)
          feedB2 = feed
          if (--pending === 0) sync(feedA2, feedB2)
        })
        sA.get('x', function (err, feed) {
          t.ifError(err)
          feedA2 = feed
          if (--pending === 0) sync(feedA2, feedB2)
        })
      })
    })
  })
  function sync (feedA, feedB) {
    var rA = feedA.replicate(true)
    var rB = feedB.replicate(false)
    pump(rA, rB, rA, function (err) {
      t.ifError(err)
      feedB.get(0, function (err, buf) {
        t.ifError(err)
        t.deepEqual(buf, Buffer.from('hi'), 'expected value')
      })
    })
  }
})
