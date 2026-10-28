#!/usr/bin/env node
/**
 * P0.1a — clinic desk backfill, inventory first.
 *
 * Reads the SQLite desk (read-only), maps the clinical trio to the Postgres
 * workflow schema, and prints one of:
 *
 *   --dry-run (default)  the inventory + mapping + warnings, no writes
 *   --apply              the same plan, applied inside one Postgres transaction
 *
 * The clinical trio is clinic_patients, clinic_appointments, clinic_notes.
 * Notifications, invoices, and meta are deliberately out of scope; the
 * inventory still reports them so the boundary is visible.
 *
 * Usage:
 *   node scripts/backfill-clinic-desk.js --db data/proton_ops.db
 *   node scripts/backfill-clinic-desk.js --db data/proton_ops.db --apply
 *
 * `--apply` requires DATABASE_URL and a database that already has the v9
 * migrations. It never writes to SQLite.
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DEFAULT_TENANT = 'org-default';
const DEFAULT_CLINICIAN = 'usr-md-lin-01';

const CLINICAL_TABLES = ['clinic_patients', 'clinic_appointments', 'clinic_notes'];
const OTHER_TABLES = ['clinic_notifications', 'clinic_invoices', 'clinic_meta'];

const PATIENT_COLUMNS = new Set(['id', 'name', 'mrn', 'dob', 'gender', 'createdAt', 'updatedAt']);
const APPOINTMENT_COLUMNS = new Set([
  'id',
  'patientId',
  'date',
  'time',
  'startMinutes',
  'durationMinutes',
  'status',
  'queueCategory',
  'priority',
  'createdAt',
  'updatedAt'
]);
const NOTE_COLUMNS = new Set(['id', 'patientId', 'appointmentId', 'status', 'signedAt', 'title', 'createdAt', 'updatedAt']);

function safeJson(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function asIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseClinicDateTime(date, time) {
  if (!date || !time) return null;
  const match = String(time).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  if (!match[3] || /PM/i.test(match[3])) hours += 12;
  const minutes = Number(match[2]);
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(hours, minutes, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeSex(value) {
  const text = String(value || '').toLowerCase();
  if (['female', 'f'].includes(text)) return 'female';
  if (['male', 'm'].includes(text)) return 'male';
  if (['other', 'nonbinary', 'non-binary'].includes(text)) return 'other';
  return null;
}

const APPOINTMENT_STATUS_ALIASES = {
  SCHEDULED: 'BOOKED',
  IN_ROOM: 'BOOKED',
  IN_CONSULTATION: 'BOOKED',
  READY: 'BOOKED',
  WAITING: 'BOOKED'
};

function normalizeAppointmentStatus(value) {
  const status = String(value || '').toUpperCase();
  if (['BOOKED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(status)) return status;
  if (APPOINTMENT_STATUS_ALIASES[status]) return APPOINTMENT_STATUS_ALIASES[status];
  return 'BOOKED';
}

function normalizeNoteStatus(value) {
  const status = String(value || '').toUpperCase();
  if (['DRAFT', 'PENDING_REVIEW', 'SIGNED', 'AMENDED'].includes(status)) return status;
  return 'DRAFT';
}

function keyDisposition(table, key) {
  if (table === 'clinic_patients') return PATIENT_COLUMNS.has(key) ? 'column' : 'clinical_profile';
  if (table === 'clinic_appointments') return APPOINTMENT_COLUMNS.has(key) ? 'column' : 'metadata';
  if (table === 'clinic_notes') return NOTE_COLUMNS.has(key) ? 'column' : 'content';
  return 'out_of_scope';
}

/**
 * Read-only inventory. Returns per-table row counts, data_json key usage, and
 * the disposition of every key. It never writes.
 */
function inventoryDesk(dbPath) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`SQLite desk not found at ${dbPath}`);
  }

  const db = new DatabaseSync(dbPath, { readOnly: true });
  const report = {
    generatedAt: new Date().toISOString(),
    dbPath,
    tables: {},
    warnings: []
  };

  try {
    for (const table of [...CLINICAL_TABLES, ...OTHER_TABLES]) {
      let rows;
      try {
        rows = db.prepare(`SELECT * FROM ${table}`).all();
      } catch (err) {
        report.tables[table] = { rows: 0, present: false, error: err.message, keys: [] };
        continue;
      }

      const keys = new Map();
      for (const row of rows) {
        if (!row.data_json) continue;
        const data = safeJson(row.data_json);
        for (const [key, value] of Object.entries(data)) {
          if (!keys.has(key)) {
            keys.set(key, { key, count: 0, types: new Set(), disposition: keyDisposition(table, key) });
          }
          const entry = keys.get(key);
          entry.count += 1;
          entry.types.add(Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);
        }
      }

      report.tables[table] = {
        rows: rows.length,
        present: true,
        scope: CLINICAL_TABLES.includes(table) ? 'clinical' : 'out_of_scope',
        keys: [...keys.values()]
          .map((entry) => ({ ...entry, types: [...entry.types] }))
          .sort((a, b) => a.key.localeCompare(b.key))
      };
    }
  } finally {
    db.close();
  }

  return report;
}

