/**
 * Proton Workflow Audit Trail — sequence-ordered SHA-256 hash chain.
 *
 * Why a separate chain from `operational_audit_events`:
 * that table derives the "previous" hash with
 *   ORDER BY timestamp DESC, id DESC
 * where `timestamp` is an ISO-8601 string and `id` contains a random suffix.
 * Two events written in the same millisecond therefore have no deterministic
 * order, and a chain built that way can both fork and appear broken after the
 * fact. Clinical workflow transitions are frequent and concurrent, so they get
 * a chain ordered by a BIGSERIAL sequence instead.
 *
 * Guarantees:
 *   - Append-only (no UPDATE/DELETE helper exists).
 *   - Chain head is read under a transaction-scoped advisory lock, so two
 *     concurrent transitions in the same tenant cannot fork the chain.
 *   - `verifyWorkflowAuditChain` replays every event and recomputes every hash.
 */

const crypto = require('crypto');
const { getPostgresPool } = require('../postgresDb');

const GENESIS_WORKFLOW_HASH = 'GENESIS_PROTON_WORKFLOW_AUDIT_ROOT_2026';

function canonicalPayload({
  prevHash,
  tenantId,
  encounterId,
  action,
  actorId,
  actorRole,
  fromState,
  toState,
  summary,
  occurredAt
}) {
  return [
    prevHash,
    tenantId,
    encounterId || 'none',
    action,
    actorId,
    actorRole,
    fromState || 'none',
    toState || 'none',
    summary,
    occurredAt
  ].join('::');
}

function computeWorkflowEventHash(fields) {
  return crypto.createHash('sha256').update(canonicalPayload(fields), 'utf8').digest('hex');
}

/**
 * Appends one event to the tenant's chain.
 *
 * @param {import('pg').PoolClient} client Transaction participant (required:
 *        the advisory lock and the state change must commit together).
 */
async function recordWorkflowAuditEvent(client, {
  tenantId = 'org-default',
  encounterId = null,
  action,
  actorId,
  actorRole,
  fromState = null,
  toState = null,
  summary,
  occurredAt = new Date()
}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('recordWorkflowAuditEvent requires a transaction client.');
  }

  // Serialize chain appends per tenant for the remainder of this transaction.
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('proton_workflow_audit:' || $1));`, [tenantId]);

  const { rows } = await client.query(
    `SELECT current_hash FROM workflow_audit_events
      WHERE tenant_id = $1
      ORDER BY seq DESC
      LIMIT 1;`,
    [tenantId]
  );

  const prevHash = rows.length > 0 ? rows[0].current_hash : GENESIS_WORKFLOW_HASH;
  const occurredAtIso = occurredAt instanceof Date ? occurredAt.toISOString() : new Date(occurredAt).toISOString();

  const fields = {
    prevHash,
    tenantId,
    encounterId,
    action,
    actorId,
    actorRole,
    fromState,
    toState,
    summary,
    occurredAt: occurredAtIso
  };

  const currentHash = computeWorkflowEventHash(fields);

  const inserted = await client.query(
    `INSERT INTO workflow_audit_events
       (id, tenant_id, encounter_id, action, actor_id, actor_role,
        from_state, to_state, summary, occurred_at, prev_hash, current_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *;`,
    [
      `wfa-${crypto.randomUUID()}`,
      tenantId,
      encounterId,
      action,
      actorId,
      actorRole,
      fromState,
      toState,
      summary,
      occurredAtIso,
      prevHash,
      currentHash
    ]
  );

  return inserted.rows[0];
}

/**
 * Recomputes the whole chain for a tenant and reports the first break.
 */
async function verifyWorkflowAuditChain({ tenantId = 'org-default', pool = null } = {}) {
  const p = pool || getPostgresPool();
  const { rows } = await p.query(
    `SELECT seq, tenant_id, encounter_id, action, actor_id, actor_role,
            from_state, to_state, summary, occurred_at, prev_hash, current_hash
       FROM workflow_audit_events
      WHERE tenant_id = $1
      ORDER BY seq ASC;`,
    [tenantId]
  );

  let expectedPrev = GENESIS_WORKFLOW_HASH;

  for (let i = 0; i < rows.length; i++) {
    const event = rows[i];
    const occurredAtIso =
      event.occurred_at instanceof Date ? event.occurred_at.toISOString() : new Date(event.occurred_at).toISOString();

    if (event.prev_hash !== expectedPrev) {
      return {
        valid: false,
        tenantId,
        checked: i,
        brokenAtSeq: Number(event.seq),
        error: `Chain fork at seq ${event.seq}: expected prev_hash ${expectedPrev}, found ${event.prev_hash}.`
      };
    }

    const recomputed = computeWorkflowEventHash({
      prevHash: event.prev_hash,
      tenantId: event.tenant_id,
      encounterId: event.encounter_id,
      action: event.action,
      actorId: event.actor_id,
      actorRole: event.actor_role,
      fromState: event.from_state,
      toState: event.to_state,
      summary: event.summary,
      occurredAt: occurredAtIso
    });

    if (recomputed !== event.current_hash) {
      return {
        valid: false,
        tenantId,
        checked: i,
        brokenAtSeq: Number(event.seq),
        error: `Tampering detected at seq ${event.seq}: content hash ${recomputed} does not match stored ${event.current_hash}.`
      };
    }

    expectedPrev = event.current_hash;
  }

  return {
    valid: true,
    tenantId,
    totalEventsVerified: rows.length,
    headHash: expectedPrev,
    rootAnchor: GENESIS_WORKFLOW_HASH,
    verifiedAt: new Date().toISOString()
  };
}

async function listWorkflowAuditEvents({ tenantId = 'org-default', encounterId = null, limit = 100, pool = null } = {}) {
  const p = pool || getPostgresPool();
  const params = [tenantId];
  let sql = `SELECT * FROM workflow_audit_events WHERE tenant_id = $1`;
  if (encounterId) {
    params.push(encounterId);
    sql += ` AND encounter_id = $2`;
  }
  params.push(Math.min(Math.max(Number(limit) || 100, 1), 500));
  sql += ` ORDER BY seq DESC LIMIT $${params.length};`;
  const { rows } = await p.query(sql, params);
  return rows;
}

module.exports = {
  GENESIS_WORKFLOW_HASH,
  computeWorkflowEventHash,
  recordWorkflowAuditEvent,
  verifyWorkflowAuditChain,
  listWorkflowAuditEvents
};
