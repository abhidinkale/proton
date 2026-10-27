#!/usr/bin/env node
/**
 * Demo seed — one command, a clinic with a real closed loop.
 *
 * What it creates (all in PostgreSQL, all in the tenant the demo clinician's
 * login already carries, `org-default`):
 *
 *   - the clinic's organization row and Dr. Lin's owner membership, so clinic
 *     link codes can be issued;
 *   - one long-lived clinic code for the patient app;
 *   - two patients with verified email identifiers;
 *   - two upcoming appointments (one awaiting confirmation, one confirmed) so the
 *     confirm beat has something to act on;
 *   - one completed visit for Clara two days ago, which is what makes the phone
 *     offer a real 48-hour check-in during the demo;
 *   - one refill request waiting in the attention queue, so the severity sort is
 *     visible before the check-in lands above it.
 *
 * It does NOT mint patient sessions into the app: the phone signs in once during
 * pre-flight with the printed code, and the 30-day session survives the demo.
 *
 * Safety: refuses to run in production or without DATABASE_URL. Everything it
 * writes uses a `demo-` id or is scoped to the two demo patients, so resetting
 * cannot touch real records.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { getPostgresPool, runPostgresMigrations, closePostgresPool } = require('../storage/postgresDb');
const patientAccountStore = require('../services/patients/patientAccountStore');
const clinicLinkService = require('../services/organizations/clinicLinkService');

const TENANT_ID = 'org-default';
const DEMO_ORG_SLUG = 'demo-beacon-hill';
const DEMO_CODE_LABEL = 'Demo front desk';

const DEMO_PATIENTS = [
  {
    id: 'pat-demo-clara',
    name: 'Clara Nguyen',
    email: 'clara.nguyen@example.com',
    dateOfBirth: '1989-04-12',
    sex: 'female',
    mrn: 'DEMO-1001'
  },
  {
    id: 'pat-demo-marcus',
    name: 'Marcus Reed',
    email: 'marcus.reed@example.com',
    dateOfBirth: '1967-11-03',
    sex: 'male',
    mrn: 'DEMO-1002'
  }
];

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function guard() {
  if (process.env.NODE_ENV === 'production') {
    console.error('✗ Refusing to seed demo data in production (NODE_ENV=production).');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('✗ DATABASE_URL is not set.');
    console.error('  The demo loop needs PostgreSQL; the API runs in memory without it.');
    console.error('  Add DATABASE_URL to apps/api/.env (for example:');
    console.error('    DATABASE_URL=postgres://localhost:5432/proton_demo');
    console.error('  ), create the database if needed, then run `npm run demo:seed` again.');
    process.exit(1);
  }
}

async function ensureClinic(pool) {
  await pool.query(
    `INSERT INTO org_organizations (id, name, slug, country_code, timezone, status)
     VALUES ($1, $2, $3, 'US', 'UTC', 'active')
     ON CONFLICT (id) DO NOTHING;`,
    [TENANT_ID, 'Beacon Hill Family Health', DEMO_ORG_SLUG]
  );

  // Dr. Lin's demo login already carries `org-default`. Making her an owner here
  // is what lets the console issue a patient code without an on-stage invite
  // dance.
  await pool.query(
    `INSERT INTO org_members (id, org_id, user_id, email, role, status, accepted_at)
     VALUES ('mem-demo-lin', $1, 'usr-md-lin-01', 'dr.lin@proton.health', 'owner', 'active', NOW())
     ON CONFLICT (org_id, lower(email)) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           role = 'owner',
           status = 'active',
           accepted_at = COALESCE(org_members.accepted_at, NOW()),
           updated_at = NOW();`,
    [TENANT_ID]
  );

  const { rows } = await pool.query(`SELECT name FROM org_organizations WHERE id = $1;`, [TENANT_ID]);
  return rows[0]?.name || 'Demo clinic';
}

async function ensurePatient(pool, patient) {
  await patientAccountStore.upsertPatientAccount({
    tenantId: TENANT_ID,
    patientId: patient.id,
    displayName: patient.name
  });

  const identifier = await patientAccountStore.upsertIdentifier({
    tenantId: TENANT_ID,
    channel: 'email',
    identifier: patient.email,
    patientId: patient.id,
    displayName: patient.name
  });

  // Pre-verified: pre-flight login must not depend on a first-time verification
  // path. The patient still receives a one-time code; this only says the clinic
  // already knows the address.
  await pool.query(
    `UPDATE patient_auth_identifiers SET verified_at = COALESCE(verified_at, NOW()) WHERE id = $1;`,
    [identifier.id]
  );

  await pool.query(
    `INSERT INTO patients (id, tenant_id, mrn, full_name, date_of_birth, sex, contact)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           date_of_birth = EXCLUDED.date_of_birth,
           sex = EXCLUDED.sex,
           contact = EXCLUDED.contact,
           updated_at = NOW();`,
    [
      patient.id,
      TENANT_ID,
      patient.mrn,
      patient.name,
      patient.dateOfBirth,
      patient.sex,
      JSON.stringify({ email: patient.email })
    ]
  );
}

async function ensureAppointment(pool, { id, patientId, scheduledFor, reason, confirmed, status = 'BOOKED' }) {
  await pool.query(
    `INSERT INTO appointments
       (id, tenant_id, patient_id, clinician_id, scheduled_for, duration_minutes,
        status, reason, patient_local_id, confirmed_at)
     VALUES ($1, $2, $3, 'usr-md-lin-01', $4, 20, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE
       SET scheduled_for = EXCLUDED.scheduled_for,
           status = CASE
                      WHEN appointments.status = 'CANCELLED' THEN EXCLUDED.status
                      ELSE appointments.status
                    END,
           reason = EXCLUDED.reason,
           confirmed_at = EXCLUDED.confirmed_at,
           updated_at = NOW();`,
    [
      id,
      TENANT_ID,
      patientId,
      scheduledFor,
      status,
      reason,
      // A local id lets the app recognise the appointment it did not create.
      `demo-${id}`,
      confirmed ? new Date().toISOString() : null
    ]
  );
}

/**
 * A refill request is the routine item the critical check-in must sort above.
 * Seeded rather than sent from the phone so the queue is never empty at the
 * start of the demo.
 */
