/**
 * Prescriptions the clinic issues and the patient receives.
 *
 * The rules encoded here:
 *
 *  1. **Only a signed prescription leaves the clinic.** PROPOSED rows stay
 *     internal — a draft is not an instruction a patient may act on.
 *  2. **A prescription belongs to an encounter.** If the patient has no
 *     encounter on record, the clinic cannot prescribe; inventing one to make
 *     the form submit would put a clinical fact in the database that never
 *     happened.
 *  3. **The patient's copy is a bundle.** The phone stores a timeline record
 *     plus the structured medicines together, so it never has to invent a
 *     second id space to keep them in step.
 *
 * What this does NOT do: run the deterministic interaction/allergy check. That
 * gate exists in `services/safety`, and a prescription recorded from the console
 * is marked `PENDING` with `checked: false` rather than pretending it passed.
 */

const repo = require('../../storage/postgres/workflowRepository');

const MAX_MEDICATIONS = 10;
const CLOSED_STATES = new Set(['CANCELLED', 'CLOSED']);

class PrescriptionError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'PrescriptionError';
    this.code = code;
    this.status = status;
  }
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

/**
 * Validates and normalises the form the clinic submits.
 *
 * The minimum for a prescription to be actionable on a phone is a drug, a dose
 * and a frequency — the same three fields the encounter safety gate refuses to
 * sign without.
 */
function normaliseMedications(input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new PrescriptionError(
      'MEDICATIONS_REQUIRED',
      'Add at least one medicine before signing.',
      400
    );
  }
  if (input.length > MAX_MEDICATIONS) {
    throw new PrescriptionError(
      'MEDICATIONS_TOO_MANY',
      `A single prescription can carry at most ${MAX_MEDICATIONS} medicines.`,
      400
    );
  }

  return input.map((raw, index) => {
    const medicationName = cleanText(raw && raw.medicationName, 200);
    const dose = cleanText(raw && raw.dose, 100);
    const frequency = cleanText(raw && raw.frequency, 100);

    if (!medicationName) {
      throw new PrescriptionError(
        'MEDICATION_NAME_REQUIRED',
        `Medicine ${index + 1} needs a name.`,
        400
      );
    }
    if (!dose) {
      throw new PrescriptionError('DOSE_REQUIRED', `Medicine ${index + 1} needs a dose.`, 400);
    }
    if (!frequency) {
      throw new PrescriptionError(
        'FREQUENCY_REQUIRED',
        `Medicine ${index + 1} needs a frequency.`,
        400
      );
    }

    const rawDuration = Number(raw && raw.durationDays);
    const durationDays =
      Number.isFinite(rawDuration) && rawDuration > 0 && rawDuration <= 365
        ? Math.round(rawDuration)
        : null;

    return {
      medicationName,
      dose,
      frequency,
      route: cleanText(raw && raw.route, 50) || 'Oral',
      durationDays,
      rxnormCode: cleanText(raw && raw.rxnormCode, 40) || null
    };
  });
}

/**
 * Records a signed prescription against the patient's open encounter.
 *
 * The encounter is chosen, never taken from the request: a client that could
 * name an encounter could attach a prescription to another patient's visit.
 */
async function recordPrescription({ tenantId, patientId, actor, medications, reason }) {
  if (!tenantId || !patientId) {
    throw new PrescriptionError('PATIENT_REQUIRED', 'Choose a patient first.', 400);
  }

  const clean = normaliseMedications(medications);

  const encounters = await repo.listEncounters({ tenantId, patientId, limit: 20 });
  const encounter = encounters.find((row) => !CLOSED_STATES.has(row.state));
  if (!encounter) {
    throw new PrescriptionError(
      'ENCOUNTER_REQUIRED',
      'This patient has no open encounter. Book or start a visit before prescribing.',
      409
    );
  }

  const signedAt = new Date();
  const rows = await repo.withTransaction((client) =>
    repo.createPrescriptions(
      {
        tenantId,
        encounterId: encounter.id,
        signedBy: actor.actorId,
        signedByName: actor.actorName || null,
        reason: cleanText(reason, 500) || null,
        signedAt,
        medications: clean,
        // Honest: the console does not run the deterministic check.
        safetyStatus: 'PENDING',
        safetyDetail: {
          checked: false,
          note: 'Recorded from the clinic console. The deterministic interaction check has not been run for this prescription.'
        }
      },
      { client }
    )
  );

  return { encounter, prescriptions: rows };
}

/**
 * Signed prescriptions for one patient, grouped the way the phone stores them.
 *
 * Rows written in one signing action share an encounter and a `signed_at`, and
 * that pair is the natural group key — no extra column, and a later signature
 * on the same encounter is correctly a separate sheet.
 */
function toBundles(rows = []) {
  const groups = new Map();

  for (const row of rows) {
    const key = `${row.encounter_id}|${row.signed_at ? new Date(row.signed_at).toISOString() : row.created_at}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const first = group[0];
    const signedAt = first.signed_at ? new Date(first.signed_at) : new Date(first.created_at);
    const dateIso = signedAt.toISOString().slice(0, 10);
    const doctorName = first.signed_by_name || 'Your doctor';
    const medications = group.map((row) => ({
      name: row.medication_name,
      dose: row.dose,
      route: row.route || 'Oral',
      frequency: row.frequency,
      duration: row.duration_days ? `${row.duration_days} days` : 'As directed',
      instructions: '',
      refillsAllowed: 0
    }));

    return {
      record: {
        id: `rec-rx-${group[0].id}`,
        type: 'PRESCRIPTION',
        title: `Prescription · ${medications.map((med) => med.name).slice(0, 2).join(', ')}`,
        subtitle: `${medications.length} medicine${medications.length === 1 ? '' : 's'} · signed by ${doctorName}`,
        dateIso,
        displayDate: signedAt.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        doctorOrLab: doctorName,
        summary: medications.map((med) => `${med.name} ${med.dose}`).join(' · ')
      },
      detail: {
        id: `rx-${group[0].id}`,
        doctorName,
        clinicName: 'Your clinic',
        dateIssued: dateIso,
        diagnosisReason: first.reason || 'As discussed with your doctor',
        medications,
        clinicalNotes: null,
        followUpRecommendation: null
      },
      // Carried alongside the bundle so the console can be truthful about the
      // check that was not run. The phone ignores unknown fields.
      safety: {
        status: first.safety_status,
        checked: Boolean(first.safety_detail && first.safety_detail.checked),
        note: (first.safety_detail && first.safety_detail.note) || null
      },
      groupKey: key
    };
  });
}

async function prescriptionsForPatient({ tenantId, patientId }) {
  const rows = await repo.listSignedPrescriptionsForPatient({ tenantId, patientId });
  return toBundles(rows);
}

module.exports = {
  PrescriptionError,
  recordPrescription,
  prescriptionsForPatient,
  toBundles,
  normaliseMedications,
  MAX_MEDICATIONS
};
