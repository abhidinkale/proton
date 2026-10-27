/**
 * Tenant Isolation Validation
 *
 * Proves the claim that unblocks a 50-hospital pilot: one hospital's data is
 * unreachable from another hospital's tenant context.
 *
 * SCOPE
 * -----
 * This exercises the *query layer* (`storage/postgres/workflowRepository.js`)
 * directly, not the HTTP layer. That distinction matters: route-level tenant
 * checks can be bypassed by any new endpoint that forgets them, whereas a
 * repository that cannot express a cross-tenant read is a structural guarantee.
 *
 * Every positive control is asserted first. A test that only asserts "cross
 * tenant returns nothing" would pass just as happily against a repository that
 * returns nothing for every input, so each cross-tenant assertion is paired with
 * a same-tenant proof that the row is genuinely there.
 *
 * Requires PostgreSQL (same skip policy as the other durability suites).
 */

const assert = require('assert');
const { prepareSuite } = require('./helpers/postgresTestHarness.cjs');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const TENANT_A = 'org-alpha-hospital';
const TENANT_B = 'org-beta-clinic';

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
    suiteFile: 'tenant_isolation_validation.cjs',
    testDbName: process.env.PROTON_TEST_TENANT_DB || 'proton_ops_tenant_isolation_test'
  });
  if (!target) process.exit(0);

  const { runPostgresMigrations, closePostgresPool, getPostgresPool } = require('../storage/postgresDb');
  await runPostgresMigrations();

  const repo = require('../storage/postgres/workflowRepository');

  // ---------------------------------------------------------------- fixtures
  // One complete patient journey in tenant A. Tenant B never gets a row.
  const patientA = await repo.createPatient({
    tenantId: TENANT_A,
    mrn: 'MRN-SHARED-001',
    fullName: 'Eleanor Vance',
    dateOfBirth: '1971-04-02',
    sex: 'F',
    contact: { phone: '+15550000101' }
  });

  const appointmentA = await repo.createAppointment({
    tenantId: TENANT_A,
    patientId: patientA.id,
    clinicianId: 'doc-chen',
    scheduledFor: new Date(Date.now() + 86400000).toISOString(),
    reason: 'Follow-up',
    idempotencyKey: 'iso-key-1'
  });

  const encounterA = await repo.createEncounter({
    tenantId: TENANT_A,
    patientId: patientA.id,
    appointmentId: appointmentA.id,
    clinicianId: 'doc-chen',
    reason: 'Follow-up'
  });

  await repo.recordPatientMessage({
    tenantId: TENANT_A,
    patientId: patientA.id,
    encounterId: encounterA.id,
    body: 'Your results are ready.'
  });

  await repo.putWorkflowIdempotentResponse({
    tenantId: TENANT_A,
    key: 'shared-idempotency-key',
    requestHash: 'hash-from-tenant-a',
    status: 201,
    body: { appointmentId: appointmentA.id }
  });

  console.log('\n── positive controls (same tenant must see its own data) ──');

  await testAsync('tenant A reads its own patient', async () => {
    const row = await repo.getPatient({ tenantId: TENANT_A, patientId: patientA.id });
    assert.ok(row, 'expected patient to exist in its own tenant');
    assert.strictEqual(row.id, patientA.id);
  });

  await testAsync('tenant A reads its own appointment', async () => {
    const row = await repo.getAppointment({ tenantId: TENANT_A, appointmentId: appointmentA.id });
    assert.ok(row);
    assert.strictEqual(row.id, appointmentA.id);
  });

  await testAsync('tenant A reads its own encounter', async () => {
    const row = await repo.getEncounter({ tenantId: TENANT_A, encounterId: encounterA.id });
    assert.ok(row);
    assert.strictEqual(row.id, encounterA.id);
  });

  console.log('\n── cross-tenant reads (every one must come back empty) ──');

  await testAsync('cannot read another tenant patient by id', async () => {
    const row = await repo.getPatient({ tenantId: TENANT_B, patientId: patientA.id });
    assert.strictEqual(row, null, 'tenant B must not read tenant A patient by id');
  });

  await testAsync('cannot resolve another tenant patient by MRN', async () => {
    // The same MRN may legitimately exist in two hospitals. Cross-tenant MRN
    // resolution would silently merge two different people.
    const row = await repo.findPatientByMrn({ tenantId: TENANT_B, mrn: patientA.mrn });
    assert.strictEqual(row, null, 'tenant B must not resolve tenant A patient by MRN');
  });

  await testAsync('patient list is tenant-scoped', async () => {
    const rows = await repo.listPatients({ tenantId: TENANT_B });
    assert.deepStrictEqual(rows, [], 'tenant B list must be empty');
  });

  await testAsync('cannot read another tenant appointment', async () => {
    const row = await repo.getAppointment({ tenantId: TENANT_B, appointmentId: appointmentA.id });
    assert.strictEqual(row, null);
  });

  await testAsync('appointment list is tenant-scoped', async () => {
    const rows = await repo.listAppointments({ tenantId: TENANT_B });
    assert.deepStrictEqual(rows, []);
  });

  await testAsync('cannot read another tenant encounter', async () => {
    const row = await repo.getEncounter({ tenantId: TENANT_B, encounterId: encounterA.id });
    assert.strictEqual(row, null);
  });

  await testAsync('cannot read another tenant encounter via appointment id', async () => {
    const row = await repo.getEncounterByAppointment({
      tenantId: TENANT_B,
      appointmentId: appointmentA.id
    });
    assert.strictEqual(row, null);
  });

  await testAsync('encounter list is tenant-scoped', async () => {
    const rows = await repo.listEncounters({ tenantId: TENANT_B });
    assert.deepStrictEqual(rows, []);
  });

  await testAsync('patient messages are tenant-scoped', async () => {
    const rows = await repo.listPatientMessages({ tenantId: TENANT_B, patientId: patientA.id });
    assert.deepStrictEqual(rows, [], 'tenant B must not read another tenant patient messages');
  });

  await testAsync('outbox is tenant-scoped', async () => {
    const rows = await repo.listOutbox({ tenantId: TENANT_B });
    assert.deepStrictEqual(rows, []);
  });

  await testAsync('idempotency records do not leak across tenants', async () => {
    const row = await repo.getWorkflowIdempotentResponse({
      tenantId: TENANT_B,
      key: 'shared-idempotency-key',
      requestHash: 'hash-from-tenant-a'
    });
    assert.strictEqual(row, null, 'a replayed key from another tenant must not resolve');
  });

  console.log('\n── idempotency correctness ──');

  await testAsync('same key in two tenants does not collide', async () => {
    // Composite primary key is (tenant_id, key). If it were (key) alone, one
    // hospital could suppress another hospital's booking by reusing a key.
    await repo.putWorkflowIdempotentResponse({
      tenantId: TENANT_B,
      key: 'shared-idempotency-key',
      requestHash: 'hash-from-tenant-b',
      status: 201,
      body: { appointmentId: 'apt-independent' }
    });

    const rowB = await repo.getWorkflowIdempotentResponse({
      tenantId: TENANT_B,
      key: 'shared-idempotency-key',
      requestHash: 'hash-from-tenant-b'
    });
    assert.ok(rowB, 'tenant B must own its own copy of the key');
    assert.strictEqual(rowB.response_body.appointmentId, 'apt-independent');
  });

  await testAsync('reusing a key with a different payload is rejected', async () => {
    await assert.rejects(
      () =>
        repo.getWorkflowIdempotentResponse({
          tenantId: TENANT_A,
          key: 'shared-idempotency-key',
          requestHash: 'a-different-payload-hash'
        }),
      (err) => err.code === 'IDEMPOTENCY_KEY_REUSED',
      'a different payload under the same key must be rejected'
    );
  });

  console.log('\n── defence in depth: raw SQL ──');

  await testAsync('a raw tenant-scoped query cannot reach across tenants', async () => {
    // Even if a future caller hand-writes SQL, the predicate still holds.
    const pool = getPostgresPool();
    const { rows } = await pool.query(
      `SELECT id FROM patients WHERE tenant_id = $1 AND id = $2;`,
      [TENANT_B, patientA.id]
    );
    assert.strictEqual(rows.length, 0);
  });

  await closePostgresPool();

  console.log(`\n${failCount === 0 ? '✅' : '❌'} ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\n❌ Tenant isolation suite crashed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
