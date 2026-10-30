/**
 * Proton Clinic API
 *
 * The clinical workspace's durable source of truth. Mounted behind
 * resolveActorMiddleware, so every request is scoped to a verified actor and
 * tenant (or the controlled synthetic physician in local evaluation mode).
 */

const express = require('express');
const clinic = require('../storage/clinicRepository');
const { mirrorSignedNote } = require('../services/careLoop/signingMirror');

const router = express.Router();

function handle(fn) {
  return (req, res, next) => {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.then === 'function') {
        result.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

function actor(req) {
  return clinic.normalizeActor(req.actor);
}

/**
 * Signs a note in the desk, then mirrors it to the durable record for the visit
 * the patient booked. The mirror is best effort: a signature that is already
 * written must not be reported as failed because the downstream copy failed.
 */
async function signAndMirror(req, res, noteId, body) {
  const normalized = actor(req);
  const result = clinic.signNote(normalized, noteId, body || {});

  if (!result.alreadySigned && result.note) {
    try {
      const appointment = result.note.appointmentId
        ? clinic.getAppointment(normalized, result.note.appointmentId)
        : null;
      const patientId = result.note.patientId || appointment?.patientId;
      const patientRecord = patientId ? clinic.getPatient(normalized, patientId) : null;
      const mirrorRes = await mirrorSignedNote({
        tenantId: normalized.tenantId,
        note: result.note,
        appointment,
        patient: patientRecord?.patient || null,
        actor: {
          actorId: normalized.id,
          actorName: normalized.name,
          actorRole: normalized.role || 'physician',
          npi: normalized.npi || null
        }
      });
      result.mirrorStatus = 'mirrored';
      result.attestationId = mirrorRes?.attestation?.id || null;
      result.syncedEncounterId = mirrorRes?.encounter?.id || null;
    } catch (err) {
      console.warn('[sign-mirror] signed note not mirrored:', err.message);
      result.mirrorStatus = 'failed';
      result.mirrorError = err.message;
      if (req.headers['x-strict-mirror'] === 'true' || body?.strictMirror === true) {
        return res.status(502).json({
          error: `Sign committed in desk but failed to mirror to durable workflow: ${err.message}`,
          code: 'MIRROR_FAILED',
          result
        });
      }
    }
  } else if (result.alreadySigned) {
    result.mirrorStatus = 'already_signed';
  }

  return res.json(result);
}

/* ------------------------------------------------------------------ */
/* Health + dashboard                                                  */
/* ------------------------------------------------------------------ */

router.get('/health', handle((req, res) => {
  const overview = clinic.overview(actor(req));
  res.json({
    status: 'ok',
    storage: 'sqlite',
    durable: true,
    date: overview.date,
    patients: clinic.listPatients(actor(req)).length,
    appointments: overview.appointments.length,
    unreadNotifications: overview.metrics.notificationsUnread,
    audit: clinic.verifyAudit(actor(req))
  });
}));

router.get('/overview', handle((req, res) => {
  res.json(clinic.overview(actor(req), req.query.date || undefined));
}));

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

router.get('/patients', handle((req, res) => {
  const patients = clinic.listPatients(actor(req), {
    query: req.query.q || req.query.query || '',
    filter: req.query.filter || 'all',
    date: req.query.date || undefined
  });
  res.json({ count: patients.length, patients });
}));

router.post('/patients', handle((req, res) => {
  const result = clinic.createPatient(actor(req), req.body || {});
  res.status(201).json(result);
}));

router.get('/patients/:id', handle((req, res) => {
  const result = clinic.getPatient(actor(req), req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Patient not found.', code: 'PATIENT_NOT_FOUND' });
  }
  res.json(result);
}));

router.patch('/patients/:id', handle((req, res) => {
  const result = clinic.updatePatient(actor(req), req.params.id, req.body || {});
  if (!result) {
    return res.status(404).json({ error: 'Patient not found.', code: 'PATIENT_NOT_FOUND' });
  }
  res.json(result);
}));

/* ------------------------------------------------------------------ */
/* Appointments                                                        */
/* ------------------------------------------------------------------ */

router.get('/appointments', handle((req, res) => {
  const appointments = clinic.listAppointments(actor(req), {
    date: req.query.date === 'all' ? null : (req.query.date || undefined),
    from: req.query.from || null,
    to: req.query.to || null,
    patientId: req.query.patientId || null,
    includeCancelled: req.query.includeCancelled === 'true'
  });
  res.json({ count: appointments.length, appointments });
}));

router.get('/availability', handle((req, res) => {
  res.json(clinic.availability(actor(req), {
    date: req.query.date || undefined,
    durationMinutes: req.query.durationMinutes,
    stepMinutes: req.query.stepMinutes
  }));
}));

router.post('/appointments', handle((req, res) => {
  const appointment = clinic.createAppointment(actor(req), req.body || {});
  res.status(201).json({ appointment });
}));

router.get('/appointments/:id', handle((req, res) => {
  const appointment = clinic.getAppointment(actor(req), req.params.id);
  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found.', code: 'APPOINTMENT_NOT_FOUND' });
  }
  res.json({ appointment });
}));

router.patch('/appointments/:id', handle((req, res) => {
  const appointment = clinic.updateAppointment(actor(req), req.params.id, req.body || {});
  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found.', code: 'APPOINTMENT_NOT_FOUND' });
  }
  res.json({ appointment });
}));

