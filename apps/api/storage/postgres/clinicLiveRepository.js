/**
 * Clinic live-loop repository (PostgreSQL).
 *
 * This is the clinic half of the same database the patient app writes to. It is
 * deliberately read-model oriented: the clinician screen polls a small, shaped
 * projection every few seconds, so the queries here are bounded and indexed
 * rather than "load everything and filter in memory".
 *
 * Every query takes an explicit `tenantId`. There is no default tenant and no
 * cross-tenant read: a clinician session is scoped by the route before it gets
 * here, and the SQL repeats the predicate so a service bug cannot widen scope.
 */

const { getPostgresPool } = require('../postgresDb');
const repo = require('./workflowRepository');

/**
 * A message is "needs attention" when the patient wrote it and no clinician has
 * resolved it yet. Clinic replies are not inbound, so replying does not create a
 * new item on the doctor's own queue.
 *
 * Kept as one expression so the appointment projection and the thread query
 * cannot drift apart.
 */
const INBOUND_PREDICATE = `
  (
    m.metadata->>'direction' = 'INBOUND'
    OR m.metadata->>'kind' IN ('FOLLOW_UP_CHECK_IN', 'REFILL_REQUEST')
  )
`;

function pool() {
  return getPostgresPool();
}

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function mapAppointmentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    patientId: row.patient_id,
    patientName: row.patient_name || row.account_name || 'Patient',
    dateOfBirth: row.date_of_birth || null,
    sex: row.sex || null,
    clinicianId: row.clinician_id,
    patientLocalId: row.patient_local_id || null,
    scheduledFor: iso(row.scheduled_for),
    durationMinutes: row.duration_minutes,
    status: row.status,
    confirmedAt: iso(row.confirmed_at),
    reason: row.reason || null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    openMessageCount: Number(row.open_message_count || 0)
  };
}

/**
 * Appointments that overlap a window, newest confirmation state included.
 *
 * The window is half-open (`[from, to)`) so a 24-hour view cannot show the same
 * 09:00 appointment twice when the caller advances the date.
 */
async function listAppointmentsInWindow({ tenantId, from, to, includeCancelled = true }) {
  const params = [tenantId, from, to];
  const { rows } = await pool().query(
    `SELECT a.*,
            p.full_name AS patient_name,
            p.date_of_birth,
            p.sex,
            pa.display_name AS account_name,
            (
              SELECT COUNT(*)::int
                FROM patient_messages m
               WHERE m.tenant_id = a.tenant_id
                 AND m.patient_id = a.patient_id
                 AND m.resolved_at IS NULL
                 AND ${INBOUND_PREDICATE}
            ) AS open_message_count
       FROM appointments a
       LEFT JOIN patients p
              ON p.id = a.patient_id AND p.tenant_id = a.tenant_id
       LEFT JOIN patient_accounts pa
              ON pa.id = a.patient_id AND pa.tenant_id = a.tenant_id
      WHERE a.tenant_id = $1
        AND a.scheduled_for >= $2
        AND a.scheduled_for < $3
        ${includeCancelled ? '' : "AND a.status <> 'CANCELLED'"}
      ORDER BY a.scheduled_for ASC, a.id ASC
      LIMIT 500;`,
    params
  );
  return rows.map(mapAppointmentRow);
}

async function getAppointment({ tenantId, appointmentId }) {
  const { rows } = await pool().query(
    `SELECT a.*,
            p.full_name AS patient_name,
            p.date_of_birth,
            p.sex,
            pa.display_name AS account_name,
            0 AS open_message_count
       FROM appointments a
       LEFT JOIN patients p
              ON p.id = a.patient_id AND p.tenant_id = a.tenant_id
       LEFT JOIN patient_accounts pa
              ON pa.id = a.patient_id AND pa.tenant_id = a.tenant_id
      WHERE a.tenant_id = $1 AND a.id = $2;`,
    [tenantId, appointmentId]
  );
  return mapAppointmentRow(rows[0]);
}

/**
 * Marks an appointment confirmed. Idempotent: a second click keeps the first
 * confirmation time instead of moving it, and a cancelled visit is not revived.
 */
async function confirmAppointment({ tenantId, appointmentId }) {
  const { rows } = await pool().query(
    `UPDATE appointments
        SET confirmed_at = COALESCE(confirmed_at, NOW()),
            updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'BOOKED'
      RETURNING id;`,
    [tenantId, appointmentId]
  );
  return rows.length > 0;
}

/**
 * Moves an appointment and clears the confirmation, because a patient who was
 * confirmed for 09:00 has not confirmed 14:30.
 */
