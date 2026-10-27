/**
 * Live clinic loop.
 *
 * One source of truth: the Postgres tables the patient app writes through
 * `/api/patient/sync/*`. A clinician action here changes the same row the phone
 * pulls next, so "the doctor confirmed it" and "the phone shows confirmed" are
 * two reads of one fact — not a demo relay or a mirrored mock.
 *
 * Everything in this module is tenant-scoped. The route derives the tenant from
 * the verified clinician session; nothing in a request body may name one.
 */

const liveRepo = require('../../storage/postgres/clinicLiveRepository');
const { resolveWorkflowPersistence } = require('../workflow/runtime');

class LiveClinicError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'LiveClinicError';
    this.code = code;
    this.status = status;
  }
}

function requirePersistence() {
  if (resolveWorkflowPersistence() !== 'postgres') {
    throw new LiveClinicError(
      'CLINIC_LIVE_UNAVAILABLE',
      'The clinic loop needs the durable database. Set DATABASE_URL and restart the API.',
      503
    );
  }
}

function requireTenant(tenantId) {
  const clean = typeof tenantId === 'string' ? tenantId.trim() : '';
  if (!clean) {
    throw new LiveClinicError('TENANT_REQUIRED', 'The session carries no tenant claim.', 401);
  }
  return clean;
}

function parseInstant(value, field) {
  const clean = typeof value === 'string' ? value.trim() : '';
  const parsed = clean ? new Date(clean) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    throw new LiveClinicError('INVALID_INSTANT', `${field} must be a valid ISO instant.`);
  }
  return parsed;
}

/**
 * The window the clinician is looking at.
 *
 * `date` is a calendar day in the clinic's own timezone when provided; without
 * it the view is a rolling "now - 2h .. now + 26h", which never hides a late
 * arrival or an appointment first thing tomorrow.
 */
