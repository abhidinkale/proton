/**
 * Proton Storage Adapter Interface
 * 
 * Abstract interface for multi-tenant medical asset storage.
 * Implementations (LocalStorageAdapter, S3StorageAdapter, GcsStorageAdapter)
 * provide uniform persistence without leaking raw filesystem concepts.
 */

class StorageAdapter {
  /**
   * Stores a binary buffer under a tenant-isolated media identifier.
   * @param {Object} params
   * @param {Buffer} params.buffer - Media binary data
   * @param {string} params.mimeType - MIME type (e.g. image/jpeg)
   * @param {string} params.tenantId - Organization tenant
   * @param {string} params.mediaId - Unique media identifier
   * @param {string} params.sessionId - Associated capture session ID
   * @returns {Promise<{ storageKey: string, size: number, sha256: string, mimeType: string }>}
   */
  async store(params) {
    throw new Error('store() must be implemented by storage provider');
  }

  /**
   * Retrieves binary buffer by storage key within a tenant boundary.
   * @param {string} storageKey
   * @param {string} tenantId
   * @returns {Promise<{ buffer: Buffer, mimeType: string, size: number }>}
   */
  async retrieve(storageKey, tenantId) {
    throw new Error('retrieve() must be implemented by storage provider');
  }

  /**
   * Checks existence of a storage key within a tenant boundary.
   * @param {string} storageKey
   * @param {string} tenantId
   * @returns {Promise<boolean>}
   */
  async exists(storageKey, tenantId) {
    throw new Error('exists() must be implemented by storage provider');
  }

  /**
   * Deletes a stored asset.
   * @param {string} storageKey
   * @param {string} tenantId
   * @returns {Promise<boolean>}
   */
  async delete(storageKey, tenantId) {
    throw new Error('delete() must be implemented by storage provider');
  }
}

module.exports = {
  StorageAdapter
};
