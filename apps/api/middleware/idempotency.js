/**
 * Proton Healthcare Operations OS — Idempotency Middleware
 * 
 * Enforces:
 * 1. Same Idempotency-Key + Same Payload Hash -> Return cached result (status & payload) with X-Idempotent-Replay: true
 * 2. Same Idempotency-Key + Different Payload Hash -> 409 Conflict with IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD
 * 3. Durable SQLite backing via idempotencyRepository
 */

const crypto = require('crypto');
const { getIdempotencyRecord, setIdempotencyRecord } = require('../storage/idempotencyRepository');

function computePayloadHash(payload) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return next();
  }

  const tenantId = req.actor?.tenantId || req.query.tenantId || req.body?.tenantId || 'org-default';
  const currentHash = computePayloadHash(req.body);

  try {
    const existing = getIdempotencyRecord(idempotencyKey, tenantId);
    if (existing) {
      if (existing.payloadHash !== currentHash) {
        return res.status(409).json({
          error: 'Idempotency key reused with different payload',
          code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
          key: idempotencyKey
        });
      }

      res.setHeader('X-Cache-Lookup', 'HIT');
      res.setHeader('X-Idempotent-Replay', 'true');
      const responseStatus = existing.status || 200;
      return res.status(responseStatus).json(existing.response);
    }
  } catch (err) {
    console.error('[IdempotencyMiddleware] Read error:', err.message);
  }

  // Intercept response to store successful completion
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      try {
        setIdempotencyRecord({
          key: idempotencyKey,
          tenantId,
          payloadHash: currentHash,
          status: res.statusCode,
          response: body,
          ttlSeconds: 86400 // 24 hours
        });
      } catch (err) {
        console.error('[IdempotencyMiddleware] Write error:', err.message);
      }
    }
    return originalJson(body);
  };

  next();
}

module.exports = {
  idempotencyMiddleware,
  computePayloadHash
};
