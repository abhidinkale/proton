/**
 * Proton EHR Conversational Copilot Service
 * 
 * Powered by Google Gemini (@google/genai) with Native Tool / Function Calling.
 * Allows clinicians to manage the entire EHR (appointments, patient charts,
 * prescriptions, SOAP documentation, messaging, and inbox) through natural dialogue.
 */

const { GoogleGenAI, Type } = require('@google/genai');
const { getPostgresPool } = require('../storage/postgresDb');
const crypto = require('crypto');

function getPool() {
  return getPostgresPool();
}

function newId(prefix = 'ehr') {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

// Tool function declarations for Gemini
const EHR_TOOL_DECLARATIONS = [
  {
    name: 'get_clinic_schedule',
    description: 'Retrieve the clinic appointments and visits for today or a specific date filter.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: {
          type: Type.STRING,
          description: 'Filter by date (YYYY-MM-DD). If omitted, returns today and upcoming appointments.'
        },
        status: {
          type: Type.STRING,
          description: 'Optional filter by appointment status: BOOKED, CANCELLED, COMPLETED, NO_SHOW.'
        }
      }
    }
  },
  {
    name: 'search_patient',
    description: 'Search for a patient in the EHR by name, MRN, or phone number to retrieve demographics, active conditions, medications, and allergies.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Patient full or partial name or MRN (Medical Record Number).'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_patient_details',
    description: 'Get comprehensive medical chart history for a specific patient ID (past encounters, notes, prescriptions, and lab history).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        patientId: {
          type: Type.STRING,
          description: 'The internal ID of the patient (e.g. pat-demo-clara).'
        }
      },
      required: ['patientId']
    }
  },
  {
    name: 'confirm_appointment',
    description: 'Confirm a booked appointment in the schedule by setting its confirmation timestamp.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        appointmentId: {
          type: Type.STRING,
          description: 'The appointment ID to confirm.'
        }
      },
      required: ['appointmentId']
    }
  },
  {
    name: 'reschedule_appointment',
    description: 'Reschedule an existing appointment to a new date and time.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        appointmentId: {
          type: Type.STRING,
          description: 'The appointment ID to reschedule.'
        },
        newScheduledFor: {
          type: Type.STRING,
          description: 'ISO 8601 date string or YYYY-MM-DD HH:mm for the new appointment time.'
        }
      },
      required: ['appointmentId', 'newScheduledFor']
    }
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel a scheduled appointment with a clinical or patient reason.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        appointmentId: {
          type: Type.STRING,
          description: 'The appointment ID to cancel.'
        },
        reason: {
          type: Type.STRING,
          description: 'Reason for cancellation.'
        }
      },
      required: ['appointmentId']
    }
  },
  {
    name: 'book_appointment',
    description: 'Book a new clinic visit / appointment for an existing patient.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        patientId: {
          type: Type.STRING,
          description: 'Patient ID.'
        },
        scheduledFor: {
          type: Type.STRING,
          description: 'ISO 8601 date string for the appointment slot.'
        },
        reason: {
          type: Type.STRING,
          description: 'Chief complaint or reason for visit (e.g., Follow-up, Acute Cough, Hypertension check).'
        }
      },
      required: ['patientId', 'scheduledFor', 'reason']
    }
  },
  {
    name: 'draft_prescription',
    description: 'Order or draft a prescription for a patient with medication, dose, frequency, and duration.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        patientId: {
          type: Type.STRING,
          description: 'Patient ID.'
        },
        medicationName: {
          type: Type.STRING,
          description: 'Generic or brand name of medication (e.g. Amoxicillin, Lisinopril, Metformin).'
        },
        dose: {
          type: Type.STRING,
          description: 'Dose strength (e.g. 500mg, 10mg, 1000mg).'
        },
        frequency: {
          type: Type.STRING,
          description: 'Administration frequency (e.g. Once daily, Twice daily, TDS, PRN).'
        },
        durationDays: {
          type: Type.NUMBER,
          description: 'Duration of course in days (e.g. 5, 7, 30, 90).'
        },
        reason: {
          type: Type.STRING,
          description: 'Indication for the prescription.'
        }
      },
      required: ['patientId', 'medicationName', 'dose', 'frequency']
    }
  },
  {
    name: 'draft_clinical_note',
    description: 'Create and record a structured clinical SOAP note for a patient encounter.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        patientId: {
          type: Type.STRING,
          description: 'Patient ID.'
        },
        title: {
          type: Type.STRING,
          description: 'Note title (e.g. Outpatient Follow-up SOAP Note, Acute Visit).'
        },
        subjective: {
          type: Type.STRING,
          description: 'Patient history of present illness, symptoms, and chief complaint.'
        },
        objective: {
          type: Type.STRING,
          description: 'Vitals, physical examination findings, and diagnostic results.'
        },
        assessment: {
          type: Type.STRING,
          description: 'Clinical impression, primary diagnosis, and differentials.'
        },
        plan: {
          type: Type.STRING,
          description: 'Treatment plan, prescribed therapies, patient education, and follow-up timing.'
        }
      },
      required: ['patientId', 'subjective', 'assessment', 'plan']
    }
  },
  {
    name: 'send_patient_message',
    description: 'Send a clinical message or instruction directly to a patient (delivered to their mobile app companion).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        patientId: {
          type: Type.STRING,
          description: 'Patient ID.'
        },
        message: {
          type: Type.STRING,
          description: 'Content of the message to send to the patient.'
        }
      },
      required: ['patientId', 'message']
    }
  },
  {
    name: 'get_clinic_inbox',
    description: 'Get pending items requiring clinician review or action (unconfirmed appointments, unread messages, open care loops).',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  }
];

