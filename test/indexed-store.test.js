/* eslint-disable no-invalid-this */

var fakeIndexedDB = require('fake-indexeddb')
var eachStoreCheck = require('@logux/core').eachStoreCheck

var IndexedStore = require('../indexed-store')

var originIndexedDB = global.indexedDB
beforeEach(function () {
  global.indexedDB = fakeIndexedDB
})

function promisify (request) {
  return new Promise(function (resolve, reject) {
    request.onerror = function (e) {
      reject(e.target.error)
    }
    request.onsuccess = function (e) {
      resolve(e.target.result)
    }
  })
}

function all (request, list) {
  if (!list) list = []
  return request.then(function (page) {
    list = list.concat(page.entries)
    if (page.next) {
      return all(page.next(), list)
    } else {
      return list
    }
  })
}

function check (indexed, created, added) {
  if (!added) added = created
  return all(indexed.get({ order: 'created' })).then(function (entries) {
    expect(entries).toEqual(created)
  }).then(function () {
    return all(indexed.get({ order: 'added' }))
  }).then(function (entries) {
    expect(entries).toEqual(added)
  })
}

var store, other

afterEach(function () {
  return Promise.all([
    store ? store.clean() : null,
    other ? other.clean() : null
  ]).then(function () {
    store = undefined
    other = undefined
    global.indexedDB = originIndexedDB
    delete global.document.reload
  })
})

eachStoreCheck(function (desc, creator) {
  it(desc, creator(function () {
    store = new IndexedStore()
    return store
  }))
})

it('use logux as default name', function () {
  store = new IndexedStore()
  return store.init().then(function () {
    expect(store.db.name).toEqual('logux')
    expect(store.name).toEqual('logux')
  })
})

it('allows to change DB name', function () {
  store = new IndexedStore('custom')
  return store.init().then(function () {
    expect(store.db.name).toEqual('custom')
    expect(store.name).toEqual('custom')
  })
})

it('reloads page on database update', function () {
  document.reload = function () { }
  jest.spyOn(document, 'reload')
  store = new IndexedStore()
  return store.init().then(function () {
    var opening = indexedDB.open(store.name, 1000)
    return new Promise(function (resolve, reject) {
      opening.onsuccess = function (e) {
        e.target.result.close()
        resolve()
      }
      opening.onerror = function (e) {
        reject(e.target.error)
      }
    })
  }).then(function () {
    expect(document.reload).toHaveBeenCalled()
  })
})

it('throws a errors', function () {
  var error = new Error('test')
  global.indexedDB = {
    open: function () {
      var request = { }
      setTimeout(function () {
        request.onerror({ target: { error: error } })
      }, 1)
      return request
    }
  }
  var broken = new IndexedStore()
  var throwed
  return broken.init().catch(function (e) {
    throwed = e
  }).then(function () {
    expect(throwed).toBe(error)
  })
})

it('works with broken lastSynced', function () {
  store = new IndexedStore()
  return store.init().then(function () {
    return promisify(store.os('extra', 'write').delete('lastSynced'))
  }).then(function () {
    return store.getLastSynced()
  }).then(function (synced) {
    expect(synced).toEqual({ sent: 0, received: 0 })
    return store.setLastSynced({ sent: 1, received: 1 })
  })
})

it('updates reasons cache', function () {
  store = new IndexedStore()
  return store.add({ }, { id: '1', time: 1, reasons: ['a'] }).then(function () {
    return store.changeMeta('1', { reasons: ['a', 'b', 'c'] })
  }).then(function () {
    return store.removeReason('b', { }, function () { })
  }).then(function () {
    return check(store, [
      [{ }, { added: 1, id: '1', time: 1, reasons: ['a', 'c'] }]
    ])
  })
})
