-- ===========================================================================
-- Proton clinical link layer — proposed migration (P1.1)
--
-- The graph is not a second copy of the clinical record. It is a set of typed
-- edges over the records that already exist, plus a snapshot for fast diffs.
-- A node is a (type, id) reference; the payload is a projection, not storage.
--
-- Six node types are supported:
--   encounter | note | diagnosis | prescription | document | outcome
--
-- The first five exist today. `outcomes` is the one new table this migration
-- introduces; it is the P1.5 dependency and the table the third query needs.
--
-- No foreign keys on clinical_links.from_id/to_id: the target is polymorphic.
-- Integrity is enforced by the writer (services/clinical/clinicalLinks.js,
-- to be added with the writer) and by the orphan check at the bottom of
-- clinical-links.queries.sql. A nightly job must run it.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Outcomes (P1.5). Append-only: a label is never rewritten. A correction is a
-- new row with supersedes_id, under a new label_version if the rule changed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outcomes (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  patient_id           TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id         TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  condition_code       TEXT NOT NULL,
  condition_code_system TEXT,
  assessed_at          TIMESTAMPTZ NOT NULL,
  window_days          INTEGER NOT NULL CHECK (window_days IN (2, 3, 7, 30)),
  follow_up_wave       TEXT NOT NULL CHECK (follow_up_wave IN ('48h', '72h', '7d', '30d')),
  patient_reported     TEXT CHECK (patient_reported IN ('better', 'same', 'worse', 'unknown')),
  label                TEXT NOT NULL CHECK (label IN ('resolved', 'improved', 'unchanged', 'worsened', 'unknown')),
  label_version        TEXT NOT NULL CHECK (label_version = 'label_v1'),
  window_complete      BOOLEAN NOT NULL DEFAULT FALSE,
  non_response_reason  TEXT CHECK (non_response_reason IN (
                         'no_contact', 'declined', 'wrong_number', 'app_uninstalled',
                         'window_not_elapsed', 'insufficient_data'
                       )),
  source               TEXT NOT NULL CHECK (source IN ('patient_app', 'clinician', 'import')),
  supersedes_id        TEXT REFERENCES outcomes(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A resolved label requires an elapsed 30-day window. Nothing else does.
  CHECK (label <> 'resolved' OR window_complete),
  -- `unknown` always has a documented reason; a known label never does.
  CHECK ((label = 'unknown') = (non_response_reason IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_outcomes_patient
  ON outcomes(tenant_id, patient_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_encounter
  ON outcomes(tenant_id, encounter_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_condition
  ON outcomes(tenant_id, condition_code, assessed_at DESC);

-- The denominator. A row is created when follow-up is scheduled, not when a
-- response arrives. Without this, "X% of encounters have an outcome" is
-- computed over responders only and quietly excludes everyone who ignored the
-- app. `status` is the operational truth; `outcomes` is the clinical label.
CREATE TABLE IF NOT EXISTS outcome_cohort (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  patient_id           TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id         TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  condition_code       TEXT NOT NULL,
  condition_code_system TEXT,
  scheduled_at         TIMESTAMPTZ NOT NULL,
  window_days          INTEGER NOT NULL DEFAULT 30 CHECK (window_days IN (2, 3, 7, 30)),
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'responded', 'closed')),
  closed_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, encounter_id, condition_code, window_days)
);

CREATE INDEX IF NOT EXISTS idx_outcome_cohort_due
  ON outcome_cohort(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_outcome_cohort_patient
  ON outcome_cohort(tenant_id, patient_id, scheduled_at DESC);

-- ---------------------------------------------------------------------------
-- Edges
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinical_links (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  from_type   TEXT NOT NULL CHECK (from_type IN
                ('encounter', 'note', 'diagnosis', 'prescription', 'document', 'outcome')),
  from_id     TEXT NOT NULL,
  to_type     TEXT NOT NULL CHECK (to_type IN
                ('encounter', 'note', 'diagnosis', 'prescription', 'document', 'outcome')),
  to_id       TEXT NOT NULL,
  relation    TEXT NOT NULL CHECK (relation IN (
                'RECURRENCE_OF', 'TREATED_WITH', 'RESOLVED_BY', 'CAUSED_BY', 'CONTRAINDICATES'
              )),
  status      TEXT NOT NULL CHECK (status IN ('authored', 'confirmed', 'hypothesized')),
  confidence  NUMERIC(4, 3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  evidence    JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason      TEXT,
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_from  TIMESTAMPTZ,
  valid_to    TIMESTAMPTZ,
  CHECK (from_type <> to_type OR from_id <> to_id),
  -- A causal claim is never inferred. It is authored or confirmed by a
  -- physician, with a substantive reason, and displayed as "physician-
  -- attributed cause" — never as an established cause.
  CHECK (relation <> 'CAUSED_BY' OR status IN ('authored', 'confirmed')),
  CHECK (relation <> 'CAUSED_BY' OR (reason IS NOT NULL AND length(btrim(reason)) >= 10)),
  -- A hypothesized edge must carry the confidence that made it a hypothesis.
  CHECK (status <> 'hypothesized' OR confidence IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_clinical_links_patient
  ON clinical_links(tenant_id, patient_id, relation, valid_from DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_links_from
  ON clinical_links(tenant_id, from_type, from_id);
CREATE INDEX IF NOT EXISTS idx_clinical_links_to
  ON clinical_links(tenant_id, to_type, to_id);

-- ---------------------------------------------------------------------------
-- Snapshot: derived, never authored. Rebuilt on encounter close. If it
-- disagrees with the links, the links win.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_state_snapshots (
  tenant_id    TEXT NOT NULL,
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  snapshot_at  TIMESTAMPTZ NOT NULL,
  encounter_id TEXT REFERENCES encounters(id) ON DELETE SET NULL,
  state        JSONB NOT NULL,
  state_hash   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, patient_id, snapshot_at)
);

CREATE INDEX IF NOT EXISTS idx_patient_state_snapshots_encounter
  ON patient_state_snapshots(tenant_id, encounter_id);

-- ---------------------------------------------------------------------------
-- Node projection. This is the read model the link writer and the three
-- queries use. It contains no clinical narrative: only identity and the
-- fields a traversal needs. The source row remains the truth.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS clinical_nodes_v1;

CREATE VIEW clinical_nodes_v1 AS
SELECT
  e.tenant_id,
  e.patient_id,
  'encounter'::text AS node_type,
  e.id AS node_id,
  e.created_at AS occurred_at,
  jsonb_build_object(
    'encounter_id', e.id,
    'state', e.state,
    'clinician_id', e.clinician_id,
    'appointment_id', e.appointment_id,
    'fhir_encounter_id', e.fhir_encounter_id
  ) AS payload
FROM encounters e

UNION ALL
SELECT
  e.tenant_id,
  e.patient_id,
  'note'::text,
  n.id,
  COALESCE(n.signed_at, n.created_at),
  jsonb_build_object(
    'note_id', n.id,
    'encounter_id', n.encounter_id,
    'status', n.status,
    'schema_version', n.content->>'schema_version',
    'signed_by', n.signed_by,
    'signed_at', n.signed_at
  )
FROM notes n
JOIN encounters e ON e.id = n.encounter_id

UNION ALL
SELECT
  e.tenant_id,
  e.patient_id,
  'diagnosis'::text,
  d.id,
  d.created_at,
  jsonb_build_object(
    'diagnosis_id', d.id,
    'encounter_id', d.encounter_id,
    'code_system', d.code_system,
    'code', d.code,
    'display', d.display,
    'certainty', d.certainty,
    'is_primary', d.is_primary
  )
FROM diagnoses d
JOIN encounters e ON e.id = d.encounter_id

UNION ALL
SELECT
  e.tenant_id,
  e.patient_id,
  'prescription'::text,
  p.id,
  COALESCE(p.signed_at, p.created_at),
  jsonb_build_object(
    'prescription_id', p.id,
    'encounter_id', p.encounter_id,
    'medication_name', p.medication_name,
    'rxnorm_code', p.rxnorm_code,
    'dose', p.dose,
    'route', p.route,
    'frequency', p.frequency,
    'duration_days', p.duration_days,
    'status', p.status
  )
FROM prescriptions p
JOIN encounters e ON e.id = p.encounter_id

UNION ALL
SELECT
  pd.tenant_id,
  pd.patient_id,
  'document'::text,
  pd.id,
  pd.uploaded_at,
  jsonb_build_object(
    'document_id', pd.id,
    'category', pd.category,
    'title', pd.title,
    'mime_type', pd.mime_type,
    'sha256', pd.sha256,
    'source', pd.source,
    'uploaded_at', pd.uploaded_at
  )
FROM patient_documents pd
WHERE pd.deleted_at IS NULL

UNION ALL
SELECT
  o.tenant_id,
  o.patient_id,
  'outcome'::text,
  o.id,
  o.assessed_at,
  jsonb_build_object(
    'outcome_id', o.id,
    'encounter_id', o.encounter_id,
    'condition_code', o.condition_code,
    'condition_code_system', o.condition_code_system,
    'label', o.label,
    'label_version', o.label_version,
    'window_days', o.window_days,
    'window_complete', o.window_complete,
    'non_response_reason', o.non_response_reason,
    'assessed_at', o.assessed_at
  )
FROM outcomes o;
