-- ===========================================================================
-- The three queries that justify the link layer (P1.1)
--
-- These are the only traversals the pre-visit brief and compare-visits need in
-- v1. They are written against the real workflow tables. If one of them stops
-- being useful, the layer is not earning its keep.
--
-- Parameters are positional so the API can prepare them once.
-- ===========================================================================

-- @@query q1_active_problems_and_meds
-- ---------------------------------------------------------------------------
-- Q1 — active problems and medications
-- $1 tenant_id, $2 patient_id
--
-- "Active problem" is a CONFIRMED diagnosis that is not the source of a
-- confirmed RESOLVED_BY edge. That is a deliberate dependency on the link
-- layer: the existing `diagnoses` table has no RESOLVED state. `certainty`
-- can be PROPOSED, CONFIRMED, or RULED_OUT — "the diagnosis was wrong" — but
-- there is nowhere to say "this problem resolved." Pretending confirmed equals
-- active would keep every resolved strep throat on the problem list forever.
--
-- "Active medication" is a SIGNED prescription still inside its duration.
-- duration_days NULL means open-ended (a chronic medication).
-- ---------------------------------------------------------------------------
WITH resolved_diagnoses AS (
  SELECT from_id AS diagnosis_id
  FROM clinical_links
  WHERE tenant_id = $1
    AND patient_id = $2
    AND from_type = 'diagnosis'
    AND relation = 'RESOLVED_BY'
    AND status IN ('authored', 'confirmed')
),
active_diagnoses AS (
  SELECT DISTINCT ON (COALESCE(d.code, d.id))
    'diagnosis'::text AS node_type,
    d.id AS node_id,
    e.id AS encounter_id,
    COALESCE(d.code, d.id) AS problem_key,
    e.created_at AS occurred_at,
    jsonb_build_object(
      'diagnosis_id', d.id,
      'encounter_id', e.id,
      'code_system', d.code_system,
      'code', d.code,
      'display', d.display,
      'certainty', d.certainty,
      'is_primary', d.is_primary
    ) AS payload
  FROM diagnoses d
  JOIN encounters e ON e.id = d.encounter_id
  WHERE e.tenant_id = $1
    AND e.patient_id = $2
    AND d.certainty = 'CONFIRMED'
    AND NOT EXISTS (
      SELECT 1 FROM resolved_diagnoses r WHERE r.diagnosis_id = d.id
    )
  ORDER BY COALESCE(d.code, d.id), e.created_at DESC
),
active_medications AS (
  SELECT DISTINCT ON (lower(p.medication_name))
    'prescription'::text AS node_type,
    p.id AS node_id,
    e.id AS encounter_id,
    lower(p.medication_name) AS problem_key,
    COALESCE(p.signed_at, p.created_at) AS occurred_at,
    jsonb_build_object(
      'prescription_id', p.id,
      'encounter_id', e.id,
      'medication_name', p.medication_name,
      'rxnorm_code', p.rxnorm_code,
      'dose', p.dose,
      'route', p.route,
      'frequency', p.frequency,
      'duration_days', p.duration_days,
      'signed_at', p.signed_at
    ) AS payload
  FROM prescriptions p
  JOIN encounters e ON e.id = p.encounter_id
  WHERE e.tenant_id = $1
    AND e.patient_id = $2
    AND p.status = 'SIGNED'
    AND (
      p.duration_days IS NULL
      OR p.signed_at + (p.duration_days || ' days')::interval > NOW()
    )
  ORDER BY lower(p.medication_name), COALESCE(p.signed_at, p.created_at) DESC
)
SELECT node_type, node_id, encounter_id, problem_key, occurred_at, payload
FROM active_diagnoses
UNION ALL
SELECT node_type, node_id, encounter_id, problem_key, occurred_at, payload
FROM active_medications
ORDER BY node_type, occurred_at DESC;

