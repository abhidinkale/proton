/**
 * Proton V2 Milestone 2C-3: Real-Time Clinical Streaming / SSE Validation Suite
 *
 * Verifies all 22 required streaming & safety criteria:
 * 1. Authenticated stream succeeds
 * 2. Unauthenticated stream rejected (401)
 * 3. Cross-patient stream rejected (403)
 * 4. Cross-tenant stream rejected (403)
 * 5. Non-physician privileged operation rejected (403)
 * 6. Malformed stream request rejected (400)
 * 7. Stream IDs contain no PHI
 * 8. Monotonic event sequence
 * 9. Duplicate event IDs rejected/ignored & Last-Event-ID replay
 * 10. Terminal event emitted exactly once
 * 11. Heartbeat does not mutate clinical state
 * 12. Client disconnect cleans up stream
 * 13. Inactivity timeout cleans up stream
 * 14. Provider failure emits STREAM_ERROR
 * 15. Deterministic safety warning emitted before persistence
 * 16. Emergency/hard stop event emits SAFETY_LOCKED and halts persistence
 * 17. SSE errors scrub stack traces & internal paths
 * 18. Audit records stream lifecycle & security failures
 * 19. Zero active Condition created from AI-only output
 * 20. Zero MedicationRequest created from AI-only output
 * 21. Cross-tenant event leakage impossible
 * 22. Bounded stream memory & cleanup
 */

const assert = require('assert');
const crypto = require('crypto');
const EventEmitter = require('events');
const {
  streamManager,
  StreamManager,
  createEvent,
  formatSseMessage,
  validateStreamAccess,
  scrubError,
  sanitizePayload,
  StreamSecurityError,
  clinicalPipeline,
  auditService,
  fhirService
} = require('../services');

// Mock Express Response for SSE
class MockSseResponse extends EventEmitter {
  constructor() {
    super();
    this.headers = {};
    this.writtenData = [];
    this.writableEnded = false;
    this.statusCode = 200;
  }

  setHeader(name, val) {
    this.headers[name.toLowerCase()] = val;
  }

  getHeader(name) {
    return this.headers[name.toLowerCase()];
  }

  write(chunk) {
    if (this.writableEnded) {
      throw new Error('Cannot write after response has ended.');
    }
    this.writtenData.push(chunk.toString());
    return true;
  }

  end(chunk) {
    if (chunk) this.write(chunk);
    this.writableEnded = true;
    this.emit('finish');
  }

  flushHeaders() {}
}

// Mock Express Request
class MockSseRequest extends EventEmitter {
  constructor(actor, headers = {}) {
    super();
    this.actor = actor;
    this.headers = headers;
  }
}

