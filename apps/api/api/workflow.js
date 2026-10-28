/**
 * Proton Workflow API
 *
 * The durable clinical loop's control surface. Every endpoint is tenant-scoped
 * from the authenticated actor (never from the request body) and every mutation
 * is idempotent when an `Idempotency-Key` header is supplied.
 *
 * Mounted at /api/workflow behind resolveActorMiddleware (see app.js).
 */

const express = require('express');

const repo = require('../storage/postgres/workflowRepository');
const {
  ENCOUNTER_STATES,
  TRANSITIONS,
  WorkflowError,
  transitionEncounter,
  replayEncounterState,
  buildIdempotencyFingerprint
} = require('../services/workflow/encounterStateMachine');
const { verifyWorkflowAuditChain, listWorkflowAuditEvents } = require('../storage/postgres/workflowAuditRepository');
const { getPostgresPool } = require('../storage/postgresDb');
const { dispatchDueOutbox } = require('../services/workflow/outboxDispatcher');
const { assertSignSafety } = require('../services/workflow/signSafety');
const { getBoss, OUTBOX_QUEUE, isWorkflowPersistenceEnabled } = require('../services/workflow/runtime');

const router = express.Router();

// Durable workflow endpoints are meaningless without the database behind them.
// Fail loudly with a configuration error instead of a 500 from an unreachable pool.
router.use((req, res, next) => {
  if (!isWorkflowPersistenceEnabled()) {
    return res.status(503).json({
      error: 'Workflow persistence is not configured. Set DATABASE_URL (or WORKFLOW_PERSISTENCE=postgres).',
      code: 'WORKFLOW_PERSISTENCE_DISABLED'
    });
  }
  next();
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function actorOf(req) {
  // resolveActorMiddleware guarantees this for /api/workflow, but never trust
  // an implicit default: an unsigned request must not become a clinician.
  if (!req.actor || !req.actor.actorId) {
    throw new WorkflowError('ACTOR_REQUIRED', 'A verified actor is required.', 401);
  }
  return {
    actorId: req.actor.actorId,
    actorRole: req.actor.actorRole,
    actorName: req.actor.actorName,
    tenantId: req.actor.tenantId || 'org-default'
  };
}

function requireRoles(actor, roles) {
  if (!roles.includes(actor.actorRole)) {
    throw new WorkflowError(
      'ROLE_NOT_PERMITTED',
      `Role '${actor.actorRole}' may not perform this action. Requires: ${roles.join(', ')}.`,
      403,
      { requiredRoles: roles }
    );
  }
}

function requireString(value, field, { max = 500 } = {}) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new WorkflowError('VALIDATION_ERROR', `'${field}' is required.`, 400, { field });
  }
  if (value.length > max) {
    throw new WorkflowError('VALIDATION_ERROR', `'${field}' exceeds ${max} characters.`, 400, { field });
  }
  return value.trim();
}

function optionalString(value, field, { max = 500 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new WorkflowError('VALIDATION_ERROR', `'${field}' must be a string.`, 400, { field });
  }
  if (value.length > max) {
    throw new WorkflowError('VALIDATION_ERROR', `'${field}' exceeds ${max} characters.`, 400, { field });
  }
  return value.trim();
}

function parseDate(value, field) {
  const raw = requireString(value, field, { max: 64 });
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new WorkflowError('VALIDATION_ERROR', `'${field}' must be an ISO-8601 date.`, 400, { field });
  }
  return parsed;
}

function idempotencyKey(req) {
  const raw = req.get('Idempotency-Key');
  if (!raw) return null;
  if (raw.length > 200) {
    throw new WorkflowError('VALIDATION_ERROR', 'Idempotency-Key is too long.', 400);
  }
  return raw;
}

/**
 * Wraps a mutating handler with replayable idempotency: the stored response is
 * returned verbatim for an identical key + payload.
 */
function withIdempotency(fingerprintSource, handler) {
  return async (req, res, next) => {
    try {
      const actor = actorOf(req);
      const key = idempotencyKey(req);
      const requestHash = buildIdempotencyFingerprint(fingerprintSource(req, actor));

      if (key) {
        const existing = await repo.getWorkflowIdempotentResponse({
          tenantId: actor.tenantId,
          key,
          requestHash
        });
        if (existing) {
          res.set('Idempotent-Replay', 'true');
          return res.status(existing.response_status).json(existing.response_body);
        }
      }

      const { status, body } = await handler(req, actor);

      if (key) {
        await repo.putWorkflowIdempotentResponse({
          tenantId: actor.tenantId,
          key,
          requestHash,
          status,
          body
        });
      }

      res.status(status).json(body);
    } catch (err) {
      next(err);
    }
  };
}

