/**
 * Proton Encounter Comparison Engine — P1.2
 *
 * Computes deterministic, field-level clinical differences between two encounters
 * for the same patient using their structured `note_v1` schemas, diagnoses,
 * prescriptions, and recorded follow-up outcomes.
 *
 * Answers two critical physician questions in < 2 seconds:
 * 1. "What changed since last visit?" (vitals delta, exam differences, added/discontinued meds)
 * 2. "Did the prior treatment work?" (follow-up outcome label from the 30-day cohort)
 */

const { getPostgresPool } = require('../../storage/postgresDb');

/**
 * Normalizes a condition or drug name for comparison.
 */
function normalizeName(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '');
}

/**
 * Computes difference between two decimal vital strings.
 */
function computeVitalDiff(metric, priorStr, currStr, unit, label) {
  const priorNum = priorStr !== null && priorStr !== undefined && priorStr !== '' ? Number(priorStr) : null;
  const currNum = currStr !== null && currStr !== undefined && currStr !== '' ? Number(currStr) : null;

  let delta = null;
  let trend = 'not_comparable';

  if (Number.isFinite(priorNum) && Number.isFinite(currNum)) {
    delta = Number((currNum - priorNum).toFixed(2));
    if (delta > 0.01) trend = 'increased';
    else if (delta < -0.01) trend = 'decreased';
    else trend = 'unchanged';
  } else if (Number.isFinite(currNum)) {
    trend = 'newly_measured';
  } else if (Number.isFinite(priorNum)) {
    trend = 'omitted';
  }

  return {
    metric,
    label,
    unit,
    prior: priorStr || null,
    current: currStr || null,
    delta,
    trend
  };
}

/**
 * Compares two note_v1 structured note objects.
 *
 * @param {object} priorNote  Prior encounter note_v1 object
 * @param {object} currNote   Current encounter note_v1 object
 * @param {object} priorOutcomes Optional array of outcomes linked to prior encounter
 */