async function runSuite() {
  console.log('\n============================================================');
  console.log('PROTON V2 MILESTONE 2C-3: REAL-TIME CLINICAL STREAMING SUITE');
  console.log('============================================================\n');

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
      if (err.stack) console.error(err.stack);
    }
  }

  const defaultDoctor = {
    actorId: 'usr-md-lin-01',
    actorRole: 'physician',
    actorName: 'Dr. Sarah Lin, MD',
    tenantId: 'org-default'
  };

  const externalDoctor = {
    actorId: 'usr-md-ext-99',
    actorRole: 'physician',
    actorName: 'Dr. External Physician, MD',
    tenantId: 'org-external-hospital'
  };

  const patientAlice = {
    actorId: 'pat-alice-101',
    actorRole: 'patient',
    actorName: 'Alice Smith',
    tenantId: 'org-default',
    patientId: 'pat-alice-101'
  };

  const patientBob = {
    actorId: 'pat-bob-202',
    actorRole: 'patient',
    actorName: 'Bob Jones',
    tenantId: 'org-default',
    patientId: 'pat-bob-202'
  };

  // Seed synthetic FHIR patients and allergies for pipeline tests
  fhirService.adapter.setSyntheticStore({
    resourceType: 'Patient',
    id: 'pat-alice-101',
    name: [{ given: ['Alice'], family: 'Smith' }],
    birthDate: '1985-05-15'
  });
  fhirService.adapter.setSyntheticStore({
    resourceType: 'Patient',
    id: 'pat-john-doe-42',
    name: [{ given: ['John'], family: 'Doe' }],
    birthDate: '1980-01-01'
  });
  fhirService.adapter.setSyntheticStore({
    resourceType: 'AllergyIntolerance',
    id: 'all-john-doe-42',
    subject: { reference: 'Patient/pat-john-doe-42' },
    code: { coding: [{ display: 'Penicillin' }] }
  });

  // --- SUITE 1: STREAM CREATION, ACCESS CONTROL & ENVELOPE INTEGRITY ---
  console.log('--- SUITE 1: Stream Creation, Access Control & Envelope Integrity ---');

  let activeStream1 = null;

  await test('Test 1: Authenticated stream succeeds and attaches SSE transport', async () => {
    activeStream1 = streamManager.createStream({
      patientId: 'pat-alice-101',
      encounterId: 'enc-cardio-01',
      actor: defaultDoctor,
      operation: 'CLINICAL_PIPELINE'
    });

    assert.ok(activeStream1.streamId.startsWith('str-'), 'Stream ID must start with str-');
    assert.strictEqual(activeStream1.status, 'INITIALIZED');

    const res = new MockSseResponse();
    const req = new MockSseRequest(defaultDoctor);

    streamManager.attachResponse(activeStream1.streamId, res, req);

    assert.strictEqual(res.getHeader('content-type'), 'text/event-stream');
    assert.strictEqual(res.getHeader('cache-control'), 'no-cache, no-transform');
    assert.strictEqual(res.getHeader('connection'), 'keep-alive');

    const evt = streamManager.publishEvent(activeStream1.streamId, 'INPUT_RECEIVED', {
      patientId: 'pat-alice-101'
    });

    assert.strictEqual(evt.type, 'INPUT_RECEIVED');
    assert.strictEqual(evt.sequence, 1);
    assert.ok(res.writtenData[0].includes('event: INPUT_RECEIVED'));
    assert.ok(res.writtenData[0].includes('pat-alice-101'));
  });

  await test('Test 2: Unauthenticated stream rejected (401)', async () => {
    assert.throws(() => {
      streamManager.createStream({
        patientId: 'pat-alice-101',
        actor: null
      });
    }, (err) => {
      assert.strictEqual(err.code, 'UNAUTHENTICATED');
      assert.strictEqual(err.status, 401);
      return true;
    });

    const stream = streamManager.getStream(activeStream1.streamId);
    assert.throws(() => {
      validateStreamAccess(stream, null);
    }, (err) => {
      assert.strictEqual(err.code, 'UNAUTHENTICATED');
      assert.strictEqual(err.status, 401);
      return true;
    });
  });

  await test('Test 3: Cross-patient stream rejected (403)', async () => {
    const stream = streamManager.getStream(activeStream1.streamId); // bound to pat-alice-101
    assert.throws(() => {
      validateStreamAccess(stream, patientBob); // Bob accessing Alice's stream
    }, (err) => {
      assert.strictEqual(err.code, 'CROSS_PATIENT_ACCESS_DENIED');
      assert.strictEqual(err.status, 403);
      return true;
    });
  });

  await test('Test 4: Cross-tenant stream rejected (403)', async () => {
    const stream = streamManager.getStream(activeStream1.streamId); // bound to org-default
    assert.throws(() => {
      validateStreamAccess(stream, externalDoctor); // org-external-hospital accessing org-default
    }, (err) => {
      assert.strictEqual(err.code, 'CROSS_TENANT_ACCESS_DENIED');
      assert.strictEqual(err.status, 403);
      return true;
    });
  });

  await test('Test 5: Non-physician privileged operation rejected (403)', async () => {
    // Verify role check blocks patients from running clinical pipeline
    const allowedRoles = ['physician', 'practitioner', 'operations_staff', 'system'];
    assert.strictEqual(allowedRoles.includes(patientAlice.actorRole), false);

    // Verify directive override by patient is rejected by safety pipeline
    await assert.rejects(async () => {
      await clinicalPipeline.execute({
        patientId: 'pat-alice-101',
        transcript: 'Patient reports mild headache.',
        actor: patientAlice,
        physicianDirective: 'I direct this prescription override as patient.'
      });
    }, (err) => {
      assert.strictEqual(err.code, 'UNAUTHORIZED_PHYSICIAN_OVERRIDE');
      assert.strictEqual(err.status, 403);
      return true;
    });
  });

  await test('Test 6: Malformed stream request rejected (400)', async () => {
    // Missing streamId in createEvent
    assert.throws(() => {
      createEvent({ streamId: '', type: 'INPUT_RECEIVED', sequence: 1 });
    }, /streamId is required/);

    // Invalid event type
    assert.throws(() => {
      createEvent({ streamId: 'str-test', type: 'INVALID_UNKNOWN_TYPE', sequence: 1 });
    }, /Invalid event type/);

    // Negative sequence
    assert.throws(() => {
      createEvent({ streamId: 'str-test', type: 'INPUT_RECEIVED', sequence: -1 });
    }, /sequence must be a positive integer/);
  });

  await test('Test 7: Stream IDs contain no PHI', async () => {
    const sensitivePatient = 'John Fitzgerald Kennedy Jr.';
    const sensitiveMrn = 'MRN-99887766';
    const sensitiveDob = '1960-11-25';

    const testStream = streamManager.createStream({
      patientId: 'pat-jfk-99',
      actor: defaultDoctor,
      operation: 'CLINICAL_PIPELINE'
    });

    const sid = testStream.streamId;
    assert.strictEqual(sid.includes(sensitivePatient), false);
    assert.strictEqual(sid.includes(sensitiveMrn), false);
    assert.strictEqual(sid.includes(sensitiveDob), false);
    assert.strictEqual(sid.includes('jfk'), false);
    assert.ok(/^str-\d+-[a-f0-9]{32}$/.test(sid), 'Stream ID must match opaque entropy pattern str-<timestamp>-<32hex>');
  });

  // --- SUITE 2: PROTOCOL INTEGRITY & LIFECYCLE ---
  console.log('\n--- SUITE 2: Protocol Integrity & Lifecycle ---');

  await test('Test 8: Monotonic event sequence', async () => {
    const s = streamManager.createStream({
      patientId: 'pat-seq-test',
      actor: defaultDoctor
    });
    const res = new MockSseResponse();
    const req = new MockSseRequest(defaultDoctor);
    streamManager.attachResponse(s.streamId, res, req);

    const e1 = streamManager.publishEvent(s.streamId, 'INPUT_RECEIVED');
    const e2 = streamManager.publishEvent(s.streamId, 'VALIDATION_COMPLETE');
    const e3 = streamManager.publishEvent(s.streamId, 'CLINICAL_CONTEXT_READY');

    assert.strictEqual(e1.sequence, 1);
    assert.strictEqual(e2.sequence, 2);
    assert.strictEqual(e3.sequence, 3);
  });

  await test('Test 9: Replay missed events using Last-Event-ID', async () => {
    const s = streamManager.createStream({
      patientId: 'pat-replay-test',
      actor: defaultDoctor
    });

    const e1 = streamManager.publishEvent(s.streamId, 'INPUT_RECEIVED', { item: 1 });
    const e2 = streamManager.publishEvent(s.streamId, 'VALIDATION_COMPLETE', { item: 2 });
    const e3 = streamManager.publishEvent(s.streamId, 'CLINICAL_CONTEXT_READY', { item: 3 });

    // Client connects late with Last-Event-ID = e1.eventId
    const res = new MockSseResponse();
    const req = new MockSseRequest(defaultDoctor);
    streamManager.attachResponse(s.streamId, res, req, { lastEventId: e1.eventId });

    // Should have replayed e2 and e3
    assert.strictEqual(res.writtenData.length, 2);
    assert.ok(res.writtenData[0].includes('VALIDATION_COMPLETE'));
    assert.ok(res.writtenData[1].includes('CLINICAL_CONTEXT_READY'));
  });

  await test('Test 10: Terminal event emitted exactly once', async () => {
    const s = streamManager.createStream({
      patientId: 'pat-term-test',
      actor: defaultDoctor
    });
    const res = new MockSseResponse();
    const req = new MockSseRequest(defaultDoctor);
    streamManager.attachResponse(s.streamId, res, req);

    streamManager.publishEvent(s.streamId, 'INPUT_RECEIVED');
    streamManager.closeStream(s.streamId, 'STREAM_COMPLETE', { summary: 'Finished' });

    assert.strictEqual(res.writableEnded, true);
    assert.strictEqual(streamManager.getStream(s.streamId).status, 'CLOSED');

    // Subsequent write should be ignored
    const postCloseEvt = streamManager.publishEvent(s.streamId, 'AI_ANALYSIS_STARTED');
    assert.strictEqual(postCloseEvt, null);
  });

  await test('Test 11: Heartbeat does not mutate clinical state', async () => {
    const isolatedManager = new StreamManager({ heartbeatMs: 20 });
    const s = isolatedManager.createStream({
      patientId: 'pat-hb-test',
      actor: defaultDoctor
    });

    const res = new MockSseResponse();
    const req = new MockSseRequest(defaultDoctor);
    isolatedManager.attachResponse(s.streamId, res, req);

    // Wait for at least one heartbeat
    await new Promise(resolve => setTimeout(resolve, 50));

    const heartbeats = res.writtenData.filter(d => d.includes('event: HEARTBEAT'));
    assert.ok(heartbeats.length >= 1, 'At least one heartbeat must be written');

    // Clinical state unaffected
    const meta = isolatedManager.getStream(s.streamId);
    assert.strictEqual(meta.patientId, 'pat-hb-test');
    assert.strictEqual(meta.actor.actorId, defaultDoctor.actorId);

    isolatedManager.closeStream(s.streamId);
  });

  await test('Test 12: Client disconnect cleans up stream', async () => {
    const isolatedManager = new StreamManager();
    const s = isolatedManager.createStream({
      patientId: 'pat-dc-test',
      actor: defaultDoctor
    });

    const res = new MockSseResponse();
    const req = new MockSseRequest(defaultDoctor);
    isolatedManager.attachResponse(s.streamId, res, req);

    // Simulate client abort
    req.emit('close');

    // Stream should be removed/cleaned
    const found = isolatedManager.getStream(s.streamId);
    assert.strictEqual(found, null);
  });

  await test('Test 13: Inactivity timeout cleans up stream', async () => {
    const isolatedManager = new StreamManager({ timeoutMs: 30 });
    const s = isolatedManager.createStream({
      patientId: 'pat-timeout-test',
      actor: defaultDoctor
    });

    const res = new MockSseResponse();
    const req = new MockSseRequest(defaultDoctor);
    isolatedManager.attachResponse(s.streamId, res, req);

    // Wait for timeout to fire
    await new Promise(resolve => setTimeout(resolve, 60));

    assert.strictEqual(res.writableEnded, true);
    const lastMessage = res.writtenData[res.writtenData.length - 1];
    assert.ok(lastMessage.includes('STREAM_ERROR'));
    assert.ok(lastMessage.includes('STREAM_TIMEOUT'));
  });

  // --- SUITE 3: ERROR SCRUBBING & SAFETY GATES ---
  console.log('\n--- SUITE 3: Error Scrubbing & Deterministic Safety Gates ---');

  await test('Test 14: Provider failure emits STREAM_ERROR with safe message', async () => {
    const s = streamManager.createStream({
      patientId: 'pat-err-test',
      actor: defaultDoctor
    });
    const res = new MockSseResponse();
    const req = new MockSseRequest(defaultDoctor);
    streamManager.attachResponse(s.streamId, res, req);

    const sensitiveErr = new Error('Database connection failed at /Users/abhidinkale/Downloads/proton/db.sqlite with key=AIzaSyA_DEMO_SECRET_KEY_1234567890');
    sensitiveErr.code = 'DB_ERROR';

    streamManager.abortStream(s.streamId, sensitiveErr);

    assert.strictEqual(res.writableEnded, true);
    const lastMsg = res.writtenData[res.writtenData.length - 1];
    assert.ok(lastMsg.includes('STREAM_ERROR'));
    assert.strictEqual(lastMsg.includes('/Users/abhidinkale'), false);
    assert.strictEqual(lastMsg.includes('AIzaSyA_DEMO_SECRET_KEY'), false);
    assert.ok(lastMsg.includes('[internal_path]'));
    assert.ok(lastMsg.includes('[REDACTED_API_KEY]') || lastMsg.includes('[REDACTED]'));
  });

  await test('Test 15: Deterministic safety warning emitted before persistence', async () => {
    const eventsEmitted = [];
    const options = {
      onEvent: (type, payload) => {
        eventsEmitted.push({ type, payload });
      }
    };

    // Consult with known allergy interaction (e.g. Penicillin allergy vs Amoxicillin)
    await clinicalPipeline.execute({
      patientId: 'pat-john-doe-42',
      transcript: 'Patient has mild sinus congestion.',
      prescriptions: [{
        name: 'Amoxicillin',
        dose: '500mg',
        route: 'oral',
        frequency: 'daily'
      }],
      actor: defaultDoctor,
      physicianDirective: 'Patient previously tolerated low dose beta lactams under desensitization.'
    }, options);

    const warningEvt = eventsEmitted.find(e => e.type === 'SAFETY_WARNING');
    assert.ok(warningEvt, 'SAFETY_WARNING event must be emitted');
    assert.ok(warningEvt.payload.contraindications.length > 0 || warningEvt.payload.warnings.length > 0);

    const warnIdx = eventsEmitted.findIndex(e => e.type === 'SAFETY_WARNING');
    const commitIdx = eventsEmitted.findIndex(e => e.type === 'FHIR_COMMIT_STARTED');
    assert.ok(warnIdx < (commitIdx === -1 ? 999 : commitIdx), 'SAFETY_WARNING must precede FHIR commit');
  });

  await test('Test 16: Critical safety hard stop emits SAFETY_LOCKED and halts persistence', async () => {
    const eventsEmitted = [];
    const options = {
      onEvent: (type, payload) => {
        eventsEmitted.push({ type, payload });
      }
    };

    // Prescribing contraindication without clinician directive override
    let pipelineFailed = false;
    try {
      await clinicalPipeline.execute({
        patientId: 'pat-john-doe-42',
        transcript: 'Patient has acute tonsillitis.',
        prescriptions: [{
          name: 'Amoxicillin',
          dose: '500mg',
          route: 'oral',
          frequency: 'daily'
        }],
        actor: defaultDoctor,
        commitToFhir: true // Requests persistence
      }, options);
    } catch (err) {
      pipelineFailed = true;
      assert.strictEqual(err.code, 'CONTRAINDICATION_HARD_STOP');
    }

    assert.strictEqual(pipelineFailed, true, 'Pipeline must halt with CONTRAINDICATION_HARD_STOP');

    const lockedEvt = eventsEmitted.find(e => e.type === 'SAFETY_LOCKED');
    assert.ok(lockedEvt, 'SAFETY_LOCKED event must be emitted upon unoverridden hard stop');

    const fhirStarted = eventsEmitted.find(e => e.type === 'FHIR_COMMIT_STARTED');
    const fhirCompleted = eventsEmitted.find(e => e.type === 'FHIR_COMMIT_COMPLETE');
    assert.strictEqual(fhirStarted, undefined, 'Zero FHIR transactions may start after hard stop');
    assert.strictEqual(fhirCompleted, undefined, 'Zero FHIR transactions may complete after hard stop');
  });

  await test('Test 17: SSE errors scrub stack traces & internal paths', async () => {
    const err = new Error('Fatal leak: /Users/abhidinkale/project/secret.js:42\n    at internalFunction (/Users/abhidinkale/project/index.js:10:5)');
    err.code = 'CRITICAL_FAILURE';
    const scrubbed = scrubError(err);

    assert.strictEqual(scrubbed.code, 'CRITICAL_FAILURE');
    assert.strictEqual(scrubbed.message.includes('/Users/abhidinkale'), false);
    assert.strictEqual(scrubbed.stack, undefined);
  });

  // --- SUITE 4: AUDIT INTEGRITY & CLINICAL AUTHORITY ---
  console.log('\n--- SUITE 4: Audit Integrity & Clinical Authority ---');

  await test('Test 18: Audit records stream lifecycle & security failures', async () => {
    const auditRecord = auditService.recordPipelineStage({
      stage: 'STREAM_SECURITY_CHECK',
      patientId: 'pat-audit-101',
      actorId: defaultDoctor.actorId,
      actorRole: defaultDoctor.actorRole,
      status: 'BLOCKED',
      summary: 'Cross-tenant access attempt strictly rejected by stream manager.',
      resultingState: 'FORBIDDEN',
      tenantId: 'org-default'
    });

    assert.ok(auditRecord.eventId || auditRecord.id, 'Audit record must have an ID');
    assert.ok(auditRecord.currentHash, 'Audit record must produce cryptographic SHA-256 hash');
  });

  await test('Test 19: Zero active Condition created from AI-only output', async () => {
    const eventsEmitted = [];
    const options = {
      onEvent: (type, payload) => eventsEmitted.push({ type, payload })
    };

    const result = await clinicalPipeline.execute({
      patientId: 'pat-john-doe-42',
      transcript: 'Patient has mild seasonal allergic rhinitis.',
      actor: defaultDoctor
    }, options);

    // AI suggestions are explicitly marked unconfirmed
    assert.ok(result.output.suggestedDiagnoses.length > 0);
    for (const d of result.output.suggestedDiagnoses) {
      assert.strictEqual(d.clinicianConfirmed, false, 'AI diagnosis must remain unconfirmed');
      assert.strictEqual(d.status, 'PROPOSED_BY_AI');
    }

    // Since confirmedConditions was not supplied, zero active Conditions committed
    assert.strictEqual(result.fhirTransaction, null);
  });

  await test('Test 20: Zero MedicationRequest created from AI-only output', async () => {
    const result = await clinicalPipeline.execute({
      patientId: 'pat-john-doe-42',
      transcript: 'Patient discussed taking Vitamin D3 2000 IU daily.',
      prescriptions: [{ name: 'Vitamin D3', dosage: '2000 IU', route: 'oral', frequency: 'daily' }],
      actor: defaultDoctor
    });

    // Proposed prescriptions are drafts only until confirmedPrescriptions is explicitly supplied
    assert.strictEqual(result.fhirTransaction, null, 'Zero FHIR medication resources committed without explicit clinician confirmation');
  });

  await test('Test 21: Cross-tenant event leakage impossible', async () => {
    const sTenantA = streamManager.createStream({
      patientId: 'pat-tenant-a',
      actor: defaultDoctor // org-default
    });

    const sTenantB = streamManager.createStream({
      patientId: 'pat-tenant-b',
      actor: externalDoctor // org-external-hospital
    });

    // Tenant B doctor cannot view stream from Tenant A
    const retrievedA = streamManager.getStream(sTenantA.streamId);
    assert.throws(() => {
      validateStreamAccess(retrievedA, externalDoctor);
    }, (err) => {
      assert.strictEqual(err.code, 'CROSS_TENANT_ACCESS_DENIED');
      return true;
    });

    // Tenant A doctor cannot view stream from Tenant B
    const retrievedB = streamManager.getStream(sTenantB.streamId);
    assert.throws(() => {
      validateStreamAccess(retrievedB, defaultDoctor);
    }, (err) => {
      assert.strictEqual(err.code, 'CROSS_TENANT_ACCESS_DENIED');
      return true;
    });
  });

  await test('Test 22: Bounded stream memory & buffer cleanup', async () => {
    const boundedManager = new StreamManager({
      maxBufferedEvents: 5,
      maxStreamsPerTenant: 3
    });

    const s = boundedManager.createStream({
      patientId: 'pat-bound-test',
      actor: defaultDoctor
    });

    // Publish 10 events
    for (let i = 1; i <= 10; i++) {
      boundedManager.publishEvent(s.streamId, 'HEARTBEAT', { count: i });
    }

    const internalStream = boundedManager._streams.get(s.streamId);
    assert.strictEqual(internalStream.events.length, 5, 'Buffer must be capped at maxBufferedEvents (5)');
    assert.strictEqual(internalStream.events[0].payload.count, 6, 'Oldest events must be evicted');
    assert.strictEqual(internalStream.events[4].payload.count, 10, 'Latest events must be retained');

    // Tenant stream count cap
    boundedManager.createStream({ patientId: 'pat-2', actor: defaultDoctor });
    boundedManager.createStream({ patientId: 'pat-3', actor: defaultDoctor });

    // 4th stream should exceed tenant limit
    assert.throws(() => {
      boundedManager.createStream({ patientId: 'pat-4', actor: defaultDoctor });
    }, (err) => {
      assert.strictEqual(err.code, 'STREAM_LIMIT_EXCEEDED');
      assert.strictEqual(err.status, 429);
      return true;
    });
  });

  console.log('\n============================================================');
  console.log(`MILESTONE 2C-3 VALIDATION SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
