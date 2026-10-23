#!/usr/bin/env node
/**
 * Guards the "one authenticated API client" invariant.
 *
 * Every browser -> Proton API call must go through `src/lib/api.ts` so it carries
 * the Proton session token and a 401 ends exactly one session. Raw `fetch` is
 * only legitimate in:
 *   - `src/lib/api.ts`            (the client itself)
 *   - `src/services/auth.ts`      (the exchange call, made before a token exists)
 *   - the files below            (user-authored screens awaiting codemod; see docs/BUILD_PLAN.md)
 *
 * This is intentionally a standalone check rather than part of `npm run lint`:
 * it must fail the build only once the deferred files are migrated.
 *
 * Usage: node scripts/check-api-client.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('../src', import.meta.url).pathname;

const ALLOWED = new Set([
  'src/lib/api.ts',
  'src/services/auth.ts',
  // Deferred: actively edited by the UI workstream. Codemod before Phase 3 closes.
  'src/components/AmbientClinicalCockpit.tsx',
  'src/components/DoctorGuidedEncounter.tsx',
  'src/components/workstation/MDSpecialistBoardPanel.tsx',
  'src/pages/DocumentReview.tsx'
]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const offenders = [];

for (const file of walk(SRC)) {
  const rel = relative(new URL('..', import.meta.url).pathname, file).replace(/\\/g, '/');
  const source = readFileSync(file, 'utf8');

  // Import lines and comments may mention fetch; only call sites matter.
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const code = withoutBlockComments
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');

  if (/\bfetch\s*\(/.test(code) && !ALLOWED.has(rel)) {
    offenders.push(rel);
  }
}

if (offenders.length > 0) {
  console.error('\n❌ Raw fetch() found outside the Proton API client:\n');
  for (const file of offenders.sort()) console.error(`   ${file}`);
  console.error('\nUse apiFetch() from src/lib/api.ts so the session token is attached.');
  console.error('If this file is intentionally deferred, add it to scripts/check-api-client.mjs.\n');
  process.exit(1);
}

console.log(`✓ All browser API calls route through src/lib/api.ts (${ALLOWED.size} allowlisted files).`);
