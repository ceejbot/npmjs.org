// start the couchdb spinning as a detached child process.
// the zz-teardown.js test kills it.

var spawn = require('child_process').spawn
var test = require('tap').test
var path = require('path')
var fs = require('fs')
var http = require('http')
var url = require('url')

// just in case it was still alive from a previous run, kill it.
require('./zz-teardown.js')

// run with the cwd of the main program.
var cwd = path.dirname(__dirname)

var conf = path.resolve(__dirname, 'fixtures', 'couch.ini')
var pidfile = path.resolve(__dirname, 'fixtures', 'pid')
var logfile = path.resolve(__dirname, 'fixtures', 'couch.log')
var started = /Apache CouchDB has started on http:\/\/127\.0\.0\.1:15984\/\n$/

test('start couch as a zombie child', function (t) {
  var fd = fs.openSync(pidfile, 'wx')

  try { fs.unlinkSync(logfile) } catch (er) {}

  var child = spawn('couchdb', ['-a', conf], {
    detached: true,
    stdio: 'ignore',
    cwd: cwd
  })
  child.unref()
  t.ok(child.pid)
  fs.writeSync(fd, child.pid + '\n')
  fs.closeSync(fd)

  // wait for it to create a log, give it 5 seconds
  var start = Date.now()
  fs.readFile(logfile, function R (er, log) {
    log = log ? log.toString() : ''
    if (!er && !log.match(started))
      er = new Error('not started yet')
    if (er) {
      if (Date.now() - start < 5000)
        return setTimeout(function () {
          fs.readFile(logfile, R)
        }, 100)
      else
        throw er
    }
    t.pass('relax, jeez')
    t.end()
  })
})

test('create test db', function(t) {
  var u = url.parse('http://admin:admin@localhost:15984/registry')
  u.method = 'PUT'
  http.request(u, function(res) {
    t.equal(res.statusCode, 201)
    var c = ''
    res.setEncoding('utf8')
    res.on('data', function(chunk) {
      c += chunk
    })
    res.on('end', function() {
      c = JSON.parse(c)
      t.same(c, { ok: true })
      t.end()
    })
  }).end()
})

test('ddoc', function(t) {
  var app = require.resolve('../registry/app.js')
  var couch = 'http://admin:admin@localhost:15984/registry'
  var c = spawn('couchapp', ['push', app, couch])
  c.stderr.pipe(process.stderr)
  c.stdout.pipe(process.stdout)
  c.on('exit', function(code) {
    t.notOk(code)
    t.end()
  })
})
