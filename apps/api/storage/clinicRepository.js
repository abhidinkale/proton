/**
 * Proton Durable Clinic Repository
 *
 * One source of truth for the clinical workspace: patients, appointments,
 * encounter notes, the attention queue, and a SHA-256 hash-chained audit trail.
 * All state is persisted in the existing SQLite database (WAL) so it survives
 * reloads, restarts, and multiple browser tabs.
 */

const crypto = require('crypto');
const { getDatabase } = require('./db');
const seed = require('../services/clinic/clinicSeed');

const DEFAULT_TENANT = 'org-default';
const DEFAULT_ACTOR = {
  id: 'usr-md-lin-01',
  name: 'Dr. Sarah Lin, MD',
  role: 'physician',
  npi: '1928374650',
  tenantId: DEFAULT_TENANT
};

const CLINIC_CAPACITY = 16;

function isoNow() {
  return new Date().toISOString();
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addMinutesToLabel(label, minutes) {
  return seed.formatTime(seed.parseTimeToMinutes(label) + minutes);
}

function normalizeActor(actor) {
  if (!actor) return { ...DEFAULT_ACTOR };
  return {
    id: actor.actorId || actor.id || DEFAULT_ACTOR.id,
    name: actor.actorName || actor.name || DEFAULT_ACTOR.name,
    role: actor.actorRole || actor.role || DEFAULT_ACTOR.role,
    npi: actor.npi || DEFAULT_ACTOR.npi,
    tenantId: actor.tenantId || DEFAULT_TENANT
  };
}

function tenantOf(actor) {
  return normalizeActor(actor).tenantId;
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* Metadata                                                            */
/* ------------------------------------------------------------------ */

function getMeta(key) {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM clinic_meta WHERE key = ?;').get(key);
  return row ? row.value : null;
}

function setMeta(key, value) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO clinic_meta (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
  `).run(key, String(value), isoNow());
}

/* ------------------------------------------------------------------ */
/* Audit trail                                                         */
/* ------------------------------------------------------------------ */

function auditPayload(row) {
  return JSON.stringify({
    tenantId: row.tenantId,
    actorId: row.actorId,
    actorName: row.actorName,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    patientId: row.patientId,
    summary: row.summary,
    at: row.at,
    prevHash: row.prevHash
  });
}

function hashAuditEvent(row) {
  return crypto.createHash('sha256').update(auditPayload(row)).digest('hex');
}

function appendAudit(actor, event) {
  const db = getDatabase();
  const normalized = normalizeActor(actor);
  const previous = db.prepare(`
    SELECT hash FROM clinic_audit_events WHERE tenant_id = ? ORDER BY rowid DESC LIMIT 1;
  `).get(normalized.tenantId);

  const row = {
    id: `aud-${crypto.randomUUID()}`,
    tenantId: normalized.tenantId,
    actorId: normalized.id,
    actorName: normalized.name,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId || null,
    patientId: event.patientId || null,
    summary: event.summary || '',
    at: event.at || isoNow(),
    prevHash: previous?.hash || null
  };
  row.hash = hashAuditEvent(row);

  db.prepare(`
    INSERT INTO clinic_audit_events
      (id, tenant_id, actor_id, actor_name, action, resource_type, resource_id, patient_id, summary, at, prev_hash, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).run(
    row.id, row.tenantId, row.actorId, row.actorName, row.action, row.resourceType,
    row.resourceId, row.patientId, row.summary, row.at, row.prevHash, row.hash
  );

  return row;
}

function listAudit(actor, { limit = 50 } = {}) {
  const db = getDatabase();
  const tenantId = tenantOf(actor);
  return db.prepare(`
    SELECT * FROM clinic_audit_events WHERE tenant_id = ? ORDER BY rowid DESC LIMIT ?;
  `).all(tenantId, Math.min(500, Math.max(1, Number(limit) || 50))).map((row) => ({
    id: row.id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    patientId: row.patient_id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    summary: row.summary,
    at: row.at,
    prevHash: row.prev_hash,
    hash: row.hash
  }));
}

function verifyAudit(actor) {
  const db = getDatabase();
  const tenantId = tenantOf(actor);
  const rows = db.prepare('SELECT * FROM clinic_audit_events WHERE tenant_id = ? ORDER BY rowid ASC;').all(tenantId);

  let expectedPrev = null;
  for (let index = 0; index < rows.length; index += 1) {
    const raw = rows[index];
    const row = {
      tenantId: raw.tenant_id,
      actorId: raw.actor_id,
      actorName: raw.actor_name,
      action: raw.action,
      resourceType: raw.resource_type,
      resourceId: raw.resource_id,
      patientId: raw.patient_id,
      summary: raw.summary,
      at: raw.at,
      prevHash: raw.prev_hash
    };
    const expectedHash = hashAuditEvent(row);
    if ((raw.prev_hash || null) !== expectedPrev || raw.hash !== expectedHash) {
      return {
        valid: false,
        totalEventsVerified: index,
        brokenAt: raw.id,
        headHash: expectedPrev
      };
    }
    expectedPrev = raw.hash;
  }

  return {
    valid: true,
    totalEventsVerified: rows.length,
    headHash: expectedPrev
  };
}

/* ------------------------------------------------------------------ */
/* Seed + rolling schedule                                             */
/* ------------------------------------------------------------------ */

function insertPatientRow(db, patient, tenantId) {
  const now = isoNow();
  db.prepare(`
    INSERT INTO clinic_patients (id, tenant_id, name, mrn, data_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING;
  `).run(patient.id, tenantId, patient.name, patient.mrn || null, JSON.stringify(patient), patient.createdAt || now, now);
}

function insertAppointmentRow(db, appointment, tenantId) {
  const now = isoNow();
  const existing = db.prepare('SELECT id FROM clinic_appointments WHERE id = ?;').get(appointment.id);
  if (existing) {
    db.prepare(`
      UPDATE clinic_appointments SET
        date = ?, time = ?, start_minutes = ?, duration_minutes = ?, status = ?,
        queue_category = ?, priority = ?, data_json = ?, updated_at = ?
      WHERE id = ?;
    `).run(
      appointment.date, appointment.time, appointment.startMinutes, appointment.durationMinutes,
      appointment.status, appointment.queueCategory, appointment.priority,
      JSON.stringify({ ...appointment, updatedAt: now }), now, appointment.id
    );
    return;
  }
  db.prepare(`
    INSERT INTO clinic_appointments
      (id, tenant_id, patient_id, date, time, start_minutes, duration_minutes, status, queue_category, priority, data_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).run(
    appointment.id, tenantId, appointment.patientId, appointment.date, appointment.time,
    appointment.startMinutes, appointment.durationMinutes, appointment.status,
    appointment.queueCategory, appointment.priority, JSON.stringify(appointment),
    appointment.createdAt || now, now
  );
}

function insertNotificationRow(db, notification, tenantId) {
  const existing = db.prepare('SELECT id FROM clinic_notifications WHERE id = ?;').get(notification.id);
  if (existing) return;
  db.prepare(`
    INSERT INTO clinic_notifications
      (id, tenant_id, patient_id, type, severity, title, body, action_path, source_id, created_at, read_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).run(
    notification.id, tenantId, notification.patientId || null, notification.type, notification.severity,
    notification.title, notification.body, notification.actionPath || null, notification.sourceId || null,
    notification.createdAt, notification.readAt || null, notification.resolvedAt || null
  );
}

function ensureSeeded(tenantId = DEFAULT_TENANT) {
  const db = getDatabase();
  if (getMeta('seed_version')) return;

  const patients = seed.buildPatients();
  const today = localDateString();
  const appointments = seed.buildAppointments(patients, today);
  const notifications = seed.buildNotifications(patients);
  const notes = seed.buildNotes(patients, appointments);

  db.exec('BEGIN');
  try {
    for (const patient of patients) insertPatientRow(db, patient, tenantId);

    for (const appointment of appointments) {
      insertAppointmentRow(db, appointment, tenantId);
      if (appointment.status === 'COMPLETED') {
        const patient = patients.find((entry) => entry.id === appointment.patientId);
        if (patient) {
          patient.status = 'completed';
          insertPatientRow(db, patient, tenantId);
          db.prepare('UPDATE clinic_patients SET data_json = ?, updated_at = ? WHERE id = ?;')
            .run(JSON.stringify(patient), isoNow(), patient.id);
        }
      }
    }

    for (const notification of notifications) insertNotificationRow(db, notification, tenantId);

    for (const note of notes) {
      db.prepare(`
        INSERT INTO clinic_notes (id, tenant_id, patient_id, appointment_id, status, data_json, created_at, updated_at, signed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING;
      `).run(
        note.id, tenantId, note.patientId, note.appointmentId, note.status,
        JSON.stringify(note), note.createdAt, note.updatedAt, note.signedAt || null
      );
    }

    setMeta('seed_version', '1');
    setMeta('last_seed_date', today);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  appendAudit({ actorId: 'system', actorName: 'Proton Clinic', role: 'system', tenantId }, {
    action: 'clinic.seeded',
    resourceType: 'Clinic',
    resourceId: tenantId,
    summary: `Seeded ${patients.length} synthetic patients and ${appointments.length} appointments for ${today}.`
  });
}

/**
 * Ensures the demo clinic always has a today schedule. Only runs when the
 * current date has no appointments at all — user-created and user-edited
 * appointments are never overwritten.
 */
function ensureTodaySchedule(tenantId = DEFAULT_TENANT, date = localDateString()) {
  ensureSeeded(tenantId);
  const db = getDatabase();
  const last = getMeta('last_seed_date');
  if (last === date) return;

  const count = db.prepare('SELECT COUNT(*) AS count FROM clinic_appointments WHERE tenant_id = ? AND date = ?;')
    .get(tenantId, date).count;

  if (count === 0) {
    const patients = rawPatients(tenantId);
    const appointments = seed.buildAppointments(patients, date);
    for (const appointment of appointments) insertAppointmentRow(db, appointment, tenantId);

    const notifications = seed.buildNotifications(patients).map((notification) => ({
      ...notification,
      id: `${notification.id}-${date}`,
      createdAt: new Date().toISOString()
    }));
    for (const notification of notifications) insertNotificationRow(db, notification, tenantId);
  }

  setMeta('last_seed_date', date);
}

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

function rawPatients(tenantId = DEFAULT_TENANT) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM clinic_patients WHERE tenant_id = ? ORDER BY name ASC;').all(tenantId).map((row) => ({
    ...parseJson(row.data_json, {}),
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    mrn: row.mrn || parseJson(row.data_json, {})?.mrn || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

function todayAppointmentForPatient(patientId, tenantId, date = localDateString()) {
  const db = getDatabase();
  return db.prepare(`
    SELECT data_json FROM clinic_appointments
    WHERE tenant_id = ? AND patient_id = ? AND date = ?
    ORDER BY start_minutes ASC LIMIT 1;
  `).get(tenantId, patientId, date);
}

function countDraftNotes(patientId, tenantId) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT COUNT(*) AS count FROM clinic_notes WHERE tenant_id = ? AND patient_id = ? AND status = 'DRAFT';
  `).get(tenantId, patientId);
  return row?.count || 0;
}

function patientSummary(patient, tenantId, date = localDateString()) {
  const appointmentRow = todayAppointmentForPatient(patient.id, tenantId, date);
  const appointment = appointmentRow ? parseJson(appointmentRow.data_json, null) : null;
  const criticalAllergies = (patient.allergies || []).filter((allergy) => !/no known/i.test(allergy));
  const hasCriticalAllergy = criticalAllergies.some((allergy) => /anaphyla|penicillin/i.test(allergy));
  const abnormalLabs = (patient.recentLabs || []).filter((lab) => lab.status === 'high' || lab.status === 'low');
  const draftNotes = countDraftNotes(patient.id, tenantId);
  const needsAttention = Boolean(
    appointment?.priority === 'critical' ||
    hasCriticalAllergy ||
    abnormalLabs.length > 0 ||
    draftNotes > 0
  );

  let attentionReason = null;
  if (appointment?.priority === 'critical') attentionReason = 'Critical priority visit';
  else if (hasCriticalAllergy) attentionReason = 'Critical allergy guard';
  else if (abnormalLabs.length > 0) attentionReason = `${abnormalLabs.length} abnormal lab${abnormalLabs.length > 1 ? 's' : ''}`;
  else if (draftNotes > 0) attentionReason = 'Unsigned note';

  return {
    id: patient.id,
    mrn: patient.mrn,
    name: patient.name,
    age: patient.age,
    gender: (patient.gender || 'unknown').toLowerCase(),
    dob: patient.dob || null,
    phone: patient.patientPhone || null,
    chiefComplaint: patient.chiefComplaint,
    visitType: patient.visitType,
    time: appointment?.time || patient.time,
    status: appointment?.queueCategory || (patient.status === 'completed' ? 'COMPLETED' : 'WAITING'),
    appointmentId: appointment?.id || null,
    room: appointment?.roomOrVirtual || null,
    priority: appointment?.priority || (hasCriticalAllergy ? 'critical' : 'normal'),
    criticalAllergies,
    primaryCondition: (patient.conditions || [])[0] || null,
    conditions: patient.conditions || [],
    medications: patient.medications || [],
    vitalsSummary: patient.vitals ? `BP ${patient.vitals.bp} · HR ${patient.vitals.hr}` : null,
    needsAttention,
    attentionReason,
    draftNotes,
    riskScore: hasCriticalAllergy || appointment?.priority === 'critical' ? 'critical' : needsAttention ? 'moderate' : 'low'
  };
}

function listPatients(actor, { query = '', filter = 'all', date = localDateString() } = {}) {
  const tenantId = tenantOf(actor);
  ensureTodaySchedule(tenantId, date);

  let patients = rawPatients(tenantId).map((patient) => patientSummary(patient, tenantId, date));
  const q = String(query || '').trim().toLowerCase();

  if (q) {
    patients = patients.filter((patient) =>
      [patient.name, patient.mrn, patient.chiefComplaint, patient.primaryCondition, ...(patient.conditions || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }

  if (filter === 'urgent') {
    patients = patients.filter((patient) => patient.priority === 'critical' || patient.priority === 'urgent' || patient.needsAttention);
  } else if (filter === 'chronic') {
    patients = patients.filter((patient) => (patient.conditions || []).length > 1);
  } else if (filter === 'drafts') {
    patients = patients.filter((patient) => patient.draftNotes > 0);
  }

  return patients;
}

function getPatient(actor, patientId) {
  const tenantId = tenantOf(actor);
  ensureTodaySchedule(tenantId);
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM clinic_patients WHERE id = ? AND tenant_id = ?;').get(patientId, tenantId);
  if (!row) return null;

  const patient = {
    ...parseJson(row.data_json, {}),
    id: row.id,
    name: row.name,
    mrn: row.mrn,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  const appointments = listAppointments(actor, { patientId, includeCancelled: true });
  const notes = listNotes(actor, { patientId });
  const notifications = listNotifications(actor, { patientId, includeResolved: true });

  return {
    patient,
    summary: patientSummary(patient, tenantId),
    appointments,
    notes,
    notifications
  };
}

function createPatient(actor, input = {}) {
  const normalized = normalizeActor(actor);
  ensureSeeded(normalized.tenantId);
  const db = getDatabase();

  const name = String(input.name || '').trim();
  if (!name) {
    const error = new Error('Patient name is required.');
    error.status = 400;
    error.code = 'PATIENT_NAME_REQUIRED';
    throw error;
  }

  const id = input.id || `pat-${crypto.randomUUID()}`;
  const now = isoNow();
  const age = Number.isFinite(Number(input.age)) && Number(input.age) > 0
    ? Number(input.age)
    : input.dob
      ? Math.max(0, Math.floor((Date.now() - Date.parse(input.dob)) / (365.25 * 24 * 60 * 60 * 1000)))
      : 40;

  const patient = {
    id,
    name,
    age,
    gender: input.gender || 'Other',
    dob: input.dob || null,
    mrn: input.mrn || `MRN-${String(Math.floor(100000 + Math.random() * 899999))}`,
    time: input.time || '09:00 AM',
    visitType: input.visitType || 'New patient consultation',
    status: 'ready',
    preparationState: 'Created from the clinician workspace',
    scenarioKey: null,
    patientPhone: input.phone || null,
    chiefComplaint: input.chiefComplaint || 'New patient evaluation',
    vitals: {
      bp: input.bp || '—',
      hr: input.hr || '—',
      spo2: '—',
      temp: '—',
      bmi: '—'
    },
    allergies: Array.isArray(input.allergies)
      ? input.allergies
      : String(input.allergies || 'No Known Drug Allergies').split(',').map((entry) => entry.trim()).filter(Boolean),
    conditions: input.conditions || [],
    medications: input.medications || [],
    recentLabs: [],
    documents: [],
    encounterId: `enc-${crypto.randomUUID()}`,
    clinicalHistory: input.clinicalHistory || [],
    availableObservations: {},
    missingInformation: [],
    consultationTranscript: '',
    expectedEvidence: [],
    knownRiskConditions: [],
    createdAt: now,
    updatedAt: now,
    source: 'clinician_created',
    createdBy: normalized.id
  };

  insertPatientRow(db, patient, normalized.tenantId);

  appendAudit(normalized, {
    action: 'patient.created',
    resourceType: 'Patient',
    resourceId: patient.id,
    patientId: patient.id,
    summary: `Created patient ${patient.name} (${patient.mrn}).`
  });

  let appointment = null;
  let conflict = null;
  if (input.book !== false) {
    try {
      appointment = createAppointment(normalized, {
        patientId: patient.id,
        date: input.date || localDateString(),
        time: input.time || '09:00 AM',
        durationMinutes: input.durationMinutes || 30,
        appointmentType: input.appointmentType || 'New patient',
        chiefComplaint: patient.chiefComplaint,
        roomOrVirtual: input.roomOrVirtual || 'Exam Room 101',
        priority: input.priority
      });
    } catch (err) {
      if (err.code !== 'APPOINTMENT_CONFLICT') throw err;
      conflict = { message: err.message, appointment: err.conflict || null };
      appendAudit(normalized, {
        action: 'appointment.conflict',
        resourceType: 'Patient',
        resourceId: patient.id,
        patientId: patient.id,
        summary: `Patient ${patient.name} created without a booking: ${err.message}`
      });
    }
  }

  return {
    patient,
    summary: patientSummary(patient, normalized.tenantId),
    appointment,
    conflict
  };
}

function updatePatient(actor, patientId, patch = {}) {
  const normalized = normalizeActor(actor);
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM clinic_patients WHERE id = ? AND tenant_id = ?;').get(patientId, normalized.tenantId);
  if (!row) return null;

  const current = { ...parseJson(row.data_json, {}), id: row.id };
  const allowed = ['name', 'age', 'gender', 'dob', 'mrn', 'patientPhone', 'chiefComplaint', 'visitType', 'allergies', 'conditions', 'medications', 'vitals', 'status'];
  for (const key of allowed) {
    if (patch[key] !== undefined) current[key] = patch[key];
  }
  current.updatedAt = isoNow();

  db.prepare('UPDATE clinic_patients SET name = ?, mrn = ?, data_json = ?, updated_at = ? WHERE id = ? AND tenant_id = ?;')
    .run(current.name, current.mrn || null, JSON.stringify(current), current.updatedAt, patientId, normalized.tenantId);

  appendAudit(normalized, {
    action: 'patient.updated',
    resourceType: 'Patient',
    resourceId: patientId,
    patientId,
    summary: `Updated patient record for ${current.name}.`
  });

  return getPatient(normalized, patientId);
}

/* ------------------------------------------------------------------ */
/* Appointments                                                        */
/* ------------------------------------------------------------------ */

function deserializeAppointment(row) {
  const data = parseJson(row.data_json, {});
  return {
    ...data,
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    time: row.time,
    startMinutes: row.start_minutes,
    durationMinutes: row.duration_minutes,
    status: row.status,
    queueCategory: row.queue_category,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listAppointments(actor, { date = localDateString(), patientId = null, includeCancelled = false, from = null, to = null } = {}) {
  const tenantId = tenantOf(actor);
  if (date || from || to) ensureTodaySchedule(tenantId, date || localDateString());
  const db = getDatabase();

  const clauses = ['tenant_id = ?'];
  const params = [tenantId];
  if (from) {
    clauses.push('date >= ?');
    params.push(from);
  }
  if (to) {
    clauses.push('date <= ?');
    params.push(to);
  }
  if (date && !from && !to) {
    clauses.push('date = ?');
    params.push(date);
  }
  if (patientId) {
    clauses.push('patient_id = ?');
    params.push(patientId);
  }
  if (!includeCancelled) {
    clauses.push("status != 'CANCELLED'");
  }

  return db.prepare(`
    SELECT * FROM clinic_appointments WHERE ${clauses.join(' AND ')} ORDER BY date ASC, start_minutes ASC, time ASC;
  `).all(...params).map(deserializeAppointment);
}

function getAppointment(actor, appointmentId) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM clinic_appointments WHERE id = ? AND tenant_id = ?;')
    .get(appointmentId, tenantOf(actor));
  return row ? deserializeAppointment(row) : null;
}

function findPatient(tenantId, patientId) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM clinic_patients WHERE id = ? AND tenant_id = ?;').get(patientId, tenantId);
  return row ? { ...parseJson(row.data_json, {}), id: row.id, name: row.name, mrn: row.mrn } : null;
}

function createAppointment(actor, input = {}) {
  const normalized = normalizeActor(actor);
  const db = getDatabase();
  const date = input.date || localDateString();

  const patient = findPatient(normalized.tenantId, input.patientId);
  if (!patient) {
    const error = new Error('The selected patient does not exist in this clinic.');
    error.status = 404;
    error.code = 'PATIENT_NOT_FOUND';
    throw error;
  }

  const time = input.time || '09:00 AM';
  const startMinutes = Number.isFinite(Number(input.startMinutes))
    ? Number(input.startMinutes)
    : seed.parseTimeToMinutes(time);
  const durationMinutes = Math.max(10, Math.min(240, Number(input.durationMinutes) || 30));

  if (startMinutes < 6 * 60 || startMinutes > 21 * 60) {
    const error = new Error('Appointments must start between 06:00 and 21:00.');
    error.status = 400;
    error.code = 'INVALID_APPOINTMENT_TIME';
    throw error;
  }

  const existing = db.prepare(`
    SELECT * FROM clinic_appointments
    WHERE tenant_id = ? AND date = ? AND status != 'CANCELLED';
  `).all(normalized.tenantId, date).map(deserializeAppointment);

  const conflict = existing.find((appointment) =>
    startMinutes < appointment.startMinutes + appointment.durationMinutes &&
    startMinutes + durationMinutes > appointment.startMinutes
  );

  if (conflict && input.allowConflict !== true) {
    const error = new Error(`That time overlaps ${conflict.patientName} at ${conflict.time}.`);
    error.status = 409;
    error.code = 'APPOINTMENT_CONFLICT';
    error.conflict = conflict;
    throw error;
  }

  const now = isoNow();
  const appointment = {
    id: `apt-${crypto.randomUUID()}`,
    patientId: patient.id,
    patientName: patient.name,
    patientAge: patient.age,
    patientGender: patient.gender,
    mrn: patient.mrn,
    date,
    time: input.time ? time : seed.formatTime(startMinutes),
    startMinutes,
    durationMinutes,
    appointmentType: input.appointmentType || 'Follow-up',
    status: 'SCHEDULED',
    queueCategory: 'WAITING',
    roomOrVirtual: input.roomOrVirtual || 'Exam Room 101',
    priority: input.priority || ((patient.allergies || []).some((allergy) => /anaphyla/i.test(allergy)) ? 'critical' : 'normal'),
    chiefComplaint: input.chiefComplaint || patient.chiefComplaint,
    criticalAllergies: (patient.allergies || []).filter((allergy) => !/no known/i.test(allergy)),
    assignedDoctorName: normalized.name,
    waitTimeMinutes: 0,
    notes: input.notes || null,
    source: 'clinician_created',
    createdBy: normalized.id,
    createdAt: now,
    updatedAt: now
  };

  insertAppointmentRow(db, appointment, normalized.tenantId);

  appendAudit(normalized, {
    action: 'appointment.created',
    resourceType: 'Appointment',
    resourceId: appointment.id,
    patientId: appointment.patientId,
    summary: `Booked ${appointment.patientName} on ${date} at ${appointment.time}.`
  });

  return appointment;
}

const ALLOWED_QUEUE = new Set(['WAITING', 'IN_CONSULTATION', 'READY_FOR_REVIEW', 'COMPLETED']);

function updateAppointment(actor, appointmentId, patch = {}) {
  const normalized = normalizeActor(actor);
  const current = getAppointment(normalized, appointmentId);
  if (!current) return null;

  const next = { ...current };
  if (patch.time) {
    next.time = patch.time;
    next.startMinutes = seed.parseTimeToMinutes(patch.time);
  }
  if (patch.startMinutes !== undefined) {
    next.startMinutes = Number(patch.startMinutes);
    next.time = seed.formatTime(next.startMinutes);
  }
  if (patch.durationMinutes !== undefined) next.durationMinutes = Math.max(10, Math.min(240, Number(patch.durationMinutes)));
  if (patch.date) next.date = patch.date;
  if (patch.roomOrVirtual) next.roomOrVirtual = patch.roomOrVirtual;
  if (patch.priority) next.priority = patch.priority;
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.chiefComplaint) next.chiefComplaint = patch.chiefComplaint;
  if (patch.appointmentType) next.appointmentType = patch.appointmentType;

  if (patch.queueCategory && ALLOWED_QUEUE.has(patch.queueCategory)) {
    next.queueCategory = patch.queueCategory;
    next.status = patch.queueCategory === 'IN_CONSULTATION'
      ? 'IN_ROOM'
      : patch.queueCategory === 'COMPLETED'
        ? 'COMPLETED'
        : 'SCHEDULED';
  }
  if (patch.status === 'CANCELLED' || patch.status === 'NO_SHOW') {
    next.status = patch.status;
    next.queueCategory = 'CANCELLED';
  }
  if (patch.queueCategory === 'IN_CONSULTATION' && !next.startedAt) next.startedAt = isoNow();
  if (patch.queueCategory === 'COMPLETED') next.completedAt = isoNow();

  next.updatedAt = isoNow();

  const timeChanged = next.date !== current.date || next.startMinutes !== current.startMinutes || next.durationMinutes !== current.durationMinutes;
  if (timeChanged && patch.allowConflict !== true && next.status !== 'CANCELLED') {
    const db = getDatabase();
    const day = db.prepare(`
      SELECT * FROM clinic_appointments
      WHERE tenant_id = ? AND date = ? AND status != 'CANCELLED' AND id != ?;
    `).all(normalized.tenantId, next.date, next.id).map(deserializeAppointment);
    const conflict = day.find((appointment) =>
      next.startMinutes < appointment.startMinutes + appointment.durationMinutes &&
      next.startMinutes + next.durationMinutes > appointment.startMinutes
    );
    if (conflict) {
      const error = new Error(`That time overlaps ${conflict.patientName} at ${conflict.time}.`);
      error.status = 409;
      error.code = 'APPOINTMENT_CONFLICT';
      error.conflict = conflict;
      throw error;
    }
  }

  insertAppointmentRow(getDatabase(), next, normalized.tenantId);

  appendAudit(normalized, {
    action: patch.status === 'CANCELLED' ? 'appointment.cancelled' : 'appointment.updated',
    resourceType: 'Appointment',
    resourceId: next.id,
    patientId: next.patientId,
    summary: patch.status === 'CANCELLED'
      ? `Cancelled ${next.patientName}'s ${next.date} appointment.`
      : `Updated ${next.patientName}'s appointment (${next.queueCategory.replaceAll('_', ' ').toLowerCase()}).`
  });

  return next;
}

function rescheduleAppointment(actor, appointmentId, input = {}) {
  const date = input.date;
  const time = input.time;
  if (!date || !time) {
    const error = new Error('A new date and time are required.');
    error.status = 400;
    error.code = 'RESCHEDULE_FIELDS_REQUIRED';
    throw error;
  }
  return updateAppointment(actor, appointmentId, { date, time, queueCategory: 'WAITING', status: 'SCHEDULED' });
}

/**
 * Real opening-hours availability for a date. Slots are derived from the
 * persisted appointment table, so a slot shown as free is genuinely bookable
 * and a busy slot names the patient occupying it.
 */
function availability(actor, input = {}) {
  const normalized = normalizeActor(actor);
  const date = input.date || localDateString();
  const duration = Math.max(10, Math.min(120, Number(input.durationMinutes) || 30));
  const openMinutes = Number.isFinite(Number(input.openMinutes)) ? Number(input.openMinutes) : 8 * 60;
  const closeMinutes = Number.isFinite(Number(input.closeMinutes)) ? Number(input.closeMinutes) : 17 * 60;
  const step = Math.max(10, Math.min(60, Number(input.stepMinutes) || 30));

  const booked = listAppointments(normalized, { date });

  const slots = [];
  for (let start = openMinutes; start + duration <= closeMinutes; start += step) {
    const conflict = booked.find((appointment) =>
      start < appointment.startMinutes + appointment.durationMinutes &&
      start + duration > appointment.startMinutes
    );
    slots.push({
      startMinutes: start,
      time: seed.formatTime(start),
      durationMinutes: duration,
      available: !conflict,
      appointmentId: conflict?.id || null,
      patientName: conflict?.patientName || null
    });
  }

  return {
    date,
    durationMinutes: duration,
    openMinutes,
    closeMinutes,
    slots,
    availableCount: slots.filter((slot) => slot.available).length,
    bookedCount: slots.filter((slot) => !slot.available).length
  };
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

function deserializeNote(row) {
  const data = parseJson(row.data_json, {});
  return {
    ...data,
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    signedAt: row.signed_at
  };
}

function listNotes(actor, { patientId = null, status = null } = {}) {
  const db = getDatabase();
  const clauses = ['tenant_id = ?'];
  const params = [tenantOf(actor)];
  if (patientId) {
    clauses.push('patient_id = ?');
    params.push(patientId);
  }
  if (status) {
    clauses.push('status = ?');
    params.push(status);
  }
  return db.prepare(`
    SELECT * FROM clinic_notes WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC;
  `).all(...params).map(deserializeNote);
}

function getNote(actor, noteId) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM clinic_notes WHERE id = ? AND tenant_id = ?;').get(noteId, tenantOf(actor));
  return row ? deserializeNote(row) : null;
}

function saveDraft(actor, input = {}) {
  const normalized = normalizeActor(actor);
  const db = getDatabase();
  const now = isoNow();

  if (!input.patientId) {
    const error = new Error('patientId is required to save a draft.');
    error.status = 400;
    error.code = 'PATIENT_ID_REQUIRED';
    throw error;
  }

  const existing = input.id
    ? getNote(normalized, input.id)
    : listNotes(normalized, { patientId: input.patientId, status: 'DRAFT' })[0];

  const note = {
    ...(existing || {}),
    id: existing?.id || `note-${crypto.randomUUID()}`,
    patientId: input.patientId,
    patientName: input.patientName || existing?.patientName || findPatient(normalized.tenantId, input.patientId)?.name || 'Patient',
    appointmentId: input.appointmentId ?? existing?.appointmentId ?? null,
    template: input.template || existing?.template || 'SOAP',
    title: input.title || existing?.title || 'Encounter note',
    note: input.note || existing?.note || { subjective: '', objective: '', assessment: '', plan: '' },
    diagnoses: input.diagnoses || existing?.diagnoses || [],
    prescriptions: input.prescriptions || existing?.prescriptions || [],
    provenance: input.provenance || existing?.provenance || 'AI DRAFT — REVIEW REQUIRED',
    author: existing?.author || normalized.name,
    status: 'DRAFT',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    signedAt: null,
    signature: null
  };

  db.prepare(`
    INSERT INTO clinic_notes (id, tenant_id, patient_id, appointment_id, status, data_json, created_at, updated_at, signed_at)
    VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, NULL)
    ON CONFLICT(id) DO UPDATE SET
      patient_id = excluded.patient_id,
      appointment_id = excluded.appointment_id,
      data_json = excluded.data_json,
      updated_at = excluded.updated_at;
  `).run(note.id, normalized.tenantId, note.patientId, note.appointmentId, JSON.stringify(note), note.createdAt, now);

  appendAudit(normalized, {
    action: 'note.drafted',
    resourceType: 'ClinicalNote',
    resourceId: note.id,
    patientId: note.patientId,
    summary: `Saved a draft note for ${note.patientName}.`
  });

  return note;
}

function signNote(actor, noteId, input = {}) {
  const normalized = normalizeActor(actor);
  const db = getDatabase();

  let note = noteId ? getNote(normalized, noteId) : null;
  if (!note && input.patientId) {
    note = saveDraft(normalized, input);
  }
  if (!note) {
    const error = new Error('The note to sign could not be found.');
    error.status = 404;
    error.code = 'NOTE_NOT_FOUND';
    throw error;
  }
  if (note.status === 'SIGNED') return { note, alreadySigned: true };

  const now = isoNow();
  const signed = {
    ...note,
    ...(input.note ? { note: input.note } : {}),
    ...(input.diagnoses ? { diagnoses: input.diagnoses } : {}),
    ...(input.prescriptions ? { prescriptions: input.prescriptions } : {}),
    status: 'SIGNED',
    provenance: 'DOCTOR APPROVED',
    updatedAt: now,
    signedAt: now,
    signature: {
      actorId: normalized.id,
      actorName: normalized.name,
      npi: normalized.npi,
      role: normalized.role,
      attestation: input.attestation || 'I reviewed the clinical content and attest to its accuracy.',
      method: 'session_signature'
    }
  };

  db.prepare(`
    UPDATE clinic_notes SET status = 'SIGNED', data_json = ?, updated_at = ?, signed_at = ?
    WHERE id = ? AND tenant_id = ?;
  `).run(JSON.stringify(signed), now, now, note.id, normalized.tenantId);

  if (signed.appointmentId) {
    updateAppointment(normalized, signed.appointmentId, { queueCategory: 'COMPLETED' });
  }

  const patientRow = db.prepare('SELECT * FROM clinic_patients WHERE id = ? AND tenant_id = ?;')
    .get(signed.patientId, normalized.tenantId);
  if (patientRow) {
    const patient = { ...parseJson(patientRow.data_json, {}), status: 'completed', updatedAt: now };
    db.prepare('UPDATE clinic_patients SET data_json = ?, updated_at = ? WHERE id = ?;')
      .run(JSON.stringify(patient), now, signed.patientId);
  }

  db.prepare(`
    UPDATE clinic_notifications SET resolved_at = ?
    WHERE tenant_id = ? AND patient_id = ? AND type = 'note' AND resolved_at IS NULL;
  `).run(now, normalized.tenantId, signed.patientId);

  appendAudit(normalized, {
    action: 'note.signed',
    resourceType: 'ClinicalNote',
    resourceId: signed.id,
    patientId: signed.patientId,
    summary: `Signed and committed ${signed.patientName}'s encounter note.`
  });

  return { note: signed, alreadySigned: false };
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

function deserializeNotification(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    body: row.body,
    actionPath: row.action_path,
    sourceId: row.source_id,
    createdAt: row.created_at,
    readAt: row.read_at,
    resolvedAt: row.resolved_at
  };
}

function listNotifications(actor, { unreadOnly = false, includeResolved = false, patientId = null, limit = 20 } = {}) {
  const db = getDatabase();
  const tenantId = tenantOf(actor);
  ensureTodaySchedule(tenantId);

  const clauses = ['tenant_id = ?'];
  const params = [tenantId];
  if (unreadOnly) clauses.push('read_at IS NULL');
  if (!includeResolved) clauses.push('resolved_at IS NULL');
  if (patientId) {
    clauses.push('patient_id = ?');
    params.push(patientId);
  }
  params.push(Math.min(100, Math.max(1, Number(limit) || 20)));

  return db.prepare(`
    SELECT * FROM clinic_notifications WHERE ${clauses.join(' AND ')}
    ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC
    LIMIT ?;
  `).all(...params).map(deserializeNotification);
}

function markNotification(actor, notificationId, action = 'read') {
  const db = getDatabase();
  const tenantId = tenantOf(actor);
  const column = action === 'resolve' ? 'resolved_at' : 'read_at';
  const result = db.prepare(`
    UPDATE clinic_notifications SET ${column} = COALESCE(${column}, ?)
    WHERE id = ? AND tenant_id = ?;
  `).run(isoNow(), notificationId, tenantId);

  if (result.changes === 0) return null;
  const row = db.prepare('SELECT * FROM clinic_notifications WHERE id = ? AND tenant_id = ?;').get(notificationId, tenantId);
  return deserializeNotification(row);
}

function markAllNotificationsRead(actor) {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE clinic_notifications SET read_at = ? WHERE tenant_id = ? AND read_at IS NULL;
  `).run(isoNow(), tenantOf(actor));
  return { updated: Number(result.changes || 0) };
}

function createNotification(actor, input = {}) {
  const normalized = normalizeActor(actor);
  const db = getDatabase();
  const notification = {
    id: `ntf-${crypto.randomUUID()}`,
    patientId: input.patientId || null,
    type: input.type || 'system',
    severity: input.severity || 'info',
    title: input.title || 'Clinic notification',
    body: input.body || '',
    actionPath: input.actionPath || null,
    sourceId: input.sourceId || null,
    createdAt: isoNow(),
    readAt: null,
    resolvedAt: null
  };
  insertNotificationRow(db, notification, normalized.tenantId);
  return notification;
}

/* ------------------------------------------------------------------ */
/* Search + dashboard                                                  */
/* ------------------------------------------------------------------ */

function search(actor, query) {
  const tenantId = tenantOf(actor);
  const q = String(query || '').trim().toLowerCase();
  if (!q) return { patients: [], notes: [], appointments: [], total: 0 };

  const patients = listPatients(actor).filter((patient) =>
    [patient.name, patient.mrn, patient.chiefComplaint, patient.primaryCondition]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q))
  );

  const notes = listNotes(actor).filter((note) => {
    const haystack = [note.title, note.patientName, JSON.stringify(note.note || {})].join(' ').toLowerCase();
    return haystack.includes(q);
  }).slice(0, 10);

  const appointments = listAppointments(actor, { date: null })
    .filter((appointment) => [appointment.patientName, appointment.chiefComplaint, appointment.roomOrVirtual]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)))
    .slice(0, 10);

  return { patients, notes, appointments, total: patients.length + notes.length + appointments.length };
}

function overview(actor, date = localDateString()) {
  const tenantId = tenantOf(actor);
  ensureTodaySchedule(tenantId, date);

  const appointments = listAppointments(actor, { date });
  const notes = listNotes(actor);
  const notifications = listNotifications(actor, { includeResolved: false, limit: 50 });
  const activity = listAudit(actor, { limit: 8 });

  const waiting = appointments.filter((appointment) => appointment.queueCategory === 'WAITING');
  const inRoom = appointments.filter((appointment) => appointment.queueCategory === 'IN_CONSULTATION');
  const review = appointments.filter((appointment) => appointment.queueCategory === 'READY_FOR_REVIEW');
  const completed = appointments.filter((appointment) => appointment.queueCategory === 'COMPLETED');
  const drafts = notes.filter((note) => note.status === 'DRAFT');
  const unresolvedCritical = notifications.filter((notification) => notification.severity === 'critical');
  const avgWait = waiting.length
    ? Math.round(waiting.reduce((sum, appointment) => sum + (appointment.waitTimeMinutes || 0), 0) / waiting.length)
    : 0;

  const nextAppointment = inRoom[0] || waiting[0] || appointments[0] || null;

  return {
    date,
    generatedAt: isoNow(),
    capacity: CLINIC_CAPACITY,
    metrics: {
      scheduled: appointments.length,
      waiting: waiting.length,
      inRoom: inRoom.length,
      toReview: drafts.length + review.length,
      completed: completed.length,
      draftNotes: drafts.length,
      unapprovedWrites: drafts.length,
      safetyIntercepts: unresolvedCritical.length,
      notificationsUnread: notifications.filter((notification) => !notification.readAt).length,
      avgWaitMinutes: avgWait,
      signatureRate: appointments.length ? Math.round((completed.length / appointments.length) * 100) : 100,
      loadPercent: Math.min(100, Math.round((appointments.length / CLINIC_CAPACITY) * 100))
    },
    appointments,
    timeline: appointments.map((appointment) => ({
      id: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      time: appointment.time,
      startMinutes: appointment.startMinutes,
      durationMinutes: appointment.durationMinutes,
      priority: appointment.priority,
      queueCategory: appointment.queueCategory,
      room: appointment.roomOrVirtual
    })),
    nextAppointment,
    attention: notifications.slice(0, 6),
    drafts,
    activity
  };
}

/* ------------------------------------------------------------------ */
/* Workspace preferences                                               */
/* ------------------------------------------------------------------ */

const DEFAULT_PREFERENCES = {
  appearance: 'system',
  density: 'comfortable',
  reduceMotion: false,
  defaultNoteTemplate: 'SOAP',
  showSyntheticBanner: true,
  notificationsEnabled: true
};

function getPreferences(actor) {
  const key = `preferences:${tenantOf(actor)}`;
  const raw = getMeta(key);
  return { ...DEFAULT_PREFERENCES, ...parseJson(raw, {}) };
}

function updatePreferences(actor, patch = {}) {
  const next = { ...getPreferences(actor) };
  for (const key of Object.keys(DEFAULT_PREFERENCES)) {
    if (patch[key] !== undefined) next[key] = patch[key];
  }
  setMeta(`preferences:${tenantOf(actor)}`, JSON.stringify(next));
  return next;
}

/* ------------------------------------------------------------------ */
/* Learning progress                                                   */
/* ------------------------------------------------------------------ */

function educationKey(actor) {
  const normalized = normalizeActor(actor);
  return `education:${tenantOf(normalized)}:${normalized.id || 'shared'}`;
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry)).filter(Boolean))].slice(0, 500);
}

function getEducationProgress(actor) {
  const raw = getMeta(educationKey(actor));
  const stored = parseJson(raw, {});
  return {
    bookmarks: uniqueStrings(stored.bookmarks),
    completed: uniqueStrings(stored.completed),
    claimed: uniqueStrings(stored.claimed)
  };
}

function updateEducationProgress(actor, patch = {}) {
  const current = getEducationProgress(actor);
  const next = {
    bookmarks: patch.bookmarks !== undefined ? uniqueStrings(patch.bookmarks) : current.bookmarks,
    completed: patch.completed !== undefined ? uniqueStrings(patch.completed) : current.completed,
    claimed: patch.claimed !== undefined ? uniqueStrings(patch.claimed) : current.claimed
  };
  setMeta(educationKey(actor), JSON.stringify(next));
  return next;
}

/* ------------------------------------------------------------------ */
/* Billing ledger                                                      */
/* ------------------------------------------------------------------ */

const EM_CODES = {
  new_patient: { code: '99204', description: 'New patient office visit, level 4', amountCents: 32500 },
  annual: { code: '99396', description: 'Preventive medicine re-evaluation, established', amountCents: 28500 },
  emergency: { code: '99285', description: 'Emergency department visit, high complexity', amountCents: 45500 },
  telehealth: { code: '99442', description: 'Telephone E/M, 11–20 minutes', amountCents: 14500 },
  complex: { code: '99215', description: 'Established patient, level 5, high complexity', amountCents: 33500 },
  followup: { code: '99214', description: 'Established patient, level 4', amountCents: 24500 },
  brief: { code: '99213', description: 'Established patient, level 3', amountCents: 17500 }
};

/** Deterministic E/M selection from the recorded visit, not a random ledger. */
function selectEmCode(appointment, patient, note) {
  const type = String(appointment.appointmentType || '').toLowerCase();
  if (appointment.priority === 'critical' || appointment.priority === 'urgent') return EM_CODES.complex;
  if (type.includes('new patient')) return EM_CODES.new_patient;
  if (type.includes('annual') || type.includes('preventive')) return EM_CODES.annual;
  if (type.includes('emergency')) return EM_CODES.emergency;
  if (type.includes('telehealth') || type.includes('virtual')) return EM_CODES.telehealth;
  if (type.includes('consult')) return EM_CODES.complex;
  if (String(note?.template || '').toUpperCase() === 'SOAP' && (patient.conditions || []).length > 1) return EM_CODES.complex;
  if ((patient.conditions || []).length > 2) return EM_CODES.followup;
  return EM_CODES.brief;
}

function deserializeInvoice(row) {
  const data = parseJson(row.data_json, {});
  return {
    ...data,
    id: row.id,
    status: row.status,
    amountCents: row.amount_cents,
    updatedAt: row.updated_at
  };
}

/**
 * Materialize a billing ledger from persisted encounters. Only visits that are
 * finished or carry a signed note are billable; nothing is invented.
 */
function ensureInvoices(actor) {
  const normalized = normalizeActor(actor);
  const db = getDatabase();
  const tenantId = normalized.tenantId;

  const appointments = db.prepare(`
    SELECT * FROM clinic_appointments WHERE tenant_id = ? ORDER BY date ASC, start_minutes ASC;
  `).all(tenantId).map(deserializeAppointment);

  const notes = listNotes(normalized, {});

  for (const appointment of appointments) {
    if (appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW') continue;
    const note = notes.find((entry) => entry.appointmentId === appointment.id && entry.status === 'SIGNED');
    if (appointment.queueCategory !== 'COMPLETED' && appointment.status !== 'COMPLETED' && !note) continue;

    const existing = db.prepare(
      'SELECT id FROM clinic_invoices WHERE tenant_id = ? AND appointment_id = ?;'
    ).get(tenantId, appointment.id);
    if (existing) continue;

    const patientRow = db.prepare(
      'SELECT * FROM clinic_patients WHERE id = ? AND tenant_id = ?;'
    ).get(appointment.patientId, tenantId);
    const patient = patientRow ? parseJson(patientRow.data_json, {}) : {};
    const em = selectEmCode(appointment, patient, note);
    const insuranceEstimate = Math.round(em.amountCents * 0.8);
    const now = isoNow();
    const id = `inv-${appointment.id}`;

    const invoice = {
      id,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      mrn: appointment.mrn,
      date: appointment.date,
      time: appointment.time,
      visitType: appointment.appointmentType,
      cptCode: em.code,
      cptDescription: em.description,
      icd10: note?.diagnoses?.[0] || (patient.conditions || [])[0] || 'Z00.00',
      payer: patient.insurance || patient.payer || 'Self-pay',
      amountCents: em.amountCents,
      insuranceEstimateCents: insuranceEstimate,
      patientResponsibilityCents: em.amountCents - insuranceEstimate,
      status: 'DRAFT',
      noteId: note?.id || null,
      createdAt: now,
      updatedAt: now
    };

    db.prepare(`
      INSERT INTO clinic_invoices (id, tenant_id, appointment_id, patient_id, status, amount_cents, data_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?);
    `).run(id, tenantId, appointment.id, appointment.patientId, em.amountCents, JSON.stringify(invoice), now, now);
  }
}

function listInvoices(actor, { status = null } = {}) {
  const normalized = normalizeActor(actor);
  ensureInvoices(normalized);
  const db = getDatabase();
  const clauses = ['tenant_id = ?'];
  const params = [normalized.tenantId];
  if (status && status !== 'all') {
    clauses.push('status = ?');
    params.push(String(status).toUpperCase());
  }
  const invoices = db.prepare(
    `SELECT * FROM clinic_invoices WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC;`
  ).all(...params).map(deserializeInvoice);

  const totals = invoices.reduce((acc, invoice) => {
    acc.totalCents += invoice.amountCents;
    if (invoice.status === 'PAID') acc.collectedCents += invoice.amountCents;
    else if (invoice.status !== 'VOID') acc.outstandingCents += invoice.amountCents;
    acc[invoice.status.toLowerCase()] = (acc[invoice.status.toLowerCase()] || 0) + 1;
    return acc;
  }, { totalCents: 0, collectedCents: 0, outstandingCents: 0, draft: 0, sent: 0, paid: 0, void: 0 });

  return {
    invoices,
    summary: {
      ...totals,
      invoiceCount: invoices.length,
      byStatus: {
        DRAFT: totals.draft,
        SENT: totals.sent,
        PAID: totals.paid,
        VOID: totals.void
      }
    }
  };
}

function updateInvoiceStatus(actor, invoiceId, status) {
  const normalized = normalizeActor(actor);
  const nextStatus = String(status || '').toUpperCase();
  if (!['DRAFT', 'SENT', 'PAID', 'VOID'].includes(nextStatus)) {
    const error = new Error('Unknown invoice status.');
    error.status = 400;
    error.code = 'INVALID_INVOICE_STATUS';
    throw error;
  }

  const db = getDatabase();
  const row = db.prepare('SELECT * FROM clinic_invoices WHERE id = ? AND tenant_id = ?;')
    .get(invoiceId, normalized.tenantId);
  if (!row) {
    const error = new Error('Invoice not found.');
    error.status = 404;
    error.code = 'INVOICE_NOT_FOUND';
    throw error;
  }

  const invoice = { ...deserializeInvoice(row), status: nextStatus, updatedAt: isoNow() };
  db.prepare('UPDATE clinic_invoices SET status = ?, data_json = ?, updated_at = ? WHERE id = ? AND tenant_id = ?;')
    .run(nextStatus, JSON.stringify(invoice), invoice.updatedAt, invoiceId, normalized.tenantId);

  appendAudit(normalized, {
    action: `invoice.${nextStatus.toLowerCase()}`,
    resourceType: 'Invoice',
    resourceId: invoiceId,
    patientId: invoice.patientId,
    summary: `${nextStatus === 'PAID' ? 'Marked paid' : nextStatus === 'SENT' ? 'Sent to payer' : nextStatus === 'VOID' ? 'Voided' : 'Reopened'} invoice ${invoice.cptCode} for ${invoice.patientName}.`
  });

  return invoice;
}

module.exports = {
  DEFAULT_TENANT,
  DEFAULT_ACTOR,
  normalizeActor,
  localDateString,
  addMinutesToLabel,
  ensureSeeded,
  ensureTodaySchedule,
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  rescheduleAppointment,
  availability,
  listNotes,
  getNote,
  saveDraft,
  signNote,
  listNotifications,
  markNotification,
  markAllNotificationsRead,
  createNotification,
  appendAudit,
  listAudit,
  verifyAudit,
  search,
  overview,
  getPreferences,
  updatePreferences,
  getEducationProgress,
  updateEducationProgress,
  listInvoices,
  updateInvoiceStatus
};
