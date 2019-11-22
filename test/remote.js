var test = require('tape')
var pump = require('pump')
var Storage = require('../')
var ram = require('random-access-memory')

test('create local without a name and sync to a remote without a name', function (t) {
  t.plan(6)
  var sA = Storage(ram)
  var sB = Storage(ram)
  sA.createLocal(function (err, feedA) {
    t.ifError(err)
    feedA.append('hi', function (err, node) {
      t.ifError(err)
      sB.createRemote(feedA.key, function (err, feedB) {
        t.ifError(err)
        sync(feedA, feedB)
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

test('create local with a name and sync to a remote with a different name', function (t) {
  t.plan(6)
  var sA = Storage(ram)
  var sB = Storage(ram)
  sA.createLocal('x', function (err, feedA) {
    t.ifError(err)
    feedA.append('hi', function (err, node) {
      t.ifError(err)
      sB.createRemote(feedA.key, { localname: 'y' }, function (err, feedB) {
        t.ifError(err)
        var feedB2 = sB.get('y')
        var feedA2 = sA.get('x')
        sync(feedA2, feedB2)
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
