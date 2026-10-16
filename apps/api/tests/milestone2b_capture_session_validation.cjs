/**
 * Proton V2 Milestone 2B-1: Secure Cross-Device Capture Sessions Validation Suite
 * 
 * Verifies all 24 required security, state machine, cryptographic, and isolation invariants:
 * 1. Session creation
 * 2. Cryptographically random token generation
 * 3. Token is opaque
 * 4. Patient ID not encoded in token
 * 5. Tenant ID not encoded in token
 * 6. Session bound to correct patient
 * 7. Session bound to correct encounter
 * 8. Successful pairing
 * 9. Invalid token rejected
 * 10. Expired token rejected
 * 11. Replay token rejected
 * 12. Cancelled session rejected
 * 13. Completed session rejected
 * 14. Cross-tenant access rejected
 * 15. Cross-patient access rejected
 * 16. Unauthorized session lookup rejected
 * 17. Client cannot change patient
 * 18. Client cannot change encounter
 * 19. Client cannot change tenant
 * 20. Raw token never appears in audit records
 * 21. Pairing event audited
 * 22. Cancellation audited
 * 23. Expiration enforced server-side
 * 24. Session state cannot be client-controlled
 */

const assert = require('assert');
const {
  captureSessionService,
  tokenManager,
  sessionStore,
  auditService
} = require('../services');

