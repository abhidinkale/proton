#!/usr/bin/env node
/**
 * Proton Deterministic Test Runner
 *
 * Runs every API suite that is hermetic: no network, no API keys, no local model,
 * no running server. This is the suite CI must gate on.
 *
 * Deliberately excluded (run manually, they require live infrastructure):
 *   - clinical_ai_validation.cjs        live AI provider
 *   - grok_live_validation.cjs         XAI_API_KEY
 *   - medgemma_benchmark.cjs           local MedGemma model
 *   - medgemma_e2e_verification.cjs    running API server
 *   - gemini_live_smoke.cjs            GEMINI_API_KEY
 *   - deepseek_live_smoke.cjs          DEEPSEEK_API_KEY
 *
 * Usage:
 *   node tests/run-deterministic-suite.cjs            # run all
 *   node tests/run-deterministic-suite.cjs --filter=milestone6
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
  'deepseek_live_smoke.cjs'
]);

const filterArg = process.argv.find((arg) => arg.startsWith('--filter='));
const filter = filterArg ? filterArg.split('=')[1] : null;

const suites = fs
  .readdirSync(TESTS_DIR)
  .filter((file) => file.endsWith('.cjs') && !file.startsWith('run-'))
  .filter((file) => !EXCLUDED.has(file))
  .filter((file) => (filter ? file.includes(filter) : true))
  .sort();

if (suites.length === 0) {
  console.error(`No deterministic suites found${filter ? ` matching "${filter}"` : ''}.`);
  process.exit(1);
}

const results = [];

for (const suite of suites) {
  const startedAt = Date.now();
  process.stdout.write(`\n▶ ${suite}\n`);
  const run = spawnSync(process.execPath, [path.join(TESTS_DIR, suite)], {
    cwd: path.join(TESTS_DIR, '..'),
    env: { ...process.env, NODE_ENV: 'test' },
    encoding: 'utf8',
    timeout: 120_000
  });

  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const duration = Date.now() - startedAt;
  const passed = run.status === 0 && !run.signal;

  results.push({ suite, passed, status: run.status, signal: run.signal, duration });

  // Surface the last lines so a failure is actionable in CI logs.
  const tail = output.trim().split('\n').slice(-12).join('\n');
  console.log(tail);
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'} ${suite} (${duration}ms)`);

  if (!passed) {
    console.log(`   exit=${run.status} signal=${run.signal}`);
  }
}

const failed = results.filter((r) => !r.passed);

console.log('\n' + '='.repeat(78));
console.log(`DETERMINISTIC SUITE: ${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) {
  console.log('FAILED:');
  for (const failure of failed) {
    console.log(`  - ${failure.suite} (exit=${failure.status}, signal=${failure.signal})`);
  }
}
console.log('='.repeat(78) + '\n');

process.exit(failed.length === 0 ? 0 : 1);