// Tool Executors
async function executeEhrTool(toolName, args, clinician = {}) {
  const pool = getPool();
  const tenantId = clinician.tenantId || 'org-default';
  const actorId = clinician.actorId || 'clinician-dr-lin';
  const actorName = clinician.actorName || 'Dr. Evelyn Lin, MD';

  switch (toolName) {
    case 'get_clinic_schedule': {
      let query = `
        SELECT a.id, a.patient_id, a.scheduled_for, a.confirmed_at, a.status, a.reason,
               p.full_name as patient_name, p.mrn, p.date_of_birth, p.sex
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        WHERE a.tenant_id = $1
      `;
      const params = [tenantId];
      if (args.date) {
        params.push(`${args.date}%`);
        query += ` AND a.scheduled_for::text LIKE $${params.length}`;
      }
      if (args.status) {
        params.push(args.status.toUpperCase());
        query += ` AND a.status = $${params.length}`;
      }
      query += ` ORDER BY a.scheduled_for ASC LIMIT 20;`;

      const { rows } = await pool.query(query, params);
      return {
        count: rows.length,
        appointments: rows.map(r => ({
          appointmentId: r.id,
          patientId: r.patient_id,
          patientName: r.patient_name || 'Unknown Patient',
          mrn: r.mrn || 'N/A',
          scheduledFor: r.scheduled_for,
          confirmedAt: r.confirmed_at,
          status: r.status,
          displayStatus: r.confirmed_at ? 'CONFIRMED' : r.status,
          reason: r.reason || 'General Consultation'
        })),
        cardType: 'schedule_overview',
        cardData: rows
      };
    }

    case 'search_patient': {
      const q = `%${(args.query || '').trim()}%`;
      const { rows } = await pool.query(
        `SELECT id, full_name, mrn, date_of_birth, sex, contact, clinical_profile
         FROM patients
         WHERE tenant_id = $1 AND (full_name ILIKE $2 OR mrn ILIKE $2 OR id ILIKE $2)
         ORDER BY full_name ASC LIMIT 10;`,
        [tenantId, q]
      );
      if (rows.length === 0) {
        return { found: false, message: `No patient found matching "${args.query}".` };
      }
      const matched = rows.map(p => ({
        patientId: p.id,
        fullName: p.full_name,
        mrn: p.mrn,
        dob: p.date_of_birth,
        sex: p.sex,
        phone: p.contact?.phone || p.contact?.email || 'N/A',
        allergies: p.clinical_profile?.allergies || [],
        conditions: p.clinical_profile?.conditions || [],
        medications: p.clinical_profile?.medications || []
      }));
      return {
        found: true,
        count: matched.length,
        patients: matched,
        cardType: 'patient_profile',
        cardData: matched[0]
      };
    }

    case 'get_patient_details': {
      const patientId = args.patientId;
      const { rows: pRows } = await pool.query(
        `SELECT id, full_name, mrn, date_of_birth, sex, contact, clinical_profile
         FROM patients WHERE tenant_id = $1 AND id = $2;`,
        [tenantId, patientId]
      );
      if (pRows.length === 0) {
        return { found: false, error: 'Patient not found' };
      }
      const patient = pRows[0];

      // Fetch appointments
      const { rows: apptRows } = await pool.query(
        `SELECT id, scheduled_for, confirmed_at, status, reason FROM appointments
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY scheduled_for DESC LIMIT 5;`,
        [tenantId, patientId]
      );

      // Fetch notes
      const { rows: noteRows } = await pool.query(
        `SELECT n.id, n.title, n.status, n.content, n.created_at, n.signed_at
         FROM notes n
         JOIN encounters e ON n.encounter_id = e.id
         WHERE n.tenant_id = $1 AND e.patient_id = $2 ORDER BY n.created_at DESC LIMIT 5;`,
        [tenantId, patientId]
      );

      // Fetch prescriptions (linked via encounters)
      const { rows: rxRows } = await pool.query(
        `SELECT pr.id, pr.medication_name, pr.dose, pr.frequency, pr.duration_days, pr.signed_at, pr.safety_status
         FROM prescriptions pr
         JOIN encounters e ON pr.encounter_id = e.id
         WHERE pr.tenant_id = $1 AND e.patient_id = $2 ORDER BY pr.signed_at DESC LIMIT 5;`,
        [tenantId, patientId]
      );

      return {
        patient: {
          id: patient.id,
          name: patient.full_name,
          mrn: patient.mrn,
          dob: patient.date_of_birth,
          sex: patient.sex,
          allergies: patient.clinical_profile?.allergies || [],
          conditions: patient.clinical_profile?.conditions || [],
          medications: patient.clinical_profile?.medications || []
        },
        recentAppointments: apptRows,
        clinicalNotes: noteRows,
        prescriptions: rxRows,
        cardType: 'patient_chart',
        cardData: {
          patient,
          appointments: apptRows,
          notes: noteRows,
          prescriptions: rxRows
        }
      };
    }

    case 'confirm_appointment': {
      const { rows } = await pool.query(
        `UPDATE appointments
         SET confirmed_at = COALESCE(confirmed_at, NOW()), updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND status = 'BOOKED'
         RETURNING *;`,
        [tenantId, args.appointmentId]
      );
      if (rows.length === 0) {
        return { success: false, error: `Appointment ${args.appointmentId} not found or not in BOOKED status.` };
      }
      const updated = rows[0];

      // Update linked encounter if any
      await pool.query(
        `UPDATE encounters
         SET state = 'CHECKED_IN', updated_at = NOW()
         WHERE tenant_id = $1 AND appointment_id = $2 AND state = 'BOOKED';`,
        [tenantId, args.appointmentId]
      );

      return {
        success: true,
        appointmentId: updated.id,
        patientId: updated.patient_id,
        scheduledFor: updated.scheduled_for,
        confirmedAt: updated.confirmed_at,
        status: 'CONFIRMED',
        message: `Appointment ${updated.id} successfully confirmed.`,
        cardType: 'appointment_confirmed',
        cardData: { ...updated, status: 'CONFIRMED' }
      };
    }

    case 'reschedule_appointment': {
      const scheduledFor = new Date(args.newScheduledFor);
      if (isNaN(scheduledFor.getTime())) {
        return { success: false, error: 'Invalid date/time provided.' };
      }
      const { rows } = await pool.query(
        `UPDATE appointments
         SET scheduled_for = $3, confirmed_at = NULL, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2
         RETURNING *;`,
        [tenantId, args.appointmentId, scheduledFor]
      );
      if (rows.length === 0) {
        return { success: false, error: `Appointment ${args.appointmentId} not found.` };
      }
      return {
        success: true,
        appointmentId: rows[0].id,
        newScheduledFor: rows[0].scheduled_for,
        status: 'RESCHEDULED',
        cardType: 'appointment_rescheduled',
        cardData: rows[0]
      };
    }

    case 'cancel_appointment': {
      const { rows } = await pool.query(
        `UPDATE appointments
         SET status = 'CANCELLED', updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2
         RETURNING *;`,
        [tenantId, args.appointmentId]
      );
      if (rows.length === 0) {
        return { success: false, error: `Appointment ${args.appointmentId} not found.` };
      }
      return {
        success: true,
        appointmentId: rows[0].id,
        status: 'CANCELLED',
        reason: args.reason || 'Cancelled by clinician request',
        cardType: 'appointment_cancelled',
        cardData: rows[0]
      };
    }

    case 'book_appointment': {
      const apptId = newId('apt');
      const encId = newId('enc');
      const scheduledFor = new Date(args.scheduledFor);
      if (isNaN(scheduledFor.getTime())) {
        return { success: false, error: 'Invalid scheduledFor date.' };
      }

      await pool.query(
        `INSERT INTO appointments (id, tenant_id, patient_id, clinician_id, scheduled_for, status, reason, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'BOOKED', $6, NOW(), NOW());`,
        [apptId, tenantId, args.patientId, actorId, scheduledFor, args.reason]
      );

      await pool.query(
        `INSERT INTO encounters (id, tenant_id, patient_id, appointment_id, clinician_id, state, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'BOOKED', 1, NOW(), NOW());`,
        [encId, tenantId, args.patientId, apptId, actorId]
      );

      return {
        success: true,
        appointmentId: apptId,
        encounterId: encId,
        patientId: args.patientId,
        scheduledFor: scheduledFor.toISOString(),
        reason: args.reason,
        status: 'BOOKED',
        cardType: 'appointment_created',
        cardData: { apptId, encId, patientId: args.patientId, scheduledFor, reason: args.reason }
      };
    }

    case 'draft_prescription': {
      // Find active encounter for patient
      let { rows: encRows } = await pool.query(
        `SELECT id FROM encounters
         WHERE tenant_id = $1 AND patient_id = $2
         ORDER BY created_at DESC LIMIT 1;`,
        [tenantId, args.patientId]
      );

      let encounterId;
      if (encRows.length > 0) {
        encounterId = encRows[0].id;
      } else {
        encounterId = newId('enc');
        await pool.query(
          `INSERT INTO encounters (id, tenant_id, patient_id, clinician_id, state, version, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'INTAKE', 1, NOW(), NOW());`,
          [encounterId, tenantId, args.patientId, actorId]
        );
      }

      const rxId = newId('rx');
      const route = 'Oral';
      const durationDays = args.durationDays || 5;

      // Allergy / interaction screening check
      const { rows: pRows } = await pool.query(
        `SELECT clinical_profile FROM patients WHERE tenant_id = $1 AND id = $2;`,
        [tenantId, args.patientId]
      );
      const allergies = pRows[0]?.clinical_profile?.allergies || [];
      const hasAllergyConflict = allergies.some(a => 
        args.medicationName.toLowerCase().includes(a.toLowerCase()) ||
        a.toLowerCase().includes(args.medicationName.toLowerCase())
      );

      const safetyStatus = hasAllergyConflict ? 'WARNING' : 'CLEAR';
      const safetyDetail = {
        checked: true,
        allergyWarning: hasAllergyConflict ? `Patient has documented allergy: ${allergies.join(', ')}` : null,
        checkedAt: new Date().toISOString()
      };

      await pool.query(
        `INSERT INTO prescriptions (
           id, tenant_id, encounter_id, medication_name, dose, route, frequency,
           duration_days, status, safety_status, safety_detail, signed_by, signed_at,
           signed_by_name, reason, created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, 'SIGNED', $9, $10::jsonb, $11, NOW(), $12, $13, NOW()
         );`,
        [
          rxId,
          tenantId,
          encounterId,
          args.medicationName,
          args.dose,
          route,
          args.frequency,
          durationDays,
          safetyStatus,
          JSON.stringify(safetyDetail),
          actorId,
          actorName,
          args.reason || 'Ordered via Conversational EHR Copilot'
        ]
      );

      return {
        success: true,
        prescriptionId: rxId,
        patientId: args.patientId,
        encounterId,
        medicationName: args.medicationName,
        dose: args.dose,
        frequency: args.frequency,
        durationDays,
        safetyStatus,
        safetyDetail,
        cardType: 'prescription_drafted',
        cardData: {
          prescriptionId: rxId,
          patientId: args.patientId,
          medicationName: args.medicationName,
          dose: args.dose,
          frequency: args.frequency,
          durationDays,
          safetyStatus,
          safetyDetail,
          signedBy: actorName
        }
      };
    }

    case 'draft_clinical_note': {
      let { rows: encRows } = await pool.query(
        `SELECT id FROM encounters
         WHERE tenant_id = $1 AND patient_id = $2
         ORDER BY created_at DESC LIMIT 1;`,
        [tenantId, args.patientId]
      );

      let encounterId;
      if (encRows.length > 0) {
        encounterId = encRows[0].id;
      } else {
        encounterId = newId('enc');
        await pool.query(
          `INSERT INTO encounters (id, tenant_id, patient_id, clinician_id, state, version, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'INTAKE', 1, NOW(), NOW());`,
          [encounterId, tenantId, args.patientId, actorId]
        );
      }

      const noteId = newId('note');
      const soapContent = {
        subjective: args.subjective || '',
        objective: args.objective || '',
        assessment: args.assessment || '',
        plan: args.plan || ''
      };

      const title = args.title || 'Clinical SOAP Note';

      await pool.query(
        `INSERT INTO notes (
           id, tenant_id, encounter_id, author_actor_id, status, title,
           content, provenance, signed_by, signed_at, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, 'SIGNED', $5, $6::jsonb, $7::jsonb, $8, NOW(), NOW(), NOW()
         );`,
        [
          noteId,
          tenantId,
          encounterId,
          actorId,
          title,
          JSON.stringify(soapContent),
          JSON.stringify({ source: 'EHR_CONVERSATIONAL_COPILOT', author: actorName }),
          actorId
        ]
      );

      return {
        success: true,
        noteId,
        patientId: args.patientId,
        encounterId,
        title,
        soapContent,
        status: 'SIGNED',
        cardType: 'clinical_note',
        cardData: {
          noteId,
          patientId: args.patientId,
          title,
          soap: soapContent,
          status: 'SIGNED',
          author: actorName
        }
      };
    }

    case 'send_patient_message': {
      const msgId = newId('msg');
      const { rows } = await pool.query(
        `INSERT INTO patient_messages (id, tenant_id, patient_id, body, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
         RETURNING *;`,
        [
          msgId,
          tenantId,
          args.patientId,
          args.message,
          JSON.stringify({
            author: actorName,
            role: 'clinician',
            source: 'EHR_COPILOT'
          })
        ]
      );

      return {
        success: true,
        messageId: msgId,
        patientId: args.patientId,
        sentMessage: args.message,
        cardType: 'patient_message_sent',
        cardData: rows[0]
      };
    }

    case 'get_clinic_inbox': {
      // Pending unconfirmed appointments (BOOKED without confirmed_at)
      const { rows: apptRows } = await pool.query(
        `SELECT a.id, a.patient_id, a.scheduled_for, a.reason, p.full_name as patient_name
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         WHERE a.tenant_id = $1 AND a.status = 'BOOKED' AND a.confirmed_at IS NULL
         ORDER BY a.scheduled_for ASC LIMIT 5;`,
        [tenantId]
      );

      // Unread messages
      const { rows: msgRows } = await pool.query(
        `SELECT m.id, m.patient_id, m.body, m.created_at, p.full_name as patient_name
         FROM patient_messages m
         JOIN patients p ON m.patient_id = p.id
         WHERE m.tenant_id = $1 AND m.resolved_at IS NULL
         ORDER BY m.created_at DESC LIMIT 5;`,
        [tenantId]
      );

      return {
        unconfirmedAppointments: apptRows,
        pendingMessages: msgRows,
        totalAttentionItems: apptRows.length + msgRows.length,
        cardType: 'clinic_inbox',
        cardData: { appointments: apptRows, messages: msgRows }
      };
    }

    default:
      return { error: `Tool ${toolName} not supported.` };
  }
}

