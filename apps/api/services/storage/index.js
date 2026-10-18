/**
 * Proton Storage Service Hub
 */

const { StorageAdapter } = require('./storageAdapter');
const { LocalStorageAdapter } = require('./localStorageAdapter');
const { S3StorageAdapter } = require('./s3StorageAdapter');

// Default to local storage adapter for current development environment
const defaultStorageAdapter = new LocalStorageAdapter();

module.exports = {
  StorageAdapter,
  LocalStorageAdapter,
  S3StorageAdapter,
  storageService: defaultStorageAdapter,
  defaultStorageAdapter
};
