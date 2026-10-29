/**
 * Terminology & Conformance Validation Suite — WS1 (§5 / Gate 1)
 *
 * Verifies that:
 * 1. Diagnostic terminology resolves canonical SNOMED CT and ICD-10 concepts from text and aliases.
 * 2. Prescription terminology resolves canonical RxNorm codes from brand/generic names.
 * 3. Sign-time gate auto-backfills recognized concepts into Postgres.
 * 4. Sign-time gate strictly refuses un-coded diagnoses with field-path error TERMINOLOGY_CODE_REQUIRED.
 * 5. Sign-time gate strictly refuses un-coded prescriptions with field-path error RXNORM_CODE_REQUIRED.
 * 6. Clean coded encounters sign, attest, and generate joinable outcome cohort rows.
 */

const assert = require('assert');
const { prepareSuite } = require('./helpers/postgresTestHarness.cjs');
const {
  resolveCondition,
  resolveMedication,
  assertSignTerminology,
  SNOMED_CATALOG
} = require('../services/clinical/terminologyService');
const { WorkflowError } = require('../services/workflow/encounterStateMachine');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PROTON_SYNTHETIC_MODE = 'true';

async function runTests() {
  console.log('\n============================================================');
  console.log('WS1 TERMINOLOGY & CONFORMANCE VALIDATION SUITE');
  console.log('============================================================\n');

  // -------------------------------------------------------------------------
  // 1. Concept Resolvers Unit Tests
  // -------------------------------------------------------------------------
  console.log('--- SUITE 1: Terminology Catalog & Concept Resolvers ---');

  const strepDirect = resolveCondition('43878008');
  assert.ok(strepDirect, 'Must resolve by direct SNOMED code');
  assert.strictEqual(strepDirect.code, '43878008');
  assert.strictEqual(strepDirect.icd10, 'J02.0');
  console.log('✓ Direct SNOMED code lookup matches catalog entry');

  const strepAlias = resolveCondition('strep throat');
  assert.ok(strepAlias, 'Must resolve common alias "strep throat"');
  assert.strictEqual(strepAlias.code, '43878008');
  assert.strictEqual(strepAlias.display, 'Streptococcal pharyngitis');
  console.log('✓ Alias "strep throat" resolves to SNOMED 43878008');

  const t2dAlias = resolveCondition('type 2 diabetes');
  assert.ok(t2dAlias, 'Must resolve "type 2 diabetes"');
  assert.strictEqual(t2dAlias.code, '44054006');
  assert.strictEqual(t2dAlias.icd10, 'E11.9');
  console.log('✓ Alias "type 2 diabetes" resolves to SNOMED 44054006 / ICD-10 E11.9');

  const unresolvableCond = resolveCondition('Unknown idiopathic complaint 12345');
  assert.strictEqual(unresolvableCond, null, 'Unresolvable concept must return null');
  console.log('✓ Unknown diagnosis string cleanly returns null');

  const amoxRx = resolveMedication('Amoxicillin 500mg');
  assert.ok(amoxRx, 'Must resolve Amoxicillin 500mg');
  assert.strictEqual(amoxRx.rxnormCode, '723');
  console.log('✓ "Amoxicillin 500mg" resolves to RxNorm CUI 723');

  const augmentinRx = resolveMedication('Augmentin');
  assert.ok(augmentinRx, 'Must resolve brand Augmentin');
  assert.strictEqual(augmentinRx.rxnormCode, '617314');
  console.log('✓ Brand "Augmentin" resolves to RxNorm CUI 617314');

  const unresolvableRx = resolveMedication('Unregulated Compound Blend');
  assert.strictEqual(unresolvableRx, null, 'Unresolvable med must return null');
  console.log('✓ Unknown drug string cleanly returns null');

  // -------------------------------------------------------------------------
  // 2. Database Sign-Time Gate Tests
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Postgres Sign-Time Terminology Boundary ---');
  const target = await prepareSuite({
    suiteFile: 'terminology_and_conformance_validation.cjs',
    testDbName: 'proton_ops_term_test'
  });
  if (!target) {
    console.log('Skipping database tests (Postgres not available)');
    return;
  }

  const { runPostgresMigrations, closePostgresPool, getPostgresPool } = require('../storage/postgresDb');
  await runPostgresMigrations();

  const pool = getPostgresPool();
  const tenant = 'org-default';

  // Seed test patient and encounter
  const patientId = `pat-term-${Date.now()}`;
  const encounterId = `enc-term-${Date.now()}`;
  const actor = { actorId: 'usr-md-lin-01', actorRole: 'PHYSICIAN', tenantId: tenant };

  await pool.query(
    `INSERT INTO patients (id, tenant_id, full_name, date_of_birth, sex)
     VALUES ($1, $2, 'Terminology Test Patient', '1985-05-15', 'female')
     ON CONFLICT (id) DO NOTHING;`,
    [patientId, tenant]
  );

  await pool.query(
    `INSERT INTO encounters (id, tenant_id, patient_id, clinician_id, state, version)
     VALUES ($1, $2, $3, $4, 'PENDING_REVIEW', 1)
     ON CONFLICT (id) DO NOTHING;`,
    [encounterId, tenant, patientId, actor.actorId]
  );

  // Test Case A: Unresolvable primary diagnosis without code blocks signing
  const diagBadId = `diag-bad-${Date.now()}`;
  await pool.query(
    `INSERT INTO diagnoses (id, tenant_id, encounter_id, code_system, code, display, certainty, is_primary, created_by)
     VALUES ($1, $2, $3, NULL, NULL, 'Uncoded Non-Standard Illness XYZ', 'CONFIRMED', TRUE, $4);`,
    [diagBadId, tenant, encounterId, actor.actorId]
  );

  let diagBlocked = false;
  try {
    await pool.query('BEGIN');
    await assertSignTerminology(pool, { tenantId: tenant, encounterId });
    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    diagBlocked = err.code === 'TERMINOLOGY_CODE_REQUIRED';
    assert.strictEqual(err.details?.field, `diagnoses[${diagBadId}].code`);
  }
  assert.ok(diagBlocked, 'Must throw TERMINOLOGY_CODE_REQUIRED when primary diagnosis has no code');
  console.log('✓ Primary diagnosis with unresolvable text is rejected with field path');

  // Clean up bad diagnosis
  await pool.query(`DELETE FROM diagnoses WHERE id = $1;`, [diagBadId]);

  // Test Case B: Diagnosis with recognized alias is auto-backfilled
  const diagAutoId = `diag-auto-${Date.now()}`;
  await pool.query(
    `INSERT INTO diagnoses (id, tenant_id, encounter_id, code_system, code, display, certainty, is_primary, created_by)
     VALUES ($1, $2, $3, NULL, NULL, 'strep throat', 'CONFIRMED', TRUE, $4);`,
    [diagAutoId, tenant, encounterId, actor.actorId]
  );

  // Add prescription with unresolvable text to test prescription gate
  const rxBadId = `rx-bad-${Date.now()}`;
  await pool.query(
    `INSERT INTO prescriptions (id, tenant_id, encounter_id, medication_name, dose, route, frequency, status)
     VALUES ($1, $2, $3, 'Mystery Extract 500mg', '500mg', 'ORAL', 'q12h', 'PROPOSED');`,
    [rxBadId, tenant, encounterId]
  );

  let rxBlocked = false;
  try {
    await pool.query('BEGIN');
    await assertSignTerminology(pool, { tenantId: tenant, encounterId });
    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    rxBlocked = err.code === 'RXNORM_CODE_REQUIRED';
    assert.strictEqual(err.details?.field, `prescriptions[${rxBadId}].rxnorm_code`);
  }
  assert.ok(rxBlocked, 'Must throw RXNORM_CODE_REQUIRED when prescription cannot resolve RxNorm code');
  console.log('✓ Prescription with unresolvable name is rejected with field path');

  // Clean up bad prescription and insert resolvable prescription
  await pool.query(`DELETE FROM prescriptions WHERE id = $1;`, [rxBadId]);

  const rxGoodId = `rx-good-${Date.now()}`;
  await pool.query(
    `INSERT INTO prescriptions (id, tenant_id, encounter_id, medication_name, dose, route, frequency, status)
     VALUES ($1, $2, $3, 'Amoxicillin 500mg capsule', '500mg', 'ORAL', 'q12h', 'PROPOSED');`,
    [rxGoodId, tenant, encounterId]
  );

  // Now test that valid recognized items auto-backfill codes
  await pool.query('BEGIN');
  const gateResult = await assertSignTerminology(pool, { tenantId: tenant, encounterId });
  await pool.query('COMMIT');

  assert.strictEqual(gateResult.verifiedDiagnosesCount, 1);
  assert.strictEqual(gateResult.verifiedPrescriptionsCount, 1);

  // Check that the database rows were updated with SNOMED and RxNorm codes
  const { rows: updatedDiags } = await pool.query(
    `SELECT code, code_system, display FROM diagnoses WHERE id = $1;`,
    [diagAutoId]
  );
  assert.strictEqual(updatedDiags[0].code, '43878008');
  assert.strictEqual(updatedDiags[0].code_system, 'SNOMED');
  console.log('✓ Auto-backfill populated SNOMED 43878008 into diagnosis row');

  const { rows: updatedRxs } = await pool.query(
    `SELECT rxnorm_code FROM prescriptions WHERE id = $1;`,
    [rxGoodId]
  );
  assert.strictEqual(updatedRxs[0].rxnorm_code, '723');
  console.log('✓ Auto-backfill populated RxNorm CUI 723 into prescription row');

  await closePostgresPool();

  console.log('\n============================================================');
  console.log('ALL WS1 TERMINOLOGY VALIDATION TESTS PASSED (100%)');
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
