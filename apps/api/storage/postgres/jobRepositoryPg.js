/**
 * Proton Healthcare Operations OS — PostgreSQL Job Repository
 * 
 * Provides durable job persistence with 'FOR UPDATE SKIP LOCKED' concurrency controls.
 */

const crypto = require('crypto');
const { getPostgresPool } = require('../postgresDb');

function deserializeJobPg(row) {
  if (!row) return null;
  const payload = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : (row.payload_json || {});
  return {
    id: row.id,
    tenantId: row.tenant_id,
    jobType: row.job_type,
    status: row.status,
    payload,
    sourceTaskId: row.source_task_id || null,
    createdByActorId: row.created_by_actor_id || null,
    createdByRole: row.created_by_role || null,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    nextRunAt: row.next_run_at instanceof Date ? row.next_run_at.toISOString() : row.next_run_at,
    lastError: row.last_error || null,
    lockedBy: row.locked_by || null,
    lockedAt: row.locked_at instanceof Date ? row.locked_at.toISOString() : row.locked_at,
    lockTimeoutMs: row.lock_timeout_ms,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
  };
}

async function createJob({
  id = null,
  tenantId = 'org-default',
  jobType,
  payload = {},
  sourceTaskId = null,
  actorId = 'system-daemon',
  actorRole = 'system',
  maxRetries = 3,
  nextRunAt = null
}, pool = null) {
  const p = pool || getPostgresPool();
  const jobId = id || `job-pg-${jobType.toLowerCase().replace(/_/g, '-')}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payloadJson = JSON.stringify(payload);

  // Idempotency: Check if an active job already exists for the same sourceTask & jobType
  if (sourceTaskId) {
    const { rows: existingRows } = await p.query(`
      SELECT * FROM operational_jobs 
      WHERE tenant_id = $1 AND source_task_id = $2 AND job_type = $3 AND status IN ('queued', 'running', 'retryable_failure')
      ORDER BY created_at DESC LIMIT 1;
    `, [tenantId, sourceTaskId, jobType]);

    if (existingRows.length > 0) {
      return deserializeJobPg(existingRows[0]);
    }
  }

  const query = `
    INSERT INTO operational_jobs (
      id, tenant_id, job_type, status, payload_json,
      source_task_id, created_by_actor_id, created_by_role,
      retry_count, max_retries, next_run_at, last_error,
      locked_by, locked_at, lock_timeout_ms, created_at, updated_at
    ) VALUES (
      $1, $2, $3, 'queued', $4::jsonb,
      $5, $6, $7,
      0, $8, COALESCE($9::timestamptz, NOW()), NULL,
      NULL, NULL, 30000, NOW(), NOW()
    )
    RETURNING *;
  `;

  const values = [
    jobId, tenantId, jobType, payloadJson,
    sourceTaskId, actorId, actorRole,
    maxRetries, nextRunAt
  ];

  const { rows } = await p.query(query, values);
  return deserializeJobPg(rows[0]);
}

async function getJobById(jobId, tenantId = 'org-default', pool = null) {
  const p = pool || getPostgresPool();
  const { rows } = await p.query(
    'SELECT * FROM operational_jobs WHERE id = $1 AND tenant_id = $2;',
    [jobId, tenantId]
  );
  return deserializeJobPg(rows[0]);
}

async function listJobs({ tenantId = 'org-default', status, jobType, sourceTaskId, limit = 50 } = {}, pool = null) {
  const p = pool || getPostgresPool();
  const conditions = ['tenant_id = $1'];
  const params = [tenantId];
  let paramIdx = 2;

  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }
  if (jobType) {
    conditions.push(`job_type = $${paramIdx++}`);
    params.push(jobType);
  }
  if (sourceTaskId) {
    conditions.push(`source_task_id = $${paramIdx++}`);
    params.push(sourceTaskId);
  }

  params.push(limit);
  const query = `
    SELECT * FROM operational_jobs
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $${paramIdx};
  `;

  const { rows } = await p.query(query, params);
  return rows.map(deserializeJobPg);
}

/**
 * Claims runnable jobs atomically using PostgreSQL FOR UPDATE SKIP LOCKED
 */
async function claimNextRunnableJobs({ workerId, limit = 5, tenantId = 'org-default' }, pool = null) {
  const p = pool || getPostgresPool();

  const query = `
    UPDATE operational_jobs SET
      status = 'running',
      locked_by = $1,
      locked_at = NOW(),
      updated_at = NOW()
    WHERE id IN (
      SELECT id FROM operational_jobs
      WHERE tenant_id = $2
        AND (
          (status IN ('queued', 'retryable_failure') AND next_run_at <= NOW())
          OR
          (status = 'running' AND locked_at < NOW() - (lock_timeout_ms || ' milliseconds')::interval)
        )
      ORDER BY next_run_at ASC
      LIMIT $3
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
  `;

  const { rows } = await p.query(query, [workerId, tenantId, limit]);
  return rows.map(deserializeJobPg);
}

async function markJobSucceeded(jobId, tenantId = 'org-default', pool = null) {
  const p = pool || getPostgresPool();
  const { rows } = await p.query(`
    UPDATE operational_jobs SET
      status = 'succeeded',
      locked_by = NULL,
      locked_at = NULL,
      updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    RETURNING *;
  `, [jobId, tenantId]);
  return deserializeJobPg(rows[0]);
}

async function markJobFailure(jobId, error, tenantId = 'org-default', pool = null) {
  const p = pool || getPostgresPool();
  const current = await getJobById(jobId, tenantId, p);
  if (!current) return null;

  const newRetryCount = current.retryCount + 1;

  if (newRetryCount >= current.maxRetries) {
    const { rows } = await p.query(`
      UPDATE operational_jobs SET
        status = 'dead_letter',
        retry_count = $1,
        last_error = $2,
        locked_by = NULL,
        locked_at = NULL,
        updated_at = NOW()
      WHERE id = $3 AND tenant_id = $4
      RETURNING *;
    `, [newRetryCount, error, jobId, tenantId]);
    return deserializeJobPg(rows[0]);
  }

  // Exponential backoff
  const backoffSeconds = Math.min(Math.pow(2, newRetryCount), 60);
  const { rows } = await p.query(`
    UPDATE operational_jobs SET
      status = 'retryable_failure',
      retry_count = $1,
      next_run_at = NOW() + ($2 || ' seconds')::interval,
      last_error = $3,
      locked_by = NULL,
      locked_at = NULL,
      updated_at = NOW()
    WHERE id = $4 AND tenant_id = $5
    RETURNING *;
  `, [newRetryCount, backoffSeconds, error, jobId, tenantId]);

  return deserializeJobPg(rows[0]);
}

module.exports = {
  createJob,
  getJobById,
  listJobs,
  claimNextRunnableJobs,
  markJobSucceeded,
  markJobFailure
};
