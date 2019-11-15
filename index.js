function CoreStore (storage) {
  if (!(this instanceof CoreStore)) return new CoreStore(storage)
}

// Map a discovery key to a public key.
CoreStore.prototype.fromDiscoveryKey = function (discoKey, cb) {
}

// Map a local nickname to a public key.
CoreStore.prototype.fromLocalName = function (localname, cb) {
}

// Create a new hypercore, which can include a local name. (creates + loads)
CoreStore.prototype.create = function (localname, opts) {
}

// Get an existing hypercore by key or local name. Local names are purely local
// & aren't shared over the network. Loads the core if it isn't loaded.
CoreStore.prototype.get = function (id, cb) {
}

// Returns boolean true/false if core is open.
CoreStore.prototype.isOpen = function (id, cb) {
}

// Unload a hypercore.
CoreStore.prototype.close = function (id, cb) {
}

// Close all hypercores.
CoreStore.prototype.closeAll = function (cb) {
}

// Unload (if necessary) and delete a hypercore.
CoreStore.prototype.delete = function (id, cb) {
}

module.exports = CoreStore

