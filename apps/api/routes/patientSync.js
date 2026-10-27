/**
 * Patient ↔ clinic sync surface.
 *
 * This is the route family that makes the Android app's opt-in sync layer real.
 * Every endpoint here:
 *   - requires a verified patient session (`requirePatientAuth`),
 *   - derives patientId and tenantId from that session, never from the body,
 *   - is idempotent on the `Idempotency-Key` header, because the client's outbox
 *     retries any request whose response it did not see,
 *   - returns 503 when the backing service is unavailable rather than a
 *     fabricated success.
 *
 * The client contract lives in
 * `apps/dork-android/.../core/sync/SyncApiContract.kt`. If a path here changes,
 * that file changes with it.
 */

const express = require('express');
const crypto = require('crypto');
const { requirePatientAuth } = require('../middleware/patientAuth');
const { bookAppointment, BookingError } = require('../services/scheduling/durableBooking');
const repo = require('../storage/postgres/workflowRepository');
const { resolveWorkflowPersistence } = require('../services/workflow/runtime');
const patientAccountStore = require('../services/patients/patientAccountStore');

const router = express.Router();

const IDEMPOTENCY_HEADER = 'idempotency-key';
const SUPPORTED_KINDS = ['bookings', 'intakes', 'follow-ups', 'refills', 'cancellations', 'reschedules'];

function requestHash(body) {
  return crypto.createHash('sha256').update(JSON.stringify(body || {})).digest('hex');
}

/**
 * Runs `work` at most once per (tenant, key).
 *
 * A replay returns the stored response verbatim, so the client's outbox sees the
 * same success it would have seen if the first response had arrived. A reused
 * key with a different payload is rejected by the repository (422).
 */
async function withIdempotency(req, work) {
  const key = req.headers[IDEMPOTENCY_HEADER];
  if (!key) return work();
  if (resolveWorkflowPersistence() !== 'postgres') return work();

  const tenantId = req.patient.tenantId;
  const hash = requestHash(req.body);

  const existing = await repo.getWorkflowIdempotentResponse({ tenantId, key, requestHash: hash });
  if (existing) {
    return { ...existing.response_body, idempotent: true };
  }

  const result = await work();
  await repo.putWorkflowIdempotentResponse({
    tenantId,
    key,
    requestHash: hash,
    status: 201,
    body: result
  });
  return result;
}

function sendError(res, err) {
  if (err instanceof BookingError) {
    return res.status(err.status || 400).json({ error: err.message, code: err.code });
  }
  const status = err.status || 500;
  if (status >= 500) {
    // Never echo a raw database/provider error to a patient device.
    console.error('[patient-sync] failed:', err.message);
  }
  return res.status(status).json({
    error: status >= 500 ? 'The clinic server could not store this item.' : err.message,
    code: err.code || 'SYNC_FAILED'
  });
}

function requirePostgres(res) {
  if (resolveWorkflowPersistence() !== 'postgres') {
    res.status(503).json({
      error: 'The clinic server is not accepting writes right now. Your item is still queued on this device.',
      code: 'SYNC_UNAVAILABLE'
    });
    return false;
  }
  return true;
}

/** Trimmed, length-capped free text. Returns '' for anything non-string. */
function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

const PATIENT_AUTHORED_KINDS = new Set(['FOLLOW_UP_CHECK_IN', 'REFILL_REQUEST']);

/**
 * True for a message the patient wrote. These are what the clinic triages; they
 * are not part of the clinic's outbound inbox, so `/pull` must not echo them
 * back as if a doctor had sent them.
 *
 * The kind check keeps rows written before `direction` existed classified
 * correctly instead of leaking old check-ins into the inbox.
 */
function isPatientAuthored(metadata) {
  const meta = metadata && typeof metadata === 'object' ? metadata : {};
  return meta.direction === 'INBOUND' || PATIENT_AUTHORED_KINDS.has(meta.kind);
}

/** Accepts only a known enum member, so a client typo cannot become a state. */
function cleanEnum(value, allowed) {
  const upper = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return allowed.includes(upper) ? upper : 'UNKNOWN';
}

