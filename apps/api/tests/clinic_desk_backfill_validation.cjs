/**
 * P0.1a backfill — inventory and plan, hermetic.
 *
 * Proves the mapping before the Postgres repository exists:
 *   - patients: dob/gender become columns; the rest is preserved in
 *     clinical_profile;
 *   - appointments: date/time become scheduled_for; unknown statuses map to
 *     BOOKED with a warning; the rest is preserved in metadata;
 *   - notes: content is preserved, a legacy encounter id is derived, and a
 *     signed note keeps its legacy timestamp and signature.
 *
 * No Postgres. The apply path is exercised against a scratch database
 * manually; this suite gates the transformation.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const {
  inventoryDesk,
  buildPlan,
  parseClinicDateTime,
  normalizeAppointmentStatus,
  normalizeNoteStatus
} = require('../scripts/backfill-clinic-desk');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    passCount += 1;
    console.log(`✓ [PASS] ${name}`);
  } catch (err) {
    failCount += 1;
    console.error(`✗ [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proton-backfill-'));
const dbPath = path.join(tmpDir, 'desk.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE clinic_patients (
    id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, mrn TEXT, data_json TEXT,
    created_at TEXT, updated_at TEXT
  );
  CREATE TABLE clinic_appointments (
    id TEXT PRIMARY KEY, tenant_id TEXT, patient_id TEXT, date TEXT, time TEXT,
    start_minutes INTEGER, duration_minutes INTEGER, status TEXT, queue_category TEXT,
    priority TEXT, data_json TEXT, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE clinic_notes (
    id TEXT PRIMARY KEY, tenant_id TEXT, patient_id TEXT, appointment_id TEXT,
    status TEXT, data_json TEXT, created_at TEXT, updated_at TEXT, signed_at TEXT
  );
`);

db.prepare(
  'INSERT INTO clinic_patients (id, tenant_id, name, mrn, data_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
).run(
  'pat-1',
  'org-default',
  'Test Patient',
  'MRN-1',
  JSON.stringify({
    id: 'pat-1',
    name: 'Test Patient',
    mrn: 'MRN-1',
    dob: '1980-05-04',
    gender: 'Female',
    allergies: ['Penicillin'],
    medications: ['Metformin'],
    conditions: ['Type 2 diabetes'],
    vitals: { bp: '120/78' }
  }),
  '2026-10-01T00:00:00.000Z',
  '2026-10-01T00:00:00.000Z'
);

db.prepare(
  `INSERT INTO clinic_appointments
     (id, tenant_id, patient_id, date, time, start_minutes, duration_minutes, status,
      queue_category, priority, data_json, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
).run(
  'apt-1',
  'org-default',
  'pat-1',
  '2026-10-28',
  '09:30 AM',
  570,
  20,
  'IN_ROOM',
  'IN_CONSULTATION',
  'urgent',
  JSON.stringify({
    id: 'apt-1',
    patientId: 'pat-1',
    assignedDoctorName: 'Dr. Lin',
    roomOrVirtual: 'Exam Room 101'
  }),
  '2026-10-01T00:00:00.000Z',
  '2026-10-01T00:00:00.000Z'
);

db.prepare(
  `INSERT INTO clinic_notes
     (id, tenant_id, patient_id, appointment_id, status, data_json, created_at, updated_at, signed_at)
   VALUES (?,?,?,?,?,?,?,?,?)`
).run(
  'note-1',
  'org-default',
  'pat-1',
  'apt-1',
  'SIGNED',
  JSON.stringify({
    id: 'note-1',
    patientId: 'pat-1',
    patientName: 'Test Patient',
    title: 'Test note',
    note: { subjective: 'Sore throat', assessment: 'Strep', plan: 'Amoxicillin' },
    diagnoses: ['Strep pharyngitis'],
    prescriptions: [],
    signature: { actorId: 'usr-md-1', actorName: 'Dr. Lin', npi: '123', attestation: 'reviewed' },
    signedAt: '2026-10-28T10:00:00.000Z'
  }),
  '2026-10-28T09:00:00.000Z',
  '2026-10-28T10:00:00.000Z',
  '2026-10-28T10:00:00.000Z'
);

db.close();

const report = inventoryDesk(dbPath);
const plan = buildPlan(report, dbPath);

test('inventory counts and dispositions', () => {
  assert.strictEqual(report.tables.clinic_patients.rows, 1);
  assert.strictEqual(report.tables.clinic_appointments.rows, 1);
  assert.strictEqual(report.tables.clinic_notes.rows, 1);
  const patientKeys = Object.fromEntries(report.tables.clinic_patients.keys.map((k) => [k.key, k.disposition]));
  assert.strictEqual(patientKeys.dob, 'column');
  assert.strictEqual(patientKeys.allergies, 'clinical_profile');
  const noteKeys = Object.fromEntries(report.tables.clinic_notes.keys.map((k) => [k.key, k.disposition]));
  assert.strictEqual(noteKeys.title, 'column');
  assert.strictEqual(noteKeys.note, 'content');
});

test('patient mapping preserves profile and projects dob/sex', () => {
  assert.strictEqual(plan.patients.length, 1);
  const patient = plan.patients[0];
  assert.strictEqual(patient.dateOfBirth, '1980-05-04');
  assert.strictEqual(patient.sex, 'female');
  assert.deepStrictEqual(patient.clinicalProfile.allergies, ['Penicillin']);
  assert.deepStrictEqual(patient.clinicalProfile.medications, ['Metformin']);
});

test('appointment mapping parses date/time and keeps metadata', () => {
  assert.strictEqual(plan.appointments.length, 1);
  const appointment = plan.appointments[0];
  assert.ok(appointment.scheduledFor, 'scheduledFor must be parsed');
  assert.strictEqual(new Date(appointment.scheduledFor).getMinutes(), 30);
  assert.strictEqual(appointment.durationMinutes, 20);
  assert.strictEqual(appointment.status, 'BOOKED');
  assert.strictEqual(appointment.queueCategory, 'IN_CONSULTATION');
  assert.strictEqual(appointment.priority, 'urgent');
  assert.strictEqual(appointment.metadata.roomOrVirtual, 'Exam Room 101');
  assert.strictEqual(appointment.metadata.backfill_clinician_source, 'default');
});

test('note mapping preserves content, signature, and legacy time', () => {
  assert.strictEqual(plan.notes.length, 1);
  const note = plan.notes[0];
  assert.strictEqual(note.encounterId, 'enc-legacy-note-1');
  assert.strictEqual(note.status, 'SIGNED');
  assert.strictEqual(note.title, 'Test note');
  assert.strictEqual(note.signedAt, '2026-10-28T10:00:00.000Z');
  assert.strictEqual(note.provenance.backfilled, true);
  assert.strictEqual(note.provenance.signature.actorId, 'usr-md-1');
  assert.strictEqual(note.content.note.assessment, 'Strep');
});

test('status aliases map quietly; unknown statuses warn', () => {
  assert.strictEqual(normalizeAppointmentStatus('SCHEDULED'), 'BOOKED');
  assert.strictEqual(normalizeAppointmentStatus('IN_ROOM'), 'BOOKED');
  assert.strictEqual(normalizeAppointmentStatus('COMPLETED'), 'COMPLETED');
  assert.strictEqual(normalizeAppointmentStatus('SOMETHING_NEW'), 'BOOKED');
  assert.strictEqual(normalizeNoteStatus('DRAFT'), 'DRAFT');
  assert.strictEqual(normalizeNoteStatus('WEIRD'), 'DRAFT');
});

test('time parser handles AM/PM and rejects malformed input', () => {
  assert.ok(parseClinicDateTime('2026-10-28', '09:30 AM'));
  assert.ok(parseClinicDateTime('2026-10-28', '9:30 PM'));
  assert.strictEqual(parseClinicDateTime('2026-10-28', 'not a time'), null);
  assert.strictEqual(parseClinicDateTime('', '09:30 AM'), null);
});

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
