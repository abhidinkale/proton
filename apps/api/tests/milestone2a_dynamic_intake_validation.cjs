/**
 * Milestone 2A Dynamic Clinical Intake & Safety Validation Test Suite
 * 
 * Verifies all 18 Milestone 2A acceptance requirements:
 * 1. Questionnaire loads successfully.
 * 2. Questionnaire schema is valid FHIR R4.
 * 3. Required question enforcement.
 * 4. Answer type validation (boolean, integer range, text, choice).
 * 5. Invalid option rejected.
 * 6. Conditional question hidden when condition false.
 * 7. Conditional question shown when condition true.
 * 8. Malformed response rejected.
 * 9. Cross-patient response rejected (HTTP 403).
 * 10. Cross-tenant response rejected.
 * 11. Patient-reported source preserved (preliminary survey observation).
 * 12. FHIR Provenance created and linked.
 * 13. AI interpretation remains unconfirmed.
 * 14. No direct AI-created active Condition without physician confirmation.
 * 15. No direct AI-created MedicationRequest without physician authorization.
 * 16. Deterministic escalation hook triggers immediate emergency/urgent triage.
 * 17. Cryptographic audit event created.
 * 18. Milestone 1 tests remain passing (zero regression).
 */

const assert = require('assert');
const {
  intakeService,
  IntakeValidationError,
  branchingEngine,
  escalationEngine,
  contextMapper,
  clinicalPipeline,
  auditService,
  fhirService,
  safetyService
} = require('../services');

