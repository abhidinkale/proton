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

const fs = require('node:fs');
const path = require('node:path');

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
  },
  {
    version: 5,
    name: 'appointment_patient_local_id',
    sql: `
      -- The app books on the device first, so it needs to recognise its own
      -- appointment when the clinic sends it back. Without this the pull would
      -- add a second, duplicate appointment under the server id.
      ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS patient_local_id TEXT;

      CREATE INDEX IF NOT EXISTS idx_appointments_patient_local
        ON appointments(tenant_id, patient_local_id);
    `
  },
  {
    version: 6,
    name: 'clinic_live_loop',
    sql: `
      -- Reception confirming an appointment is a fact about the booking, not a
      -- new status: BOOKED/CANCELLED/COMPLETED/NO_SHOW still describe the visit
      -- itself. Storing the confirmation separately means a reschedule can
      -- clear it without inventing a state the state machine does not know.
      ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

      -- A patient message stays in "needs attention" until a clinician closes
      -- it. Metadata alone would make that a JSON scan on every poll.
      ALTER TABLE patient_messages
        ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS idx_patient_messages_open
        ON patient_messages(tenant_id, resolved_at, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_patient_messages_encounter
        ON patient_messages(tenant_id, encounter_id);
    `
  },
  {
    version: 7,
    name: 'patient_documents',
    sql: `
      -- ---------------------------------------------------------------------
      -- Documents the patient uploads from the phone
      --
      -- The bytes live on the object store, not in Postgres; this row is the
      -- index. That keeps a 10 MB scan out of every dump of the workflow
      -- database while still making the document a first-class, queryable
      -- clinical record.
      --
      -- The content hash is stored so the same file uploaded twice can be
      -- recognised, and so a clinician can confirm the artefact they opened is
      -- the artefact the patient sent.
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS patient_documents (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'org-default',
        patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'OTHER'
          CHECK (category IN (
            'LAB_REPORT', 'PRESCRIPTION', 'DISCHARGE_SUMMARY',
            'IMAGING_REPORT', 'REFERRAL', 'INSURANCE', 'OTHER'
          )),
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        byte_size INTEGER NOT NULL CHECK (byte_size > 0),
        sha256 TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        -- Who put it here. A clinician-authored scan and a patient's own upload
        -- carry different trust, and the UI must be able to say which it is.
        source TEXT NOT NULL DEFAULT 'PATIENT_APP'
          CHECK (source IN ('PATIENT_APP', 'CLINIC', 'FHIR_IMPORT')),
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- Soft delete: a patient can retract a document from their timeline,
        -- but the clinic's audit trail still knows it existed.
        deleted_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_patient_documents_patient
        ON patient_documents(tenant_id, patient_id, uploaded_at DESC);

      CREATE INDEX IF NOT EXISTS idx_patient_documents_live
        ON patient_documents(tenant_id, patient_id)
        WHERE deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_patient_documents_hash
        ON patient_documents(tenant_id, sha256);
    `
  },
  {
    version: 8,
    name: 'prescription_authorship',
    sql: `
      -- A prescription the patient can see must say who signed it and why.
      -- signed_by is an actor id, which is not a name a patient can read, and
      -- the reason a drug was started belongs on the prescription rather than
      -- buried in an encounter event.
      ALTER TABLE prescriptions
        ADD COLUMN IF NOT EXISTS signed_by_name TEXT;

      ALTER TABLE prescriptions
        ADD COLUMN IF NOT EXISTS reason TEXT;

      -- The phone pulls "my signed prescriptions" on every sync; without this
      -- the join from encounters to prescriptions is a scan.
      CREATE INDEX IF NOT EXISTS idx_prescriptions_signed
        ON prescriptions(tenant_id, status, signed_at DESC);
    `
  },
  {
    version: 9,
    name: 'clinic_desk_fields',
    sql: `
      -- P0.1a staging: fields the SQLite clinic desk carries in data_json but
      -- the workflow schema does not. They are added before the backfill so a
      -- row can be written without losing the clinical profile or the queue
      -- position. Nothing reads them until postgresClinicRepository lands.
      ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS clinical_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

      ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS queue_category TEXT;

      ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';

      ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

      ALTER TABLE notes
        ADD COLUMN IF NOT EXISTS title TEXT;

      ALTER TABLE notes
        ADD COLUMN IF NOT EXISTS legacy_signed_at TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS idx_appointments_queue
        ON appointments(tenant_id, queue_category, scheduled_for);
    `
  },
  {
    // P0.2 — the attestation ledger. The row carries the exact canonical bytes
    // that were signed, so verification never depends on the note's current
    // state or on which store the note lives in. `seq` is per tenant; the
    // writer serializes with an advisory lock (see services/workflow/attestationStore.js).
    version: 10,
    name: 'clinical_attestations',
    sql: `
      CREATE TABLE IF NOT EXISTS clinical_attestations (
        id                  TEXT PRIMARY KEY,
        tenant_id           TEXT NOT NULL,
        seq                 BIGINT NOT NULL CHECK (seq > 0),
        encounter_id        TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
        patient_id          TEXT NOT NULL,
        note_id             TEXT NOT NULL,
        -- The signed bytes, verbatim. TEXT, never JSONB: JSONB reorders keys
        -- and normalizes numbers, so a dump/restore would change the hash.
        content_canonical   TEXT NOT NULL,
        content_hash        TEXT NOT NULL,
        prev_hash           TEXT,
        chain_hash          TEXT NOT NULL,
        attested_at         TIMESTAMPTZ NOT NULL,
        actor_id            TEXT NOT NULL,
        actor_name          TEXT NOT NULL,
        actor_role          TEXT NOT NULL,
        actor_npi           TEXT,
        decision            TEXT NOT NULL DEFAULT 'SIGNED'
                              CHECK (decision IN ('SIGNED', 'AMENDED', 'REFUSED')),
        kernel_version      TEXT,
        kernel_verdict_hash TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, seq)
      );
      CREATE INDEX IF NOT EXISTS idx_attestations_encounter
        ON clinical_attestations(tenant_id, encounter_id, seq);
    `
  },
  {
    // P1.1/P1.5 — outcomes, the cohort denominator, and the link edges.
    // Read from the moat artifact so the reviewed SQL and the runtime schema
    // cannot drift apart.
    version: 11,
    name: 'clinical_links_and_outcomes',
    sql: fs.readFileSync(path.join(__dirname, 'moat', 'clinical-links.sql'), 'utf8')
  }
];

module.exports = { WORKFLOW_MIGRATIONS };
