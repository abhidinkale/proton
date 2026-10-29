/**
 * Demo seed — one patient, two episodes, one coded condition.
 *
 * The recurrence is real only if both encounters carry the same SNOMED code.
 * `43878008` is streptococcal pharyngitis; free-text similarity is not a
 * substitute and is not used here.
 *
 * Usage:
 *   DATABASE_URL=postgres://localhost:5432/proton_demo node scripts/seed-demo.js
 *
 * Idempotent: deletes and recreates the demo rows.
 */

const path = require('node:path');
const { runPostgresMigrations, getPostgresPool, closePostgresPool } = require(
  path.join(__dirname, '..', 'storage', 'postgresDb')
);

const TENANT = 'org-default';
const PATIENT = 'pat-demo-1';
const CLINICIAN = 'usr-md-lin-01';
const SNOMED = '43878008';
const CONDITION = 'Streptococcal pharyngitis';

const NOTE = {
  schema_version: 'note_v1',
  subjective: {
    chief_complaint: { text: 'sore throat and fever', onset: 'gradual', duration: '3 days', severity: 6 },
    hpi: [],
    pmh: [],
    medications: [],
    allergies: [],
    narrative: 'Sore throat and fever for three days. No cough. One prior episode last November.'
  },
  objective: {
    vitals: {
      temperature_c: '38.4',
      heart_rate_bpm: '98',
      systolic_bp_mmhg: '128',
      diastolic_bp_mmhg: '82',
      respiratory_rate_bpm: '18',
      spo2_pct: '98',
      weight_kg: '64',
      height_cm: '165'
    },
    exam: [{ system: 'ENT', finding: 'tonsillar exudate', laterality: 'bilateral' }],
    labs: []
  },
  assessment: {
    differential: [
      {
        condition: CONDITION,
        band: 'supported',
        for: ['Centor 4', 'tonsillar exudate', 'fever'],
        against: [],
        guideline_ref: 'IDSA-2012'
      }
    ],
    primary: { condition: CONDITION, basis: 'Centor score 4 with exudate and fever.' }
  },
  plan: {
    medications: [
      {
        drug: 'Amoxicillin',
        dose: '500 mg',
        route: 'PO',
        frequency: 'three times daily',
        duration_days: 7,
        rationale: 'First-line therapy for group A streptococcal pharyngitis.'
      }
    ],
    orders: [],
    follow_up: { interval: '48 hours', method: 'app', triggers: ['worse', 'fever persists'] },
    education: []
  }
};

