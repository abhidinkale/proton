/**
 * Proton Healthcare Operations OS — Durable FHIR Reconciliation Worker
 * 
 * ARCHITECTURAL SPECIFICATION:
 * Discovers tasks with status 'reconciliation_failed' or 'pending_reconciliation',
 * leases background jobs with atomic concurrency locks, enforces exponential backoff,
 * maintains deterministic FHIR identifiers (system: https://proton.health/ops/task, value: taskId),
 * and audits all state transitions. Never claims fake success.
 */

const taskRepository = require('../storage/taskRepository');
const jobRepository = require('../storage/jobRepository');
const auditRepository = require('../storage/auditRepository');
const { persistFhirResource } = require('../agents/engine');

/**
 * Builds the deterministic FHIR resource for a given task.
 */
function reconstructTaskFhirResource(task) {
  const now = new Date().toISOString();
  const deterministicId = task.fhirResourceId || `${task.category === 'refill' ? 'mr' : task.category === 'triage' ? 'comm' : task.category === 'referral' ? 'sr' : 'app'}-${task.id}`;

  if (task.category === 'refill' && task.refillDetails) {
    if (task.refillDetails.fhirMedicationRequest) {
      return task.refillDetails.fhirMedicationRequest;
    }
    return {
      resourceType: 'MedicationRequest',
      id: deterministicId,
      identifier: [{ system: 'https://proton.health/ops/task', value: task.id }],
      status: task.refillDetails.status === 'rejected' ? 'cancelled' : 'active',
      intent: 'order',
      medicationCodeableConcept: { text: task.refillDetails.medicationName },
      subject: { reference: `Patient/${task.patientId}` },
      authoredOn: task.refillDetails.approvedAt || now,
      dosageInstruction: [{ text: `${task.refillDetails.requestedDose} ${task.refillDetails.requestedFrequency || ''}` }]
    };
  }

  if (task.category === 'triage' && task.triageDetails) {
    return {
      resourceType: 'Communication',
      id: deterministicId,
      identifier: [{ system: 'https://proton.health/ops/task', value: task.id }],
      status: 'completed',
      subject: { reference: `Patient/${task.patientId}` },
      sent: task.triageDetails.approvedAt || now,
      payload: [{ contentString: task.triageDetails.physicianApprovedResponse || task.triageDetails.aiDraftResponse }]
    };
  }

  if (task.category === 'referral' && task.referralDetails) {
    return {
      resourceType: 'ServiceRequest',
      id: deterministicId,
      identifier: [{ system: 'https://proton.health/ops/task', value: task.id }],
      status: 'active',
      intent: 'order',
      code: { text: task.referralDetails.specialty },
      subject: { reference: `Patient/${task.patientId}` },
      authoredOn: task.referralDetails.signedAt || now
    };
  }

  return {
    resourceType: 'Appointment',
    id: deterministicId,
    identifier: [{ system: 'https://proton.health/ops/task', value: task.id }],
    status: 'booked',
    participant: [{ actor: { reference: `Patient/${task.patientId}` }, status: 'accepted' }]
  };
}

/**
 * Scans tasks to auto-enqueue any failed or pending reconciliations into durable jobs.
 */
function discoverUnreconciledTasks(tenantId = 'org-default') {
  const allTasks = taskRepository.listTasks({ tenantId });
  const unreconciled = allTasks.filter(t => 
    t.status === 'reconciliation_failed' || 
    t.status === 'pending_reconciliation' ||
    t.reconciliationStatus === 'failed' ||
    t.reconciliationStatus === 'pending'
  );

  const enqueuedJobs = [];
  for (const task of unreconciled) {
    const job = jobRepository.createJob({
      tenantId,
      jobType: 'fhir_reconciliation',
      sourceTaskId: task.id,
      actorId: 'system-reconciliation-worker',
      actorRole: 'worker',
      maxRetries: 3,
      payload: { taskId: task.id, patientId: task.patientId, category: task.category }
    });
    enqueuedJobs.push(job);
  }
  return enqueuedJobs;
}

/**
 * Executes a single atomic reconciliation cycle for a worker.
 */
