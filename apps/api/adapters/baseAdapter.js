/**
 * Proton Operations OS — Integration Adapters Base Interface
 * 
 * Provides standard contracts, latency simulation, logging, and sandboxing
 * for all external healthcare system adapters.
 */

class BaseAdapter {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.isSandbox = config.isSandbox !== false; // Default: true for synthetic safety
    this.callHistory = [];
  }

  logCall(action, payload, result, error = null) {
    const record = {
      timestamp: new Date().toISOString(),
      adapter: this.name,
      action,
      payload: this.sanitizePayload(payload),
      result: result ? this.sanitizePayload(result) : null,
      error: error ? error.message : null,
      isSandbox: this.isSandbox
    };
    this.callHistory.push(record);
    if (this.callHistory.length > 200) {
      this.callHistory.shift();
    }
    return record;
  }

  sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const copy = Array.isArray(payload) ? [...payload] : { ...payload };
    // Redact obvious sensitive secrets
    for (const key of Object.keys(copy)) {
      if (/password|secret|key|token|auth/i.test(key)) {
        copy[key] = '***REDACTED***';
      }
    }
    return copy;
  }

  getCallHistory() {
    return [...this.callHistory];
  }

  clearHistory() {
    this.callHistory = [];
  }
}

module.exports = BaseAdapter;