/** Pain/severity is an integer 0-10 or it is not recorded at all. */
function cleanSeverity(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : undefined;
}

const ONSET_LABELS = {
  TODAY: 'Today',
  FEW_DAYS: 'A few days',
  WEEK: 'About a week',
  WEEKS: 'A few weeks',
  MONTH_PLUS: 'A month or more'
};

const PATTERN_LABELS = {
  CONSTANT: 'Constant',
  COMES_AND_GOES: 'Comes and goes',
  GETTING_WORSE: 'Getting worse',
  GETTING_BETTER: 'Getting better'
};

/**
 * Maps an app enum name to the words a clinician reads. An unknown value is
 * passed through as text rather than dropped, so a newer app version never
 * silently loses an answer.
 */
function labelFor(value, labels) {
  const raw = cleanText(value, 128);
  if (!raw) return undefined;
  return labels[raw.toUpperCase()] || raw;
}

/**
 * Resolves the encounter a message belongs to, when one exists for the
 * appointment. Never throws: an inbox message is still useful without a link.
 */
async function encounterIdFor(tenantId, appointmentId) {
  if (!appointmentId) return null;
  try {
    const encounter = await repo.getEncounterByAppointment({ tenantId, appointmentId });
    return encounter?.id || null;
  } catch (_) {
    return null;
  }
}

/**
 * The server id for an appointment the app created offline.
 *
 * The app books on the device first, so its id is the only id it has. Deriving
 * the server id deterministically from (tenant, patient, local id) means a
 * retry maps to the same row, two patients can both have a local `apt-1`
 * without colliding, and no patient can claim another patient's id.
 */
function deriveSyncAppointmentId(tenantId, patientId, localId) {
  return (
    'apt-sync-' +
    crypto
      .createHash('sha256')
      .update(`${tenantId}\u0000${patientId}\u0000${localId}`)
      .digest('hex')
      .slice(0, 32)
  );
}

/**
 * Finds an appointment the caller is allowed to act on.
 *
 * Tries the derived sync id first, then the id as given — the latter covers an
 * appointment reception created and the app received through pull. Returns null
 * when neither exists; throws 403 when the id belongs to someone else.
 */
async function resolveOwnedAppointment({ tenantId, patientId, clientAppointmentId }) {
  const localId = cleanText(clientAppointmentId, 128);
  if (!localId) return null;

  const derived = deriveSyncAppointmentId(tenantId, patientId, localId);
  const candidates = localId === derived ? [derived] : [derived, localId];

  for (const id of candidates) {
    const appointment = await repo.getAppointment({ tenantId, appointmentId: id });
    if (!appointment) continue;
    if (appointment.patient_id !== patientId) {
      const e = new Error('That appointment is not on your record.');
      e.status = 403;
      e.code = 'APPOINTMENT_SCOPE_VIOLATION';
      throw e;
    }
    return appointment;
  }

  return null;
}

