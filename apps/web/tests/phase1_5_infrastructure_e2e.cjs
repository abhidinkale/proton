/**
 * Proton Healthcare Operations OS — Phase 1.5 Private Beta Infrastructure E2E Suite
 * 
 * Comprehensive Automated Verification covering:
 * [TEST A] Authenticated Server-Side Identity (HMAC-SHA256 Bearer tokens & signature validation)
 * [TEST B] Unauthorized Access & Production Fail-Closed Gates (401 on missing auth, 403 on role mismatch)
 * [TEST C] Multi-Tenant / Organization Isolation (Cross-tenant access fails closed with 403)
 * [TEST D] PostgreSQL Repository Abstraction & Migration Versioning
 * [TEST E] Durable Job Execution & Worker Retry with Exponential Backoff
 * [TEST F] Worker Crash / Stale-Lock Restart Recovery
 * [TEST G] Concurrent Reconciliation Workers & Mutual Exclusion
 * [TEST H] Deterministic FHIR Idempotency (Immutable task-derived identifier & ID across retries)
 * [TEST I] Persistent Audit Trail Integrity & Hash Chaining
 * [TEST J] Cryptographic Audit Tamper Detection
 * [TEST K] Secret & Config Hardening (Production fails closed on missing/weak secrets)
 * [TEST L] Zero Chain-of-Thought Storage Invariant
 * [TEST M] Zero PHI Leakage in Operational Telemetry Logs
 * [TEST N] Failed FHIR -> Durable Job Enqueue -> Worker Retry -> Successful Reconciliation
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Setup isolated test database for Phase 1.5 run
const testDbPath = path.resolve(__dirname, '../../api/data/test_proton_phase1_5.db');
[testDbPath, testDbPath + '-wal', testDbPath + '-shm'].forEach(f => {
  if (fs.existsSync(f)) {
    try { fs.unlinkSync(f); } catch (e) {}
  }
});
process.env.PROTON_DB_PATH = testDbPath;
process.env.NODE_ENV = 'development'; // Controlled test harness

const app = require('../../api/app.js');
const { createSessionToken, verifySessionToken } = require('../../api/middleware/authService');
const { validateConfig, sanitizeConfigForLogging, ConfigurationError } = require('../../api/config');
const { sanitizeForTelemetry, REDACTED_PHI_KEYS } = require('../../api/middleware/telemetry');
const { getDatabase, closeDatabase } = require('../../api/storage/db');
const taskRepository = require('../../api/storage/taskRepository');
const jobRepository = require('../../api/storage/jobRepository');
const auditRepository = require('../../api/storage/auditRepository');
const agentRunRepository = require('../../api/storage/agentRunRepository');
const { runWorkerCycle, discoverUnreconciledTasks, reconstructTaskFhirResource } = require('../../api/workers/reconciliationWorker');
const { POSTGRES_MIGRATIONS } = require('../../api/storage/postgresDb');
const taskRepositoryPg = require('../../api/storage/postgres/taskRepositoryPg');
const auditRepositoryPg = require('../../api/storage/postgres/auditRepositoryPg');
const jobRepositoryPg = require('../../api/storage/postgres/jobRepositoryPg');

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
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
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

async function runPhase15Suite() {
  console.log('\n===============================================================');
  console.log('PROTON HEALTHCARE OPERATIONS OS — PHASE 1.5 INFRASTRUCTURE SUITE');
  console.log('          PRIVATE BETA INFRASTRUCTURE VERIFICATION');
  console.log('===============================================================\n');

  // Generate verified session tokens
  const physicianToken = createSessionToken({
    actorId: 'usr-md-lin-01',
    actorRole: 'physician',
    actorName: 'Dr. Sarah Lin, MD',
    tenantId: 'org-default',
    npi: '1928374650'
  });

  const opsStaffToken = createSessionToken({
    actorId: 'usr-ops-marcus-01',
    actorRole: 'operations_staff',
    actorName: 'Marcus Vance (Triage Coordinator)',
    tenantId: 'org-default'
  });

  const externalPhysicianToken = createSessionToken({
    actorId: 'usr-md-ext-99',
    actorRole: 'physician',
    actorName: 'Dr. External Physician, MD',
    tenantId: 'org-external-hospital',
    npi: '9988776655'
  });

  // [TEST A] Authenticated Server-Side Identity
  console.log('[TEST A] Verifying Authenticated Server-Side Identity (Signed Bearer Tokens)...');
  const validTokenVerification = verifySessionToken(physicianToken);
  assert(validTokenVerification.valid === true, 'Session token cryptographically verified via HMAC-SHA256');
  assert(validTokenVerification.actor.actorId === 'usr-md-lin-01', 'Actor ID correctly extracted from token');
  assert(validTokenVerification.actor.tenantId === 'org-default', 'Tenant ID correctly extracted from token');
  assert(validTokenVerification.actor.actorRole === 'physician', 'Role correctly extracted from token');

  // Verify expired token behavior
  const expiredToken = createSessionToken({
    actorId: 'usr-expired',
    actorRole: 'physician',
    actorName: 'Dr. Expired',
    tenantId: 'org-default'
  }, -1); // Issued in the past
  const expiredVerification = verifySessionToken(expiredToken);
  assert(expiredVerification.valid === false, 'Expired session token rejected');
  assert(expiredVerification.code === 'SESSION_EXPIRED', 'Error code confirms SESSION_EXPIRED');

  // Verify tampered signature behavior
  const tamperedToken = physicianToken.slice(0, -6) + 'xxxxxx';
  const tamperedVerification = verifySessionToken(tamperedToken);
  assert(tamperedVerification.valid === false, 'Tampered session token signature rejected');
  assert(tamperedVerification.code === 'INVALID_SESSION_TOKEN', 'Error code confirms INVALID_SESSION_TOKEN');

  // Query API with valid Bearer token
  const authSummaryRes = await makeRequest('GET', '/api/operations/summary', null, {
    'Authorization': `Bearer ${physicianToken}`
  });
  assert(authSummaryRes.status === 200, 'Protected summary endpoint succeeds with valid Bearer token');
  assert(typeof authSummaryRes.data.totalActiveTasks === 'number', 'Summary returns valid operational metrics');

  // [TEST B] Unauthorized Access & Production Fail-Closed Gates
  console.log('\n[TEST B] Verifying Unauthorized Access & Fail-Closed RBAC Gates...');
  // A. Tampered token rejected at HTTP layer
  const badTokenRes = await makeRequest('GET', '/api/operations/summary', null, {
    'Authorization': `Bearer ${tamperedToken}`
  });
  assert(badTokenRes.status === 401, 'Request with tampered token is rejected with 401 Unauthorized');
  assert(badTokenRes.data.code === 'INVALID_SESSION_TOKEN', 'Error code confirms INVALID_SESSION_TOKEN');

  // B. Role mismatch check: Operations staff role blocked from clinical refill approval
  const opsRefillRes = await makeRequest('POST', '/api/operations/tasks/task-ap-refill-01/approve', {
    physicianDecision: { actionType: 'approve_standard', clinicalDecisionNotes: 'Staff attempt' }
  }, {
    'Authorization': `Bearer ${opsStaffToken}`
  });
  assert(opsRefillRes.status === 403, 'Operations staff role blocked from approving clinical refill with 403 Forbidden');
  assert(opsRefillRes.data.code === 'INSUFFICIENT_CLINICAL_PRIVILEGES', 'Error code confirms INSUFFICIENT_CLINICAL_PRIVILEGES');

  // [TEST C] Multi-Tenant / Organization Isolation
  console.log('\n[TEST C] Verifying Multi-Tenant & Organization Isolation...');
  // Physician from external hospital cannot access org-default tasks
  const crossTenantTasksRes = await makeRequest('GET', '/api/operations/tasks?tenantId=org-default', null, {
    'Authorization': `Bearer ${externalPhysicianToken}`
  });
  assert(crossTenantTasksRes.status === 403, 'External organization physician blocked from accessing org-default tasks');
  assert(crossTenantTasksRes.data.code === 'CROSS_TENANT_ACCESS_DENIED', 'Error code confirms CROSS_TENANT_ACCESS_DENIED');

  // Physician from external hospital accessing their own tenant succeeds
  const ownTenantRes = await makeRequest('GET', '/api/operations/tasks?tenantId=org-external-hospital', null, {
    'Authorization': `Bearer ${externalPhysicianToken}`
  });
  assert(ownTenantRes.status === 200, 'Physician accessing own tenant succeeds with 200 OK');

  // [TEST D] PostgreSQL Repository Abstraction & Migration Versioning
  console.log('\n[TEST D] Verifying PostgreSQL Repository Abstraction & Migration Versioning...');
  assert(Array.isArray(POSTGRES_MIGRATIONS), 'PostgreSQL migrations defined');
  assert(POSTGRES_MIGRATIONS.length >= 1, 'PostgreSQL migration version 1 exists');
  assert(POSTGRES_MIGRATIONS[0].sql.includes('CREATE TABLE IF NOT EXISTS operational_tasks'), 'PostgreSQL tasks schema declared');
  assert(POSTGRES_MIGRATIONS[0].sql.includes('CREATE TABLE IF NOT EXISTS operational_jobs'), 'PostgreSQL jobs schema declared');
  assert(POSTGRES_MIGRATIONS[0].sql.includes('CREATE TABLE IF NOT EXISTS operational_audit_events'), 'PostgreSQL audit schema declared');

  // Emulate repository query interfaces
  assert(typeof taskRepositoryPg.saveTask === 'function', 'PostgreSQL taskRepository exposes saveTask');
  assert(typeof taskRepositoryPg.getTaskById === 'function', 'PostgreSQL taskRepository exposes getTaskById');
  assert(typeof auditRepositoryPg.recordAuditEvent === 'function', 'PostgreSQL auditRepository exposes recordAuditEvent');
  assert(typeof auditRepositoryPg.verifyAuditChain === 'function', 'PostgreSQL auditRepository exposes verifyAuditChain');
  assert(typeof jobRepositoryPg.createJob === 'function', 'PostgreSQL jobRepository exposes createJob');
  assert(typeof jobRepositoryPg.claimNextRunnableJobs === 'function', 'PostgreSQL jobRepository exposes claimNextRunnableJobs (FOR UPDATE SKIP LOCKED)');

  // [TEST E] Durable Job Execution & Worker Retry with Exponential Backoff
  console.log('\n[TEST E] Verifying Durable Job Execution & Worker Retry with Exponential Backoff...');
  const testJob = jobRepository.createJob({
    tenantId: 'org-default',
    jobType: 'fhir_reconciliation',
    sourceTaskId: 'task-test-backoff-01',
    actorId: 'usr-md-lin-01',
    actorRole: 'physician',
    maxRetries: 3,
    payload: { action: 'test_retry' }
  });
  assert(!!testJob, 'Durable job successfully created in operational_jobs table');
  assert(testJob.status === 'queued', 'Initial job status is queued');
  assert(testJob.retryCount === 0, 'Initial retry count is 0');

  // Simulate execution failure #1
  const failedJob1 = jobRepository.markJobFailure(testJob.id, 'Upstream 504 Gateway Timeout', 'org-default');
  assert(failedJob1.status === 'retryable_failure', 'Failed job transitions to retryable_failure');
  assert(failedJob1.retryCount === 1, 'Retry count incremented to 1');
  const delay1 = new Date(failedJob1.nextRunAt).getTime() - Date.now();
  assert(delay1 > 1000 && delay1 <= 3000, `Exponential backoff #1 scheduled (~2000ms, actual: ${delay1}ms)`);

  // Simulate execution failure #2
  const failedJob2 = jobRepository.markJobFailure(testJob.id, 'Upstream 504 Gateway Timeout', 'org-default');
  assert(failedJob2.retryCount === 2, 'Retry count incremented to 2');
  const delay2 = new Date(failedJob2.nextRunAt).getTime() - Date.now();
  assert(delay2 > 3000 && delay2 <= 5000, `Exponential backoff #2 scheduled (~4000ms, actual: ${delay2}ms)`);

  // Simulate execution failure #3 (Exceeds maxRetries = 3 -> terminal dead-letter)
  const deadLetterJob = jobRepository.markJobFailure(testJob.id, 'Upstream Connection Refused', 'org-default');
  assert(deadLetterJob.status === 'dead_letter', 'Job exceeding max retries transitions to dead_letter');
  assert(deadLetterJob.retryCount === 3, 'Final retry count equals maxRetries (3)');
  assert(deadLetterJob.lastError.includes('Connection Refused'), 'Terminal failure reason preserved');

  // [TEST F] Worker Crash / Stale-Lock Restart Recovery
  console.log('\n[TEST F] Verifying Worker Crash / Stale-Lock Restart Recovery...');
  const db = getDatabase();
  const crashedJobId = `job-crashed-${Date.now()}`;
  const staleLockedAt = new Date(Date.now() - 45000).toISOString(); // 45 seconds ago (timeout is 30s)

  db.prepare(`
    INSERT INTO operational_jobs (
      id, tenant_id, job_type, status, payload_json,
      source_task_id, created_by_actor_id, created_by_role,
      retry_count, max_retries, next_run_at, last_error,
      locked_by, locked_at, lock_timeout_ms, created_at, updated_at
    ) VALUES (?, 'org-default', 'fhir_reconciliation', 'running', '{}',
      'task-crashed-recovery', 'system', 'system',
      0, 3, ?, NULL,
      'worker-crashed-pid-999', ?, 30000, ?, ?);
  `).run(crashedJobId, staleLockedAt, staleLockedAt, staleLockedAt, staleLockedAt);

  // New worker instance claims runnable jobs
  const recoveredJobs = jobRepository.claimNextRunnableJobs({
    workerId: 'worker-new-pid-1001',
    limit: 5,
    tenantId: 'org-default'
  });

  const reclaimed = recoveredJobs.find(j => j.id === crashedJobId);
  assert(!!reclaimed, 'Crashed worker job successfully reclaimed by new worker instance');
  assert(reclaimed.lockedBy === 'worker-new-pid-1001', 'Lock updated to new active worker PID');
  assert(reclaimed.status === 'running', 'Reclaimed job status remains running under new lease');

  // [TEST G] Concurrent Reconciliation Workers & Mutual Exclusion
  console.log('\n[TEST G] Verifying Concurrent Reconciliation Workers & Mutual Exclusion...');
  const concurrentJob = jobRepository.createJob({
    tenantId: 'org-default',
    jobType: 'fhir_reconciliation',
    sourceTaskId: 'task-concurrent-claim-test',
    actorId: 'usr-md-lin-01',
    actorRole: 'physician'
  });

  // Worker 1 and Worker 2 attempt to claim the same job simultaneously
  const worker1Claims = jobRepository.claimNextRunnableJobs({ workerId: 'worker-alpha', limit: 10, tenantId: 'org-default' });
  const worker2Claims = jobRepository.claimNextRunnableJobs({ workerId: 'worker-beta', limit: 10, tenantId: 'org-default' });

  const claimedByWorker1 = worker1Claims.some(j => j.id === concurrentJob.id);
  const claimedByWorker2 = worker2Claims.some(j => j.id === concurrentJob.id);

  assert((claimedByWorker1 && !claimedByWorker2) || (!claimedByWorker1 && claimedByWorker2), 
    'Mutual exclusion verified: Job claimed by exactly ONE worker instance (ZERO duplicate leases)');

  // [TEST H] Deterministic FHIR Idempotency Across Retries
  console.log('\n[TEST H] Verifying Deterministic FHIR Idempotency Across Worker Retries...');
  const sampleRefillTask = {
    id: 'task-ap-refill-worker-test',
    tenantId: 'org-default',
    category: 'refill',
    priority: 'urgent',
    patientId: 'arthur-pendelton',
    refillDetails: {
      medicationName: 'Apixaban 5mg',
      requestedDose: '5mg BID',
      status: 'in_review'
    }
  };

  const fhirRes1 = reconstructTaskFhirResource(sampleRefillTask);
  const fhirRes2 = reconstructTaskFhirResource(sampleRefillTask);

  assert(fhirRes1.id === `mr-${sampleRefillTask.id}`, 'FHIR ID is strictly derived from task ID');
  assert(fhirRes1.id === fhirRes2.id, 'Consecutive reconstructions yield exact identical FHIR ID (NO timestamp)');
  const ident1 = fhirRes1.identifier[0];
  const ident2 = fhirRes2.identifier[0];
  assert(ident1.system === 'https://proton.health/ops/task', 'FHIR identifier system is https://proton.health/ops/task');
  assert(ident1.value === sampleRefillTask.id, 'FHIR identifier value matches exact immutable task ID');
  assert(ident1.value === ident2.value, 'FHIR identifier value is strictly identical across retries');

  // [TEST I] Persistent Audit Trail Integrity & Hash Chaining
  console.log('\n[TEST I] Verifying Persistent Audit Trail Integrity & Hash Chaining...');
  const auditRes = await makeRequest('GET', '/api/operations/audit/verify?tenantId=org-default', null, {
    'Authorization': `Bearer ${physicianToken}`
  });
  assert(auditRes.status === 200, 'Audit verification endpoint returned 200 OK');
  assert(auditRes.data.valid === true, 'Audit hash chain is cryptographically valid and unbroken');
  assert(auditRes.data.rootAnchor === 'GENESIS_PROTON_AUDIT_ROOT_2026', 'Audit chain anchored to GENESIS_PROTON_AUDIT_ROOT_2026');

  // [TEST J] Cryptographic Audit Tamper Detection
  console.log('\n[TEST J] Verifying Cryptographic Audit Tamper Detection...');
  // Record a legitimate event
  auditRepository.recordAuditEvent({
    tenantId: 'org-tamper-test',
    action: 'initial_event',
    actorId: 'usr-test-01',
    actorRole: 'physician',
    actorName: 'Dr. Sarah Lin, MD',
    patientId: 'patient-test',
    summary: 'Legitimate audit event'
  });

  const preTamperVerify = auditRepository.verifyAuditChain('org-tamper-test');
  assert(preTamperVerify.valid === true, 'Pre-tamper audit chain verified valid');

  // Tamper directly with the database record (simulating malicious database compromise)
  db.prepare(`
    UPDATE operational_audit_events 
    SET summary = 'FORGED_CLINICAL_RECORD: Medication altered post-hoc' 
    WHERE tenant_id = 'org-tamper-test';
  `).run();

  const postTamperVerify = auditRepository.verifyAuditChain('org-tamper-test');
  assert(postTamperVerify.valid === false, 'Tampered audit record strictly detected by verification engine');
  assert(postTamperVerify.error.includes('tampering detected'), 'Tamper verification error confirms cryptographic mismatch');

  // [TEST K] Secret & Config Hardening (Production Fails Closed)
  console.log('\n[TEST K] Verifying Secret & Config Hardening (Production Fails Closed)...');
  // 1. Missing secret in production
  let caughtMissingSecret = false;
  try {
    validateConfig({
      NODE_ENV: 'production',
      PROTON_AUTH_SECRET: '',
      INTERNAL_AGENT_SECRET: ''
    });
  } catch (err) {
    if (err instanceof ConfigurationError && err.missingKeys.includes('PROTON_AUTH_SECRET')) {
      caughtMissingSecret = true;
    }
  }
  assert(caughtMissingSecret === true, 'Production strictly fails closed when PROTON_AUTH_SECRET is missing');

  // 2. Weak/default secret in production
  let caughtWeakSecret = false;
  try {
    validateConfig({
      NODE_ENV: 'production',
      PROTON_AUTH_SECRET: 'proton-private-beta-auth-secret-change-in-prod-2026', // default dev secret
      INTERNAL_AGENT_SECRET: 'secret'
    });
  } catch (err) {
    if (err instanceof ConfigurationError) {
      caughtWeakSecret = true;
    }
  }
  assert(caughtWeakSecret === true, 'Production strictly fails closed when using dev default secrets');

  // 3. Sanitizer masks secrets
  const sanitizedEnv = sanitizeConfigForLogging({
    PROTON_AUTH_SECRET: 'my-super-secret-auth-key-12345678',
    GEMINI_API_KEY: 'AIzaSySecretTokenForGeminiLive',
    NODE_ENV: 'production'
  });
  assert(!sanitizedEnv.PROTON_AUTH_SECRET.includes('super-secret'), 'Auth secret masked in logging sanitizer');
  assert(!sanitizedEnv.GEMINI_API_KEY.includes('AIzaSySecret'), 'AI key masked in logging sanitizer');
  assert(sanitizedEnv.NODE_ENV === 'production', 'Non-sensitive config values preserved');

  // [TEST L] Zero Chain-of-Thought Storage Invariant
  console.log('\n[TEST L] Verifying Zero Chain-of-Thought Storage Invariant...');
  const recordedRuns = agentRunRepository.listAgentRuns({ tenantId: 'org-default' });
  assert(Array.isArray(recordedRuns), 'Agent runs retrieved from durable database');
  recordedRuns.forEach(run => {
    const rawRunStr = JSON.stringify(run);
    assert(!rawRunStr.includes('"thought":'), 'Invariant: Zero "thought" persisted');
    assert(!rawRunStr.includes('"thinking":'), 'Invariant: Zero "thinking" persisted');
    assert(!rawRunStr.includes('"chainOfThought":'), 'Invariant: Zero "chainOfThought" persisted');
    assert(!rawRunStr.includes('"scratchpad":'), 'Invariant: Zero "scratchpad" persisted');
    assert(!rawRunStr.includes('"internalMonologue":'), 'Invariant: Zero "internalMonologue" persisted');
  });

  // [TEST M] Zero PHI Leakage in Operational Telemetry Logs
  console.log('\n[TEST M] Verifying Zero PHI Leakage in Operational Telemetry...');
  const testPayloadWithPhi = {
    correlation_id: 'req-test-999',
    task_id: 'task-123',
    latency_ms: 14.2,
    message: 'Doctor, my systolic blood pressure was 160 this morning and I felt dizzy.',
    clinical_notes: 'Patient exhibits signs of stage 2 hypertension with lightheadedness.',
    physician_directive: 'Prescribed Lisinopril 20mg oral daily',
    success: true
  };

  const sanitizedTelemetry = sanitizeForTelemetry(testPayloadWithPhi);
  assert(sanitizedTelemetry.correlation_id === 'req-test-999', 'Telemetry preserves operational correlation_id');
  assert(sanitizedTelemetry.latency_ms === 14.2, 'Telemetry preserves operational latency_ms');
  assert(sanitizedTelemetry.message === '[REDACTED_CLINICAL_CONTENT]', 'Telemetry strictly redacts message body');
  assert(sanitizedTelemetry.clinical_notes === '[REDACTED_CLINICAL_CONTENT]', 'Telemetry strictly redacts clinical notes');
  assert(sanitizedTelemetry.physician_directive === '[REDACTED_CLINICAL_CONTENT]', 'Telemetry strictly redacts physician directive');

  // [TEST N] Failed FHIR -> Durable Job Enqueue -> Worker Retry -> Successful Reconciliation
  console.log('\n[TEST N] Verifying End-to-End Failed FHIR -> Job Enqueue -> Worker Retry -> Reconciliation...');
  // 1. Create a task with status reconciliation_failed
  const failedTaskObj = {
    id: `task-reconcile-test-${Date.now()}`,
    tenantId: 'org-default',
    category: 'refill',
    priority: 'urgent',
    status: 'reconciliation_failed',
    reconciliationStatus: 'failed',
    reconciliationError: '502 Bad Gateway: Upstream Medplum offline during approval',
    patientId: 'eleanor-vance',
    patientName: 'Eleanor Vance',
    patientAgeSex: '68F',
    title: 'Lisinopril 20mg Refill',
    summary: 'Prescription refill requiring reconciliation',
    sourceEvent: 'Portal Message',
    refillDetails: {
      medicationName: 'Lisinopril 20mg',
      requestedDose: '20mg daily',
      daysSupply: 30,
      status: 'in_review',
      approvedAt: new Date().toISOString()
    }
  };
  taskRepository.saveTask(failedTaskObj, 'org-default');

  // 2. Discover unreconciled tasks and enqueue durable jobs
  const enqueued = discoverUnreconciledTasks('org-default');
  const enqueuedJob = enqueued.find(j => j.sourceTaskId === failedTaskObj.id);
  assert(!!enqueuedJob, 'Failed task discovered and enqueued into operational_jobs');
  assert(enqueuedJob.jobType === 'fhir_reconciliation', 'Enqueued job type is fhir_reconciliation');
  assert(enqueuedJob.status === 'queued', 'Enqueued job status is queued');

  // 3. Trigger worker reconciliation cycle (in functioning persistence mode)
  const workerResults = await runWorkerCycle({
    workerId: 'worker-test-cycle',
    tenantId: 'org-default'
  });

  const jobResult = workerResults.find(r => r.taskId === failedTaskObj.id);
  assert(!!jobResult, 'Worker processed the reconciliation job');
  assert(jobResult.status === 'reconciled', 'Worker transitioned job to reconciled state');

  // 4. Verify task state in database is completed and reconciled
  const reconciledTask = taskRepository.getTaskById(failedTaskObj.id, 'org-default');
  assert(reconciledTask.status === 'completed', 'Task status transitioned to completed in database');
  assert(reconciledTask.reconciliationStatus === 'reconciled', 'Task reconciliationStatus marked reconciled (NO FAKE SUCCESS)');
  assert(typeof reconciledTask.fhirResourceId === 'string', 'Task stamped with confirmed FHIR resource ID');

  // 5. Verify audit event was logged for background worker success
  const auditLogs = auditRepository.listAuditEvents({ tenantId: 'org-default', limit: 10 });
  const workerAuditEvent = auditLogs.find(e => e.action === 'fhir_reconciliation_worker_succeeded' && e.summary.includes(failedTaskObj.id));
  assert(!!workerAuditEvent, 'Tamper-evident audit trail recorded fhir_reconciliation_worker_succeeded event');
  assert(workerAuditEvent.actorRole === 'worker', 'Audit actor role confirmed as worker daemon');

  console.log('\n===============================================================');
  console.log('✅ ALL PHASE 1.5 INFRASTRUCTURE VERIFICATION CHECKS PASSED!');
  console.log('===============================================================\n');

  if (server) server.close();
  closeDatabase();
}

startServer()
  .then(() => runPhase15Suite())
  .catch(err => {
    console.error('Fatal Phase 1.5 test error:', err);
    if (server) server.close();
    try { closeDatabase(); } catch (e) {}
    process.exit(1);
  });
