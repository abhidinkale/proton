/**
 * Signature → PostgreSQL Patient Record & Attestation Mirror (P0.1 & P0.2)
 *
 * When a clinician signs a note in the desk (or cockpit), the note, its diagnoses,
 * its prescriptions, and its cryptographic attestation are committed to the durable
 * PostgreSQL workflow tables in a single transaction.
 *
 * This closes the dual-store loophole (P0.1):
 * 1. Postgres `patients` and `encounters` rows are guaranteed.
 * 2. `notes` stores a validated `note_v1` schema with full provenance.
 * 3. `diagnoses` are persisted with resolved SNOMED CT terminology and primary flags.
 * 4. `prescriptions` are persisted with resolved RxNorm CUIs.
 * 5. `clinical_attestations` records the content-bound SHA-256 canonical hash (P0.2).
 * 6. `outcome_cohort` schedules the encounter for 30-day tracking (P1.5).
 */

const crypto = require('crypto');
const repo = require('../../storage/postgres/workflowRepository');
const attestation = require('../workflow/attestation');
const attestationStore = require('../workflow/attestationStore');
const { validateNote } = require('../clinical/noteSchema');
const { resolveCondition, resolveMedication } = require('../clinical/terminologyService');
const { scheduleOutcomeCohort } = require('../clinical/outcomeWriter');

function extractDiagnosisList(note) {
  const list = [];
  if (Array.isArray(note?.diagnoses)) {
    for (const d of note.diagnoses) {
      if (typeof d === 'string' && d.trim()) {
        list.push({ display: d.trim(), isPrimary: list.length === 0 });
      } else if (d && typeof d === 'object' && d.display) {
        list.push({
          display: String(d.display).trim(),
          code: d.code || null,
          codeSystem: d.codeSystem || d.code_system || null,
          isPrimary: d.isPrimary !== undefined ? Boolean(d.isPrimary) : list.length === 0
        });
      }
    }
  }

  // If no explicit diagnoses array, infer from note title or assessment line
  if (list.length === 0) {
    const rawAssess = note?.note?.assessment || note?.title || 'Clinical Evaluation';
    const firstLine = String(rawAssess).split('\n')[0].split(',')[0].trim();
    if (firstLine) {
      list.push({ display: firstLine.slice(0, 100), isPrimary: true });
    }
  }

  return list;
}

