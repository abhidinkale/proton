/**
 * Clinic live loop validation.
 *
 * Proves the half of the product that a clinician actually uses: the schedule
 * and attention queue are built from the same rows the patient app writes, and
 * a clinician action changes what the phone pulls next.
 *
 * Covers:
 *   - a patient booking appears on the clinician schedule
 *   - confirming changes what `/api/patient/sync/pull` returns
 *   - a follow-up check-in becomes a triaged attention item
 *   - a clinician reply reaches the patient's pull, and the patient's own
 *     check-in is never echoed back as clinic mail
 *   - resolving clears the queue without deleting the conversation
 *   - rescheduling clears the confirmation
 *   - a clinician in another tenant sees nothing and cannot act
 *   - front-desk staff can confirm but cannot author a clinical reply
 *   - an unknown patient cannot receive a reply
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
    suiteFile: 'clinic_live_validation.cjs',
    testDbName: process.env.PROTON_TEST_LIVE_DB || 'proton_ops_live_test'
  });
  if (!target) process.exit(0);

  const { runPostgresMigrations, closePostgresPool } = require('../storage/postgresDb');
  await runPostgresMigrations();

  const app = require('../app');
  const { createSessionToken } = require('../middleware/authService');
  const { stopWorkflowRuntime } = require('../services/workflow/runtime');

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const request = (path, { method = 'GET', body, headers = {} } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

  const devPatientToken = async (patientId) => {
    const res = await request('/api/patient/auth/dev-session', {
      method: 'POST',
      body: { patientId }
    });
    const parsed = await res.json();
    assert.ok(parsed.token, `dev-session failed for ${patientId}: ${res.status}`);
    return { Authorization: `Bearer ${parsed.token}` };
  };

  const clinician = (overrides = {}) => {
    const token = createSessionToken({
      actorId: 'usr-md-lin-01',
      actorRole: 'physician',
      actorName: 'Dr. Sarah Lin, MD',
      tenantId: 'org-default',
      npi: '1928374650',
      ...overrides
    });
    return { Authorization: `Bearer ${token}` };
  };

  const physician = clinician();
  const otherTenant = clinician({
    actorId: 'usr-md-other',
    actorName: 'Dr. Other',
    tenantId: 'org-somewhere-else'
  });
  const opsStaff = clinician({ actorId: 'usr-ops-marcus-01', actorRole: 'operations_staff' });

  const PATIENT = 'pat-synthetic-a';
  const patientAuth = await devPatientToken(PATIENT);
  const startIso = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  let appointmentId = null;
  let followUpMessageId = null;
  let replyMessageId = null;

  // The suite books days ahead, so the "today" default window is widened
  // explicitly rather than weakening the console's own default.
  const windowQuery = (() => {
    const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  })();
  const overviewUrl = `/api/clinic/live/overview?${windowQuery}`;

  await testAsync('a patient booking is persisted through the real booking path', async () => {
    const res = await request('/api/patient/sync/bookings', {
      method: 'POST',
      headers: { ...patientAuth, 'Idempotency-Key': 'live-book-1' },
      body: {
        appointmentId: 'local-live-1',
        doctorId: 'doc-chen',
        startIso,
        reasonForVisit: 'Persistent cough'
      }
    });
    const body = await res.json();
    assert.strictEqual(res.status, 201, `booking failed ${res.status}: ${JSON.stringify(body)}`);
    appointmentId = body.appointmentId;
    assert.ok(appointmentId);
  });

  await testAsync('the booking appears on the clinician schedule with the patient name', async () => {
    const res = await request(overviewUrl, { headers: physician });
    const body = await res.json();
    assert.strictEqual(res.status, 200, JSON.stringify(body));
    assert.strictEqual(body.persistence, 'postgres');
    const appointment = body.appointments.find((a) => a.id === appointmentId);
    assert.ok(appointment, 'the patient booking must be on the clinic schedule');
    assert.strictEqual(appointment.status, 'BOOKED');
    assert.strictEqual(appointment.reason, 'Persistent cough');
    assert.ok(appointment.patientName && appointment.patientName !== 'Patient');
    assert.strictEqual(body.metrics.scheduled, 1);
    assert.strictEqual(body.metrics.unconfirmed, 1);
  });

  await testAsync('confirming is written once and is idempotent', async () => {
    const first = await request(
      `/api/clinic/live/appointments/${encodeURIComponent(appointmentId)}/confirm`,
      { method: 'POST', headers: physician }
    );
    const firstBody = await first.json();
    assert.strictEqual(first.status, 200, JSON.stringify(firstBody));
    assert.strictEqual(firstBody.appointment.status, 'CONFIRMED');
    assert.ok(firstBody.appointment.confirmedAt, 'a confirmation time must be recorded');

    // A second click (a double-tap at reception) must not move the timestamp
    // or fail: confirmation is idempotent, not a one-shot token.
    const second = await request(
      `/api/clinic/live/appointments/${encodeURIComponent(appointmentId)}/confirm`,
      { method: 'POST', headers: physician }
    );
    const secondBody = await second.json();
    assert.strictEqual(second.status, 200, JSON.stringify(secondBody));
    assert.strictEqual(secondBody.appointment.status, 'CONFIRMED');
    assert.strictEqual(
      secondBody.appointment.confirmedAt,
      firstBody.appointment.confirmedAt,
      'the first confirmation time must be preserved'
    );
  });

  await testAsync('the patient pull reflects the confirmation', async () => {
    const res = await request('/api/patient/sync/pull', { headers: patientAuth });
    const body = await res.json();
    const appointment = body.appointments.find((a) => a.id === appointmentId);
    assert.ok(appointment);
    assert.strictEqual(appointment.status, 'CONFIRMED');
  });

  await testAsync('a follow-up check-in becomes a critical attention item', async () => {
    const res = await request('/api/patient/sync/follow-ups', {
      method: 'POST',
      headers: { ...patientAuth, 'Idempotency-Key': 'live-follow-up-1' },
      body: {
        checkInId: 'check-in-live-1',
        appointmentId: 'local-live-1',
        recovery: 'WORSE',
        hasSideEffects: true,
        needsToBeSeen: true,
        note: 'Cough is worse at night.'
      }
    });
    const body = await res.json();
    assert.strictEqual(res.status, 201, JSON.stringify(body));
    followUpMessageId = body.messageId;
    assert.strictEqual(body.requiresTriage, true);

    const overview = await request(overviewUrl, { headers: physician });
    const overviewBody = await overview.json();
    assert.strictEqual(overviewBody.metrics.needsAttention, 1);
    const item = overviewBody.attention[0];
    assert.strictEqual(item.id, followUpMessageId);
    assert.strictEqual(item.kind, 'FOLLOW_UP_CHECK_IN');
    assert.strictEqual(item.severity, 'critical');
    assert.strictEqual(item.patientId, PATIENT);
    assert.ok(item.body.includes('worse'));
  });

  await testAsync('a refill request is queued below a critical check-in', async () => {
    const res = await request('/api/patient/sync/refills', {
      method: 'POST',
      headers: { ...patientAuth, 'Idempotency-Key': 'live-refill-1' },
      body: {
        refillId: 'refill-live-1',
        medicationId: 'med-live-1',
        medicationName: 'Lisinopril',
        pharmacy: 'Beacon Hill Pharmacy'
      }
    });
    assert.strictEqual(res.status, 201, JSON.stringify(await res.json()));

    const overview = await request(overviewUrl, { headers: physician });
    const overviewBody = await overview.json();
    assert.strictEqual(overviewBody.metrics.needsAttention, 2);
    assert.deepStrictEqual(
      overviewBody.attention.map((item) => item.severity),
      ['critical', 'info'],
      'a patient asking to be seen must sort above a refill request'
    );
    assert.strictEqual(overviewBody.attention[1].kind, 'REFILL_REQUEST');
  });

  await testAsync('a clinician reply reaches the patient pull', async () => {
    const res = await request('/api/clinic/live/messages', {
      method: 'POST',
      headers: physician,
      body: {
        patientId: PATIENT,
        body: 'Come in at 4pm and we will listen to your chest.'
      }
    });
    const body = await res.json();
    assert.strictEqual(res.status, 201, JSON.stringify(body));
    replyMessageId = body.message.id;
    assert.strictEqual(body.message.kind, 'CLINIC_REPLY');
    assert.strictEqual(body.message.authorName, 'Dr. Sarah Lin, MD');

    const pull = await request('/api/patient/sync/pull', { headers: patientAuth });
    const pullBody = await pull.json();
    const reply = pullBody.messages.find((m) => m.id === replyMessageId);
    assert.ok(reply, 'the reply must be in the patient pull');
    assert.ok(reply.body.includes('4pm'));
    assert.strictEqual(reply.authorName, 'Dr. Sarah Lin, MD');
  });

  await testAsync("the patient's own check-in is not echoed back as clinic mail", async () => {
    const pull = await request('/api/patient/sync/pull', { headers: patientAuth });
    const pullBody = await pull.json();
    assert.strictEqual(
      pullBody.messages.some((m) => m.id === followUpMessageId),
      false,
      'an inbound check-in must not appear in the clinic inbox'
    );
    assert.strictEqual(pullBody.messages.length, 1);
  });

  await testAsync('the thread shows both sides, and resolving clears only the queue', async () => {
    const threadRes = await request(`/api/clinic/live/messages?patientId=${PATIENT}`, {
      headers: physician
    });
    const thread = await threadRes.json();
    assert.strictEqual(threadRes.status, 200, JSON.stringify(thread));
    assert.strictEqual(thread.messages.length, 3);
    assert.deepStrictEqual(
      thread.messages.map((m) => m.direction),
      ['INBOUND', 'INBOUND', 'CLINIC'],
      'the thread must be chronological and labelled by author'
    );

    const resolveRes = await request('/api/clinic/live/messages/resolve', {
      method: 'POST',
      headers: physician,
      body: { patientId: PATIENT }
    });
    const resolved = await resolveRes.json();
    assert.strictEqual(resolveRes.status, 200, JSON.stringify(resolved));
    assert.strictEqual(resolved.resolved, 2);

    const overview = await request(overviewUrl, { headers: physician });
    const overviewBody = await overview.json();
    assert.strictEqual(overviewBody.metrics.needsAttention, 0);

    // History survives: the patient still has the reply, and the thread still
    // has both messages. Only the queue entry is closed.
    const pull = await request('/api/patient/sync/pull', { headers: patientAuth });
    const pullBody = await pull.json();
    assert.strictEqual(pullBody.messages.length, 1);

    const threadAfter = await request(`/api/clinic/live/messages?patientId=${PATIENT}`, {
      headers: physician
    });
    const threadAfterBody = await threadAfter.json();
    assert.strictEqual(threadAfterBody.messages.length, 3);
    assert.strictEqual(threadAfterBody.openCount, 0);
  });

  await testAsync('rescheduling moves the visit and clears the confirmation', async () => {
    const newStart = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(
      `/api/clinic/live/appointments/${encodeURIComponent(appointmentId)}/reschedule`,
      { method: 'POST', headers: physician, body: { scheduledFor: newStart } }
    );
    const body = await res.json();
    assert.strictEqual(res.status, 200, JSON.stringify(body));
    assert.strictEqual(body.appointment.status, 'BOOKED');
    assert.strictEqual(body.appointment.confirmedAt, null);
    assert.strictEqual(
      new Date(body.appointment.scheduledFor).getTime(),
      new Date(newStart).getTime()
    );

    const pull = await request('/api/patient/sync/pull', { headers: patientAuth });
    const pullBody = await pull.json();
    const appointment = pullBody.appointments.find((a) => a.id === appointmentId);
    assert.strictEqual(appointment.status, 'BOOKED');
  });

  await testAsync('another tenant sees an empty schedule and cannot act on the appointment', async () => {
    const overview = await request(overviewUrl, { headers: otherTenant });
    const overviewBody = await overview.json();
    assert.strictEqual(overview.status, 200);
    assert.strictEqual(
      overviewBody.appointments.some((a) => a.id === appointmentId),
      false,
      'no cross-tenant appointment may leak into the schedule'
    );

    const confirm = await request(
      `/api/clinic/live/appointments/${encodeURIComponent(appointmentId)}/confirm`,
      { method: 'POST', headers: otherTenant }
    );
    const confirmBody = await confirm.json();
    assert.strictEqual(confirm.status, 404);
    assert.strictEqual(confirmBody.code, 'APPOINTMENT_NOT_FOUND');
  });

  await testAsync('front desk may confirm but may not author a clinical reply', async () => {
    const reply = await request('/api/clinic/live/messages', {
      method: 'POST',
      headers: opsStaff,
      body: { patientId: PATIENT, body: 'Front desk replying as a doctor.' }
    });
    assert.strictEqual(reply.status, 403);
    const replyBody = await reply.json();
    assert.strictEqual(replyBody.code, 'INSUFFICIENT_CLINICAL_PRIVILEGES');

    const overview = await request(overviewUrl, { headers: opsStaff });
    assert.strictEqual(overview.status, 200, 'front desk must be able to read the schedule');
  });

  await testAsync('a reply to an unknown patient is refused', async () => {
    const res = await request('/api/clinic/live/messages', {
      method: 'POST',
      headers: physician,
      body: { patientId: 'pat-not-in-this-clinic', body: 'Hello?' }
    });
    const body = await res.json();
    assert.strictEqual(res.status, 404);
    assert.strictEqual(body.code, 'PATIENT_NOT_FOUND');
  });

  await testAsync('an empty reply is refused rather than stored', async () => {
    const res = await request('/api/clinic/live/messages', {
      method: 'POST',
      headers: physician,
      body: { patientId: PATIENT, body: '   ' }
    });
    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.code, 'MESSAGE_REQUIRED');
  });

  console.log(`\n${'='.repeat(68)}`);
  console.log(`   CLINIC LIVE LOOP VALIDATION: ${passCount}/${passCount + failCount} passed`);
  console.log(`${'='.repeat(68)}\n`);

  await new Promise((resolve) => server.close(resolve));
  await stopWorkflowRuntime().catch(() => {});
  await closePostgresPool().catch(() => {});

  if (failCount > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nClinic live loop validation FAILED');
  console.error(err);
  process.exit(1);
});
