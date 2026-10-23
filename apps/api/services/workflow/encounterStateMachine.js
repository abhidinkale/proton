/**
 * Proton Encounter State Machine
 *
 * The encounter lifecycle is the spine of the clinical loop:
 *
 *   BOOKED -> CHECKED_IN -> INTAKE -> READY -> CAPTURING -> DRAFTED
 *          -> PENDING_REVIEW -> SIGNED -> REPORTED -> FOLLOW_UP_DUE -> CLOSED
 *
 *   any active state -> ESCALATED -> (resume to the state it came from)
 *   any pre-signature state -> CANCELLED
 *
 * Invariants enforced here (not in the router, not in the UI):
 *   1. Only transitions listed in TRANSITIONS are legal.
 *   2. Only the roles listed for that transition may perform it.
 *      In particular only a `physician` may sign — the safety model depends on
 *      a named human attesting to the clinical content.
 *   3. Every transition is applied under `SELECT ... FOR UPDATE` with a
 *      monotonic version, so two concurrent callers cannot both succeed.
 *   4. The state change, the append-only event, the audit-chain entry and any
 *      outbox messages are written in ONE transaction. If any part fails, none
 *      of it happens.
 */

const crypto = require('crypto');
const { recordWorkflowAuditEvent } = require('../../storage/postgres/workflowAuditRepository');

const ENCOUNTER_STATES = Object.freeze([
  'BOOKED',
  'CHECKED_IN',
  'INTAKE',
  'READY',
  'CAPTURING',
  'DRAFTED',
  'PENDING_REVIEW',
  'SIGNED',
  'REPORTED',
  'FOLLOW_UP_DUE',
  'CLOSED',
  'ESCALATED',
  'CANCELLED'
]);

const TERMINAL_STATES = Object.freeze(['CLOSED', 'CANCELLED']);

const CLINICIANS = ['physician', 'nurse'];
const FRONT_DESK = ['physician', 'nurse', 'operations_staff', 'admin'];

/**
 * Ordered list of transition definitions. `from` lists every state the action
 * may be applied in; `to` may be the literal 'PREVIOUS' for escalation resume.
 */
const TRANSITIONS = Object.freeze([
  {
    action: 'check_in',
    from: ['BOOKED'],
    to: 'CHECKED_IN',
    roles: FRONT_DESK,
    label: 'Check patient in'
  },
  {
    action: 'start_intake',
    from: ['CHECKED_IN'],
    to: 'INTAKE',
    roles: FRONT_DESK,
    label: 'Start intake'
  },
  {
    action: 'complete_intake',
    from: ['INTAKE'],
    to: 'READY',
    roles: FRONT_DESK,
    label: 'Complete intake'
  },
  {
    action: 'start_capture',
    from: ['READY'],
    to: 'CAPTURING',
    roles: CLINICIANS,
    label: 'Start ambient capture'
  },
  {
    action: 'stop_capture',
    from: ['CAPTURING'],
    to: 'DRAFTED',
    roles: CLINICIANS,
    label: 'Stop capture and draft note'
  },
  {
    action: 'submit_for_review',
    from: ['DRAFTED'],
    to: 'PENDING_REVIEW',
    roles: CLINICIANS,
    label: 'Submit draft for physician review'
  },
  {
    action: 'return_for_edit',
    from: ['PENDING_REVIEW'],
    to: 'DRAFTED',
    roles: ['physician'],
    label: 'Return draft for edit',
    requiresReason: true
  },
  {
    // The single most important gate in the product: a named physician
    // attests that the AI-drafted note, diagnoses and prescriptions are
    // clinically correct before anything reaches the patient.
    action: 'sign',
    from: ['PENDING_REVIEW'],
    to: 'SIGNED',
    roles: ['physician'],
    label: 'Sign encounter',
    requiresReason: false,
    requiresAttestation: true
  },
  {
    action: 'publish_report',
    from: ['SIGNED'],
    to: 'REPORTED',
    roles: ['physician', 'system'],
    label: 'Publish patient report'
  },
  {
    action: 'schedule_follow_up',
    from: ['REPORTED', 'SIGNED'],
    to: 'FOLLOW_UP_DUE',
    roles: ['physician', 'nurse', 'operations_staff', 'system'],
    label: 'Schedule follow-up'
  },
  {
    action: 'complete_follow_up',
    from: ['FOLLOW_UP_DUE'],
    to: 'CLOSED',
    roles: ['physician', 'nurse', 'system'],
    label: 'Complete follow-up and close'
  },
  {
    action: 'close',
    from: ['REPORTED', 'FOLLOW_UP_DUE', 'SIGNED'],
    to: 'CLOSED',
    roles: ['physician', 'operations_staff', 'admin'],
    label: 'Close encounter',
    requiresReason: true
  },
  {
    action: 'escalate',
    from: ['BOOKED', 'CHECKED_IN', 'INTAKE', 'READY', 'CAPTURING', 'DRAFTED', 'PENDING_REVIEW'],
    to: 'ESCALATED',
    roles: FRONT_DESK,
    label: 'Escalate to physician',
    requiresReason: true
  },
  {
    action: 'resume',
    from: ['ESCALATED'],
    to: 'PREVIOUS',
    roles: ['physician'],
    label: 'Resume escalated encounter'
  },
  {
    action: 'cancel',
    // Deliberately excludes SIGNED and later: a signed clinical record is
    // amended, never cancelled.
    from: ['BOOKED', 'CHECKED_IN', 'INTAKE', 'READY', 'CAPTURING', 'DRAFTED', 'PENDING_REVIEW', 'ESCALATED'],
    to: 'CANCELLED',
    roles: FRONT_DESK,
    label: 'Cancel encounter',
    requiresReason: true
  }
]);

