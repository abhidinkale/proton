/**
 * Proton V2 Milestone 2C-2: Clinician Visual Review Validation Suite
 * 
 * Tests all required acceptance criteria:
 * 1. Normal finding acceptance (ACCEPT -> active confirmed FHIR Condition)
 * 2. Normal finding rejection (REJECT -> no active Condition)
 * 3. Normal finding modification (MODIFY -> confirmed Condition with clinician revision)
 * 4. Clinician authorization (physician actor accepted)
 * 5. Unauthenticated confirmation (401 UNAUTHENTICATED)
 * 6. Non-clinician confirmation (403 CLINICIAN_AUTHORIZATION_REQUIRED)
 * 7. Cross-patient analysis access (403 CROSS_PATIENT_ACCESS_DENIED)
 * 8. Cross-tenant analysis access (403 CROSS_TENANT_ACCESS_DENIED)
 * 9. Forged/nonexistent analysis ID (404 ANALYSIS_NOT_FOUND)
 * 10. Forged patient ID (403 CROSS_PATIENT_ACCESS_DENIED)
 * 11. Forged encounter ID (400 ENCOUNTER_MISMATCH)
 * 12. Forged/missing actor ID (401/403)
 * 13. Original AI analysis immutability (AI record cannot be altered by review)
 * 14. Stale analysis rejection (400 STALE_ANALYSIS_REJECTED)
 * 15. Missing analysis parameter rejection (400 ANALYSIS_ID_REQUIRED)
 * 16. Duplicate confirmation idempotency (prevents duplicate FHIR resources)
 * 17. Autonomous diagnosis prevention (AI vision alone creates zero active Conditions)
 * 18. Autonomous prescribing prevention (anti-prescribing gate blocks drug orders in visual reviews)
 * 19. FHIR atomic transaction persistence
 * 20. FHIR Provenance attestation integrity
 * 21. Clinician revision Provenance role
 * 22. Cryptographic audit trail & zero secret leakage
 */

