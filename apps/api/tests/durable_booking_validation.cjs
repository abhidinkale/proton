/**
 * Durable booking validation.
 *
 * Proves the patient-facing booking route creates real rows instead of the
 * fabricated `apt-${Date.now()}` response it used to return:
 *   - appointment persisted and visible in the clinician schedule
 *   - encounter opened in BOOKED with an event trail
 *   - replay is idempotent
 *   - impossible bookings are rejected (no guessed times, no invented patients)
 *   - when the workflow database is disabled, the route says so (503) instead
 *     of pretending to book.
 *
 * Requires PostgreSQL (same skip policy as the workflow suites).
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
    suiteFile: 'durable_booking_validation.cjs',
    testDbName: process.env.PROTON_TEST_BOOKING_DB || 'proton_ops_booking_test'
  });
  if (!target) process.exit(0);

  const { runPostgresMigrations, closePostgresPool } = require('../storage/postgresDb');
  await runPostgresMigrations();

  const app = require('../app');
  const { stopWorkflowRuntime } = require('../services/workflow/runtime');

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const post = (path, body, headers = {}) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });

  const MD = { 'x-proton-dev-persona': 'physician-lin' };
  const scheduledFor = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  // Patient identity now comes from a signed session, never from the body.
  // Mint a synthetic patient token exactly as the app does.
  const SELF_PATIENT_ID = 'pat-synthetic-a';
  const devSession = await fetch(`${baseUrl}/api/patient/auth/dev-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId: SELF_PATIENT_ID })
  });
  const devBody = await devSession.json();
  assert.ok(devBody.token, `dev-session failed: ${devSession.status} ${JSON.stringify(devBody)}`);
  const PATIENT_AUTH = { Authorization: `Bearer ${devBody.token}` };

  // A second identity, used to prove one patient cannot act as another.
  const devSessionB = await fetch(`${baseUrl}/api/patient/auth/dev-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId: 'pat-synthetic-b' })
  });
  const PATIENT_AUTH_B = { Authorization: `Bearer ${(await devSessionB.json()).token}` };

  const bookingBody = {
    scheduledFor,
    durationMinutes: 30,
    reason: 'Persistent morning cough',
    patient: {
      fullName: 'Maya Okafor',
      dateOfBirth: '1991-04-12',
      sex: 'female',
      contact: { phone: '+15550100', email: 'maya@example.test' }
    }
  };

  let firstAppointmentId = null;
  let firstEncounterId = null;

  await testAsync('Booking persists a real appointment + encounter', async () => {
    const res = await post('/api/patient/appointment-booking', bookingBody, {
      'Idempotency-Key': 'booking-test-1',
      ...PATIENT_AUTH
    });
    const body = await res.json();
    assert.strictEqual(res.status, 201, `expected 201, got ${res.status}: ${JSON.stringify(body)}`);
    assert.ok(body.appointmentId.startsWith('apt-'), 'appointment id must be a persisted id');
    assert.ok(body.encounterId.startsWith('enc-'), 'encounter must be created with the booking');
    assert.strictEqual(body.status, 'BOOKED');
    assert.strictEqual(body.patientId, SELF_PATIENT_ID);
    assert.strictEqual(body.createdPatient, true);
    assert.strictEqual(new Date(body.scheduledFor).getTime(), new Date(scheduledFor).getTime());
    firstAppointmentId = body.appointmentId;
    firstEncounterId = body.encounterId;
  });

  await testAsync('The clinician schedule lists the booked appointment', async () => {
    const res = await fetch(`${baseUrl}/api/workflow/appointments`, { headers: MD });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    const found = body.appointments.find((a) => a.id === firstAppointmentId);
    assert.ok(found, 'appointment must appear in the workflow schedule');
    assert.strictEqual(found.patient_name, 'Maya Okafor');
    assert.strictEqual(found.status, 'BOOKED');
  });

  await testAsync('The encounter opens in BOOKED with a create event', async () => {
    const res = await fetch(`${baseUrl}/api/workflow/encounters/${firstEncounterId}/events`, { headers: MD });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.encounter.state, 'BOOKED');
    assert.strictEqual(body.encounter.appointment_id, firstAppointmentId);
    assert.strictEqual(body.events.length, 1);
    assert.strictEqual(body.events[0].action, 'create');
    assert.strictEqual(body.events[0].to_state, 'BOOKED');
  });

  await testAsync('Replaying the same booking is idempotent', async () => {
    const res = await post('/api/patient/appointment-booking', bookingBody, {
      'Idempotency-Key': 'booking-test-1',
      ...PATIENT_AUTH
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200, `expected 200 replay, got ${res.status}`);
    assert.strictEqual(body.idempotent, true);
    assert.strictEqual(body.appointmentId, firstAppointmentId);
    assert.strictEqual(body.encounterId, firstEncounterId);
  });

  await testAsync('A booking without an explicit time is rejected, not guessed', async () => {
    const res = await post('/api/patient/appointment-booking', { reason: 'Cough' }, PATIENT_AUTH);
    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.code, 'SCHEDULED_FOR_REQUIRED');
  });

  await testAsync('A past appointment is rejected', async () => {
    const res = await post(
      '/api/patient/appointment-booking',
      { scheduledFor: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
      PATIENT_AUTH
    );
    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.code, 'SCHEDULED_FOR_IN_PAST');
  });

  await testAsync('A booking with no patient session is rejected', async () => {
    const res = await post('/api/patient/appointment-booking', { scheduledFor });
    const body = await res.json();
    assert.strictEqual(res.status, 401);
    assert.strictEqual(body.code, 'PATIENT_AUTH_REQUIRED');
  });

  await testAsync('A patient cannot book on behalf of another patient', async () => {
    // Identity is the session. A body-supplied patientId that differs must be a
    // hard 403, not a silent switch to the other person's record.
    const res = await post(
      '/api/patient/appointment-booking',
      { patientId: 'pat-synthetic-b', scheduledFor },
      PATIENT_AUTH
    );
    const body = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(body.code, 'PATIENT_SCOPE_VIOLATION');
  });

  await testAsync('Disabled persistence returns 503, not a fake confirmation', async () => {
    const original = process.env.WORKFLOW_PERSISTENCE;
    process.env.WORKFLOW_PERSISTENCE = 'disabled';
    try {
      const res = await post('/api/patient/appointment-booking', bookingBody, PATIENT_AUTH);
      const body = await res.json();
      assert.strictEqual(res.status, 503);
      assert.strictEqual(body.code, 'DURABLE_BOOKING_UNAVAILABLE');
      assert.strictEqual(body.appointmentId, undefined);
    } finally {
      if (original === undefined) delete process.env.WORKFLOW_PERSISTENCE;
      else process.env.WORKFLOW_PERSISTENCE = original;
    }
  });

  console.log(`\n${'='.repeat(68)}`);
  console.log(`   DURABLE BOOKING VALIDATION: ${passCount}/${passCount + failCount} passed`);
  console.log(`${'='.repeat(68)}\n`);

  await new Promise((resolve) => server.close(resolve));
  await stopWorkflowRuntime().catch(() => {});
  await closePostgresPool().catch(() => {});

  if (failCount > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nDurable booking validation FAILED');
  console.error(err);
  process.exit(1);
});
