/**
 * Workflow sign-time safety — the third write boundary.
 *
 * The durable workflow's `sign` transition is the target path for P0.1/P0.2.
 * This suite proves that a HIGH or CRITICAL prescription cannot be signed,
 * that a documented physician directive can clear a HIGH review, and that an
 * encounter with no prescriptions is unaffected.
 *
 * Requires PostgreSQL. The runner skips it when unavailable; CI sets
 * REQUIRE_POSTGRES=1.
 */

const assert = require('assert');
const { prepareSuite } = require('./helpers/postgresTestHarness.cjs');

let passCount = 0;
let failCount = 0;

async function test(name, fn) {
  try {
    await fn();
    passCount += 1;
    console.log(`✓ [PASS] ${name}`);
  } catch (err) {
    failCount += 1;
    console.error(`✗ [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

async function run() {
  const target = await prepareSuite({
    suiteFile: 'workflow_sign_safety_validation.cjs',
    testDbName: process.env.PROTON_TEST_DB || 'proton_ops_test'
  });
  if (!target) return;

  const { runPostgresMigrations, getPostgresPool, closePostgresPool } = require('../storage/postgresDb');
  const { assertSignSafety } = require('../services/workflow/signSafety');

  await runPostgresMigrations();
  const pool = getPostgresPool();
  const tenant = 'org-sign-safety';

  await test('v9 clinic-desk columns exist', async () => {
    const { rows } = await pool.query(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND ((table_name = 'patients' AND column_name = 'clinical_profile')
            OR (table_name = 'appointments' AND column_name IN ('queue_category', 'priority', 'metadata'))
            OR (table_name = 'notes' AND column_name IN ('title', 'legacy_signed_at')));`
    );
    const found = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
    for (const required of [
      'patients.clinical_profile',
      'appointments.queue_category',
      'appointments.priority',
      'appointments.metadata',
      'notes.title',
      'notes.legacy_signed_at'
    ]) {
      assert.ok(found.has(required), `missing column ${required}`);
    }
  });
  const actor = { actorId: 'usr-md-1', actorRole: 'physician', tenantId: tenant };

  await pool.query(
    `INSERT INTO patients (id, tenant_id, full_name, date_of_birth, sex, contact)
     VALUES ('pat-sign-1', $1, 'Sign Safety', '1958-03-14', 'female', $2::jsonb);`,
    [tenant, JSON.stringify({ allergies: ['NKDA'], medications: ['Warfarin 5 mg daily'] })]
  );

  await pool.query(
    `INSERT INTO encounters (id, tenant_id, patient_id, clinician_id, state, version)
     VALUES ('enc-sign-1', $1, 'pat-sign-1', 'usr-md-1', 'PENDING_REVIEW', 1),
            ('enc-sign-2', $1, 'pat-sign-1', 'usr-md-1', 'PENDING_REVIEW', 1);`,
    [tenant]
  );

  await pool.query(
    `INSERT INTO notes (id, tenant_id, encounter_id, author_actor_id, status, content, provenance)
     VALUES ('note-sign-1', $1, 'enc-sign-1', 'usr-md-1', 'PENDING_REVIEW', '{}'::jsonb, '{}'::jsonb);`,
    [tenant]
  );

  await pool.query(
    `INSERT INTO prescriptions (id, tenant_id, encounter_id, medication_name, dose, route, frequency, status, safety_status)
     VALUES ('rx-sign-1', $1, 'enc-sign-1', 'Ibuprofen', '400 mg', 'PO', 'three times daily', 'PROPOSED', 'PENDING');`,
    [tenant]
  );

  await test('a HIGH drug interaction blocks the workflow signature', async () => {
    let error = null;
    try {
      await assertSignSafety(pool, { tenantId: tenant, encounterId: 'enc-sign-1', actor });
    } catch (err) {
      error = err;
    }
    assert.ok(error, 'expected a safety refusal');
    assert.strictEqual(error.code, 'SAFETY_REVIEW_REQUIRED');
    assert.strictEqual(error.status, 409);
    assert.strictEqual(error.details.safetyVerdict.cleared, false);
    assert.strictEqual(error.details.safetyVerdict.kernelVersion, 'kernel_v2');
  });

  await test('a physician directive clears the HIGH review', async () => {
    const result = await assertSignSafety(pool, {
      tenantId: tenant,
      encounterId: 'enc-sign-1',
      actor,
      physicianDirective: 'Cardiology approved a short course with gastroprotection and INR monitoring.'
    });
    assert.strictEqual(result.skipped, false);
    assert.strictEqual(result.verdict.status, 'DIRECTIVE_OVERRIDE');
    assert.strictEqual(result.verdict.cleared, true);
  });

  await test('an encounter with no prescriptions is skipped, not blocked', async () => {
    const result = await assertSignSafety(pool, {
      tenantId: tenant,
      encounterId: 'enc-sign-2',
      actor
    });
    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.verdict, null);
  });

  await test('a clean prescription clears', async () => {
    await pool.query(
      `UPDATE prescriptions SET medication_name = 'Azithromycin', dose = '250 mg', frequency = 'daily' WHERE id = 'rx-sign-1';`
    );
    const result = await assertSignSafety(pool, {
      tenantId: tenant,
      encounterId: 'enc-sign-1',
      actor
    });
    assert.strictEqual(result.skipped, false);
    assert.strictEqual(result.verdict.status, 'VERIFIED');
    assert.strictEqual(result.verdict.cleared, true);
  });

  await closePostgresPool();

  console.log(`\n${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