const TRANSITIONS_BY_ACTION = new Map(TRANSITIONS.map((t) => [t.action, t]));

/**
 * Messages emitted in the same transaction as the state change. The outbox is
 * the reason a follow-up survives a process restart.
 */
const SIDE_EFFECTS = Object.freeze({
  check_in: [
    { channel: 'IN_APP', template: 'APPOINTMENT_CHECKED_IN', audienced: 'patient' },
    { channel: 'EMAIL', template: 'APPOINTMENT_CHECKED_IN', audienced: 'patient' }
  ],
  sign: [{ channel: 'IN_APP', template: 'ENCOUNTER_SIGNED', audienced: 'patient' }],
  publish_report: [
    { channel: 'IN_APP', template: 'VISIT_REPORT_READY', audienced: 'patient' },
    { channel: 'EMAIL', template: 'VISIT_REPORT_READY', audienced: 'patient' }
  ],
  schedule_follow_up: [
    { channel: 'IN_APP', template: 'FOLLOW_UP_SCHEDULED', audienced: 'patient' },
    { channel: 'EMAIL', template: 'FOLLOW_UP_SCHEDULED', audienced: 'patient' }
  ]
});

class WorkflowError extends Error {
  constructor(code, message, status = 409, details = {}) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getTransition(action) {
  const transition = TRANSITIONS_BY_ACTION.get(action);
  if (!transition) {
    throw new WorkflowError('UNKNOWN_ACTION', `Unknown encounter action '${action}'.`, 400, {
      knownActions: TRANSITIONS.map((t) => t.action)
    });
  }
  return transition;
}

/**
 * Pure validation. Throws WorkflowError on any illegal request so the caller
 * never has to duplicate these rules.
 */
function validateTransition({ action, currentState, actorRole, reason, attestation }) {
  const transition = getTransition(action);

  if (!ENCOUNTER_STATES.includes(currentState)) {
    throw new WorkflowError('INVALID_STATE', `Encounter is in unknown state '${currentState}'.`, 500);
  }

  if (TERMINAL_STATES.includes(currentState) && action !== 'cancel') {
    throw new WorkflowError(
      'ILLEGAL_TRANSITION',
      `Encounter is ${currentState} and cannot transition via '${action}'.`,
      409,
      { currentState, action, allowedFrom: [] }
    );
  }

  if (!transition.from.includes(currentState)) {
    throw new WorkflowError(
      'ILLEGAL_TRANSITION',
      `Cannot '${action}' an encounter in state ${currentState}. Allowed from: ${transition.from.join(', ')}.`,
      409,
      { currentState, action, allowedFrom: transition.from }
    );
  }

  if (!transition.roles.includes(actorRole)) {
    throw new WorkflowError(
      'ROLE_NOT_PERMITTED',
      `Role '${actorRole}' may not perform '${action}'. Requires: ${transition.roles.join(', ')}.`,
      403,
      { action, actorRole, requiredRoles: transition.roles }
    );
  }

  if (transition.requiresReason && !(typeof reason === 'string' && reason.trim().length >= 3)) {
    throw new WorkflowError('REASON_REQUIRED', `Action '${action}' requires a reason of at least 3 characters.`, 400);
  }

  if (transition.requiresAttestation && attestation !== true) {
    throw new WorkflowError(
      'ATTESTATION_REQUIRED',
      'Signing requires an explicit physician attestation (attestation: true).',
      400
    );
  }

  return transition;
}

function resolveNextState(transition, currentState, encounter) {
  if (transition.to !== 'PREVIOUS') return transition.to;

  const previous = encounter.escalated_from;
  if (!previous || !ENCOUNTER_STATES.includes(previous)) {
    throw new WorkflowError(
      'NO_RESUME_TARGET',
      'Escalated encounter has no recorded prior state; resume it explicitly by cancelling or escalating further.',
      409
    );
  }
  return previous;
}

function buildIdempotencyFingerprint({ action, actorId, reason }) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ action, actorId, reason: reason || null }))
    .digest('hex');
}

