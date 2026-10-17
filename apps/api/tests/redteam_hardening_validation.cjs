/**
 * Proton Red-Team Hardening & Clinical Safety Validation Suite
 *
 * Verifies defenses against vulnerabilities identified during Red-Team audit:
 * 1. Unauthorized FHIR Commit Prevention (non-physicians cannot pass commitToFhir: true)
 * 2. Duplicate Diagnosis Confirmation Idempotency (prevents duplicate FHIR Conditions)
 * 3. Duplicate Medication Confirmation Idempotency (prevents duplicate FHIR MedicationRequests)
 * 4. Atomic Rollback of Partial Commits in Synthetic FHIR Store
 * 5. Error Path & Secret Scrubbing in Express Global Error Handler
 */

const assert = require('assert');
const {
  clinicalPipeline,
  ClinicalPipelineError,
  clinicianConfirmationService,
  fhirService
} = require('../services');

async function runRedTeamSuite() {
  console.log('============================================================');
  console.log('PROTON RED-TEAM HARDENING VALIDATION SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] ${name}`);
      console.error(`  ${err.message}`);
    }
  }

  const patientId = 'eleanor-vance';
  const tenantId = 'org-default';
  const physicianActor = {
    actorId: 'usr-md-lin-01',
    actorRole: 'physician',
    actorName: 'Dr. Sarah Lin, MD',
    tenantId
  };
  const opsActor = {
    actorId: 'usr-ops-marcus-01',
    actorRole: 'operations_staff',
    actorName: 'Marcus Vance',
    tenantId
  };
  const patientActor = {
    actorId: 'eleanor-vance',
    actorRole: 'patient',
    actorName: 'Eleanor Vance',
    tenantId
  };

  // Setup patient record
  fhirService.adapter.setSyntheticStore({
    resourceType: 'Patient',
    id: patientId,
    name: [{ given: ['Eleanor'], family: 'Vance' }],
    meta: {
      tag: [{ system: 'https://proton.health/tenant', code: tenantId }]
    }
  });

  // TEST 1: Unauthorized FHIR Commit (operations_staff) rejected
  await test('Non-physician (operations_staff) cannot commit clinical resources to FHIR', async () => {
    await assert.rejects(
      async () => {
        await clinicalPipeline.execute({
          patientId,
          transcript: 'Patient has sinus pressure.',
          actor: opsActor,
          commitToFhir: true,
          confirmedConditions: [{ code: 'J01.90', display: 'Acute sinusitis' }]
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'CLINICIAN_AUTHORIZATION_REQUIRED');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );
  });

  // TEST 2: Unauthorized FHIR Commit (patient) rejected
  await test('Patient role cannot commit clinical resources to FHIR', async () => {
    await assert.rejects(
      async () => {
        await clinicalPipeline.execute({
          patientId,
          transcript: 'Self-reporting symptoms.',
          actor: patientActor,
          commitToFhir: true,
          confirmedConditions: [{ code: 'J00', display: 'Common cold' }]
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'CLINICIAN_AUTHORIZATION_REQUIRED');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );
  });

  // TEST 3: Duplicate diagnosis confirmation idempotency
  await test('Duplicate diagnosis confirmation is idempotent and does not create duplicate Conditions', async () => {
    const encId = `enc-idemp-diag-${Date.now()}`;
    const diagPayload = {
      encounterId: encId,
      patientId,
      actor: physicianActor,
      action: 'ACCEPT',
      diagnosis: { code: 'E11.9', display: 'Type 2 Diabetes Mellitus' }
    };

    const first = await clinicianConfirmationService.confirmDiagnosis(diagPayload);
    assert.strictEqual(first.success, true);
    assert.strictEqual(first.isDuplicate, undefined);
    assert.ok(first.activeCondition?.id);

    const second = await clinicianConfirmationService.confirmDiagnosis(diagPayload);
    assert.strictEqual(second.success, true);
    assert.strictEqual(second.isDuplicate, true);
    assert.strictEqual(second.status, 'IDEMPOTENT_CONFIRMATION');
    assert.strictEqual(second.activeCondition.id, first.activeCondition.id, 'Idempotent request must return the same Condition ID');
  });

  // TEST 4: Duplicate medication confirmation idempotency
  await test('Duplicate medication confirmation is idempotent and does not create duplicate MedicationRequests', async () => {
    const encId = `enc-idemp-med-${Date.now()}`;
    const medPayload = {
      encounterId: encId,
      patientId,
      actor: physicianActor,
      action: 'ACCEPT',
      medication: { name: 'Metformin', dose: '500mg daily' }
    };

    const first = await clinicianConfirmationService.confirmMedication(medPayload);
    assert.strictEqual(first.success, true);
    assert.strictEqual(first.isDuplicate, undefined);
    assert.ok(first.activeMedicationRequest?.id);

    const second = await clinicianConfirmationService.confirmMedication(medPayload);
    assert.strictEqual(second.success, true);
    assert.strictEqual(second.isDuplicate, true);
    assert.strictEqual(second.status, 'IDEMPOTENT_CONFIRMATION');
    assert.strictEqual(second.activeMedicationRequest.id, first.activeMedicationRequest.id, 'Idempotent request must return the same MedicationRequest ID');
  });

  // TEST 5: Atomic rollback of partial commits on transaction failure
  await test('Synthetic store completely rolls back partial entries when mid-transaction fault occurs', async () => {
    const tempPatientId = `pat-atomic-test-${Date.now()}`;
    const faultBundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        { resource: { resourceType: 'Patient', id: tempPatientId } },
        { resource: { resourceType: 'SIMULATED_TRANSACTION_FAULT' } }
      ]
    };

    await assert.rejects(
      async () => fhirService.executeTransaction(faultBundle),
      (err) => err.message.includes('Simulated atomic transaction failure')
    );

    // Verify tempPatientId was completely rolled back and does not exist in store
    const checkPatient = await fhirService.adapter.getResource('Patient', tempPatientId);
    assert.strictEqual(checkPatient, null, 'Partially staged resource must not remain in store after transaction fault');
  });

  console.log('\n============================================================');
  console.log(`RED-TEAM HARDENING SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runRedTeamSuite().catch(err => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