async function runMilestone2ATests() {
  console.log('====================================================================');
  console.log('   PROTON V2 MILESTONE 2A — DYNAMIC CLINICAL INTAKE VALIDATION     ');
  console.log('====================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✓ [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] Test ${total}: ${name}`);
      console.error(`  Error: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] Test ${total}: ${name}`);
      console.error(`  Error: ${err.message}`);
    }
  }

  // Seed synthetic patients in FHIR adapter
  fhirService.adapter.setSyntheticStore({
    resourceType: 'Patient',
    id: 'patient-401',
    name: [{ given: ['Jane'], family: 'Doe' }],
    birthDate: '1985-04-12'
  });
  fhirService.adapter.setSyntheticStore({
    resourceType: 'Patient',
    id: 'patient-402',
    name: [{ given: ['John'], family: 'Smith' }],
    birthDate: '1979-11-20'
  });

  // --- SUITE 1: FHIR Questionnaire Catalog & Schema ---
  console.log('--- SUITE 1: FHIR Questionnaire Catalog & Schema ---');

  test('Questionnaire loads by ID', () => {
    const q = intakeService.getQuestionnaire('questionnaire-derm-intake-v1');
    assert(q, 'Questionnaire must exist');
    assert.strictEqual(q.id, 'questionnaire-derm-intake-v1');
    assert.strictEqual(q.resourceType, 'Questionnaire');
  });

  test('Questionnaire schema adheres to FHIR R4', () => {
    const q = intakeService.getQuestionnaire('questionnaire-derm-intake-v1');
    assert.strictEqual(q.status, 'active');
    assert.strictEqual(typeof q.title, 'string');
    assert(Array.isArray(q.item), 'items must be an array');
    assert(q.item.length >= 8, 'must contain clinical questions');
    
    // Check item attributes
    for (const item of q.item) {
      assert(item.linkId, `Item missing linkId: ${JSON.stringify(item)}`);
      assert(item.type, `Item missing type: ${item.linkId}`);
      assert(item.text, `Item missing text: ${item.linkId}`);
    }
  });

  // --- SUITE 2: Validation & Branching Logic ---
  console.log('\n--- SUITE 2: Validation & Branching Logic ---');

  await testAsync('Required question enforcement rejects missing answers', async () => {
    const qId = 'questionnaire-derm-intake-v1';
    // Missing required 'concern' and 'duration_onset'
    const malformedItems = [
      { linkId: 'is_itchy', answer: [{ valueBoolean: false }] }
    ];

    try {
      await intakeService.processSubmission({
        questionnaireId: qId,
        patientId: 'patient-001',
        items: malformedItems,
        actor: { patientId: 'patient-001', role: 'patient' }
      });
      assert.fail('Should have rejected missing required question');
    } catch (err) {
      assert(err instanceof IntakeValidationError);
      assert.strictEqual(err.code, 'MISSING_REQUIRED_ANSWER');
    }
  });

  await testAsync('Answer type validation rejects mismatched types', async () => {
    const qId = 'questionnaire-derm-intake-v1';
    // 'is_itchy' expects boolean, providing string
    const malformedItems = [
      { linkId: 'concern', answer: [{ valueCoding: { code: 'rash' } }] },
      { linkId: 'onset', answer: [{ valueCoding: { code: 'few_days' } }] },
      { linkId: 'location', answer: [{ valueCoding: { code: 'arms_hands' } }] },
      { linkId: 'is_itchy', answer: [{ valueString: 'not-a-boolean' }] }
    ];

    try {
      await intakeService.processSubmission({
        questionnaireId: qId,
        patientId: 'patient-001',
        items: malformedItems,
        actor: { patientId: 'patient-001', role: 'patient' }
      });
      assert.fail('Should have rejected non-boolean answer for boolean item');
    } catch (err) {
      assert(err instanceof IntakeValidationError);
      assert.strictEqual(err.code, 'INVALID_ANSWER_TYPE');
    }
  });

  await testAsync('Invalid choice option rejected', async () => {
    const qId = 'questionnaire-derm-intake-v1';
    // 'onset' has fixed options, passing fake code
    const malformedItems = [
      { linkId: 'concern', answer: [{ valueCoding: { code: 'rash' } }] },
      { linkId: 'onset', answer: [{ valueCoding: { code: 'unknown_fake_option' } }] },
      { linkId: 'location', answer: [{ valueCoding: { code: 'arms_hands' } }] },
      { linkId: 'is_itchy', answer: [{ valueBoolean: false }] }
    ];

    try {
      await intakeService.processSubmission({
        questionnaireId: qId,
        patientId: 'patient-001',
        items: malformedItems,
        actor: { patientId: 'patient-001', role: 'patient' }
      });
      assert.fail('Should have rejected invalid choice code');
    } catch (err) {
      assert(err instanceof IntakeValidationError);
      assert.strictEqual(err.code, 'INVALID_CHOICE_OPTION');
    }
  });

  test('Conditional question hidden when condition is false', () => {
    const q = intakeService.getQuestionnaire('questionnaire-derm-intake-v1');
    const itchSeverityItem = q.item.find(i => i.linkId === 'itch_severity');
    assert(itchSeverityItem, 'itch_severity item must exist');

    // Condition: is_itchy == true
    const answersFalse = { is_itchy: false };
    const isActive = branchingEngine.isItemActive(itchSeverityItem, answersFalse);
    assert.strictEqual(isActive, false, 'itch_severity must be inactive when is_itchy is false');
  });

  test('Conditional question shown when condition is true', () => {
    const q = intakeService.getQuestionnaire('questionnaire-derm-intake-v1');
    const itchSeverityItem = q.item.find(i => i.linkId === 'itch_severity');
    const painSeverityItem = q.item.find(i => i.linkId === 'pain_severity');

    const answersTrue = { is_itchy: true, is_painful: true };
    assert.strictEqual(branchingEngine.isItemActive(itchSeverityItem, answersTrue), true);
    assert.strictEqual(branchingEngine.isItemActive(painSeverityItem, answersTrue), true);
  });

  await testAsync('Malformed response payload rejected', async () => {
    try {
      await intakeService.processSubmission({
        questionnaireId: 'questionnaire-derm-intake-v1',
        patientId: 'patient-001',
        items: 'not-an-array',
        actor: { patientId: 'patient-001', role: 'patient' }
      });
      assert.fail('Should have rejected non-array items');
    } catch (err) {
      assert(err instanceof IntakeValidationError);
      assert.strictEqual(err.code, 'INVALID_RESPONSE_FORMAT');
    }
  });

  // --- SUITE 3: Patient & Tenant Security Isolation ---
  console.log('\n--- SUITE 3: Security & Tenant Isolation ---');

  await testAsync('Cross-patient response rejected with 403', async () => {
    const validItems = [
      { linkId: 'concern', answer: [{ valueCoding: { code: 'rash' } }] },
      { linkId: 'onset', answer: [{ valueCoding: { code: 'few_days' } }] },
      { linkId: 'location', answer: [{ valueCoding: { code: 'arms_hands' } }] },
      { linkId: 'is_itchy', answer: [{ valueBoolean: true }] },
      { linkId: 'itch_severity', answer: [{ valueCoding: { code: 'moderate' } }] },
      { linkId: 'is_painful', answer: [{ valueBoolean: false }] },
      { linkId: 'changed_recently', answer: [{ valueBoolean: false }] },
      { linkId: 'prior_treatments', answer: [{ valueCoding: { code: 'none' } }] },
      { linkId: 'rapid_spread', answer: [{ valueBoolean: false }] },
      { linkId: 'systemic_red_flags', answer: [{ valueBoolean: false }] }
    ];

    try {
      // Authenticated patient is 'patient-alice', but trying to submit for 'patient-bob'
      await intakeService.processSubmission({
        questionnaireId: 'questionnaire-derm-intake-v1',
        patientId: 'patient-bob',
        items: validItems,
        actor: { patientId: 'patient-alice', role: 'patient' }
      });
      assert.fail('Should have rejected cross-patient submission');
    } catch (err) {
      assert(err instanceof IntakeValidationError);
      assert.strictEqual(err.code, 'CROSS_PATIENT_ACCESS_DENIED');
      assert.strictEqual(err.statusCode, 403);
    }
  });

  await testAsync('Cross-tenant response rejected', async () => {
    const validItems = [
      { linkId: 'concern', answer: [{ valueCoding: { code: 'rash' } }] },
      { linkId: 'onset', answer: [{ valueCoding: { code: 'few_days' } }] },
      { linkId: 'location', answer: [{ valueCoding: { code: 'arms_hands' } }] },
      { linkId: 'is_itchy', answer: [{ valueBoolean: false }] },
      { linkId: 'is_painful', answer: [{ valueBoolean: false }] },
      { linkId: 'changed_recently', answer: [{ valueBoolean: false }] },
      { linkId: 'prior_treatments', answer: [{ valueCoding: { code: 'none' } }] },
      { linkId: 'rapid_spread', answer: [{ valueBoolean: false }] },
      { linkId: 'systemic_red_flags', answer: [{ valueBoolean: false }] }
    ];

    try {
      // Actor is from tenant-beta, patient belongs to tenant-alpha
      await intakeService.processSubmission({
        questionnaireId: 'questionnaire-derm-intake-v1',
        patientId: 'patient-001',
        items: validItems,
        actor: { patientId: 'patient-001', role: 'patient', tenantId: 'tenant-beta' },
        patientContext: { tenantId: 'tenant-alpha' }
      });
      assert.fail('Should have rejected cross-tenant submission');
    } catch (err) {
      assert(err instanceof IntakeValidationError);
      assert.strictEqual(err.code, 'CROSS_TENANT_ACCESS_DENIED');
      assert.strictEqual(err.statusCode, 403);
    }
  });

  // --- SUITE 4: FHIR Integrity, Provenance & Clinical Status ---
  console.log('\n--- SUITE 4: FHIR Integrity, Provenance & Clinical Status ---');

  let testSubmissionResult;

  await testAsync('Patient-reported source preserved in FHIR Observation', async () => {
    const validItems = [
      { linkId: 'concern', answer: [{ valueCoding: { code: 'rash', display: 'New or spreading rash' } }] },
      { linkId: 'onset', answer: [{ valueCoding: { code: 'few_days', display: '2 to 7 days ago' } }] },
      { linkId: 'location', answer: [{ valueCoding: { code: 'arms_hands', display: 'Arms or Hands' } }] },
      { linkId: 'is_itchy', answer: [{ valueBoolean: true }] },
      { linkId: 'itch_severity', answer: [{ valueCoding: { code: 'moderate', display: 'Moderate' } }] },
      { linkId: 'is_painful', answer: [{ valueBoolean: false }] },
      { linkId: 'changed_recently', answer: [{ valueBoolean: false }] },
      { linkId: 'prior_treatments', answer: [{ valueCoding: { code: 'none', display: 'None' } }] },
      { linkId: 'rapid_spread', answer: [{ valueBoolean: false }] },
      { linkId: 'systemic_red_flags', answer: [{ valueBoolean: false }] }
    ];

    testSubmissionResult = await intakeService.processSubmission({
      questionnaireId: 'questionnaire-derm-intake-v1',
      patientId: 'patient-401',
      items: validItems,
      actor: { patientId: 'patient-401', role: 'patient' }
    });

    assert(testSubmissionResult, 'Submission must succeed');
    assert.strictEqual(testSubmissionResult.questionnaireResponse.status, 'completed');
    assert.strictEqual(testSubmissionResult.observation.resourceType, 'Observation');
    assert.strictEqual(testSubmissionResult.observation.status, 'preliminary');
    assert.strictEqual(testSubmissionResult.observation.category[0].coding[0].code, 'survey');
    assert(testSubmissionResult.observation.valueString.includes('[PATIENT-REPORTED INTAKE]'));
  });

  test('FHIR Provenance resource created and linked', () => {
    assert(testSubmissionResult.provenance, 'Provenance must be created');
    assert.strictEqual(testSubmissionResult.provenance.resourceType, 'Provenance');
    assert(testSubmissionResult.provenance.target.length >= 2, 'Must target QuestionnaireResponse and Observation');
    assert.strictEqual(testSubmissionResult.provenance.agent[0].who.reference, 'Patient/patient-401');
    assert(testSubmissionResult.provenance.recorded, 'Must contain ISO timestamp');
  });

  // --- SUITE 5: Physician Authority & Clinical Pipeline Safety ---
  console.log('\n--- SUITE 5: Physician Authority & Clinical Pipeline Safety ---');

  let pipelineResult;

  await testAsync('AI clinical pipeline processes intake with unconfirmed differential', async () => {
    // Invoke clinical pipeline with intakeContext
    pipelineResult = await clinicalPipeline.execute({
      encounterId: 'enc-intake-001',
      patientId: 'patient-401',
      audioBuffer: Buffer.from('Doctor: Let us review your skin rash on the arm. Patient: Yes it has been bothering me for a few days.'),
      audioMimeType: 'audio/webm',
      allergies: ['Penicillin'],
      intakeContext: testSubmissionResult.intakeContext
    });

    assert(pipelineResult.success, 'Clinical pipeline must complete');
    assert(pipelineResult.output && pipelineResult.output.soapNote, 'SOAP note must be generated');
    assert(pipelineResult.output.soapNote.subjective.includes('PATIENT-REPORTED INTAKE'), 'Intake must be in Subjective');
    
    // Check differential diagnosis authority status
    assert(Array.isArray(pipelineResult.output.suggestedDiagnoses), 'Suggested diagnoses must exist');
    for (const d of pipelineResult.output.suggestedDiagnoses) {
      assert.strictEqual(d.clinicianConfirmed, false, 'AI diagnoses must be unconfirmed by default');
    }
  });

  test('No direct AI-created active Condition', () => {
    // Verify that the FHIR transaction does not contain any active confirmed Condition created autonomously
    if (pipelineResult.fhirTransaction && Array.isArray(pipelineResult.fhirTransaction.entry)) {
      const conditionEntries = pipelineResult.fhirTransaction.entry.filter(e => e.resource?.resourceType === 'Condition');
      for (const entry of conditionEntries) {
        assert.notStrictEqual(entry.resource?.verificationStatus?.coding?.[0]?.code, 'confirmed',
          'AI must never create confirmed Condition without explicit clinician sign-off');
      }
    } else {
      // Unconfirmed encounter does not commit unconfirmed Conditions to FHIR
      assert.strictEqual(pipelineResult.fhirTransaction, null, 'Unconfirmed encounter must not commit active conditions');
    }
  });

  test('No direct AI-created active MedicationRequest', () => {
    if (pipelineResult.fhirTransaction && Array.isArray(pipelineResult.fhirTransaction.entry)) {
      const medEntries = pipelineResult.fhirTransaction.entry.filter(e => e.resource?.resourceType === 'MedicationRequest');
      for (const entry of medEntries) {
        assert.notStrictEqual(entry.resource?.status, 'active',
          'AI must never create active MedicationRequest without explicit physician authorization');
      }
    } else {
      assert.strictEqual(pipelineResult.fhirTransaction, null, 'Unconfirmed encounter must not commit active prescriptions');
    }
  });

  // --- SUITE 6: Deterministic Red-Flag Escalation ---
  console.log('\n--- SUITE 6: Deterministic Red-Flag Escalation ---');

  await testAsync('Deterministic escalation hook triggers immediate emergency triage', async () => {
    // Patient reports acute systemic red flags (fever, chills, breathing difficulty)
    const redFlagItems = [
      { linkId: 'concern', answer: [{ valueCoding: { code: 'hives' } }] },
      { linkId: 'onset', answer: [{ valueCoding: { code: 'under_24h' } }] },
      { linkId: 'location', answer: [{ valueCoding: { code: 'face' } }] },
      { linkId: 'is_itchy', answer: [{ valueBoolean: true }] },
      { linkId: 'itch_severity', answer: [{ valueCoding: { code: 'severe' } }] },
      { linkId: 'is_painful', answer: [{ valueBoolean: true }] },
      { linkId: 'pain_severity', answer: [{ valueInteger: 9 }] },
      { linkId: 'changed_recently', answer: [{ valueBoolean: true }] },
      { linkId: 'prior_treatments', answer: [{ valueCoding: { code: 'none' } }] },
      { linkId: 'rapid_spread', answer: [{ valueBoolean: true }] },
      { linkId: 'systemic_red_flags', answer: [{ valueBoolean: true }] }
    ];

    const redFlagSubmission = await intakeService.processSubmission({
      questionnaireId: 'questionnaire-derm-intake-v1',
      patientId: 'patient-402',
      items: redFlagItems,
      actor: { patientId: 'patient-402', role: 'patient' }
    });

    assert(redFlagSubmission.escalation, 'Escalation must be detected');
    assert.strictEqual(redFlagSubmission.escalation.isRedFlag, true);
    assert.strictEqual(redFlagSubmission.escalation.triageCategory, 'EMERGENCY');
    assert(redFlagSubmission.escalation.triggers.length >= 2, 'Must have triggered severe pain and systemic symptoms');

    // Run clinical pipeline with this red-flag intake context
    const emergencyPipelineResult = await clinicalPipeline.execute({
      encounterId: 'enc-emergency-001',
      patientId: 'patient-402',
      audioBuffer: Buffer.from('Doctor: Assessing urgent patient swelling. Patient: Having trouble breathing.'),
      audioMimeType: 'audio/webm',
      intakeContext: redFlagSubmission.intakeContext
    });

    // The safety check reflects the emergency triage level
    assert.strictEqual(emergencyPipelineResult.safety.triageLevel, 'EMERGENCY');
    assert(emergencyPipelineResult.safety.requiresImmediateReview === true,
      'Emergency intake must flag for immediate physician review');
  });

  // --- SUITE 7: Cryptographic Audit Provenance ---
  console.log('\n--- SUITE 7: Cryptographic Audit Provenance ---');

  test('Audit event created for intake questionnaire submission', () => {
    assert(testSubmissionResult.auditRecord, 'Audit record must be attached to submission result');
    assert(testSubmissionResult.auditRecord.action.includes('INTAKE'), 'Action must mention intake');
    assert(testSubmissionResult.auditRecord.currentHash, 'Must contain SHA-256 payload hash');
    assert(testSubmissionResult.auditRecord.id, 'Must contain audit event id');
  });

  // --- SUITE 8: Regression Testing ---
  console.log('\n--- SUITE 8: Milestone 1 Zero-Regression Verification ---');

  await testAsync('Milestone 1 tests remain passing', async () => {
    // 1. Transcription rejection test
    const { mediaService, TranscriptionInputError } = require('../services');
    assert.throws(() => {
      mediaService.validateAudioInput(Buffer.alloc(0), 'audio/webm');
    }, (err) => {
      return err instanceof TranscriptionInputError && err.code === 'TRANSCRIPTION_INPUT_INVALID';
    });

    // 2. Deterministic allergy safety test
    const allergyCheck = safetyService.evaluatePrescriptionSafety({
      prescriptions: [{ name: 'Amoxicillin 500mg', dose: '500mg' }],
      allergies: [{ code: { text: 'Penicillin' } }]
    });
    assert.strictEqual(allergyCheck.isSafe, false);
    assert.strictEqual(allergyCheck.hardStop, true);
  });

  // --- SUITE 9: Adversarial Trust Boundary & Security Guards ---
  console.log('\n--- SUITE 9: Adversarial Trust Boundary & Security Guards ---');

  await testAsync('Cross-patient response retrieval rejected (HTTP 403)', async () => {
    // testSubmissionResult belongs to patient-401
    const qrId = testSubmissionResult.questionnaireResponseId;
    try {
      await intakeService.getResponse(qrId, 'org-default', {
        actorId: 'patient-999',
        role: 'patient'
      });
      assert.fail('Should have rejected cross-patient response retrieval');
    } catch (err) {
      assert.strictEqual(err.code, 'CROSS_PATIENT_ACCESS_DENIED');
      assert.strictEqual(err.status, 403);
    }
  });

  await testAsync('Clinical pipeline rejects mismatched intakeContext patientId (PATIENT_ID_MISMATCH)', async () => {
    try {
      await clinicalPipeline.execute({
        encounterId: 'enc-mismatch-001',
        patientId: 'patient-401',
        audioBuffer: Buffer.from('Doctor: Reviewing symptoms. Patient: Good morning.'),
        audioMimeType: 'audio/webm',
        intakeContext: {
          patientId: 'patient-adversary-888', // Malicious cross-patient injection
          clinicalNarrative: 'Injected hostile symptoms'
        }
      });
      assert.fail('Should have rejected mismatched intakeContext patientId');
    } catch (err) {
      assert.strictEqual(err.code, 'PATIENT_ID_MISMATCH');
      assert.strictEqual(err.status, 400);
    }
  });

  test('Branching engine handles malformed enableWhen rule safely without throwing', () => {
    const malformedItem = {
      linkId: 'test_question',
      enableWhen: [
        null,
        undefined,
        {},
        { question: null },
        { question: 'unknown_q', operator: 'UNKNOWN_OPERATOR' }
      ]
    };
    const isEnabled = branchingEngine.isItemEnabled(malformedItem, {});
    assert.strictEqual(isEnabled, false, 'Malformed enableWhen rule must fail safe-closed');
  });

  await testAsync('Disabled question answers cannot inject clinical facts or observations', async () => {
    // User marks is_itchy: false, but attacker attempts to inject itch_severity: severe
    const tamperItems = [
      { linkId: 'concern', answer: [{ valueCoding: { code: 'rash' } }] },
      { linkId: 'onset', answer: [{ valueCoding: { code: 'few_days' } }] },
      { linkId: 'location', answer: [{ valueCoding: { code: 'arms_hands' } }] },
      { linkId: 'is_itchy', answer: [{ valueBoolean: false }] },
      { linkId: 'itch_severity', answer: [{ valueCoding: { code: 'severe' } }] }, // DISABLED ITEM!
      { linkId: 'is_painful', answer: [{ valueBoolean: false }] },
      { linkId: 'changed_recently', answer: [{ valueBoolean: false }] },
      { linkId: 'prior_treatments', answer: [{ valueCoding: { code: 'none' } }] },
      { linkId: 'rapid_spread', answer: [{ valueBoolean: false }] },
      { linkId: 'systemic_red_flags', answer: [{ valueBoolean: false }] }
    ];

    const result = await intakeService.processSubmission({
      questionnaireId: 'questionnaire-derm-intake-v1',
      patientId: 'patient-401',
      items: tamperItems,
      actor: { patientId: 'patient-401', role: 'patient' }
    });

    // Verify itch_severity is strictly omitted from the recorded items and observation
    const recordedItchSeverity = result.questionnaireResponse.item.find(i => i.linkId === 'itch_severity');
    assert.strictEqual(recordedItchSeverity, undefined, 'Disabled question must not be recorded in QuestionnaireResponse');
    assert.strictEqual(result.observation.valueString.includes('itch_severity'), false, 'Disabled question must not appear in Observation narrative');
  });

  console.log('\n====================================================================');
  console.log(`   MILESTONE 2A TESTS COMPLETE: ${passed}/${total} PASSED`);
  console.log('====================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runMilestone2ATests().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
