/**
 * Proton Workflow Repository (PostgreSQL)
 *
 * All workflow state lives here. Every mutating method that changes an
 * encounter takes a `client` and participates in the caller's transaction so
 * that state + events + audit + outbox commit atomically.
 */

const crypto = require('crypto');
const { getPostgresPool } = require('../postgresDb');
const { WorkflowError } = require('../../services/workflow/encounterStateMachine');
const { recordWorkflowAuditEvent } = require('./workflowAuditRepository');

function pool(p = null) {
  return p || getPostgresPool();
}

/**
 * Runs `fn(client)` inside a transaction, retrying serialization failures.
 */
async function withTransaction(fn, { retries = 2, p = null } = {}) {
  const target = pool(p);
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const client = await target.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // connection already dead; nothing to roll back
      }
      lastError = err;
      const retryable = err && (err.code === '40001' || err.code === '40P01');
      if (!retryable || attempt === retries) throw err;
    } finally {
      client.release();
    }
  }

  throw lastError;
}

const newId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

async function createPatient(input, { client = null, p = null } = {}) {
  const id = input.id || newId('pat');
  const q = client || pool(p);

  const { rows } = await q.query(
    `INSERT INTO patients
       (id, tenant_id, fhir_patient_id, mrn, full_name, date_of_birth, sex, contact)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *;`,
    [
      id,
      input.tenantId || 'org-default',
      input.fhirPatientId || null,
      input.mrn || null,
      input.fullName,
      input.dateOfBirth || null,
      input.sex || null,
      JSON.stringify(input.contact || {})
    ]
  );
  return rows[0];
}

async function getPatient({ tenantId = 'org-default', patientId, client = null, p = null }) {
  const q = client || pool(p);
  const { rows } = await q.query(`SELECT * FROM patients WHERE id = $1 AND tenant_id = $2;`, [patientId, tenantId]);
  return rows[0] || null;
}

async function findPatientByMrn({ tenantId = 'org-default', mrn, client = null, p = null }) {
  if (!mrn) return null;
  const q = client || pool(p);
  const { rows } = await q.query(`SELECT * FROM patients WHERE tenant_id = $1 AND mrn = $2;`, [tenantId, mrn]);
  return rows[0] || null;
}