async function rescheduleAppointment({ tenantId, appointmentId, scheduledFor }) {
  const { rows } = await pool().query(
    `UPDATE appointments
        SET scheduled_for = $3,
            status = 'BOOKED',
            confirmed_at = NULL,
            updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status <> 'CANCELLED'
      RETURNING id;`,
    [tenantId, appointmentId, scheduledFor]
  );
  return rows.length > 0;
}

async function cancelAppointment({ tenantId, appointmentId }) {
  const { rows } = await pool().query(
    `UPDATE appointments
        SET status = 'CANCELLED',
            confirmed_at = NULL,
            updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status <> 'CANCELLED'
      RETURNING id;`,
    [tenantId, appointmentId]
  );
  return rows.length > 0;
}

function mapMessageRow(row) {
  if (!row) return null;
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name || row.account_name || 'Patient',
    encounterId: row.encounter_id || null,
    body: row.body,
    metadata,
    kind: metadata.kind || 'MESSAGE',
    authorName: metadata.authorName || null,
    appointmentId: metadata.appointmentId || null,
    requiresTriage: Boolean(metadata.requiresTriage),
    readAt: iso(row.read_at),
    resolvedAt: iso(row.resolved_at),
    createdAt: iso(row.created_at)
  };
}

/**
 * Recent messages for one patient, or for the whole tenant when `patientId` is
 * omitted. `before` pages backwards through history for a long-running thread.
 */
async function listMessages({ tenantId, patientId = null, limit = 100, before = null }) {
  const params = [tenantId];
  let sql = `SELECT m.*,
                    p.full_name AS patient_name,
                    pa.display_name AS account_name
               FROM patient_messages m
               LEFT JOIN patients p
                      ON p.id = m.patient_id AND p.tenant_id = m.tenant_id
               LEFT JOIN patient_accounts pa
                      ON pa.id = m.patient_id AND pa.tenant_id = m.tenant_id
              WHERE m.tenant_id = $1`;

  if (patientId) {
    params.push(patientId);
    sql += ` AND m.patient_id = $${params.length}`;
  }
  if (before) {
    params.push(before);
    sql += ` AND m.created_at < $${params.length}`;
  }

  params.push(Math.min(Math.max(Number(limit) || 100, 1), 500));
  sql += ` ORDER BY m.created_at DESC LIMIT $${params.length};`;

  const { rows } = await pool().query(sql, params);
  return rows.map(mapMessageRow);
}

/**
 * Writes a clinician reply. It lands in the same `patient_messages` table the
 * patient app pulls, which is what makes the loop real: there is no second copy
 * and no relay.
 */
async function insertClinicMessage({
  tenantId,
  patientId,
  body,
  actorId,
  actorName,
  appointmentId = null,
  encounterId = null,
  kind = 'CLINIC_REPLY'
}) {
  const row = await repo.recordPatientMessage({
    tenantId,
    patientId,
    encounterId,
    body,
    metadata: {
      direction: 'CLINIC',
      kind,
      authorActorId: actorId,
      authorName: actorName,
      appointmentId
    }
  });
  return mapMessageRow(row);
}

/**
 * Resolves every open inbound message in a thread (the "Done" action on a
 * conversation) or a single item (the row-level action).
 */
async function resolveMessages({ tenantId, patientId = null, messageId = null }) {
  const params = [tenantId];
  let sql = `UPDATE patient_messages m
                SET resolved_at = NOW()
              WHERE m.tenant_id = $1
                AND m.resolved_at IS NULL
                AND ${INBOUND_PREDICATE}`;

  if (patientId) {
    params.push(patientId);
    sql += ` AND m.patient_id = $${params.length}`;
  }
  if (messageId) {
    params.push(messageId);
    sql += ` AND m.id = $${params.length}`;
  }
  if (!patientId && !messageId) {
    const err = new Error('A patient or message id is required to resolve messages.');
    err.code = 'VALIDATION_ERROR';
    err.status = 400;
    throw err;
  }

  const { rowCount } = await pool().query(sql, params);
  return rowCount;
}

/** True when the patient exists in this tenant as a clinical or account record. */
async function patientExists({ tenantId, patientId }) {
  const { rows } = await pool().query(
    `SELECT 1 FROM patients
      WHERE tenant_id = $1 AND id = $2
      UNION ALL
     SELECT 1 FROM patient_accounts
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1;`,
    [tenantId, patientId]
  );
  return rows.length > 0;
}

module.exports = {
  listAppointmentsInWindow,
  getAppointment,
  confirmAppointment,
  rescheduleAppointment,
  cancelAppointment,
  listMessages,
  insertClinicMessage,
  resolveMessages,
  patientExists
};
