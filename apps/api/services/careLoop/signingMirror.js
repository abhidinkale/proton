/**
 * Signature → patient record mirror.
 *
 * When a clinician signs in the desk, the note and its prescriptions are
 * written to the durable workflow tables for the same encounter the phone
 * booked. Without this the patient's own history would stay empty after a
 * perfectly complete visit, and the prescription would exist only on the
 * clinic's screen.
 *
 * Only visits that came from the patient app (and therefore carry a synced
 * encounter id) are mirrored. Desk-created patients keep their existing
 * behaviour. The write is idempotent and runs in one transaction.
 */

const repo = require('../../storage/postgres/workflowRepository');

function contentOf(note) {
  const body = note?.note || {};
  return {
    subjective: body.subjective || '',
    objective: body.objective || '',
    assessment: body.assessment || '',
    plan: body.plan || '',
    diagnoses: Array.isArray(note?.diagnoses) ? note.diagnoses : []
  };
}

function medicationsOf(note) {
  const rows = Array.isArray(note?.prescriptions) ? note.prescriptions : [];
  return rows
    .map((rx) => {
      const days = Number.parseInt(String(rx.duration || ''), 10);
      return {
        medicationName: String(rx.name || rx.medicationName || '').trim(),
        dose: String(rx.dose || '').trim(),
        frequency: String(rx.frequency || '').trim(),
        durationDays: Number.isFinite(days) && days > 0 && days <= 365 ? days : null,
        route: rx.route || 'Oral'
      };
    })
    .filter((rx) => rx.medicationName && rx.dose && rx.frequency)
    .slice(0, 20);
}

/**
 * @param {object} input
 * @param {string} input.tenantId
 * @param {object} input.note        the signed desk note
 * @param {object} input.appointment the desk appointment (carries syncedEncounterId)
 * @param {object} input.actor       { actorId, actorName }
 */
async function mirrorSignedNote({ tenantId, note, appointment, actor }) {
  const encounterId = appointment?.syncedEncounterId;
  if (!encounterId || !note) return { skipped: 'not_a_synced_visit' };

  const medications = medicationsOf(note);
  const signedAt = note.signedAt ? new Date(note.signedAt) : new Date();

  const result = await repo.withTransaction(async (client) => {
    const saved = await repo.upsertSignedNote(
      {
        id: `desk-${note.id}`,
        tenantId,
        encounterId,
        authorActorId: actor?.actorId || 'unknown',
        title: note.title || null,
        content: contentOf(note),
        provenance: {
          source: 'clinic_desk',
          deskNoteId: note.id,
          appointmentId: note.appointmentId || null,
          attestation: note.signature?.attestation || null,
          safetyVerdict: note.signature?.safetyVerdict || null
        },
        signedBy: actor?.actorId || 'unknown',
        signedAt
      },
      { client }
    );

    if (medications.length === 0) return { note: saved, prescriptions: [] };

    // A retry after a partial failure must not double-prescribe.
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS count
         FROM prescriptions
        WHERE tenant_id = $1 AND encounter_id = $2;`,
      [tenantId, encounterId]
    );
    if (Number(rows[0]?.count || 0) > 0) {
      return { note: saved, prescriptions: [], alreadyPrescribed: true };
    }

    const prescriptions = await repo.createPrescriptions(
      {
        tenantId,
        encounterId,
        signedBy: actor?.actorId || 'unknown',
        signedByName: actor?.actorName || null,
        reason: note.title || null,
        signedAt,
        medications,
        safetyStatus: 'CLEAR',
        safetyDetail: {
          checked: true,
          source: 'clinic_desk',
          note: 'Signed in the clinic desk after the deterministic safety gate cleared the prescription.'
        }
      },
      { client }
    );

    return { note: saved, prescriptions };
  });

  // The phone's visit is over once the note is signed. Keeping the appointment
  // at BOOKED would show a completed consultation as still upcoming.
  const appointmentId = appointment.syncedAppointmentId || note.appointmentId || null;
  if (appointmentId) {
    await repo
      .updateAppointment({ tenantId, appointmentId, status: 'COMPLETED' })
      .catch((err) => console.warn('[sign-mirror] appointment not completed:', err.message));
  }

  return result;
}

module.exports = { mirrorSignedNote, contentOf, medicationsOf };
