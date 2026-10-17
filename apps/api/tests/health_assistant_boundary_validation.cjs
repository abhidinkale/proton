/**
 * Proton Health Assistant Domain Boundary & Clinical Invariants Validation Suite
 *
 * Verifies the architectural boundary between Proton Core and the Proton Health Assistant:
 * 1. Health Assistant role cannot commit active clinical resources to FHIR via clinicalPipeline.
 * 2. Patient role cannot commit active clinical resources to FHIR via clinicalPipeline.
 * 3. Health Assistant can request read-only clinical evaluation (commitToFhir: false).
 * 4. Patient intake processing tags facts as PATIENT_REPORTED and creates zero active FHIR Conditions.
 * 5. Deterministic safety contraindications halt Health Assistant workflows.
 * 6. Multimodal context assembler strictly isolates patient and tenant context.
 * 7. All 7 data classifications (PATIENT_REPORTED, CLINICIAN_ENTERED, AI_INFERRED, FHIR_EXISTING,
 *    DOCUMENT_DERIVED, IMAGE_DERIVED, VOICE_DERIVED) are formalized and properly attributed.
 */

const assert = require('assert');
const {
  clinicalPipeline,
  ClinicalPipelineError,
  clinicianConfirmationService,
  intakeService,
  multimodalContextService,
  SOURCE_ATTRIBUTIONS,
  safetyService,
  fhirService
} = require('../services');

