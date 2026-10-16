/**
 * Proton Healthcare Operations OS — Idempotency Repository
 * 
 * Provides durable SHA-256 idempotency cache across server restarts.
 */

const { getDatabase } = require('./db');

function getIdempotencyRecord(key, tenantId = 'org-default') {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM idempotency_keys
    WHERE key = ? AND tenant_id = ?;
  `).get(key, tenantId);

  if (!row) return null;

  // Check TTL expiration
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM idempotency_keys WHERE key = ? AND tenant_id = ?;').run(key, tenantId);
    return null;
  }

  let body = row.response_body;
  try {
    body = JSON.parse(body);
  } catch {
    // Keep as string if not JSON
  }

  return {
    key: row.key,
    tenantId: row.tenant_id,
    payloadHash: row.payload_hash,
    status: row.response_status,
    response: body,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

function setIdempotencyRecord({
  key,
  tenantId = 'org-default',
  payloadHash,
  status = 200,
  response,
  ttlSeconds = 86400 // 24 hours
}) {
  const db = getDatabase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const responseStr = typeof response === 'string' ? response : JSON.stringify(response);

  db.prepare(`
    INSERT INTO idempotency_keys (key, tenant_id, payload_hash, response_status, response_body, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      tenant_id = excluded.tenant_id,
      payload_hash = excluded.payload_hash,
      response_status = excluded.response_status,
      response_body = excluded.response_body,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at;
  `).run(
    key,
    tenantId,
    payloadHash,
    status,
    responseStr,
    now.toISOString(),
    expiresAt
  );
}

module.exports = {
  getIdempotencyRecord,
  setIdempotencyRecord
};