async function listPatients({ tenantId = 'org-default', limit = 50, p = null } = {}) {
  const { rows } = await pool(p).query(
    `SELECT * FROM patients WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2;`,
    [tenantId, Math.min(Math.max(Number(limit) || 50, 1), 200)]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

async function createAppointment(input, { client = null, p = null } = {}) {
  const q = client || pool(p);
  const id = input.id || newId('apt');

  const { rows } = await q.query(
    `INSERT INTO appointments
       (id, tenant_id, patient_id, clinician_id, scheduled_for, duration_minutes,
        status, reason, fhir_appointment_id, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, 'BOOKED', $7, $8, $9)
     RETURNING *;`,
    [
      id,
      input.tenantId || 'org-default',
      input.patientId,
      input.clinicianId,
      input.scheduledFor,
      input.durationMinutes || 20,
      input.reason || null,
      input.fhirAppointmentId || null,
      input.idempotencyKey || null
    ]
  );
  return rows[0];
}

async function getAppointment({ tenantId = 'org-default', appointmentId, client = null, p = null }) {
  const q = client || pool(p);
  const { rows } = await q.query(`SELECT * FROM appointments WHERE id = $1 AND tenant_id = $2;`, [
    appointmentId,
    tenantId
  ]);
  return rows[0] || null;
}

async function listAppointments({ tenantId = 'org-default', from = null, to = null, p = null } = {}) {
  const params = [tenantId];
  let sql = `SELECT a.*, p.full_name AS patient_name
               FROM appointments a
               JOIN patients p ON p.id = a.patient_id
              WHERE a.tenant_id = $1`;
  if (from) {
    params.push(from);
    sql += ` AND a.scheduled_for >= $${params.length}`;
  }
  if (to) {
    params.push(to);
    sql += ` AND a.scheduled_for <= $${params.length}`;
  }
  sql += ` ORDER BY a.scheduled_for ASC LIMIT 200;`;
  const { rows } = await pool(p).query(sql, params);
  return rows;
}

async function findAppointmentByIdempotencyKey({ tenantId = 'org-default', idempotencyKey, client = null, p = null }) {
  if (!idempotencyKey) return null;
  const q = client || pool(p);
  const { rows } = await q.query(
    `SELECT * FROM appointments WHERE tenant_id = $1 AND idempotency_key = $2;`,
    [tenantId, idempotencyKey]
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Encounters
// ---------------------------------------------------------------------------

/**
 * Creates an encounter in BOOKED and writes its first event + audit entry.
 */
async function createEncounter(input, { client = null, p = null } = {}) {
  const run = async (c) => {
    const id = input.id || newId('enc');
    const tenantId = input.tenantId || 'org-default';
    const actor = input.actor || { actorId: 'system', actorRole: 'system' };
    const now = new Date();

    const { rows } = await c.query(
      `INSERT INTO encounters
         (id, tenant_id, patient_id, appointment_id, clinician_id, state, version, fhir_encounter_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'BOOKED', 1, $6, $7, $7)
       RETURNING *;`,
      [id, tenantId, input.patientId, input.appointmentId || null, input.clinicianId, input.fhirEncounterId || null, now]
    );
    const encounter = rows[0];

    await c.query(
      `INSERT INTO encounter_events
         (encounter_id, tenant_id, sequence, action, from_state, to_state,
          actor_id, actor_role, actor_name, reason, metadata, occurred_at)
       VALUES ($1, $2, 1, 'create', NULL, 'BOOKED', $3, $4, $5, $6, $7, $8);`,
      [
        id,
        tenantId,
        actor.actorId,
        actor.actorRole,
        actor.actorName || null,
        input.reason || null,
        JSON.stringify(input.metadata || {}),
        now
      ]
    );

    await recordWorkflowAuditEvent(c, {
      tenantId,
      encounterId: id,
      action: 'create',
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      fromState: null,
      toState: 'BOOKED',
      summary: `create: -> BOOKED (encounter opened for patient ${input.patientId})`,
      occurredAt: now
    });

    return encounter;
  };

  if (client) return run(client);
  return withTransaction(run, { p });
}

async function getEncounter({ tenantId = 'org-default', encounterId, client = null, p = null }) {
  const q = client || pool(p);
  const { rows } = await q.query(
    `SELECT e.*, p.full_name AS patient_name, p.mrn
       FROM encounters e
       JOIN patients p ON p.id = e.patient_id
      WHERE e.id = $1 AND e.tenant_id = $2;`,
    [encounterId, tenantId]
  );
  return rows[0] || null;
}

async function getEncounterByAppointment({ tenantId = 'org-default', appointmentId, client = null, p = null }) {
  const q = client || pool(p);
  const { rows } = await q.query(
    `SELECT e.*, p.full_name AS patient_name, p.mrn
       FROM encounters e
       JOIN patients p ON p.id = e.patient_id
      WHERE e.appointment_id = $1 AND e.tenant_id = $2
      ORDER BY e.created_at ASC
      LIMIT 1;`,
    [appointmentId, tenantId]
  );
  return rows[0] || null;
}

async function listEncounters({ tenantId = 'org-default', state = null, patientId = null, limit = 50, p = null } = {}) {
  const params = [tenantId];
  let sql = `SELECT e.*, p.full_name AS patient_name, p.mrn
               FROM encounters e
               JOIN patients p ON p.id = e.patient_id
              WHERE e.tenant_id = $1`;
  if (state) {
    params.push(state);
    sql += ` AND e.state = $${params.length}`;
  }
  if (patientId) {
    params.push(patientId);
    sql += ` AND e.patient_id = $${params.length}`;
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  sql += ` ORDER BY e.updated_at DESC LIMIT $${params.length};`;
  const { rows } = await pool(p).query(sql, params);
  return rows;
}

async function listEncounterEvents({ tenantId = 'org-default', encounterId, p = null }) {
  const { rows } = await pool(p).query(
    `SELECT * FROM encounter_events WHERE encounter_id = $1 AND tenant_id = $2 ORDER BY sequence ASC;`,
    [encounterId, tenantId]
  );
  return rows;
}

async function updateFhirEncounterId({ tenantId = 'org-default', encounterId, fhirEncounterId, client = null, p = null }) {
  const q = client || pool(p);
  await q.query(`UPDATE encounters SET fhir_encounter_id = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3;`, [
    fhirEncounterId,
    encounterId,
    tenantId
  ]);
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

/**
 * Claims up to `limit` due messages with SKIP LOCKED so multiple workers can
 * drain the queue safely. Returns the claimed rows.
 */
async function claimDueOutbox({ limit = 10, p = null } = {}) {
  const { rows } = await pool(p).query(
    `UPDATE outbox o
        SET attempts = o.attempts + 1
      WHERE o.id IN (
        SELECT id FROM outbox
         WHERE status IN ('PENDING', 'FAILED')
           AND next_attempt_at <= NOW()
         ORDER BY next_attempt_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
      )
      RETURNING o.*;`,
    [Math.min(Math.max(Number(limit) || 10, 1), 100)]
  );
  return rows;
}

async function markOutboxDispatched({ outboxId, simulated, p = null }) {
  await pool(p).query(
    `UPDATE outbox
        SET status = 'DISPATCHED', dispatched_at = NOW(), simulated = $2, last_error = NULL
      WHERE id = $1;`,
    [outboxId, Boolean(simulated)]
  );
}

async function markOutboxFailed({ outboxId, error, maxAttempts = 5, baseDelayMs = 15000, p = null }) {
  // Exponential backoff: 15s, 30s, 60s, 120s, then dead.
  await pool(p).query(
    `UPDATE outbox
        SET status = CASE WHEN attempts >= $2 THEN 'DEAD' ELSE 'FAILED' END,
            last_error = $3,
            next_attempt_at = NOW() + (
              LEAST(power(2, GREATEST(attempts - 1, 0)) * ($4 / 1000.0), 3600) * INTERVAL '1 second'
            )
      WHERE id = $1;`,
    [outboxId, maxAttempts, String(error).slice(0, 2000), baseDelayMs]
  );
}

async function listOutbox({ tenantId = 'org-default', encounterId = null, status = null, p = null } = {}) {
  const params = [tenantId];
  let sql = `SELECT * FROM outbox WHERE tenant_id = $1`;
  if (encounterId) {
    params.push(encounterId);
    sql += ` AND encounter_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  sql += ` ORDER BY created_at DESC LIMIT 200;`;
  const { rows } = await pool(p).query(sql, params);
  return rows;
}

async function recordPatientMessage({ tenantId = 'org-default', patientId, encounterId = null, body, metadata = {} }, { client = null, p = null } = {}) {
  const q = client || pool(p);
  const { rows } = await q.query(
    `INSERT INTO patient_messages (id, tenant_id, patient_id, encounter_id, body, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *;`,
    [newId('msg'), tenantId, patientId, encounterId, body, JSON.stringify(metadata)]
  );
  return rows[0];
}

async function listPatientMessages({ tenantId = 'org-default', patientId, limit = 50, p = null }) {
  const { rows } = await pool(p).query(
    `SELECT * FROM patient_messages
      WHERE tenant_id = $1 AND patient_id = $2
      ORDER BY created_at DESC LIMIT $3;`,
    [tenantId, patientId, Math.min(Math.max(Number(limit) || 50, 1), 200)]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

async function getWorkflowIdempotentResponse({ tenantId = 'org-default', key, requestHash, p = null }) {
  if (!key) return null;
  const { rows } = await pool(p).query(
    `SELECT * FROM workflow_idempotency
      WHERE tenant_id = $1 AND key = $2 AND expires_at > NOW();`,
    [tenantId, key]
  );
  if (rows.length === 0) return null;

  if (rows[0].request_hash !== requestHash) {
    throw new WorkflowError(
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was already used with a different request payload.',
      422
    );
  }
  return rows[0];
}

async function putWorkflowIdempotentResponse({ tenantId = 'org-default', key, requestHash, status, body, ttlSeconds = 86400 }, { client = null, p = null } = {}) {
  if (!key) return;
  const q = client || pool(p);
  await q.query(
    `INSERT INTO workflow_idempotency (tenant_id, key, request_hash, response_status, response_body, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + ($6 * INTERVAL '1 second'))
     ON CONFLICT (tenant_id, key) DO NOTHING;`,
    [tenantId, key, requestHash, status, JSON.stringify(body), ttlSeconds]
  );
}

module.exports = {
  withTransaction,
  createPatient,
  getPatient,
  findPatientByMrn,
  listPatients,
  createAppointment,
  getAppointment,
  listAppointments,
  findAppointmentByIdempotencyKey,
  createEncounter,
  getEncounter,
  getEncounterByAppointment,
  listEncounters,
  listEncounterEvents,
  updateFhirEncounterId,
  claimDueOutbox,
  markOutboxDispatched,
  markOutboxFailed,
  listOutbox,
  recordPatientMessage,
  listPatientMessages,
  getWorkflowIdempotentResponse,
  putWorkflowIdempotentResponse
};