/**
 * Applies a transition inside an existing transaction.
 *
 * @param {import('pg').PoolClient} client  Caller owns BEGIN/COMMIT.
 */
async function transitionEncounter(client, params) {
  const {
    tenantId = 'org-default',
    encounterId,
    action,
    actor,
    reason = null,
    metadata = {},
    expectedVersion = null,
    attestation = false
  } = params;

  if (!encounterId) throw new WorkflowError('ENCOUNTER_REQUIRED', 'encounterId is required.', 400);
  if (!actor || !actor.actorId || !actor.actorRole) {
    throw new WorkflowError('ACTOR_REQUIRED', 'A verified actor is required for every transition.', 401);
  }

  // Row lock serializes concurrent transitions on the same encounter.
  const locked = await client.query(
    `SELECT * FROM encounters WHERE id = $1 AND tenant_id = $2 FOR UPDATE;`,
    [encounterId, tenantId]
  );

  if (locked.rows.length === 0) {
    throw new WorkflowError('ENCOUNTER_NOT_FOUND', `Encounter ${encounterId} not found in tenant ${tenantId}.`, 404);
  }

  const encounter = locked.rows[0];

  if (expectedVersion !== null && Number(expectedVersion) !== encounter.version) {
    throw new WorkflowError(
      'CONCURRENT_MODIFICATION',
      `Encounter ${encounterId} was modified concurrently (expected version ${expectedVersion}, found ${encounter.version}).`,
      409,
      { expectedVersion, actualVersion: encounter.version, currentState: encounter.state }
    );
  }

  const transition = validateTransition({
    action,
    currentState: encounter.state,
    actorRole: actor.actorRole,
    reason,
    attestation
  });

  const nextState = resolveNextState(transition, encounter.state, encounter);
  const nextVersion = encounter.version + 1;
  const occurredAt = new Date();

  const updated = await client.query(
    `UPDATE encounters
        SET state = $1,
            version = $2,
            updated_at = $3,
            escalated_from = CASE
              WHEN $4 = 'ESCALATED' THEN state
              WHEN $1 <> 'ESCALATED' THEN NULL
              ELSE escalated_from
            END,
            escalation_reason = CASE
              WHEN $4 = 'ESCALATED' THEN $5
              WHEN $1 <> 'ESCALATED' THEN NULL
              ELSE escalation_reason
            END,
            cancellation_reason = CASE WHEN $1 = 'CANCELLED' THEN $5 ELSE cancellation_reason END,
            closed_at = CASE WHEN $1 = 'CLOSED' THEN $3 ELSE closed_at END
      WHERE id = $6 AND tenant_id = $7 AND version = $8
      RETURNING *;`,
    [
      nextState,
      nextVersion,
      occurredAt,
      nextState,
      reason,
      encounterId,
      tenantId,
      encounter.version
    ]
  );

  if (updated.rowCount !== 1) {
    // The FOR UPDATE lock makes this practically unreachable, but a silent
    // lost update would be a clinical-safety defect, so fail loudly.
    throw new WorkflowError(
      'CONCURRENT_MODIFICATION',
      `Encounter ${encounterId} changed while the transition was being applied.`,
      409
    );
  }

  const eventRow = await client.query(
    `INSERT INTO encounter_events
       (encounter_id, tenant_id, sequence, action, from_state, to_state,
        actor_id, actor_role, actor_name, reason, metadata, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *;`,
    [
      encounterId,
      tenantId,
      nextVersion,
      action,
      encounter.state,
      nextState,
      actor.actorId,
      actor.actorRole,
      actor.actorName || null,
      reason,
      JSON.stringify(metadata || {}),
      occurredAt
    ]
  );

  await recordWorkflowAuditEvent(client, {
    tenantId,
    encounterId,
    action,
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    fromState: encounter.state,
    toState: nextState,
    summary: `${action}: ${encounter.state} -> ${nextState}${reason ? ` (${reason})` : ''}`,
    occurredAt
  });

  const outboxRows = await enqueueSideEffects(client, {
    tenantId,
    encounter: updated.rows[0],
    action,
    actor,
    occurredAt,
    metadata
  });

  return {
    encounter: updated.rows[0],
    event: eventRow.rows[0],
    previousState: encounter.state,
    nextState,
    outbox: outboxRows
  };
}

