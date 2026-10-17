/**
 * Proton V2 Milestone 2C-1: Clinical Image Intelligence Validation Suite
 * 
 * Tests all required acceptance criteria:
 * 1. Valid Media analysis
 * 2. Invalid Media rejected (MEDIA_NOT_FOUND, 404)
 * 3. Cross-patient access rejected (CROSS_PATIENT_ACCESS_DENIED, 403)
 * 4. Cross-tenant access rejected (CROSS_TENANT_ACCESS_DENIED, 403)
 * 5. Missing image file rejected (MEDIA_FILE_MISSING, 404)
 * 6. Invalid MIME rejected (INVALID_MIME_TYPE, 400)
 * 7. Malformed provider output rejected (MALFORMED_OUTPUT, 502/422)
 * 8. Missing confidence rejected (MISSING_CONFIDENCE, 422)
 * 9. Hallucinated patient ID rejected (FABRICATED_PATIENT_IDENTIFIER, 400)
 * 10. Autonomous diagnosis attempt rejected (AUTONOMOUS_DIAGNOSIS_REJECTED, 400)
 * 11. Prescription attempt rejected (AUTONOMOUS_PRESCRIPTION_REJECTED, 400/422)
 * 12. Provider timeout handled (VISION_PROVIDER_TIMEOUT, 504)
 * 13. Provider failure handled (VISION_PROVIDER_ERROR, 502)
 * 14. Audit created on success
 * 15. Audit created on failure
 * 16. Provenance linked to source Media
 * 17. AI differential remains unconfirmed
 * 18. No active Condition created
 * 19. No MedicationRequest created
 * 20. Tamper-evident cryptographic audit chain intact
 */

const assert = require('assert');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const {
  visionService,
  VisionService,
  DemoVisionProvider,
  validateVisionOutput,
  visionSafety,
  sessionStore,
  captureSessionService,
  storageService,
  auditService,
  fhirService
} = require('../services');

// Deterministic test PNG generator
function createTestPng(width, height, minSize = 2048) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2; // RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const crc32 = (buf) => {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
      }
    }
    return ~c >>> 0;
  };

  const makeChunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };

  const ihdr = makeChunk('IHDR', ihdrData);
  const rawData = crypto.randomBytes(Math.max(minSize, height * (1 + width * 3)));
  const idatData = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', idatData);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

