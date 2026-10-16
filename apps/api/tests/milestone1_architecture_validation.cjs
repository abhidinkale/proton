/**
 * Milestone 1 Architecture & Canonical Clinical Pipeline Verification Test
 * 
 * Verifies:
 * 1. Strict rejection of empty/invalid audio input (TRANSCRIPTION_INPUT_INVALID)
 *    and complete eradication of silent fake clinical transcription fallbacks.
 * 2. Canonical clinical pipeline execution (all 8 stages explicit and sequenced).
 * 3. Deterministic clinical safety engine (allergy contraindications, DDI, dose limits).
 * 4. Safety hard stop enforcement and clinician override governance.
 * 5. FHIR atomic transaction bundle generation and error handling.
 * 6. Cryptographic audit provenance chaining.
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

async function runMilestone1Tests() {
  console.log('====================================================================');
  console.log('   PROTON V2 MILESTONE 1 — ARCHITECTURE & CLINICAL PIPELINE TESTS  ');
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

  // --- SUITE 1: Input Validation & Eradication of Silent Mock Fallback ---
  console.log('--- SUITE 1: Audio Validation & Mock Fallback Rejection ---');

  test('Null or undefined audio buffer throws TRANSCRIPTION_INPUT_INVALID (HTTP 400)', () => {
    assert.throws(
      () => mediaService.validateAudioInput(null),
      (err) => err instanceof TranscriptionInputError && err.code === 'TRANSCRIPTION_INPUT_INVALID' && err.status === 400
    );
  });

  test('Sub-minimal audio buffer (< 64 bytes) throws TRANSCRIPTION_INPUT_INVALID', () => {
    const tinyBuffer = Buffer.from('RIFF1234');
    assert.throws(
      () => mediaService.validateAudioInput(tinyBuffer),
      (err) => err instanceof TranscriptionInputError && err.code === 'TRANSCRIPTION_INPUT_INVALID'
    );
  });

  test('Unsupported audio MIME type throws MediaValidationError', () => {
    const fakeBuffer = Buffer.alloc(128);
    assert.throws(
      () => mediaService.validateAudioInput(fakeBuffer, 'application/pdf'),
      (err) => err instanceof MediaValidationError && err.code === 'UNSUPPORTED_AUDIO_FORMAT'
    );
  });

  test('Valid audio buffer passes validation', () => {
    const validBuffer = Buffer.alloc(1024);
    const res = mediaService.validateAudioInput(validBuffer, 'audio/webm');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.size, 1024);
    assert.strictEqual(res.mimeType, 'audio/webm');
  });

  // --- SUITE 2: Deterministic Clinical Safety Engine ---
  console.log('\n--- SUITE 2: Deterministic Clinical Safety Engine ---');

  test('Penicillin allergy contraindicates Amoxicillin prescription (CRITICAL hard stop)', () => {
    const report = safetyService.evaluatePrescriptionSafety({
      prescriptions: [{ name: 'Amoxicillin', dose: '500mg', route: 'Oral', frequency: 'Three times daily' }],
      allergies: ['Penicillin Allergy (Severe anaphylaxis)'],
      activeMedications: []
    });

    assert.strictEqual(report.passed, false, 'Should fail safety verification');
    assert.strictEqual(report.hardStop, true, 'Must trigger hard stop');
    assert.strictEqual(report.contraindications.length, 1);
    assert.strictEqual(report.contraindications[0].ruleId, 'RULE_ALLERGY_PEN_AMOX');
    assert.strictEqual(report.contraindications[0].severity, 'CRITICAL');
  });

  test('Penicillin allergy flags Cephalosporin cross-reactivity warning (HIGH)', () => {
    const report = safetyService.evaluatePrescriptionSafety({
      prescriptions: [{ name: 'Cephalexin', dose: '500mg', route: 'Oral', frequency: 'Twice daily' }],
      allergies: ['Penicillin'],
      activeMedications: []
    });

    assert.strictEqual(report.passed, false);
    const cephWarning = report.contraindications.find(c => c.ruleId === 'RULE_ALLERGY_PEN_CEPH_CROSS');
    assert(cephWarning, 'Must detect cephalosporin cross-reactivity rule');
    assert.strictEqual(cephWarning.severity, 'HIGH');
  });

  test('Drug-drug interaction: Warfarin + Ibuprofen detected with bleeding warning', () => {
    const report = safetyService.evaluatePrescriptionSafety({
      prescriptions: [{ name: 'Ibuprofen', dose: '400mg', route: 'Oral', frequency: 'Every 6 hours' }],
      allergies: [],
      activeMedications: ['Warfarin 5mg daily']
    });

    assert.strictEqual(report.passed, false);
    const ddi = report.contraindications.find(c => c.ruleId === 'DDI_WARFARIN_NSAID');
    assert(ddi, 'Must detect Warfarin + NSAID interaction');
  });

  test('Dose ceiling: Acetaminophen > 4000mg/day triggers CRITICAL hard stop', () => {
    const report = safetyService.evaluatePrescriptionSafety({
      prescriptions: [{ name: 'Acetaminophen', strength: '1000mg', dose: '1000mg', route: 'Oral', frequency: 'Every 4 hours (four times daily)' }],
      allergies: [],
      activeMedications: []
    });

    // 1000mg * 4 = 4000mg -> hardStopMg is 4000
    // Try 1500mg * 4 = 6000mg
    const reportOver = safetyService.evaluatePrescriptionSafety({
      prescriptions: [{ name: 'Acetaminophen', strength: '1500mg', dose: '1500mg', route: 'Oral', frequency: 'Four times daily' }],
      allergies: [],
      activeMedications: []
    });
    assert.strictEqual(reportOver.hardStop, true);
    assert(reportOver.contraindications.some(c => c.type === 'DOSE_LIMIT_EXCEEDED'));
  });

  test('Missing dose, route, or frequency yields structural completeness warnings', () => {
    const report = safetyService.evaluatePrescriptionSafety({
      prescriptions: [{ name: 'Lisinopril' }], // missing dose, route, frequency
      allergies: [],
      activeMedications: []
    });

    assert(report.warnings.some(w => w.message.includes('Dose is missing')));
    assert(report.warnings.some(w => w.message.includes('Frequency is missing')));
    assert(report.warnings.some(w => w.message.includes('Route of administration is missing')));
  });

  // --- SUITE 3: FHIR R4 Atomic Transaction Bundling ---
  console.log('\n--- SUITE 3: FHIR R4 Atomic Transaction Bundles ---');

  test('Creates valid FHIR R4 Bundle with type transaction', () => {
    const bundle = fhirService.buildEncounterBundle({
      patientId: 'patient-123',
      practitionerId: 'Practitioner/dr-smith',
      encounterId: 'enc-test-1',
      noteText: 'SOAP Note contents',
      conditions: ['Hypertension'],
      prescriptions: [{ name: 'Lisinopril', dose: '10mg', route: 'Oral', frequency: 'Daily' }]
    });

    assert.strictEqual(bundle.resourceType, 'Bundle');
    assert.strictEqual(bundle.type, 'transaction');
    assert(bundle.entry.length >= 4, 'Should include Encounter, Impression, Condition, MedicationRequest, Provenance');

    const encounterEntry = bundle.entry.find(e => e.resource.resourceType === 'Encounter');
    assert(encounterEntry, 'Bundle must contain Encounter');
    assert.strictEqual(encounterEntry.request.method, 'PUT');

    const provenanceEntry = bundle.entry.find(e => e.resource.resourceType === 'Provenance');
    assert(provenanceEntry, 'Bundle must contain Provenance');
  });

  await testAsync('Executes atomic transaction bundle in synthetic persistence mode', async () => {
    const bundle = fhirService.buildEncounterBundle({
      patientId: 'patient-synt-1',
      practitionerId: 'Practitioner/dr-synt',
      noteText: 'Ambulatory visit',
      conditions: ['Acute Bronchitis'],
      prescriptions: []
    });

    const response = await fhirService.executeTransaction(bundle);
    assert.strictEqual(response.resourceType, 'Bundle');
    assert.strictEqual(response.type, 'transaction-response');
    assert(response.entry.length > 0);
  });

  // --- SUITE 4: Canonical 8-Stage Clinical Pipeline ---
  console.log('\n--- SUITE 4: Canonical 8-Stage Clinical Pipeline ---');

  await testAsync('Pipeline enforces strict validation when missing patientId', async () => {
    await assert.rejects(
      async () => clinicalPipeline.execute({ transcript: 'Hello doctor' }),
      (err) => err instanceof ClinicalPipelineError && err.code === 'PATIENT_ID_REQUIRED'
    );
  });

  await testAsync('Pipeline enforces strict validation when no transcript or audio provided', async () => {
    await assert.rejects(
      async () => clinicalPipeline.execute({ patientId: 'patient-001' }),
      (err) => err instanceof ClinicalPipelineError && err.code === 'NO_CLINICAL_INPUT'
    );
  });

  await testAsync('Pipeline executes all 8 stages cleanly with text input', async () => {
    // Populate synthetic patient in fhirService
    fhirService.adapter.setSyntheticStore({
      resourceType: 'Patient',
      id: 'patient-401',
      name: [{ given: ['Jane'], family: 'Doe' }],
      birthDate: '1985-04-12'
    });

    const result = await clinicalPipeline.execute({
      patientId: 'patient-401',
      practitionerId: 'Practitioner/dr-clara',
      transcript: 'Doctor: How is your cough? Patient: It has been lingering for 3 days with mild chest congestion.',
      prescriptions: [{
        name: 'Guaifenesin',
        dose: '400mg',
        route: 'Oral',
        frequency: 'Every 4 hours PRN',
        duration: '5 days'
      }],
      commitToFhir: true,
      tenantId: 'test-tenant'
    });

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.stagesExecuted, [
      'INPUT',
      'VALIDATION',
      'CLINICAL_CONTEXT',
      'AI_ANALYSIS',
      'SAFETY_CHECK',
      'STRUCTURED_OUTPUT',
      'FHIR_TRANSACTION',
      'AUDIT_PROVENANCE'
    ]);
    assert(result.output.soapNote);
    assert(result.provenance.currentHash);
  });

  await testAsync('Pipeline halts with CONTRAINDICATION_HARD_STOP on critical safety violation without override', async () => {
    // Populate patient with Penicillin allergy in synthetic store
    fhirService.adapter.setSyntheticStore({
      resourceType: 'Patient',
      id: 'patient-allergic-99',
      name: [{ given: ['Robert'], family: 'Brown' }]
    });
    fhirService.adapter.setSyntheticStore({
      resourceType: 'AllergyIntolerance',
      id: 'all-99',
      subject: { reference: 'Patient/patient-allergic-99' },
      code: { coding: [{ display: 'Penicillin' }] }
    });

    await assert.rejects(
      async () => clinicalPipeline.execute({
        patientId: 'patient-allergic-99',
        transcript: 'Patient has sinus infection.',
        prescriptions: [{
          name: 'Amoxicillin',
          dose: '500mg',
          route: 'Oral',
          frequency: 'Three times daily'
        }],
        commitToFhir: true
      }),
      (err) => err instanceof ClinicalPipelineError && err.code === 'CONTRAINDICATION_HARD_STOP'
    );
  });

  await testAsync('Pipeline permits execution if clinician explicitly supplies directive override', async () => {
    const result = await clinicalPipeline.execute({
      patientId: 'patient-allergic-99',
      actor: { actorId: 'usr-md-clara-01', actorRole: 'physician', actorName: 'Dr. Clara, MD', tenantId: 'test-tenant' },
      transcript: 'Patient has sinus infection with skin test negative confirmation.',
      prescriptions: [{
        name: 'Amoxicillin',
        dose: '500mg',
        route: 'Oral',
        frequency: 'Three times daily'
      }],
      physicianDirective: 'Direct oral challenge confirmed allergy resolution. Desensitization completed in clinic.',
      commitToFhir: true,
      tenantId: 'test-tenant'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.safety.hardStop, true);
    assert(result.stagesExecuted.includes('AUDIT_PROVENANCE'));
  });

  // --- SUITE 5: Cryptographic Audit Chain Integrity ---
  console.log('\n--- SUITE 5: Cryptographic Audit Trail Chaining ---');

  test('Audit chain for test-tenant is cryptographically valid and tamper-evident', () => {
    const verification = auditService.verifyChain('test-tenant');
    assert.strictEqual(verification.valid, true, 'Audit hash chain must be strictly valid');
    assert(verification.totalEventsVerified >= 2, 'Should contain at least 2 events in chain');
  });

  console.log('\n====================================================================');
  console.log(`   TEST RESULTS: ${passed}/${total} passed (${Math.round((passed/total)*100)}%)`);
  console.log('====================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runMilestone1Tests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