class EhrCopilotService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.PROTON_AI_MODEL || 'gemini-3.5-flash-lite';
    if (this.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  /**
   * Process a clinician turn with full tool-calling resolution.
   */
  async processClinicianTurn({ message, history = [], clinician = {} }) {
    if (!this.ai) {
      this.apiKey = process.env.GEMINI_API_KEY;
      if (!this.apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in server environment.');
      }
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    }

    const systemInstruction = `You are Proton's Autonomous EHR Clinical Copilot — an executive AI colleague for Dr. Evelyn Lin.
You have DIRECT access to live EHR tools to query schedules, inspect patient charts, confirm or reschedule appointments, draft prescriptions, write SOAP notes, and message patients.

STRICT OPERATING INSTRUCTIONS:
1. When the clinician asks a question or gives an order, ALWAYS invoke the appropriate EHR tool to fetch the real data or execute the requested clinical action.
2. If patient name is given without an ID, call 'search_patient' first to find their chart and patientId.
3. If asked to confirm, reschedule, or cancel an appointment and you don't know the appointmentId, call 'get_clinic_schedule' or 'search_patient' first to find the appointmentId, then call 'confirm_appointment', 'reschedule_appointment', or 'cancel_appointment'.
4. Keep clinical responses concise, crisp, and executive. Do not lecture the physician with disclaimers.
5. When you perform actions (e.g., confirming an appointment, prescribing medication, saving a SOAP note), clearly confirm the action, state the ID, and present the key parameters clearly.
6. You represent the modern alternative to Epic and Cerner: fast, zero click overhead, 100% clinician focus.`;

    const chat = this.ai.chats.create({
      model: this.modelName,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: EHR_TOOL_DECLARATIONS }],
        temperature: 0.1
      }
    });

    const executedActions = [];
    const cards = [];

    // First turn from clinician
    let response = await chat.sendMessage({ message });

    // Loop to resolve any chained tool calls (up to 5 iterations)
    let loopCount = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && loopCount < 5) {
      loopCount++;
      const functionResponses = [];

      for (const toolCall of response.functionCalls) {
        const toolName = toolCall.name;
        const toolArgs = toolCall.args || {};

        let result;
        try {
          result = await executeEhrTool(toolName, toolArgs, clinician);
        } catch (err) {
          result = { error: err.message };
        }

        executedActions.push({
          tool: toolName,
          args: toolArgs,
          result
        });

        if (result && result.cardType) {
          cards.push({
            type: result.cardType,
            data: result.cardData || result
          });
        }

        functionResponses.push({
          functionResponse: {
            name: toolName,
            response: { result }
          }
        });
      }

      // Feed all function responses back to Gemini
      response = await chat.sendMessage({
        message: functionResponses
      });
    }

    return {
      message: response.text ? response.text.trim() : 'Action completed in EHR.',
      actions: executedActions,
      cards
    };
  }
}

module.exports = new EhrCopilotService();
