/**
 * Milestone 1 Clinical Integrity & Safety Adversarial Validation Suite
 * 
 * Verifies end-to-end clinical invariants:
 * 1. Physician Authority & Unauthorized Override Prevention (403 on non-clinician overrides)
 * 2. Strict Patient Isolation & Cross-Tenant Access Prevention (Patient A != Patient B)
 * 3. AI Hallucination Boundary & Unconfirmed Clinical Data Prevention
 * 4. Deterministic Safety Ordering (Safety precedes persistence; failed check stops FHIR commit)
 * 5. FHIR Atomic Transaction Failure & Zero Partial-Commit Rollback
 * 6. Cryptographic Audit Provenance on Both Success & Failure
 * 7. Eradication of Silent Mock/Fabricated AI Data
 * 8. Authoritative Backend Re-verification (Frontend trust boundary)
 */

const assert = require('assert');
const {
  mediaService,
  TranscriptionInputError,
  MediaValidationError,
  safetyService,
  fhirService,
  auditService,
  clinicalPipeline,
  ClinicalPipelineError
} = require('../services');

async function runIntegrityTests() {
  console.log('====================================================================');
  console.log('   PROTON V2 — CLINICAL INTEGRITY & ADVERSARIAL VALIDATION SUITE    ');
  console.log('====================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] ${name}`);
      console.error(`  Error: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] ${name}`);
      console.error(`  Error: ${err.message}`);
    }
  }

  // --- SUITE 1: Physician Authority & Override Governance ---
  console.log('--- SUITE 1: Physician Authority & Override Governance ---');

  await testAsync('Non-physician actor (operations_staff) CANNOT override clinical safety gate', async () => {
    // Setup patient with severe Penicillin allergy
    fhirService.adapter.setSyntheticStore({
      resourceType: 'Patient',
      id: 'patient-auth-01',
      name: [{ given: ['Alice'], family: 'Walker' }]
    });
    fhirService.adapter.setSyntheticStore({
      resourceType: 'AllergyIntolerance',
      id: 'all-auth-01',
      subject: { reference: 'Patient/patient-auth-01' },
      code: { coding: [{ display: 'Penicillin' }] }
    });

    await assert.rejects(
      async () => clinicalPipeline.execute({
        patientId: 'patient-auth-01',
        actor: { actorId: 'usr-ops-staff-01', actorRole: 'operations_staff', actorName: 'Ops Staff' },
        transcript: 'Patient presents with severe sinusitis.',
        prescriptions: [{ name: 'Amoxicillin', dose: '500mg', route: 'Oral', frequency: 'TID' }],
        physicianDirective: 'I am overriding this safety check manually.',
        commitToFhir: false
      }),
      (err) => err instanceof ClinicalPipelineError && 
                err.code === 'UNAUTHORIZED_PHYSICIAN_OVERRIDE' && 
                err.status === 403
    );
  });

  await testAsync('AI Agent actor CANNOT issue physician override', async () => {
    await assert.rejects(
      async () => clinicalPipeline.execute({
        patientId: 'patient-auth-01',
        actor: { actorId: 'agent-auto-01', actorRole: 'agent', actorName: 'Auto Triage Agent' },
        transcript: 'Patient presents with severe pharyngitis.',
        prescriptions: [{ name: 'Augmentin', dose: '875mg', route: 'Oral', frequency: 'BID' }],
        physicianDirective: 'Automated agent safety override based on probability score.',
        commitToFhir: false
      }),
      (err) => err instanceof ClinicalPipelineError && 
                err.code === 'UNAUTHORIZED_PHYSICIAN_OVERRIDE' && 
                err.status === 403
    );
  });

  await testAsync('Physician directive rejected if trivial/too short (< 10 chars)', async () => {
    await assert.rejects(
      async () => clinicalPipeline.execute({
        patientId: 'patient-auth-01',
        actor: { actorId: 'usr-md-01', actorRole: 'physician', actorName: 'Dr. Valid, MD' },
        transcript: 'Patient presents with infection.',
        prescriptions: [{ name: 'Amoxicillin', dose: '500mg', route: 'Oral', frequency: 'TID' }],
        physicianDirective: 'override', // Only 8 chars
        commitToFhir: false
      }),
      (err) => err instanceof ClinicalPipelineError && 
                err.code === 'DIRECTIVE_TOO_SHORT' && 
                err.status === 400
    );
  });

  await testAsync('AI-suggested diagnoses are marked unconfirmed drafts and NOT committed as active FHIR Conditions', async () => {
    fhirService.adapter.setSyntheticStore({
      resourceType: 'Patient',
      id: 'patient-auth-02',
      name: [{ given: ['Bob'], family: 'Miller' }]
    });

    const result = await clinicalPipeline.execute({
      patientId: 'patient-auth-02',
      actor: { actorId: 'usr-md-01', actorRole: 'physician', actorName: 'Dr. Valid, MD' },
      transcript: 'Patient has mild dry cough and slight fatigue for 2 days.',
      commitToFhir: true,
      // No clinician confirmed conditions supplied!
      confirmedConditions: []
    });

    assert.strictEqual(result.success, true);
    // AI generated suggestions exist in structured output
    assert(result.output.suggestedDiagnoses.length > 0);
    for (const sug of result.output.suggestedDiagnoses) {
      assert.strictEqual(sug.status, 'PROPOSED_BY_AI');
      assert.strictEqual(sug.clinicianConfirmed, false);
    }

    // Inspect FHIR transaction bundle: MUST NOT contain Condition resources
    const encounterBundle = result.fhirTransaction;
    const persistedConditions = encounterBundle.entry.filter(e => e.resource.resourceType === 'Condition');
    assert.strictEqual(persistedConditions.length, 0, 'Unconfirmed AI diagnoses must NOT create active FHIR Conditions');
  });

  // --- SUITE 2: Patient Context Isolation ---
  console.log('\n--- SUITE 2: Patient Context Isolation ---');

  await testAsync('Pipeline rejects missing patient ID immediately', async () => {
    await assert.rejects(
      async () => clinicalPipeline.execute({ transcript: 'Hello doctor' }),
      (err) => err instanceof ClinicalPipelineError && err.code === 'PATIENT_ID_REQUIRED'
    );
  });

  await testAsync('Pipeline rejects non-existent patient with PATIENT_NOT_FOUND (404)', async () => {
    await assert.rejects(
      async () => clinicalPipeline.execute({
        patientId: 'patient-nonexistent-999',
        transcript: 'Patient routine visit.'
      }),
      (err) => err instanceof ClinicalPipelineError && err.code === 'PATIENT_NOT_FOUND' && err.status === 404
    );
  });

  await testAsync('Cross-patient tampering: Prescription targeting Patient B rejected during Patient A encounter', async () => {
    fhirService.adapter.setSyntheticStore({
      resourceType: 'Patient',
      id: 'patient-iso-A',
      name: [{ given: ['Patient'], family: 'A' }]
    });

    await assert.rejects(
      async () => clinicalPipeline.execute({
        patientId: 'patient-iso-A',
        transcript: 'Patient A visit.',
        prescriptions: [{
          name: 'Metformin',
          dose: '500mg',
          patientId: 'Patient/patient-iso-B' // Spoofed patient ID!
        }]
      }),
      (err) => err instanceof ClinicalPipelineError && 
                err.code === 'PATIENT_ID_MISMATCH' && 
                err.status === 400
    );
  });

  await testAsync('Cross-tenant isolation: Organization X actor cannot access Organization Y patient', async () => {
    fhirService.adapter.setSyntheticStore({
      resourceType: 'Patient',
      id: 'patient-tenant-hospital-Y',
      name: [{ given: ['Protected'], family: 'Patient' }],
      meta: {
        tag: [{ system: 'https://proton.health/tenant', code: 'hospital-Y' }]
      }
    });

    await assert.rejects(
      async () => clinicalPipeline.execute({
        patientId: 'patient-tenant-hospital-Y',
        actor: { actorId: 'usr-md-hospital-X', actorRole: 'physician', tenantId: 'hospital-X' },
        transcript: 'Unauthorized consultation attempt.'
      }),
      (err) => err instanceof ClinicalPipelineError && 
                err.code === 'CROSS_TENANT_ACCESS_DENIED' && 
                err.status === 403
    );
  });

  // --- SUITE 3: Safety Ordering & Deterministic Safety Engine ---
  console.log('\n--- SUITE 3: Safety Ordering & Deterministic Safety Engine ---');

  await testAsync('Safety check occurs BEFORE FHIR persistence and halts transaction on allergy hard stop', async () => {
    fhirService.adapter.setSyntheticStore({
      resourceType: 'Patient',
      id: 'patient-safety-order-01',
      name: [{ given: ['Edward'], family: 'Snow' }]
    });
    fhirService.adapter.setSyntheticStore({
      resourceType: 'AllergyIntolerance',
      id: 'all-order-01',
      subject: { reference: 'Patient/patient-safety-order-01' },
      code: { coding: [{ display: 'Penicillin' }] }
    });

    let transactionExecuted = false;

    await assert.rejects(
      async () => clinicalPipeline.execute({
        patientId: 'patient-safety-order-01',
        transcript: 'Patient has dental abscess.',
        prescriptions: [{ name: 'Amoxicillin', dose: '500mg', route: 'Oral', frequency: 'TID' }],
        commitToFhir: true
      }),
      (err) => {
        assert.strictEqual(err.stage, 'SAFETY_CHECK');
        assert.strictEqual(err.code, 'CONTRAINDICATION_HARD_STOP');
        return true;
      }
    );

    // Verify synthetic store was NEVER touched for this encounter
    for (const [key] of fhirService.adapter.syntheticStore.entries()) {
      if (key.includes('patient-safety-order-01') && key.startsWith('Encounter/')) {
        transactionExecuted = true;
      }
    }
    assert.strictEqual(transactionExecuted, false, 'FHIR transaction MUST NOT execute when safety gate fails');
  });

  test('Missing allergy context generates MISSING_ALLERGY_CONTEXT warning', () => {
    const report = safetyService.evaluatePrescriptionSafety({
      prescriptions: [{ name: 'Lisinopril', dose: '10mg', route: 'Oral', frequency: 'Daily' }],
      allergies: [], // Empty allergy list
      activeMedications: []
    });

    assert(report.warnings.some(w => w.type === 'MISSING_ALLERGY_CONTEXT'), 'Must flag missing allergy chart history');
  });

  test('Malformed prescription input (non-object or empty) is safely rejected with CRITICAL contraindication', () => {
    const report = safetyService.evaluatePrescriptionSafety({
      prescriptions: [null, undefined, 'not-an-object', { name: '' }],
      allergies: [],
      activeMedications: []
    });

    assert.strictEqual(report.passed, false);
    assert.strictEqual(report.hardStop, true);
    assert(report.contraindications.some(c => c.type === 'MALFORMED_PRESCRIPTION_INPUT'));
    assert(report.contraindications.some(c => c.type === 'INCOMPLETE_PRESCRIPTION'));
  });

  // --- SUITE 4: FHIR Atomic Transaction Failure & Rollback ---
  console.log('\n--- SUITE 4: FHIR Atomic Transaction Failure & Rollback ---');

  await testAsync('Atomic transaction failure rolls back cleanly and leaves no partial resources', async () => {
    fhirService.adapter.setSyntheticStore({
      resourceType: 'Patient',
      id: 'patient-rollback-01',
      name: [{ given: ['Rollback'], family: 'Patient' }]
    });

    const bundleWithFault = {
      resourceType: 'Bundle',
      type: 'transaction',
      id: 'bundle-fault-test',
      entry: [
        {
          resource: {
            resourceType: 'Encounter',
            id: 'enc-will-rollback-1',
            status: 'finished',
            subject: { reference: 'Patient/patient-rollback-01' }
          }
        },
        {
          resource: {
            resourceType: 'Observation',
            id: 'obs-will-fail-1',
            status: 'final',
            subject: { reference: 'Patient/patient-rollback-01' },
            code: { text: 'Fault injection' }
          }
        }
      ]
    };

    // The transaction pre-validates every entry before writing, so an invalid
    // resource never reaches persistence. To exercise the rollback path we must
    // inject a failure during the write phase, after the Encounter was committed.
    const adapter = fhirService.adapter;
    const originalPersist = adapter.persistResource.bind(adapter);
    adapter.persistResource = async (resource, options = {}) => {
      if (resource.resourceType === 'Observation') {
        throw new Error('Simulated persistence failure on second resource');
      }
      return originalPersist(resource, options);
    };

    try {
      await assert.rejects(
        () => fhirService.executeTransaction(bundleWithFault),
        (err) => err.message.includes('Simulated persistence failure')
      );
    } finally {
      adapter.persistResource = originalPersist;
    }

    // Verify Encounter was NOT partially stored
    const checkEncounter = await fhirService.adapter.getResource('Encounter', 'enc-will-rollback-1');
    assert.strictEqual(checkEncounter, null, 'Partial resource must NOT exist in store after atomic failure');
  });

  await testAsync('Atomic transaction pre-validation rejects invalid resources before any write', async () => {
    const invalidBundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      id: 'bundle-invalid-test',
      entry: [
        { resource: { resourceType: 'Encounter', id: 'enc-invalid-1', status: 'finished' } }
      ]
    };

    await assert.rejects(
      () => fhirService.executeTransaction(invalidBundle),
      (err) => err.message.includes('requires valid subject reference')
    );

    const persisted = await fhirService.adapter.getResource('Encounter', 'enc-invalid-1');
    assert.strictEqual(persisted, null, 'Invalid resource must never be written to the store');
  });

  // --- SUITE 5: Audit Integrity & Failure Logging ---
  console.log('\n--- SUITE 5: Audit Integrity & Failure Logging ---');

  await testAsync('Failed clinical pipeline execution immutably records FAILED audit event with error details', async () => {
    const testTenant = 'tenant-audit-fail-check';
    fhirService.adapter.setSyntheticStore({
      resourceType: 'Patient',
      id: 'patient-audit-fail-01',
      name: [{ given: ['Failed'], family: 'Patient' }]
    });
    fhirService.adapter.setSyntheticStore({
      resourceType: 'AllergyIntolerance',
      id: 'all-fail-01',
      subject: { reference: 'Patient/patient-audit-fail-01' },
      code: { coding: [{ display: 'Penicillin' }] }
    });

    try {
      await clinicalPipeline.execute({
        patientId: 'patient-audit-fail-01',
        transcript: 'Patient has strep throat.',
        prescriptions: [{ name: 'Amoxicillin', dose: '500mg', route: 'Oral', frequency: 'TID' }],
        tenantId: testTenant
      });
    } catch {
      // Expected to fail on CONTRAINDICATION_HARD_STOP
    }

    // Verify audit log has the event recorded
    const events = auditService.getEventsForPatient('patient-audit-fail-01', testTenant);
    assert(events.length > 0, 'Audit event must be logged even on pipeline failure');
    const failEvent = events[0];
    assert.strictEqual(failEvent.resultingState, 'PIPELINE_ERROR');
    assert(failEvent.summary.includes('Pipeline halted'));

    // Verify hash chain remains valid despite failure
    const chainVerification = auditService.verifyChain(testTenant);
    assert.strictEqual(chainVerification.valid, true, 'Audit hash chain must remain valid after failure logging');
  });

  // --- SUITE 6: Frontend Trust Boundary ---
  console.log('\n--- SUITE 6: Frontend Trust Boundary ---');

  await testAsync('Adversarial frontend cannot bypass safety check by supplying safetyStatus: VERIFIED', async () => {
    fhirService.adapter.setSyntheticStore({
      resourceType: 'Patient',
      id: 'patient-trust-01',
      name: [{ given: ['Hacker'], family: 'Client' }]
    });
    fhirService.adapter.setSyntheticStore({
      resourceType: 'AllergyIntolerance',
      id: 'all-trust-01',
      subject: { reference: 'Patient/patient-trust-01' },
      code: { coding: [{ display: 'Penicillin' }] }
    });

    await assert.rejects(
      async () => clinicalPipeline.execute({
        patientId: 'patient-trust-01',
        transcript: 'Bypass test.',
        prescriptions: [{
          name: 'Amoxicillin',
          dose: '500mg',
          route: 'Oral',
          frequency: 'TID',
          safetyStatus: 'VERIFIED' // Client claims it was already verified!
        }],
        commitToFhir: false
      }),
      (err) => err instanceof ClinicalPipelineError && 
                err.code === 'CONTRAINDICATION_HARD_STOP'
    );
  });

  console.log('\n====================================================================');
  console.log(`   INTEGRITY TEST RESULTS: ${passed}/${total} passed (${Math.round((passed/total)*100)}%)`);
  console.log('====================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runIntegrityTests().catch((err) => {
  console.error('Integrity test suite fatal error:', err);
  process.exit(1);
});
