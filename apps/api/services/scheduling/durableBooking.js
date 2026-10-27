/**
 * Durable appointment booking.
 *
 * The public patient-facing booking route used to return a fabricated
 * `apt-${Date.now()}` and a string like "Tomorrow 10:00 AM". Nothing was
 * persisted, so the encounter never existed and the clinician's schedule could
 * not show the patient. This service is the single real booking path:
 *
 *   patient (existing or self-registered) -> appointment row -> encounter BOOKED
 *
 * Invariants:
 *   - No invented times. A caller must supply an explicit, valid, future instant.
 *   - No invented patients. If the patient is unknown, the caller must supply a
 *     name; otherwise the booking is rejected.
 *   - Idempotent. Repeated submissions with the same key return the original
 *     appointment instead of double-booking.
 *   - The encounter is created in the same transaction as the appointment, so a
 *     booked appointment can never exist without a workflow state.
 */

const crypto = require('crypto');
const repo = require('../../storage/postgres/workflowRepository');
const { resolveWorkflowPersistence } = require('../workflow/runtime');

const DEFAULT_CLINICIAN_ID = 'usr-md-lin-01';

class BookingError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'BookingError';
    this.code = code;
    this.status = status;
  }
}

function cleanString(value, max = 500) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

/**
 * Accepts either an ISO instant (`scheduledFor`) or a date + local time pair.
 * Returns an ISO string or throws. Never returns a guessed time.
 */