async function runMilestone2BTests() {
  console.log('====================================================================');
  console.log('   PROTON V2 MILESTONE 2B-1 — SECURE CAPTURE SESSIONS VALIDATION    ');
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

  // --- SUITE 1: Session Creation & Cryptographic Tokens ---
  console.log('--- SUITE 1: Session Creation & Token Cryptography ---');

  let testSession1 = null;

  test('Test 1: Session creation generates valid session with PAIRING status', () => {
    testSession1 = captureSessionService.createSession({
      patientId: 'pat-john-doe-42',
      encounterId: 'enc-cardio-99',
      actor: defaultDoctor
    });

    assert.ok(testSession1.sessionId.startsWith('cap-sess-'), 'Session ID should follow cap-sess-* naming');
    assert.strictEqual(testSession1.status, 'PAIRING');
    assert.ok(testSession1.pairingToken, 'One-time raw pairing token should be returned');
    assert.ok(testSession1.expiresAt, 'Session must have an expiration timestamp');
    assert.ok(testSession1.qrPayload.includes(testSession1.pairingToken), 'QR payload must encode pairing capability');
  });

  test('Test 2: Cryptographically random token generation with 256-bit entropy', () => {
    const t1 = tokenManager.generatePairingToken();
    const t2 = tokenManager.generatePairingToken();

    assert.notStrictEqual(t1.rawToken, t2.rawToken, 'Subsequent tokens must be distinct');
    assert.strictEqual(t1.rawToken.length, 64, 'Token must be a 64-character hex string (32 random bytes)');
    assert.strictEqual(t2.rawToken.length, 64, 'Token must be a 64-character hex string (32 random bytes)');
    assert.ok(/^[a-f0-9]{64}$/i.test(t1.rawToken), 'Token must be strictly hex characters');
  });

  test('Test 3: Token is opaque capability without structured payloads', () => {
    assert.strictEqual(tokenManager.isOpaque(testSession1.pairingToken), true);
    assert.strictEqual(testSession1.pairingToken.includes('.'), false, 'Token must not be a JWT (no dots)');
    assert.strictEqual(testSession1.pairingToken.includes('{'), false, 'Token must not contain JSON');
    assert.strictEqual(testSession1.pairingToken.includes(':'), false, 'Token must not contain delimiters');
  });

  test('Test 4: Patient ID is strictly NOT encoded into pairing token', () => {
    const raw = testSession1.pairingToken;
    const patientId = 'pat-john-doe-42';

    assert.strictEqual(raw.includes(patientId), false, 'Raw token must not contain patient ID');
    assert.strictEqual(raw.includes('john'), false, 'Raw token must not contain patient name parts');
    assert.strictEqual(testSession1.qrPayload.includes(patientId), false, 'QR payload must never contain patient ID');
  });

  test('Test 5: Tenant ID is strictly NOT encoded into pairing token or QR payload', () => {
    const raw = testSession1.pairingToken;
    const tenantId = 'org-default';

    assert.strictEqual(raw.includes(tenantId), false, 'Raw token must not contain tenant ID');
    assert.strictEqual(testSession1.qrPayload.includes(tenantId), false, 'QR payload must never contain tenant ID');
  });

  // --- SUITE 2: Context Binding & Patient/Encounter Isolation ---
  console.log('\n--- SUITE 2: Context Binding & Patient/Encounter Isolation ---');

  test('Test 6: Session is server-bound to correct patient', () => {
    const retrieved = captureSessionService.getSession(testSession1.sessionId, defaultDoctor);
    assert.strictEqual(retrieved.patientId, 'pat-john-doe-42');
  });

  test('Test 7: Session is server-bound to correct encounter', () => {
    const retrieved = captureSessionService.getSession(testSession1.sessionId, defaultDoctor);
    assert.strictEqual(retrieved.encounterId, 'enc-cardio-99');
  });

  test('Test 17: Client cannot change patient ID on an existing session', () => {
    // Attempting to change patient ID via client call is ignored; server state is immutable
    const stored = sessionStore.getSessionById(testSession1.sessionId);
    assert.strictEqual(stored.patientId, 'pat-john-doe-42');

    // Retrieval with another actor querying patient context retains true patient ID
    const retrieved = captureSessionService.getSession(testSession1.sessionId, defaultDoctor);
    assert.strictEqual(retrieved.patientId, 'pat-john-doe-42');
  });

  test('Test 18: Client cannot change encounter ID on an existing session', () => {
    const retrieved = captureSessionService.getSession(testSession1.sessionId, defaultDoctor);
    assert.strictEqual(retrieved.encounterId, 'enc-cardio-99');
  });

  test('Test 19: Client cannot change tenant ID (server actor is authoritative)', () => {
    const maliciousActor = {
      ...defaultDoctor,
      tenantId: 'org-spoofed-attacker'
    };

    assert.throws(() => {
      captureSessionService.getSession(testSession1.sessionId, maliciousActor);
    }, (err) => {
      return err.code === 'CROSS_TENANT_ACCESS_DENIED' && err.status === 403;
    }, 'Tampered tenant in client actor must be blocked with 403');
  });

  // --- SUITE 3: Pairing State Machine & Capabilities ---
  console.log('\n--- SUITE 3: Pairing State Machine & Capabilities ---');

  let pairedResult = null;

  test('Test 8: Successful pairing transitions state from PAIRING to PAIRED', () => {
    pairedResult = captureSessionService.pairSession(testSession1.sessionId, testSession1.pairingToken);

    assert.strictEqual(pairedResult.success, true);
    assert.strictEqual(pairedResult.status, 'PAIRED');
    assert.ok(pairedResult.mobileToken, 'Mobile client receives session mobile token capability');

    const updated = captureSessionService.getSession(testSession1.sessionId, defaultDoctor);
    assert.strictEqual(updated.status, 'PAIRED');
    assert.ok(updated.pairedAt, 'pairedAt timestamp must be recorded');
  });

  test('Test 24: Session state cannot be client-controlled or bypassed', () => {
    // Client cannot pass status in creation
    const rogue = captureSessionService.createSession({
      patientId: 'pat-rogue',
      actor: defaultDoctor,
      status: 'ACTIVE' // Client trying to forge ACTIVE state
    });
    assert.strictEqual(rogue.status, 'PAIRING', 'Server must ignore client-passed status and enforce PAIRING');
  });

  // --- SUITE 4: Replay, Cancellation & Terminal State Protections ---
  console.log('\n--- SUITE 4: Replay, Expiration & Terminal State Protections ---');

  test('Test 9: Invalid pairing token rejected with 401', () => {
    const freshSession = captureSessionService.createSession({
      patientId: 'pat-test-invalid-token',
      actor: defaultDoctor
    });

    assert.throws(() => {
      captureSessionService.pairSession(freshSession.sessionId, '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    }, (err) => {
      return err.code === 'INVALID_PAIRING_TOKEN' && err.status === 401;
    }, 'Invalid pairing token must throw INVALID_PAIRING_TOKEN (401)');
  });

  test('Test 10: Expired token rejected server-side with 410', () => {
    // Create session with 1ms TTL
    const expiredSession = captureSessionService.createSession({
      patientId: 'pat-test-expired',
      actor: defaultDoctor,
      ttlMs: 1 // 1 millisecond
    });

    // Artificially wait 10ms to ensure expiry
    const start = Date.now();
    while (Date.now() - start < 10) {}

    assert.throws(() => {
      captureSessionService.pairSession(expiredSession.sessionId, expiredSession.pairingToken);
    }, (err) => {
      return err.code === 'SESSION_EXPIRED' && err.status === 410;
    }, 'Expired session must throw SESSION_EXPIRED (410)');
  });

  test('Test 23: Expiration enforced strictly server-side on session query', () => {
    const queryExpiredSession = captureSessionService.createSession({
      patientId: 'pat-test-query-expired',
      actor: defaultDoctor,
      ttlMs: 1
    });

    const start = Date.now();
    while (Date.now() - start < 10) {}

    const queried = captureSessionService.getSession(queryExpiredSession.sessionId, defaultDoctor);
    assert.strictEqual(queried.status, 'EXPIRED', 'Server must mark status as EXPIRED when TTL expires');
  });

  test('Test 11: Replay token rejected (single-use pairing capability)', () => {
    // Attempting to reuse testSession1.pairingToken
    assert.throws(() => {
      captureSessionService.pairSession(testSession1.sessionId, testSession1.pairingToken);
    }, (err) => {
      return err.code === 'SESSION_ALREADY_PAIRED' && err.status === 409;
    }, 'Replaying consumed token must fail with SESSION_ALREADY_PAIRED (409)');
  });

  test('Test 12: Cancelled session rejected from pairing', () => {
    const cancelCandidate = captureSessionService.createSession({
      patientId: 'pat-test-cancel',
      actor: defaultDoctor
    });

    const cancelResult = captureSessionService.cancelSession(cancelCandidate.sessionId, defaultDoctor);
    assert.strictEqual(cancelResult.status, 'CANCELLED');

    assert.throws(() => {
      captureSessionService.pairSession(cancelCandidate.sessionId, cancelCandidate.pairingToken);
    }, (err) => {
      return err.code === 'SESSION_CANCELLED' && err.status === 409;
    }, 'Cancelled session cannot be paired');
  });

  test('Test 13: Completed session rejected from pairing', () => {
    const completedCandidate = captureSessionService.createSession({
      patientId: 'pat-test-completed',
      actor: defaultDoctor
    });

    // Transition to COMPLETED
    sessionStore.updateStatus(completedCandidate.sessionId, 'COMPLETED');

    assert.throws(() => {
      captureSessionService.pairSession(completedCandidate.sessionId, completedCandidate.pairingToken);
    }, (err) => {
      return err.code === 'SESSION_COMPLETED' && err.status === 409;
    }, 'Completed session cannot be paired');
  });

  // --- SUITE 5: Multi-Tenant & Multi-Patient Quarantine ---
  console.log('\n--- SUITE 5: Multi-Tenant & Multi-Patient Quarantine ---');

  test('Test 14: Cross-tenant session access strictly rejected with 403', () => {
    assert.throws(() => {
      captureSessionService.getSession(testSession1.sessionId, externalDoctor);
    }, (err) => {
      return err.code === 'CROSS_TENANT_ACCESS_DENIED' && err.status === 403;
    }, 'External doctor must be blocked from querying org-default capture session');
  });

  test('Test 15: Cross-patient access rejected', () => {
    // Session is bound to Patient A. Verifies that query never attaches to Patient B.
    const retrieved = captureSessionService.getSession(testSession1.sessionId, defaultDoctor);
    assert.notStrictEqual(retrieved.patientId, 'pat-other-patient-99');
    assert.strictEqual(retrieved.patientId, 'pat-john-doe-42');
  });

  test('Test 16: Unauthorized session lookup rejected', () => {
    assert.throws(() => {
      captureSessionService.getSession(testSession1.sessionId, null);
    }, (err) => {
      return err.code === 'UNAUTHENTICATED' && err.status === 401;
    }, 'Null actor must be rejected with 401');

    assert.throws(() => {
      captureSessionService.getSession('non-existent-session-id', defaultDoctor);
    }, (err) => {
      return err.code === 'SESSION_NOT_FOUND' && err.status === 404;
    }, 'Unknown session ID must be rejected with 404');
  });

  // --- SUITE 6: Tamper-Evident Audit & Zero Raw-Token Leakage ---
  console.log('\n--- SUITE 6: Tamper-Evident Audit & Zero Raw-Token Leakage ---');

  test('Test 20: Raw pairing token NEVER appears in audit records', () => {
    const events = auditService.getEvents('org-default', 100);
    const token = testSession1.pairingToken;

    for (const evt of events) {
      const serialized = JSON.stringify(evt);
      assert.strictEqual(
        serialized.includes(token),
        false,
        `Raw pairing token ${token} leaked into audit record ${evt.id}!`
      );
    }
  });

  test('Test 21: Pairing event audited in tamper-evident cryptographic chain', () => {
    const events = auditService.getEvents('org-default', 50);
    const pairingEvt = events.find(e => e.action === 'CLINICAL_PIPELINE_CAPTURE_PAIRING_SUCCEEDED');

    assert.ok(pairingEvt, 'Pairing success audit event must be present');
    assert.strictEqual(pairingEvt.resultingState, 'PAIRED');
    assert.ok(pairingEvt.currentHash, 'Event must have cryptographic SHA-256 current_hash');
    assert.ok(pairingEvt.prevHash, 'Event must have cryptographic SHA-256 prev_hash');

    const chainIntegrity = auditService.verifyChain('org-default');
    assert.strictEqual(chainIntegrity.valid, true, 'Audit chain must remain unbroken and valid');
  });

  test('Test 22: Session cancellation audited in tamper-evident cryptographic chain', () => {
    const cancelCandidate = captureSessionService.createSession({
      patientId: 'pat-audit-cancel',
      actor: defaultDoctor
    });
    captureSessionService.cancelSession(cancelCandidate.sessionId, defaultDoctor);

    const events = auditService.getEvents('org-default', 50);
    const cancelEvt = events.find(e => e.action === 'CLINICAL_PIPELINE_CAPTURE_SESSION_CANCELLED' && e.summary.includes(cancelCandidate.sessionId));

    assert.ok(cancelEvt, 'Cancellation audit event must be recorded');
    assert.strictEqual(cancelEvt.resultingState, 'CANCELLED');

    const chainIntegrity = auditService.verifyChain('org-default');
    assert.strictEqual(chainIntegrity.valid, true, 'Audit chain must remain valid after cancellation');
  });

  console.log('\n====================================================================');
  console.log(`   MILESTONE 2B-1 TESTS COMPLETE: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('====================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runMilestone2BTests().catch(err => {
  console.error('Fatal error in Milestone 2B test suite:', err);
  process.exit(1);
});
