/**
 * Proton Local Storage Adapter
 * 
 * Provides safe, tenant-isolated local filesystem persistence for medical media assets.
 * Enforces strict path-traversal sanitization and cryptographic integrity checks.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { StorageAdapter } = require('./storageAdapter');

class LocalStorageAdapter extends StorageAdapter {
  constructor(baseUploadDir = null) {
    super();
    this.baseDir = baseUploadDir || path.resolve(__dirname, '../../data/uploads');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Sanitizes tenant ID and keys to prevent directory traversal attacks.
   */
  _sanitizePathComponent(input, fieldName = 'path component') {
    if (!input || typeof input !== 'string') {
      throw new Error(`Invalid ${fieldName}: must be a non-empty string`);
    }

    // Strictly reject path traversal sequences and separators
    if (input.includes('..') || input.includes('/') || input.includes('\\') || input.includes('\0')) {
      throw new Error(`Path traversal violation detected in ${fieldName}: '${input}'`);
    }

    // Only allow safe alphanumeric characters, hyphens, and underscores
    const sanitized = input.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    if (!sanitized) {
      throw new Error(`Invalid characters in ${fieldName}`);
    }
    return sanitized;
  }

  _resolveTenantPath(tenantId) {
    const cleanTenant = this._sanitizePathComponent(tenantId, 'tenantId');
    const tenantDir = path.join(this.baseDir, cleanTenant);
    
    // Guard against escapes
    if (!tenantDir.startsWith(this.baseDir)) {
      throw new Error('Storage path breakout attempt detected');
    }

    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }

    return tenantDir;
  }

  _resolveFilePath(storageKey, tenantId) {
    const tenantDir = this._resolveTenantPath(tenantId);
    const cleanKey = this._sanitizePathComponent(storageKey, 'storageKey');
    const targetPath = path.join(tenantDir, cleanKey);

    if (!targetPath.startsWith(tenantDir)) {
      throw new Error('Storage path breakout attempt detected');
    }

    return targetPath;
  }

  _getExtForMime(mimeType) {
    switch (mimeType) {
      case 'image/jpeg':
      case 'image/jpg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        return 'bin';
    }
  }

  async store({ buffer, mimeType, tenantId = 'org-default', mediaId, sessionId = null }) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error('Invalid media buffer: must be a non-empty Buffer');
    }

    const cleanMediaId = this._sanitizePathComponent(mediaId, 'mediaId');
    const ext = this._getExtForMime(mimeType);
    const storageKey = `${cleanMediaId}.${ext}`;
    const filePath = this._resolveFilePath(storageKey, tenantId);

    // Compute cryptographic SHA-256 checksum
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // Write binary file
    fs.writeFileSync(filePath, buffer);

    // Write companion metadata JSON
    const metaPath = `${filePath}.meta.json`;
    const metadata = {
      mediaId: cleanMediaId,
      storageKey,
      mimeType,
      size: buffer.length,
      sha256,
      tenantId,
      sessionId,
      storedAt: new Date().toISOString()
    };
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

    return {
      storageKey,
      size: buffer.length,
      sha256,
      mimeType,
      filePath
    };
  }

  async retrieve(storageKey, tenantId = 'org-default') {
    const filePath = this._resolveFilePath(storageKey, tenantId);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Media asset not found: ${storageKey}`);
    }

    const buffer = fs.readFileSync(filePath);
    let mimeType = 'application/octet-stream';

    const metaPath = `${filePath}.meta.json`;
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        mimeType = meta.mimeType || mimeType;
      } catch {}
    }

    return {
      buffer,
      mimeType,
      size: buffer.length
    };
  }

  async exists(storageKey, tenantId = 'org-default') {
    try {
      const filePath = this._resolveFilePath(storageKey, tenantId);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  async delete(storageKey, tenantId = 'org-default') {
    try {
      const filePath = this._resolveFilePath(storageKey, tenantId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      const metaPath = `${filePath}.meta.json`;
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = {
  LocalStorageAdapter
};
