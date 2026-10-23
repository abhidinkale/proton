/**
 * Proton Workflow Schema — PostgreSQL migrations (v2+)
 *
 * Design notes
 * ------------
 * 1. Postgres is the system of record for *workflow state* (this schema).
 *    Medplum / FHIR remains the system of record for *clinical resources*;
 *    each row here stores the FHIR id it corresponds to (e.g. fhir_encounter_id)
 *    rather than duplicating the clinical document.
 * 2. `encounters.state` + `encounters.version` are the authoritative state.
 *    `encounter_events` is append-only and records every transition, so the
 *    current state can always be rebuilt from the event log.
 * 3. `workflow_audit_events` is a dedicated SHA-256 hash chain ordered by a
 *    BIGSERIAL sequence. It is deliberately separate from
 *    `operational_audit_events` because that table orders by an ISO timestamp
 *    string, which can collide within a millisecond and silently break a chain
 *    under concurrent load. A sequence-ordered chain cannot.
 * 4. `outbox` implements the transactional outbox pattern: the row is written
 *    in the same transaction as the state change, then delivered by a worker.
 *    This is why a follow-up survives a process restart.
 */

const WORKFLOW_MIGRATIONS = [
  {
    version: 2,
    name: 'workflow_persistence_and_encounter_state_machine',
    sql: `
      -- ---------------------------------------------------------------------
      -- Patients (workflow projection; clinical truth lives in FHIR)
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        fhir_patient_id TEXT,
        mrn TEXT,
        full_name TEXT NOT NULL,
        date_of_birth DATE,
        sex TEXT,
        contact JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, mrn)
      );
      CREATE INDEX IF NOT EXISTS idx_patients_tenant ON patients(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_patients_fhir ON patients(fhir_patient_id);

      -- ---------------------------------------------------------------------
      -- Appointments
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
        clinician_id TEXT NOT NULL,
        scheduled_for TIMESTAMPTZ NOT NULL,
        duration_minutes INTEGER NOT NULL DEFAULT 20 CHECK (duration_minutes > 0),
        status TEXT NOT NULL DEFAULT 'BOOKED'
          CHECK (status IN ('BOOKED', 'CANCELLED', 'COMPLETED', 'NO_SHOW')),
        reason TEXT,
        fhir_appointment_id TEXT,
        idempotency_key TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_appointments_tenant_time
        ON appointments(tenant_id, scheduled_for);
      CREATE INDEX IF NOT EXISTS idx_appointments_patient
        ON appointments(patient_id, scheduled_for DESC);

      -- ---------------------------------------------------------------------
      -- Encounters (the state machine)
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS encounters (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
        appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
        clinician_id TEXT NOT NULL,
        state TEXT NOT NULL
          CHECK (state IN (
            'BOOKED', 'CHECKED_IN', 'INTAKE', 'READY', 'CAPTURING', 'DRAFTED',
            'PENDING_REVIEW', 'SIGNED', 'REPORTED', 'FOLLOW_UP_DUE', 'CLOSED',
            'ESCALATED', 'CANCELLED'
          )),
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        -- State to return to when an ESCALATED encounter is resumed.
        escalated_from TEXT,
        escalation_reason TEXT,
        cancellation_reason TEXT,
        fhir_encounter_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_encounters_tenant_state
        ON encounters(tenant_id, state);
      CREATE INDEX IF NOT EXISTS idx_encounters_patient
        ON encounters(patient_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_encounters_clinician
        ON encounters(clinician_id, created_at DESC);

      -- Append-only transition log. Replaying this rebuilds encounters.state.
      CREATE TABLE IF NOT EXISTS encounter_events (
        id BIGSERIAL PRIMARY KEY,
        encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE RESTRICT,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        sequence INTEGER NOT NULL CHECK (sequence > 0),
        action TEXT NOT NULL,
        from_state TEXT,
        to_state TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        actor_name TEXT,
        reason TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (encounter_id, sequence)
      );
      CREATE INDEX IF NOT EXISTS idx_encounter_events_encounter
        ON encounter_events(encounter_id, sequence);

      -- ---------------------------------------------------------------------
      -- Clinical artifacts produced during an encounter
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        author_actor_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT'
          CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'SIGNED', 'AMENDED')),
        content JSONB NOT NULL DEFAULT '{}'::jsonb,
        -- Provenance: which model/provider produced the draft, and which
        -- transcript/evidence ids grounded it.
        provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
        signed_by TEXT,
        signed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notes_encounter ON notes(encounter_id);

      CREATE TABLE IF NOT EXISTS diagnoses (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        code_system TEXT,
        code TEXT,
        display TEXT NOT NULL,
        certainty TEXT NOT NULL DEFAULT 'PROPOSED'
          CHECK (certainty IN ('PROPOSED', 'CONFIRMED', 'RULED_OUT')),
        -- Every diagnosis must carry either cited evidence or an explicit
        -- NO_EVIDENCE marker. Enforced in the service layer.
        evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_diagnoses_encounter ON diagnoses(encounter_id);

      CREATE TABLE IF NOT EXISTS prescriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        medication_name TEXT NOT NULL,
        rxnorm_code TEXT,
        dose TEXT NOT NULL,
        route TEXT NOT NULL,
        frequency TEXT NOT NULL,
        duration_days INTEGER,
        status TEXT NOT NULL DEFAULT 'PROPOSED'
          CHECK (status IN ('PROPOSED', 'SIGNED', 'CANCELLED')),
        safety_status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (safety_status IN ('PENDING', 'CLEAR', 'WARNING', 'BLOCKED')),
        safety_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
        signed_by TEXT,
        signed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_prescriptions_encounter ON prescriptions(encounter_id);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant_status
        ON prescriptions(tenant_id, status);

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        kind TEXT NOT NULL
          CHECK (kind IN ('VISIT_SUMMARY', 'AFTER_VISIT', 'DISCHARGE', 'LAB_RESULT')),
        status TEXT NOT NULL DEFAULT 'DRAFT'
          CHECK (status IN ('DRAFT', 'FINAL', 'DELIVERED')),
        content JSONB NOT NULL DEFAULT '{}'::jsonb,
        delivered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_reports_encounter ON reports(encounter_id);

      -- ---------------------------------------------------------------------
      -- Transactional outbox
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        encounter_id TEXT REFERENCES encounters(id) ON DELETE CASCADE,
        patient_id TEXT,
        channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS')),
        recipient TEXT,
        template TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        -- PENDING -> DISPATCHED | FAILED; FAILED retries with backoff; DEAD after max attempts.
        status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING', 'DISPATCHED', 'FAILED', 'DEAD')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_error TEXT,
        -- True when no real provider was configured and the message was only
        -- recorded. The UI must render this as simulated, not delivered.
        simulated BOOLEAN NOT NULL DEFAULT TRUE,
        dedupe_key TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        dispatched_at TIMESTAMPTZ,
        UNIQUE (tenant_id, dedupe_key)
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_due
        ON outbox(status, next_attempt_at);

      -- Patient-visible messages (the IN_APP channel writes here).
      CREATE TABLE IF NOT EXISTS patient_messages (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        patient_id TEXT NOT NULL,
        encounter_id TEXT,
        body TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_patient_messages_patient
        ON patient_messages(tenant_id, patient_id, created_at DESC);

      -- ---------------------------------------------------------------------
      -- Dedicated, sequence-ordered audit chain for workflow transitions
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS workflow_audit_events (
        seq BIGSERIAL PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        encounter_id TEXT,
        action TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        from_state TEXT,
        to_state TEXT,
        summary TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        prev_hash TEXT NOT NULL,
        current_hash TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_audit_tenant
        ON workflow_audit_events(tenant_id, seq);

      -- ---------------------------------------------------------------------
      -- Idempotency for mutating workflow endpoints
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS workflow_idempotency (
        tenant_id TEXT NOT NULL,
        key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        response_status INTEGER NOT NULL,
        response_body JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (tenant_id, key)
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_idempotency_expiry
        ON workflow_idempotency(expires_at);
    `
  }
];

module.exports = { WORKFLOW_MIGRATIONS };