router.post('/appointments/:id/reschedule', handle((req, res) => {
  const appointment = clinic.rescheduleAppointment(actor(req), req.params.id, req.body || {});
  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found.', code: 'APPOINTMENT_NOT_FOUND' });
  }
  res.json({ appointment });
}));

router.post('/appointments/:id/cancel', handle((req, res) => {
  const appointment = clinic.updateAppointment(actor(req), req.params.id, { status: 'CANCELLED' });
  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found.', code: 'APPOINTMENT_NOT_FOUND' });
  }
  res.json({ appointment });
}));

router.delete('/appointments/:id', handle((req, res) => {
  const appointment = clinic.updateAppointment(actor(req), req.params.id, { status: 'CANCELLED' });
  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found.', code: 'APPOINTMENT_NOT_FOUND' });
  }
  res.json({ appointment, cancelled: true });
}));

/* ------------------------------------------------------------------ */
/* Encounter notes                                                     */
/* ------------------------------------------------------------------ */

router.get('/notes', handle((req, res) => {
  const notes = clinic.listNotes(actor(req), {
    patientId: req.query.patientId || null,
    status: req.query.status || null
  });
  res.json({ count: notes.length, notes });
}));

router.post('/notes', handle((req, res) => {
  res.status(201).json({ note: clinic.saveDraft(actor(req), req.body || {}) });
}));

