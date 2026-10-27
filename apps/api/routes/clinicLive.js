/**
 * Clinic live loop API.
 *
 * Mounted at `/api/clinic/live`, ahead of the legacy workspace router. Backed by
 * the same Postgres tables as `/api/patient/sync/*`, so a patient booking or
 * check-in appears here without a relay and a clinician reply appears on the
 * phone at its next pull.
 *
 * Reads:  GET  /overview            schedule + attention queue in one poll
 *         GET  /appointments        schedule only
 *         GET  /messages            one patient's thread
 * Writes: POST /appointments/:id/confirm
 *         POST /appointments/:id/reschedule
 *         POST /appointments/:id/cancel
 *         POST /messages             reply to a patient
 *         POST /messages/resolve     close one item or a whole thread
 *
 * The tenant always comes from the verified actor. No route accepts a tenant id,
 * and no route accepts a patient id for an appointment it did not load by id
 * inside that tenant.
 */

const express = require('express');
const { resolveActorMiddleware, requireRole } = require('../middleware/rbac');
const live = require('../services/careLoop/liveClinicService');

const router = express.Router();

// The app-level gate already resolves actors for `/api/clinic/*`, but this
// router is also mounted directly in tests. Resolving twice is idempotent.
router.use(resolveActorMiddleware);

const SCHEDULING_ROLES = ['physician', 'operations_staff'];
const CLINICAL_REPLY_ROLES = ['physician'];

function actorOrThrow(req) {
  if (!req.actor || !req.actor.actorId || !req.actor.tenantId) {
    const err = new live.LiveClinicError(
      'ACTOR_REQUIRED',
      'A verified clinician session is required.',
      401
    );
    throw err;
  }
  return req.actor;
}

function sendError(res, err) {
  if (err instanceof live.LiveClinicError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }

  const status = err.status || 500;
  if (status >= 500) {
    // Never echo SQL or driver internals to a browser.
    console.error('[clinic-live] failed:', err.message);
  }
  return res.status(status).json({
    error: status >= 500 ? 'The clinic database could not complete that request.' : err.message,
    code: err.code || 'CLINIC_LIVE_FAILED'
  });
}

router.get('/overview', async (req, res) => {
  try {
    const actor = actorOrThrow(req);
    const overview = await live.getOverview({
      tenantId: actor.tenantId,
      date: req.query.date,
      from: req.query.from,
      to: req.query.to
    });
    return res.json(overview);
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/appointments', async (req, res) => {
  try {
    const actor = actorOrThrow(req);
    const result = await live.listAppointments({
      tenantId: actor.tenantId,
      date: req.query.date,
      from: req.query.from,
      to: req.query.to
    });
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/messages', async (req, res) => {
  try {
    const actor = actorOrThrow(req);
    const thread = await live.getThread({
      tenantId: actor.tenantId,
      patientId: req.query.patientId,
      limit: req.query.limit
    });
    return res.json(thread);
  } catch (err) {
    return sendError(res, err);
  }
});

router.post(
  '/messages',
  requireRole(CLINICAL_REPLY_ROLES),
  async (req, res) => {
    try {
      const actor = actorOrThrow(req);
      const body = req.body || {};
      const message = await live.replyToPatient({
        tenantId: actor.tenantId,
        patientId: body.patientId,
        body: body.body,
        actor
      });
      return res.status(201).json({ message });
    } catch (err) {
      return sendError(res, err);
    }
  }
);

router.post(
  '/messages/resolve',
  requireRole(SCHEDULING_ROLES),
  async (req, res) => {
    try {
      const actor = actorOrThrow(req);
      const body = req.body || {};
      const result = await live.resolveMessages({
        tenantId: actor.tenantId,
        patientId: body.patientId,
        messageId: body.messageId
      });
      return res.json(result);
    } catch (err) {
      return sendError(res, err);
    }
  }
);

router.post(
  '/appointments/:appointmentId/confirm',
  requireRole(SCHEDULING_ROLES),
  async (req, res) => {
    try {
      const actor = actorOrThrow(req);
      const appointment = await live.confirmAppointment({
        tenantId: actor.tenantId,
        appointmentId: req.params.appointmentId
      });
      return res.json({ appointment });
    } catch (err) {
      return sendError(res, err);
    }
  }
);

router.post(
  '/appointments/:appointmentId/reschedule',
  requireRole(SCHEDULING_ROLES),
  async (req, res) => {
    try {
      const actor = actorOrThrow(req);
      const body = req.body || {};
      const appointment = await live.rescheduleAppointment({
        tenantId: actor.tenantId,
        appointmentId: req.params.appointmentId,
        scheduledFor: body.scheduledFor
      });
      return res.json({ appointment });
    } catch (err) {
      return sendError(res, err);
    }
  }
);

router.post(
  '/appointments/:appointmentId/cancel',
  requireRole(SCHEDULING_ROLES),
  async (req, res) => {
    try {
      const actor = actorOrThrow(req);
      const appointment = await live.cancelAppointment({
        tenantId: actor.tenantId,
        appointmentId: req.params.appointmentId
      });
      return res.json({ appointment });
    } catch (err) {
      return sendError(res, err);
    }
  }
);

module.exports = router;
