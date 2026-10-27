/**
 * Proton Clinic Seed
 *
 * The synthetic evaluation cohort is the starting state for the durable clinic
 * workspace. Once seeded, everything lives in SQLite and is edited through the
 * clinic API — the JSON file is never re-applied over a clinician's changes.
 */

const fs = require('fs');
const path = require('path');

const COHORT_PATH = path.resolve(__dirname, '../../data/clinic-cohort.json');

const QUEUE_BY_PATIENT = {
  'demo-case-1-primary': 'COMPLETED',
  'demo-scenario-b-eleanor': 'IN_CONSULTATION',
  'demo-scenario-d-conflict': 'READY_FOR_REVIEW'
};

const PRIORITY_BY_PATIENT = {
  'demo-scenario-b-eleanor': 'urgent',
  'demo-scenario-a-clara': 'urgent',
  'demo-scenario-c-allergy': 'critical',
  'demo-scenario-d-conflict': 'urgent',
  'demo-scenario-g-wrongpt': 'urgent'
};

const ROOM_BY_INDEX = [
  'Exam Room 101',
  'Exam Room 102',
  'Exam Room 103',
  'Exam Room 104',
  'Telehealth Suite',
  'Exam Room 105',
  'Exam Room 106',
  'Exam Room 107',
  'Exam Room 108',
  'Exam Room 109',
  'Exam Room 110'
];

function parseTimeToMinutes(value) {
  if (typeof value !== 'string') return 9 * 60;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 9 * 60;
  let hours = Number(match[1]) % 12;
  if (!match[3] || /PM/i.test(match[3])) hours += 12;
  return hours * 60 + Number(match[2]);
}

