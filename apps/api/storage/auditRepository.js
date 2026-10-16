/**
 * Proton Healthcare Operations OS — Audit Repository
 * 
 * Provides a backend-authoritative, tamper-evident append-only audit trail
 * with cryptographic SHA-256 hash chaining. Client audit injection is strictly barred.
 */

const crypto = require('crypto');
const { getDatabase } = require('./db');

const GENESIS_HASH = 'GENESIS_PROTON_AUDIT_ROOT_2026';

function computeRowHash(prevHash, id, timestamp, tenantId, actorId, action, patientId, resultingState, summary = '', physicianDirective = '') {
  const payload = [
    prevHash,
    id,
    timestamp,
    tenantId,
    actorId,
    action,
    patientId || '',
    resultingState || '',
    summary || '',
    physicianDirective || ''
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

function recordAuditEvent({
  id = null,
  tenantId = 'org-default',
  timestamp = null,
  action,
  actorId = 'system',
  actorRole = 'system',
  actorName = 'Proton System',
  patientId = null,
  targetResourceId = null,
  summary,
  previousState = null,
  resultingState = null,
  physicianDirective = null
}) {
  const db = getDatabase();
  const eventId = id || `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = timestamp || new Date().toISOString();

  // Retrieve the tip of the hash chain for this tenant atomically
  const tip = db.prepare(`
    SELECT current_hash FROM operational_audit_events
    WHERE tenant_id = ?
    ORDER BY rowid DESC LIMIT 1;
  `).get(tenantId);

  const prevHash = tip ? tip.current_hash : GENESIS_HASH;
  const effectivePatientId = patientId || 'none';
  const currentHash = computeRowHash(
    prevHash,
    eventId,
    now,
    tenantId,
    actorId,
    action,
    effectivePatientId,
    resultingState,
    summary,
    physicianDirective
  );

  db.prepare(`
    INSERT INTO operational_audit_events (
      id, tenant_id, timestamp, action,
      actor_id, actor_role, actor_name,
      patient_id, target_resource_id, summary,
      previous_state, resulting_state, physician_directive,
      prev_hash, current_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).run(
    eventId,
    tenantId,
    now,
    action,
    actorId,
    actorRole,
    actorName,
    patientId || 'none',
    targetResourceId || null,
    summary,
    previousState || null,
    resultingState || null,
    physicianDirective || null,
    prevHash,
    currentHash
  );

  return {
    id: eventId,
    tenantId,
    timestamp: now,
    action,
    actor: actorName,
    actorRole,
    patientId: patientId || 'none',
    summary,
    targetResourceId,
    previousState,
    resultingState,
    physicianDirective,
    prevHash,
    currentHash
  };
}

function listAuditEvents({ tenantId = 'org-default', limit = 50 } = {}) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM operational_audit_events
    WHERE tenant_id = ?
    ORDER BY timestamp DESC, rowid DESC
    LIMIT ?;
  `).all(tenantId, limit);

  return rows.map(r => ({
    id: r.id,
    timestamp: r.timestamp,
    action: r.action,
    actor: r.actor_name,
    actorId: r.actor_id,
    actorRole: r.actor_role,
    patientId: r.patient_id,
    targetResourceId: r.target_resource_id,
    summary: r.summary,
    previousState: r.previous_state,
    resultingState: r.resulting_state,
    physicianDirective: r.physician_directive,
    prevHash: r.prev_hash,
    currentHash: r.current_hash
  }));
}

/**
 * Verifies that the append-only audit trail's hash chain is unbroken and untampered.
 */
function verifyAuditChain(tenantId = 'org-default') {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM operational_audit_events
    WHERE tenant_id = ?
    ORDER BY rowid ASC;
  `).all(tenantId);

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        error: `Hash chain broken at event ${row.id}: expected prev_hash ${expectedPrevHash}, found ${row.prev_hash}`,
        failingEventId: row.id,
        failingIndex: i
      };
    }

    const calculatedHash = computeRowHash(
      row.prev_hash,
      row.id,
      row.timestamp,
      row.tenant_id,
      row.actor_id,
      row.action,
      row.patient_id,
      row.resulting_state,
      row.summary,
      row.physician_directive
    );

    if (calculatedHash !== row.current_hash) {
      return {
        valid: false,
        error: `Content tampering detected at event ${row.id}: calculated ${calculatedHash}, stored ${row.current_hash}`,
        failingEventId: row.id,
        failingIndex: i
      };
    }

    expectedPrevHash = row.current_hash;
  }

  return {
    valid: true,
    totalEventsVerified: rows.length,
    rootAnchor: GENESIS_HASH,
    latestTipHash: expectedPrevHash
  };
}

function recordEvent({
  eventType,
  action,
  actorId = 'system',
  actorRole = 'system',
  actorName = 'Proton System',
  tenantId = 'org-default',
  taskId = null,
  patientId = null,
  details = {}
}) {
  return recordAuditEvent({
    action: action || eventType || 'audit_action',
    actorId,
    actorRole,
    actorName,
    tenantId,
    patientId,
    targetResourceId: taskId,
    summary: typeof details === 'string' ? details : JSON.stringify(details || {}),
    resultingState: details.status || details.resultingState || null
  });
}

function verifyChain(tenantId = 'org-default') {
  const res = verifyAuditChain(tenantId);
  return {
    valid: res.valid,
    checkedEvents: res.totalEventsVerified || 0,
    ...res
  };
}

module.exports = {
  recordAuditEvent,
  recordEvent,
  listAuditEvents,
  verifyAuditChain,
  verifyChain,
  GENESIS_HASH
};