async function runWorkerCycle({ workerId = `worker-${process.pid}`, tenantId = 'org-default', limit = 5 } = {}) {
  // 1. Auto-discover tasks that need reconciliation
  discoverUnreconciledTasks(tenantId);

  // 2. Claim runnable jobs atomically with lock
  const jobs = jobRepository.claimNextRunnableJobs({ workerId, limit, tenantId });
  const results = [];

  for (const job of jobs) {
    const taskId = job.sourceTaskId || job.payload?.taskId;
    const task = taskRepository.getTaskById(taskId, tenantId);

    if (!task) {
      jobRepository.markJobFailure(job.id, `Task ${taskId} not found in tenant ${tenantId}`, tenantId);
      continue;
    }

    // Short circuit if already reconciled
    if (task.status === 'completed' && task.reconciliationStatus === 'reconciled') {
      jobRepository.markJobSucceeded(job.id, tenantId);
      results.push({ jobId: job.id, taskId, status: 'already_reconciled' });
      continue;
    }

    const resourceToPersist = reconstructTaskFhirResource(task);

    try {
      // Execute FHIR persistence with immutable identifier
      const outcome = await persistFhirResource(resourceToPersist);
      
      // Update task to reconciled & completed
      task.reconciliationStatus = 'reconciled';
      task.reconciliationError = null;
      task.status = (task.category === 'refill' && task.refillDetails?.status === 'rejected') ? 'rejected' : 'completed';
      task.fhirResourceId = outcome.persistedResource?.id || resourceToPersist.id;
      task.fhirResourceType = resourceToPersist.resourceType;
      taskRepository.saveTask(task, tenantId);

      // Mark job completed
      jobRepository.markJobSucceeded(job.id, tenantId);

      // Tamper-evident audit event
      auditRepository.recordAuditEvent({
        tenantId,
        action: 'fhir_reconciliation_worker_succeeded',
        actorId: workerId,
        actorRole: 'worker',
        actorName: 'Proton FHIR Reconciliation Daemon',
        patientId: task.patientId,
        targetResourceId: task.fhirResourceId,
        previousState: 'reconciliation_failed',
        resultingState: task.status,
        summary: `FHIR reconciliation successfully completed by background worker for task ${taskId}.`
      });

      results.push({ jobId: job.id, taskId, status: 'reconciled', fhirResourceId: task.fhirResourceId });
    } catch (err) {
      // Handle failure with exponential backoff or dead-letter escalation
      const updatedJob = jobRepository.markJobFailure(job.id, err.message, tenantId);

      if (updatedJob.status === 'dead_letter') {
        task.status = 'reconciliation_failed';
        task.reconciliationStatus = 'failed';
        task.reconciliationError = `TERMINAL_FAILURE_ESCALATED: Max retries exceeded (${updatedJob.maxRetries}). Error: ${err.message}`;
        taskRepository.saveTask(task, tenantId);

        auditRepository.recordAuditEvent({
          tenantId,
          action: 'fhir_reconciliation_terminal_dead_letter',
          actorId: workerId,
          actorRole: 'worker',
          actorName: 'Proton FHIR Reconciliation Daemon',
          patientId: task.patientId,
          targetResourceId: resourceToPersist.id,
          previousState: 'pending_reconciliation',
          resultingState: 'reconciliation_failed',
          summary: `FHIR reconciliation reached dead-letter status after ${updatedJob.retryCount} failed attempts. Error: ${err.message}`
        });

        results.push({ jobId: job.id, taskId, status: 'dead_letter', error: err.message });
      } else {
        auditRepository.recordAuditEvent({
          tenantId,
          action: 'fhir_reconciliation_retry_scheduled',
          actorId: workerId,
          actorRole: 'worker',
          actorName: 'Proton FHIR Reconciliation Daemon',
          patientId: task.patientId,
          targetResourceId: resourceToPersist.id,
          summary: `FHIR write failed. Scheduled retry #${updatedJob.retryCount} for ${updatedJob.nextRunAt}. Error: ${err.message}`
        });

        results.push({ jobId: job.id, taskId, status: 'retryable_failure', retryCount: updatedJob.retryCount, nextRunAt: updatedJob.nextRunAt });
      }
    }
  }

  return results;
}

let workerIntervalHandle = null;

function startReconciliationWorker({ intervalMs = 5000, tenantId = 'org-default' } = {}) {
  if (workerIntervalHandle) return;
  workerIntervalHandle = setInterval(async () => {
    try {
      await runWorkerCycle({ tenantId });
    } catch (e) {
      console.error('[ReconciliationWorker] Cycle error:', e);
    }
  }, intervalMs);
}

function stopReconciliationWorker() {
  if (workerIntervalHandle) {
    clearInterval(workerIntervalHandle);
    workerIntervalHandle = null;
  }
}

module.exports = {
  discoverUnreconciledTasks,
  runWorkerCycle,
  startReconciliationWorker,
  stopReconciliationWorker,
  reconstructTaskFhirResource
};