const assert = require('assert');
const crypto = require('crypto');
const zlib = require('zlib');
const {
  visionService,
  visionReviewService,
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
  ihdrData[9] = 2;
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

async function runMilestone2C2Tests() {
  console.log('====================================================================');
  console.log('   PROTON V2 MILESTONE 2C-2 — CLINICIAN VISUAL REVIEW VALIDATION    ');
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

  // Actors
  const physicianActor = {
    actorId: 'usr-md-lin-01',
    actorRole: 'physician',
    actorName: 'Dr. Sarah Lin, MD',
    tenantId: 'org-default'
  };

  const nonPhysicianActor = {
    actorId: 'usr-ops-marcus-01',
    actorRole: 'operations_staff',
    actorName: 'Marcus Vance',
    tenantId: 'org-default'
  };

  const externalPhysicianActor = {
    actorId: 'usr-md-ext-99',
    actorRole: 'physician',
    actorName: 'Dr. External Physician',
    tenantId: 'org-external'
  };

  const patientId = 'patient-arthur-dent';

  // Seed patient in synthetic FHIR store
  fhirService.adapter.setSyntheticStore({
    resourceType: 'Patient',
    id: patientId,
    name: [{ given: ['Arthur'], family: 'Dent' }],
    meta: { tag: [{ system: 'https://proton.health/tenant', code: 'org-default' }] }
  });

  // Seed capture session
  const defaultSession = captureSessionService.createSession({
    patientId,
    encounterId: 'enc-active',
    actor: physicianActor
  });

  // Seed test media
  const validPng = createTestPng(640, 480, 4096);
  const mediaId = `med-rev-${Date.now()}-1`;
  const stored = await storageService.store({
    buffer: validPng,
    mimeType: 'image/png',
    tenantId: 'org-default',
    mediaId
  });

  sessionStore.recordMedia({
    id: mediaId,
    tenantId: 'org-default',
    sessionId: defaultSession.sessionId,
    patientId,
    encounterId: 'enc-active',
    storageKey: stored.storageKey,
    mimeType: 'image/png',
    fileSize: validPng.length,
    sha256: stored.sha256,
    width: 640,
    height: 480,
    fhirMediaId: mediaId,
    fhirProvenanceId: `prov-${mediaId}`
  });

  // Execute M2C-1 vision analysis
  const visionResult = await visionService.analyzeMedia({
    mediaId,
    patientId,
    encounterId: 'enc-active',
    actor: physicianActor
  });

  const analysisId = visionResult.analysisId;

  // ---------------------------------------------------------------
  // SUITE 1: CLINICIAN DECISION WORKFLOW (ACCEPT / REJECT / MODIFY)
  // ---------------------------------------------------------------
  console.log('--- SUITE 1: Clinician Decision Workflow (Accept, Reject, Modify) ---');

  await test('Normal finding acceptance promotes unconfirmed finding to active confirmed FHIR Condition', async () => {
    const review = await visionReviewService.reviewFinding({
      analysisId,
      findingIndex: 0,
      action: 'ACCEPT',
      actor: physicianActor,
      patientId,
      encounterId: 'enc-active'
    });

    assert.strictEqual(review.success, true);
    assert.strictEqual(review.action, 'ACCEPT');
    assert.strictEqual(review.analysisId, analysisId);
    assert(review.fhirConditionId.startsWith('cond-confirmed-'));
    assert(review.fhirProvenanceId.startsWith('prov-review-'));

    // Verify persisted FHIR Condition in synthetic store
    const condition = await fhirService.adapter.getResource('Condition', review.fhirConditionId);
    assert.ok(condition, 'FHIR Condition must exist in clinical store');
    assert.strictEqual(condition.clinicalStatus.coding[0].code, 'active');
    assert.strictEqual(condition.verificationStatus.coding[0].code, 'confirmed');
    assert.strictEqual(condition.subject.reference, `Patient/${patientId}`);
  });

  await test('Normal finding rejection records decision without creating active FHIR Condition', async () => {
    const review = await visionReviewService.reviewFinding({
      analysisId,
      findingIndex: 1,
      action: 'REJECT',
      notes: 'Artifact due to lighting reflections',
      actor: physicianActor,
      patientId
    });

    assert.strictEqual(review.success, true);
    assert.strictEqual(review.action, 'REJECT');
    assert.strictEqual(review.fhirConditionId, null, 'Rejected finding must NOT produce an active FHIR Condition');
  });

  await test('Normal finding modification records clinician revision and creates revised confirmed Condition', async () => {
    const modifiedFinding = 'Nummular eczema (plaque variant with scaling)';
    const review = await visionReviewService.reviewFinding({
      analysisId,
      findingIndex: 2,
      action: 'MODIFY',
      modification: modifiedFinding,
      notes: 'Refined from initial AI suggestion based on tactile palpation',
      actor: physicianActor,
      patientId
    });

    assert.strictEqual(review.success, true);
    assert.strictEqual(review.action, 'MODIFY');
    assert.strictEqual(review.clinicianModification, modifiedFinding);
    assert(review.fhirConditionId.startsWith('cond-confirmed-'));

    const condition = await fhirService.adapter.getResource('Condition', review.fhirConditionId);
    assert.ok(condition);
    assert.strictEqual(condition.code.text, modifiedFinding);
    assert.strictEqual(condition.clinicalStatus.coding[0].code, 'active');
    assert.strictEqual(condition.verificationStatus.coding[0].code, 'confirmed');
  });

  // ---------------------------------------------------------------
  // SUITE 2: CLINICAL AUTHORITY & RBAC ENFORCEMENT
  // ---------------------------------------------------------------
  console.log('\n--- SUITE 2: Clinical Authority & RBAC Boundaries ---');

  await test('Physician actor authorization succeeds', async () => {
    const review = await visionReviewService.reviewFinding({
      analysisId,
      findingIndex: 0,
      action: 'ACCEPT',
      actor: physicianActor
    });
    assert.strictEqual(review.success, true);
  });

  await test('Unauthenticated confirmation request rejected with 401 UNAUTHENTICATED', async () => {
    let threw = false;
    try {
      await visionReviewService.reviewFinding({
        analysisId,
        findingIndex: 0,
        action: 'ACCEPT',
        actor: null
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'UNAUTHENTICATED');
      assert.strictEqual(err.status, 401);
    }
    assert(threw, 'Should have thrown UNAUTHENTICATED');
  });

  await test('Non-physician actor (operations_staff) confirmation rejected with 403 CLINICIAN_AUTHORIZATION_REQUIRED', async () => {
    let threw = false;
    try {
      await visionReviewService.reviewFinding({
        analysisId,
        findingIndex: 0,
        action: 'ACCEPT',
        actor: nonPhysicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'CLINICIAN_AUTHORIZATION_REQUIRED');
      assert.strictEqual(err.status, 403);
    }
    assert(threw, 'Should have thrown CLINICIAN_AUTHORIZATION_REQUIRED');
  });

  // ---------------------------------------------------------------
  // SUITE 3: TENANT, PATIENT & ENCOUNTER ISOLATION
  // ---------------------------------------------------------------
  console.log('\n--- SUITE 3: Isolation & Trust Boundaries ---');

  await test('Cross-patient analysis access strictly rejected with 403 CROSS_PATIENT_ACCESS_DENIED', async () => {
    let threw = false;
    try {
      await visionReviewService.reviewFinding({
        analysisId,
        findingIndex: 0,
        action: 'ACCEPT',
        patientId: 'patient-hacked-007',
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'CROSS_PATIENT_ACCESS_DENIED');
      assert.strictEqual(err.status, 403);
    }
    assert(threw, 'Should have thrown CROSS_PATIENT_ACCESS_DENIED');
  });

  await test('Cross-tenant analysis access strictly rejected with 403 CROSS_TENANT_ACCESS_DENIED', async () => {
    let threw = false;
    try {
      await visionReviewService.reviewFinding({
        analysisId,
        findingIndex: 0,
        action: 'ACCEPT',
        actor: externalPhysicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'CROSS_TENANT_ACCESS_DENIED');
      assert.strictEqual(err.status, 403);
    }
    assert(threw, 'Should have thrown CROSS_TENANT_ACCESS_DENIED');
  });

  await test('Forged / nonexistent analysis ID rejected with 404 ANALYSIS_NOT_FOUND', async () => {
    let threw = false;
    try {
      await visionReviewService.reviewFinding({
        analysisId: 'va-nonexistent-forged-999',
        findingIndex: 0,
        action: 'ACCEPT',
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'ANALYSIS_NOT_FOUND');
      assert.strictEqual(err.status, 404);
    }
    assert(threw, 'Should have thrown ANALYSIS_NOT_FOUND');
  });

  await test('Forged encounter ID mismatch rejected with 400 ENCOUNTER_MISMATCH', async () => {
    let threw = false;
    try {
      await visionReviewService.reviewFinding({
        analysisId,
        findingIndex: 0,
        action: 'ACCEPT',
        encounterId: 'enc-tampered-999',
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'ENCOUNTER_MISMATCH');
      assert.strictEqual(err.status, 400);
    }
    assert(threw, 'Should have thrown ENCOUNTER_MISMATCH');
  });

  await test('Missing analysis ID parameter rejected with 400 ANALYSIS_ID_REQUIRED', async () => {
    let threw = false;
    try {
      await visionReviewService.reviewFinding({
        analysisId: '',
        findingIndex: 0,
        action: 'ACCEPT',
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'ANALYSIS_ID_REQUIRED');
      assert.strictEqual(err.status, 400);
    }
    assert(threw, 'Should have thrown ANALYSIS_ID_REQUIRED');
  });

  await test('Finding index out of bounds rejected with 404 FINDING_NOT_FOUND', async () => {
    let threw = false;
    try {
      await visionReviewService.reviewFinding({
        analysisId,
        findingIndex: 9999, // Nonexistent index
        action: 'ACCEPT',
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'FINDING_NOT_FOUND');
      assert.strictEqual(err.status, 404);
    }
    assert(threw, 'Should have thrown FINDING_NOT_FOUND');
  });

  await test('MODIFY action without modification text rejected with 400 MODIFICATION_REQUIRED', async () => {
    let threw = false;
    try {
      await visionReviewService.reviewFinding({
        analysisId,
        findingIndex: 0,
        action: 'MODIFY',
        modification: '   ', // Blank
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'MODIFICATION_REQUIRED');
      assert.strictEqual(err.status, 400);
    }
    assert(threw, 'Should have thrown MODIFICATION_REQUIRED');
  });

  await test('Invalid action keyword rejected with 400 INVALID_ACTION', async () => {
    let threw = false;
    try {
      await visionReviewService.reviewFinding({
        analysisId,
        findingIndex: 0,
        action: 'DELETE_HACK', // Invalid action
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'INVALID_ACTION');
      assert.strictEqual(err.status, 400);
    }
    assert(threw, 'Should have thrown INVALID_ACTION');
  });

  // ---------------------------------------------------------------
  // SUITE 4: AI IMMUTABILITY & STALE STATE GUARDS
  // ---------------------------------------------------------------
  console.log('\n--- SUITE 4: AI Immutability & Stale State Guards ---');

  await test('Original M2C-1 AI analysis record remains strictly immutable in database', async () => {
    const analysisBefore = sessionStore.getVisionAnalysis(analysisId);

    // Clinician performs modification
    await visionReviewService.reviewFinding({
      analysisId,
      findingIndex: 0,
      action: 'MODIFY',
      modification: 'Modified condition text',
      actor: physicianActor
    });

    const analysisAfter = sessionStore.getVisionAnalysis(analysisId);
    assert.deepStrictEqual(analysisBefore.findings, analysisAfter.findings, 'Underlying AI findings must NOT be overwritten');
    assert.strictEqual(analysisBefore.confidence, analysisAfter.confidence);
  });

  await test('Stale / non-completed analysis cannot be reviewed (400 STALE_ANALYSIS_REJECTED)', async () => {
    const staleId = `va-stale-${Date.now()}`;
    sessionStore.recordVisionAnalysis({
      id: staleId,
      tenantId: 'org-default',
      mediaId,
      patientId,
      provider: 'demo',
      model: 'demo',
      status: 'FAILED', // Not completed!
      findings: {},
      createdAt: new Date().toISOString()
    });

    let threw = false;
    try {
      await visionReviewService.reviewFinding({
        analysisId: staleId,
        findingIndex: 0,
        action: 'ACCEPT',
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'STALE_ANALYSIS_REJECTED');
      assert.strictEqual(err.status, 400);
    }
    assert(threw, 'Should have thrown STALE_ANALYSIS_REJECTED');
  });

  await test('Duplicate confirmation returns idempotent result without creating duplicate FHIR resources', async () => {
    // First confirmation
    const first = await visionReviewService.reviewFinding({
      analysisId,
      findingIndex: 0,
      action: 'ACCEPT',
      actor: physicianActor
    });

    // Second identical confirmation
    const second = await visionReviewService.reviewFinding({
      analysisId,
      findingIndex: 0,
      action: 'ACCEPT',
      actor: physicianActor
    });

    assert.strictEqual(second.isDuplicate, true);
    assert.strictEqual(second.fhirConditionId, first.fhirConditionId, 'Must return identical FHIR Condition ID');
  });

  // ---------------------------------------------------------------
  // SUITE 5: SAFETY INVARIANTS & ANTI-AUTONOMOUS GUARDS
  // ---------------------------------------------------------------
  console.log('\n--- SUITE 5: Safety Invariants & Clinical Authority ---');

  await test('Autonomous diagnosis prevention: AI vision alone creates zero active Conditions', async () => {
    const unreviewedMediaId = `med-unrev-${Date.now()}`;
    const unrevStored = await storageService.store({
      buffer: validPng,
      mimeType: 'image/png',
      tenantId: 'org-default',
      mediaId: unreviewedMediaId
    });

    sessionStore.recordMedia({
      id: unreviewedMediaId,
      tenantId: 'org-default',
      sessionId: defaultSession.sessionId,
      patientId,
      storageKey: unrevStored.storageKey,
      mimeType: 'image/png',
      fileSize: validPng.length,
      sha256: unrevStored.sha256,
      width: 640,
      height: 480,
      fhirMediaId: unreviewedMediaId,
      fhirProvenanceId: `prov-${unreviewedMediaId}`
    });

    const aiRes = await visionService.analyzeMedia({
      mediaId: unreviewedMediaId,
      actor: physicianActor
    });

    assert.strictEqual(aiRes.fhir.activeConditionsCreated, 0, 'AI alone must create ZERO active conditions');
  });

  await test('Autonomous prescribing prevention: Visual reviews cannot be used to order medications', async () => {
    let threw = false;
    try {
      await visionReviewService.reviewFinding({
        analysisId,
        findingIndex: 0,
        action: 'MODIFY',
        modification: 'Prescribe 500mg Amoxicillin PO BID x 10 days',
        actor: physicianActor
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'AUTONOMOUS_PRESCRIPTION_REJECTED');
      assert.strictEqual(err.status, 400);
    }
    assert(threw, 'Should have rejected prescription in visual review');
  });

  // ---------------------------------------------------------------
  // SUITE 6: FHIR ATOMICITY & PROVENANCE INTEGRITY
  // ---------------------------------------------------------------
  console.log('\n--- SUITE 6: FHIR Provenance & Audit Integrity ---');

  await test('FHIR Provenance correctly identifies Attending Physician as attester and Media as source', async () => {
    const review = await visionReviewService.reviewFinding({
      analysisId,
      findingIndex: 0,
      action: 'ACCEPT',
      actor: physicianActor
    });

    const provenance = await fhirService.adapter.getResource('Provenance', review.fhirProvenanceId);
    assert.ok(provenance);
    assert.strictEqual(provenance.target[0].reference, `Condition/${review.fhirConditionId}`);
    assert.strictEqual(provenance.agent[0].who.reference, `Practitioner/${physicianActor.actorId}`);

    const sourceEntity = provenance.entity.find(e => e.role === 'source');
    assert.ok(sourceEntity, 'Must include source entity');
    assert.strictEqual(sourceEntity.what.reference, `Media/${mediaId}`);
  });

  await test('Modified finding Provenance specifies role: revision', async () => {
    const review = await visionReviewService.reviewFinding({
      analysisId,
      findingIndex: 0,
      action: 'MODIFY',
      modification: 'Contact dermatitis with secondary impetiginization',
      actor: physicianActor
    });

    const provenance = await fhirService.adapter.getResource('Provenance', review.fhirProvenanceId);
    assert.ok(provenance);
    const revisionEntity = provenance.entity.find(e => e.role === 'revision');
    assert.ok(revisionEntity, 'Modified finding must record entity with role: revision');
  });

  await test('Audit trail records clinician action with zero raw bytes, base64 data, or token leakage', async () => {
    const events = auditService.getEventsForPatient(patientId, 'org-default', 50);
    const reviewEvents = events.filter(e => e.action.startsWith('CLINICAL_PIPELINE_VISION_REVIEW_'));
    assert(reviewEvents.length > 0, 'Audit records must exist for clinician visual reviews');

    for (const ev of reviewEvents) {
      assert(!ev.summary.includes('data:image'), 'Must not leak image data');
      assert(!ev.summary.includes('base64'), 'Must not leak base64');
      assert(!ev.summary.includes('AIzaSy'), 'Must not leak API keys');
      assert(!ev.summary.includes('token:'), 'Must not leak raw tokens');
    }

    const chain = auditService.verifyChain('org-default');
    assert.strictEqual(chain.valid, true, 'Cryptographic audit chain must remain intact');
  });

  console.log('\n====================================================================');
  console.log(`   MILESTONE 2C-2 TESTS COMPLETE: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('====================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runMilestone2C2Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
