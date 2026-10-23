/**
 * Shared PostgreSQL harness for workflow test suites.
 *
 * Resolves connection targets from DATABASE_URL so CI only has to provide one
 * variable, creates a throwaway database per suite, and enforces the
 * "never silently skip in CI" policy via REQUIRE_POSTGRES.
 */

const { Client } = require('pg');

function swapDatabase(url, database) {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

function resolveTargets(testDbName) {
  const base = process.env.DATABASE_URL;

  const adminUrl =
    process.env.PROTON_TEST_ADMIN_URL ||
    (base ? swapDatabase(base, 'postgres') : 'postgres://localhost:5432/postgres');

  const testUrl =
    process.env.PROTON_TEST_DATABASE_URL || (base ? swapDatabase(base, testDbName) : `postgres://localhost:5432/${testDbName}`);

  return { adminUrl, testUrl, testDbName };
}

async function canReachPostgres(adminUrl) {
  const client = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

async function recreateTestDatabase({ adminUrl, testDbName }) {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid();`,
      [testDbName]
    );
    await admin.query(`DROP DATABASE IF EXISTS "${testDbName}";`);
    await admin.query(`CREATE DATABASE "${testDbName}";`);
  } finally {
    await admin.end();
  }
}

/**
 * Returns null when the suite should skip (and has already printed why),
 * otherwise a ready-to-use database environment.
 */
async function prepareSuite({ suiteFile, testDbName }) {
  const targets = resolveTargets(testDbName);
  const reachable = await canReachPostgres(targets.adminUrl);

  if (!reachable) {
    const message = `Postgres is not reachable at ${targets.adminUrl}.`;
    if (process.env.REQUIRE_POSTGRES === '1') {
      console.error(`✗ REQUIRED but unavailable: ${message}`);
      console.error('   REQUIRE_POSTGRES=1 means durability tests may not be skipped.');
      process.exit(1);
    }
    console.log(`\n⚠️  SKIP ${suiteFile} — ${message}`);
    console.log('   Start Postgres (brew services start postgresql@16) or set DATABASE_URL.\n');
    return null;
  }

  await recreateTestDatabase(targets);

  // Must be set before the storage layer is required.
  process.env.DATABASE_URL = targets.testUrl;

  return targets;
}

module.exports = { resolveTargets, canReachPostgres, recreateTestDatabase, prepareSuite };