router.get('/notes/:id', handle((req, res) => {
  const note = clinic.getNote(actor(req), req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found.', code: 'NOTE_NOT_FOUND' });
  res.json({ note });
}));

router.post('/notes/:id/sign', handle((req, res) => signAndMirror(req, res, req.params.id, req.body || {})));

router.post('/encounters/sign', handle((req, res) => {
  const body = req.body || {};
  if (!body.noteId && !body.patientId) {
    return res.status(400).json({ error: 'noteId or patientId is required.', code: 'SIGN_TARGET_REQUIRED' });
  }
  return signAndMirror(req, res, body.noteId || null, body);
}));

/* ------------------------------------------------------------------ */
/* Attention queue                                                     */
/* ------------------------------------------------------------------ */

router.get('/notifications', handle((req, res) => {
  const notifications = clinic.listNotifications(actor(req), {
    unreadOnly: req.query.unread === 'true',
    includeResolved: req.query.includeResolved === 'true',
    patientId: req.query.patientId || null,
    limit: req.query.limit || 20
  });
  res.json({
    count: notifications.length,
    unread: notifications.filter((notification) => !notification.readAt).length,
    notifications
  });
}));

router.post('/notifications/read-all', handle((req, res) => {
  res.json(clinic.markAllNotificationsRead(actor(req)));
}));

router.post('/notifications/:id/read', handle((req, res) => {
  const notification = clinic.markNotification(actor(req), req.params.id, 'read');
  if (!notification) return res.status(404).json({ error: 'Notification not found.', code: 'NOTIFICATION_NOT_FOUND' });
  res.json({ notification });
}));

router.post('/notifications/:id/resolve', handle((req, res) => {
  const notification = clinic.markNotification(actor(req), req.params.id, 'resolve');
  if (!notification) return res.status(404).json({ error: 'Notification not found.', code: 'NOTIFICATION_NOT_FOUND' });
  res.json({ notification });
}));

router.post('/notifications', handle((req, res) => {
  res.status(201).json({ notification: clinic.createNotification(actor(req), req.body || {}) });
}));

/* ------------------------------------------------------------------ */
/* Audit + search                                                      */
/* ------------------------------------------------------------------ */

router.get('/audit', handle((req, res) => {
  const events = clinic.listAudit(actor(req), { limit: req.query.limit || 50 });
  res.json({ count: events.length, events });
}));

router.get('/audit/verify', handle((req, res) => {
  res.json(clinic.verifyAudit(actor(req)));
}));

router.get('/search', handle((req, res) => {
  res.json(clinic.search(actor(req), req.query.q || ''));
}));

/* ------------------------------------------------------------------ */
/* Billing                                                             */
/* ------------------------------------------------------------------ */

router.get('/billing', handle((req, res) => {
  res.json(clinic.listInvoices(actor(req), { status: req.query.status || null }));
}));

router.patch('/billing/:id', handle((req, res) => {
  const invoice = clinic.updateInvoiceStatus(actor(req), req.params.id, (req.body || {}).status);
  res.json({ invoice });
}));

/* ------------------------------------------------------------------ */
/* Preferences                                                         */
/* ------------------------------------------------------------------ */

router.get('/preferences', handle((req, res) => {
  res.json({ preferences: clinic.getPreferences(actor(req)) });
}));

router.patch('/preferences', handle((req, res) => {
  res.json({ preferences: clinic.updatePreferences(actor(req), req.body || {}) });
}));

/* ------------------------------------------------------------------ */
/* Learning progress                                                   */
/* ------------------------------------------------------------------ */

router.get('/education/progress', handle((req, res) => {
  res.json({ progress: clinic.getEducationProgress(actor(req)) });
}));

router.patch('/education/progress', handle((req, res) => {
  res.json({ progress: clinic.updateEducationProgress(actor(req), req.body || {}) });
}));

/* ------------------------------------------------------------------ */
/* Patient hand-off                                                    */
/* ------------------------------------------------------------------ */

/**
 * Mints a QR hand-off ticket for one patient contact.
 *
 * The QR carries the ticket, not a password: it is signed, expires in fifteen
 * minutes and can be redeemed once. The clinician still chooses which patient
 * contact the ticket belongs to, so scanning cannot sign a stranger in.
 */
router.post('/patient-ticket', handle(async (req, res) => {
  const normalized = actor(req);
  const body = req.body || {};
  const identifier = String(body.identifier || '').trim();
  if (!identifier) {
    return res.status(400).json({ error: 'Enter the patient email or phone first.', code: 'IDENTIFIER_REQUIRED' });
  }

  const channel = body.channel === 'phone' ? 'phone' : 'email';
  const { createHandoffTicket } = require('../services/patients/handoffTicket');
  const { maskIdentifier } = require('../middleware/patientAuth');
  const organizationStore = require('../services/organizations/organizationStore');

  const issued = createHandoffTicket({
    tenantId: normalized.tenantId,
    identifier,
    channel
  });

  // Where the phone should send the ticket. A tunnel or deployed API must set
  // PUBLIC_API_URL, because the request host here is the doctor's machine.
  const apiBaseUrl = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const deepLink =
    `proton://connect?u=${encodeURIComponent(apiBaseUrl)}` +
    `&t=${encodeURIComponent(issued.ticket)}`;

  // Which clinic this ticket actually belongs to. A clinician signed into the
  // wrong tenant must see it before a patient scans.
  const organization = await organizationStore.findOrganization(normalized.tenantId);

  res.json({
    clinicName: organization?.name || null,
    ticket: issued.ticket,
    deepLink,
    apiBaseUrl,
    identifier,
    maskedIdentifier: maskIdentifier(channel, identifier),
    expiresAt: issued.expiresAt
  });
}));

/* ------------------------------------------------------------------ */
/* Staff QR sign-in                                                    */
/* ------------------------------------------------------------------ */

/**
 * Mints a QR that signs a phone browser in as this clinician.
 *
 * The QR opens /qr-login on the deployed web app; that page exchanges the
 * ticket for a normal revocable session token. Ten minutes, single use.
 */
router.post('/staff-ticket', handle((req, res) => {
  const normalized = actor(req);
  const { createStaffTicket } = require('../services/auth/staffTicket');

  const issued = createStaffTicket({ actor: { ...req.actor, tenantId: normalized.tenantId } });
  const webBase = (process.env.PUBLIC_WEB_URL || 'http://localhost:5173').replace(/\/+$/, '');

  res.json({
    url: `${webBase}/qr-login#t=${encodeURIComponent(issued.ticket)}`,
    expiresAt: issued.expiresAt,
    clinic: normalized.tenantId
  });
}));

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  if (status >= 500) console.error('[clinic] request failed:', err);
  res.status(status).json({
    error: err.message || 'Clinic request failed.',
    code: err.code || 'CLINIC_REQUEST_FAILED',
    ...(err.conflict ? { conflict: err.conflict } : {})
  });
});

module.exports = router;
