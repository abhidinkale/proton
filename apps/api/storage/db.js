/**
 * Proton Healthcare Operations OS — Durable Database Layer
 * 
 * Powered by Node.js built-in DatabaseSync (Node 24 node:sqlite).
 * Operates in WAL mode with migration tracking and repository abstraction,
 * ready for drop-in transition to PostgreSQL in distributed production environments.
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

let dbInstance = null;

function getDbPath() {
  if (process.env.PROTON_DB_PATH) {
    return process.env.PROTON_DB_PATH;
  }
  const dataDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'proton_ops.db');
}

function initDatabase(customPath = null) {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = customPath || getDbPath();
  const isMemory = dbPath === ':memory:';

  dbInstance = new DatabaseSync(dbPath);

  // Configure SQLite WAL mode & pragmas for local synthetic prototype
  if (!isMemory) {
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  }
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA busy_timeout = 5000;');

  runMigrations(dbInstance);

  return dbInstance;
}

function getDatabase() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

function closeDatabase() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {
      // Ignore if already closed
    }
    dbInstance = null;
  }
}

/**
 * Migration Runner with Schema Version Tracking
 */
function runMigrations(db) {
  // Ensure migration tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC;').all();
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  const migrations = [
    {
      version: 1,
      name: 'initial_operational_schema',
      sql: `
        -- 1. Operational Tasks
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
          task_details_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON operational_tasks(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON operational_tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_patient ON operational_tasks(patient_id);

        -- 2. Outbound Communications & Delivery State Machine
        CREATE TABLE IF NOT EXISTS outbound_communications (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'org-default',
          task_id TEXT NOT NULL REFERENCES operational_tasks(id),
          patient_id TEXT NOT NULL,
          channel TEXT NOT NULL CHECK (channel IN ('portal', 'sms', 'email')),
          category TEXT NOT NULL CHECK (category IN ('clinical', 'administrative')),
          message_body TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('draft', 'queued', 'sending', 'delivered', 'failed', 'escalated')),
          delivery_attempts INTEGER NOT NULL DEFAULT 0,
          approved_by TEXT,
          approved_at TEXT,
          gateway_ref TEXT,
          error_message TEXT,
          dispatched_at TEXT,
          delivered_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_comm_tenant ON outbound_communications(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_comm_task ON outbound_communications(task_id);

        -- 3. Agent Execution Runs (Strict Zero Chain-of-Thought Storage)
        CREATE TABLE IF NOT EXISTS agent_execution_runs (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'org-default',
          task_id TEXT NOT NULL REFERENCES operational_tasks(id),
          agent_name TEXT NOT NULL,
          model_provider TEXT NOT NULL,
          model_version TEXT NOT NULL,
          context_provenance_ids TEXT,
          policy_checks TEXT NOT NULL,
          tool_calls TEXT,
          structured_output TEXT,
          status TEXT NOT NULL,
          latency_ms INTEGER NOT NULL,
          tokens_consumed INTEGER NOT NULL,
          error_code TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_runs_tenant ON agent_execution_runs(tenant_id);

        -- 4. Appointments & Recalls Workflow
        CREATE TABLE IF NOT EXISTS appointments_workflow (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'org-default',
          task_id TEXT NOT NULL REFERENCES operational_tasks(id),
          patient_id TEXT NOT NULL,
          trigger_type TEXT NOT NULL,
          target_timeframe TEXT NOT NULL,
          proposed_slot_start TEXT,
          proposed_slot_end TEXT,
          practitioner_name TEXT,
          status TEXT NOT NULL CHECK (status IN ('proposed', 'held', 'confirmed', 'booked', 'cancelled')),
          hold_expires_at TEXT,
          confirmed_by TEXT,
          confirmed_at TEXT,
          fhir_appointment_id TEXT,
          calendar_sync_mode TEXT NOT NULL DEFAULT 'simulated_provider_calendar',
          created_at TEXT NOT NULL
        );

        -- 5. Refill Requests Table
        CREATE TABLE IF NOT EXISTS refill_requests (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'org-default',
          task_id TEXT NOT NULL REFERENCES operational_tasks(id),
          patient_id TEXT NOT NULL,
          medication_name TEXT NOT NULL,
          requested_dose TEXT NOT NULL,
          days_supply INTEGER NOT NULL,
          latest_egfr REAL,
          baseline_egfr REAL,
          renal_drift_flag INTEGER NOT NULL DEFAULT 0,
          physician_decision TEXT,
          physician_directive TEXT,
          approved_by TEXT,
          approved_at TEXT,
          fhir_medication_request_id TEXT,
          created_at TEXT NOT NULL
        );

        -- 6. SHA-256 Idempotency Cache
        CREATE TABLE IF NOT EXISTS idempotency_keys (
          key TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'org-default',
          payload_hash TEXT NOT NULL,
          response_status INTEGER NOT NULL,
          response_body TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );

        -- 7. Tamper-Evident Append-Only Audit Trail (Hash Chained)
        CREATE TABLE IF NOT EXISTS operational_audit_events (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'org-default',
          timestamp TEXT NOT NULL,
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
        CREATE INDEX IF NOT EXISTS idx_audit_tenant ON operational_audit_events(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_audit_time ON operational_audit_events(timestamp DESC);
      `
    },
    {
      version: 2,
      name: 'operational_jobs_and_reconciliation_queue',
      sql: `
        -- 8. Durable Background Execution Jobs & Reconciliation Queue
        CREATE TABLE IF NOT EXISTS operational_jobs (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'org-default',
          job_type TEXT NOT NULL CHECK (job_type IN ('fhir_reconciliation', 'communication_dispatch', 'agent_execution')),
          status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'retryable_failure', 'dead_letter')),
          payload_json TEXT NOT NULL,
          source_task_id TEXT,
          created_by_actor_id TEXT,
          created_by_role TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          max_retries INTEGER NOT NULL DEFAULT 3,
          next_run_at TEXT NOT NULL,
          last_error TEXT,
          locked_by TEXT,
          locked_at TEXT,
          lock_timeout_ms INTEGER NOT NULL DEFAULT 30000,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON operational_jobs(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_jobs_runnable ON operational_jobs(status, next_run_at);
        CREATE INDEX IF NOT EXISTS idx_jobs_source_task ON operational_jobs(source_task_id);
      `
    },
    {
      version: 3,
      name: 'secure_capture_sessions',
      sql: `
        -- 9. Secure Cross-Device Capture Sessions
        CREATE TABLE IF NOT EXISTS capture_sessions (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'org-default',
          actor_id TEXT NOT NULL,
          actor_role TEXT NOT NULL,
          actor_name TEXT NOT NULL,
          patient_id TEXT NOT NULL,
          encounter_id TEXT,
          status TEXT NOT NULL CHECK (status IN ('CREATED', 'PAIRING', 'PAIRED', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'REVOKED')),
          pairing_token_hash TEXT NOT NULL,
          pairing_token_consumed INTEGER NOT NULL DEFAULT 0,
          mobile_token_hash TEXT,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          paired_at TEXT,
          completed_at TEXT,
          cancelled_at TEXT,
          revoked_at TEXT,
          metadata_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_capture_tenant ON capture_sessions(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_capture_patient ON capture_sessions(patient_id);
        CREATE INDEX IF NOT EXISTS idx_capture_token_hash ON capture_sessions(pairing_token_hash);
        CREATE INDEX IF NOT EXISTS idx_capture_status ON capture_sessions(status);
      `
    },
    {
      version: 4,
      name: 'secure_capture_media_and_upload_capabilities',
      sql: `
        -- 10. Capture Upload Capabilities
        CREATE TABLE IF NOT EXISTS capture_upload_capabilities (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'org-default',
          session_id TEXT NOT NULL REFERENCES capture_sessions(id),
          token_hash TEXT NOT NULL,
          consumed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_upload_cap_session ON capture_upload_capabilities(session_id);
        CREATE INDEX IF NOT EXISTS idx_upload_cap_hash ON capture_upload_capabilities(token_hash);

        -- 11. Capture Media Registry
        CREATE TABLE IF NOT EXISTS capture_media (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'org-default',
          session_id TEXT NOT NULL REFERENCES capture_sessions(id),
          patient_id TEXT NOT NULL,
          encounter_id TEXT,
          storage_key TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          sha256 TEXT NOT NULL,
          width INTEGER,
          height INTEGER,
          fhir_media_id TEXT,
          fhir_provenance_id TEXT,
          captured_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_media_session ON capture_media(session_id);
        CREATE INDEX IF NOT EXISTS idx_media_patient ON capture_media(patient_id);
        CREATE INDEX IF NOT EXISTS idx_media_tenant ON capture_media(tenant_id);
      `
    },
    {
      version: 5,
      name: 'clinical_vision_analyses',
      sql: `
        -- 12. Clinical Vision Analyses Registry
        CREATE TABLE IF NOT EXISTS vision_analyses (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'org-default',
          media_id TEXT NOT NULL,
          session_id TEXT,
          patient_id TEXT NOT NULL,
          encounter_id TEXT,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REJECTED')),
          confidence REAL,
          findings_json TEXT NOT NULL,
          fhir_observation_id TEXT,
          fhir_provenance_id TEXT,
          created_at TEXT NOT NULL,
          completed_at TEXT,
          error_code TEXT,
          error_message TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_vision_tenant ON vision_analyses(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_vision_media ON vision_analyses(media_id);
        CREATE INDEX IF NOT EXISTS idx_vision_patient ON vision_analyses(patient_id);
      `
    }
  ];

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      db.exec(migration.sql);
      const stmt = db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);');
      stmt.run(migration.version, migration.name, new Date().toISOString());
    }
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  getDbPath
};
