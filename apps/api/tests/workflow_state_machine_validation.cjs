/**
 * Proton Durable Workflow Validation
 *
 * Proves the Phase 1 claim: the clinical loop survives a process restart,
 * concurrent callers cannot double-apply a transition, every transition is
 * audited in a verifiable hash chain, and patient-facing messages are queued
 * transactionally rather than sent from memory.
 *
 * Requires PostgreSQL. Set DATABASE_URL (CI does). Locally, without a running
 * Postgres the suite prints SKIP and exits 0 — unless REQUIRE_POSTGRES=1, in
 * which case it fails, so CI can never silently skip this.
 */

const assert = require('assert');
const { prepareSuite } = require('./helpers/postgresTestHarness.cjs');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

async function testAsync(name, fn) {
  try {
    await fn();
    passCount++;
    console.log(`✓ [PASS] ${name}`);
  } catch (err) {
    failCount++;
    console.error(`✗ [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

// ---------------------------------------------------------------------------
// suite
// ---------------------------------------------------------------------------

async function run() {
  const target = await prepareSuite({
    suiteFile: 'workflow_state_machine_validation.cjs',
    testDbName: process.env.PROTON_TEST_DB || 'proton_ops_test'
  });
  if (!target) {
    process.exit(0);
  }

  // Required only after env + database are ready.
  const { runPostgresMigrations, getPostgresPool, closePostgresPool } = require('../storage/postgresDb');
  const repo = require('../storage/postgres/workflowRepository');
  const {
    transitionEncounter,
    replayEncounterState,
    WorkflowError,
    ENCOUNTER_STATES
  } = require('../services/workflow/encounterStateMachine');
  const { verifyWorkflowAuditChain, listWorkflowAuditEvents } = require('../storage/postgres/workflowAuditRepository');
  const { dispatchDueOutbox } = require('../services/workflow/outboxDispatcher');
  const { startWorkflowRuntime, stopWorkflowRuntime } = require('../services/workflow/runtime');

  const TENANT = 'org-workflow-test';
  const PHYSICIAN = { actorId: 'usr-md-lin', actorRole: 'physician', actorName: 'Dr. Sarah Lin, MD' };
  const FRONT_DESK = { actorId: 'usr-ops-amy', actorRole: 'operations_staff', actorName: 'Amy, Front Desk' };
  const NURSE = { actorId: 'usr-rn-bob', actorRole: 'nurse', actorName: 'Bob, RN' };

  const transition = (encounterId, action, actor, extra = {}) =>
    repo.withTransaction((client) =>
      transitionEncounter(client, {
        tenantId: TENANT,
        encounterId,
        action,
        actor,
        ...extra
      })
    );

  let patientId;
  let encounterId;

  try {
    console.log('\n====================================================================');
    console.log('   PROTON DURABLE WORKFLOW & ENCOUNTER STATE MACHINE VALIDATION');
    console.log('====================================================================\n');

    // -----------------------------------------------------------------
    console.log('--- SUITE 1: Schema & boot ---');
    // -----------------------------------------------------------------

    await testAsync('Migrations apply to a clean database', async () => {
      await runPostgresMigrations();
      const { rows } = await getPostgresPool().query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`
      );
      const tables = rows.map((r) => r.tablename);
      for (const required of [
        'patients',
        'appointments',
        'encounters',
        'encounter_events',
        'outbox',
        'patient_messages',
        'workflow_audit_events',
        'workflow_idempotency'
      ]) {
        assert(tables.includes(required), `missing table ${required}`);
      }
    });

    await testAsync('Migrations are idempotent (re-run does not throw)', async () => {
      await runPostgresMigrations();
    });

    await testAsync('pg-boss runtime starts on the same database', async () => {
      const result = await startWorkflowRuntime({ startScheduler: false });
      assert.strictEqual(result.enabled, true);
      assert.strictEqual(result.queue, 'workflow.outbox.dispatch');
    });

    // -----------------------------------------------------------------
    console.log('\n--- SUITE 2: Patient, booking, encounter creation ---');
    // -----------------------------------------------------------------

    await testAsync('Booking creates patient + appointment + encounter in BOOKED', async () => {
      const patient = await repo.createPatient({
        tenantId: TENANT,
        fullName: 'Eleanor Vance',
        mrn: 'MRN-WF-001',
        dateOfBirth: '1958-03-14',
        sex: 'female',
        contact: { email: 'eleanor@example.test' }
      });
      patientId = patient.id;
      assert.ok(patient.id.startsWith('pat-'));

      const encounter = await repo.withTransaction(async (client) => {
        const appointment = await repo.createAppointment(
          {
            tenantId: TENANT,
            patientId,
            clinicianId: PHYSICIAN.actorId,
            scheduledFor: new Date(Date.now() + 3600_000),
            reason: 'routine follow-up'
          },
          { client }
        );
        return repo.createEncounter(
          {
            tenantId: TENANT,
            patientId,
            appointmentId: appointment.id,
            clinicianId: PHYSICIAN.actorId,
            actor: FRONT_DESK
          },
          { client }
        );
      });

      encounterId = encounter.id;
      assert.strictEqual(encounter.state, 'BOOKED');
      assert.strictEqual(encounter.version, 1);

      const events = await repo.listEncounterEvents({ tenantId: TENANT, encounterId });
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].action, 'create');
      assert.strictEqual(events[0].to_state, 'BOOKED');
    });

    await testAsync('Encounter is invisible to another tenant', async () => {
      const other = await repo.getEncounter({ tenantId: 'org-other', encounterId });
      assert.strictEqual(other, null);
    });

    // -----------------------------------------------------------------
    console.log('\n--- SUITE 3: Legal lifecycle ---');
    // -----------------------------------------------------------------

    await testAsync('Full happy path reaches CLOSED with one event per transition', async () => {
      const path = [
        ['check_in', FRONT_DESK],
        ['start_intake', NURSE],
        ['complete_intake', NURSE],
        ['start_capture', PHYSICIAN],
        ['stop_capture', PHYSICIAN],
        ['submit_for_review', PHYSICIAN],
        ['sign', PHYSICIAN, { attestation: true }],
        ['publish_report', PHYSICIAN],
        ['schedule_follow_up', NURSE, { metadata: { dueAt: '2026-11-01' } }],
        ['complete_follow_up', PHYSICIAN]
      ];

      for (const [action, actor, extra] of path) {
        const result = await transition(encounterId, action, actor, extra || {});
        assert.strictEqual(result.event.action, action);
      }

      const encounter = await repo.getEncounter({ tenantId: TENANT, encounterId });
      assert.strictEqual(encounter.state, 'CLOSED');
      assert.ok(encounter.closed_at, 'closed_at must be set');

      const events = await repo.listEncounterEvents({ tenantId: TENANT, encounterId });
      assert.strictEqual(events.length, path.length + 1, 'creation + one event per transition');
    });

    await testAsync('Replaying the event log reproduces the stored state', async () => {
      const client = await getPostgresPool().connect();
      try {
        const replayed = await replayEncounterState(client, { tenantId: TENANT, encounterId });
        const encounter = await repo.getEncounter({ tenantId: TENANT, encounterId });
        assert.strictEqual(replayed, encounter.state);
      } finally {
        client.release();
      }
    });

    await testAsync('A terminal encounter can no longer transition', async () => {
      await assert.rejects(
        () => transition(encounterId, 'check_in', FRONT_DESK),
        (err) => err instanceof WorkflowError && ['ILLEGAL_TRANSITION', 'INVALID_STATE'].includes(err.code)
      );
    });

    // -----------------------------------------------------------------
    console.log('\n--- SUITE 4: Illegal transitions & authority ---');
    // -----------------------------------------------------------------

    // A fresh encounter for the negative cases.
    const freshEncounter = async () => {
      const encounter = await repo.createEncounter({
        tenantId: TENANT,
        patientId,
        clinicianId: PHYSICIAN.actorId,
        actor: FRONT_DESK
      });
      return encounter.id;
    };

    await testAsync('Skipping states is rejected (BOOKED cannot be signed)', async () => {
      const id = await freshEncounter();
      await assert.rejects(
        () => transition(id, 'sign', PHYSICIAN, { attestation: true }),
        (err) => err.code === 'ILLEGAL_TRANSITION' && err.status === 409
      );
    });

    await testAsync('Non-physicians cannot sign', async () => {
      const id = await freshEncounter();
      await transition(id, 'check_in', FRONT_DESK);
      await transition(id, 'start_intake', NURSE);
      await transition(id, 'complete_intake', NURSE);
      await transition(id, 'start_capture', PHYSICIAN);
      await transition(id, 'stop_capture', PHYSICIAN);
      await transition(id, 'submit_for_review', PHYSICIAN);

      await assert.rejects(
        () => transition(id, 'sign', NURSE, { attestation: true }),
        (err) => err.code === 'ROLE_NOT_PERMITTED' && err.status === 403
      );
      await assert.rejects(
        () => transition(id, 'sign', FRONT_DESK, { attestation: true }),
        (err) => err.code === 'ROLE_NOT_PERMITTED'
      );
    });

    await testAsync('Signing requires an explicit physician attestation', async () => {
      const id = await freshEncounter();
      await transition(id, 'check_in', FRONT_DESK);
      await transition(id, 'start_intake', NURSE);
      await transition(id, 'complete_intake', NURSE);
      await transition(id, 'start_capture', PHYSICIAN);
      await transition(id, 'stop_capture', PHYSICIAN);
      await transition(id, 'submit_for_review', PHYSICIAN);

      await assert.rejects(
        () => transition(id, 'sign', PHYSICIAN),
        (err) => err.code === 'ATTESTATION_REQUIRED' && err.status === 400
      );
    });

    await testAsync('Cancellation requires a reason and is refused after signing', async () => {
      const id = await freshEncounter();
      await assert.rejects(
        () => transition(id, 'cancel', FRONT_DESK),
        (err) => err.code === 'REASON_REQUIRED'
      );

      const cancelled = await transition(id, 'cancel', FRONT_DESK, { reason: 'patient requested reschedule' });
      assert.strictEqual(cancelled.nextState, 'CANCELLED');
      assert.strictEqual(cancelled.encounter.cancellation_reason, 'patient requested reschedule');

      const signedId = await freshEncounter();
      for (const [action, actor, extra] of [
        ['check_in', FRONT_DESK],
        ['start_intake', NURSE],
        ['complete_intake', NURSE],
        ['start_capture', PHYSICIAN],
        ['stop_capture', PHYSICIAN],
        ['submit_for_review', PHYSICIAN],
        ['sign', PHYSICIAN, { attestation: true }]
      ]) {
        await transition(signedId, action, actor, extra || {});
      }
      await assert.rejects(
        () => transition(signedId, 'cancel', FRONT_DESK, { reason: 'attempt after signature' }),
        (err) => err.code === 'ILLEGAL_TRANSITION'
      );
    });

    await testAsync('An unknown action is rejected, not silently ignored', async () => {
      const id = await freshEncounter();
      await assert.rejects(
        () => transition(id, 'discharge_patient', PHYSICIAN),
        (err) => err.code === 'UNKNOWN_ACTION' && err.status === 400
      );
    });

    await testAsync('Escalation records the origin state and resume returns to it', async () => {
      const id = await freshEncounter();
      await transition(id, 'check_in', FRONT_DESK);
      await transition(id, 'start_intake', NURSE);

      const escalated = await transition(id, 'escalate', NURSE, { reason: 'chest pain reported during intake' });
      assert.strictEqual(escalated.nextState, 'ESCALATED');
      assert.strictEqual(escalated.encounter.escalated_from, 'INTAKE');
      assert.strictEqual(escalated.encounter.escalation_reason, 'chest pain reported during intake');

      const resumed = await transition(id, 'resume', PHYSICIAN);
      assert.strictEqual(resumed.nextState, 'INTAKE');
      assert.strictEqual(resumed.encounter.escalated_from, null);
    });

    // -----------------------------------------------------------------
    console.log('\n--- SUITE 5: Concurrency ---');
    // -----------------------------------------------------------------

    await testAsync('Two concurrent sign attempts: exactly one succeeds', async () => {
      const id = await freshEncounter();
      for (const [action, actor, extra] of [
        ['check_in', FRONT_DESK],
        ['start_intake', NURSE],
        ['complete_intake', NURSE],
        ['start_capture', PHYSICIAN],
        ['stop_capture', PHYSICIAN],
        ['submit_for_review', PHYSICIAN]
      ]) {
        await transition(id, action, actor, extra || {});
      }

      const outcomes = await Promise.allSettled([
        transition(id, 'sign', PHYSICIAN, { attestation: true }),
        transition(id, 'sign', PHYSICIAN, { attestation: true })
      ]);

      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, `expected exactly one winner, got ${fulfilled.length}`);
      assert.strictEqual(rejected.length, 1);
      assert(['ILLEGAL_TRANSITION', 'CONCURRENT_MODIFICATION'].includes(rejected[0].reason.code));

      const encounter = await repo.getEncounter({ tenantId: TENANT, encounterId: id });
      assert.strictEqual(encounter.state, 'SIGNED');

      const signEvents = (await repo.listEncounterEvents({ tenantId: TENANT, encounterId: id })).filter(
        (e) => e.action === 'sign'
      );
      assert.strictEqual(signEvents.length, 1, 'the losing attempt must not write an event');
    });

    await testAsync('A stale expectedVersion is rejected', async () => {
      const id = await freshEncounter();
      await assert.rejects(
        () => transition(id, 'check_in', FRONT_DESK, { expectedVersion: 99 }),
        (err) => err.code === 'CONCURRENT_MODIFICATION'
      );
      const ok = await transition(id, 'check_in', FRONT_DESK, { expectedVersion: 1 });
      assert.strictEqual(ok.encounter.version, 2);
    });

    // -----------------------------------------------------------------
    console.log('\n--- SUITE 6: Transactional outbox ---');
    // -----------------------------------------------------------------

    let signOutbox = [];

    await testAsync('Transitions queue outbox rows in the same transaction', async () => {
      const id = await freshEncounter();
      for (const [action, actor, extra] of [
        ['check_in', FRONT_DESK],
        ['start_intake', NURSE],
        ['complete_intake', NURSE],
        ['start_capture', PHYSICIAN],
        ['stop_capture', PHYSICIAN],
        ['submit_for_review', PHYSICIAN]
      ]) {
        await transition(id, action, actor, extra || {});
      }
      const signed = await transition(id, 'sign', PHYSICIAN, { attestation: true });

      const rows = await repo.listOutbox({ tenantId: TENANT, encounterId: id, status: 'PENDING' });
      signOutbox = rows;
      assert(rows.length >= 3, `expected check-in (2) + sign (1) rows, got ${rows.length}`);
      assert(signed.outbox.some((r) => r.template === 'ENCOUNTER_SIGNED'));
    });

    await testAsync('A rolled-back transition leaves no outbox row', async () => {
      const id = await freshEncounter();
      const before = (await repo.listOutbox({ tenantId: TENANT, encounterId: id })).length;

      await assert.rejects(() =>
        repo.withTransaction(async (client) => {
          await transitionEncounter(client, {
            tenantId: TENANT,
            encounterId: id,
            action: 'check_in',
            actor: FRONT_DESK
          });
          throw new Error('simulated failure after state change');
        })
      );

      const encounter = await repo.getEncounter({ tenantId: TENANT, encounterId: id });
      assert.strictEqual(encounter.state, 'BOOKED', 'state change must roll back');
      assert.strictEqual(
        (await repo.listOutbox({ tenantId: TENANT, encounterId: id })).length,
        before,
        'outbox row must roll back with the state change'
      );

      const events = await repo.listEncounterEvents({ tenantId: TENANT, encounterId: id });
      assert.strictEqual(events.length, 1, 'no transition event may survive a rollback');
    });

    await testAsync('Dispatcher delivers IN_APP for real and flags EMAIL as simulated', async () => {
      const summary = await dispatchDueOutbox({ limit: 100 });
      assert(summary.dispatched > 0, 'expected at least one dispatch');

      const all = await repo.listOutbox({ tenantId: TENANT, encounterId: signOutbox[0].encounter_id });
      const inApp = all.filter((r) => r.channel === 'IN_APP');
      const email = all.filter((r) => r.channel === 'EMAIL');

      assert(inApp.length > 0 && inApp.every((r) => r.status === 'DISPATCHED'));
      assert(inApp.every((r) => r.simulated === false), 'IN_APP is a real delivery');
      assert(email.length > 0 && email.every((r) => r.status === 'DISPATCHED'));
      assert(email.every((r) => r.simulated === true), 'EMAIL must be reported as simulated');

      const messages = await repo.listPatientMessages({ tenantId: TENANT, patientId });
      assert(messages.length > 0, 'in-app delivery must create a patient-readable message');
      assert(messages.some((m) => /reviewed and signed/i.test(m.body)));
    });

    await testAsync('Dispatch is idempotent: a second drain sends nothing new', async () => {
      const before = await repo.listOutbox({ tenantId: TENANT, status: 'DISPATCHED' });
      const summary = await dispatchDueOutbox({ limit: 100 });
      const after = await repo.listOutbox({ tenantId: TENANT, status: 'DISPATCHED' });
      assert.strictEqual(summary.claimed, 0, 'no PENDING rows should remain');
      assert.strictEqual(after.length, before.length);
    });

    // -----------------------------------------------------------------
    console.log('\n--- SUITE 7: Audit chain ---');
    // -----------------------------------------------------------------

    await testAsync('The workflow audit chain verifies', async () => {
      const result = await verifyWorkflowAuditChain({ tenantId: TENANT });
      assert.strictEqual(result.valid, true, result.error);
      assert(result.totalEventsVerified >= 10);
    });

    await testAsync('Tampering with an audit row is detected', async () => {
      const events = await listWorkflowAuditEvents({ tenantId: TENANT, limit: 500 });
      const target = events[Math.floor(events.length / 2)];

      await getPostgresPool().query(`UPDATE workflow_audit_events SET summary = 'tampered summary' WHERE seq = $1;`, [
        target.seq
      ]);

      const broken = await verifyWorkflowAuditChain({ tenantId: TENANT });
      assert.strictEqual(broken.valid, false);
      assert.strictEqual(broken.brokenAtSeq, Number(target.seq));

      await getPostgresPool().query(`UPDATE workflow_audit_events SET summary = $1 WHERE seq = $2;`, [
        target.summary,
        target.seq
      ]);

      const repaired = await verifyWorkflowAuditChain({ tenantId: TENANT });
      assert.strictEqual(repaired.valid, true, repaired.error);
    });

    await testAsync('Deleting an audit row is detected', async () => {
      const before = await listWorkflowAuditEvents({ tenantId: TENANT, limit: 500 });
      const victim = before[1];

      await getPostgresPool().query(`DELETE FROM workflow_audit_events WHERE seq = $1;`, [victim.seq]);
      const broken = await verifyWorkflowAuditChain({ tenantId: TENANT });
      assert.strictEqual(broken.valid, false, 'a gap must invalidate the chain');

      // The chain is append-only by contract; restore the row so later suites
      // start from an intact chain (the row content is unchanged).
      await getPostgresPool().query(
        `INSERT INTO workflow_audit_events
           (seq, id, tenant_id, encounter_id, action, actor_id, actor_role,
            from_state, to_state, summary, occurred_at, prev_hash, current_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13);`,
        [
          victim.seq,
          victim.id,
          victim.tenant_id,
          victim.encounter_id,
          victim.action,
          victim.actor_id,
          victim.actor_role,
          victim.from_state,
          victim.to_state,
          victim.summary,
          victim.occurred_at,
          victim.prev_hash,
          victim.current_hash
        ]
      );

      const restored = await verifyWorkflowAuditChain({ tenantId: TENANT });
      assert.strictEqual(restored.valid, true, restored.error);
    });

    // -----------------------------------------------------------------
    console.log('\n--- SUITE 8: Restart survival ---');
    // -----------------------------------------------------------------

    let observedBeforeRestart;

    await testAsync('State and pending work survive a full runtime restart', async () => {
      const id = await freshEncounter();
      await transition(id, 'check_in', FRONT_DESK);

      const appointment = await repo.listAppointments({ tenantId: TENANT });
      assert(appointment.length > 0);

      const before = await repo.getEncounter({ tenantId: TENANT, encounterId: id });
      const pendingBefore = await repo.listOutbox({ tenantId: TENANT, encounterId: id, status: 'PENDING' });
      assert(pendingBefore.length >= 1, 'check-in must queue a message');

      observedBeforeRestart = { state: before.state, version: before.version, pending: pendingBefore.length };

      // Simulate a process restart: stop workers, drop every pooled connection.
      await stopWorkflowRuntime();
      await closePostgresPool();

      const reopened = await startWorkflowRuntime({ startScheduler: false });
      assert.strictEqual(reopened.enabled, true);
    });

    await testAsync('After restart the encounter resumes from the same state', async () => {
      const encounters = await repo.listEncounters({ tenantId: TENANT, limit: 100 });
      const stillThere = encounters.find((e) => e.state === 'CHECKED_IN');
      assert(stillThere, 'the CHECKED_IN encounter must still exist');
      assert.strictEqual(stillThere.state, observedBeforeRestart.state);

      const pending = await repo.listOutbox({ tenantId: TENANT, encounterId: stillThere.id, status: 'PENDING' });
      assert.strictEqual(pending.length, observedBeforeRestart.pending, 'pending messages must survive restart');

      // And the surviving work is actually processed by the restarted dispatcher.
      const summary = await dispatchDueOutbox({ limit: 100 });
      assert(summary.dispatched >= observedBeforeRestart.pending);
    });

    await testAsync('The audit chain still verifies after restart', async () => {
      const result = await verifyWorkflowAuditChain({ tenantId: TENANT });
      assert.strictEqual(result.valid, true, result.error);
    });

    // -----------------------------------------------------------------
    console.log('\n--- SUITE 9: Idempotency ---');
    // -----------------------------------------------------------------

    await testAsync('Replaying the same Idempotency-Key returns the stored response', async () => {
      const id = await freshEncounter();
      const key = `idem-${Date.now()}`;
      const requestHash = require('../services/workflow/encounterStateMachine').buildIdempotencyFingerprint({
        action: 'check_in',
        actorId: FRONT_DESK.actorId,
        reason: null
      });

      const first = await repo.withTransaction(async (client) => {
        const result = await transitionEncounter(client, {
          tenantId: TENANT,
          encounterId: id,
          action: 'check_in',
          actor: FRONT_DESK
        });
        const body = { nextState: result.nextState };
        await repo.putWorkflowIdempotentResponse(
          { tenantId: TENANT, key, requestHash, status: 200, body },
          { client }
        );
        return body;
      });

      const replay = await repo.getWorkflowIdempotentResponse({ tenantId: TENANT, key, requestHash });
      assert(replay, 'stored response must be found');
      assert.strictEqual(replay.response_status, 200);
      assert.deepStrictEqual(replay.response_body, first);

      await assert.rejects(
        () => repo.getWorkflowIdempotentResponse({ tenantId: TENANT, key, requestHash: 'different-payload' }),
        (err) => err.code === 'IDEMPOTENCY_KEY_REUSED'
      );
    });

    // -----------------------------------------------------------------
    console.log('\n--- SUITE 10: State machine completeness ---');
    // -----------------------------------------------------------------

    await testAsync('Every declared state is reachable from BOOKED', async () => {
      const { TRANSITIONS } = require('../services/workflow/encounterStateMachine');
      const reachable = new Set(['BOOKED']);
      let changed = true;
      while (changed) {
        changed = false;
        for (const t of TRANSITIONS) {
          if (t.from.some((s) => reachable.has(s))) {
            const target = t.to === 'PREVIOUS' ? null : t.to;
            if (target && !reachable.has(target)) {
              reachable.add(target);
              changed = true;
            }
          }
        }
      }
      for (const state of ENCOUNTER_STATES) {
        assert(reachable.has(state), `state ${state} is unreachable`);
      }
    });

    await testAsync('Only physicians hold the sign permission', async () => {
      const { TRANSITIONS } = require('../services/workflow/encounterStateMachine');
      const sign = TRANSITIONS.find((t) => t.action === 'sign');
      assert.deepStrictEqual(sign.roles, ['physician']);
      assert.strictEqual(sign.requiresAttestation, true);
    });
  } finally {
    await stopWorkflowRuntime();
    await closePostgresPool().catch(() => {});
  }

  console.log('\n====================================================================');
  console.log(`   WORKFLOW VALIDATION: ${passCount}/${passCount + failCount} passed`);
  if (failCount > 0) console.log(`   ${failCount} FAILED`);
  console.log('====================================================================\n');

  process.exit(failCount === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('Workflow validation crashed:', err);
  process.exit(1);
});
