/**
 * Proton Healthcare Operations OS — State Coordinator (Single-Process Prototype)
 * 
 * Provides an in-memory coordinator for:
 * - SSE stream event routing via EventEmitter.
 * - In-process session token revocation blacklist.
 * - Nurse Rooming drafts and active patient queues.
 * - Acute Triage alerts and escalation channels.
 * - Idempotency cache with TTL.
 * 
 * NOTE: Currently operates in-memory. Distributed Redis client integration
 * is scheduled for multi-instance cluster deployment.
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class DistributedStateManager {
  constructor(options = {}) {
    this.redisUrl = options.redisUrl || process.env.REDIS_URL || null;
    this.mode = 'in-process-coordinator';
    
    // Internal state store
    this._kvStore = new Map();         // key -> { value, expiresAt }
    this._sets = new Map();            // key -> Set of strings
    this._queues = new Map();          // key -> Array of items
    this._pubsub = new EventEmitter(); // channel -> listeners
    this._pubsub.setMaxListeners(100);

    // Periodic sweep for expired keys (every 30s)
    this._cleanupInterval = setInterval(() => this._sweepExpired(), 30000);
    if (this._cleanupInterval.unref) {
      this._cleanupInterval.unref();
    }
  }

  /**
   * Cleans up expired KV entries.
   */
  _sweepExpired() {
    const now = Date.now();
    for (const [key, record] of this._kvStore.entries()) {
      if (record.expiresAt && record.expiresAt <= now) {
        this._kvStore.delete(key);
      }
    }
  }

  // ==========================================================================
  // 1. KEY-VALUE OPERATIONS WITH TTL
  // ==========================================================================

  async get(key) {
    if (!key) return null;
    const record = this._kvStore.get(key);
    if (!record) return null;
    if (record.expiresAt && record.expiresAt <= Date.now()) {
      this._kvStore.delete(key);
      return null;
    }
    return record.value;
  }

  async set(key, value, ttlSeconds = null) {
    if (!key) throw new Error('Key is required for set operation');
    const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    this._kvStore.set(key, { value, expiresAt });
    return true;
  }

  async del(key) {
    return this._kvStore.delete(key);
  }

  // ==========================================================================
  // 2. DISTRIBUTED SET OPERATIONS (Revocation Blacklists, Active Node Registry)
  // ==========================================================================

  async addToSet(setKey, value) {
    if (!setKey || !value) return false;
    let s = this._sets.get(setKey);
    if (!s) {
      s = new Set();
      this._sets.set(setKey, s);
    }
    s.add(String(value));
    return true;
  }

  async isMemberOfSet(setKey, value) {
    if (!setKey || !value) return false;
    const s = this._sets.get(setKey);
    if (!s) return false;
    return s.has(String(value));
  }

  async removeFromSet(setKey, value) {
    if (!setKey || !value) return false;
    const s = this._sets.get(setKey);
    if (!s) return false;
    return s.delete(String(value));
  }

  async getSetMembers(setKey) {
    const s = this._sets.get(setKey);
    if (!s) return [];
    return Array.from(s);
  }

  // ==========================================================================
  // 3. DISTRIBUTED QUEUE OPERATIONS (Acute Triage, Background Jobs)
  // ==========================================================================

  async pushQueue(queueKey, item) {
    if (!queueKey || item === undefined) return false;
    let q = this._queues.get(queueKey);
    if (!q) {
      q = [];
      this._queues.set(queueKey, q);
    }
    q.push(item);
    return q.length;
  }

  async popQueue(queueKey) {
    const q = this._queues.get(queueKey);
    if (!q || q.length === 0) return null;
    return q.shift();
  }

  async peekQueue(queueKey) {
    const q = this._queues.get(queueKey);
    if (!q) return [];
    return [...q];
  }

  async removeQueueItem(queueKey, predicateFn) {
    const q = this._queues.get(queueKey);
    if (!q) return false;
    const initialLen = q.length;
    const filtered = q.filter(item => !predicateFn(item));
    this._queues.set(queueKey, filtered);
    return filtered.length < initialLen;
  }

  // ==========================================================================
  // 4. PUB / SUB ROUTING (Multi-Instance SSE Stream Event Broadcasting)
  // ==========================================================================

  async publish(channel, message) {
    if (!channel) return 0;
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    this._pubsub.emit(channel, payload);
    return this._pubsub.listenerCount(channel);
  }

  subscribe(channel, handler) {
    if (!channel || typeof handler !== 'function') {
      throw new Error('Channel and callback function are required for subscription');
    }
    const wrapper = (rawMessage) => {
      try {
        const parsed = JSON.parse(rawMessage);
        handler(parsed);
      } catch {
        handler(rawMessage);
      }
    };
    this._pubsub.on(channel, wrapper);
    
    // Return unsubscribe function
    return () => {
      this._pubsub.removeListener(channel, wrapper);
    };
  }

  // ==========================================================================
  // 5. TEST & LIFECYCLE MANAGEMENT
  // ==========================================================================

  clear() {
    this._kvStore.clear();
    this._sets.clear();
    this._queues.clear();
    this._pubsub.removeAllListeners();
  }

  destroy() {
    clearInterval(this._cleanupInterval);
    this.clear();
  }
}

// Singleton instance
const distributedStateManager = new DistributedStateManager();

module.exports = {
  DistributedStateManager,
  distributedStateManager
};
