/**
 * Automated Verification Suite for Proton Healthcare Operations OS (Phase 1.3)
 * 
 * Verifies:
 * 1. Operational Engine summary & queue state
 * 2. Synthetic cohort grounding (Eleanor Vance & Arthur Pendelton)
 * 3. Agent 1 (Connect): Inbound Triage & Red-Flag Screening (emergency vs high-acuity)
 * 4. Agent 3 (CareFlow): Refill Safety Gate & Anti-Prescriptive Invariant (renal drift, no AI options)
 * 5. Physician-Confirmed Action & FHIR Persistence (mocked/in-memory vs live network)
 * 6. Audit Trail Logging & Provenance
 * 7. [PHASE 1.2] SHA-256 Idempotency Layer & Replay/Conflict Detection
 * 8. [PHASE 1.2] Multi-Tier Patient Identity Resolution (Tier 1/2/3 & Collision Safety)
 * 9. [PHASE 1.2] Tool Registry & Security Policy Gate (Blocked external invocation, parameter/side-effect validation)
 * 10. [PHASE 1.2] Versioned Deterministic Care Gap Rules Engine (Flags vs treatment decisions)
 * 11. [PHASE 1.2] Agent 2 (Scheduler): Consultation Follow-Up & FHIR Appointment Generation
 * 12. [PHASE 1.2] Agent 3 (CareFlow): Specialist Referral Pipeline & FHIR ServiceRequest
 * 13. [PHASE 1.2] FHIR Persistence Mode Isolation & Non-Silent Failure Guard
 * 14. [PHASE 1.3] Clinical Triage Communication Gating (Autonomous Dispatch Blocked: 403 Forbidden)
 * 15. [PHASE 1.3] Administrative Communication Dispatch (Low-Risk Autonomous Policy: 200 OK)
 * 16. [PHASE 1.3] Scheduling Safety Invariant: Proposed Calendar Holds Require Explicit Confirmation
 * 17. [PHASE 1.3] Authoritative Backend Audit: Client Audit Injection Strictly Blocked (403 Forbidden)
 * 18. [PHASE 1.3] Offline Synthetic Mode Transparency & Persistence Integrity
 */

const fs = require('fs');
const path = require('path');

const testDbPath = path.resolve(__dirname, '../../api/data/test_proton_ops.db');
[testDbPath, testDbPath + '-wal', testDbPath + '-shm'].forEach(f => {
  if (fs.existsSync(f)) {
    try { fs.unlinkSync(f); } catch (e) {}
  }
});
process.env.PROTON_DB_PATH = testDbPath;

const http = require('http');
const app = require('../../api/app.js');

let server;
let BASE_URL;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      BASE_URL = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

