/**
 * Proton Clinic API
 *
 * The clinical workspace's durable source of truth. Mounted behind
 * resolveActorMiddleware, so every request is scoped to a verified actor and
 * tenant (or the controlled synthetic physician in local evaluation mode).
 */

const express = require('express');
const clinic = require('../storage/clinicRepository');

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

router.post('/notes/:id/sign', handle((req, res) => {
  const result = clinic.signNote(actor(req), req.params.id, req.body || {});
  res.json(result);
}));

router.post('/encounters/sign', handle((req, res) => {
  const body = req.body || {};
  if (!body.noteId && !body.patientId) {
    return res.status(400).json({ error: 'noteId or patientId is required.', code: 'SIGN_TARGET_REQUIRED' });
  }
  const result = clinic.signNote(actor(req), body.noteId || null, body);
  res.json(result);
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