async function enqueueSideEffects(client, { tenantId, encounter, action, actor, occurredAt, metadata }) {
  const effects = SIDE_EFFECTS[action];
  if (!effects || effects.length === 0) return [];

  const rows = [];
  for (const effect of effects) {
    const id = `obx-${crypto.randomUUID()}`;
    // Deterministic dedupe key: replaying the same transition for the same
    // encounter version can never produce a duplicate message.
    const dedupeKey = `${encounter.id}:${encounter.version}:${action}:${effect.channel}:${effect.template}`;

    const result = await client.query(
      `INSERT INTO outbox
         (id, tenant_id, encounter_id, patient_id, channel, template, payload,
          dedupe_key, simulated, next_attempt_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9)
       ON CONFLICT (tenant_id, dedupe_key) DO NOTHING
       RETURNING *;`,
      [
        id,
        tenantId,
        encounter.id,
        encounter.patient_id,
        effect.channel,
        effect.template,
        JSON.stringify({
          encounterId: encounter.id,
          patientId: encounter.patient_id,
          state: encounter.state,
          action,
          actorId: actor.actorId,
          ...(metadata || {})
        }),
        dedupeKey,
        occurredAt
      ]
    );
    if (result.rows[0]) rows.push(result.rows[0]);
  }
  return rows;
}

/** Rebuilds state from the append-only event log. Used by the integrity test. */
async function replayEncounterState(client, { tenantId, encounterId }) {
  const { rows } = await client.query(
    `SELECT action, from_state, to_state, sequence
       FROM encounter_events
      WHERE encounter_id = $1 AND tenant_id = $2
      ORDER BY sequence ASC;`,
    [encounterId, tenantId]
  );
  if (rows.length === 0) return null;

  let state = rows[0].from_state;
  let expectedSequence = 1;
  for (const row of rows) {
    if (row.sequence !== expectedSequence) {
      throw new WorkflowError(
        'EVENT_GAP',
        `Encounter ${encounterId} event log has a gap: expected sequence ${expectedSequence}, found ${row.sequence}.`,
        500
      );
    }
    state = row.to_state;
    expectedSequence += 1;
  }
  return state;
}

module.exports = {
  ENCOUNTER_STATES,
  TERMINAL_STATES,
  TRANSITIONS,
  SIDE_EFFECTS,
  WorkflowError,
  getTransition,
  validateTransition,
  transitionEncounter,
  replayEncounterState,
  buildIdempotencyFingerprint
};
