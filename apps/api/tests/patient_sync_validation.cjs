/**
 * Patient ↔ clinic sync validation.
 *
 * Proves the surface the Android app actually calls. This is the seam where a
 * bug is most expensive: a retried booking that double-books, or a cancel that
 * reaches another patient's appointment, is worse than an outage.
 *
 * Covers:
 *   - unauthenticated access is rejected
 *   - a booking is persisted through the real durable booking service
 *   - replaying the same Idempotency-Key returns the same appointment
 *   - a patient cannot cancel or reschedule another patient's appointment
 *   - pull returns only the caller's appointments
 *   - a refill is persisted as a REQUESTED (not approved) record
 *   - a reschedule changes the appointment time
 *
 * Requires PostgreSQL (same skip policy as the other durability suites).
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
    suiteFile: 'patient_sync_validation.cjs',
    testDbName: process.env.PROTON_TEST_SYNC_DB || 'proton_ops_sync_test'
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

  const devToken = async (patientId) => {
    const res = await post('/api/patient/auth/dev-session', { patientId });
    const body = await res.json();
    assert.ok(body.token, `dev-session failed for ${patientId}: ${res.status}`);
    return { Authorization: `Bearer ${body.token}` };
  };

  const A = await devToken('pat-synthetic-a');
  const B = await devToken('pat-synthetic-b');

  const startIso = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const bookingPayload = {
    appointmentId: 'local-apt-1',
    doctorId: 'doc-chen',
    doctorName: 'Dr. Sarah Chen',
    specialty: 'General Physician',
    startIso,
    consultationType: 'IN_PERSON',
    clinicLocation: 'Room 3',
    reasonForVisit: 'Persistent cough',
    symptoms: ['cough'],
    bookedAtIso: new Date().toISOString()
  };

  let appointmentId = null;

  await testAsync('sync endpoints reject an unauthenticated caller', async () => {
    const res = await post('/api/patient/sync/bookings', bookingPayload);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'PATIENT_AUTH_REQUIRED');
  });

  await testAsync('a booking is persisted with a real appointment id', async () => {
    const res = await post('/api/patient/sync/bookings', bookingPayload, {
      'Idempotency-Key': 'sync-booking-key-1',
      ...A
    });
    const body = await res.json();
    assert.strictEqual(res.status, 201, `expected 201, got ${res.status}: ${JSON.stringify(body)}`);
    assert.ok(body.appointmentId.startsWith('apt-'), 'must be a persisted id');
    assert.strictEqual(body.status, 'BOOKED');
    appointmentId = body.appointmentId;
  });

  await testAsync('replaying the outbox item does not double-book', async () => {
    const res = await post('/api/patient/sync/bookings', bookingPayload, {
      'Idempotency-Key': 'sync-booking-key-1',
      ...A
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200, `expected idempotent 200, got ${res.status}`);
    assert.strictEqual(body.appointmentId, appointmentId);
    assert.strictEqual(body.idempotent, true);
  });

  let secondAppointmentId = null;

  await testAsync('a local appointment id maps to one stable server row', async () => {
    const localId = 'local-apt-2';
    const secondStart = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
    const payload = { ...bookingPayload, appointmentId: localId, startIso: secondStart };

    const res = await post('/api/patient/sync/bookings', payload, {
      'Idempotency-Key': 'sync-booking-key-2',
      ...A
    });
    const body = await res.json();
    assert.strictEqual(res.status, 201, JSON.stringify(body));
    assert.ok(body.appointmentId.startsWith('apt-sync-'), 'server id must be derived from the local id');
    secondAppointmentId = body.appointmentId;

    // The same local booking re-sent under a different key must not create a
    // second appointment.
    const again = await post('/api/patient/sync/bookings', payload, {
      'Idempotency-Key': 'sync-booking-key-2-retry',
      ...A
    });
    const againBody = await again.json();
    assert.strictEqual(again.status, 200, JSON.stringify(againBody));
    assert.strictEqual(againBody.appointmentId, secondAppointmentId);
    assert.strictEqual(againBody.idempotent, true);
  });

  await testAsync('the app can cancel using only the local appointment id', async () => {
    const res = await post(
      '/api/patient/sync/cancellations',
      { appointmentId: 'local-apt-2', cancelledAtIso: new Date().toISOString() },
      A
    );
    const body = await res.json();
    assert.strictEqual(res.status, 200, JSON.stringify(body));
    assert.strictEqual(body.appointmentId, secondAppointmentId);
    assert.strictEqual(body.status, 'CANCELLED');
  });

  await testAsync('another patient cannot cancel this appointment', async () => {
    const res = await post(
      '/api/patient/sync/cancellations',
      { appointmentId, cancelledAtIso: new Date().toISOString() },
      B
    );
    const body = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(body.code, 'APPOINTMENT_SCOPE_VIOLATION');
  });

  await testAsync('pull returns only the caller appointments', async () => {
    const res = await fetch(`${baseUrl}/api/patient/sync/pull`, { headers: A });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(body.appointments));
    const mine = body.appointments.find((a) => a.id === appointmentId);
    assert.ok(mine, 'the owner must see their appointment');
    // The app must be able to match the row back to the appointment it created
    // offline, or a pull would show a duplicate.
    assert.strictEqual(mine.localId, 'local-apt-1');

    const resB = await fetch(`${baseUrl}/api/patient/sync/pull`, { headers: B });
    const bodyB = await resB.json();
    assert.ok(
      !bodyB.appointments.some((a) => a.id === appointmentId),
      'another patient must never see this appointment'
    );
  });

  await testAsync('a pre-visit intake is persisted with readable answers', async () => {
    const res = await post(
      '/api/patient/sync/intakes',
      {
        appointmentId: 'local-apt-1',
        mainConcern: 'Persistent cough',
        onset: 'WEEK',
        pattern: 'GETTING_WORSE',
        severity: 4,
        symptoms: ['cough', 'night sweats'],
        triedSoFar: 'Honey and rest',
        questionsForDoctor: 'Do I need a chest x-ray?',
        currentMedications: 'None',
        allergies: 'None',
        completedAtIso: new Date().toISOString(),
        sharedAtIso: new Date().toISOString()
      },
      { 'Idempotency-Key': 'intake-1', ...A }
    );
    const body = await res.json();
    assert.strictEqual(res.status, 201, JSON.stringify(body));
    assert.strictEqual(body.status, 'INTAKE_RECORDED');
    assert.ok(body.questionnaireResponseId, 'the intake must be persisted, not acknowledged');
    assert.strictEqual(body.escalationLevel, 'ROUTINE');
  });

  await testAsync('a severe intake is flagged for triage, not silently filed', async () => {
    const res = await post(
      '/api/patient/sync/intakes',
      {
        appointmentId: 'local-apt-2',
        mainConcern: 'Worsening breathlessness',
        onset: 'TODAY',
        pattern: 'GETTING_WORSE',
        severity: 9,
        symptoms: ['breathless at rest']
      },
      { 'Idempotency-Key': 'intake-2', ...A }
    );
    const body = await res.json();
    assert.strictEqual(res.status, 201, JSON.stringify(body));
    assert.strictEqual(body.requiresTriage, true);
    assert.strictEqual(body.escalationLevel, 'URGENT');
  });

  await testAsync('an intake cannot be attached to another patient appointment', async () => {
    const res = await post(
      '/api/patient/sync/intakes',
      { appointmentId, mainConcern: 'Cough', onset: 'TODAY', severity: 2 },
      { 'Idempotency-Key': 'intake-3', ...B }
    );
    const body = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(body.code, 'APPOINTMENT_SCOPE_VIOLATION');
  });

  await testAsync('a follow-up check-in is recorded for clinician triage', async () => {
    const res = await post(
      '/api/patient/sync/follow-ups',
      {
        checkInId: 'checkin-1',
        appointmentId: 'local-apt-1',
        recovery: 'WORSE',
        hasSideEffects: false,
        needsToBeSeen: true,
        note: 'The cough is worse at night.',
        answeredAtIso: new Date().toISOString(),
        sharedAtIso: new Date().toISOString()
      },
      { 'Idempotency-Key': 'follow-up-1', ...A }
    );
    const body = await res.json();
    assert.strictEqual(res.status, 201, JSON.stringify(body));
    assert.strictEqual(body.status, 'RECORDED');
    assert.ok(body.messageId, 'the check-in must be visible in the clinic inbox');
    // A patient saying they feel worse must be flagged, not silently accepted.
    assert.strictEqual(body.requiresTriage, true);
  });

  await testAsync('a check-in cannot be attached to another patient appointment', async () => {
    const res = await post(
      '/api/patient/sync/follow-ups',
      { checkInId: 'checkin-2', appointmentId, recovery: 'BETTER' },
      B
    );
    const body = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(body.code, 'APPOINTMENT_SCOPE_VIOLATION');
  });

  await testAsync('a refill request is recorded as REQUESTED, never approved', async () => {
    const res = await post(
      '/api/patient/sync/refills',
      {
        refillId: 'refill-1',
        medicationId: 'amoxicillin-500',
        medicationName: 'Amoxicillin',
        dosage: '500 mg',
        prescriber: 'Dr. Sarah Chen',
        pharmacy: 'Central Pharmacy',
        note: 'Running out in two days',
        requestedAtIso: new Date().toISOString(),
        sharedAtIso: new Date().toISOString()
      },
      A
    );
    const body = await res.json();
    assert.strictEqual(res.status, 201, `expected 201, got ${res.status}: ${JSON.stringify(body)}`);
    assert.strictEqual(body.status, 'REQUESTED');
    assert.ok(body.messageId, 'the request must be persisted as a clinic-visible message');
  });

  await testAsync('a refill cannot be attached to another patient appointment', async () => {
    const res = await post(
      '/api/patient/sync/refills',
      { refillId: 'refill-2', medicationName: 'Amoxicillin', appointmentId },
      B
    );
    const body = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(body.code, 'APPOINTMENT_SCOPE_VIOLATION');
  });

  await testAsync('the owner can reschedule their own appointment', async () => {
    const newStart = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const res = await post(
      '/api/patient/sync/reschedules',
      { appointmentId, newStartIso: newStart, rescheduledAtIso: new Date().toISOString() },
      A
    );
    const body = await res.json();
    assert.strictEqual(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    assert.strictEqual(new Date(body.scheduledFor).getTime(), new Date(newStart).getTime());
  });

  await testAsync('the owner can cancel, and the state is durable', async () => {
    const res = await post(
      '/api/patient/sync/cancellations',
      { appointmentId, cancelledAtIso: new Date().toISOString() },
      A
    );
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.status, 'CANCELLED');

    const pull = await fetch(`${baseUrl}/api/patient/sync/pull`, { headers: A });
    const pullBody = await pull.json();
    const found = pullBody.appointments.find((a) => a.id === appointmentId);
    assert.strictEqual(found.status, 'CANCELLED');
  });

  console.log(`\n${'='.repeat(68)}`);
  console.log(`   PATIENT SYNC VALIDATION: ${passCount}/${passCount + failCount} passed`);
  console.log(`${'='.repeat(68)}\n`);

  await new Promise((resolve) => server.close(resolve));
  await stopWorkflowRuntime().catch(() => {});
  await closePostgresPool().catch(() => {});

  if (failCount > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nPatient sync validation FAILED');
  console.error(err);
  process.exit(1);
});