function buildPlan(report, dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const plan = { patients: [], appointments: [], notes: [], warnings: [] };

  try {
    const patientRows = db.prepare(`SELECT * FROM clinic_patients`).all();
    for (const row of patientRows) {
      const data = safeJson(row.data_json);
      const tenantId = row.tenant_id || DEFAULT_TENANT;
      const dateOfBirth = asIso(data.dob) ? String(data.dob).slice(0, 10) : null;
      if (!dateOfBirth) plan.warnings.push(`patient ${row.id}: invalid or missing dob`);

      plan.patients.push({
        id: row.id,
        tenantId,
        fullName: row.name || data.name || 'Unknown Patient',
        mrn: row.mrn || data.mrn || null,
        dateOfBirth,
        sex: normalizeSex(data.gender),
        clinicalProfile: data,
        createdAt: asIso(row.created_at) || new Date().toISOString(),
        updatedAt: asIso(row.updated_at) || new Date().toISOString()
      });
    }

    const appointmentRows = db.prepare(`SELECT * FROM clinic_appointments`).all();
    for (const row of appointmentRows) {
      const data = safeJson(row.data_json);
      const tenantId = row.tenant_id || DEFAULT_TENANT;
      const patientId = row.patient_id || data.patientId || null;
      if (!patientId) plan.warnings.push(`appointment ${row.id}: missing patientId; row will be skipped`);

      const scheduledFor =
        parseClinicDateTime(row.date, row.time) ||
        parseClinicDateTime(data.date, data.time) ||
        null;
      if (!scheduledFor) plan.warnings.push(`appointment ${row.id}: could not parse date/time; using created_at`);
      const rawStatus = String(row.status || '').toUpperCase();
      if (
        !['BOOKED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(rawStatus) &&
        !APPOINTMENT_STATUS_ALIASES[rawStatus]
      ) {
        plan.warnings.push(`appointment ${row.id}: status '${row.status}' mapped to BOOKED`);
      }

      plan.appointments.push({
        id: row.id,
        tenantId,
        patientId,
        clinicianId: DEFAULT_CLINICIAN,
        scheduledFor: scheduledFor || asIso(row.created_at) || new Date().toISOString(),
        durationMinutes: Number(row.duration_minutes || data.durationMinutes || 30),
        status: normalizeAppointmentStatus(row.status || data.status),
        queueCategory: row.queue_category || data.queueCategory || null,
        priority: row.priority || data.priority || 'normal',
        metadata: { ...data, backfill_clinician_source: 'default' },
        createdAt: asIso(row.created_at) || new Date().toISOString(),
        updatedAt: asIso(row.updated_at) || new Date().toISOString()
      });
    }

    const noteRows = db.prepare(`SELECT * FROM clinic_notes`).all();
    for (const row of noteRows) {
      const data = safeJson(row.data_json);
      const tenantId = row.tenant_id || DEFAULT_TENANT;
      const patientId = row.patient_id || data.patientId || null;
      if (!patientId) {
        plan.warnings.push(`note ${row.id}: missing patientId; row will be skipped`);
        continue;
      }

      const status = normalizeNoteStatus(row.status || data.status);
      const signedAt = asIso(row.signed_at || data.signedAt);
      const signature = data.signature && typeof data.signature === 'object' ? data.signature : null;
      if (status === 'SIGNED' && !signedAt) plan.warnings.push(`note ${row.id}: SIGNED without signedAt`);
      if (signedAt && !signature) plan.warnings.push(`note ${row.id}: signedAt without signature`);

      plan.notes.push({
        id: row.id,
        tenantId,
        patientId,
        appointmentId: row.appointment_id || data.appointmentId || null,
        encounterId: `enc-legacy-${row.id}`,
        authorActorId: signature?.actorId || DEFAULT_CLINICIAN,
        status,
        content: data,
        provenance: {
          backfilled: true,
          legacy_source: 'clinic_notes',
          signature
        },
        title: data.title || null,
        signedAt,
        createdAt: asIso(row.created_at) || new Date().toISOString(),
        updatedAt: asIso(row.updated_at) || new Date().toISOString()
      });
    }
  } finally {
    db.close();
  }

  return plan;
}

async function applyPlan(client, plan, tenantId = DEFAULT_TENANT) {
  const counts = {
    patients: { inserted: 0, skipped: 0 },
    appointments: { inserted: 0, skipped: 0 },
    encounters: { inserted: 0, skipped: 0 },
    notes: { inserted: 0, skipped: 0 }
  };

  for (const patient of plan.patients) {
    const result = await client.query(
      `INSERT INTO patients
         (id, tenant_id, full_name, mrn, date_of_birth, sex, contact, clinical_profile, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, $7::jsonb, $8, $9)
       ON CONFLICT (id) DO NOTHING
       RETURNING id;`,
      [
        patient.id,
        patient.tenantId || tenantId,
        patient.fullName,
        patient.mrn,
        patient.dateOfBirth,
        patient.sex,
        JSON.stringify(patient.clinicalProfile || {}),
        patient.createdAt,
        patient.updatedAt
      ]
    );
    counts.patients[result.rowCount ? 'inserted' : 'skipped'] += 1;
  }

  for (const appointment of plan.appointments) {
    if (!appointment.patientId) {
      counts.appointments.skipped += 1;
      continue;
    }
    const result = await client.query(
      `INSERT INTO appointments
         (id, tenant_id, patient_id, clinician_id, scheduled_for, duration_minutes, status,
          queue_category, priority, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
       ON CONFLICT (id) DO NOTHING
       RETURNING id;`,
      [
        appointment.id,
        appointment.tenantId || tenantId,
        appointment.patientId,
        appointment.clinicianId,
        appointment.scheduledFor,
        appointment.durationMinutes,
        appointment.status,
        appointment.queueCategory,
        appointment.priority,
        JSON.stringify(appointment.metadata || {}),
        appointment.createdAt,
        appointment.updatedAt
      ]
    );
    counts.appointments[result.rowCount ? 'inserted' : 'skipped'] += 1;
  }

  for (const note of plan.notes) {
    const encounter = await client.query(
      `INSERT INTO encounters
         (id, tenant_id, patient_id, appointment_id, clinician_id, state, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8)
       ON CONFLICT (id) DO NOTHING
       RETURNING id;`,
      [
        note.encounterId,
        note.tenantId || tenantId,
        note.patientId,
        note.appointmentId,
        note.authorActorId,
        note.status === 'SIGNED' ? 'SIGNED' : 'DRAFTED',
        note.createdAt,
        note.updatedAt
      ]
    );
    counts.encounters[encounter.rowCount ? 'inserted' : 'skipped'] += 1;

    const result = await client.query(
      `INSERT INTO notes
         (id, tenant_id, encounter_id, author_actor_id, status, content, provenance,
          signed_by, signed_at, title, legacy_signed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $9, $11, $12)
       ON CONFLICT (id) DO NOTHING
       RETURNING id;`,
      [
        note.id,
        note.tenantId || tenantId,
        note.encounterId,
        note.authorActorId,
        note.status,
        JSON.stringify(note.content || {}),
        JSON.stringify(note.provenance || {}),
        note.provenance?.signature?.actorId || null,
        note.signedAt,
        note.title,
        note.createdAt,
        note.updatedAt
      ]
    );
    counts.notes[result.rowCount ? 'inserted' : 'skipped'] += 1;
  }

  return counts;
}

function printInventory(report) {
  console.log(`\nClinic desk inventory — ${report.dbPath}`);
  console.log(`Generated: ${report.generatedAt}\n`);

  for (const [table, info] of Object.entries(report.tables)) {
    if (!info.present) {
      console.log(`${table}: NOT PRESENT (${info.error})`);
      continue;
    }
    console.log(`${table}: ${info.rows} rows [${info.scope}]`);
    for (const key of info.keys) {
      console.log(`  ${key.key.padEnd(26)} ${String(key.count).padStart(4)}  ${key.types.join('|').padEnd(12)} -> ${key.disposition}`);
    }
    console.log('');
  }

  if (report.warnings.length > 0) {
    console.log('Warnings:');
    for (const warning of report.warnings) console.log(`  - ${warning}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const json = args.includes('--json');
  const dbArgIndex = args.indexOf('--db');
  const dbPath = path.resolve(
    dbArgIndex >= 0 && args[dbArgIndex + 1] ? args[dbArgIndex + 1] : path.join(__dirname, '../data/proton_ops.db')
  );

  const report = inventoryDesk(dbPath);
  const plan = buildPlan(report, dbPath);

  if (json) {
    console.log(JSON.stringify({ report, plan: { counts: {
      patients: plan.patients.length,
      appointments: plan.appointments.length,
      notes: plan.notes.length
    }, warnings: plan.warnings } }, null, 2));
  } else {
    printInventory(report);
    console.log(`Plan: ${plan.patients.length} patients, ${plan.appointments.length} appointments, ${plan.notes.length} notes`);
    if (plan.warnings.length > 0) {
      console.log('\nPlan warnings:');
      for (const warning of plan.warnings) console.log(`  - ${warning}`);
    }
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply and DATABASE_URL to write Postgres.');
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for --apply');
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const counts = await applyPlan(client, plan);
    await client.query('COMMIT');
    console.log('\nApplied:');
    console.log(JSON.stringify(counts, null, 2));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = {
  inventoryDesk,
  buildPlan,
  applyPlan,
  parseClinicDateTime,
  normalizeSex,
  normalizeAppointmentStatus,
  normalizeNoteStatus
};