async function runHealthAssistantBoundarySuite() {
  console.log('============================================================');
  console.log('PROTON HEALTH ASSISTANT DOMAIN BOUNDARY VALIDATION');
  console.log('============================================================\n');

  // Seed baseline synthetic clinical patient & allergies
  fhirService.adapter.setSyntheticStore({
    resourceType: 'Patient',
    id: 'eleanor-vance',
    name: [{ given: ['Eleanor'], family: 'Vance' }],
    birthDate: '1958-04-12',
    meta: {
      tag: [{ system: 'https://proton.health/tenant', code: 'org-default' }]
    }
  });

  fhirService.adapter.setSyntheticStore({
    resourceType: 'AllergyIntolerance',
    id: 'all-ev-boundary',
    subject: { reference: 'Patient/eleanor-vance' },
    code: { coding: [{ display: 'Penicillin' }] },
    criticality: 'high',
    meta: {
      tag: [{ system: 'https://proton.health/tenant', code: 'org-default' }]
    }
  });

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

  const healthAssistantActor = {
    actorId: 'assistant-nolla-01',
    actorRole: 'health_assistant',
    actorName: 'Proton Health Assistant',
    tenantId
  };

  const patientActor = {
    actorId: 'eleanor-vance',
    actorRole: 'patient',
    actorName: 'Eleanor Vance',
    tenantId
  };

  // Test 1: Health Assistant cannot commit active clinical resources to FHIR
  await test('Health Assistant role cannot commit clinical resources to FHIR via pipeline', async () => {
    let errorThrown = null;
    try {
      await clinicalPipeline.execute({
        patientId,
        tenantId,
        actor: healthAssistantActor,
        commitToFhir: true,
        transcript: 'Patient reports mild tension headache after screen time.'
      });
    } catch (err) {
      errorThrown = err;
    }
    assert(errorThrown !== null, 'Pipeline should have rejected health_assistant committing to FHIR');
    assert.strictEqual(errorThrown.code, 'CLINICIAN_AUTHORIZATION_REQUIRED');
    assert.strictEqual(errorThrown.status, 403);
  });

  // Test 2: Patient role cannot commit active clinical resources to FHIR
  await test('Patient role cannot commit clinical resources to FHIR via pipeline', async () => {
    let errorThrown = null;
    try {
      await clinicalPipeline.execute({
        patientId,
        tenantId,
        actor: patientActor,
        commitToFhir: true,
        transcript: 'Patient requests prescription for antibiotics.'
      });
    } catch (err) {
      errorThrown = err;
    }
    assert(errorThrown !== null, 'Pipeline should have rejected patient committing to FHIR');
    assert.strictEqual(errorThrown.code, 'CLINICIAN_AUTHORIZATION_REQUIRED');
    assert.strictEqual(errorThrown.status, 403);
  });

  // Test 3: Health Assistant can request clinical evaluation with commitToFhir: false
  await test('Health Assistant can request clinical evaluation when commitToFhir is false', async () => {
    const result = await clinicalPipeline.execute({
      patientId,
      tenantId,
      actor: healthAssistantActor,
      commitToFhir: false,
      transcript: 'Patient reports mild headache that resolves with rest.'
    });
    assert(result.success === true, 'Read-only pipeline evaluation should succeed');
    assert.strictEqual(result.fhirTransaction, null, 'No FHIR transaction should be created');
    assert(result.safety !== undefined, 'Safety assessment must be provided');
  });

  // Test 4: Patient intake responses create zero active FHIR Conditions
  await test('Patient intake creates QuestionnaireResponse with PATIENT_REPORTED attribution and 0 active Conditions', async () => {
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

    const intakeResult = await intakeService.processSubmission({
      questionnaireId: 'questionnaire-derm-intake-v1',
      patientId,
      items: validItems,
      actor: { patientId, role: 'patient', tenantId },
      tenantId
    });

    assert(intakeResult.success === true, 'Intake processing should succeed');
    assert(intakeResult.intakeContext.facts.length > 0, 'Intake facts should be extracted');
    assert.strictEqual(intakeResult.intakeContext.facts[0].source, 'patient_reported');

    // Confirm that intake did not autonomously create any active Condition in FHIR store
    const patientContext = await fhirService.getPatientClinicalContext(patientId, tenantId);
    const rashCondition = (patientContext.conditions || []).find(
      c => (c.code?.coding?.[0]?.display || c.display || '').toLowerCase().includes('rash')
    );
    assert.strictEqual(rashCondition, undefined, 'Intake must NEVER autonomously create active Conditions in FHIR');
  });

  // Test 5: Deterministic safety contraindications halt Health Assistant workflows
  await test('Deterministic safety contraindications halt Health Assistant pipeline requests', async () => {
    let errorThrown = null;
    try {
      await clinicalPipeline.execute({
        patientId,
        tenantId,
        actor: healthAssistantActor,
        commitToFhir: false,
        transcript: 'Patient with known severe penicillin allergy requests prescription for Amoxicillin 500mg.',
        prescriptions: [
          {
            patientId,
            medicationName: 'Amoxicillin',
            dose: '500mg',
            frequency: 'three times daily'
          }
        ]
      });
    } catch (err) {
      errorThrown = err;
    }
    assert(errorThrown !== null, 'Allergy contraindication hard-stop must halt transaction');
    assert.strictEqual(errorThrown.code, 'CONTRAINDICATION_HARD_STOP');
  });

  // Test 6: Cross-patient and cross-tenant context isolation enforced
  await test('Multimodal context assembly fails closed on cross-patient context mismatch', async () => {
    let errorThrown = null;
    try {
      await multimodalContextService.assembleContext({
        patientId: 'eleanor-vance',
        tenantId: 'org-default',
        intakeContext: {
          patientId: 'other-patient-999',
          tenantId: 'org-default',
          facts: []
        }
      });
    } catch (err) {
      errorThrown = err;
    }
    assert(errorThrown !== null, 'Should fail closed on cross-patient mismatch');
    assert.strictEqual(errorThrown.code, 'CROSS_PATIENT_ACCESS_DENIED');
  });

  // Test 7: Formal Data Classification schema contains all 7 canonical categories
  await test('Formal data classification schema contains all 7 canonical categories', async () => {
    const expected = [
      'PATIENT_REPORTED',
      'CLINICIAN_ENTERED',
      'AI_INFERRED',
      'FHIR_EXISTING',
      'DOCUMENT_DERIVED',
      'IMAGE_DERIVED',
      'VOICE_DERIVED'
    ];
    for (const category of expected) {
      assert(SOURCE_ATTRIBUTIONS[category] === category, `Missing data classification: ${category}`);
    }
  });

  console.log('\n============================================================');
  console.log(`HEALTH ASSISTANT BOUNDARY SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runHealthAssistantBoundarySuite().catch(err => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
  });
}

module.exports = { runHealthAssistantBoundarySuite };