-- @@query q2_prior_episode
-- ---------------------------------------------------------------------------
-- Q2 — prior episode for a coded condition
-- $1 tenant_id, $2 patient_id, $3 condition_code, $4 before timestamptz
--
-- One row: the most recent prior encounter in which this condition was coded,
-- every signed treatment from that encounter, and the latest outcome for the
-- same condition. `before` is the current encounter's created_at, so the query
-- cannot accidentally return the encounter being prepared.
-- ---------------------------------------------------------------------------
WITH prior AS (
  SELECT
    e.id AS encounter_id,
    e.created_at AS encounter_at,
    d.id AS diagnosis_id,
    d.code,
    d.code_system,
    d.display
  FROM diagnoses d
  JOIN encounters e ON e.id = d.encounter_id
  WHERE e.tenant_id = $1
    AND e.patient_id = $2
    AND d.code = $3
    AND e.created_at < $4
  ORDER BY e.created_at DESC
  LIMIT 1
)
SELECT
  p.encounter_id,
  p.encounter_at,
  p.diagnosis_id,
  p.code,
  p.code_system,
  p.display,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'prescription_id', rx.id,
        'medication_name', rx.medication_name,
        'rxnorm_code', rx.rxnorm_code,
        'dose', rx.dose,
        'route', rx.route,
        'frequency', rx.frequency,
        'duration_days', rx.duration_days,
        'status', rx.status
      )
      ORDER BY rx.created_at
    ) FILTER (WHERE rx.id IS NOT NULL),
    '[]'::jsonb
  ) AS treatments,
  (
    SELECT jsonb_build_object(
      'outcome_id', o.id,
      'label', o.label,
      'label_version', o.label_version,
      'window_days', o.window_days,
      'window_complete', o.window_complete,
      'assessed_at', o.assessed_at
    )
    FROM outcomes o
    WHERE o.tenant_id = $1
      AND o.encounter_id = p.encounter_id
      AND o.condition_code = p.code
    ORDER BY o.assessed_at DESC
    LIMIT 1
  ) AS outcome
FROM prior p
LEFT JOIN prescriptions rx
  ON rx.encounter_id = p.encounter_id
 AND rx.status = 'SIGNED'
GROUP BY
  p.encounter_id, p.encounter_at, p.diagnosis_id, p.code, p.code_system, p.display;

-- @@query q3_last_treatment_outcome
-- ---------------------------------------------------------------------------
-- Q3 — last outcome for a treatment
-- $1 tenant_id, $2 patient_id, $3 medication key (RxNorm code or name),
-- $4 condition_code (nullable; NULL means any condition)
--
-- This is the query that makes an outcome label joinable to a prescription.
-- It returns the most recent signed prescription for the drug and the latest
-- outcome recorded for the same encounter/condition, with the day delta.
-- ---------------------------------------------------------------------------
SELECT
  p.id AS prescription_id,
  p.medication_name,
  p.rxnorm_code,
  p.dose,
  p.route,
  p.frequency,
  p.duration_days,
  p.signed_at,
  e.id AS encounter_id,
  o.label,
  o.label_version,
  o.assessed_at,
  CASE
    WHEN o.assessed_at IS NULL OR p.signed_at IS NULL THEN NULL
    ELSE (EXTRACT(EPOCH FROM (o.assessed_at - p.signed_at)) / 86400)::int
  END AS days_to_outcome
FROM prescriptions p
JOIN encounters e ON e.id = p.encounter_id
LEFT JOIN LATERAL (
  SELECT *
  FROM outcomes o
  WHERE o.tenant_id = e.tenant_id
    AND o.encounter_id = e.id
    AND ($4::text IS NULL OR o.condition_code = $4)
  ORDER BY o.assessed_at DESC
  LIMIT 1
) o ON TRUE
WHERE e.tenant_id = $1
  AND e.patient_id = $2
  AND p.status = 'SIGNED'
  AND (
    p.rxnorm_code = $3
    OR lower(p.medication_name) = lower($3)
  )
ORDER BY p.signed_at DESC NULLS LAST
LIMIT 1;

-- @@query integrity_orphaned_links
-- ---------------------------------------------------------------------------
-- Integrity — orphaned links
-- $1 tenant_id
--
-- Polymorphic edges cannot use a foreign key. This returns any edge endpoint
-- that no longer resolves to a node. Run nightly; a non-empty result is a
-- data-integrity incident, not a warning.
-- ---------------------------------------------------------------------------
SELECT l.id, 'from' AS side, l.from_type AS node_type, l.from_id AS node_id
FROM clinical_links l
WHERE l.tenant_id = $1
  AND NOT EXISTS (
    SELECT 1 FROM clinical_nodes_v1 n
    WHERE n.tenant_id = l.tenant_id
      AND n.node_type = l.from_type
      AND n.node_id = l.from_id
  )
UNION ALL
SELECT l.id, 'to' AS side, l.to_type AS node_type, l.to_id AS node_id
FROM clinical_links l
WHERE l.tenant_id = $1
  AND NOT EXISTS (
    SELECT 1 FROM clinical_nodes_v1 n
    WHERE n.tenant_id = l.tenant_id
      AND n.node_type = l.to_type
      AND n.node_id = l.to_id
  )
LIMIT 100;
