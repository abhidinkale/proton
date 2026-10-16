/**
 * Proton Healthcare Operations OS — Job Repository
 * 
 * Provides durable persistence, locking, retry backoff, and dead-letter state
 * for background operational jobs (FHIR reconciliation, communication retries, etc.).
 */

const crypto = require('crypto');
const { getDatabase } = require('./db');

function serializeJobPayload(payload) {
  return typeof payload === 'string' ? payload : JSON.stringify(payload || {});
}

function deserializeJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    jobType: row.job_type,
    status: row.status,
    payload: JSON.parse(row.payload_json || '{}'),
    sourceTaskId: row.source_task_id || null,
    createdByActorId: row.created_by_actor_id || null,
    createdByRole: row.created_by_role || null,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    nextRunAt: row.next_run_at,
    lastError: row.last_error || null,
    lockedBy: row.locked_by || null,
    lockedAt: row.locked_at || null,
    lockTimeoutMs: row.lock_timeout_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Enqueues a durable background job with idempotency deduplication on active tasks.
 */
function createJob({
  id = null,
  tenantId = 'org-default',
  jobType,
  payload = {},
  sourceTaskId = null,
  actorId = 'system-daemon',
  actorRole = 'system',
  maxRetries = 3,
  nextRunAt = null
}) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const scheduledTime = nextRunAt || now;

  // Idempotency: Check if an active job already exists for the same sourceTask & jobType
  if (sourceTaskId) {
    const existing = db.prepare(`
      SELECT * FROM operational_jobs 
      WHERE tenant_id = ? AND source_task_id = ? AND job_type = ? AND status IN ('queued', 'running', 'retryable_failure')
      ORDER BY created_at DESC LIMIT 1;
    `).get(tenantId, sourceTaskId, jobType);

    if (existing) {
      return deserializeJob(existing);
    }
  }

  const jobId = id || `job-${jobType.toLowerCase().replace(/_/g, '-')}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payloadJson = serializeJobPayload(payload);

  db.prepare(`
    INSERT INTO operational_jobs (
      id, tenant_id, job_type, status, payload_json,
      source_task_id, created_by_actor_id, created_by_role,
      retry_count, max_retries, next_run_at, last_error,
      locked_by, locked_at, lock_timeout_ms, created_at, updated_at
    ) VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, 0, ?, ?, NULL, NULL, NULL, 30000, ?, ?);
  `).run(
    jobId,
    tenantId,
    jobType,
    payloadJson,
    sourceTaskId,
    actorId,
    actorRole,
    maxRetries,
    scheduledTime,
    now,
    now
  );

  return getJobById(jobId, tenantId);
}

function getJobById(jobId, tenantId = 'org-default') {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM operational_jobs WHERE id = ? AND tenant_id = ?;').get(jobId, tenantId);
  return deserializeJob(row);
}

function listJobs({ tenantId = 'org-default', status, jobType, sourceTaskId, limit = 50 }) {
  const db = getDatabase();
  const conditions = ['tenant_id = ?'];
  const params = [tenantId];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (jobType) {
    conditions.push('job_type = ?');
    params.push(jobType);
  }
  if (sourceTaskId) {
    conditions.push('source_task_id = ?');
    params.push(sourceTaskId);
  }

  params.push(limit);
  const sql = `SELECT * FROM operational_jobs WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ?;`;
  const rows = db.prepare(sql).all(...params);
  return rows.map(deserializeJob);
}

/**
 * Claims runnable jobs atomically for a worker, handling exponential backoff and stale lock eviction.
 */
function claimNextRunnableJobs({ workerId, limit = 5, tenantId = 'org-default' }) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const nowMs = Date.now();

  // Find runnable jobs:
  // 1. queued AND next_run_at <= now
  // 2. retryable_failure AND next_run_at <= now
  // 3. running BUT locked_at is older than lock_timeout_ms (crashed worker recovery)
  const candidateRows = db.prepare(`
    SELECT * FROM operational_jobs
    WHERE tenant_id = ?
      AND (
        (status IN ('queued', 'retryable_failure') AND next_run_at <= ?)
        OR
        (status = 'running' AND locked_at IS NOT NULL)
      )
    ORDER BY next_run_at ASC LIMIT ?;
  `).all(tenantId, now, limit * 2);

  const claimedJobs = [];

  for (const row of candidateRows) {
    if (claimedJobs.length >= limit) break;

    // Check stale lock timeout if already running
    if (row.status === 'running') {
      const lockTime = new Date(row.locked_at).getTime();
      const timeout = row.lock_timeout_ms || 30000;
      if (nowMs - lockTime < timeout) {
        // Still actively locked by an active worker
        continue;
      }
      // Stale lock detected! Reclaiming from crashed worker.
    }

    // Atomic lease acquisition
    const result = db.prepare(`
      UPDATE operational_jobs SET
        status = 'running',
        locked_by = ?,
        locked_at = ?,
        updated_at = ?
      WHERE id = ? AND tenant_id = ? AND (status IN ('queued', 'retryable_failure') OR (status = 'running' AND locked_at = ?));
    `).run(workerId, now, now, row.id, tenantId, row.locked_at);

    if (result.changes > 0) {
      claimedJobs.push(getJobById(row.id, tenantId));
    }
  }

  return claimedJobs;
}

/**
 * Marks a job succeeded and releases locks.
 */
function markJobSucceeded(jobId, tenantId = 'org-default') {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE operational_jobs SET
      status = 'succeeded',
      locked_by = NULL,
      locked_at = NULL,
      updated_at = ?
    WHERE id = ? AND tenant_id = ?;
  `).run(now, jobId, tenantId);

  return getJobById(jobId, tenantId);
}

/**
 * Schedules a retry with exponential backoff or transitions to dead-letter.
 */
function markJobFailure(jobId, error, tenantId = 'org-default') {
  const db = getDatabase();
  const current = getJobById(jobId, tenantId);
  if (!current) return null;

  const newRetryCount = current.retryCount + 1;
  const now = new Date().toISOString();

  if (newRetryCount >= current.maxRetries) {
    // Terminal failure -> transition to dead-letter (escalated)
    db.prepare(`
      UPDATE operational_jobs SET
        status = 'dead_letter',
        retry_count = ?,
        last_error = ?,
        locked_by = NULL,
        locked_at = NULL,
        updated_at = ?
      WHERE id = ? AND tenant_id = ?;
    `).run(newRetryCount, error, now, jobId, tenantId);
  } else {
    // Exponential backoff: 1s, 2s, 4s, 8s...
    const backoffMs = Math.min(1000 * Math.pow(2, newRetryCount), 60000);
    const nextRun = new Date(Date.now() + backoffMs).toISOString();

    db.prepare(`
      UPDATE operational_jobs SET
        status = 'retryable_failure',
        retry_count = ?,
        next_run_at = ?,
        last_error = ?,
        locked_by = NULL,
        locked_at = NULL,
        updated_at = ?
      WHERE id = ? AND tenant_id = ?;
    `).run(newRetryCount, nextRun, error, now, jobId, tenantId);
  }

  return getJobById(jobId, tenantId);
}

module.exports = {
  createJob,
  getJobById,
  listJobs,
  claimNextRunnableJobs,
  markJobSucceeded,
  markJobFailure
};