// ---------------------------------------------------------------------------
// reference data
// ---------------------------------------------------------------------------

router.get('/states', (req, res) => {
  res.json({
    states: ENCOUNTER_STATES,
    transitions: TRANSITIONS.map((t) => ({
      action: t.action,
      from: t.from,
      to: t.to,
      roles: t.roles,
      label: t.label,
      requiresReason: Boolean(t.requiresReason),
      requiresAttestation: Boolean(t.requiresAttestation)
    }))
  });
});

// ---------------------------------------------------------------------------
// patients
// ---------------------------------------------------------------------------

router.post(
  '/patients',
  withIdempotency(
    (req, actor) => ({ action: 'create_patient', actorId: actor.actorId, body: req.body || {} }),
    async (req, actor) => {
      requireRoles(actor, ['physician', 'nurse', 'operations_staff', 'admin']);
      const body = req.body || {};

      const fullName = requireString(body.fullName, 'fullName', { max: 200 });
      const mrn = optionalString(body.mrn, 'mrn', { max: 64 });

      if (mrn) {
        const existing = await repo.findPatientByMrn({ tenantId: actor.tenantId, mrn });
        if (existing) {
          return { status: 200, body: { patient: existing, created: false } };
        }
      }

      const patient = await repo.createPatient({
        tenantId: actor.tenantId,
        fullName,
        mrn,
        dateOfBirth: optionalString(body.dateOfBirth, 'dateOfBirth', { max: 32 }),
        sex: optionalString(body.sex, 'sex', { max: 32 }),
        fhirPatientId: optionalString(body.fhirPatientId, 'fhirPatientId', { max: 128 }),
        contact: body.contact && typeof body.contact === 'object' ? body.contact : {}
      });

      return { status: 201, body: { patient, created: true } };
    }
  )
);

router.get('/patients', async (req, res, next) => {
  try {
    const actor = actorOf(req);
    res.json({ patients: await repo.listPatients({ tenantId: actor.tenantId, limit: req.query.limit }) });
  } catch (err) {
    next(err);
  }
});

router.get('/patients/:patientId', async (req, res, next) => {
  try {
    const actor = actorOf(req);
    const patient = await repo.getPatient({ tenantId: actor.tenantId, patientId: req.params.patientId });
    if (!patient) throw new WorkflowError('PATIENT_NOT_FOUND', 'Patient not found.', 404);
    res.json({ patient });
  } catch (err) {
    next(err);
  }
});