async function main() {
  await runPostgresMigrations();
  const db = getPostgresPool();

  // Dependency order: outcomes/cohort/links reference the encounter, encounters
  // reference the patient with RESTRICT, so the leaf tables go first.
  for (const statement of [
    `DELETE FROM outcomes WHERE patient_id = $1`,
    `DELETE FROM outcome_cohort WHERE patient_id = $1`,
    `DELETE FROM clinical_links WHERE patient_id = $1`,
    `DELETE FROM patient_messages WHERE patient_id = $1`,
    `DELETE FROM encounter_events WHERE encounter_id IN (SELECT id FROM encounters WHERE patient_id = $1)`,
    `DELETE FROM appointments WHERE patient_id = $1`,
    `DELETE FROM encounters WHERE patient_id = $1`,
    `DELETE FROM patients WHERE id = $1`
  ]) {
    await db.query(`${statement};`, [PATIENT]).catch((err) => {
      // A table that does not exist in this build is not a seed failure.
      if (err.code !== '42P01') throw err;
    });
  }

  await db.query(
    `INSERT INTO patients (id, tenant_id, full_name, date_of_birth, sex)
     VALUES ($1, $2, 'Priya Sharma', '1992-04-11', 'female');`,
    [PATIENT, TENANT]
  );

  await db.query(
    `INSERT INTO appointments
       (id, tenant_id, patient_id, clinician_id, scheduled_for, duration_minutes, status, reason)
     VALUES ('appt-demo-1', $1, $2, $3, '2026-10-27T09:00:00Z', 20, 'BOOKED', 'sore throat');`,
    [TENANT, PATIENT, CLINICIAN]
  );

  // Episode 1 — 2025-11-03. Signed, treated, and closed with a real 30-day
  // label. This is the row the recurrence query reads.
  await db.query(
    `INSERT INTO encounters
       (id, tenant_id, patient_id, clinician_id, state, version, created_at, updated_at)
     VALUES ('enc-demo-prior', $1, $2, $3, 'CLOSED', 5, '2025-11-03T09:00:00Z', '2025-12-03T09:00:00Z');`,
    [TENANT, PATIENT, CLINICIAN]
  );
  await db.query(
    `INSERT INTO diagnoses
       (id, tenant_id, encounter_id, code_system, code, display, certainty, is_primary, evidence, created_by, created_at)
     VALUES ('dx-demo-prior', $1, 'enc-demo-prior', 'SNOMED', $2, $3, 'CONFIRMED', TRUE, '[]'::jsonb, $4, '2025-11-03T09:00:00Z');`,
    [TENANT, SNOMED, CONDITION, CLINICIAN]
  );
  await db.query(
    `INSERT INTO prescriptions
       (id, tenant_id, encounter_id, medication_name, rxnorm_code, dose, route, frequency,
        duration_days, status, safety_status, signed_by, signed_at, created_at)
     VALUES ('rx-demo-prior', $1, 'enc-demo-prior', 'Amoxicillin', '308182', '500 mg', 'PO',
             'three times daily', 7, 'SIGNED', 'CLEAR', $2, '2025-11-03T09:05:00Z', '2025-11-03T09:05:00Z');`,
    [TENANT, CLINICIAN]
  );
  await db.query(
    `INSERT INTO outcome_cohort
       (id, tenant_id, patient_id, encounter_id, condition_code, condition_code_system,
        scheduled_at, window_days, status, closed_at)
     VALUES ('coh-demo-prior', $1, $2, 'enc-demo-prior', $3, 'SNOMED',
             '2025-11-03T09:05:00Z', 30, 'closed', '2025-12-03T09:05:00Z');`,
    [TENANT, PATIENT, SNOMED]
  );
  await db.query(
    `INSERT INTO outcomes
       (id, tenant_id, patient_id, encounter_id, condition_code, condition_code_system,
        assessed_at, window_days, follow_up_wave, patient_reported, label, label_version,
        window_complete, source)
     VALUES ('out-demo-prior', $1, $2, 'enc-demo-prior', $3, 'SNOMED',
             '2025-12-03T09:05:00Z', 30, '30d', 'better', 'resolved', 'label_v1', TRUE, 'patient_app');`,
    [TENANT, PATIENT, SNOMED]
  );

  // Episode 2 — today. Draft note in note_v1, awaiting signature.
  await db.query(
    `INSERT INTO encounters
       (id, tenant_id, patient_id, appointment_id, clinician_id, state, version, created_at, updated_at)
     VALUES ('enc-demo-1', $1, $2, 'appt-demo-1', $3, 'PENDING_REVIEW', 1, NOW(), NOW());`,
    [TENANT, PATIENT, CLINICIAN]
  );
  await db.query(
    `INSERT INTO notes
       (id, tenant_id, encounter_id, author_actor_id, status, content, created_at, updated_at)
     VALUES ('note-demo-1', $1, 'enc-demo-1', $2, 'PENDING_REVIEW', $3::jsonb, NOW(), NOW());`,
    [TENANT, CLINICIAN, JSON.stringify(NOTE)]
  );
  await db.query(
    `INSERT INTO diagnoses
       (id, tenant_id, encounter_id, code_system, code, display, certainty, is_primary, evidence, created_by)
     VALUES ('dx-demo-1', $1, 'enc-demo-1', 'SNOMED', $2, $3, 'CONFIRMED', TRUE, '[]'::jsonb, $4);`,
    [TENANT, SNOMED, CONDITION, CLINICIAN]
  );
  await db.query(
    `INSERT INTO prescriptions
       (id, tenant_id, encounter_id, medication_name, rxnorm_code, dose, route, frequency,
        duration_days, status, safety_status)
     VALUES ('rx-demo-1', $1, 'enc-demo-1', 'Amoxicillin', '308182', '500 mg', 'PO',
             'three times daily', 7, 'PROPOSED', 'PENDING');`,
    [TENANT]
  );

  const prior = await db.query(
    `SELECT e.id, e.created_at, d.code, o.label, o.window_days
       FROM encounters e
       JOIN diagnoses d ON d.encounter_id = e.id
       LEFT JOIN outcomes o ON o.encounter_id = e.id AND o.condition_code = d.code
      WHERE e.patient_id = $1 AND d.code = $2
      ORDER BY e.created_at;`,
    [PATIENT, SNOMED]
  );

  console.log(
    JSON.stringify(
      {
        seeded: { patient: PATIENT, tenant: TENANT, condition: `${CONDITION} (SNOMED ${SNOMED})` },
        episodes: prior.rows.map((r) => ({
          encounter_id: r.id,
          started: r.created_at,
          outcome: r.label,
          window_days: r.window_days
        }))
      },
      null,
      2
    )
  );
  await closePostgresPool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