function parseScheduledFor(input = {}, now = new Date()) {
  const direct = cleanString(input.scheduledFor, 64);
  let parsed;

  if (direct) {
    parsed = new Date(direct);
  } else {
    const date = cleanString(input.date, 32);
    const time = cleanString(input.time, 32);
    if (!date || !time) {
      throw new BookingError(
        'SCHEDULED_FOR_REQUIRED',
        'An explicit scheduledFor instant, or date + time, is required. Proton does not guess appointment times.'
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      throw new BookingError('INVALID_SCHEDULED_FOR', 'date must be YYYY-MM-DD and time must be HH:mm.');
    }
    parsed = new Date(`${date}T${time}:00`);
  }

  if (Number.isNaN(parsed.getTime())) {
    throw new BookingError('INVALID_SCHEDULED_FOR', 'The requested appointment time is not a valid date.');
  }

  // Two minutes of clock skew tolerance for clients that round to the second.
  if (parsed.getTime() < now.getTime() - 2 * 60 * 1000) {
    throw new BookingError('SCHEDULED_FOR_IN_PAST', 'The requested appointment time is in the past.');
  }

  return parsed.toISOString();
}

function deriveIdempotencyKey(input = {}) {
  const explicit = cleanString(input.idempotencyKey, 200);
  if (explicit) return explicit;

  // A stable fingerprint of the booking intent. The same submission retried
  // after a dropped response maps to the same key and cannot double-book.
  const fingerprint = JSON.stringify({
    patientId: cleanString(input.patientId, 128),
    clinicianId: cleanString(input.clinicianId, 128),
    scheduledFor: input.scheduledFor || null,
    date: input.date || null,
    time: input.time || null,
    reason: cleanString(input.reason, 500)
  });
  return `auto-${crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 32)}`;
}

function validateDuration(value) {
  if (value === undefined || value === null || value === '') return 20;
  const duration = Number(value);
  if (!Number.isInteger(duration) || duration <= 0 || duration > 480) {
    throw new BookingError('INVALID_DURATION', 'durationMinutes must be an integer between 1 and 480.');
  }
  return duration;
}

function patientInputForCreation(patientId, input) {
  const details = input.patient || {};
  const fullName = cleanString(details.fullName || input.patientName, 200);
  if (!fullName) {
    throw new BookingError(
      'PATIENT_NOT_FOUND',
      `No patient record exists for '${patientId}'. Supply patient.fullName to register them, or book against an existing patient.`,
      404
    );
  }

  return {
    id: patientId,
    tenantId: input.tenantId || 'org-default',
    fullName,
    mrn: cleanString(details.mrn, 64),
    dateOfBirth: cleanString(details.dateOfBirth, 32),
    sex: cleanString(details.sex, 32),
    contact: details.contact && typeof details.contact === 'object' ? details.contact : {},
    fhirPatientId: cleanString(details.fhirPatientId, 128)
  };
}

async function loadExisting(key, tenantId) {
  if (!key) return null;
  const appointment = await repo.findAppointmentByIdempotencyKey({ tenantId, idempotencyKey: key });
  if (!appointment) return null;
  const [encounter, patient] = await Promise.all([
    repo.getEncounterByAppointment({ tenantId, appointmentId: appointment.id }),
    repo.getPatient({ tenantId, patientId: appointment.patient_id })
  ]);
  return { appointment, encounter, patient, idempotent: true, createdPatient: false };
}

/**
 * Books an appointment and opens its encounter.
 *
 * @param {object} input
 * @param {string} input.patientId
 * @param {string} [input.clinicianId]
 * @param {string} [input.scheduledFor] ISO instant
 * @param {string} [input.date] YYYY-MM-DD (used with `time`)
 * @param {string} [input.time] HH:mm
 * @param {string} [input.reason]
 * @param {number} [input.durationMinutes]
 * @param {object} [input.patient] { fullName, mrn, dateOfBirth, sex, contact }
 * @param {string} [input.idempotencyKey]
 */
async function bookAppointment(input = {}) {
  if (resolveWorkflowPersistence() !== 'postgres') {
    throw new BookingError(
      'DURABLE_BOOKING_UNAVAILABLE',
      'Durable booking is unavailable because the workflow database is not configured. No appointment was created.',
      503
    );
  }

  const tenantId = cleanString(input.tenantId, 128) || 'org-default';
  const patientId = cleanString(input.patientId, 128);
  if (!patientId) {
    throw new BookingError('PATIENT_ID_REQUIRED', 'patientId is required.');
  }

  const clinicianId = cleanString(input.clinicianId, 128) || DEFAULT_CLINICIAN_ID;
  const scheduledFor = parseScheduledFor(input);
  const durationMinutes = validateDuration(input.durationMinutes);
  const reason = cleanString(input.reason, 500);
  const idempotencyKey = deriveIdempotencyKey({ ...input, patientId, clinicianId });

  const existing = await loadExisting(idempotencyKey, tenantId);
  if (existing) return existing;

  try {
    return await repo.withTransaction(async (client) => {
      let patient = await repo.getPatient({ tenantId, patientId, client });
      let createdPatient = false;

      if (!patient) {
        patient = await repo.createPatient(
          patientInputForCreation(patientId, { ...input, tenantId }),
          { client }
        );
        createdPatient = true;
      }

      const appointment = await repo.createAppointment(
        {
          // A caller that already has an id (the offline-first app) supplies it,
          // so the appointment it created on the device and the server row share
          // one identity.
          id: input.appointmentId || undefined,
          tenantId,
          patientId,
          clinicianId,
          scheduledFor,
          durationMinutes,
          reason,
          idempotencyKey,
          patientLocalId: input.patientLocalId || null
        },
        { client }
      );

      const encounter = await repo.createEncounter(
        {
          tenantId,
          patientId,
          appointmentId: appointment.id,
          clinicianId,
          actor: {
            actorId: input.actorId || clinicianId,
            actorRole: input.actorRole || 'physician',
            actorName: input.actorName || null
          },
          reason: reason || 'appointment booked',
          metadata: {
            source: input.source || 'appointment-booking',
            idempotencyKey
          }
        },
        { client }
      );

      return { appointment, encounter, patient, idempotent: false, createdPatient };
    });
  } catch (err) {
    // Lost the idempotency race between the pre-check and the insert.
    if (err && err.code === '23505') {
      const raced = await loadExisting(idempotencyKey, tenantId);
      if (raced) return raced;
    }
    throw err;
  }
}

module.exports = {
  bookAppointment,
  parseScheduledFor,
  deriveIdempotencyKey,
  BookingError,
  DEFAULT_CLINICIAN_ID
};
