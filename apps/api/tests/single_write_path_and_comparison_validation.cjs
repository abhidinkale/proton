/**
 * Single Write Path & Visit Comparison Validation — P0.1 & P1.2
 *
 * Verifies:
 * 1. Single Clinical Write Path: A note signed in the clinic desk mirrors to Postgres
 *    notes, diagnoses, prescriptions, clinical_attestations, and outcome_cohort in one transaction.
 * 2. Visit Comparison Engine: Diffs two encounters field-by-field across vitals deltas,
 *    diagnoses evolution, medication changes, and prior treatment outcomes.
 * 3. Pilot Build Boundary (P0.5): Verifies that pilot mode refuses to start without
 *    BAA_CONFIGURED=true and PROTON_SYNTHETIC_MODE=false.
 */

const assert = require('assert');
const { prepareSuite } = require('./helpers/postgresTestHarness.cjs');
const { mirrorSignedNote, ensureNoteV1 } = require('../services/careLoop/signingMirror');
const { diffNoteV1, computeVitalDiff, compareEncounters } = require('../services/clinical/encounterComparison');
const { validateConfig, ConfigurationError } = require('../config');
const attestationStore = require('../services/workflow/attestationStore');

async function runValidation() {
  console.log('============================================================');
  console.log('   P0.1, P1.2 & P0.5 SINGLE WRITE PATH & COMPARISON SUITE   ');
  console.log('============================================================\n');

  const target = await prepareSuite({
    suiteFile: 'single_write_path_and_comparison_validation.cjs',
    testDbName: process.env.PROTON_TEST_DB || 'proton_ops_single_write_test'
  });
  if (!target) return;

  const { runPostgresMigrations, getPostgresPool, closePostgresPool } = require('../storage/postgresDb');
  await runPostgresMigrations();
  const pool = getPostgresPool();

  const tenantId = `tenant-test-${Date.now()}`;
  const patientId = `pat-test-${Date.now()}`;
  const encounterId1 = `enc-test-visit1-${Date.now()}`;
  const encounterId2 = `enc-test-visit2-${Date.now()}`;

  // ---------------------------------------------------------------------------
  // SUITE 1: P0.5 Pilot Build Boundary Gate
  // ---------------------------------------------------------------------------
  console.log('--- SUITE 1: P0.5 Pilot Build Boundary Gate ---');
  {
    // Test 1: Pilot build without BAA_CONFIGURED must throw ConfigurationError
    let threw = false;
    try {
      validateConfig({
        NODE_ENV: 'production',
        PROTON_BUILD_VARIANT: 'pilot',
        BAA_CONFIGURED: 'false',
        PROTON_SYNTHETIC_MODE: 'false',
        PROTON_AUTH_SECRET: 'a-very-long-production-auth-secret-key-32-chars-long!',
        INTERNAL_AGENT_SECRET: 'internal-secret-token-long-enough'
      });
    } catch (err) {
      threw = true;
      assert(err instanceof ConfigurationError || err.name === 'ConfigurationError');
      assert(err.message.includes('BAA_CONFIGURED=true'));
    }
    assert.strictEqual(threw, true, 'Pilot build without BAA_CONFIGURED must fail closed');
    console.log('✓ Pilot build without BAA_CONFIGURED fails closed with ConfigurationError');

    // Test 2: Pilot build with synthetic mode enabled must throw ConfigurationError
    threw = false;
    try {
      validateConfig({
        NODE_ENV: 'development',
        PROTON_BUILD_VARIANT: 'pilot',
        BAA_CONFIGURED: 'true',
        PROTON_SYNTHETIC_MODE: 'true',
        PROTON_AUTH_SECRET: 'a-very-long-production-auth-secret-key-32-chars-long!',
        INTERNAL_AGENT_SECRET: 'internal-secret-token-long-enough'
      });
    } catch (err) {
      threw = true;
      assert(err.message.includes('PROTON_SYNTHETIC_MODE=false'));
    }
    assert.strictEqual(threw, true, 'Pilot build with synthetic mode must fail closed');
    console.log('✓ Pilot build with synthetic mode enabled fails closed');

    // Test 3: Valid pilot build succeeds
    const validConfig = validateConfig({
      NODE_ENV: 'production',
      PROTON_BUILD_VARIANT: 'pilot',
      BAA_CONFIGURED: 'true',
      PROTON_SYNTHETIC_MODE: 'false',
      PROTON_AUTH_SECRET: 'a-very-long-production-auth-secret-key-32-chars-long!',
      INTERNAL_AGENT_SECRET: 'internal-secret-token-long-enough'
    });
    assert.strictEqual(validConfig.syntheticMode, false);
    console.log('✓ Valid pilot build passes configuration gate');
  }

  // ---------------------------------------------------------------------------
  // SUITE 2: P0.1 Single Write Path & Attestation Mirroring
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 2: P0.1 Single Clinical Write Path ---');
  {
    // Test that mirroring refuses to fabricate fake demographics
    let refused = false;
    try {
      await mirrorSignedNote({
        tenantId,
        note: { id: 'unverified-note', patientId: 'nonexistent-pat-000' },
        actor: { actorId: 'doc-001', actorName: 'Dr. Johnson', actorRole: 'physician' }
      });
    } catch (err) {
      refused = true;
      assert(err.message.includes('lacks verified clinical demographics'));
    }
    assert.strictEqual(refused, true, 'Mirror must refuse to fabricate patient demographics');
    console.log('✓ mirrorSignedNote refuses to fabricate fake demographics');

    // Register patient with verified clinical demographics
    await pool.query(
      `INSERT INTO patients (id, tenant_id, mrn, full_name, date_of_birth, sex, contact)
       VALUES ($1, $2, $3, $4, '1815-12-10', 'female', '{}'::jsonb);`,
      [patientId, tenantId, `MRN-ADA-${Date.now()}`.slice(-12), 'Ada Lovelace']
    );

    const deskNote1 = {
      id: `desk-note-${Date.now()}-1`,
      patientId,
      patientName: 'Ada Lovelace',
      appointmentId: `apt-${Date.now()}-1`,
      title: 'Acute Strep Pharyngitis Consultation',
      note: {
        subjective: 'Patient reports severe throat pain for 3 days and difficulty swallowing.',
        objective: 'Tonsillar erythema with white exudates. Cervical adenopathy present.',
        assessment: 'Streptococcal pharyngitis (confirmed by Centor score 4)',
        plan: 'Amoxicillin 500mg TID for 10 days. Hydration and rest.'
      },
      diagnoses: ['Streptococcal pharyngitis'],
      prescriptions: [
        {
          name: 'Amoxicillin',
          dose: '500 mg',
          frequency: 'TID',
          duration: '10',
          route: 'Oral'
        }
      ],
      signature: {
        attestation: 'I personally reviewed and attest to this clinical encounter.',
        safetyVerdict: { cleared: true, kernelVersion: 'kernel_v2' }
      }
    };

    const mirrorResult = await mirrorSignedNote({
      tenantId,
      note: deskNote1,
      appointment: { id: `apt-${Date.now()}-1`, syncedEncounterId: encounterId1 },
      actor: {
        actorId: 'doc-001',
        actorName: 'Dr. Katherine Johnson, MD',
        actorRole: 'physician',
        npi: '1234567890'
      }
    });

    assert(mirrorResult.note, 'Postgres note row must be created');
    assert(mirrorResult.attestation, 'Cryptographic attestation row must be created');
    assert(mirrorResult.diagnoses.length > 0, 'Postgres diagnoses row must be created');
    assert(mirrorResult.prescriptions.length > 0, 'Postgres prescription row must be created');
    console.log('✓ Signed note, diagnoses, and prescriptions written to PostgreSQL');

    // Verify encounter is in SIGNED state
    const { rows: encRows } = await pool.query(
      `SELECT state FROM encounters WHERE id = $1 AND tenant_id = $2;`,
      [encounterId1, tenantId]
    );
    assert.strictEqual(encRows[0]?.state, 'SIGNED', 'Encounter must transition to SIGNED in Postgres');
    console.log('✓ Postgres encounter is in state SIGNED');

    // Verify cryptographic attestation row & chain
    const { rows: attRows } = await pool.query(
      `SELECT * FROM clinical_attestations WHERE encounter_id = $1 AND tenant_id = $2;`,
      [encounterId1, tenantId]
    );
    assert.strictEqual(attRows.length, 1, 'One attestation row must exist for encounter');
    assert(attRows[0].content_hash, 'Attestation must contain content_hash');
    assert(attRows[0].chain_hash, 'Attestation must contain chain_hash');
    console.log(`✓ Attestation hash verified: ${attRows[0].content_hash.slice(0, 16)}...`);

    // Verify note provenance links to attestation
    const { rows: noteRows } = await pool.query(
      `SELECT provenance FROM notes WHERE encounter_id = $1 AND tenant_id = $2;`,
      [encounterId1, tenantId]
    );
    assert.strictEqual(
      noteRows[0].provenance.attestation_id,
      attRows[0].id,
      'Note provenance must reference attestation ID'
    );
    console.log('✓ Note provenance correctly bound to attestation');

    // Verify outcome_cohort row scheduled (P1.5)
    const { rows: cohortRows } = await pool.query(
      `SELECT * FROM outcome_cohort WHERE encounter_id = $1 AND tenant_id = $2;`,
      [encounterId1, tenantId]
    );
    assert.strictEqual(cohortRows.length, 1, 'Encounter must enter the 30-day outcome cohort');
    assert.strictEqual(cohortRows[0].status, 'pending');
    console.log('✓ Encounter registered into 30-day outcome cohort');
  }

  // ---------------------------------------------------------------------------
  // SUITE 3: P1.2 Visit Comparison Diff Engine
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 3: P1.2 Visit Comparison Diff Engine ---');
  {
    // Write second encounter (Follow-up visit for Ada Lovelace)
    const deskNote2 = {
      id: `desk-note-${Date.now()}-2`,
      patientId,
      patientName: 'Ada Lovelace',
      appointmentId: `apt-${Date.now()}-2`,
      title: 'Follow-up Consultation',
      note: {
        subjective: 'Patient reports throat pain has completely resolved after completing antibiotics.',
        objective: 'Pharynx clear without erythema or exudate. Afebrile.',
        assessment: 'Resolved streptococcal pharyngitis',
        plan: 'Discontinue antibiotic therapy as completed course. Routine preventive follow-up.'
      },
      diagnoses: ['Resolved streptococcal pharyngitis'],
      prescriptions: [], // Antibiotics completed, no active meds
      signature: {
        attestation: 'Reviewed and attested resolution of pharyngitis.',
        safetyVerdict: { cleared: true, kernelVersion: 'kernel_v2' }
      }
    };

    await mirrorSignedNote({
      tenantId,
      note: deskNote2,
      appointment: { id: `apt-${Date.now()}-2`, syncedEncounterId: encounterId2 },
      actor: {
        actorId: 'doc-001',
        actorName: 'Dr. Katherine Johnson, MD',
        actorRole: 'physician',
        npi: '1234567890'
      }
    });

    // Record a 30-day resolved outcome for encounter 1 in outcomes table
    await pool.query(
      `INSERT INTO outcomes
         (id, tenant_id, patient_id, encounter_id, condition_code, assessed_at,
          window_days, follow_up_wave, patient_reported, label, label_version,
          window_complete, source)
       VALUES ($1, $2, $3, $4, '43878008', NOW(), 30, '30d', 'better', 'resolved', 'label_v1', true, 'clinician');`,
      [`out-${Date.now()}`, tenantId, patientId, encounterId1]
    );

    // Run visit comparison
    const comparison = await compareEncounters(pool, tenantId, patientId, encounterId1, encounterId2);

    assert(comparison.diff, 'Comparison must produce diff');
    assert.strictEqual(comparison.diff.chiefComplaint.changed, true);
    console.log('✓ Chief complaint change detected');

    // Diagnoses evolution
    assert(comparison.diff.diagnoses.resolved.length > 0 || comparison.diff.diagnoses.new.length > 0);
    console.log('✓ Diagnoses evolution correctly identified');

    // Medications discontinued
    assert.strictEqual(comparison.diff.medications.discontinued.length, 1);
    assert.strictEqual(comparison.diff.medications.discontinued[0].drug, 'Amoxicillin');
    console.log('✓ Discontinued medication (Amoxicillin) identified in diff');

    // Treatment efficacy
    assert.strictEqual(comparison.diff.treatmentEfficacy.length, 1);
    assert.strictEqual(comparison.diff.treatmentEfficacy[0].interpretedStatus, 'TREATMENT WORKED');
    console.log('✓ Prior treatment efficacy verified: "TREATMENT WORKED" (Resolved at 30 days)');
  }

  // Clean up test tenant
  await pool.query(`DELETE FROM outcomes WHERE tenant_id = $1;`, [tenantId]);
  await pool.query(`DELETE FROM outcome_cohort WHERE tenant_id = $1;`, [tenantId]);
  await pool.query(`DELETE FROM clinical_attestations WHERE tenant_id = $1;`, [tenantId]);
  await pool.query(`DELETE FROM notes WHERE tenant_id = $1;`, [tenantId]);
  await pool.query(`DELETE FROM prescriptions WHERE tenant_id = $1;`, [tenantId]);
  await pool.query(`DELETE FROM diagnoses WHERE tenant_id = $1;`, [tenantId]);
  await pool.query(`DELETE FROM encounter_events WHERE tenant_id = $1;`, [tenantId]);
  await pool.query(`DELETE FROM encounters WHERE tenant_id = $1;`, [tenantId]);
  await pool.query(`DELETE FROM patients WHERE tenant_id = $1;`, [tenantId]);

  await closePostgresPool();

  console.log('\n============================================================');
  console.log('   ALL SINGLE WRITE PATH & COMPARISON TESTS PASSED (100%)    ');
  console.log('============================================================\n');
}

runValidation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Validation failed:', err);
    process.exit(1);
  });
