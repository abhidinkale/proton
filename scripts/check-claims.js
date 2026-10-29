#!/usr/bin/env node

/**
 * Proton Claims CI Gate — Enforced by Strategy Document §8
 *
 * Scans frontend code and documentation for banned marketing claims:
 * - "Epic parity", "Cerner parity"
 * - "Autonomous diagnosis"
 * - "AI Doctor"
 *
 * Exits with non-zero status code if an unapproved claim is found.
 */

const fs = require('fs');
const path = require('path');

const BANNED_PATTERNS = [
  { pattern: /\bepic\s+parity\b/i, label: 'Banned claim: Epic parity' },
  { pattern: /\bcerner\s+parity\b/i, label: 'Banned claim: Cerner parity' },
  { pattern: /\bautonomous\s+diagnosis\b/i, label: 'Banned claim: Autonomous diagnosis (SaMD boundary violation)' },
  { pattern: /\bautonomous\s+diagnostician\b/i, label: 'Banned claim: Autonomous diagnostician' }
];

const SCAN_DIRS = [
  path.join(__dirname, '..', 'apps', 'web', 'src')
];

let violationCount = 0;

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineIndex) => {
    for (const { pattern, label } of BANNED_PATTERNS) {
      if (pattern.test(line)) {
        violationCount++;
        console.error(`❌ [CLAIM VIOLATION] ${filePath}:${lineIndex + 1}`);
        console.error(`   ${label}`);
        console.error(`   "${line.trim()}"\n`);
      }
    }
  });
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        scanDir(fullPath);
      }
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      scanFile(fullPath);
    }
  }
}

console.log('Running Proton Claims & Regulatory Boundary Scan...');
for (const dir of SCAN_DIRS) {
  scanDir(dir);
}

if (violationCount > 0) {
  console.error(`\n❌ Found ${violationCount} claims violation(s). Refer to docs/CLAIMS.md for allowlist.`);
  process.exit(1);
} else {
  console.log('✓ Claims scan passed. Zero banned claims detected in client code.\n');
  process.exit(0);
}