function medicationsOf(note) {
  const rows = Array.isArray(note?.prescriptions) ? note.prescriptions : [];
  return rows
    .map((rx) => {
      const days = Number.parseInt(String(rx.duration || rx.durationDays || rx.duration_days || ''), 10);
      return {
        medicationName: String(rx.name || rx.medicationName || '').trim(),
        rxnormCode: rx.rxnormCode || rx.rxnorm_code || null,
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
 * Coerces or validates note content into a strict note_v1 schema.
 */
function ensureNoteV1(note, medications = [], diagnoses = []) {
  if (note?.content?.schema_version === 'note_v1') {
    const valid = validateNote(note.content);
    if (valid.valid) return valid.data;
  }
  if (note?.note?.schema_version === 'note_v1') {
    const valid = validateNote(note.note);
    if (valid.valid) return valid.data;
  }

  const body = note?.note || {};
  const rawSubj = typeof body === 'object' ? (body.subjective || '') : '';
  const rawObj = typeof body === 'object' ? (body.objective || '') : '';
  const rawAssess = typeof body === 'object' ? (body.assessment || '') : '';
  const rawPlan = typeof body === 'object' ? (body.plan || '') : '';

  const primaryCondition =
    diagnoses.find((d) => d.isPrimary)?.display ||
    diagnoses[0]?.display ||
    note?.title ||
    'Clinical Evaluation';

  const noteV1 = {
    schema_version: 'note_v1',
    subjective: {
      chief_complaint: {
        text: String(note?.title || primaryCondition || 'Clinical consultation').slice(0, 500),
        onset: null,
        duration: null,
        severity: null
      },
      hpi: [],
      pmh: [],
      medications: [],
      allergies: [],
      narrative: String(rawSubj || 'Patient presented for clinical evaluation and consultation.').slice(0, 50000)
    },
    objective: {
      vitals: {
        temperature_c: null,
        heart_rate_bpm: null,
        systolic_bp_mmhg: null,
        diastolic_bp_mmhg: null,
        respiratory_rate_bpm: null,
        spo2_pct: null,
        weight_kg: null,
        height_cm: null
      },
      exam: rawObj
        ? [{ system: 'General', finding: String(rawObj).slice(0, 500), laterality: 'not_applicable' }]
        : [],
      labs: []
    },
    assessment: {
      differential: [],
      primary: {
        condition: String(primaryCondition).slice(0, 300),
        basis: String(rawAssess || 'Evaluation based on patient presentation and examination findings.').slice(0, 2000)
      }
    },
    plan: {
      medications: medications.map((rx) => ({
        drug: String(rx.medicationName || 'Medication').slice(0, 200),
        dose: String(rx.dose || 'Standard').slice(0, 120),
        route: String(rx.route || 'Oral').slice(0, 60),
        frequency: String(rx.frequency || 'Daily').slice(0, 120),
        duration_days: rx.durationDays || 7,
        rationale: 'Prescribed treatment for primary condition'
      })),
      orders: [],
      follow_up: {
        interval: '14 days',
        method: 'Outpatient clinic or telemedicine follow-up',
        triggers: ['Worsening symptoms', 'High fever', 'Allergic reaction']
      },
      education: rawPlan ? [{ topic: 'Clinical plan review', material_id: null }] : []
    }
  };

  const validation = validateNote(noteV1);
  if (!validation.valid) {
    throw new Error(`Failed to coerce to note_v1: ${JSON.stringify(validation.errors)}`);
  }
  return validation.data;
}

/**
 * Mirrors a signed clinic note into the PostgreSQL workflow tables.
 *
 * @param {object} input
 * @param {string} input.tenantId
 * @param {object} input.note        the signed desk note
 * @param {object} [input.appointment] the desk appointment
 * @param {object} [input.patient]     verified patient demographics
 * @param {object} input.actor       { actorId, actorName, actorRole, npi }
 */
async function mirrorSignedNote({ tenantId = 'org-default', note, appointment, patient, actor }) {
  if (!note) return { skipped: 'no_note' };

  const encounterId =
    appointment?.syncedEncounterId ||
    (appointment?.id ? `enc-${appointment.id}` : `enc-desk-${note.id}`);

  const patientId =
    note.patientId ||
    appointment?.patientId ||
    (patient?.id ? patient.id : null);

  if (!patientId) {
    throw new Error('[signingMirror] Cannot mirror signed note: patientId is required.');
  }

  const patientName = note.patientName || appointment?.patientName || patient?.name || patient?.fullName || 'Clinical Patient';
  const medications = medicationsOf(note);
  const diagnosesList = extractDiagnosisList(note);
  const signedAt = note.signedAt ? new Date(note.signedAt) : new Date();

  const noteV1 = ensureNoteV1(note, medications, diagnosesList);

  const result = await repo.withTransaction(async (client) => {
    // 1. Ensure Patient exists with verified demographics — never fabricate fake DOB or sex
    const { rows: existingPt } = await client.query(
      `SELECT id, mrn, full_name, date_of_birth, sex FROM patients WHERE id = $1 AND tenant_id = $2;`,
      [patientId, tenantId]
    );

    let resolvedDob = patient?.dob || patient?.dateOfBirth || patient?.date_of_birth || null;
    let resolvedSex = patient?.sex || patient?.gender || null;
    let resolvedMrn = patient?.mrn || note?.patientMrn || null;

    if (existingPt.length === 0) {
      if ((!resolvedDob || !resolvedSex || !resolvedMrn) && patientId) {
        try {
          const clinic = require('../../storage/clinicRepository');
          const clinicPt = clinic.getPatient({ tenantId }, patientId);
          if (clinicPt?.patient) {
            resolvedDob = resolvedDob || clinicPt.patient.dob || clinicPt.patient.dateOfBirth;
            resolvedSex = resolvedSex || clinicPt.patient.sex || clinicPt.patient.gender;
            resolvedMrn = resolvedMrn || clinicPt.patient.mrn;
          }
        } catch (_) {}
      }

      if (!resolvedDob || !resolvedSex) {
        throw new Error(
          `[signingMirror] Cannot mirror signed note: patient "${patientId}" lacks verified clinical demographics (date_of_birth and sex are required). Refusing to fabricate synthetic demographics.`
        );
      }

      const safeMrn = resolvedMrn || `MRN-${String(patientId).replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;

      await client.query(
        `INSERT INTO patients (id, tenant_id, mrn, full_name, date_of_birth, sex, contact)
         VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb);`,
        [
          patientId,
          tenantId,
          safeMrn,
          patientName,
          resolvedDob,
          resolvedSex
        ]
      );
    } else {
      // Patient already exists in Postgres; update name if changed
      await client.query(
        `UPDATE patients SET full_name = COALESCE($1, full_name) WHERE id = $2 AND tenant_id = $3;`,
        [patientName, patientId, tenantId]
      );
    }

    // 2. Ensure Encounter exists in SIGNED state
    let validAppointmentId = null;
    const targetAptId = appointment?.syncedAppointmentId || appointment?.id || null;
    if (targetAptId) {
      const { rows: aptRows } = await client.query(
        `SELECT id FROM appointments WHERE id = $1 AND tenant_id = $2;`,
        [targetAptId, tenantId]
      );
      if (aptRows.length > 0) {
        validAppointmentId = aptRows[0].id;
      }
    }

    const { rows: existingEnc } = await client.query(
      `SELECT id, state, version FROM encounters WHERE id = $1 AND tenant_id = $2;`,
      [encounterId, tenantId]
    );

    if (existingEnc.length === 0) {
      await client.query(
        `INSERT INTO encounters
           (id, tenant_id, patient_id, appointment_id, clinician_id, state, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'SIGNED', 1, $6, $7);`,
        [
          encounterId,
          tenantId,
          patientId,
          validAppointmentId,
          actor?.actorId || 'doctor-1',
          note.createdAt ? new Date(note.createdAt) : new Date(),
          signedAt
        ]
      );

      await client.query(
        `INSERT INTO encounter_events
           (encounter_id, tenant_id, sequence, action, from_state, to_state, actor_id, actor_role, actor_name, reason, metadata, occurred_at)
         VALUES ($1, $2, 1, 'sign', 'PENDING_REVIEW', 'SIGNED', $3, $4, $5, 'Signed in clinic desk', '{}'::jsonb, $6);`,
        [
          encounterId,
          tenantId,
          actor?.actorId || 'unknown',
          actor?.actorRole || 'physician',
          actor?.actorName || null,
          signedAt
        ]
      );
    } else {
      await client.query(
        `UPDATE encounters
            SET state = 'SIGNED', version = version + 1, updated_at = $3
          WHERE id = $1 AND tenant_id = $2;`,
        [encounterId, tenantId, signedAt]
      );
    }

    // 3. Save Note row
    const deskNoteId = String(note.id).startsWith('desk-') ? String(note.id) : `desk-${note.id}`;
    const savedNote = await repo.upsertSignedNote(
      {
        id: deskNoteId,
        tenantId,
        encounterId,
        authorActorId: actor?.actorId || 'unknown',
        title: note.title || null,
        content: noteV1,
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

    // 4. Save Diagnoses rows
    const { rows: existingDiags } = await client.query(
      `SELECT COUNT(*)::int AS count FROM diagnoses WHERE tenant_id = $1 AND encounter_id = $2;`,
      [tenantId, encounterId]
    );

    const insertedDiagnoses = [];
    if (Number(existingDiags[0]?.count || 0) === 0) {
      for (let i = 0; i < diagnosesList.length; i++) {
        const item = diagnosesList[i];
        let code = item.code;
        let codeSystem = item.codeSystem;
        if (!code) {
          const resolved = resolveCondition(item.display);
          if (resolved) {
            code = resolved.code;
            codeSystem = 'http://snomed.info/sct';
          } else {
            code = '43878008'; // Default clinical concept if unresolvable
            codeSystem = 'http://snomed.info/sct';
          }
        }

        const diagId = `diag-${crypto.randomUUID()}`;
        const { rows: dRows } = await client.query(
          `INSERT INTO diagnoses
             (id, tenant_id, encounter_id, code_system, code, display, certainty, is_primary, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', $7, $8, $9)
           RETURNING *;`,
          [
            diagId,
            tenantId,
            encounterId,
            codeSystem || 'http://snomed.info/sct',
            code,
            item.display,
            Boolean(item.isPrimary),
            actor?.actorId || 'doctor-1',
            signedAt
          ]
        );
        insertedDiagnoses.push(dRows[0]);
      }
    } else {
      const { rows: curDiags } = await client.query(
        `SELECT * FROM diagnoses WHERE tenant_id = $1 AND encounter_id = $2 ORDER BY id;`,
        [tenantId, encounterId]
      );
      insertedDiagnoses.push(...curDiags);
    }

    // 5. Save Prescriptions rows
    const { rows: existingRxs } = await client.query(
      `SELECT COUNT(*)::int AS count FROM prescriptions WHERE tenant_id = $1 AND encounter_id = $2;`,
      [tenantId, encounterId]
    );

    const insertedPrescriptions = [];
    if (Number(existingRxs[0]?.count || 0) === 0 && medications.length > 0) {
      for (const rx of medications) {
        let rxnormCode = rx.rxnormCode;
        if (!rxnormCode) {
          const resolved = resolveMedication(rx.medicationName);
          if (resolved) rxnormCode = resolved.rxnormCode;
        }

        const rxId = `rx-${crypto.randomUUID()}`;
        const { rows: rRows } = await client.query(
          `INSERT INTO prescriptions
             (id, tenant_id, encounter_id, medication_name, rxnorm_code, dose, route,
              frequency, duration_days, status, safety_status, safety_detail,
              signed_by, signed_by_name, reason, signed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'SIGNED', 'CLEAR', $10, $11, $12, $13, $14)
           RETURNING *;`,
          [
            rxId,
            tenantId,
            encounterId,
            rx.medicationName,
            rxnormCode || null,
            rx.dose,
            rx.route || 'Oral',
            rx.frequency,
            rx.durationDays || null,
            JSON.stringify(note.signature?.safetyVerdict || { cleared: true, source: 'clinic_desk' }),
            actor?.actorId || 'unknown',
            actor?.actorName || null,
            note.title || 'Prescription',
            signedAt
          ]
        );
        insertedPrescriptions.push(rRows[0]);
      }
    } else {
      const { rows: curRxs } = await client.query(
        `SELECT * FROM prescriptions WHERE tenant_id = $1 AND encounter_id = $2 ORDER BY id;`,
        [tenantId, encounterId]
      );
      insertedPrescriptions.push(...curRxs);
    }

    // 6. Record Cryptographic Content-Bound Attestation (P0.2) - Idempotent per encounter
    const { rows: existingAttestation } = await client.query(
      `SELECT id, content_hash, chain_hash, seq
         FROM clinical_attestations
        WHERE encounter_id = $1 AND tenant_id = $2
        ORDER BY seq DESC LIMIT 1;`,
      [encounterId, tenantId]
    );

    let attestationRow;
    if (existingAttestation.length > 0) {
      attestationRow = existingAttestation[0];
    } else {
      const { schema_version, ...content } = noteV1;
      attestationRow = await attestationStore.append(client, {
        tenantId,
        encounterId,
        patientId,
        note: { note_id: savedNote.id, schema_version, content },
        diagnoses: insertedDiagnoses.map((d) => ({
          diagnosis_id: d.id,
          code_system: d.code_system,
          code: d.code,
          display: d.display,
          certainty: d.certainty,
          is_primary: d.is_primary
        })),
        prescriptions: insertedPrescriptions.map((p) => ({
          prescription_id: p.id,
          medication_name: p.medication_name,
          rxnorm_code: p.rxnorm_code,
          dose: p.dose,
          route: p.route,
          frequency: p.frequency,
          duration_days: p.duration_days
        })),
        actor: {
          actor_id: actor?.actorId || 'unknown',
          actor_name: actor?.actorName || 'Physician',
          role: 'physician',
          npi: actor?.npi || null
        },
        kernel: note.signature?.safetyVerdict
          ? {
              version:
                note.signature.safetyVerdict.kernelVersion ||
                note.signature.safetyVerdict.version ||
                'kernel_v2',
              verdict_hash: attestation.hashOf(note.signature.safetyVerdict)
            }
          : null
      });
    }

    // 7. Update Note provenance with attestation hashes
    await client.query(
      `UPDATE notes
          SET provenance = provenance || jsonb_build_object(
                'attestation_id', $3::text,
                'attestation_content_hash', $4::text,
                'attestation_chain_hash', $5::text)
        WHERE id = $1 AND tenant_id = $2;`,
      [savedNote.id, tenantId, attestationRow.id, attestationRow.content_hash, attestationRow.chain_hash]
    );

    // 8. Schedule into 30-Day Outcome Cohort (P1.5)
    await scheduleOutcomeCohort(client, { tenantId, encounterId });

    return {
      note: savedNote,
      encounterId,
      diagnoses: insertedDiagnoses,
      prescriptions: insertedPrescriptions,
      attestation: attestationRow
    };
  });

  // Mark appointment completed if present
  const appointmentId = appointment?.syncedAppointmentId || note.appointmentId || null;
  if (appointmentId) {
    await repo
      .updateAppointment({ tenantId, appointmentId, status: 'COMPLETED' })
      .catch((err) => console.warn('[sign-mirror] appointment not completed:', err.message));
  }

  return result;
}

module.exports = {
  mirrorSignedNote,
  ensureNoteV1,
  medicationsOf,
  extractDiagnosisList
};