function resolveWindow({ date = null, from = null, to = null } = {}, now = new Date()) {
  if (from || to) {
    const start = parseInstant(from, 'from');
    const end = parseInstant(to, 'to');
    if (end <= start) {
      throw new LiveClinicError('INVALID_WINDOW', '`to` must be after `from`.');
    }
    return { from: start.toISOString(), to: end.toISOString() };
  }

  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const start = new Date(`${date.trim()}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) {
      throw new LiveClinicError('INVALID_WINDOW', '`date` must be YYYY-MM-DD.');
    }
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  return {
    from: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    to: new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString()
  };
}

const INBOUND_KINDS = new Set(['FOLLOW_UP_CHECK_IN', 'REFILL_REQUEST']);

// Lower sorts first. A patient asking to be seen must never sit below a refill
// request just because the refill arrived a minute later.
const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 };

function isInbound(message) {
  const meta = message.metadata || {};
  return meta.direction === 'INBOUND' || INBOUND_KINDS.has(meta.kind);
}

/**
 * Severity is a clinical judgement encoded conservatively:
 *  - "worse", "needs to be seen" or side effects at follow-up -> critical
 *  - any other check-in                                           -> warning
 *  - a refill request or free-text message                        -> info
 * The clinic decides what to do; this only sorts the queue.
 */
function attentionSeverity(message) {
  const meta = message.metadata || {};
  if (meta.kind === 'FOLLOW_UP_CHECK_IN') {
    const urgent = meta.recovery === 'WORSE' || meta.needsToBeSeen === true || meta.hasSideEffects === true;
    return urgent ? 'critical' : 'warning';
  }
  return 'info';
}

function attentionTitle(message) {
  const meta = message.metadata || {};
  if (meta.kind === 'FOLLOW_UP_CHECK_IN') return 'Follow-up check-in';
  if (meta.kind === 'REFILL_REQUEST') return 'Refill request';
  return 'Message from patient';
}

function toAppointmentView(appointment) {
  // The app already renders a CONFIRMED status from the sync contract, so the
  // projection distinguishes "BOOKED, awaiting reception" from "confirmed"
  // without changing the appointment row's own status vocabulary.
  const status = appointment.status === 'BOOKED' && appointment.confirmedAt
    ? 'CONFIRMED'
    : appointment.status;

  return {
    ...appointment,
    status,
    needsAttention: appointment.openMessageCount > 0
  };
}

function toAttentionItem(message) {
  return {
    id: message.id,
    patientId: message.patientId,
    patientName: message.patientName,
    kind: message.kind,
    title: attentionTitle(message),
    body: message.body,
    severity: attentionSeverity(message),
    requiresTriage: message.requiresTriage,
    appointmentId: message.appointmentId,
    createdAt: message.createdAt
  };
}

/**
 * Critical first, then newest. The repository returns newest-first, so this
 * only re-orders within severity and never hides anything.
 */
function sortAttention(items) {
  return items
    .slice()
    .sort((a, b) => {
      const rank = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
      if (rank !== 0) return rank;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

function toThread(messages) {
  const latest = messages[0];
  const inbound = messages.filter(isInbound);
  return {
    patientId: latest.patientId,
    patientName: latest.patientName,
    lastName: latest.patientName,
    lastMessageAt: latest.createdAt,
    lastMessage: latest.body,
    openCount: inbound.filter((m) => !m.resolvedAt).length,
    messageCount: messages.length
  };
}

async function getOverview({ tenantId, date, from, to, now = new Date() } = {}) {
  requirePersistence();
  const scopedTenant = requireTenant(tenantId);
  const window = resolveWindow({ date, from, to }, now);

  const [appointments, recentMessages] = await Promise.all([
    liveRepo.listAppointmentsInWindow({
      tenantId: scopedTenant,
      from: window.from,
      to: window.to
    }),
    liveRepo.listMessages({ tenantId: scopedTenant, limit: 200 })
  ]);

  const openMessages = recentMessages.filter((m) => isInbound(m) && !m.resolvedAt);
  const threadsByPatient = new Map();
  for (const message of recentMessages) {
    if (!threadsByPatient.has(message.patientId)) threadsByPatient.set(message.patientId, []);
    threadsByPatient.get(message.patientId).push(message);
  }

  const appointmentViews = appointments.map(toAppointmentView);
  const active = appointmentViews.filter((a) => a.status !== 'CANCELLED');

  return {
    generatedAt: now.toISOString(),
    persistence: 'postgres',
    window,
    metrics: {
      scheduled: active.length,
      confirmed: active.filter((a) => a.status === 'CONFIRMED').length,
      unconfirmed: active.filter((a) => a.status === 'BOOKED').length,
      cancelled: appointmentViews.length - active.length,
      needsAttention: openMessages.length,
      patients: new Set(active.map((a) => a.patientId)).size
    },
    appointments: appointmentViews,
    attention: sortAttention(openMessages.map(toAttentionItem)),
    threads: [...threadsByPatient.values()].map(toThread)
  };
}

async function listAppointments({ tenantId, date, from, to, now = new Date() } = {}) {
  requirePersistence();
  const scopedTenant = requireTenant(tenantId);
  const window = resolveWindow({ date, from, to }, now);
  const rows = await liveRepo.listAppointmentsInWindow({
    tenantId: scopedTenant,
    from: window.from,
    to: window.to
  });
  return { window, appointments: rows.map(toAppointmentView) };
}

async function getThread({ tenantId, patientId, limit = 100 } = {}) {
  requirePersistence();
  const scopedTenant = requireTenant(tenantId);
  const cleanPatientId = typeof patientId === 'string' ? patientId.trim() : '';
  if (!cleanPatientId) {
    throw new LiveClinicError('PATIENT_REQUIRED', 'A patient id is required.');
  }

  const rows = await liveRepo.listMessages({
    tenantId: scopedTenant,
    patientId: cleanPatientId,
    limit
  });

  if (rows.length === 0) {
    throw new LiveClinicError('THREAD_NOT_FOUND', 'No conversation with that patient yet.', 404);
  }

  return {
    patientId: cleanPatientId,
    patientName: rows[0].patientName,
    openCount: rows.filter((m) => isInbound(m) && !m.resolvedAt).length,
    messages: rows
      .slice()
      .reverse()
      .map((message) => ({
        ...message,
        direction: isInbound(message) ? 'INBOUND' : 'CLINIC'
      }))
  };
}

async function loadAppointmentOrThrow({ tenantId, appointmentId }) {
  const cleanId = typeof appointmentId === 'string' ? appointmentId.trim() : '';
  if (!cleanId) {
    throw new LiveClinicError('APPOINTMENT_REQUIRED', 'An appointment id is required.');
  }
  const appointment = await liveRepo.getAppointment({ tenantId, appointmentId: cleanId });
  if (!appointment) {
    throw new LiveClinicError('APPOINTMENT_NOT_FOUND', 'That appointment is not in this clinic.', 404);
  }
  return appointment;
}

async function confirmAppointment({ tenantId, appointmentId } = {}) {
  requirePersistence();
  const scopedTenant = requireTenant(tenantId);
  const appointment = await loadAppointmentOrThrow({ tenantId: scopedTenant, appointmentId });

  if (appointment.status !== 'BOOKED') {
    throw new LiveClinicError(
      'APPOINTMENT_NOT_CONFIRMABLE',
      appointment.status === 'CANCELLED'
        ? 'That appointment was cancelled.'
        : 'That appointment is no longer awaiting confirmation.',
      409
    );
  }

  await liveRepo.confirmAppointment({ tenantId: scopedTenant, appointmentId: appointment.id });
  const fresh = await liveRepo.getAppointment({ tenantId: scopedTenant, appointmentId: appointment.id });
  return toAppointmentView(fresh);
}

async function rescheduleAppointment({ tenantId, appointmentId, scheduledFor } = {}) {
  requirePersistence();
  const scopedTenant = requireTenant(tenantId);
  const appointment = await loadAppointmentOrThrow({ tenantId: scopedTenant, appointmentId });

  if (appointment.status === 'CANCELLED') {
    throw new LiveClinicError('APPOINTMENT_NOT_RESCHEDULABLE', 'A cancelled appointment cannot be moved.', 409);
  }

  const when = parseInstant(scheduledFor, 'scheduledFor');
  await liveRepo.rescheduleAppointment({
    tenantId: scopedTenant,
    appointmentId: appointment.id,
    scheduledFor: when.toISOString()
  });
  const fresh = await liveRepo.getAppointment({ tenantId: scopedTenant, appointmentId: appointment.id });
  return toAppointmentView(fresh);
}

async function cancelAppointment({ tenantId, appointmentId } = {}) {
  requirePersistence();
  const scopedTenant = requireTenant(tenantId);
  const appointment = await loadAppointmentOrThrow({ tenantId: scopedTenant, appointmentId });

  if (appointment.status === 'CANCELLED') {
    return toAppointmentView(appointment);
  }

  await liveRepo.cancelAppointment({ tenantId: scopedTenant, appointmentId: appointment.id });
  const fresh = await liveRepo.getAppointment({ tenantId: scopedTenant, appointmentId: appointment.id });
  return toAppointmentView(fresh);
}

async function replyToPatient({ tenantId, patientId, body, actor = {} } = {}) {
  requirePersistence();
  const scopedTenant = requireTenant(tenantId);
  const cleanPatientId = typeof patientId === 'string' ? patientId.trim() : '';
  const text = typeof body === 'string' ? body.trim() : '';

  if (!cleanPatientId) {
    throw new LiveClinicError('PATIENT_REQUIRED', 'A patient id is required.');
  }
  if (!text) {
    throw new LiveClinicError('MESSAGE_REQUIRED', 'Write a message before sending.');
  }
  if (text.length > 4000) {
    throw new LiveClinicError('MESSAGE_TOO_LONG', 'Keep the reply under 4,000 characters.');
  }

  const exists = await liveRepo.patientExists({ tenantId: scopedTenant, patientId: cleanPatientId });
  if (!exists) {
    throw new LiveClinicError('PATIENT_NOT_FOUND', 'That patient is not in this clinic.', 404);
  }

  return liveRepo.insertClinicMessage({
    tenantId: scopedTenant,
    patientId: cleanPatientId,
    body: text,
    actorId: actor.actorId || null,
    actorName: actor.actorName || 'Your clinic'
  });
}

/**
 * Closing a thread resolves every open inbound message in it. The patient's app
 * keeps the history; the clinic's queue stops showing it.
 */
async function resolveMessages({ tenantId, patientId = null, messageId = null } = {}) {
  requirePersistence();
  const scopedTenant = requireTenant(tenantId);
  if (!patientId && !messageId) {
    throw new LiveClinicError('TARGET_REQUIRED', 'A patient id or message id is required.');
  }

  const resolved = await liveRepo.resolveMessages({
    tenantId: scopedTenant,
    patientId: typeof patientId === 'string' && patientId.trim() ? patientId.trim() : null,
    messageId: typeof messageId === 'string' && messageId.trim() ? messageId.trim() : null
  });

  return { resolved };
}

module.exports = {
  LiveClinicError,
  resolveWindow,
  getOverview,
  listAppointments,
  getThread,
  confirmAppointment,
  rescheduleAppointment,
  cancelAppointment,
  replyToPatient,
  resolveMessages
};
