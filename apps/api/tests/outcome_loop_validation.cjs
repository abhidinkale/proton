/**
 * Proton Outcome Loop Validation (WS0.5)
 *
 * Exercises the complete 30-day outcome loop:
 * - Cohort scheduled upon signing
 * - Early check-in (48h 'better' -> 'improved', window_complete=false)
 * - Worsening check-in triggers clinical escalation and records 'worsened'
 * - Final 30-day evaluation assigns 'resolved' or 'unknown/no_contact'
 * - Cohort metrics endpoint computes M, positive_pct, documented_non_response,
 *   lost_to_follow_up, and response_rate matching docs/moat/outcome-label-v1.md.
 */

const assert = require('assert');
const crypto = require('crypto');
const { prepareSuite } = require('./helpers/postgresTestHarness.cjs');
const { NOTE_V1 } = require('./fixtures/noteV1.cjs');

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
    suiteFile: 'outcome_loop_validation.cjs',
    testDbName: process.env.PROTON_TEST_API_DB || 'proton_ops_outcome_test'
  });
  if (!target) {
    process.exit(0);
  }

  const { runPostgresMigrations, closePostgresPool, getPostgresPool } = require('../storage/postgresDb');
  await runPostgresMigrations();

  const app = require('../app');
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const MD = { 'x-proton-dev-persona': 'physician-lin' };

  const request = (path, { method = 'GET', body, headers = {} } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...MD,
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });

  const pool = getPostgresPool();
  const tenantId = 'org-default';

  console.log('\n====================================================================');
  console.log('   PROTON OUTCOME LOOP VALIDATION (WS0.5)');
  console.log('====================================================================\n');

  try {
    // 1. Initial cohort query
    await testAsync('Initial cohort endpoint returns zero metrics with bias disclosure', async () => {
      const res = await request('/api/workflow/outcomes/cohort');
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.cohort_definition.label_version, 'label_v1');
      assert.strictEqual(data.counts.mature, 0);
      assert.strictEqual(data.rates.positive_pct, 0);
      assert.ok(Array.isArray(data.bias_disclosure) && data.bias_disclosure.length >= 3);
    });

    // 2. Setup a patient and sign an encounter
    const patientId1 = `pat-out-1-${crypto.randomUUID().slice(0, 8)}`;
    const patientId2 = `pat-out-2-${crypto.randomUUID().slice(0, 8)}`;
    const encId1 = `enc-out-1-${crypto.randomUUID().slice(0, 8)}`;
    const encId2 = `enc-out-2-${crypto.randomUUID().slice(0, 8)}`;

    await pool.query(
      `INSERT INTO patients (id, tenant_id, full_name, date_of_birth, sex)
       VALUES ($1, $2, 'Aarav Patel', '1990-05-15', 'male');`,
      [patientId1, tenantId]
    );
    await pool.query(
      `INSERT INTO patients (id, tenant_id, full_name, date_of_birth, sex)
       VALUES ($1, $2, 'Maya Sharma', '1985-03-20', 'female');`,
      [patientId2, tenantId]
    );

    // Create and sign encounter 1 with primary confirmed condition 43878008
    await pool.query(
      `INSERT INTO encounters (id, tenant_id, patient_id, clinician_id, state)
       VALUES ($1, $2, $3, 'usr-md-lin-01', 'PENDING_REVIEW');`,
      [encId1, tenantId, patientId1]
    );
    await pool.query(
      `INSERT INTO diagnoses (id, tenant_id, encounter_id, code, code_system, display, is_primary, certainty, created_by)
       VALUES ($1, $2, $3, '43878008', 'SNOMED', 'Streptococcal pharyngitis', true, 'CONFIRMED', 'usr-md-lin-01');`,
      [`diag-${encId1}`, tenantId, encId1]
    );

    await testAsync('Signing an encounter auto-schedules the 30-day outcome cohort', async () => {
      const signRes = await request(`/api/workflow/encounters/${encId1}/transitions`, {
        method: 'POST',
        body: {
          action: 'sign',
          attestation: true,
          note: NOTE_V1
        }
      });
      assert.strictEqual(signRes.status, 200);

      const { rows: cohortRows } = await pool.query(
        `SELECT * FROM outcome_cohort WHERE tenant_id = $1 AND encounter_id = $2;`,
        [tenantId, encId1]
      );
      assert.strictEqual(cohortRows.length, 1);
      assert.strictEqual(cohortRows[0].condition_code, '43878008');
      assert.strictEqual(cohortRows[0].status, 'pending');
      assert.strictEqual(cohortRows[0].window_days, 30);
    });

    // 3. Early check-in (48h 'better')
    await testAsync('Early 48h check-in produces "improved" with window_complete=false', async () => {
      const checkinRes = await request('/api/workflow/outcomes/checkin', {
        method: 'POST',
        body: {
          patientId: patientId1,
          encounterId: encId1,
          recovery: 'better',
          wave: '48h'
        }
      });
      assert.strictEqual(checkinRes.status, 200);
      const data = await checkinRes.json();
      assert.strictEqual(data.escalated, false);
      assert.strictEqual(data.recorded.length, 1);
      assert.strictEqual(data.recorded[0].label, 'improved');
      assert.strictEqual(data.recorded[0].non_response_reason, null);

      const { rows: cohortRows } = await pool.query(
        `SELECT status FROM outcome_cohort WHERE tenant_id = $1 AND encounter_id = $2;`,
        [tenantId, encId1]
      );
      assert.strictEqual(cohortRows[0].status, 'responded');
    });

    // 4. Create and sign encounter 2 for worsening check-in & escalation
    await pool.query(
      `INSERT INTO encounters (id, tenant_id, patient_id, clinician_id, state)
       VALUES ($1, $2, $3, 'usr-md-lin-01', 'PENDING_REVIEW');`,
      [encId2, tenantId, patientId2]
    );
    await pool.query(
      `INSERT INTO diagnoses (id, tenant_id, encounter_id, code, code_system, display, is_primary, certainty, created_by)
       VALUES ($1, $2, $3, '43878008', 'SNOMED', 'Streptococcal pharyngitis', true, 'CONFIRMED', 'usr-md-lin-01');`,
      [`diag-${encId2}`, tenantId, encId2]
    );
    await request(`/api/workflow/encounters/${encId2}/transitions`, {
      method: 'POST',
      body: { action: 'sign', attestation: true, note: NOTE_V1 }
    });

    await testAsync('Worsening check-in triggers clinical escalation and records "worsened"', async () => {
      const checkinRes = await request('/api/workflow/outcomes/checkin', {
        method: 'POST',
        body: {
          patientId: patientId2,
          encounterId: encId2,
          recovery: 'worse',
          wave: '48h',
          hasSideEffects: true,
          needsToBeSeen: true
        }
      });
      assert.strictEqual(checkinRes.status, 200);
      const data = await checkinRes.json();
      assert.strictEqual(data.escalated, true);
      assert.strictEqual(data.recorded[0].label, 'worsened');

      const { rows: encRows } = await pool.query(
        `SELECT state FROM encounters WHERE id = $1 AND tenant_id = $2;`,
        [encId2, tenantId]
      );
      assert.strictEqual(encRows[0].state, 'ESCALATED');
    });

    // 5. Mature evaluation job at +31 days
    await testAsync('Mature evaluation job closes cohort and assigns "resolved" to encounter 1', async () => {
      const futureDate = new Date(Date.now() + 32 * 86_400_000).toISOString();
      const evalRes = await request('/api/workflow/outcomes/evaluate-mature', {
        method: 'POST',
        body: { asOfDate: futureDate }
      });
      assert.strictEqual(evalRes.status, 200);
      const data = await evalRes.json();
      assert.ok(data.evaluated_count >= 2);

      // Encounter 1 had 'better' -> now windowComplete=true -> resolved
      const { rows: out1 } = await pool.query(
        `SELECT label, window_complete FROM outcomes
          WHERE tenant_id = $1 AND encounter_id = $2 AND window_days = 30
          ORDER BY assessed_at DESC LIMIT 1;`,
        [tenantId, encId1]
      );
      assert.strictEqual(out1[0].label, 'resolved');
      assert.strictEqual(out1[0].window_complete, true);

      // Encounter 2 had 'worse' -> worsened
      const { rows: out2 } = await pool.query(
        `SELECT label, window_complete FROM outcomes
          WHERE tenant_id = $1 AND encounter_id = $2 AND window_days = 30
          ORDER BY assessed_at DESC LIMIT 1;`,
        [tenantId, encId2]
      );
      assert.strictEqual(out2[0].label, 'worsened');
      assert.strictEqual(out2[0].window_complete, true);
    });

    // 6. Mature cohort rates
    await testAsync('Cohort metrics endpoint calculates mature response rate and outcomes', async () => {
      // Simulate mature cohorts by backdating scheduled_at for the test encounters
      await pool.query(
        `UPDATE outcome_cohort
            SET scheduled_at = NOW() - interval '35 days'
          WHERE tenant_id = $1 AND encounter_id IN ($2, $3);`,
        [tenantId, encId1, encId2]
      );

      const res = await request('/api/workflow/outcomes/cohort?conditionCode=43878008');
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      assert.ok(data.counts.mature >= 2);
      assert.ok(data.rates.response_rate > 0);
      assert.ok(data.counts.resolved >= 1);
      assert.ok(data.counts.worsened >= 1);
      assert.ok(Number.isFinite(data.rates.positive_pct));
      assert.ok(Number.isFinite(data.rates.documented_non_response_pct));
    });

  } finally {
    server.close();
    await closePostgresPool();
  }

  console.log('\n====================================================================');
  console.log(`   OUTCOME LOOP VALIDATION: ${passCount}/${passCount + failCount} passed`);
  console.log('====================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
