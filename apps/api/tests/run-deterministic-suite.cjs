#!/usr/bin/env node
/**
 * Proton Deterministic Test Runner
 *
 * Runs every API suite that is hermetic: no network, no API keys, no local model,
 * no running API server. This is the suite CI must gate on.
 *
 * Deliberately excluded (run manually, they require live infrastructure):
 *   - clinical_ai_validation.cjs        live AI provider
 *   - grok_live_validation.cjs          XAI_API_KEY
 *   - medgemma_benchmark.cjs            local MedGemma model
 *   - medgemma_e2e_verification.cjs     running API server
 *   - gemini_live_smoke.cjs             GEMINI_API_KEY
 *   - deepseek_live_smoke.cjs           DEEPSEEK_API_KEY
 *   - milestone4_reality_validation.cjs calls the live Gemini model directly
 *                                       and asserts its provider identity, so it
 *                                       cannot pass in demo mode by design. Run
 *                                       it with a real key before a release:
 *                                         PROTON_AI_MODE=real node tests/milestone4_reality_validation.cjs
 *
 * PostgreSQL-backed suites are listed in REQUIRES_POSTGRES. They create and
 * drop their own throwaway databases. Locally, if Postgres is unreachable they
 * are SKIPPED and reported separately; CI sets REQUIRE_POSTGRES=1, which turns
 * a skip into a failure so durability can never silently go untested.
 *
 * Usage:
 *   node tests/run-deterministic-suite.cjs              # run all
 *   node tests/run-deterministic-suite.cjs --filter=workflow
 *   REQUIRE_POSTGRES=1 node tests/run-deterministic-suite.cjs
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TESTS_DIR = __dirname;

const EXCLUDED = new Set([
  'clinical_ai_validation.cjs',
  'grok_live_validation.cjs',
  'medgemma_benchmark.cjs',
  'medgemma_e2e_verification.cjs',
  'gemini_live_smoke.cjs',
  'deepseek_live_smoke.cjs',
  'milestone4_reality_validation.cjs'
]);

const REQUIRES_POSTGRES = new Set([
  'workflow_state_machine_validation.cjs',
  'workflow_api_validation.cjs',
  'durable_booking_validation.cjs',
  'tenant_isolation_validation.cjs',
  'patient_sync_validation.cjs',
  'patient_documents_validation.cjs',
  'patient_prescriptions_validation.cjs',
  'clinic_live_validation.cjs'
]);

const REQUIRE_POSTGRES = process.env.REQUIRE_POSTGRES === '1';

const filterArg = process.argv.find((arg) => arg.startsWith('--filter='));
const filter = filterArg ? filterArg.split('=')[1] : null;

function probePostgres() {
  const { Client } = require('pg');
  const connectionString =
    process.env.PROTON_TEST_ADMIN_URL || process.env.DATABASE_URL || 'postgres://localhost:5432/postgres';

  return new Promise((resolve) => {
    const client = new Client({ connectionString, connectionTimeoutMillis: 2000 });
    const done = (ok) => client.end().catch(() => {}).then(() => resolve(ok));
    client
      .connect()
      .then(() => client.query('SELECT 1'))
      .then(() => done(true))
      .catch(() => done(false));
  });
}

function discoverSuites() {
  return fs
    .readdirSync(TESTS_DIR)
    .filter((file) => file.endsWith('.cjs') && !file.startsWith('run-'))
    .filter((file) => !EXCLUDED.has(file))
    .filter((file) => (filter ? file.includes(filter) : true))
    .sort();
}

async function main() {
  const suites = discoverSuites();

  if (suites.length === 0) {
    console.error(`No deterministic suites found${filter ? ` matching "${filter}"` : ''}.`);
    process.exit(1);
  }

  const needsPostgres = suites.some((s) => REQUIRES_POSTGRES.has(s));
  const postgresUp = needsPostgres ? await probePostgres() : true;

  if (!postgresUp) {
    const message =
      'PostgreSQL is not reachable. Start it (brew services start postgresql@16) or set DATABASE_URL.';
    if (REQUIRE_POSTGRES) {
      console.error(`\n❌ ${message}\n   REQUIRE_POSTGRES=1 means this suite cannot be skipped.\n`);
      process.exit(1);
    }
    console.log(`\n⚠️  ${message}\n   Durability suites will be SKIPPED (set REQUIRE_POSTGRES=1 to make that fatal).\n`);
  }

  const results = [];

  for (const suite of suites) {
    if (REQUIRES_POSTGRES.has(suite) && !postgresUp) {
      results.push({ suite, outcome: 'skipped', duration: 0 });
      console.log(`\n⏭  ${suite} — SKIPPED (Postgres unavailable)`);
      continue;
    }

    const startedAt = Date.now();
    process.stdout.write(`\n▶ ${suite}\n`);

    const run = spawnSync(process.execPath, [path.join(TESTS_DIR, suite)], {
      cwd: path.join(TESTS_DIR, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        REQUIRE_POSTGRES: REQUIRE_POSTGRES ? '1' : '0',
        // This suite is defined as hermetic: no network, no provider keys. A
        // developer .env with a live GEMINI/DEEPSEEK key would otherwise make
        // these tests call a real model, so a 3s provider timeout becomes a
        // red build. Demo mode is the mode this gate was written against.
        // Live-provider coverage lives in the *_live_smoke suites.
        PROTON_AI_MODE: 'demo',
        // Same reasoning for patient sign-in codes: a developer who has already
        // configured a real provider must not make the gate send email, and the
        // OTP suites rely on the simulated `devCode` to complete a login.
        // otp_email_delivery_validation.cjs sets this per case against a local
        // stub server.
        OTP_DELIVERY: 'simulated'
      },
      encoding: 'utf8',
      timeout: 180_000
    });

    const output = `${run.stdout || ''}${run.stderr || ''}`;
    const duration = Date.now() - startedAt;
    const passed = run.status === 0 && !run.signal;
    const selfSkipped = /⚠️\s+SKIP/.test(output) && passed;

    results.push({
      suite,
      outcome: selfSkipped ? 'skipped' : passed ? 'passed' : 'failed',
      status: run.status,
      signal: run.signal,
      duration
    });

    // Surface the last lines so a failure is actionable in CI logs.
    const tail = output.trim().split('\n').slice(-12).join('\n');
    console.log(tail);

    if (selfSkipped) {
      console.log(`⏭  SKIP ${suite} (${duration}ms)`);
    } else {
      console.log(`${passed ? '✅ PASS' : '❌ FAIL'} ${suite} (${duration}ms)`);
      if (!passed) console.log(`   exit=${run.status} signal=${run.signal}`);
    }
  }

  const failed = results.filter((r) => r.outcome === 'failed');
  const skipped = results.filter((r) => r.outcome === 'skipped');
  const passedCount = results.filter((r) => r.outcome === 'passed').length;

  console.log('\n' + '='.repeat(78));
  console.log(`DETERMINISTIC SUITE: ${passedCount}/${results.length} passed` +
    (skipped.length ? `, ${skipped.length} skipped` : ''));
  if (skipped.length > 0) {
    for (const s of skipped) console.log(`  ~ ${s.suite} (skipped)`);
  }
  if (failed.length > 0) {
    console.log('FAILED:');
    for (const failure of failed) {
      console.log(`  - ${failure.suite} (exit=${failure.status}, signal=${failure.signal})`);
    }
  }
  console.log('='.repeat(78) + '\n');

  const fatalSkip = REQUIRE_POSTGRES && skipped.length > 0;
  process.exit(failed.length === 0 && !fatalSkip ? 0 : 1);
}

main().catch((err) => {
  console.error('Runner crashed:', err);
  process.exit(1);
});
