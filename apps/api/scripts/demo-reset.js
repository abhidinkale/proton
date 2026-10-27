#!/usr/bin/env node
/**
 * Demo reset — wipes only the seeded demo state, then re-seeds.
 *
 * Scoped to the two `pat-demo-*` identities and the `apt-demo-*` appointments,
 * so a reset is safe even on a database that also holds other synthetic data.
 * The clinic organization and the demo clinician's membership are kept; only
 * sessions, messages and the printed code are replaced.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { getPostgresPool, runPostgresMigrations, closePostgresPool } = require('../storage/postgresDb');
const { seedDemo, DEMO_PATIENTS, TENANT_ID, DEMO_CODE_LABEL } = require('./demo-seed');

async function resetDemo() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset demo data in production.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set; there is nothing to reset.');
  }

  const pool = getPostgresPool();
  await runPostgresMigrations(pool);

  const patientIds = DEMO_PATIENTS.map((patient) => patient.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Deliberately NOT deleting `patient_sessions`: the demo phone signs in once
    // during pre-flight and the 30-day session should survive a reset. Sessions
    // reference `patient_accounts`, which reset keeps, and the one-time codes
    // are invalidated below, so no replay is possible.
    await client.query(
      `DELETE FROM patient_otp_challenges
        WHERE tenant_id = $1
          AND identifier_id IN (
            SELECT id FROM patient_auth_identifiers
             WHERE tenant_id = $1 AND patient_id = ANY($2::text[])
          );`,
      [TENANT_ID, patientIds]
    );
    await client.query(
      `DELETE FROM patient_auth_identifiers WHERE tenant_id = $1 AND patient_id = ANY($2::text[]);`,
      [TENANT_ID, patientIds]
    );
    await client.query(
      `DELETE FROM patient_messages WHERE tenant_id = $1 AND patient_id = ANY($2::text[]);`,
      [TENANT_ID, patientIds]
    );
    await client.query(
      `DELETE FROM appointments WHERE tenant_id = $1 AND patient_id = ANY($2::text[]);`,
      [TENANT_ID, patientIds]
    );
    await client.query(`DELETE FROM patients WHERE tenant_id = $1 AND id = ANY($2::text[]);`, [
      TENANT_ID,
      patientIds
    ]);
    await client.query(`DELETE FROM org_link_codes WHERE org_id = $1 AND label = $2;`, [
      TENANT_ID,
      DEMO_CODE_LABEL
    ]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  return seedDemo();
}

if (require.main === module) {
  resetDemo()
    .then(async (result) => {
      const line = '─'.repeat(68);
      console.log(`\n${line}`);
      console.log('  Demo state reset');
      console.log(line);
      console.log(`  Clinic code       ${result.clinicCode}`);
      console.log(`  Patients          ${DEMO_PATIENTS.map((p) => p.email).join(', ')}`);
      console.log('  The phone keeps its session unless you cleared app data; the queue');
      console.log('  is back to two appointments and one check-in.');
      console.log(`${line}\n`);
      await closePostgresPool();
    })
    .catch(async (err) => {
      console.error('\n✗ Demo reset failed.');
      console.error(`  ${err.message}`);
      await closePostgresPool().catch(() => {});
      process.exit(1);
    });
}

module.exports = { resetDemo };
