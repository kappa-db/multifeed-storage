var Storage = require('../')
var raf = require('random-access-file')
var path = require('path')
require('mkdirp').sync('/tmp/multifeed-storage')

var s = Storage(function (name) {
  return raf(path.join('/tmp/multifeed-storage', name))
})
var feed = s.create('hello')

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
  var feed1 = s.get(feed.key)
  feed1.get(0, console.log)
})
