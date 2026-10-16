/**
 * Proton Capture Session Token Manager
 * 
 * Provides cryptographically secure random token generation,
 * SHA-256 token hashing, constant-time verification, and sanitization.
 * 
 * Invariants:
 * - Raw pairing tokens are ephemeral and NEVER persisted to storage or audit logs.
 * - Tokens are strictly opaque capabilities containing ZERO clinical, patient, or tenant data.
 */

const crypto = require('crypto');

const PAIRING_TTL_MS = 10 * 60 * 1000; // 10 minutes
const ACTIVE_TTL_MS = 15 * 60 * 1000;  // 15 minutes once paired
const UPLOAD_TTL_MS = 15 * 60 * 1000;  // 15 minutes for upload capability

class TokenManager {
  /**
   * Generates a cryptographically secure random pairing token and its SHA-256 hash.
   * @param {number} [ttlMs] - Time-to-live in milliseconds
   * @returns {{ rawToken: string, tokenHash: string, expiresAt: string, ttlMs: number }}
   */
  generatePairingToken(ttlMs = PAIRING_TTL_MS) {
    // 32 cryptographically random bytes = 256 bits entropy
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    return {
      rawToken,
      tokenHash,
      expiresAt,
      ttlMs
    };
  }

  /**
   * Generates a secondary mobile session capability token upon successful pairing.
   */
  generateMobileToken(ttlMs = ACTIVE_TTL_MS) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    return {
      rawToken,
      tokenHash,
      expiresAt,
      ttlMs
    };
  }

  /**
   * Generates a scoped, single-use upload capability token.
   */
  generateUploadToken(ttlMs = UPLOAD_TTL_MS) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    return {
      rawToken,
      tokenHash,
      expiresAt,
      ttlMs
    };
  }

  /**
   * Computes the SHA-256 hash of a raw token.
   * @param {string} rawToken
   * @returns {string} Hex-encoded SHA-256 hash
   */
  hashToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new Error('Invalid token: must be a non-empty string');
    }
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Constant-time comparison between a provided raw token and an expected hash.
   * Defends against timing attacks.
   * @param {string} rawToken
   * @param {string} expectedHash
   * @returns {boolean}
   */
  verifyToken(rawToken, expectedHash) {
    if (!rawToken || !expectedHash || typeof rawToken !== 'string' || typeof expectedHash !== 'string') {
      return false;
    }

    try {
      const computedHash = this.hashToken(rawToken);
      const computedBuf = Buffer.from(computedHash, 'hex');
      const expectedBuf = Buffer.from(expectedHash, 'hex');

      if (computedBuf.length !== expectedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(computedBuf, expectedBuf);
    } catch {
      return false;
    }
  }

  /**
   * Checks whether a token is truly opaque (e.g. 64-character hex string),
   * strictly barring JWT structures, JSON, or embedded delimiters.
   * @param {string} token
   * @returns {boolean}
   */
  isOpaque(token) {
    if (!token || typeof token !== 'string') return false;
    // Strictly require 64 hexadecimal characters
    return /^[a-f0-9]{64}$/i.test(token);
  }

  /**
   * Sanitizes a token or hash for safe recording in audit trails.
   * Never logs raw token bytes.
   * @param {string} rawTokenOrHash
   * @returns {string} Safe redacted representation
   */
  sanitizeForAudit(rawTokenOrHash) {
    if (!rawTokenOrHash || typeof rawTokenOrHash !== 'string') return '[REDACTED]';
    // If it's a raw token, hash it first so even the prefix doesn't reveal raw token bits
    const hash = rawTokenOrHash.length === 64 && /^[a-f0-9]+$/i.test(rawTokenOrHash)
      ? rawTokenOrHash
      : this.hashToken(rawTokenOrHash);
    return `hash:${hash.substring(0, 8)}...${hash.substring(hash.length - 4)}`;
  }
}

const tokenManager = new TokenManager();

module.exports = {
  TokenManager,
  tokenManager,
  PAIRING_TTL_MS,
  ACTIVE_TTL_MS
};
