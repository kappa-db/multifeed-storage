var test = require('tape')
var pump = require('pump')
var Storage = require('../')
var ram = require('random-access-memory')

test('feed events', function (t) {
  t.plan(15)
  var sA = Storage(ram)
  var sB = Storage(ram)
  var evLog = []
  logger(evLog, 'A', sA)
  logger(evLog, 'B', sB)
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
        sA.close(feedA.key, function (err) {
          t.ifError(err)
          sB.close(feedB.key, function (err) {
            t.ifError(err)
            t.deepEqual(evLog, [
              `A:create-local ${feedA.key.toString('hex')}`,
              `B:create-remote ${feedA.key.toString('hex')}`,
              `A:close ${feedA.key.toString('hex')}`,
              `B:close ${feedA.key.toString('hex')}`
            ])
          })
        })
      })
    })
  }
})

function logger (log, key, s) {
  s.on('open', function (feed) {
    log.push(`${key}:open ${feed.key.toString('hex')}`)
  })
  s.on('close', function (feed) {
    log.push(`${key}:close ${feed.key.toString('hex')}`)
  })
  s.on('create-remote', function (feed) {
    log.push(`${key}:create-remote ${feed.key.toString('hex')}`)
  })
  s.on('create-local', function (feed) {
    log.push(`${key}:create-local ${feed.key.toString('hex')}`)
  })
}
