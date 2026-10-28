/**
 * Clinical link layer — SQL validation
 *
 * Applies the proposed migration and runs the three traversal queries against
 * real workflow tables with a fixture that exercises the edge cases:
 *
 *   - a resolved prior problem must not appear as active
 *   - a proposed diagnosis must not appear as active
 *   - a signed, in-duration prescription must appear; an expired one must not
 *   - the prior-episode query must return the treatment and the outcome
 *   - the treatment-outcome query must join by drug and condition
 *   - an orphaned polymorphic edge must be found by the integrity query
 *
 * Requires PostgreSQL (the runner skips it when unavailable).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

function loadQueries() {
  const raw = fs.readFileSync(path.resolve(__dirname, '../db/moat/clinical-links.queries.sql'), 'utf8');
  const parts = raw.split(/^-- @@query ([a-z0-9_]+)\n/gm);
  const queries = {};
  for (let i = 1; i < parts.length; i += 2) {
    queries[parts[i]] = parts[i + 1].trim();
  }
  return queries;
}

async function run() {
  const target = await prepareSuite({
    suiteFile: 'clinical_links_sql_validation.cjs',
    testDbName: process.env.PROTON_TEST_DB || 'proton_ops_test'
  });
  if (!target) return;

  const { runPostgresMigrations, getPostgresPool, closePostgresPool } = require('../storage/postgresDb');

  await runPostgresMigrations();
  const pool = getPostgresPool();
  const tenant = 'org-links-test';
  const patient = 'pat-links-1';

  await test('migration applies cleanly', async () => {
    const ddl = fs.readFileSync(path.resolve(__dirname, '../db/moat/clinical-links.sql'), 'utf8');
    await pool.query(ddl);
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('outcomes', 'outcome_cohort', 'clinical_links', 'patient_state_snapshots')
        ORDER BY table_name;`
    );
    assert.deepStrictEqual(
      rows.map((r) => r.table_name),
      ['clinical_links', 'outcome_cohort', 'outcomes', 'patient_state_snapshots']
    );
  });

  await test('fixtures insert', async () => {
    await pool.query(
      `INSERT INTO patients (id, tenant_id, full_name, date_of_birth, sex)
       VALUES ($1, $2, 'Link Fixture', '1987-04-12', 'female');`,
      [patient, tenant]
    );

    await pool.query(
      `INSERT INTO encounters (id, tenant_id, patient_id, clinician_id, state, created_at)
       VALUES
         ('enc-1', $1, $2, 'usr-md-1', 'CLOSED', '2026-01-01T10:00:00Z'),
         ('enc-2', $1, $2, 'usr-md-1', 'CLOSED', '2026-06-01T10:00:00Z'),
         ('enc-3', $1, $2, 'usr-md-1', 'READY',  '2026-10-28T10:00:00Z');`,
      [tenant, patient]
    );

    await pool.query(
      `INSERT INTO diagnoses (id, tenant_id, encounter_id, code_system, code, display, certainty, is_primary, created_by, created_at)
       VALUES
         ('dx-1', $1, 'enc-1', 'ICD-10', 'J02.0', 'Streptococcal pharyngitis', 'CONFIRMED', TRUE,  'usr-md-1', '2026-01-01T10:10:00Z'),
         ('dx-2', $1, 'enc-2', 'ICD-10', 'J02.0', 'Streptococcal pharyngitis', 'CONFIRMED', TRUE,  'usr-md-1', '2026-06-01T10:10:00Z'),
         ('dx-3', $1, 'enc-3', 'ICD-10', 'J02.0', 'Streptococcal pharyngitis', 'PROPOSED',  TRUE,  'usr-md-1', '2026-10-28T10:10:00Z'),
         ('dx-4', $1, 'enc-3', 'ICD-10', 'I10',   'Essential hypertension',    'CONFIRMED', FALSE, 'usr-md-1', '2026-10-28T10:11:00Z');`,
      [tenant]
    );

    await pool.query(
      `INSERT INTO prescriptions (id, tenant_id, encounter_id, medication_name, rxnorm_code, dose, route, frequency, duration_days, status, signed_by, signed_at, created_at)
       VALUES
         ('rx-1', $1, 'enc-1', 'Amoxicillin', '723', '500 mg', 'PO', 'three times daily', 10, 'SIGNED', 'usr-md-1', '2026-01-01T10:20:00Z', '2026-01-01T10:20:00Z'),
         ('rx-2', $1, 'enc-2', 'Amoxicillin', '723', '500 mg', 'PO', 'three times daily', 10, 'SIGNED', 'usr-md-1', '2026-06-01T10:20:00Z', '2026-06-01T10:20:00Z'),
         ('rx-3', $1, 'enc-3', 'Amoxicillin', '723', '500 mg', 'PO', 'three times daily', 30, 'SIGNED', 'usr-md-1', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');`,
      [tenant]
    );

    await pool.query(
      `INSERT INTO outcomes (id, tenant_id, patient_id, encounter_id, condition_code, condition_code_system, assessed_at, window_days, follow_up_wave, patient_reported, label, label_version, window_complete, non_response_reason, source)
       VALUES
         ('out-1', $1, $2, 'enc-1', 'J02.0', 'ICD-10', '2026-01-06T10:00:00Z', 30, '30d', 'better', 'resolved', 'label_v1', TRUE, NULL, 'patient_app'),
         ('out-2', $1, $2, 'enc-2', 'J02.0', 'ICD-10', '2026-06-10T10:00:00Z', 30, '30d', 'better', 'improved', 'label_v1', FALSE, NULL, 'patient_app'),
         ('out-3', $1, $2, 'enc-3', 'J02.0', 'ICD-10', NOW() - INTERVAL '12 hours', 7, '7d', 'better', 'improved', 'label_v1', FALSE, NULL, 'patient_app');`,
      [tenant, patient]
    );

    await pool.query(
      `INSERT INTO patient_documents (id, tenant_id, patient_id, title, category, original_name, mime_type, byte_size, sha256, storage_path, source)
       VALUES ('doc-1', $1, $2, 'Prior swab', 'LAB_REPORT', 'swab.pdf', 'application/pdf', 1024, repeat('a', 64), 'tenant/doc-1', 'PATIENT_APP');`,
      [tenant, patient]
    );

    await pool.query(
      `INSERT INTO clinical_links (id, tenant_id, patient_id, from_type, from_id, to_type, to_id, relation, status, confidence, created_by)
       VALUES ('link-1', $1, $2, 'diagnosis', 'dx-1', 'prescription', 'rx-1', 'RESOLVED_BY', 'confirmed', 1.000, 'usr-md-1');`,
      [tenant, patient]
    );
  });

  const queries = loadQueries();

  await test('Q1 returns active problem and active medication, excludes resolved and proposed', async () => {
    const { rows } = await pool.query(queries.q1_active_problems_and_meds, [tenant, patient]);
    const ids = rows.map((r) => r.node_id).sort();
    assert.deepStrictEqual(ids, ['dx-2', 'dx-4', 'rx-3']);
    assert.ok(!ids.includes('dx-1'), 'resolved diagnosis must not be active');
    assert.ok(!ids.includes('dx-3'), 'proposed diagnosis must not be active');
    assert.ok(!ids.includes('rx-1'), 'expired prescription must not be active');
  });

  await test('Q2 returns the prior episode with its treatment and outcome', async () => {
    const { rows } = await pool.query(queries.q2_prior_episode, [
      tenant,
      patient,
      'J02.0',
      '2026-10-28T10:00:00Z'
    ]);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].encounter_id, 'enc-2');
    assert.strictEqual(rows[0].treatments.length, 1);
    assert.strictEqual(rows[0].treatments[0].prescription_id, 'rx-2');
    assert.strictEqual(rows[0].outcome.label, 'improved');
    assert.strictEqual(rows[0].outcome.label_version, 'label_v1');
  });

  await test('Q3 joins the latest treatment to its outcome and day delta', async () => {
    const { rows } = await pool.query(queries.q3_last_treatment_outcome, [
      tenant,
      patient,
      'Amoxicillin',
      'J02.0'
    ]);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].prescription_id, 'rx-3');
    assert.strictEqual(rows[0].label, 'improved');
    assert.strictEqual(rows[0].label_version, 'label_v1');
    assert.strictEqual(typeof rows[0].days_to_outcome, 'number');
  });

  await test('integrity query finds an orphaned polymorphic edge', async () => {
    await pool.query(
      `INSERT INTO clinical_links (id, tenant_id, patient_id, from_type, from_id, to_type, to_id, relation, status, created_by)
       VALUES ('link-orphan', $1, $2, 'diagnosis', 'dx-missing', 'prescription', 'rx-3', 'TREATED_WITH', 'authored', 'usr-md-1');`,
      [tenant, patient]
    );
    const { rows } = await pool.query(queries.integrity_orphaned_links, [tenant]);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].id, 'link-orphan');
    assert.strictEqual(rows[0].node_id, 'dx-missing');
  });

  await test('CAUSED_BY without a physician reason is rejected', async () => {
    let rejected = false;
    try {
      await pool.query(
        `INSERT INTO clinical_links (id, tenant_id, patient_id, from_type, from_id, to_type, to_id, relation, status, created_by)
         VALUES ('link-cause', $1, $2, 'diagnosis', 'dx-2', 'prescription', 'rx-2', 'CAUSED_BY', 'hypothesized', 'ai');`,
        [tenant, patient]
      );
    } catch (err) {
      rejected = err.code === '23514';
    }
    assert.ok(rejected, 'CAUSED_BY must be authored/confirmed and carry a reason');
  });

  await closePostgresPool();

  console.log(`\n${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
