/**
 * Proton Workflow API Validation
 *
 * Exercises the HTTP surface mounted at /api/workflow, not just the service
 * layer: tenant scoping, role enforcement, idempotent replay, error codes and
 * the fail-closed auth boundary.
 *
 * Requires PostgreSQL (see workflow_state_machine_validation.cjs for the
 * local/CI skip policy).
 */

const assert = require('assert');
const { prepareSuite } = require('./helpers/postgresTestHarness.cjs');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PROTON_SYNTHETIC_MODE = 'true';

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
  }
}

async function run() {
  const target = await prepareSuite({
    suiteFile: 'workflow_api_validation.cjs',
    testDbName: process.env.PROTON_TEST_API_DB || 'proton_ops_api_test'
  });
  if (!target) {
    process.exit(0);
  }

  const { runPostgresMigrations, closePostgresPool, getPostgresPool } = require('../storage/postgresDb');
  await runPostgresMigrations();

  const app = require('../app');
  const { stopWorkflowRuntime } = require('../services/workflow/runtime');

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const OPS = { 'x-proton-dev-persona': 'ops-staff-marcus' };
  const MD = { 'x-proton-dev-persona': 'physician-lin' };
  const EXTERNAL = { 'x-proton-dev-persona': 'external-physician' };

  const request = (path, { method = 'GET', body, headers = {} } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });

  let patientId;
  let encounterId;

  try {
    console.log('\n====================================================================');
    console.log('   PROTON WORKFLOW API VALIDATION');
    console.log('====================================================================\n');

    // -----------------------------------------------------------------
    console.log('--- SUITE 1: Auth boundary ---');
    // -----------------------------------------------------------------

    await testAsync('Workflow endpoints reject anonymous traffic when synthetic mode is off', async () => {
      process.env.PROTON_SYNTHETIC_MODE = 'false';
      try {
        const res = await request('/api/workflow/encounters');
        assert.strictEqual(res.status, 401);
        const body = await res.json();
        assert.strictEqual(body.code, 'AUTHENTICATION_REQUIRED');
      } finally {
        process.env.PROTON_SYNTHETIC_MODE = 'true';
      }
    });

    await testAsync('Reference data lists the full state machine', async () => {
      const res = await request('/api/workflow/states', { headers: MD });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert(body.states.includes('PENDING_REVIEW'));
      assert(body.transitions.some((t) => t.action === 'sign' && t.requiresAttestation));
    });

    // -----------------------------------------------------------------
    console.log('\n--- SUITE 2: Booking ---');
    // -----------------------------------------------------------------

    await testAsync('Create a patient', async () => {
      const res = await request('/api/workflow/patients', {
        method: 'POST',
        headers: OPS,
        body: {
          fullName: 'Arthur Pendelton',
          mrn: 'MRN-API-001',
          dateOfBirth: '1961-07-02',
          sex: 'male',
          contact: { email: 'arthur@example.test' }
        }
      });
      assert.strictEqual(res.status, 201);
      const body = await res.json();
      patientId = body.patient.id;
      assert.ok(patientId);
    });

    await testAsync('Patient creation is idempotent by MRN', async () => {
      const res = await request('/api/workflow/patients', {
        method: 'POST',
        headers: OPS,
        body: { fullName: 'Arthur Pendelton', mrn: 'MRN-API-001' }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.created, false);
      assert.strictEqual(body.patient.id, patientId);
    });

    await testAsync('Booking rejects a missing patient', async () => {
      const res = await request('/api/workflow/appointments', {
        method: 'POST',
        headers: OPS,
        body: {
          patientId: 'pat-does-not-exist',
          clinicianId: 'usr-md-lin-01',
          scheduledFor: new Date(Date.now() + 86400_000).toISOString()
        }
      });
      assert.strictEqual(res.status, 404);
      const body = await res.json();
      assert.strictEqual(body.code, 'PATIENT_NOT_FOUND');
    });

    await testAsync('Booking validates the scheduled time', async () => {
      const res = await request('/api/workflow/appointments', {
        method: 'POST',
        headers: OPS,
        body: { patientId, clinicianId: 'usr-md-lin-01', scheduledFor: 'not-a-date' }
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.code, 'VALIDATION_ERROR');
    });

    await testAsync('Booking creates the encounter and is idempotent on replay', async () => {
      const payload = {
        patientId,
        clinicianId: 'usr-md-lin-01',
        scheduledFor: new Date(Date.now() + 86400_000).toISOString(),
        reason: 'new patient consultation',
        durationMinutes: 30
      };

      const first = await request('/api/workflow/appointments', {
        method: 'POST',
        headers: { ...OPS, 'Idempotency-Key': 'booking-key-1' },
        body: payload
      });
      assert.strictEqual(first.status, 201);
      const firstBody = await first.json();
      encounterId = firstBody.encounter.id;
      assert.strictEqual(firstBody.encounter.state, 'BOOKED');
      assert.strictEqual(firstBody.appointment.status, 'BOOKED');

      const replay = await request('/api/workflow/appointments', {
        method: 'POST',
        headers: { ...OPS, 'Idempotency-Key': 'booking-key-1' },
        body: payload
      });
      assert.strictEqual(replay.status, 201);
      assert.strictEqual(replay.headers.get('idempotent-replay'), 'true');
      const replayBody = await replay.json();
      assert.strictEqual(replayBody.encounter.id, encounterId, 'replay must not create a second encounter');
    });

    // -----------------------------------------------------------------
    console.log('\n--- SUITE 3: Transitions over HTTP ---');
    // -----------------------------------------------------------------

    const transition = (action, { headers = MD, body = {} } = {}) =>
      request(`/api/workflow/encounters/${encounterId}/transitions`, {
        method: 'POST',
        headers,
        body: { action, ...body }
      });

    await testAsync('An illegal transition returns 409 with the allowed states', async () => {
      const res = await transition('sign', { body: { attestation: true } });
      assert.strictEqual(res.status, 409);
      const body = await res.json();
      assert.strictEqual(body.code, 'ILLEGAL_TRANSITION');
      assert.deepStrictEqual(body.details.allowedFrom, ['PENDING_REVIEW']);
    });

    await testAsync('Front desk can check the patient in', async () => {
      const res = await transition('check_in', { headers: OPS });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.nextState, 'CHECKED_IN');
      assert(body.outbox.length >= 1, 'check-in must queue messages');
    });

    await testAsync('Moving the encounter forward to PENDING_REVIEW', async () => {
      for (const [action, headers] of [
        ['start_intake', OPS],
        ['complete_intake', OPS],
        ['start_capture', MD],
        ['stop_capture', MD],
        ['submit_for_review', MD]
      ]) {
        const res = await transition(action, { headers });
        assert.strictEqual(res.status, 200, `${action} failed: ${await res.text()}`);
      }
      const res = await request(`/api/workflow/encounters/${encounterId}`, { headers: MD });
      const body = await res.json();
      assert.strictEqual(body.encounter.state, 'PENDING_REVIEW');
      assert.strictEqual(body.encounter.version, 7);
    });

    await testAsync('Operations staff cannot sign a clinical encounter (403)', async () => {
      const res = await transition('sign', { headers: OPS, body: { attestation: true } });
      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.code, 'ROLE_NOT_PERMITTED');
      assert.deepStrictEqual(body.details.requiredRoles, ['physician']);
    });

    await testAsync('Signing without an attestation is rejected (400)', async () => {
      const res = await transition('sign');
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.code, 'ATTESTATION_REQUIRED');
    });

    await testAsync('A physician signs the encounter', async () => {
      // Signing is content-bound: a note_v1 note must exist first. Inserting it
      // directly is the honest fixture, because the cockpit's draft path is a
      // separate suite; this suite proves the sign contract.
      const { NOTE_V1 } = require('./fixtures/noteV1.cjs');
      await getPostgresPool().query(
        `INSERT INTO notes (id, tenant_id, encounter_id, author_actor_id, status, content)
         VALUES ('note-api-1', 'org-default', $1, 'usr-md-lin-01', 'PENDING_REVIEW', $2::jsonb);`,
        [encounterId, JSON.stringify(NOTE_V1)]
      );

      const res = await transition('sign', { body: { attestation: true } });
      assert.strictEqual(res.status, 200, await res.clone().text());
      const body = await res.json();
      assert.strictEqual(body.nextState, 'SIGNED');
      assert.strictEqual(body.encounter.state, 'SIGNED');
      assert.strictEqual(body.event.actor_role, 'physician');
      assert(body.attestation?.id, 'sign must return an attestation id');
      assert.match(body.attestation.content_hash, /^sha256:[0-9a-f]{64}$/);
    });

    await testAsync('The attestation verifies over HTTP', async () => {
      const res = await request(`/api/workflow/encounters/${encounterId}/attestation`, { headers: MD });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.valid, true);
      assert.strictEqual(body.content.note.note_id, 'note-api-1');
    });

    await testAsync('Re-signing a signed encounter is refused (409)', async () => {
      const res = await transition('sign', { body: { attestation: true } });
      assert.strictEqual(res.status, 409);
      const body = await res.json();
      assert.strictEqual(body.code, 'ILLEGAL_TRANSITION');
    });

    await testAsync('An unknown encounter returns 404', async () => {
      const res = await request('/api/workflow/encounters/enc-nope/transitions', {
        method: 'POST',
        headers: MD,
        body: { action: 'check_in' }
      });
      assert.strictEqual(res.status, 404);
      const body = await res.json();
      assert.strictEqual(body.code, 'ENCOUNTER_NOT_FOUND');
    });

    await testAsync('Cross-tenant access returns 404, not another tenant data', async () => {
      const res = await request(`/api/workflow/encounters/${encounterId}`, { headers: EXTERNAL });
      assert.strictEqual(res.status, 404);
    });

    // -----------------------------------------------------------------
    console.log('\n--- SUITE 4: Read models ---');
    // -----------------------------------------------------------------

    await testAsync('Event log exposes the transition history', async () => {
      const res = await request(`/api/workflow/encounters/${encounterId}/events`, { headers: MD });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.events.length, 8);
      assert.strictEqual(body.events[0].action, 'create');
      assert.deepStrictEqual(
        body.events.map((e) => e.sequence),
        [1, 2, 3, 4, 5, 6, 7, 8]
      );
    });

    await testAsync('Replay endpoint confirms the log reproduces stored state', async () => {
      const res = await request(`/api/workflow/encounters/${encounterId}/replay`, { headers: MD });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.consistent, true);
      assert.strictEqual(body.replayedState, 'SIGNED');
    });

    // -----------------------------------------------------------------
    console.log('\n--- SUITE 5: Outbox & audit ---');
    // -----------------------------------------------------------------

    await testAsync('Outbox dispatch is restricted to permitted roles', async () => {
      const res = await request('/api/workflow/outbox/dispatch', {
        method: 'POST',
        headers: OPS,
        body: { limit: 10 }
      });
      assert.strictEqual(res.status, 200);

      // The agent persona is not permitted.
      const denied = await request('/api/workflow/outbox/dispatch', {
        method: 'POST',
        headers: { 'x-proton-dev-persona': 'agent-connect' },
        body: { limit: 10 }
      });
      assert.strictEqual(denied.status, 403);
    });

    await testAsync('All queued messages were dispatched, email flagged simulated', async () => {
      const res = await request(`/api/workflow/encounters/${encounterId}/outbox`, { headers: MD });
      const body = await res.json();
      assert(body.outbox.length >= 3);
      assert(body.outbox.every((row) => row.status === 'DISPATCHED'));
      assert(body.outbox.filter((row) => row.channel === 'EMAIL').every((row) => row.simulated === true));
      assert(body.outbox.filter((row) => row.channel === 'IN_APP').every((row) => row.simulated === false));
    });

    await testAsync('The patient inbox contains the delivered messages', async () => {
      const res = await request(`/api/workflow/patients/${patientId}/messages`, { headers: MD });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert(body.messages.length >= 2);
    });

    await testAsync('The workflow audit chain verifies over HTTP', async () => {
      const res = await request('/api/workflow/audit/verify', { headers: MD });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.valid, true, body.error);
      assert(body.totalEventsVerified >= 8);
    });

    await testAsync('The audit listing is tenant-scoped and readable by the physician', async () => {
      const res = await request(`/api/workflow/audit?encounterId=${encounterId}`, { headers: MD });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert(body.events.length >= 7);
      assert(body.events.every((e) => e.encounter_id === encounterId));

      const denied = await request('/api/workflow/audit', {
        headers: { 'x-proton-dev-persona': 'agent-connect' }
      });
      assert.strictEqual(denied.status, 403);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await stopWorkflowRuntime();
    await closePostgresPool().catch(() => {});
  }

  console.log('\n====================================================================');
  console.log(`   WORKFLOW API VALIDATION: ${passCount}/${passCount + failCount} passed`);
  if (failCount > 0) console.log(`   ${failCount} FAILED`);
  console.log('====================================================================\n');

  process.exit(failCount === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('Workflow API validation crashed:', err);
  process.exit(1);
});
