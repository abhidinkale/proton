/**
 * Sign-time safety check for the durable workflow.
 *
 * The AI pipeline and the clinic desk are gated; this is the third write
 * boundary. It runs inside the same transaction as the `sign` transition, so a
 * refusal leaves the encounter in PENDING_REVIEW with no event and no signature.
 *
 * The patient's renal and weight context is read from `patients.contact` when
 * present. Missing allergy context is a warning from the gate, not a silent
 * pass; missing eGFR is handled by the kernel's metformin rule.
 */

const { safetyGate } = require('../safety/safetyGate');
const { WorkflowError } = require('./encounterStateMachine');

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const month = now.getUTCMonth() - dob.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

async function loadSignContext(client, tenantId, encounterId) {
  const { rows: patientRows } = await client.query(
    `SELECT p.date_of_birth, p.contact
       FROM encounters e
       JOIN patients p ON p.id = e.patient_id
      WHERE e.id = $1 AND e.tenant_id = $2;`,
    [encounterId, tenantId]
  );

  const { rows: prescriptionRows } = await client.query(
    `SELECT id, medication_name, dose, route, frequency, duration_days
       FROM prescriptions
      WHERE encounter_id = $1
        AND tenant_id = $2
        AND status IN ('PROPOSED', 'SIGNED')
      ORDER BY created_at ASC;`,
    [encounterId, tenantId]
  );

  return { patient: patientRows[0] || null, prescriptions: prescriptionRows };
}

/**
 * @param {import('pg').PoolClient} client Caller owns the transaction.
 * @returns {Promise<{skipped: boolean, verdict: object|null}>}
 */
async function assertSignSafety(client, { tenantId, encounterId, actor, physicianDirective = null }) {
  if (!tenantId || !encounterId) {
    throw new WorkflowError('SIGN_SAFETY_CONTEXT', 'tenantId and encounterId are required.', 400);
  }

  const { patient, prescriptions } = await loadSignContext(client, tenantId, encounterId);
  if (prescriptions.length === 0) {
    return { skipped: true, verdict: null };
  }

  const contact = patient?.contact && typeof patient.contact === 'object' ? patient.contact : {};
  const verdict = safetyGate.verifyMedicationGate({
    prescriptions: prescriptions.map((rx) => ({
      name: rx.medication_name,
      dose: rx.dose,
      route: rx.route,
      frequency: rx.frequency
    })),
    patientProfile: {
      allergies: contact.allergies || [],
      medications: contact.medications || contact.activeMedications || [],
      age: calculateAge(patient?.date_of_birth),
      eGFR: contact.eGFR ?? contact.egfr ?? null,
      weightKg: contact.weightKg ?? contact.weight_kg ?? null
    },
    actor: {
      actorId: actor?.actorId,
      actorRole: actor?.actorRole,
      tenantId
    },
    physicianDirective
  });

  if (!verdict.cleared) {
    const hardStop = Boolean(verdict.hardStop);
    throw new WorkflowError(
      hardStop ? 'CONTRAINDICATION_HARD_STOP' : 'SAFETY_REVIEW_REQUIRED',
      hardStop
        ? 'A prescription in this encounter has a critical safety contraindication.'
        : 'A prescription in this encounter requires safety review before signing.',
      409,
      { safetyVerdict: verdict }
    );
  }

  return { skipped: false, verdict };
}

module.exports = { assertSignSafety, loadSignContext, calculateAge };