function formatTime(minutes) {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${String(hours12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${suffix}`;
}

function loadCohort() {
  try {
    const parsed = JSON.parse(fs.readFileSync(COHORT_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[clinic] Could not load synthetic cohort seed:', err.message);
    return [];
  }
}

function buildPatients() {
  const cohort = loadCohort();
  const now = new Date().toISOString();
  return cohort.map((patient) => ({
    ...patient,
    status: QUEUE_BY_PATIENT[patient.id] === 'COMPLETED' ? 'completed' : (patient.status || 'ready'),
    createdAt: now,
    updatedAt: now,
    source: 'synthetic_cohort'
  }));
}

function buildAppointments(patients, date) {
  const now = new Date().toISOString();
  return patients.map((patient, index) => {
    const startMinutes = parseTimeToMinutes(patient.time);
    const queueCategory = QUEUE_BY_PATIENT[patient.id] || 'WAITING';
    const priority = PRIORITY_BY_PATIENT[patient.id] || 'normal';
    const isCompleted = queueCategory === 'COMPLETED';
    const isInRoom = queueCategory === 'IN_CONSULTATION';

    return {
      id: `apt-seed-${date}-${patient.id}`,
      patientId: patient.id,
      patientName: patient.name,
      patientAge: patient.age,
      patientGender: patient.gender,
      mrn: patient.mrn,
      date,
      time: formatTime(startMinutes),
      startMinutes,
      durationMinutes: 30,
      appointmentType: /emergency/i.test(patient.visitType || '') ? 'Emergency' : 'Follow-up',
      status: isCompleted ? 'COMPLETED' : isInRoom ? 'IN_ROOM' : 'SCHEDULED',
      queueCategory,
      roomOrVirtual: ROOM_BY_INDEX[index % ROOM_BY_INDEX.length],
      priority,
      chiefComplaint: patient.chiefComplaint,
      criticalAllergies: (patient.allergies || []).filter((allergy) => !/no known/i.test(allergy)),
      assignedDoctorName: 'Dr. Sarah Lin, MD',
      waitTimeMinutes: isCompleted ? 0 : Math.max(2, (index + 1) * 4),
      checkInAt: isCompleted || isInRoom ? new Date().toISOString() : null,
      startedAt: isInRoom || isCompleted ? new Date().toISOString() : null,
      completedAt: isCompleted ? new Date().toISOString() : null,
      source: 'synthetic_cohort',
      createdBy: 'seed',
      createdAt: now,
      updatedAt: now
    };
  });
}

function buildNotifications(patients) {
  const now = Date.now();
  const byId = new Map(patients.map((patient) => [patient.id, patient]));
  const entries = [
    {
      key: 'eleanor-hba1c',
      patientId: 'demo-scenario-b-eleanor',
      type: 'lab',
      severity: 'critical',
      title: 'HbA1c escalation',
      body: 'Hemoglobin A1c rose from 7.1% to 8.2% (+1.1%) with fasting glucose 158 mg/dL. Cardiorenal plan needs review.',
      actionPath: '/consultation?patient=demo-scenario-b-eleanor',
      minutesAgo: 5
    },
    {
      key: 'robert-allergy',
      patientId: 'demo-scenario-c-allergy',
      type: 'allergy',
      severity: 'critical',
      title: 'Allergy hard stop',
      body: 'Amoxicillin draft hard-blocked against documented penicillin anaphylaxis. Physician override rationale required.',
      actionPath: '/consultation?patient=demo-scenario-c-allergy',
      minutesAgo: 18
    },
    {
      key: 'arthur-note',
      patientId: 'demo-scenario-d-conflict',
      type: 'note',
      severity: 'info',
      title: 'Note awaiting sign-off',
      body: 'One encounter note is drafted but unsigned. Nothing reaches the chart until you review and sign.',
      actionPath: '/consultation?patient=demo-scenario-d-conflict',
      minutesAgo: 60
    },
    {
      key: 'clara-exacerbation',
      patientId: 'demo-scenario-a-clara',
      type: 'vitals',
      severity: 'warning',
      title: 'Respiratory exacerbation watch',
      body: 'Peak flow is below the patient’s personal best and rescue inhaler use increased this week.',
      actionPath: '/consultation?patient=demo-scenario-a-clara',
      minutesAgo: 95
    },
    {
      key: 'priya-care-gap',
      patientId: 'demo-scenario-g-wrongpt',
      type: 'care-gap',
      severity: 'warning',
      title: 'Overdue preventive care',
      body: 'Migraine follow-up with no documented blood pressure or preventive screening in the last 12 months.',
      actionPath: '/consultation?patient=demo-scenario-g-wrongpt',
      minutesAgo: 150
    },
    {
      key: 'marcus-missing-allergy',
      patientId: 'demo-scenario-e-missing',
      type: 'data-quality',
      severity: 'warning',
      title: 'Allergy status unrecorded',
      body: 'Allergy documentation is marked NOT_DOCUMENTED. Confirm before prescribing any new medication.',
      actionPath: '/consultation?patient=demo-scenario-e-missing',
      minutesAgo: 210
    }
  ];

  return entries.map((entry) => {
    const patient = byId.get(entry.patientId);
    return {
      id: `ntf-seed-${entry.key}`,
      patientId: entry.patientId,
      patientName: patient?.name || 'Patient',
      type: entry.type,
      severity: entry.severity,
      title: entry.title,
      body: entry.body,
      actionPath: entry.actionPath,
      sourceId: entry.patientId,
      createdAt: new Date(now - entry.minutesAgo * 60 * 1000).toISOString(),
      readAt: null,
      resolvedAt: null
    };
  });
}

function buildNotes(patients, appointments) {
  const now = new Date().toISOString();
  const arthur = patients.find((patient) => patient.id === 'demo-scenario-d-conflict');
  const sarah = patients.find((patient) => patient.id === 'demo-case-1-primary');
  const arthurAppointment = appointments.find((appointment) => appointment.patientId === arthur?.id);
  const sarahAppointment = appointments.find((appointment) => appointment.patientId === sarah?.id);

  const notes = [];

  if (arthur) {
    notes.push({
      id: 'note-seed-arthur-draft',
      patientId: arthur.id,
      patientName: arthur.name,
      appointmentId: arthurAppointment?.id || null,
      status: 'DRAFT',
      template: 'SOAP',
      title: 'Cardiology follow-up — draft',
      note: {
        subjective: arthur.consultationTranscript || arthur.chiefComplaint,
        objective: `Vitals: BP ${arthur.vitals?.bp || '—'}, HR ${arthur.vitals?.hr || '—'}, SpO2 ${arthur.vitals?.spo2 || '—'}. ${arthur.preparationState || ''}`.trim(),
        assessment: (arthur.conditions || []).join('; ') || arthur.chiefComplaint,
        plan: 'Reconcile the outside echocardiogram with the in-house study, continue guideline-directed therapy, and confirm follow-up imaging.'
      },
      diagnoses: arthur.conditions || [],
      prescriptions: [],
      provenance: 'AI DRAFT — REVIEW REQUIRED',
      author: 'Proton Ambient Scribe',
      createdAt: new Date(Date.parse(now) - 62 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.parse(now) - 20 * 60 * 1000).toISOString(),
      signedAt: null,
      signature: null
    });
  }

  if (sarah) {
    notes.push({
      id: 'note-seed-sarah-signed',
      patientId: sarah.id,
      patientName: sarah.name,
      appointmentId: sarahAppointment?.id || null,
      status: 'SIGNED',
      template: 'SOAP',
      title: 'Annual wellness review — signed',
      note: {
        subjective: sarah.consultationTranscript || sarah.chiefComplaint,
        objective: `BP ${sarah.vitals?.bp}, HR ${sarah.vitals?.hr}, BMI ${sarah.vitals?.bmi}. Lipid panel reviewed.`,
        assessment: 'Preventive wellness review. Mild hyperlipidemia stable on lifestyle management.',
        plan: 'Continue lifestyle measures. Repeat lipid panel in 12 months. Return sooner for any new symptoms.'
      },
      diagnoses: sarah.conditions || [],
      prescriptions: [],
      provenance: 'DOCTOR APPROVED',
      author: 'Dr. Sarah Lin, MD',
      createdAt: new Date(Date.parse(now) - 180 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.parse(now) - 150 * 60 * 1000).toISOString(),
      signedAt: new Date(Date.parse(now) - 150 * 60 * 1000).toISOString(),
      signature: {
        actorId: 'usr-md-lin-01',
        actorName: 'Dr. Sarah Lin, MD',
        npi: '1928374650',
        attestation: 'I reviewed the clinical content and attest to its accuracy.',
        method: 'session_signature'
      }
    });
  }

  return notes;
}

module.exports = {
  COHORT_PATH,
  loadCohort,
  buildPatients,
  buildAppointments,
  buildNotifications,
  buildNotes,
  parseTimeToMinutes,
  formatTime
};
