/**
 * Proton Operations OS — Idempotency Management Layer
 * 
 * ARCHITECTURAL SPECIFICATION:
 * Prevents duplicate webhook deliveries, repeated scheduling runs, or double task generation.
 * 
 * BACKING STORE SPECIFICATION:
 * [DEVELOPMENT/BETA ONLY] InMemoryIdempotencyStore is strictly for local dev/testing.
 * It is NOT distributed across multiple processes or server restarts.
 * For production multi-instance deployments, substitute a Redis or PostgreSQL backing store
 * implementing the IdempotencyStore interface.
 * 
 * REPLAY BEHAVIOR:
 * 1. Same Idempotency-Key + Same Payload Hash -> Return cached result (200 OK) with replay header.
 * 2. Same Idempotency-Key + Different Payload Hash -> Reject with 409 Conflict (IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD).
 * 3. TTL / Retention: Default 24 hours (86,400,000 ms).
 * 4. Concurrency: In-memory lock prevents concurrent duplicate processing of the same key.
 */

const crypto = require('crypto');

class IdempotencyConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IdempotencyConflictError';
    this.statusCode = 409;
    this.code = 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD';
  }
}

/**
 * Abstract Base Class / Interface for Idempotency Stores
 * Distributed implementations (Redis, Postgres) must conform to this interface.
 */
class IdempotencyStore {
  async get(key) {
    throw new Error('IdempotencyStore.get() must be implemented.');
  }

  async set(key, entry, ttlSeconds) {
    throw new Error('IdempotencyStore.set() must be implemented.');
  }

  async acquireLock(key, ttlSeconds) {
    throw new Error('IdempotencyStore.acquireLock() must be implemented.');
  }

  async releaseLock(key) {
    throw new Error('IdempotencyStore.releaseLock() must be implemented.');
  }
}

/**
 * [DEVELOPMENT/BETA ONLY] In-Memory Idempotency Store
 * Labeled explicitly as development/beta-only.
 */
class InMemoryIdempotencyStore extends IdempotencyStore {
  constructor(defaultTtlMs = 24 * 60 * 60 * 1000) {
    super();
    this.defaultTtlMs = defaultTtlMs;
    this.store = new Map();
    this.locks = new Set();
    this.isDistributed = false;
    this.backendType = 'in_memory_development_beta';
  }

  computeHash(payload) {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  async acquireLock(key) {
    if (this.locks.has(key)) {
      return false;
    }
    this.locks.add(key);
    return true;
  }

  async releaseLock(key) {
    this.locks.delete(key);
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  async set(key, { payloadHash, result }, ttlMs = this.defaultTtlMs) {
    this.store.set(key, {
      payloadHash,
      result,
      cachedAt: new Date().toISOString(),
      expiresAt: Date.now() + ttlMs
    });
  }

  clear() {
    this.store.clear();
    this.locks.clear();
  }
}

/**
 * Durable SQLite Idempotency Store (Phase 1.4)
 * Persists keys, hashes, and responses across server restarts.
 */
const idempotencyRepository = require('../storage/idempotencyRepository');

class DurableSqliteIdempotencyStore extends IdempotencyStore {
  constructor(defaultTtlSeconds = 86400) {
    super();
    this.defaultTtlSeconds = defaultTtlSeconds;
    this.locks = new Set();
    this.backendType = 'sqlite_durable_wal';
  }

  computeHash(payload) {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  async acquireLock(key) {
    if (this.locks.has(key)) return false;
    this.locks.add(key);
    return true;
  }

  async releaseLock(key) {
    this.locks.delete(key);
  }

  async get(key, tenantId = 'org-default') {
    const row = idempotencyRepository.getIdempotencyRecord(key, tenantId);
    if (!row) return null;
    return {
      payloadHash: row.payloadHash,
      result: row.response,
      cachedAt: row.createdAt
    };
  }

  async set(key, { payloadHash, result }, ttlSeconds = this.defaultTtlSeconds, tenantId = 'org-default') {
    idempotencyRepository.setIdempotencyRecord({
      key,
      tenantId,
      payloadHash,
      status: result?.status || 200,
      response: result,
      ttlSeconds
    });
  }

  clear() {
    this.locks.clear();
  }
}

// Global durable instance for Phase 1.4
const globalIdempotencyStore = new DurableSqliteIdempotencyStore();

module.exports = {
  IdempotencyConflictError,
  IdempotencyStore,
  InMemoryIdempotencyStore,
  DurableSqliteIdempotencyStore,
  globalIdempotencyStore
};
