/**
 * Proton Healthcare Operations OS — PostgreSQL Durable Database Layer
 * 
 * Provides PostgreSQL connection pooling, migrations, and repository abstractions
 * for multi-node private beta deployments.
 */

const { Pool } = require('pg');
const { WORKFLOW_MIGRATIONS } = require('../db/workflowMigrations');
const { PATIENT_AUTH_MIGRATIONS } = require('../db/patientAuthMigrations');
const { ORGANIZATION_MIGRATIONS } = require('../db/organizationMigrations');

let pgPool = null;

function getPostgresConfig() {
  const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/proton_ops';
  return {
    connectionString,
    max: parseInt(process.env.PG_MAX_POOL_SIZE || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.NODE_ENV === 'production' && !process.env.PG_DISABLE_SSL ? { rejectUnauthorized: true } : false
  };
}

function initPostgresPool(customConfig = null) {
  if (pgPool) return pgPool;
  const config = customConfig || getPostgresConfig();
  pgPool = new Pool(config);
  return pgPool;
}

function getPostgresPool() {
  if (!pgPool) return initPostgresPool();
  return pgPool;
}

async function closePostgresPool() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}

/**
 * Migration SQL definitions for PostgreSQL schema
 */
const POSTGRES_MIGRATIONS = [
  {
    version: 1,
    name: 'initial_operational_schema_pg',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS operational_tasks (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        category TEXT NOT NULL CHECK (category IN ('triage', 'refill', 'scheduling', 'referral')),
        priority TEXT NOT NULL CHECK (priority IN ('emergency', 'urgent', 'routine')),
        status TEXT NOT NULL CHECK (status IN ('requested', 'ready', 'in_review', 'pending_reconciliation', 'completed', 'rejected', 'reconciliation_failed')),
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        patient_age_sex TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        source_event TEXT NOT NULL,
        reconciliation_status TEXT NOT NULL DEFAULT 'none' CHECK (reconciliation_status IN ('none', 'pending', 'reconciled', 'failed')),
        reconciliation_error TEXT,
        fhir_resource_id TEXT,
        fhir_resource_type TEXT,
        task_details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_tenant_pg ON operational_tasks(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status_pg ON operational_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_patient_pg ON operational_tasks(patient_id);

      CREATE TABLE IF NOT EXISTS operational_jobs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        job_type TEXT NOT NULL CHECK (job_type IN ('fhir_reconciliation', 'communication_dispatch', 'agent_execution')),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'retryable_failure', 'dead_letter')),
        payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        source_task_id TEXT,
        created_by_actor_id TEXT,
        created_by_role TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_error TEXT,
        locked_by TEXT,
        locked_at TIMESTAMPTZ,
        lock_timeout_ms INTEGER NOT NULL DEFAULT 30000,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_tenant_pg ON operational_jobs(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_runnable_pg ON operational_jobs(status, next_run_at);

      CREATE TABLE IF NOT EXISTS operational_audit_events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        action TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        target_resource_id TEXT,
        summary TEXT NOT NULL,
        previous_state TEXT,
        resulting_state TEXT,
        physician_directive TEXT,
        prev_hash TEXT NOT NULL,
        current_hash TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_tenant_pg ON operational_audit_events(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_audit_time_pg ON operational_audit_events(timestamp DESC);

      CREATE TABLE IF NOT EXISTS agent_execution_runs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        task_id TEXT NOT NULL REFERENCES operational_tasks(id),
        agent_name TEXT NOT NULL,
        model_provider TEXT NOT NULL,
        model_version TEXT NOT NULL,
        context_provenance_ids TEXT,
        policy_checks JSONB NOT NULL,
        tool_calls JSONB,
        structured_output JSONB,
        status TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        tokens_consumed INTEGER NOT NULL,
        error_code TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_runs_tenant_pg ON agent_execution_runs(tenant_id);

      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        payload_hash TEXT NOT NULL,
        response_status INTEGER NOT NULL,
        response_body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      );
    `
  },
  ...WORKFLOW_MIGRATIONS,
  // Patient identity (OTP accounts, identifiers, sessions) — v30.
  ...PATIENT_AUTH_MIGRATIONS,
  // Multi-tenant organization provisioning and membership — v40.
  ...ORGANIZATION_MIGRATIONS
];

/**
 * Runs PostgreSQL migrations.
 *
 * Each migration runs inside a single transaction on a dedicated client. The
 * previous implementation issued BEGIN/COMMIT through the pool, which could
 * spread a migration across three different connections; a failure mid-way
 * would then leave the schema applied but unrecorded.
 *
 * A session-level advisory lock makes concurrent boots (multiple API replicas)
 * safe: the second process waits, then observes the already-applied version.
 */
async function runPostgresMigrations(pool = null) {
  const p = pool || getPostgresPool();
  const client = await p.connect();

  try {
    await client.query(`SELECT pg_advisory_lock(hashtext('proton_schema_migrations'));`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const { rows } = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC;');
    const applied = new Set(rows.map(r => r.version));

    for (const migration of POSTGRES_MIGRATIONS) {
      if (!applied.has(migration.version)) {
        await client.query('BEGIN');
        try {
          await client.query(migration.sql);
          await client.query(
            'INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, NOW());',
            [migration.version, migration.name]
          );
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw new Error(`Migration v${migration.version} (${migration.name}) failed: ${err.message}`);
        }
      }
    }
  } finally {
    try {
      await client.query(`SELECT pg_advisory_unlock(hashtext('proton_schema_migrations'));`);
    } catch {
      // Connection may already be broken; the lock dies with the session anyway.
    }
    client.release();
  }
}

module.exports = {
  initPostgresPool,
  getPostgresPool,
  getPostgresConfig,
  closePostgresPool,
  runPostgresMigrations,
  POSTGRES_MIGRATIONS
};