function notFoundAppointment() {
  const e = new Error('That appointment is not on your record.');
  e.status = 404;
  e.code = 'APPOINTMENT_NOT_FOUND';
  return e;
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

router.post('/bookings', requirePatientAuth, async (req, res) => {
  if (!requirePostgres(res)) return;
  const body = req.body || {};

  try {
    const account = await patientAccountStore
      .getPatientAccount({ tenantId: req.patient.tenantId, patientId: req.patient.id })
      .catch(() => null);

    const result = await withIdempotency(req, async () => {
      const localId = cleanText(body.appointmentId, 128);
      const derivedId = localId
        ? deriveSyncAppointmentId(req.patient.tenantId, req.patient.id, localId)
        : null;

      // Same local booking, different Idempotency-Key (for example the app was
      // reinstalled and re-sent). The row already exists, so return it instead
      // of failing the insert or creating a second appointment.
      if (derivedId) {
        const existing = await repo.getAppointment({
          tenantId: req.patient.tenantId,
          appointmentId: derivedId
        });
        if (existing) {
          if (existing.patient_id !== req.patient.id) {
            const e = new Error('That appointment is not on your record.');
            e.status = 403;
            e.code = 'APPOINTMENT_SCOPE_VIOLATION';
            throw e;
          }
          return {
            success: true,
            appointmentId: existing.id,
            localAppointmentId: localId,
            encounterId: null,
            status: existing.status,
            scheduledFor: existing.scheduled_for,
            durationMinutes: existing.duration_minutes,
            idempotent: true
          };
        }
      }

      const booking = await bookAppointment({
        tenantId: req.patient.tenantId,
        patientId: req.patient.id,
        // Stable server id so later cancel/reschedule/intake requests can find
        // the row using the id the app already has.
        appointmentId: derivedId || undefined,
        patientLocalId: localId || null,
        clinicianId: body.doctorId,
        scheduledFor: body.startIso,
        durationMinutes: 20,
        reason: body.reasonForVisit,
        // Only used if the clinical record does not exist yet. The clinic can
        // complete the demographics at check-in.
        patientName: account?.display_name || account?.displayName || 'Patient',
        idempotencyKey: req.headers[IDEMPOTENCY_HEADER] || `sync-booking-${body.appointmentId}`,
        source: 'patient-app-sync'
      });

      return {
        success: true,
        appointmentId: booking.appointment.id,
        localAppointmentId: localId || null,
        encounterId: booking.encounter?.id || null,
        status: booking.appointment.status,
        scheduledFor: booking.appointment.scheduled_for,
        durationMinutes: booking.appointment.duration_minutes,
        idempotent: Boolean(booking.idempotent)
      };
    });

    return res.status(result.idempotent ? 200 : 201).json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Cancellations and reschedules
// ---------------------------------------------------------------------------

router.post('/cancellations', requirePatientAuth, async (req, res) => {
  if (!requirePostgres(res)) return;
  const body = req.body || {};

  try {
    const result = await withIdempotency(req, async () => {
      const appointment = await resolveOwnedAppointment({
        tenantId: req.patient.tenantId,
        patientId: req.patient.id,
        clientAppointmentId: body.appointmentId
      });
      if (!appointment) throw notFoundAppointment();

      const updated = await repo.updateAppointment({
        tenantId: req.patient.tenantId,
        appointmentId: appointment.id,
        status: 'CANCELLED'
      });

      return { success: true, appointmentId: updated.id, status: updated.status };
    });

    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/reschedules', requirePatientAuth, async (req, res) => {
  if (!requirePostgres(res)) return;
  const body = req.body || {};

  try {
    const result = await withIdempotency(req, async () => {
      const appointment = await resolveOwnedAppointment({
        tenantId: req.patient.tenantId,
        patientId: req.patient.id,
        clientAppointmentId: body.appointmentId
      });
      if (!appointment) throw notFoundAppointment();

      const when = new Date(body.newStartIso);
      if (Number.isNaN(when.getTime())) {
        const e = new Error('The new appointment time is not a valid date.');
        e.status = 400;
        e.code = 'INVALID_SCHEDULED_FOR';
        throw e;
      }

      const updated = await repo.updateAppointment({
        tenantId: req.patient.tenantId,
        appointmentId: appointment.id,
        scheduledFor: when.toISOString(),
        status: 'BOOKED'
      });

      return { success: true, appointmentId: updated.id, scheduledFor: updated.scheduled_for };
    });

    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

router.post('/intakes', requirePatientAuth, async (req, res) => {
  const body = req.body || {};

  try {
    // Lazy require: the intake service pulls in the questionnaire catalog, which
    // is heavy and unused by the other sync routes.
    const intakeService = require('../services/intake').intakeService;

    const answers = {
      reason_for_visit: cleanText(body.mainConcern, 2000),
      duration: labelFor(body.onset, ONSET_LABELS),
      pattern: labelFor(body.pattern, PATTERN_LABELS),
      severity: cleanSeverity(body.severity),
      symptoms: Array.isArray(body.symptoms)
        ? body.symptoms.map((s) => cleanText(s, 200)).filter(Boolean).join(', ')
        : undefined,
      tried_so_far: cleanText(body.triedSoFar, 2000),
      questions_for_doctor: cleanText(body.questionsForDoctor, 2000),
      current_medications: cleanText(body.currentMedications, 2000),
      allergies: cleanText(body.allergies, 1000)
    };
    // The app sends enum names; a clinician must read prose, not `FEW_DAYS`.
    Object.keys(answers).forEach((k) => {
      if (answers[k] === undefined || answers[k] === '' || answers[k] === null) delete answers[k];
    });

    const result = await withIdempotency(req, async () => {
      // If the appointment is named, it must be the caller's. A local-only id
      // that the server has not seen yet is tolerated (the answer still has
      // value), but another patient's appointment is a hard 403.
      const appointment = await resolveOwnedAppointment({
        tenantId: req.patient.tenantId,
        patientId: req.patient.id,
        clientAppointmentId: body.appointmentId
      });

      const submission = await intakeService.submitResponse({
        questionnaireId: 'questionnaire-visit-intake-v1',
        submission: {
          patientId: req.patient.id,
          answers,
          patientContext: {
            tenantId: req.patient.tenantId,
            appointmentId: appointment?.id || null
          }
        },
        actor: {
          actorId: req.patient.id,
          actorRole: 'patient',
          tenantId: req.patient.tenantId
        },
        tenantId: req.patient.tenantId
      });

      return {
        success: true,
        questionnaireResponseId: submission.questionnaireResponseId,
        status: 'INTAKE_RECORDED',
        // A high-severity answer is surfaced so the clinic can triage it; the
        // patient is never told a diagnosis.
        escalationLevel: submission.escalation?.escalationLevel || 'ROUTINE',
        requiresTriage: Boolean(submission.escalation?.requiresEscalation)
      };
    });

    return res.status(result.idempotent ? 200 : 201).json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Follow-up
// ---------------------------------------------------------------------------

router.post('/follow-ups', requirePatientAuth, async (req, res) => {
  if (!requirePostgres(res)) return;
  const body = req.body || {};

  try {
    const result = await withIdempotency(req, async () => {
      // The demo closed-loop service invents a patient when none is supplied, so
      // it must never be the write path for a real check-in. The check-in is
      // persisted as a clinic-visible message with structured metadata instead:
      // a clinician reads the answer, and the app never receives a fabricated
      // triage decision.
      const recovery = cleanEnum(body.recovery, ['BETTER', 'SAME', 'WORSE']);
      const hasSideEffects = body.hasSideEffects === true;
      const needsToBeSeen = body.needsToBeSeen === true;
      const note = cleanText(body.note, 2000);

      const appointment = await resolveOwnedAppointment({
        tenantId: req.patient.tenantId,
        patientId: req.patient.id,
        clientAppointmentId: body.appointmentId
      });

      const summary =
        `Follow-up check-in: feeling ${recovery.toLowerCase()}` +
        (hasSideEffects ? ', side effects reported' : ', no side effects reported') +
        (needsToBeSeen ? ', asks to be seen' : ', does not need to be seen') +
        (note ? `. Note: ${note}` : '.');

      const row = await repo.recordPatientMessage({
        tenantId: req.patient.tenantId,
        patientId: req.patient.id,
        encounterId: await encounterIdFor(req.patient.tenantId, appointment?.id),
        body: summary,
        metadata: {
          direction: 'INBOUND',
          kind: 'FOLLOW_UP_CHECK_IN',
          checkInId: cleanText(body.checkInId, 128) || null,
          appointmentId: appointment?.id || null,
          recovery,
          hasSideEffects,
          needsToBeSeen,
          requiresTriage: needsToBeSeen || hasSideEffects || recovery === 'WORSE',
          answeredAtIso: body.answeredAtIso || null
        }
      });

      return {
        success: true,
        checkInId: body.checkInId || null,
        messageId: row.id,
        status: 'RECORDED',
        requiresTriage: needsToBeSeen || hasSideEffects || recovery === 'WORSE'
      };
    });

    return res.status(result.idempotent ? 200 : 201).json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Refills
// ---------------------------------------------------------------------------

router.post('/refills', requirePatientAuth, async (req, res) => {
  if (!requirePostgres(res)) return;
  const body = req.body || {};

  try {
    // Persisted as a patient message so it appears in the clinic's inbox the
    // moment it arrives. Deliberately not a prescription: only a clinician can
    // authorise a refill, and this endpoint must never imply otherwise.
    const result = await withIdempotency(req, async () => {
      const medicationName = cleanText(body.medicationName, 200) || 'medication';
      const dosage = cleanText(body.dosage, 100);
      const note = cleanText(body.note, 1000);

      const appointment = await resolveOwnedAppointment({
        tenantId: req.patient.tenantId,
        patientId: req.patient.id,
        clientAppointmentId: body.appointmentId
      });

      const row = await repo.recordPatientMessage({
        tenantId: req.patient.tenantId,
        patientId: req.patient.id,
        encounterId: await encounterIdFor(req.patient.tenantId, appointment?.id),
        body:
          `Refill request: ${medicationName}${dosage ? ` ${dosage}` : ''}` +
          (note ? ` — ${note}` : ''),
        metadata: {
          direction: 'INBOUND',
          kind: 'REFILL_REQUEST',
          refillId: cleanText(body.refillId, 128) || null,
          medicationId: cleanText(body.medicationId, 128) || null,
          pharmacy: cleanText(body.pharmacy, 200) || null,
          requestedAtIso: cleanText(body.requestedAtIso, 64) || null,
          appointmentId: appointment?.id || null,
          // A request is not an authorisation.
          status: 'REQUESTED'
        }
      });

      return { success: true, refillId: body.refillId, messageId: row.id, status: 'REQUESTED' };
    });

    return res.status(result.idempotent ? 200 : 201).json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

/**
 * Everything the clinic sends back.
 *
 * Appointments and clinic messages are served from the workflow database. A
 * message is included only when a clinician wrote it — the patient's own
 * check-ins and refill requests stay on their device and on the clinic's queue,
 * so the phone's inbox is not a mirror of its outbox.
 *
 * Prescriptions and availability still return empty arrays, and the client's
 * merger treats an absent collection as "no change" rather than "delete" — so a
 * patient never loses the data already on their phone because a server had
 * nothing to say.
 */
router.get('/pull', requirePatientAuth, async (req, res) => {
  if (!requirePostgres(res)) return;

  try {
    // The phone needs both sides of "now": upcoming visits, and completed ones
    // recent enough to carry an unanswered 48-hour check-in. Without the lower
    // bound, a patient with a long history would fill the row limit with old
    // visits and never receive their next appointment.
    const from = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const rows = await repo.listAppointments({
      tenantId: req.patient.tenantId,
      from,
      limit: 500
    });
    const mine = rows
      .filter((row) => row.patient_id === req.patient.id)
      .map((row) => ({
        id: row.id,
        localId: row.patient_local_id || null,
        patientId: row.patient_id,
        doctorId: row.clinician_id,
        dateIso: row.scheduled_for,
        // The app already renders CONFIRMED; deriving it from `confirmed_at`
        // keeps the stored status vocabulary (BOOKED/CANCELLED/...) intact.
        status: row.status === 'BOOKED' && row.confirmed_at ? 'CONFIRMED' : row.status,
        reason: row.reason,
        durationMinutes: row.duration_minutes
      }));

    const messageRows = await repo.listPatientMessages({
      tenantId: req.patient.tenantId,
      patientId: req.patient.id,
      limit: 50
    });

    const messages = messageRows
      .filter((row) => !isPatientAuthored(row.metadata))
      .map((row) => {
        const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        return {
          id: row.id,
          body: row.body,
          kind: metadata.kind || 'CLINIC_MESSAGE',
          authorName: metadata.authorName || 'Your clinic',
          appointmentId: metadata.appointmentId || null,
          createdAt: row.created_at,
          readAt: row.read_at,
          resolvedAt: row.resolved_at
        };
      });

    return res.json({
      serverTime: new Date().toISOString(),
      appointments: mine,
      messages,
      prescriptions: [],
      availability: []
    });
  } catch (err) {
    return sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Discovery (used by the app to fail fast on a wrong server address)
// ---------------------------------------------------------------------------

router.get('/', (req, res) => {
  res.json({ service: 'patient-sync', version: 1, kinds: SUPPORTED_KINDS });
});

module.exports = router;
