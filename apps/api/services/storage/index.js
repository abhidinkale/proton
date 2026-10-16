/**
 * Proton Storage Service Hub
 */

const { StorageAdapter } = require('./storageAdapter');
const { LocalStorageAdapter } = require('./localStorageAdapter');

// Default to local storage adapter for current development environment
const defaultStorageAdapter = new LocalStorageAdapter();

module.exports = {
  StorageAdapter,
  LocalStorageAdapter,
  storageService: defaultStorageAdapter,
  defaultStorageAdapter
};