function makeRequest(method, path, body = null, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...customHeaders
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runOperationsSuite() {
  console.log('\n===============================================================');
  console.log('PROTON HEALTHCARE OPERATIONS OS — AUTOMATED VERIFICATION SUITE');
  console.log('                 PHASE 1.3 COMPREHENSIVE RUN');
  console.log('===============================================================\n');

  // Step 1: Health & Summary Check
  console.log('[TEST 1] Verifying Operations OS Summary & Queue State...');
  const summaryRes = await makeRequest('GET', '/api/operations/summary');
  assert(summaryRes.status === 200, 'Summary endpoint returns 200 OK');
  assert(summaryRes.data.totalActiveTasks >= 4, `Active operational queue loaded with ${summaryRes.data.totalActiveTasks} tasks`);
  assert(summaryRes.data.pendingTriageCount >= 1, 'Triage queue contains pending items');
  assert(summaryRes.data.urgentRefillCount >= 1, 'Refill queue contains items requiring review');
  assert(summaryRes.data.schedulingCareGapCount >= 1, 'Scheduling queue contains care gaps');
  assert(summaryRes.data.openReferralCount >= 1, 'Referral queue contains specialist packets');

  // Step 2: Tasks Feed Inspection
  console.log('\n[TEST 2] Verifying Synthetic Cohort Grounding (Eleanor Vance & Arthur Pendelton)...');
  const tasksRes = await makeRequest('GET', '/api/operations/tasks');
  assert(tasksRes.status === 200, 'Tasks endpoint returns 200 OK');
  const tasks = tasksRes.data.tasks || tasksRes.data;
  const eleanorTask = tasks.find(t => t.patientId === 'eleanor-vance' && t.category === 'triage');
  const arthurRefillTask = tasks.find(t => t.patientId === 'arthur-pendelton' && t.category === 'refill');
  const eleanorSchedTask = tasks.find(t => t.patientId === 'eleanor-vance' && t.category === 'scheduling');
  const arthurReferralTask = tasks.find(t => t.patientId === 'arthur-pendelton' && t.category === 'referral');

  assert(!!eleanorTask, 'Eleanor Vance triage task is present');
  assert(!!arthurRefillTask, 'Arthur Pendelton refill task is present');
  assert(!!eleanorSchedTask, 'Eleanor Vance care gap recall task is present');
  assert(!!arthurReferralTask, 'Arthur Pendelton nephrology referral task is present');

  // Step 3: Agent 1 (Connect): Inbound Triage & Red-Flag Screening
  console.log('\n[TEST 3] Verifying Agent 1 (Connect): Inbound Triage & Red-Flag Screening...');
  const triageRes = await makeRequest('POST', '/api/operations/triage', {
    patientId: 'eleanor-vance',
    channel: 'portal',
    message: 'My blood pressure was 152/94 this morning, and I felt slightly dizzy when I stood up. Should I stop taking my Lisinopril?',
    patientContext: {
      name: 'Eleanor Vance',
      conditions: ['Essential Hypertension', 'Type 2 Diabetes'],
      medications: ['Lisinopril 20mg oral daily', 'Metformin 1000mg BID']
    }
  });
  assert(triageRes.status === 200, 'BP Triage evaluated successfully');
  assert(triageRes.data.triageResult.risk.emergencyRedFlag === false, 'BP spike without acute chest/neuro symptoms is not diverted to 911');
  assert(triageRes.data.triageResult.risk.riskLevel === 'HIGH', 'Symptomatic BP fluctuation flagged as HIGH acuity');
  assert(triageRes.data.triageResult.aiDraft.includes('Lisinopril') || triageRes.data.triageResult.aiDraft.includes('discontinue') || triageRes.data.triageResult.aiDraft.includes('blood pressure'), 
    'AI draft addresses blood pressure medication discontinuation safety');

  // Emergency Red Flag Test
  const emergencyRes = await makeRequest('POST', '/api/operations/triage', {
    patientId: 'arthur-pendelton',
    channel: 'sms',
    message: 'Doctor, I have severe pressure in my chest radiating down my left arm and I cannot catch my breath.',
    patientContext: { name: 'Arthur Pendelton' }
  });
  assert(emergencyRes.status === 200, 'Emergency triage evaluated successfully');
  assert(emergencyRes.data.triageResult.risk.emergencyRedFlag === true, 'Acute coronary symptoms triggered EMERGENCY RED FLAG');
  assert(emergencyRes.data.triageResult.risk.redFlagCategory === 'cardiac', 'Categorized as cardiac red flag');
  assert(emergencyRes.data.triageResult.aiDraft.includes('911') || emergencyRes.data.triageResult.aiDraft.includes('emergency department'), 
    'AI response immediately instructs patient to dial 911');

  // Step 4: Agent 3 (CareFlow): Refill Safety Gate & Anti-Prescriptive Invariant
  console.log('\n[TEST 4] Verifying Agent 3 (CareFlow): Refill Safety Gate & Anti-Prescriptive Invariant...');
  const refillRes = await makeRequest('POST', '/api/operations/refills/verify', {
    patientId: 'arthur-pendelton',
    patientName: 'Arthur Pendelton',
    patientAge: 74,
    medicationName: 'Apixaban (Eliquis)',
    requestedDose: '5mg',
    requestedFrequency: 'BID',
    daysSupply: 90,
    latestCreatinine: 1.6,
    latestEgfr: 48,
    baselineEgfr: 62,
    activeMedications: ['Apixaban (Eliquis) 5mg BID', 'Metoprolol 50mg'],
    allergies: ['NSAID class']
  });
  assert(refillRes.status === 200, 'Refill verification computed');
  assert(refillRes.data.safetyReport.renalDriftWarning !== null, 'Agent detects longitudinal renal drift (eGFR 62 -> 48 mL/min)');
  assert(refillRes.data.safetyReport.warnings.length > 0, 'Agent produces clinical safety warnings');
  assert(refillRes.data.status === 'requested', 'Refill remains in unapproved requested status; agent cannot autonomously approve');
  assert(refillRes.data.requiresPhysicianReview === true, 'Explicit invariant: requiresPhysicianReview is true');
  assert(refillRes.data.options === undefined, 'Agent does NOT generate, rank, or present predefined treatment/dosage options');
  assert(refillRes.data.physicianDecisionRequired === true, 'Safety gate mandates physicianDecisionRequired = true');

  // Cross-Reactivity Allergy Check
  const allergyRefillRes = await makeRequest('POST', '/api/operations/refills/verify', {
    patientId: 'eleanor-vance',
    patientName: 'Eleanor Vance',
    medicationName: 'Amoxicillin',
    requestedDose: '500mg',
    requestedFrequency: 'TID',
    daysSupply: 10,
    allergies: ['Penicillin']
  });
  assert(allergyRefillRes.data.safetyReport.allergyConflict === true, 'Penicillin-Amoxicillin cross-reactivity blocked');
  assert(allergyRefillRes.data.safetyReport.canApprove === false, 'Autonomous or routine approval blocked on critical allergy');

  // Step 5a: Rejection of approval without independent physician decision
  console.log('\n[TEST 5a] Verifying Rejection of Refill without Independent Physician Decision...');
  const taskToApprove = arthurRefillTask.id;
  const rejectNoDecisionRes = await makeRequest('POST', `/api/operations/tasks/${taskToApprove}/approve`, {
    doctor: 'Dr. Sarah Lin, MD',
    physicianDecision: {
      actionType: 'approve_standard',
      clinicalDecisionNotes: '   ' // Empty clinical notes
    }
  });
  assert(rejectNoDecisionRes.status === 400, 'Server rejects approval without physician clinical directive & rationale');

  // Step 5b: Physician-Confirmed Action & FHIR Persistence (Mocked/In-Memory Stub)
  console.log('\n[TEST 5b] Physician-Confirmed Action & FHIR Persistence (EXPLICITLY LABELED: MOCKED/IN-MEMORY FHIR STUB)...');
  const physicianDirective = 'Benefit of stroke prevention outweighs renal risk. Authorizing 30-day monitoring fill of 5mg BID. Repeat BMP ordered in 3 weeks.';
  const approveRes = await makeRequest('POST', `/api/operations/tasks/${taskToApprove}/approve`, {
    doctor: 'Dr. Sarah Lin, MD',
    physicianDecision: {
      actionType: 'approve_standard',
      clinicalDecisionNotes: physicianDirective,
      prescribedDose: '5mg BID',
      daysSupply: 30
    }
  });
  assert(approveRes.status === 200, 'Physician approval accepted with independent decision directive');
  assert(approveRes.data.task.status === 'completed', 'Task state transitioned to completed');
  assert(approveRes.data.task.refillDetails.approvedBy === 'Dr. Sarah Lin, MD', 'Physician signature recorded');
  assert(approveRes.data.task.refillDetails.physicianAction.clinicalDecisionNotes === physicianDirective, 
    'Independent physician clinical directive preserved');
  assert(approveRes.data.task.refillDetails.options === undefined, 
    'Verified task contains zero AI predefined treatment options');

  const fhirMedReq = approveRes.data.task.refillDetails.fhirMedicationRequest;
  assert(!!fhirMedReq, 'FHIR MedicationRequest object created upon physician sign-off');
  assert(fhirMedReq.resourceType === 'MedicationRequest', 'Resource is valid HL7 FHIR R4 MedicationRequest');
  assert(fhirMedReq.status === 'active', 'FHIR MedicationRequest status is active');
  assert(fhirMedReq.intent === 'order', 'FHIR MedicationRequest intent is order');
  assert(fhirMedReq.subject.reference === 'Patient/arthur-pendelton', 'FHIR subject matches patient reference');
  assert(fhirMedReq.requester.display === 'Dr. Sarah Lin, MD', 'FHIR requester is attending physician');
  assert(fhirMedReq.dosageInstruction[0].patientInstruction === physicianDirective, 
    'FHIR dosage instruction contains physician independent directive');
  assert(fhirMedReq.dispenseRequest.expectedSupplyDuration.value === 30, 'FHIR supply duration matches physician confirmed days');

  // Step 5c: Live Medplum FHIR Integration Test (Network Inspection)
  console.log('\n[TEST 5c] Live Medplum FHIR Integration Test (Network Inspection)...');
  const MEDPLUM_URL = process.env.MEDPLUM_BASE_URL || 'http://127.0.0.1:8103';
  let liveMedplumAvailable = false;
  try {
    const checkRes = await new Promise((resolve) => {
      const u = new URL('/healthcheck', MEDPLUM_URL);
      const req = http.get(u, { timeout: 1000 }, (res) => resolve(res.statusCode === 200));
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
    liveMedplumAvailable = checkRes;
  } catch {
    liveMedplumAvailable = false;
  }

  if (liveMedplumAvailable) {
    console.log('  -> Live Medplum server detected on ' + MEDPLUM_URL + '. Writing FHIR MedicationRequest...');
    const writeRes = await makeRequest('POST', `${MEDPLUM_URL}/fhir/R4/MedicationRequest`, fhirMedReq);
    assert(writeRes.status === 201 || writeRes.status === 200, 'Successfully written to live Medplum FHIR server');
  } else {
    console.log('  ℹ Live Medplum server not running on port 8103.');
    console.log('  ✓ [MOCKED/IN-MEMORY TEST CONFIRMED]: Test 5b verified complete FHIR R4 resource construction in isolation from external services.');
  }

  // Step 6: Audit Trail
  console.log('\n[TEST 6] Verifying Operations Audit Trail...');
  const auditRes = await makeRequest('GET', '/api/operations/audit');
  assert(auditRes.status === 200, 'Audit log endpoint returned 200 OK');
  const auditEvents = auditRes.data.auditEvents || auditRes.data;
  assert(Array.isArray(auditEvents) && auditEvents.length > 0, 'Audit events recorded');
  const approvalEvent = auditEvents.find(e => e.action === 'refill_physician_approved');
  assert(!!approvalEvent, 'Audit log recorded refill_physician_approved event');
  assert(approvalEvent.actor === 'Dr. Sarah Lin, MD' || approvalEvent.summary.includes('Dr. Sarah Lin, MD'), 'Audit log attributed to Dr. Sarah Lin, MD');

  // ==============================================================
  // PHASE 1.2 NEW SPECIFICATION TESTS
  // ==============================================================

  // Step 7: SHA-256 Idempotency Layer & Conflict Detection
  console.log('\n[TEST 7] Verifying SHA-256 Idempotency Protection & Replay/Conflict Detection...');
  const testIdempotencyKey = `idemp-test-${Date.now()}`;
  const initialPayload = {
    patientId: 'eleanor-vance',
    message: 'Checking in regarding my morning blood pressure reading of 148/88.',
    channel: 'portal'
  };

  // Initial call with key
  const idempRes1 = await makeRequest('POST', '/api/operations/triage', initialPayload, {
    'x-idempotency-key': testIdempotencyKey
  });
  assert(idempRes1.status === 200, 'Initial request with idempotency key succeeds');
  const initialTaskId = idempRes1.data.task.id;

  // Duplicate replay call with exact same key + exact same payload
  const idempRes2 = await makeRequest('POST', '/api/operations/triage', initialPayload, {
    'x-idempotency-key': testIdempotencyKey
  });
  assert(idempRes2.status === 200, 'Replayed duplicate request returns 200 OK');
  assert(idempRes2.data.isReplay === true, 'Response explicitly flags isReplay: true');
  assert(idempRes2.data.task.id === initialTaskId, 'Replayed request returns identical task ID with zero duplicate task generation');

  // Replay attempt with same key but DIFFERENT payload (Conflict attack / payload corruption)
  const alteredPayload = {
    patientId: 'eleanor-vance',
    message: 'Completely different message payload trying to reuse the same idempotency key.',
    channel: 'portal'
  };
  const idempConflictRes = await makeRequest('POST', '/api/operations/triage', alteredPayload, {
    'x-idempotency-key': testIdempotencyKey
  });
  assert(idempConflictRes.status === 409, 'Reusing idempotency key with altered payload is rejected with 409 Conflict');
  assert(idempConflictRes.data.code === 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD', 
    'Error code confirms IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');

  // Step 8: Multi-Tier Patient Identity Resolution & Collision Safety
  console.log('\n[TEST 8] Verifying Multi-Tier Patient Identity Resolution & Collision Safety...');
  
  // Tier 1: Exact MRN Match
  const idTier1Res = await makeRequest('POST', '/api/operations/identity/resolve', {
    mrn: 'MRN-8841-EV'
  });
  assert(idTier1Res.status === 200, 'Tier 1 identity query succeeds');
  assert(idTier1Res.data.status === 'RESOLVED' && idTier1Res.data.tier === 'TIER_1_EXACT_MRN', 'Resolved via TIER_1_EXACT_MRN');
  assert(idTier1Res.data.confidence === 1.0, 'Confidence is 1.0');
  assert(idTier1Res.data.patientId === 'eleanor-vance', 'Resolved to Eleanor Vance');
  assert(idTier1Res.data.requiresManualResolution === false, 'Does not require manual resolution');

  // Tier 2: Demographic Match (Phone + DOB)
  const idTier2Res = await makeRequest('POST', '/api/operations/identity/resolve', {
    phone: '555-014-9204',
    birthDate: '1952-11-23'
  });
  assert(idTier2Res.status === 200, 'Tier 2 demographic query succeeds');
  assert(idTier2Res.data.status === 'RESOLVED' && idTier2Res.data.tier === 'TIER_2_DEMOGRAPHIC', 'Resolved via TIER_2_DEMOGRAPHIC');
  assert(idTier2Res.data.confidence === 0.95, 'Confidence is 0.95');
  assert(idTier2Res.data.patientId === 'arthur-pendelton', 'Resolved to Arthur Pendelton');

  // Tier 3: Ambiguous Collision (Shared Phone + DOB)
  // INVARIANT: Collision must NEVER be automatically assigned!
  const idCollisionRes = await makeRequest('POST', '/api/operations/identity/resolve', {
    phone: '555-019-8841',
    birthDate: '1958-04-12'
  });
  assert(idCollisionRes.status === 200, 'Demographic collision evaluated');
  assert(idCollisionRes.data.status === 'AMBIGUOUS_COLLISION', 'Status is AMBIGUOUS_COLLISION');
  assert(idCollisionRes.data.confidence < 0.5, 'Confidence downgraded below 0.50');
  assert(idCollisionRes.data.requiresManualResolution === true, 'Strict invariant: requiresManualResolution is true');
  assert(idCollisionRes.data.targetQueue === 'UNASSIGNED_PATIENT_TRIAGE', 'Routed to UNASSIGNED_PATIENT_TRIAGE queue');
  assert(idCollisionRes.data.candidateIds.length >= 2, 'Candidate collision matches identified');

  // Inbound triage submission with collision demographics routes to UNASSIGNED_PATIENT_TRIAGE
  const unassignedTriageRes = await makeRequest('POST', '/api/operations/triage', {
    phone: '555-019-8841',
    birthDate: '1958-04-12',
    message: 'Hello, need to reschedule my upcoming appointment.',
    channel: 'sms'
  });
  assert(unassignedTriageRes.status === 200, 'Collision triage message accepted for routing');
  assert(unassignedTriageRes.data.task.targetQueue === 'UNASSIGNED_PATIENT_TRIAGE', 
    'Task assigned to UNASSIGNED_PATIENT_TRIAGE queue');
  assert(unassignedTriageRes.data.task.requiresManualResolution === true, 
    'Task flagged with requiresManualResolution = true');

  // Step 9: Agent Tool Registry & Security Policy Gate
  console.log('\n[TEST 9] Verifying Agent Tool Registry & Security Policy Gate...');
  
  // Direct external call without internal secret is BLOCKED
  const unauthToolRes = await makeRequest('POST', '/api/operations/internal/tools/execute', {
    toolName: 'get_patient_intelligence',
    params: { patientId: 'eleanor-vance' }
  });
  assert(unauthToolRes.status === 403, 'External invocation without secret is blocked with 403 Forbidden');
  assert(unauthToolRes.data.code === 'UNAUTHORIZED_TOOL_INVOCATION', 'Error code confirms UNAUTHORIZED_TOOL_INVOCATION');

  // Authorized internal call succeeds
  const INTERNAL_SECRET = process.env.INTERNAL_AGENT_SECRET || 'internal-secret-token';
  const authToolRes = await makeRequest('POST', '/api/operations/internal/tools/execute', {
    toolName: 'get_patient_intelligence',
    params: { patientId: 'eleanor-vance' },
    callerContext: { role: 'INTERNAL_AGENT_ENGINE' }
  }, { 'x-proton-internal-secret': INTERNAL_SECRET });
  assert(authToolRes.status === 200, 'Internal tool execution with valid credentials succeeds');
  assert(authToolRes.data.result.patientId === 'eleanor-vance', 'Retrieved patient intelligence for Eleanor Vance');
  assert(authToolRes.data.sideEffect === 'read_chart', 'Declared side-effect is read_chart');

  // Unknown tool is REJECTED
  const unknownToolRes = await makeRequest('POST', '/api/operations/internal/tools/execute', {
    toolName: 'unregistered_exploit_tool',
    params: {},
    callerContext: { role: 'INTERNAL_AGENT_ENGINE' }
  }, { 'x-proton-internal-secret': INTERNAL_SECRET });
  assert(unknownToolRes.status === 404, 'Unknown tool rejected with 404 Not Found');
  assert(unknownToolRes.data.code === 'UNKNOWN_TOOL', 'Error code confirms UNKNOWN_TOOL');

  // Unauthorized side effect is REJECTED
  const unauthSideEffectRes = await makeRequest('POST', '/api/operations/internal/tools/execute', {
    toolName: 'draft_triage_communication',
    params: { patientId: 'eleanor-vance', responseText: 'Test draft', requiresReview: true },
    callerContext: { role: 'INTERNAL_AGENT_ENGINE', allowedSideEffects: ['read_chart'] } // Disallow propose_fhir_draft
  }, { 'x-proton-internal-secret': INTERNAL_SECRET });
  assert(unauthSideEffectRes.status === 403, 'Unauthorized side effect is rejected with 403');
  assert(unauthSideEffectRes.data.code === 'UNAUTHORIZED_SIDE_EFFECT', 'Error code confirms UNAUTHORIZED_SIDE_EFFECT');

  // Step 10: Versioned Deterministic Care Gap Rules Engine
  console.log('\n[TEST 10] Verifying Versioned Deterministic Care Gap Rules Engine...');
  const careGapsRes = await makeRequest('POST', '/api/operations/scheduling/care-gaps', {
    patientId: 'eleanor-vance',
    conditions: ['Type 2 Diabetes Mellitus', 'Essential Hypertension'],
    recentLabs: [
      { name: 'Glycated Hemoglobin (HbA1c)', value: '8.2%', date: '2026-06-15' } // > 120 days ago
    ]
  });
  assert(careGapsRes.status === 200, 'Care gaps endpoint returned 200 OK');
  const gaps = careGapsRes.data.careGaps.gaps;
  assert(Array.isArray(gaps) && gaps.length > 0, 'Care gaps evaluated');
  
  const a1cGap = gaps.find(g => g.ruleId === 'RULE-DM-HBA1C-V1');
  assert(!!a1cGap, 'Diabetic HbA1c rule evaluated');
  assert(a1cGap.guidelineVersion === 'ADA-2026-v1.0', 'Rule includes explicit guideline version (ADA-2026-v1.0)');
  assert(a1cGap.guidelineSource.includes('ADA'), 'Rule includes guideline source citation');
  assert(typeof a1cGap.clinicalRationale === 'string' && a1cGap.clinicalRationale.length > 0, 'Rule provides clinical rationale');
  assert(a1cGap.isOverdue === true, 'HbA1c identified as overdue');
  assert(a1cGap.isClinicalTreatmentDecision === false, 'Invariant: Care-gap rule is NOT an autonomous treatment decision');
  assert(a1cGap.requiresPhysicianReview === true, 'Invariant: Care-gap flag requires physician review');

  // Step 11: Consultation Follow-Up & FHIR Appointment Generation (Agent 2)
  console.log('\n[TEST 11] Verifying Agent 2 (Scheduler): Consultation Follow-Up & FHIR Appointment Generation...');
  const followupPlanText = 'Patient exhibits poor glycemic control. Follow up in 3 months with repeat HbA1c and basic metabolic panel.';
  const schedRes = await makeRequest('POST', '/api/operations/scheduling/followup', {
    patientId: 'eleanor-vance',
    patientName: 'Eleanor Vance',
    consultationPlanText: followupPlanText,
    patientAcuity: 'HIGH ACUITY'
  });
  assert(schedRes.status === 200, 'Follow-up scheduling plan evaluated');
  assert(schedRes.data.followupResult.targetTimeframe === '3 months', 'Extracted 3 months follow-up target');
  assert(schedRes.data.followupResult.requiredLabs.includes('Repeat HbA1c'), 'Extracted preparatory HbA1c requirement');
  assert(schedRes.data.followupResult.requiredLabs.includes('Basic Metabolic / Renal Panel'), 'Extracted preparatory BMP requirement');
  assert(schedRes.data.task.schedulingDetails.proposedSlot !== null, 'Slot allocated with Dr. Sarah Lin, MD');

  const fhirApp = schedRes.data.followupResult.fhirAppointment;
  assert(fhirApp.resourceType === 'Appointment', 'Generated FHIR R4 Appointment resource');
  assert(fhirApp.status === 'proposed', 'FHIR Appointment status is proposed');
  assert(fhirApp.participant.length >= 2, 'FHIR Appointment participants include patient and attending physician');

  // Step 12: Specialist Referral Pipeline & FHIR ServiceRequest (Agent 3)
  console.log('\n[TEST 12] Verifying Agent 3 (CareFlow): Specialist Referral Pipeline & FHIR ServiceRequest...');
  const referralRes = await makeRequest('POST', '/api/operations/referrals/compile', {
    patientId: 'arthur-pendelton',
    patientName: 'Arthur Pendelton',
    patientAgeSex: '74M',
    specialty: 'Nephrology',
    specialtyCode: '394589003',
    targetProviderOrClinic: 'Regional Nephrology Associates (Dr. M. Patel)',
    clinicalIndication: 'Evaluation of progressive eGFR decline (62 -> 48 mL/min) and renal management on chronic DOAC',
    hpiSummary: '74-year-old male with persistent nonvalvular AFib and progressive eGFR decline on chronic Apixaban.',
    relevantLabs: [
      { name: 'Serum Creatinine', value: '1.6 mg/dL', date: '2026-09-28' },
      { name: 'eGFR', value: '48 mL/min', date: '2026-09-28' }
    ],
    currentMedications: ['Apixaban 5mg BID', 'Metoprolol 50mg'],
    documentedAllergies: ['NSAID class hypersensitivity'],
    orderingPhysician: 'Dr. Sarah Lin, MD'
  });
  assert(referralRes.status === 200, 'Specialist referral packet compiled');
  assert(referralRes.data.referralResult.specialty === 'Nephrology', 'Referral specialty confirmed as Nephrology');
  assert(referralRes.data.referralResult.requiresPhysicianReview === true, 'Referral packet tagged for physician review');

  const fhirSr = referralRes.data.referralResult.fhirServiceRequest;
  assert(fhirSr.resourceType === 'ServiceRequest', 'Generated valid HL7 FHIR R4 ServiceRequest');
  assert(fhirSr.status === 'draft', 'ServiceRequest status is draft');
  assert(fhirSr.intent === 'order', 'ServiceRequest intent is order');
  assert(fhirSr.code.coding[0].code === '394589003', 'ServiceRequest contains SNOMED code for Nephrology');
  assert(fhirSr.supportingInfo.length >= 4, 'ServiceRequest embeds citations for HPI, Vitals, Labs, Meds, and Allergies');

  // Step 13: FHIR Persistence Mode Isolation & Failed Write Guard
  console.log('\n[TEST 13] Verifying FHIR Persistence Mode Isolation & Failed Write Guard...');
  
  // In-Memory Mode Verification
  assert(approveRes.data.fhirPersistence.persistenceMeta.mode === 'in_memory_stub', 
    'Default mode stamps persistenceMeta.mode = in_memory_stub');
  assert(approveRes.data.fhirPersistence.persistenceMeta.livePersisted === false, 
    'Default mode explicitly asserts livePersisted = false (does NOT falsely claim live Medplum write)');

  // Failed Medplum Write Guard:
  // INVARIANT: When PROTON_FHIR_PERSISTENCE_MODE=medplum, a failure to reach Medplum MUST NEVER silently fall back to in-memory fake success.
  const prevMode = process.env.PROTON_FHIR_PERSISTENCE_MODE;
  const prevUrl = process.env.MEDPLUM_BASE_URL;
  try {
    process.env.PROTON_FHIR_PERSISTENCE_MODE = 'medplum';
    process.env.MEDPLUM_BASE_URL = 'http://127.0.0.1:9999/unreachable-fhir'; // Port with nothing listening

    // Attempting task approval under failing live Medplum mode
    const failedPersistRes = await makeRequest('POST', `/api/operations/tasks/${eleanorTask.id}/approve`, {
      doctor: 'Dr. Sarah Lin, MD',
      editedContent: 'Triage response approved for testing failing Medplum persistence.'
    });

    assert(failedPersistRes.status === 502, 'When live Medplum write fails, server returns 502 Bad Gateway');
    assert(failedPersistRes.data.code === 'FHIR_PERSISTENCE_FAILURE', 
      'Error code confirms FHIR_PERSISTENCE_FAILURE (NO SILENT FALLBACK TO FAKE SUCCESS)');
  } finally {
    // Restore environment
    process.env.PROTON_FHIR_PERSISTENCE_MODE = prevMode || 'in_memory';
    process.env.MEDPLUM_BASE_URL = prevUrl || 'http://127.0.0.1:8103';
  }

  // Step 14: [PHASE 1.3] Clinical Triage Communication Gating (Autonomous Dispatch Blocked: 403 Forbidden)
  console.log('\n[TEST 14] Verifying Clinical Communication Safety: Autonomous Dispatch Strictly Blocked...');
  const unauthorizedDispatchRes = await makeRequest('POST', `/api/operations/communications/${eleanorTask.id}/dispatch`, {
    channel: 'portal'
  });
  assert(unauthorizedDispatchRes.status === 403, 'Attempting autonomous dispatch of clinical communication returns 403 Forbidden');
  assert(unauthorizedDispatchRes.data.code === 'CLINICAL_COMMUNICATION_CANNOT_BE_AUTONOMOUSLY_DISPATCHED', 
    'Error code confirms CLINICAL_COMMUNICATION_CANNOT_BE_AUTONOMOUSLY_DISPATCHED');
  
  // Verify task remains uncompleted (never marked completed or sent)
  const taskAfterBlockedDispatch = (await makeRequest('GET', '/api/operations/tasks')).data.tasks.find(t => t.id === eleanorTask.id);
  assert(taskAfterBlockedDispatch.status !== 'completed' && (taskAfterBlockedDispatch.status === 'requested' || taskAfterBlockedDispatch.status === 'reconciliation_failed'), 
    'Clinical task remains in uncompleted status after blocked dispatch');

  // Step 15: [PHASE 1.3] Administrative Communication Dispatch (Low-Risk Autonomous Dispatch: 200 OK)
  console.log('\n[TEST 15] Verifying Administrative Communication: Low-Risk Policy Permits Autonomous Dispatch...');
  const adminTask = (await makeRequest('GET', '/api/operations/tasks')).data.tasks.find(t => t.id === 'task-admin-hours-01');
  assert(!!adminTask, 'Administrative task (hours/parking inquiry) exists in cohort');
  assert(adminTask.triageDetails.communicationCategory === 'administrative', 'Task categorized as administrative');
  assert(adminTask.triageDetails.autonomousDispatchAllowed === true, 'Autonomous dispatch policy allowed for administrative inquiry');

  const adminDispatchRes = await makeRequest('POST', `/api/operations/communications/${adminTask.id}/dispatch`, {
    channel: 'portal'
  });
  assert(adminDispatchRes.status === 200, 'Administrative dispatch returns 200 OK');
  assert(adminDispatchRes.data.dispatched === true, 'Administrative message successfully dispatched');
  assert(adminDispatchRes.data.communicationCategory === 'administrative', 'Confirmed administrative communication classification');

  // Verify server-side audit event for administrative dispatch
  const auditResAfterAdmin = await makeRequest('GET', '/api/operations/audit?limit=5');
  const adminAuditEvent = auditResAfterAdmin.data.auditEvents.find(e => e.action === 'administrative_communication_dispatched');
  assert(!!adminAuditEvent, 'Server-side audit log contains administrative_communication_dispatched record');
  assert(adminAuditEvent.actor.includes('Proton Connect Agent'), 'Audit actor correctly identifies Proton Connect Agent (Autonomous Policy)');

  // Step 16: [PHASE 1.3] Scheduling Safety Invariant: Proposed Appointments Require Explicit Confirmation
  console.log('\n[TEST 16] Verifying Scheduling Safety: Proposed Calendar Holds Require Explicit Confirmation...');
  const schedTaskBefore = (await makeRequest('GET', '/api/operations/tasks')).data.tasks.find(t => t.id === eleanorSchedTask.id);
  assert(schedTaskBefore.schedulingDetails.appointmentStatus === 'proposed', 'Initial appointment status is strictly proposed (NOT silently booked)');
  assert(schedTaskBefore.status === 'ready', 'Scheduling task status is ready awaiting patient/physician action');

  // Explicit confirmation via dedicated endpoint
  const confirmSchedRes = await makeRequest('POST', `/api/operations/scheduling/${eleanorSchedTask.id}/confirm`, {
    confirmedBy: 'Eleanor Vance (Patient Portal Confirmation)'
  });
  assert(confirmSchedRes.status === 200, 'Explicit appointment confirmation returns 200 OK');
  assert(confirmSchedRes.data.appointmentStatus === 'booked', 'Appointment transitions to booked status upon explicit confirmation');

  const schedTaskAfter = (await makeRequest('GET', '/api/operations/tasks')).data.tasks.find(t => t.id === eleanorSchedTask.id);
  assert(schedTaskAfter.status === 'completed', 'Scheduling task marked completed after explicit booking confirmation');
  assert(schedTaskAfter.schedulingDetails.appointmentStatus === 'booked', 'Task scheduling details reflects booked state');

  // Verify server-side audit event for appointment confirmation
  const auditResAfterSched = await makeRequest('GET', '/api/operations/audit?limit=5');
  const schedAuditEvent = auditResAfterSched.data.auditEvents.find(e => e.action === 'appointment_scheduled' && e.summary.includes('officially booked'));
  assert(!!schedAuditEvent, 'Authoritative server audit log recorded appointment_scheduled transition');
  assert(schedAuditEvent.actor === 'Eleanor Vance (Patient Portal Confirmation)', 'Audit log captures exact confirming entity');

  // Step 17: [PHASE 1.3] Authoritative Backend Audit: Client Audit Injection Strictly Blocked
  console.log('\n[TEST 17] Verifying Authoritative Backend Audit: Client Audit Injection Blocked (403 Forbidden)...');
  const rogueAuditRes = await makeRequest('POST', '/api/operations/audit', {
    action: 'fake_physician_approval',
    actor: 'Rogue Client Script',
    patientId: 'eleanor-vance',
    summary: 'Rogue client attempt to forge authoritative audit record'
  });
  assert(rogueAuditRes.status === 403, 'POST /api/operations/audit is strictly rejected with 403 Forbidden');
  assert(rogueAuditRes.data.code === 'UNAUTHORIZED_AUDIT_INJECTION', 'Error code confirms UNAUTHORIZED_AUDIT_INJECTION');

  // Step 18: [PHASE 1.3] Offline Synthetic Mode Transparency & Persistence Integrity
  console.log('\n[TEST 18] Verifying Offline Synthetic Mode Transparency & Persistence Integrity...');
  // Verify that GET /api/operations/summary reflects accurate system state
  const finalSummaryRes = await makeRequest('GET', '/api/operations/summary');
  assert(finalSummaryRes.status === 200, 'Summary endpoint returns 200 OK');
  
  // Verify audit log can only be retrieved via GET and reflects valid transitions
  const finalAuditRes = await makeRequest('GET', '/api/operations/audit?limit=20');
  assert(finalAuditRes.status === 200, 'GET /api/operations/audit returns 200 OK');
  assert(Array.isArray(finalAuditRes.data.auditEvents), 'Audit log returns valid array of server-generated events');
  const actions = finalAuditRes.data.auditEvents.map(e => e.action);
  assert(actions.includes('refill_physician_approved'), 'Authoritative log includes approved refill from physician sign-off');
  assert(!actions.includes('fake_physician_approval'), 'Rogue audit record was NOT persisted in authoritative log');

  // Step 19: [PHASE 1.4] Durable Relational Storage & Multi-Tenant Scoping
  console.log('\n[TEST 19] Verifying Durable Relational Storage & Multi-Tenant Scoping...');
  const durableTasksRes = await makeRequest('GET', '/api/operations/tasks');
  assert(durableTasksRes.status === 200, 'Tasks retrieved from durable SQLite storage');
  assert(durableTasksRes.data.tasks.length >= 5, 'Durable database contains all operational tasks');
  durableTasksRes.data.tasks.forEach(t => {
    assert(t.tenantId === 'org-default', `Task ${t.id} belongs to tenant org-default`);
    assert(typeof t.reconciliationStatus === 'string', `Task ${t.id} has valid reconciliationStatus (${t.reconciliationStatus})`);
  });

  // Step 20: [PHASE 1.4] Authoritative RBAC & Multi-Tenant Isolation
  console.log('\n[TEST 20] Verifying Authoritative RBAC & Multi-Tenant Isolation...');
  // A. Operations staff attempting to approve clinical prescription refill is blocked
  const opsStaffApproveRes = await makeRequest('POST', `/api/operations/tasks/${arthurRefillTask.id}/approve`, {
    physicianDecision: {
      actionType: 'approve_standard',
      clinicalDecisionNotes: 'Rogue attempt by staff to approve refill'
    }
  }, {
    'X-Proton-Dev-Persona': 'ops-staff-marcus'
  });
  assert(opsStaffApproveRes.status === 403, 'Operations staff role is blocked from approving refills with 403 Forbidden');
  assert(opsStaffApproveRes.data.code === 'INSUFFICIENT_CLINICAL_PRIVILEGES', 'Error code confirms INSUFFICIENT_CLINICAL_PRIVILEGES');

  // B. Operations staff attempting to dispatch clinical communication is blocked
  const opsStaffClinicalDispatchRes = await makeRequest('POST', `/api/operations/communications/${eleanorTask.id}/dispatch`, {
    channel: 'portal'
  }, {
    'X-Proton-Dev-Persona': 'ops-staff-marcus'
  });
  assert(opsStaffClinicalDispatchRes.status === 403, 'Operations staff role is blocked from dispatching clinical communication with 403 Forbidden');
  assert(opsStaffClinicalDispatchRes.data.code === 'INSUFFICIENT_CLINICAL_PRIVILEGES', 'Error code confirms INSUFFICIENT_CLINICAL_PRIVILEGES');

  // C. Cross-tenant isolation: physician from external hospital cannot access org-default tasks
  const crossTenantRes = await makeRequest('GET', '/api/operations/tasks?tenantId=org-default', null, {
    'X-Proton-Dev-Persona': 'external-physician'
  });
  assert(crossTenantRes.status === 403, 'Cross-tenant access attempt is rejected with 403 Forbidden');
  assert(crossTenantRes.data.code === 'CROSS_TENANT_ACCESS_DENIED', 'Error code confirms CROSS_TENANT_ACCESS_DENIED');

  // D. Operations staff CAN confirm proposed appointment
  const opsStaffConfirmRes = await makeRequest('POST', `/api/operations/scheduling/${eleanorSchedTask.id}/confirm`, {
    confirmedBy: 'Marcus Vance (Triage Coordinator)'
  }, {
    'X-Proton-Dev-Persona': 'ops-staff-marcus'
  });
  assert(opsStaffConfirmRes.status === 200, 'Operations staff role is authorized to confirm proposed appointments');

  // Step 21: [PHASE 1.4] Durable Intent + FHIR Reconciliation Failure & Idempotent Identifier
  console.log('\n[TEST 21] Verifying Durable Intent + FHIR Reconciliation Failure & Idempotent Identifier...');
  const prevPersistMode = process.env.PROTON_FHIR_PERSISTENCE_MODE;
  const prevMedUrl = process.env.MEDPLUM_BASE_URL;
  try {
    process.env.PROTON_FHIR_PERSISTENCE_MODE = 'medplum';
    process.env.MEDPLUM_BASE_URL = 'http://127.0.0.1:9998/unreachable'; // Offline port

    const failedReconcileRes = await makeRequest('POST', `/api/operations/tasks/${eleanorTask.id}/approve`, {
      doctor: 'Dr. Sarah Lin, MD',
      editedContent: 'Triage response approved for reconciliation testing.'
    }, {
      'X-Proton-Dev-Persona': 'physician-lin'
    });

    assert(failedReconcileRes.status === 502, 'When external FHIR write fails, server returns 502 Bad Gateway');
    assert(failedReconcileRes.data.code === 'FHIR_PERSISTENCE_FAILURE', 'Error code confirms FHIR_PERSISTENCE_FAILURE');

    // Verify task state in database is 'reconciliation_failed'
    const failedTask = (await makeRequest('GET', `/api/operations/tasks`)).data.tasks.find(t => t.id === eleanorTask.id);
    assert(failedTask.status === 'reconciliation_failed', 'Task status marked reconciliation_failed in durable database');
    assert(failedTask.reconciliationStatus === 'failed', 'Reconciliation status marked failed (NO FAKE SUCCESS)');
    assert(typeof failedTask.reconciliationError === 'string', 'Durable database preserved exact reconciliation failure error');
  } finally {
    process.env.PROTON_FHIR_PERSISTENCE_MODE = prevPersistMode || 'in_memory';
    process.env.MEDPLUM_BASE_URL = prevMedUrl || 'http://127.0.0.1:8103';
  }

  // Idempotent retry under restored mode
  const retryReconcileRes = await makeRequest('POST', `/api/operations/tasks/${eleanorTask.id}/approve`, {
    doctor: 'Dr. Sarah Lin, MD',
    editedContent: 'Triage response approved on retry.'
  }, {
    'X-Proton-Dev-Persona': 'physician-lin'
  });
  assert(retryReconcileRes.status === 200, 'Reconciled successfully on retry under functioning persistence');
  assert(retryReconcileRes.data.task.reconciliationStatus === 'reconciled', 'Task reconciliationStatus transitioned to reconciled');
  assert(retryReconcileRes.data.task.status === 'completed', 'Task status transitioned to completed upon confirmed reconciliation');

  // Verify deterministic FHIR Identifier and Resource ID on Eleanor's retried task
  const retriedFhir = retryReconcileRes.data.fhirPersistence.persistedResource;
  assert(retriedFhir.id === `comm-${eleanorTask.id}`, 'FHIR resource ID is strictly deterministic (comm-${taskId}) with NO timestamp');
  const eleanorTaskIdentifier = retriedFhir.identifier?.find(i => i.system === 'https://proton.health/ops/task');
  assert(!!eleanorTaskIdentifier, 'FHIR resource contains proton ops task identifier');
  assert(eleanorTaskIdentifier.value === eleanorTask.id, 'FHIR identifier value matches exact immutable task ID (NO timestamp)');

  // Sequential retry idempotency check
  const secondRetryRes = await makeRequest('POST', `/api/operations/tasks/${eleanorTask.id}/approve`, {
    doctor: 'Dr. Sarah Lin, MD',
    editedContent: 'Triage response approved on second retry.'
  }, {
    'X-Proton-Dev-Persona': 'physician-lin'
  });
  assert(secondRetryRes.status === 200, 'Second retry returns 200 OK');
  assert(secondRetryRes.data.isReplay === true, 'Second retry recognized as idempotent replay');
  assert(secondRetryRes.data.task.fhirResourceId === retryReconcileRes.data.task.fhirResourceId, 
    'Second retry reuses exact same immutable FHIR resource ID');

  // Concurrent retry idempotency check on Arthur referral task
  const [concurrentRes1, concurrentRes2] = await Promise.all([
    makeRequest('POST', `/api/operations/tasks/${arthurReferralTask.id}/approve`, {
      doctor: 'Dr. Sarah Lin, MD'
    }, {
      'X-Proton-Dev-Persona': 'physician-lin'
    }),
    makeRequest('POST', `/api/operations/tasks/${arthurReferralTask.id}/approve`, {
      doctor: 'Dr. Sarah Lin, MD'
    }, {
      'X-Proton-Dev-Persona': 'physician-lin'
    })
  ]);

  assert(concurrentRes1.status === 200 && concurrentRes2.status === 200, 'Both concurrent approvals returned 200 OK');
  const fhirId1 = concurrentRes1.data.task.fhirResourceId;
  const fhirId2 = concurrentRes2.data.task.fhirResourceId;
  assert(fhirId1 === `sr-${arthurReferralTask.id}`, 'Resource ID is derived deterministically from task ID (sr-${taskId})');
  assert(fhirId1 === fhirId2, 'Concurrent retries return the exact identical FHIR resource ID (ZERO duplicate resources)');
  assert(concurrentRes1.data.task.reconciliationStatus === 'reconciled', 'Task reconciliationStatus is reconciled');

  // Step 22: [PHASE 1.4] Abstract Communication Gateway & Synthetic Delivery State Machine
  console.log('\n[TEST 22] Verifying Abstract Communication Gateway & Synthetic Delivery State Machine...');
  // A. Normal dispatch transitions through queued -> sending -> delivered
  const adminTaskForGw = (await makeRequest('GET', '/api/operations/tasks')).data.tasks.find(t => t.id === 'task-admin-hours-01');
  const gwDispatchRes = await makeRequest('POST', `/api/operations/communications/${adminTaskForGw.id}/dispatch`, {
    channel: 'portal'
  }, {
    'X-Proton-Dev-Persona': 'ops-staff-marcus'
  });
  assert(gwDispatchRes.status === 200, 'Gateway dispatch returns 200 OK');
  assert(gwDispatchRes.data.deliveryStatus === 'delivered', 'Delivery state machine reached delivered state');
  assert(typeof gwDispatchRes.data.gatewayRef === 'string' && gwDispatchRes.data.gatewayRef.startsWith('gw-synth-'), 
    'Synthetic provider generated valid gateway reference');

  // B. Failure mode injection
  const failModeOnRes = await makeRequest('POST', '/api/operations/gateway/failure-mode', {
    enable: true,
    reason: 'SIMULATED_CARRIER_OUTAGE'
  });
  assert(failModeOnRes.status === 200, 'Carrier outage failure mode enabled for testing');

  // Dispatch under simulated outage
  const failedGwDispatchRes = await makeRequest('POST', `/api/operations/communications/${adminTaskForGw.id}/dispatch`, {
    channel: 'sms'
  }, {
    'X-Proton-Dev-Persona': 'ops-staff-marcus'
  });
  assert(failedGwDispatchRes.status === 200, 'Gateway handles delivery failure gracefully');
  assert(failedGwDispatchRes.data.deliveryStatus === 'failed' || failedGwDispatchRes.data.deliveryStatus === 'escalated', 
    'Message delivery state transitioned to failed/escalated upon transmission failure');

  // Reset failure mode
  await makeRequest('POST', '/api/operations/gateway/failure-mode', { enable: false });

  // Step 23: [PHASE 1.4] Zero Chain-of-Thought Storage Invariant Verification
  console.log('\n[TEST 23] Verifying Zero Chain-of-Thought Storage Invariant...');
  const { getDatabase } = require('../../api/storage/db');
  const db = getDatabase();
  const agentRuns = db.prepare('SELECT * FROM agent_execution_runs;').all();
  assert(agentRuns.length > 0, `Recorded ${agentRuns.length} agent execution runs in durable database`);
  
  agentRuns.forEach(run => {
    assert(typeof run.model_provider === 'string', 'Run records model_provider');
    assert(typeof run.latency_ms === 'number', 'Run records latency_ms');
    assert(typeof run.tokens_consumed === 'number', 'Run records tokens_consumed');
    
    // INVARIANT: Zero private chain-of-thought, thinking, scratchpads
    if (run.structured_output) {
      assert(!run.structured_output.includes('"thought":'), 'Invariant: Zero "thought" tokens stored');
      assert(!run.structured_output.includes('"thinking":'), 'Invariant: Zero "thinking" tokens stored');
      assert(!run.structured_output.includes('"chainOfThought":'), 'Invariant: Zero "chainOfThought" tokens stored');
      assert(!run.structured_output.includes('"scratchpad":'), 'Invariant: Zero "scratchpad" tokens stored');
      assert(!run.structured_output.includes('"internalMonologue":'), 'Invariant: Zero "internalMonologue" tokens stored');
    }
  });

  // Step 24: [PHASE 1.4] Tamper-Evident Append-Only Audit Trail Hash Chain Verification
  console.log('\n[TEST 24] Verifying Tamper-Evident Append-Only Audit Trail Hash Chain...');
  const verifyAuditRes = await makeRequest('GET', '/api/operations/audit/verify');
  assert(verifyAuditRes.status === 200, 'Audit verification endpoint returns 200 OK');
  assert(verifyAuditRes.data.valid === true, 'Tamper-evident audit trail hash chain is 100% valid and unbroken');
  assert(verifyAuditRes.data.totalEventsVerified >= 5, `Successfully verified cryptographic chain across ${verifyAuditRes.data.totalEventsVerified} events`);

  // Step 25: [PHASE 1.4] Scoped Clinical Brain Grounding & Real Fact Provenance
  console.log('\n[TEST 25] Verifying Scoped Clinical Brain Grounding & Real Fact Provenance...');
  const { getScopedPatientContext } = require('../../api/agents/brainBridge');
  const scopedTriage = getScopedPatientContext('eleanor-vance', 'triage');
  assert(scopedTriage.found === true, 'Scoped context retrieved for Eleanor Vance');
  assert(scopedTriage.conditions.includes('Essential Hypertension'), 'Clinical Brain conditions grounded in medical facts');
  assert(scopedTriage.allergies.some(a => a.includes('Penicillin')), 'Documented allergy preserved with cross-reactivity note');
  
  const provenanceKeys = Object.keys(scopedTriage.provenanceMap);
  assert(provenanceKeys.length >= 3, 'All clinical facts cite real immutable provenance references');
  provenanceKeys.forEach(key => {
    const p = scopedTriage.provenanceMap[key];
    assert(typeof p.resourceRef === 'string' && p.resourceRef.includes('/'), `Provenance reference (${p.resourceRef}) contains valid FHIR resource format`);
    assert(p.provenanceType === 'FACT', 'Provenance type explicitly confirmed as FACT');
    assert(typeof p.verifiedBy === 'string' && p.verifiedBy.length > 0, `Verified by real approving clinician (${p.verifiedBy})`);
  });

  console.log('\n===============================================================');
  console.log('✅ ALL OPERATIONS OS PHASE 1.4 VERIFICATION CHECKS PASSED!');
  console.log('===============================================================\n');

  if (server) {
    server.close();
  }
  const { closeDatabase } = require('../../api/storage/db');
  closeDatabase();
}

startServer()
  .then(() => runOperationsSuite())
  .catch(err => {
    console.error('Fatal test error:', err);
    if (server) server.close();
    try {
      const { closeDatabase } = require('../../api/storage/db');
      closeDatabase();
    } catch (e) {}
    process.exit(1);
  });