async function ensureRefill(pool) {
  const body = 'Refill request: Lisinopril 10 mg · Beacon Hill Pharmacy';

  await pool.query(
    `INSERT INTO patient_messages
       (id, tenant_id, patient_id, body, metadata, created_at, resolved_at)
     VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '8 minutes', NULL)
     ON CONFLICT (id) DO UPDATE
       SET body = EXCLUDED.body,
           resolved_at = NULL,
           created_at = NOW() - INTERVAL '8 minutes';`,
    [
      'msg-demo-refill',
      TENANT_ID,
      DEMO_PATIENTS[1].id,
      body,
      JSON.stringify({
        direction: 'INBOUND',
        kind: 'REFILL_REQUEST',
        refillId: 'refill-demo-1',
        medicationName: 'Lisinopril',
        pharmacy: 'Beacon Hill Pharmacy',
        requiresTriage: false
      })
    ]
  );
}

async function issueCode() {
  // Retire yesterday's printed code so the demo always shows the current one.
  await getPostgresPool().query(
    `DELETE FROM org_link_codes WHERE org_id = $1 AND label = $2;`,
    [TENANT_ID, DEMO_CODE_LABEL]
  );

  return clinicLinkService.issueLinkCode({
    orgId: TENANT_ID,
    actor: {
      actorId: 'usr-md-lin-01',
      actorName: 'Dr. Sarah Lin, MD',
      tenantId: TENANT_ID,
      actorRole: 'physician'
    },
    label: DEMO_CODE_LABEL,
    maxUses: 500,
    ttlMs: 180 * 24 * 60 * 60 * 1000
  });
}

async function seedDemo() {
  guard();
  const pool = getPostgresPool();
  await runPostgresMigrations(pool);

  const clinicName = await ensureClinic(pool);
  for (const patient of DEMO_PATIENTS) {
    await ensurePatient(pool, patient);
  }

  await ensureAppointment(pool, {
    id: 'apt-demo-clara',
    patientId: DEMO_PATIENTS[0].id,
    scheduledFor: hoursFromNow(2),
    reason: 'Persistent cough',
    confirmed: false
  });
  await ensureAppointment(pool, {
    id: 'apt-demo-marcus',
    patientId: DEMO_PATIENTS[1].id,
    scheduledFor: hoursFromNow(4),
    reason: 'Blood pressure review',
    confirmed: true
  });
  // Two days ago, so the phone's 48-hour follow-up is due now. COMPLETED is the
  // state that turns into "After your last visits" in the app.
  await ensureAppointment(pool, {
    id: 'apt-demo-clara-past',
    patientId: DEMO_PATIENTS[0].id,
    scheduledFor: hoursFromNow(-50),
    reason: 'Cough and fatigue',
    confirmed: true,
    status: 'COMPLETED'
  });

  await ensureRefill(pool);
  const issued = await issueCode();

  return {
    clinicName,
    clinicCode: issued.code,
    expiresAt: issued.linkCode?.expiresAt || null
  };
}

function printSummary({ clinicName, clinicCode, expiresAt }) {
  const line = '─'.repeat(68);
  console.log(`\n${line}`);
  console.log('  Proton demo clinic is ready');
  console.log(line);
  console.log(`  Clinic            ${clinicName}`);
  console.log(`  Clinician login   dr.lin@proton.health / valid_password_2026!`);
  console.log(`  Clinic code       ${clinicCode}`);
  console.log(`  Code expires      ${expiresAt ? new Date(expiresAt).toLocaleString() : 'in 180 days'}`);
  console.log(`  Patients          ${DEMO_PATIENTS.map((p) => p.email).join(', ')}`);
  console.log('');
  console.log('  Next:');
  console.log('   1. Start the API:  npm run dev        (port 3002)');
  console.log('   2. Start the web:  cd ../web && npm run dev   (port 3001)');
  console.log('   3. Open the clinic: http://localhost:3001/care-loop');
  console.log('   4. On the phone, sign in once with the clinic code and a patient email.');
  console.log('      Synthetic mode shows the demo code on screen; email mode sends it.');
  console.log('   5. Rehearse, then `npm run demo:reset` for a clean queue.');
  console.log(`${line}\n`);
}

if (require.main === module) {
  seedDemo()
    .then(async (result) => {
      printSummary(result);
      await closePostgresPool();
    })
    .catch(async (err) => {
      console.error('\n✗ Demo seed failed.');
      console.error(`  ${err.message}`);
      await closePostgresPool().catch(() => {});
      process.exit(1);
    });
}

module.exports = { seedDemo, DEMO_PATIENTS, TENANT_ID, DEMO_CODE_LABEL };