function diffNoteV1(priorNote = {}, currNote = {}, priorOutcomes = []) {
  const priorSubj = priorNote.subjective || {};
  const currSubj = currNote.subjective || {};
  const priorObj = priorNote.objective || {};
  const currObj = currNote.objective || {};
  const priorAssess = priorNote.assessment || {};
  const currAssess = currNote.assessment || {};
  const priorPlan = priorNote.plan || {};
  const currPlan = currNote.plan || {};

  // 1. Vitals Diff
  const pVit = priorObj.vitals || {};
  const cVit = currObj.vitals || {};
  const vitals = [
    computeVitalDiff('temperature_c', pVit.temperature_c, cVit.temperature_c, '°C', 'Temperature'),
    computeVitalDiff('heart_rate_bpm', pVit.heart_rate_bpm, cVit.heart_rate_bpm, 'bpm', 'Heart Rate'),
    computeVitalDiff('systolic_bp_mmhg', pVit.systolic_bp_mmhg, cVit.systolic_bp_mmhg, 'mmHg', 'Systolic BP'),
    computeVitalDiff('diastolic_bp_mmhg', pVit.diastolic_bp_mmhg, cVit.diastolic_bp_mmhg, 'mmHg', 'Diastolic BP'),
    computeVitalDiff('respiratory_rate_bpm', pVit.respiratory_rate_bpm, cVit.respiratory_rate_bpm, 'bpm', 'Respiratory Rate'),
    computeVitalDiff('spo2_pct', pVit.spo2_pct, cVit.spo2_pct, '%', 'SpO2'),
    computeVitalDiff('weight_kg', pVit.weight_kg, cVit.weight_kg, 'kg', 'Weight')
  ];

  // 2. Diagnoses Diff
  const priorConditions = [];
  if (priorAssess.primary?.condition) {
    priorConditions.push({ condition: priorAssess.primary.condition, isPrimary: true });
  }
  (priorAssess.differential || []).forEach((d) => {
    if (d.condition) priorConditions.push({ condition: d.condition, band: d.band, isPrimary: false });
  });

  const currConditions = [];
  if (currAssess.primary?.condition) {
    currConditions.push({ condition: currAssess.primary.condition, isPrimary: true });
  }
  (currAssess.differential || []).forEach((d) => {
    if (d.condition) currConditions.push({ condition: d.condition, band: d.band, isPrimary: false });
  });

  const ongoingDiagnoses = [];
  const newDiagnoses = [];
  const resolvedDiagnoses = [];

  for (const curr of currConditions) {
    const match = priorConditions.find(
      (p) => normalizeName(p.condition) === normalizeName(curr.condition)
    );
    if (match) {
      ongoingDiagnoses.push({
        condition: curr.condition,
        wasPrimary: match.isPrimary,
        isPrimary: curr.isPrimary
      });
    } else {
      newDiagnoses.push(curr);
    }
  }

  for (const prior of priorConditions) {
    const match = currConditions.find(
      (c) => normalizeName(c.condition) === normalizeName(prior.condition)
    );
    if (!match) {
      resolvedDiagnoses.push(prior);
    }
  }

  // 3. Medications Diff
  const priorMeds = priorPlan.medications || [];
  const currMeds = currPlan.medications || [];

  const addedMeds = [];
  const continuedMeds = [];
  const changedMeds = [];
  const discontinuedMeds = [];

  for (const curr of currMeds) {
    const match = priorMeds.find((p) => normalizeName(p.drug) === normalizeName(curr.drug));
    if (!match) {
      addedMeds.push(curr);
    } else {
      const doseChanged = curr.dose !== match.dose;
      const freqChanged = curr.frequency !== match.frequency;
      if (doseChanged || freqChanged) {
        changedMeds.push({
          drug: curr.drug,
          prior: { dose: match.dose, frequency: match.frequency },
          current: { dose: curr.dose, frequency: curr.frequency },
          rationale: curr.rationale
        });
      } else {
        continuedMeds.push(curr);
      }
    }
  }

  for (const prior of priorMeds) {
    const match = currMeds.find((c) => normalizeName(c.drug) === normalizeName(prior.drug));
    if (!match) {
      discontinuedMeds.push(prior);
    }
  }

  // 4. Physical Exam Diff
  const priorExam = priorObj.exam || [];
  const currExam = currObj.exam || [];

  const examChanges = [];
  for (const curr of currExam) {
    const match = priorExam.find((p) => normalizeName(p.system) === normalizeName(curr.system));
    if (!match) {
      examChanges.push({ system: curr.system, status: 'new', current: curr.finding });
    } else if (match.finding !== curr.finding) {
      examChanges.push({ system: curr.system, status: 'changed', prior: match.finding, current: curr.finding });
    }
  }
  for (const prior of priorExam) {
    const match = currExam.find((c) => normalizeName(c.system) === normalizeName(prior.system));
    if (!match) {
      examChanges.push({ system: prior.system, status: 'resolved', prior: prior.finding });
    }
  }

  // 5. Subjective changes
  const chiefComplaint = {
    prior: priorSubj.chief_complaint?.text || null,
    current: currSubj.chief_complaint?.text || null,
    changed: normalizeName(priorSubj.chief_complaint?.text) !== normalizeName(currSubj.chief_complaint?.text)
  };

  // 6. Treatment Outcome from prior encounter
  const treatmentEfficacy = priorOutcomes.map((o) => ({
    conditionCode: o.condition_code,
    label: o.label,
    followUpWave: o.follow_up_wave,
    assessedAt: o.assessed_at,
    patientReported: o.patient_reported,
    interpretedStatus:
      o.label === 'resolved' || o.label === 'improved'
        ? 'TREATMENT WORKED'
        : o.label === 'worsened'
        ? 'TREATMENT FAILED / WORSENED'
        : 'INCONCLUSIVE / UNCHANGED'
  }));

  return {
    chiefComplaint,
    vitals,
    diagnoses: {
      new: newDiagnoses,
      ongoing: ongoingDiagnoses,
      resolved: resolvedDiagnoses
    },
    medications: {
      added: addedMeds,
      changed: changedMeds,
      continued: continuedMeds,
      discontinued: discontinuedMeds
    },
    examChanges,
    treatmentEfficacy
  };
}

/**
 * Loads two encounters and compares them.
 */
async function compareEncounters(pool, tenantId, patientId, encounterIdA, encounterIdB) {
  // Load notes for both encounters
  const { rows: noteRows } = await pool.query(
    `SELECT encounter_id, content, created_at, signed_at
       FROM notes
      WHERE tenant_id = $1 AND encounter_id IN ($2, $3)
      ORDER BY created_at ASC;`,
    [tenantId, encounterIdA, encounterIdB]
  );

  const noteMap = {};
  for (const r of noteRows) {
    noteMap[r.encounter_id] = r.content;
  }

  const noteA = noteMap[encounterIdA] || {};
  const noteB = noteMap[encounterIdB] || {};

  // Load any prior outcomes for encounterIdA
  const { rows: outcomes } = await pool.query(
    `SELECT condition_code, label, follow_up_wave, assessed_at, patient_reported
       FROM outcomes
      WHERE tenant_id = $1 AND encounter_id = $2
      ORDER BY assessed_at ASC;`,
    [tenantId, encounterIdA]
  );

  const diff = diffNoteV1(noteA, noteB, outcomes);

  return {
    tenantId,
    patientId,
    encounterA: encounterIdA,
    encounterB: encounterIdB,
    diff
  };
}

module.exports = {
  diffNoteV1,
  compareEncounters,
  computeVitalDiff
};
