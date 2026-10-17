/**
 * Proton Multimodal E2E Smoke Verification Script
 * Validates the complete unified pipeline end-to-end:
 * Intake + Document + Voice + Vision -> Context -> AI Synthesis -> Safety -> Stream -> Clinician Review -> FHIR Persistence + Audit.
 */

const assert = require('assert');
const {
  fhirService,
  auditService,
  multimodalContextService,
  documentService,
  voiceService,
  evidenceService,
  clinicalPipeline,
  streamManager,
  clinicianConfirmationService,
  longitudinalService
} = require('../services');

async function runE2ESmoke() {
  console.log('============================================================');
  console.log('PROTON V2 — END-TO-END MULTIMODAL WORKFLOW VERIFICATION');
  console.log('============================================================\n');

  const tenantId = 'org-default';
  const patientId = 'eleanor-vance';
  const encounterId = `enc-e2e-${Date.now()}`;
  const physicianActor = {
    actorId: 'usr-md-e2e-01',
    actorRole: 'physician',
    actorName: 'Dr. Sarah Lin, MD',
    tenantId
  };

  // 1. Seed Synthetic Patient in FHIR store
  console.log('[Step 1] Seeding patient and baseline record...');
  fhirService.adapter.setSyntheticStore({
    resourceType: 'Patient',
    id: patientId,
    name: [{ given: ['Eleanor'], family: 'Vance' }],
    gender: 'female',
    birthDate: '1984-06-15',
    meta: {
      tag: [{ system: 'https://proton.health/tenant', code: tenantId }]
    }
  });

  // Seed baseline AllergyIntolerance: Penicillin
  fhirService.adapter.setSyntheticStore({
    resourceType: 'AllergyIntolerance',
    id: 'allergy-penicillin-e2e',
    subject: { reference: `Patient/${patientId}` },
    patient: { reference: `Patient/${patientId}` },
    clinicalStatus: { coding: [{ code: 'active' }] },
    code: { coding: [{ code: '7980', display: 'Penicillin' }] },
    criticality: 'high',
    meta: {
      tag: [{ system: 'https://proton.health/tenant', code: tenantId }]
    }
  });

  // 2. Intake context
  console.log('[Step 2] Processing intake responses...');
  const intakeResponses = {
    chiefComplaint: 'Worsening fatigue, mild polyuria, and localized skin rash',
    duration: '3 weeks',
    severity: 'moderate'
  };

  // 3. Document Processing (Lab PDF)
  console.log('[Step 3] Ingesting external lab report...');
  const samplePdf = Buffer.from('%PDF-1.4 Comprehensive Metabolic Panel: Fasting Plasma Glucose: 138 mg/dL, HbA1c: 7.2%, Creatinine: 0.9 mg/dL');
  const docResult = await documentService.processDocument({
    buffer: samplePdf,
    mimeType: 'application/pdf',
    filename: 'lab_report.pdf',
    patientId,
    encounterId,
    tenantId,
    actor: physicianActor
  });
  assert.ok(docResult.documentId);
  assert.ok(Array.isArray(docResult.facts));

  // 4. Voice Transcription (Clinical Note Audio)
  console.log('[Step 4] Transcribing encounter clinical dialogue...');
  const sampleAudio = Buffer.alloc(1024, 0x11);
  const voiceResult = await voiceService.transcribeAudio({
    audioBuffer: sampleAudio,
    mimeType: 'audio/webm',
    patientId,
    encounterId,
    speakerRole: 'clinician',
    tenantId,
    actor: physicianActor
  });
  assert.ok(voiceResult.transcriptionId);
  assert.ok(voiceResult.text.length > 0);

  // 5. Vision Finding (FHIR Media)
  console.log('[Step 5] Processing clinical vision findings...');
  const visionFinding = {
    finding: 'Localized erythematous annular plaque with mild scaling',
    confidence: 0.88,
    uncertainty: 'Low-to-moderate',
    differential: ['Tinea corporis', 'Nummular eczema'],
    mediaId: 'med-e2e-rash-01',
    provenance: {
      sourceMediaId: 'med-e2e-rash-01',
      model: 'proton-clinical-vision-v2'
    }
  };

  // 6. Multimodal Context Assembly
  console.log('[Step 6] Assembling multimodal clinical context...');
  const context = await multimodalContextService.assembleContext({
    patientId,
    encounterId,
    intakeContext: intakeResponses,
    transcript: voiceResult.text,
    documents: [docResult],
    visionFindings: [visionFinding],
    tenantId,
    actor: physicianActor
  });

  assert.strictEqual(context.patient.id, patientId);
  assert.ok(context.longitudinalContext.allergies.some(a => a.substance === 'Penicillin'));
  assert.strictEqual(context.documentContext.totalDocuments, 1);
  assert.strictEqual(context.visionContext.totalAnalyses, 1);

  // 7. Clinical Pipeline Streaming Execution
  console.log('[Step 7] Executing clinical pipeline with real-time SSE stream...');
  const stream = streamManager.createStream({
    patientId,
    encounterId,
    actor: physicianActor,
    operation: 'MULTIMODAL_E2E_SYNTHESIS'
  });

  const pipelineResult = await clinicalPipeline.execute({
    patientId,
    encounterId,
    intakeContext: intakeResponses,
    transcript: voiceResult.text,
    documents: [docResult],
    visionFindings: [visionFinding],
    actor: physicianActor,
    tenantId,
    commitToFhir: false
  }, {
    onEvent: (type, payload) => {
      streamManager.publishEvent(stream.streamId, type, payload);
    }
  });

  assert.strictEqual(pipelineResult.success, true);
  assert.ok(pipelineResult.output);
  assert.ok(pipelineResult.output.differential.length > 0);
  assert.strictEqual(pipelineResult.output.differential[0].status, 'unconfirmed');

  // Verify INVARIANT: Zero active Condition or MedicationRequest autonomously committed
  const conditions = await fhirService.adapter.searchResources('Condition', { patient: `Patient/${patientId}` });
  assert.strictEqual(conditions.length, 0, 'INVARIANT: Zero active Condition committed before physician confirmation');
  const meds = await fhirService.adapter.searchResources('MedicationRequest', { patient: `Patient/${patientId}` });
  assert.strictEqual(meds.length, 0, 'INVARIANT: Zero MedicationRequest committed before physician confirmation');

  // 8. Stream Lifecycle Verification
  console.log('[Step 8] Verifying SSE event stream timeline...');
  const events = streamManager.getEventsAfter(stream.streamId, 0);
  const eventTypes = events.map(e => e.type);
  assert.ok(eventTypes.includes('MULTIMODAL_CONTEXT_STARTED'));
  assert.ok(eventTypes.includes('EVIDENCE_RETRIEVAL_COMPLETE'));
  assert.ok(eventTypes.includes('AI_ANALYSIS_COMPLETE'));
  assert.ok(eventTypes.includes('SAFETY_CHECK_STARTED'));
  assert.ok(eventTypes.includes('CLINICAL_OUTPUT_READY'));
  assert.ok(eventTypes.includes('STREAM_COMPLETE'));
  console.log(`✓ Stream recorded ${events.length} sequenced events.`);

  // 9. Clinician Review & Confirmation
  console.log('[Step 9] Clinician confirms primary diagnosis & orders medication...');
  const confDiag = await clinicianConfirmationService.confirmDiagnosis({
    encounterId,
    patientId,
    actor: physicianActor,
    diagnosis: {
      code: 'E11.9',
      display: 'Type 2 diabetes mellitus without complications',
      clinicalStatus: 'active'
    },
    action: 'ACCEPT',
    rationale: 'Confirmed fasting plasma glucose > 126 mg/dL and elevated HbA1c per ADA guideline.'
  });
  assert.strictEqual(confDiag.success, true);
  const statusStr = confDiag.activeCondition.clinicalStatus?.coding?.[0]?.code || confDiag.activeCondition.clinicalStatus;
  assert.strictEqual(statusStr, 'active');

  // Try ordering Amoxicillin (Penicillin allergy) -> should be rejected by safety check
  console.log('[Step 10] Testing allergy contraindication hard-stop on clinician order...');
  await assert.rejects(
    async () => {
      await clinicianConfirmationService.confirmMedication({
        encounterId,
        patientId,
        actor: physicianActor,
        medication: {
          name: 'Amoxicillin',
          dose: '500mg'
        },
        action: 'ACCEPT'
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'CONTRAINDICATION_HARD_STOP');
      assert.strictEqual(err.status, 422);
      return true;
    }
  );
  console.log('✓ Penicillin contraindication correctly halted Amoxicillin order.');

  // Order Metformin (safe)
  console.log('[Step 11] Ordering safe first-line medication (Metformin)...');
  const safeMed = await clinicianConfirmationService.confirmMedication({
    encounterId,
    patientId,
    actor: physicianActor,
    medication: {
      name: 'Metformin',
      dose: '500mg daily'
    },
    action: 'ACCEPT',
    rationale: 'First-line monotherapy for T2D per ADA clinical practice guideline.'
  });
  assert.strictEqual(safeMed.success, true);
  assert.strictEqual(safeMed.activeMedicationRequest.status, 'active');

  // 12. Verify Audit Chain
  console.log('[Step 12] Verifying tamper-evident audit trail...');
  const auditVerification = auditService.verifyChain(tenantId);
  assert.strictEqual(auditVerification.valid, true);
  const count = auditVerification.totalEventsVerified || auditVerification.checkedEvents || 0;
  console.log(`✓ Audit chain cryptographically verified: ${count} blocks intact.`);

  console.log('\n============================================================');
  console.log('✓ ALL MULTIMODAL E2E VERIFICATION STEPS PASSED (100%)');
  console.log('============================================================\n');
}

runE2ESmoke().catch(err => {
  console.error('E2E Verification Failed:', err);
  process.exit(1);
});