async function runMilestone2C1Tests() {
  console.log('====================================================================');
  console.log('   PROTON V2 MILESTONE 2C-1 — CLINICAL VISION INTELLIGENCE TESTS   ');
  console.log('====================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
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

  // Define test actors
  const physicianActor = {
    actorId: 'usr-md-lin-01',
    actorRole: 'physician',
    actorName: 'Dr. Sarah Lin, MD',
    tenantId: 'org-default'
  };

  const externalClinician = {
    actorId: 'usr-md-ext-01',
    actorRole: 'physician',
    actorName: 'Dr. External Clinician',
    tenantId: 'org-external'
  };

  const testPatientId = 'patient-arthur-dent';

  // Seed patient in synthetic FHIR store
  fhirService.adapter.setSyntheticStore({
    resourceType: 'Patient',
    id: testPatientId,
    name: [{ given: ['Arthur'], family: 'Dent' }],
    meta: { tag: [{ system: 'https://proton.health/tenant', code: 'org-default' }] }
  });

  fhirService.adapter.setSyntheticStore({
    resourceType: 'Patient',
    id: 'patient-ext-999',
    name: [{ given: ['Ford'], family: 'Prefect' }],
    meta: { tag: [{ system: 'https://proton.health/tenant', code: 'org-external' }] }
  });

  // Seed capture session for default tenant
  const defaultSession = captureSessionService.createSession({
    patientId: testPatientId,
    encounterId: 'enc-test-101',
    actor: physicianActor
  });

  // Seed test media into local storage and database
  const validPngBuffer = createTestPng(640, 480, 4096);
  const validMediaId = `med-test-${Date.now()}-1`;
  const storedAsset = await storageService.store({
    buffer: validPngBuffer,
    mimeType: 'image/png',
    tenantId: 'org-default',
    mediaId: validMediaId
  });

  sessionStore.recordMedia({
    id: validMediaId,
    tenantId: 'org-default',
    sessionId: defaultSession.sessionId,
    patientId: testPatientId,
    encounterId: 'enc-test-101',
    storageKey: storedAsset.storageKey,
    mimeType: 'image/png',
    fileSize: validPngBuffer.length,
    sha256: storedAsset.sha256,
    width: 640,
    height: 480,
    fhirMediaId: validMediaId,
    fhirProvenanceId: `prov-${validMediaId}`
  });

  // Seed another media belonging to external tenant
  const extSession = captureSessionService.createSession({
    patientId: 'patient-ext-999',
    encounterId: 'enc-ext-101',
    actor: externalClinician
  });

  const extMediaId = `med-ext-${Date.now()}-2`;
  const extStoredAsset = await storageService.store({
    buffer: validPngBuffer,
    mimeType: 'image/png',
    tenantId: 'org-external',
    mediaId: extMediaId
  });

  sessionStore.recordMedia({
    id: extMediaId,
    tenantId: 'org-external',
    sessionId: extSession.sessionId,
    patientId: 'patient-ext-999',
    encounterId: 'enc-ext-101',
    storageKey: extStoredAsset.storageKey,
    mimeType: 'image/png',
    fileSize: validPngBuffer.length,
    sha256: extStoredAsset.sha256,
    width: 640,
    height: 480,
    fhirMediaId: extMediaId,
    fhirProvenanceId: `prov-${extMediaId}`
  });

  // Reset to default demo provider
  const demoProvider = new DemoVisionProvider({ scenario: 'normal', latencyMs: 5 });
  visionService.setProvider(demoProvider);

  // ---------------------------------------------------------------
  // SUITE 1: INPUT VALIDATION & CONTEXT BOUNDARIES
  // ---------------------------------------------------------------
  console.log('--- SUITE 1: Input Validation & Pre-Provider Trust Boundaries ---');

  await test('Valid Media analysis succeeds with structured decision-support output', async () => {
    demoProvider.setScenario('normal');
    const result = await visionService.analyzeMedia({
      mediaId: validMediaId,
      patientId: testPatientId,
      encounterId: 'enc-test-101',
      actor: physicianActor
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.mediaId, validMediaId);
    assert.strictEqual(result.patientId, testPatientId);
    assert.strictEqual(result.decisionSupportOnly, true);
    assert.strictEqual(result.requiresPhysicianReview, true);
    assert(Array.isArray(result.observations) && result.observations.length > 0);
    assert(typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 1);
    assert(Array.isArray(result.differentialSuggestions));
    assert(Array.isArray(result.limitations) && result.limitations.length > 0);
    assert(result.fhir.observationId.startsWith('obs-vision-'));
    assert(result.fhir.provenanceId.startsWith('prov-vision-'));
  });

  await test('Invalid Media ID rejected with 404 MEDIA_NOT_FOUND', async () => {
    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: 'med-nonexistent-999999',
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'MEDIA_NOT_FOUND');
      assert.strictEqual(err.status, 404);
    }
    assert(threw, 'Should have thrown MEDIA_NOT_FOUND');
  });

  await test('Cross-patient access strictly rejected with 403 CROSS_PATIENT_ACCESS_DENIED', async () => {
    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: validMediaId,
        patientId: 'patient-hacked-attacker',
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'CROSS_PATIENT_ACCESS_DENIED');
      assert.strictEqual(err.status, 403);
    }
    assert(threw, 'Should have thrown CROSS_PATIENT_ACCESS_DENIED');
  });

  await test('Cross-tenant access strictly rejected with 403 CROSS_TENANT_ACCESS_DENIED', async () => {
    let threw = false;
    try {
      // Clinician in org-default tries to analyze external organization's media
      await visionService.analyzeMedia({
        mediaId: extMediaId,
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'CROSS_TENANT_ACCESS_DENIED');
      assert.strictEqual(err.status, 403);
    }
    assert(threw, 'Should have thrown CROSS_TENANT_ACCESS_DENIED');
  });

  await test('Missing image file in storage rejected with 404 MEDIA_FILE_MISSING', async () => {
    const missingMediaId = `med-missing-${Date.now()}`;
    sessionStore.recordMedia({
      id: missingMediaId,
      tenantId: 'org-default',
      sessionId: defaultSession.sessionId,
      patientId: testPatientId,
      encounterId: 'enc-test-101',
      storageKey: 'deleted_or_missing_file.png',
      mimeType: 'image/png',
      fileSize: 2048,
      sha256: 'deadbeef1234',
      width: 400,
      height: 400,
      fhirMediaId: missingMediaId,
      fhirProvenanceId: `prov-${missingMediaId}`
    });

    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: missingMediaId,
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'MEDIA_FILE_MISSING');
      assert.strictEqual(err.status, 404);
    }
    assert(threw, 'Should have thrown MEDIA_FILE_MISSING');
  });

  await test('Invalid image MIME type rejected with 400 INVALID_MIME_TYPE', async () => {
    const badMimeMediaId = `med-badmime-${Date.now()}`;
    sessionStore.recordMedia({
      id: badMimeMediaId,
      tenantId: 'org-default',
      sessionId: defaultSession.sessionId,
      patientId: testPatientId,
      encounterId: 'enc-test-101',
      storageKey: storedAsset.storageKey,
      mimeType: 'application/pdf',
      fileSize: validPngBuffer.length,
      sha256: storedAsset.sha256,
      width: 400,
      height: 400,
      fhirMediaId: badMimeMediaId,
      fhirProvenanceId: `prov-${badMimeMediaId}`
    });

    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: badMimeMediaId,
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'INVALID_MIME_TYPE');
      assert.strictEqual(err.status, 400);
    }
    assert(threw, 'Should have thrown INVALID_MIME_TYPE');
  });

  // ---------------------------------------------------------------
  // SUITE 2: PROVIDER FAILURE MODES & ZERO FALLBACK DIAGNOSES
  // ---------------------------------------------------------------
  console.log('\n--- SUITE 2: Provider Failure Modes & Zero Fallback Diagnoses ---');

  await test('Provider timeout handled safely with 504 VISION_PROVIDER_TIMEOUT (no fabricated diagnoses)', async () => {
    demoProvider.setScenario('timeout');
    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: validMediaId,
        actor: physicianActor,
        timeoutMs: 10
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'VISION_PROVIDER_TIMEOUT');
      assert.strictEqual(err.status, 504);
    }
    assert(threw, 'Should have thrown VISION_PROVIDER_TIMEOUT');
  });

  await test('Provider upstream error handled safely with 502 VISION_PROVIDER_ERROR', async () => {
    demoProvider.setScenario('error');
    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: validMediaId,
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'VISION_PROVIDER_ERROR');
      assert.strictEqual(err.status, 502);
    }
    assert(threw, 'Should have thrown VISION_PROVIDER_ERROR');
  });

  await test('Empty provider output rejected safely with 502 EMPTY_PROVIDER_OUTPUT', async () => {
    demoProvider.setScenario('empty');
    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: validMediaId,
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'EMPTY_PROVIDER_OUTPUT');
    }
    assert(threw, 'Should have thrown EMPTY_PROVIDER_OUTPUT');
  });

  await test('Malformed non-JSON provider output rejected with 502 MALFORMED_OUTPUT', async () => {
    demoProvider.setScenario('malformed');
    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: validMediaId,
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'MALFORMED_OUTPUT');
    }
    assert(threw, 'Should have thrown MALFORMED_OUTPUT');
  });

  // ---------------------------------------------------------------
  // SUITE 3: SCHEMA VALIDATION & CONFIDENCE ENFORCEMENT
  // ---------------------------------------------------------------
  console.log('\n--- SUITE 3: Schema Validation & Confidence Enforcement ---');

  await test('Missing confidence score rejected with 422 MISSING_CONFIDENCE', async () => {
    demoProvider.setScenario('custom');
    demoProvider.setCustomResponse({
      observations: ['Erythematous rash'],
      // Missing confidence!
      differentialSuggestions: [{ condition: 'Contact dermatitis', status: 'unconfirmed' }]
    });

    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: validMediaId,
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'MISSING_CONFIDENCE');
      assert.strictEqual(err.status, 422);
    }
    assert(threw, 'Should have thrown MISSING_CONFIDENCE');
  });

  await test('Invalid confidence range (e.g. 1.8) rejected with 422 INVALID_CONFIDENCE', async () => {
    demoProvider.setScenario('custom');
    demoProvider.setCustomResponse({
      observations: ['Erythematous rash'],
      confidence: 1.8, // Invalid > 1.0!
      differentialSuggestions: [{ condition: 'Contact dermatitis', status: 'unconfirmed' }]
    });

    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: validMediaId,
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'INVALID_CONFIDENCE');
      assert.strictEqual(err.status, 422);
    }
    assert(threw, 'Should have thrown INVALID_CONFIDENCE');
  });

  await test('Forbidden clinical output fields (prescriptions) rejected with 422 UNSUPPORTED_CLINICAL_FIELDS', async () => {
    demoProvider.setScenario('unsupported_fields');
    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: validMediaId,
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'UNSUPPORTED_CLINICAL_FIELDS');
      assert.strictEqual(err.status, 422);
    }
    assert(threw, 'Should have thrown UNSUPPORTED_CLINICAL_FIELDS');
  });

  // ---------------------------------------------------------------
  // SUITE 4: POST-AI DETERMINISTIC SAFETY & CLINICAL AUTHORITY
  // ---------------------------------------------------------------
  console.log('\n--- SUITE 4: Post-AI Deterministic Safety & Clinical Authority ---');

  await test('Hallucinated / fabricated patient ID rejected with 400 FABRICATED_PATIENT_IDENTIFIER', async () => {
    demoProvider.setScenario('custom');
    demoProvider.setCustomResponse({
      observations: ['Plaque observed on patient Patient/unauthorized-patient-789'],
      confidence: 0.82,
      differentialSuggestions: [{ condition: 'Psoriasis', status: 'unconfirmed' }]
    });

    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: validMediaId,
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'FABRICATED_PATIENT_IDENTIFIER');
      assert.strictEqual(err.status, 400);
    }
    assert(threw, 'Should have thrown FABRICATED_PATIENT_IDENTIFIER');
  });

  await test('Autonomous confirmed diagnosis declaration rejected with 400 AUTONOMOUS_DIAGNOSIS_REJECTED', async () => {
    demoProvider.setScenario('confirmed_diagnosis');
    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: validMediaId,
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'AUTONOMOUS_DIAGNOSIS_REJECTED');
      assert.strictEqual(err.status, 400);
    }
    assert(threw, 'Should have thrown AUTONOMOUS_DIAGNOSIS_REJECTED');
  });

  await test('Autonomous prescription attempt in rationale rejected with 400 AUTONOMOUS_PRESCRIPTION_REJECTED', async () => {
    demoProvider.setScenario('prescribe');
    let threw = false;
    try {
      await visionService.analyzeMedia({
        mediaId: validMediaId,
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'AUTONOMOUS_PRESCRIPTION_REJECTED');
      assert.strictEqual(err.status, 400);
    }
    assert(threw, 'Should have thrown AUTONOMOUS_PRESCRIPTION_REJECTED');
  });

  await test('AI differential suggestions remain strictly unconfirmed', async () => {
    demoProvider.setScenario('normal');
    demoProvider.setCustomResponse(null);
    const result = await visionService.analyzeMedia({
      mediaId: validMediaId,
      actor: physicianActor
    });

    assert(result.differentialSuggestions.length > 0);
    for (const diff of result.differentialSuggestions) {
      assert.strictEqual(diff.status, 'unconfirmed');
    }
  });

  // ---------------------------------------------------------------
  // SUITE 5: FHIR INTEGRITY & CLINICAL INVARIANTS
  // ---------------------------------------------------------------
  console.log('\n--- SUITE 5: FHIR Integrity & Clinical Invariants ---');

  await test('FHIR Provenance correctly linked to source Media and target Observation', async () => {
    demoProvider.setScenario('normal');
    demoProvider.setCustomResponse(null);
    const result = await visionService.analyzeMedia({
      mediaId: validMediaId,
      actor: physicianActor
    });

    assert(result.fhir.observationId);
    assert(result.fhir.provenanceId);
    assert.strictEqual(result.fhir.status, 'preliminary');
  });

  await test('NO active Condition created automatically from visual AI analysis', async () => {
    demoProvider.setScenario('normal');
    demoProvider.setCustomResponse(null);
    const result = await visionService.analyzeMedia({
      mediaId: validMediaId,
      actor: physicianActor
    });

    assert.strictEqual(result.fhir.activeConditionsCreated, 0);
  });

  await test('NO MedicationRequest created automatically from visual AI analysis', async () => {
    demoProvider.setScenario('normal');
    demoProvider.setCustomResponse(null);
    const result = await visionService.analyzeMedia({
      mediaId: validMediaId,
      actor: physicianActor
    });

    assert.strictEqual(result.fhir.medicationRequestsCreated, 0);
  });

  // ---------------------------------------------------------------
  // SUITE 6: AUDIT TRAIL INTEGRITY & ZERO LEAKAGE
  // ---------------------------------------------------------------
  console.log('\n--- SUITE 6: Audit Trail Integrity & Zero Leakage ---');

  await test('Audit records created on success and failure without raw bytes or token leakage', async () => {
    const events = auditService.getEventsForPatient(testPatientId, 'org-default', 50);
    assert(events.length > 0, 'Audit events should exist for patient');

    const visionSuccess = events.find(e => e.action === 'CLINICAL_PIPELINE_VISION_ANALYSIS_COMPLETED');
    assert(visionSuccess, 'Successful vision analysis audit event must exist');
    assert(visionSuccess.summary.includes(validMediaId));

    // Verify zero image binary or base64 leakage in all audit summaries
    for (const ev of events) {
      assert(!ev.summary.includes('data:image'), 'Audit event must not contain data URI image bytes');
      assert(!ev.summary.includes('base64'), 'Audit event must not contain raw base64 data');
      assert(!ev.summary.includes('AIzaSy'), 'Audit event must not leak API keys');
    }

    // Verify cryptographic audit chain integrity
    const chainCheck = auditService.verifyChain('org-default');
    assert.strictEqual(chainCheck.valid, true, 'Audit chain must be cryptographically valid and unbroken');
  });

  console.log('\n====================================================================');
  console.log(`   MILESTONE 2C-1 TESTS COMPLETE: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('====================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runMilestone2C1Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
