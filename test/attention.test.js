var LoguxError = require('@logux/core').LoguxError
var TestPair = require('@logux/core').TestPair

var CrossTabClient = require('../cross-tab-client')
var attention = require('../attention')

var nextHidden
Object.defineProperty(document, 'hidden', {
  get: function () {
    if (typeof nextHidden !== 'undefined') {
      var value = nextHidden
      nextHidden = undefined
      return value
    } else {
      return true
    }
  }
})

function createClient () {
  document.title = 'title'

  var pair = new TestPair()
  var client = new CrossTabClient({
    subprotocol: '1.0.0',
    server: pair.left,
    userId: false
  })

  client.node.catch(function () { })
  client.role = 'leader'

  return pair.left.connect().then(function () {
    return client
  })
}

var originAdd = document.addEventListener
afterEach(function () {
  document.addEventListener = originAdd
})

it('receives errors', function () {
  return createClient().then(function (client) {
    attention(client)
    client.node.emitter.emit('error', new Error('test'))
    expect(document.title).toBe('* title')
  })
})

it('receives undo', function () {
  return createClient().then(function (client) {
    attention(client)
    client.log.add({ type: 'logux/undo', reason: 'error' })
    expect(document.title).toBe('* title')
  })
})

it('returns unbind function', function () {
  jest.spyOn(document, 'removeEventListener')

  return createClient().then(function (client) {
    var unbind = attention(client)
    unbind()
    expect(document.removeEventListener).toBeCalled()
  })
})

it('allows to miss timeout error', function () {
  return createClient().then(function (client) {
    attention(client)
    client.node.emitter.emit('error', new LoguxError('timeout'))
    expect(document.title).toBe('title')
  })
})

it('sets old title when user open a tab', function () {
  var listener
  document.addEventListener = function (name, callback) {
    expect(name).toEqual('visibilitychange')
    listener = callback
  }

  return createClient().then(function (client) {
    attention(client)

    client.node.emitter.emit('error', new Error('test'))
    expect(document.title).toBe('* title')

    nextHidden = false
    listener()
    expect(document.title).toBe('title')
  })
})

it('does not double title changes', function () {
  return createClient().then(function (client) {
    attention(client)

    client.node.emitter.emit('error', new Error('test'))
    client.node.emitter.emit('error', new Error('test'))
    expect(document.title).toBe('* title')
  })
})

it('does not change title of visible tab', function () {
  return createClient().then(function (client) {
    attention(client)

    nextHidden = false
    client.node.emitter.emit('error', new Error('test'))
    expect(document.title).toBe('title')
  })
})
