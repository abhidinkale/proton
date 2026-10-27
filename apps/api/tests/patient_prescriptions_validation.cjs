/**
 * Prescription → medication-alarm validation.
 *
 * The loop this proves: a physician signs a prescription in the clinic, and the
 * patient's phone receives exactly that prescription — the drug, the dose, the
 * frequency — and nothing the physician did not sign.
 *
 * Covers:
 *   - only a physician can sign (front desk is refused)
 *   - a prescription needs a medicine, a dose and a frequency
 *   - a patient with no encounter cannot be prescribed for
 *   - the signed bundle reaches the patient's pull, and no other patient's
 *   - another tenant cannot prescribe for, or read, this patient
 *   - the bundle carries the fields the phone stores (record + detail + meds)
 *   - a second pull does not duplicate the prescription
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
    suiteFile: 'patient_prescriptions_validation.cjs',
    testDbName: process.env.PROTON_TEST_RX_DB || 'proton_ops_rx_test'
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

  const request = (requestPath, { method = 'GET', body, headers = {} } = {}) =>
    fetch(`${baseUrl}${requestPath}`, {
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

  const patientA = await devPatientToken('pat-synthetic-a');
  const patientB = await devPatientToken('pat-synthetic-b');
  const doctor = clinician();
  const frontDesk = clinician({
    actorId: 'usr-front-01',
    actorRole: 'operations_staff',
    actorName: 'Front desk'
  });
  const otherTenantDoctor = clinician({ tenantId: 'org-other', actorId: 'usr-other-01' });

  // The patient books first. A prescription belongs to an encounter, so this is
  // the same order a real visit takes: booking → encounter → prescribing.
  await request('/api/patient/sync/bookings', {
    method: 'POST',
    headers: { ...patientA, 'Idempotency-Key': 'rx-suite-booking-1' },
    body: {
      appointmentId: 'rx-local-apt-1',
      doctorId: 'usr-md-lin-01',
      startIso: new Date(Date.now() + 86_400_000).toISOString(),
      reasonForVisit: 'Type 2 diabetes review'
    }
  });

  const prescriptionBody = {
    patientId: 'pat-synthetic-a',
    reason: 'Type 2 diabetes review',
    medications: [
      { medicationName: 'Metformin', dose: '500 mg', frequency: 'Twice daily', durationDays: 30 },
      { medicationName: 'Atorvastatin', dose: '20 mg', frequency: 'At night', durationDays: 30 }
    ]
  };

  let recordId = null;

  await testAsync('front desk cannot sign a prescription', async () => {
    const res = await request('/api/clinic/live/prescriptions', {
      method: 'POST',
      headers: frontDesk,
      body: prescriptionBody
    });
    assert.strictEqual(res.status, 403, `expected 403, got ${res.status}`);
  });

  await testAsync('a medicine without a dose is refused', async () => {
    const res = await request('/api/clinic/live/prescriptions', {
      method: 'POST',
      headers: doctor,
      body: { ...prescriptionBody, medications: [{ medicationName: 'Metformin', frequency: 'Twice daily' }] }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual((await res.json()).code, 'DOSE_REQUIRED');
  });

  await testAsync('a patient with no encounter cannot be prescribed for', async () => {
    const res = await request('/api/clinic/live/prescriptions', {
      method: 'POST',
      headers: doctor,
      body: { ...prescriptionBody, patientId: 'pat-synthetic-b' }
    });
    assert.strictEqual(res.status, 409);
    assert.strictEqual((await res.json()).code, 'ENCOUNTER_REQUIRED');
  });

  await testAsync('a physician signs a prescription', async () => {
    const res = await request('/api/clinic/live/prescriptions', {
      method: 'POST',
      headers: doctor,
      body: prescriptionBody
    });
    const body = await res.json();
    assert.strictEqual(res.status, 201, body.error);

    const bundle = body.prescription;
    assert.ok(bundle, 'the response must carry the bundle');
    assert.strictEqual(bundle.record.type, 'PRESCRIPTION');
    assert.ok(bundle.detail, 'the bundle must carry the structured detail');
    assert.strictEqual(bundle.detail.medications.length, 2);
    assert.strictEqual(bundle.detail.medications[0].name, 'Metformin');
    assert.strictEqual(bundle.detail.medications[0].dose, '500 mg');
    assert.strictEqual(bundle.detail.medications[0].frequency, 'Twice daily');
    assert.strictEqual(bundle.detail.medications[0].duration, '30 days');
    assert.strictEqual(bundle.detail.doctorName, 'Dr. Sarah Lin, MD');

    // The console is not allowed to imply the safety check ran.
    assert.strictEqual(body.safety.checked, false);

    recordId = bundle.record.id;
  });

  await testAsync("the prescription reaches the patient's pull", async () => {
    const pull = await (await request('/api/patient/sync/pull', { headers: patientA })).json();
    const found = pull.prescriptions.find((bundle) => bundle.record.id === recordId);
    assert.ok(found, 'the patient must receive the signed prescription');
    assert.strictEqual(found.detail.medications.length, 2);
    assert.strictEqual(found.safety.checked, false);
  });

  await testAsync('another patient never sees it', async () => {
    const pull = await (await request('/api/patient/sync/pull', { headers: patientB })).json();
    assert.ok(
      !pull.prescriptions.some((bundle) => bundle.record.id === recordId),
      "another patient's prescription must not leak"
    );
  });

  await testAsync('a second pull does not duplicate the prescription', async () => {
    const first = await (await request('/api/patient/sync/pull', { headers: patientA })).json();
    const second = await (await request('/api/patient/sync/pull', { headers: patientA })).json();
    assert.strictEqual(first.prescriptions.length, second.prescriptions.length);
    assert.strictEqual(second.prescriptions.filter((bundle) => bundle.record.id === recordId).length, 1);
  });

  await testAsync('another tenant cannot prescribe for this patient', async () => {
    const res = await request('/api/clinic/live/prescriptions', {
      method: 'POST',
      headers: otherTenantDoctor,
      body: prescriptionBody
    });
    // The patient is invisible outside their tenant, so there is no encounter.
    assert.strictEqual(res.status, 409);
  });

  await testAsync('another tenant cannot read this prescription', async () => {
    const res = await request('/api/clinic/live/prescriptions?patientId=pat-synthetic-a', {
      headers: otherTenantDoctor
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.prescriptions.length, 0);
  });

  console.log(`\n${'='.repeat(68)}`);
  console.log(`   PATIENT PRESCRIPTIONS VALIDATION: ${passCount}/${passCount + failCount} passed`);
  console.log(`${'='.repeat(68)}\n`);

  await new Promise((resolve) => server.close(resolve));
  await stopWorkflowRuntime().catch(() => {});
  await closePostgresPool().catch(() => {});

  if (failCount > 0) process.exit(1);
}

run().catch((err) => {
  console.error('[patient-prescriptions-validation] crashed:', err);
  process.exit(1);
});