router.get('/patients/:patientId/messages', async (req, res, next) => {
  try {
    const actor = actorOf(req);
    const messages = await repo.listPatientMessages({
      tenantId: actor.tenantId,
      patientId: req.params.patientId
    });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// appointments (booking)
// ---------------------------------------------------------------------------

router.post(
  '/appointments',
  withIdempotency(
    (req, actor) => ({ action: 'book_appointment', actorId: actor.actorId, body: req.body || {} }),
    async (req, actor) => {
      requireRoles(actor, ['physician', 'nurse', 'operations_staff', 'admin']);

      const body = req.body || {};
      const patientId = requireString(body.patientId, 'patientId', { max: 128 });
      const clinicianId = requireString(body.clinicianId, 'clinicianId', { max: 128 });
      const scheduledFor = parseDate(body.scheduledFor, 'scheduledFor');
      const reason = optionalString(body.reason, 'reason', { max: 500 });
      const durationMinutes = body.durationMinutes === undefined ? 20 : Number(body.durationMinutes);

      if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 480) {
        throw new WorkflowError('VALIDATION_ERROR', "'durationMinutes' must be an integer between 1 and 480.", 400);
      }

      const result = await repo.withTransaction(async (client) => {
        const patient = await repo.getPatient({ tenantId: actor.tenantId, patientId, client });
        if (!patient) throw new WorkflowError('PATIENT_NOT_FOUND', 'Patient not found.', 404);

        const appointment = await repo.createAppointment(
          {
            tenantId: actor.tenantId,
            patientId,
            clinicianId,
            scheduledFor,
            durationMinutes,
            reason,
            idempotencyKey: idempotencyKey(req)
          },
          { client }
        );

        // Booking creates the encounter, so the state machine exists from the
        // first second of the patient relationship.
        const encounter = await repo.createEncounter(
          {
            tenantId: actor.tenantId,
            patientId,
            appointmentId: appointment.id,
            clinicianId,
            actor,
            reason: reason || 'appointment booked'
          },
          { client }
        );

        return { appointment, encounter };
      });

      return { status: 201, body: result };
    }
  )
);

router.get('/appointments', async (req, res, next) => {
  try {
    const actor = actorOf(req);
    res.json({
      appointments: await repo.listAppointments({
        tenantId: actor.tenantId,
        from: req.query.from || null,
        to: req.query.to || null
      })
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// encounters
// ---------------------------------------------------------------------------

router.get('/encounters', async (req, res, next) => {
  try {
    const actor = actorOf(req);
    res.json({
      encounters: await repo.listEncounters({
        tenantId: actor.tenantId,
        state: req.query.state || null,
        patientId: req.query.patientId || null,
        limit: req.query.limit
      })
    });
  } catch (err) {
    next(err);
  }
});

router.get('/encounters/:encounterId', async (req, res, next) => {
  try {
    const actor = actorOf(req);
    const encounter = await repo.getEncounter({
      tenantId: actor.tenantId,
      encounterId: req.params.encounterId
    });
    if (!encounter) throw new WorkflowError('ENCOUNTER_NOT_FOUND', 'Encounter not found.', 404);
    res.json({ encounter });
  } catch (err) {
    next(err);
  }
});

router.get('/encounters/:encounterId/events', async (req, res, next) => {
  try {
    const actor = actorOf(req);
    const encounter = await repo.getEncounter({
      tenantId: actor.tenantId,
      encounterId: req.params.encounterId
    });
    if (!encounter) throw new WorkflowError('ENCOUNTER_NOT_FOUND', 'Encounter not found.', 404);

    const events = await repo.listEncounterEvents({
      tenantId: actor.tenantId,
      encounterId: req.params.encounterId
    });
    res.json({ encounter, events });
  } catch (err) {
    next(err);
  }
});

router.get('/encounters/:encounterId/outbox', async (req, res, next) => {
  try {
    const actor = actorOf(req);
    res.json({
      outbox: await repo.listOutbox({
        tenantId: actor.tenantId,
        encounterId: req.params.encounterId,
        status: req.query.status || null
      })
    });
  } catch (err) {
    next(err);
  }
});

/**
 * The only endpoint that mutates encounter state.
 */
router.post('/encounters/:encounterId/transitions', async (req, res, next) => {
  try {
    const actor = actorOf(req);
    const body = req.body || {};

    const action = requireString(body.action, 'action', { max: 64 });
    const reason = optionalString(body.reason, 'reason', { max: 1000 });
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
    const expectedVersion =
      body.expectedVersion === undefined || body.expectedVersion === null ? null : Number(body.expectedVersion);

    if (expectedVersion !== null && (!Number.isInteger(expectedVersion) || expectedVersion < 1)) {
      throw new WorkflowError('VALIDATION_ERROR', "'expectedVersion' must be a positive integer.", 400);
    }

    const key = idempotencyKey(req);
    const requestHash = buildIdempotencyFingerprint({ action, actorId: actor.actorId, reason });

    // Idempotency is check-then-act across two statements. A simultaneous
    // duplicate can slip through this window, but it cannot double-apply the
    // transition: the state machine re-validates under a row lock and the loser
    // receives 409 ILLEGAL_TRANSITION. The stored response serves every
    // subsequent retry.
    if (key) {
      const existing = await repo.getWorkflowIdempotentResponse({ tenantId: actor.tenantId, key, requestHash });
      if (existing) {
        res.set('Idempotent-Replay', 'true');
        return res.status(existing.response_status).json(existing.response_body);
      }
    }

    const result = await repo.withTransaction(async (client) => {
      // The signature is a clinical write. Check the prescriptions in the same
      // transaction, before the state changes, so a refusal leaves no event.
      let signSafety = null;
      if (action === 'sign') {
        signSafety = await assertSignSafety(client, {
          tenantId: actor.tenantId,
          encounterId: req.params.encounterId,
          actor,
          physicianDirective: optionalString(body.physicianDirective, 'physicianDirective', { max: 1000 })
        });
      }

      const transitionResult = await transitionEncounter(client, {
        tenantId: actor.tenantId,
        encounterId: req.params.encounterId,
        action,
        actor,
        reason,
        metadata,
        expectedVersion,
        attestation: body.attestation === true
      });

      if (signSafety && !signSafety.skipped && signSafety.verdict) {
        await client.query(
          `UPDATE notes
              SET provenance = provenance || jsonb_build_object('safety_verdict', $3::jsonb),
                  updated_at = NOW()
            WHERE id = (
              SELECT id FROM notes
               WHERE encounter_id = $1 AND tenant_id = $2
               ORDER BY created_at DESC
               LIMIT 1
            );`,
          [req.params.encounterId, actor.tenantId, JSON.stringify(signSafety.verdict)]
        );
      }

      const responseBody = {
        encounter: transitionResult.encounter,
        event: transitionResult.event,
        previousState: transitionResult.previousState,
        nextState: transitionResult.nextState,
        safety: signSafety && !signSafety.skipped ? {
          status: signSafety.verdict.status,
          cleared: signSafety.verdict.cleared,
          kernelVersion: signSafety.verdict.kernelVersion
        } : null,
        outbox: transitionResult.outbox.map((row) => ({
          id: row.id,
          channel: row.channel,
          template: row.template,
          status: row.status
        }))
      };

      if (key) {
        await repo.putWorkflowIdempotentResponse(
          {
            tenantId: actor.tenantId,
            key,
            requestHash,
            status: 200,
            body: responseBody
          },
          { client }
        );
      }

      return responseBody;
    });

    // Wake the outbox worker immediately; the recurring schedule is the safety
    // net, so a failure here only delays delivery, it never loses it.
    const boss = getBoss();
    if (boss && result.outbox.length > 0) {
      boss.send(OUTBOX_QUEUE, { source: 'transition', encounterId: req.params.encounterId }).catch(() => {});
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Rebuilds state from the event log. Proves the log alone is sufficient —
 * the integrity test uses this to detect a lost or duplicated transition.
 */
router.get('/encounters/:encounterId/replay', async (req, res, next) => {
  try {
    const actor = actorOf(req);
    const client = await getPostgresPool().connect();
    try {
      const replayed = await replayEncounterState(client, {
        tenantId: actor.tenantId,
        encounterId: req.params.encounterId
      });
      const encounter = await repo.getEncounter({ tenantId: actor.tenantId, encounterId: req.params.encounterId });
      if (!encounter) throw new WorkflowError('ENCOUNTER_NOT_FOUND', 'Encounter not found.', 404);
      res.json({
        encounterId: encounter.id,
        storedState: encounter.state,
        replayedState: replayed,
        consistent: encounter.state === replayed
      });
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// outbox + audit
// ---------------------------------------------------------------------------

router.post('/outbox/dispatch', async (req, res, next) => {
  try {
    const actor = actorOf(req);
    requireRoles(actor, ['physician', 'operations_staff', 'admin']);
    const limit = req.body?.limit === undefined ? 25 : Number(req.body.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new WorkflowError('VALIDATION_ERROR', "'limit' must be an integer between 1 and 100.", 400);
    }
    res.json(await dispatchDueOutbox({ limit }));
  } catch (err) {
    next(err);
  }
});

router.get('/audit/verify', async (req, res, next) => {
  try {
    const actor = actorOf(req);
    const result = await verifyWorkflowAuditChain({ tenantId: actor.tenantId });
    res.status(result.valid ? 200 : 409).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/audit', async (req, res, next) => {
  try {
    const actor = actorOf(req);
    requireRoles(actor, ['physician', 'operations_staff', 'admin']);
    res.json({
      events: await listWorkflowAuditEvents({
        tenantId: actor.tenantId,
        encounterId: req.query.encounterId || null,
        limit: req.query.limit
      })
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// error boundary
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof WorkflowError || err?.name === 'WorkflowError') {
    return res.status(err.status || 409).json({
      error: err.message,
      code: err.code,
      ...(Object.keys(err.details || {}).length ? { details: err.details } : {})
    });
  }

  // Postgres constraint violations are client errors, not 500s.
  if (err?.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists.', code: 'CONFLICT' });
  }
  if (err?.code === '23503') {
    return res.status(409).json({ error: 'Referenced resource does not exist.', code: 'FOREIGN_KEY_VIOLATION' });
  }
  if (err?.code === '23514') {
    return res.status(400).json({ error: 'Value violates a domain constraint.', code: 'CONSTRAINT_VIOLATION' });
  }

  console.error('[workflow] unhandled error:', err);
  return res.status(500).json({ error: 'Internal workflow error.', code: 'WORKFLOW_INTERNAL_ERROR' });
});

module.exports = router;
