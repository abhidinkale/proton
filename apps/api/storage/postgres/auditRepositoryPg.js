/**
 * Proton Healthcare Operations OS — PostgreSQL Tamper-Evident Audit Trail Repository
 * 
 * Provides an append-only, SHA-256 hash-chained audit trail backed by PostgreSQL.
 */

const crypto = require('crypto');
const { getPostgresPool } = require('../postgresDb');

const GENESIS_ROOT_HASH = 'GENESIS_PROTON_AUDIT_ROOT_2026';

function computeEventHash({
  prevHash,
  timestamp,
  tenantId,
  actorId,
  action,
  patientId,
  targetResourceId,
  summary,
  physicianDirective
}) {
  const payload = [
    prevHash,
    timestamp,
    tenantId,
    actorId,
    action,
    patientId || 'none',
    targetResourceId || 'none',
    summary,
    physicianDirective || 'none'
  ].join('::');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

async function recordAuditEvent({
  tenantId = 'org-default',
  action,
  actorId,
  actorRole = 'physician',
  actorName = 'Dr. Sarah Lin, MD',
  patientId = 'none',
  targetResourceId = null,
  summary,
  previousState = null,
  resultingState = null,
  physicianDirective = null
}, pool = null) {
  const p = pool || getPostgresPool();
  const id = `aud-pg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  // Find previous event hash for this tenant
  const { rows: latestRows } = await p.query(
    'SELECT current_hash FROM operational_audit_events WHERE tenant_id = $1 ORDER BY timestamp DESC, id DESC LIMIT 1;',
    [tenantId]
  );
  const prevHash = latestRows.length > 0 ? latestRows[0].current_hash : GENESIS_ROOT_HASH;

  const currentHash = computeEventHash({
    prevHash,
    timestamp: now,
    tenantId,
    actorId,
    action,
    patientId,
    targetResourceId,
    summary,
    physicianDirective
  });

  const query = `
    INSERT INTO operational_audit_events (
      id, tenant_id, timestamp, action,
      actor_id, actor_role, actor_name,
      patient_id, target_resource_id, summary,
      previous_state, resulting_state, physician_directive,
      prev_hash, current_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *;
  `;

  const values = [
    id, tenantId, now, action,
    actorId, actorRole, actorName,
    patientId, targetResourceId, summary,
    previousState, resultingState, physicianDirective,
    prevHash, currentHash
  ];

  const { rows } = await p.query(query, values);
  return rows[0];
}

async function listAuditEvents({ tenantId = 'org-default', limit = 50, patientId = null } = {}, pool = null) {
  const p = pool || getPostgresPool();
  const conditions = ['tenant_id = $1'];
  const params = [tenantId];

  if (patientId) {
    conditions.push('patient_id = $2');
    params.push(patientId);
  }
  params.push(limit);

  const query = `
    SELECT * FROM operational_audit_events
    WHERE ${conditions.join(' AND ')}
    ORDER BY timestamp DESC
    LIMIT $${params.length};
  `;

  const { rows } = await p.query(query, params);
  return rows.map(r => ({
    id: r.id,
    tenantId: r.tenant_id,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
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

async function verifyAuditChain(tenantId = 'org-default', pool = null) {
  const p = pool || getPostgresPool();
  const { rows } = await p.query(
    'SELECT * FROM operational_audit_events WHERE tenant_id = $1 ORDER BY timestamp ASC, id ASC;',
    [tenantId]
  );

  let expectedPrevHash = GENESIS_ROOT_HASH;

  for (let i = 0; i < rows.length; i++) {
    const event = rows[i];
    const eventTimestamp = event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp;

    if (event.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        brokenAtIndex: i,
        corruptedEventId: event.id,
        error: `Hash chain broken at event ${event.id}. Expected prev_hash '${expectedPrevHash}', found '${event.prev_hash}'.`
      };
    }

    const calculatedHash = computeEventHash({
      prevHash: event.prev_hash,
      timestamp: eventTimestamp,
      tenantId: event.tenant_id,
      actorId: event.actor_id,
      action: event.action,
      patientId: event.patient_id,
      targetResourceId: event.target_resource_id,
      summary: event.summary,
      physicianDirective: event.physician_directive
    });

    if (calculatedHash !== event.current_hash) {
      return {
        valid: false,
        brokenAtIndex: i,
        corruptedEventId: event.id,
        error: `Data tampering detected at event ${event.id}. Content hash does not match stored cryptographic hash.`
      };
    }

    expectedPrevHash = event.current_hash;
  }

  return {
    valid: true,
    tenantId,
    totalEventsVerified: rows.length,
    rootAnchor: GENESIS_ROOT_HASH,
    headHash: expectedPrevHash,
    verifiedAt: new Date().toISOString()
  };
}

module.exports = {
  recordAuditEvent,
  listAuditEvents,
  verifyAuditChain,
  computeEventHash,
  GENESIS_ROOT_HASH
};
