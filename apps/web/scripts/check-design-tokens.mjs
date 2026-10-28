#!/usr/bin/env node
/**
 * Design-token guard.
 *
 * The palettes only work if no component names a colour directly. A single
 * `bg-[#FAF9F6]` is invisible in light mode and a white card on a navy page in
 * dark mode — the exact failure this project spent a day removing.
 *
 * Hard failure: an arbitrary hex colour utility class (`bg-[#fff]`, `text-[#111]`,
 * `border-[#e4e4e7]/60`, `from-[#…]`, `ring-[#…]`, …). Zero tolerance; these are
 * always avoidable with a semantic token.
 *
 * Soft report: literal hex values elsewhere in .tsx (inline style objects,
 * chart palettes, gradient strings). They cannot always be expressed as a
 * utility class, so they are listed rather than failed — but the number is
 * printed so it can be seen going up.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname;
const CLASS_PATTERN =
  /\b(?:bg|text|border|ring|ring-offset|from|to|via|divide|fill|stroke|shadow|outline|decoration|placeholder|accent|caret)-\[#[0-9a-fA-F]{3,8}\](?:\/\d{1,3})?/g;
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      yield* walk(path);
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      yield path;
    }
  }
}

const violations = [];
const literals = [];

for await (const file of walk(SRC)) {
  const source = await readFile(file, 'utf8');
  const name = relative(SRC, file);

  const lines = source.split('\n');
  lines.forEach((line, index) => {
    const classMatches = line.match(CLASS_PATTERN);
    if (classMatches) {
      violations.push({ file: name, line: index + 1, text: classMatches.join(', ') });
    }

    const hexMatches = line.match(HEX_PATTERN);
    if (hexMatches) {
      literals.push({ file: name, line: index + 1, text: hexMatches.join(', ') });
    }
  });
}

if (violations.length > 0) {
  console.error(`\n✗ ${violations.length} hardcoded colour class(es) — use a semantic token.\n`);
  const byFile = new Map();
  for (const violation of violations) {
    if (!byFile.has(violation.file)) byFile.set(violation.file, []);
    byFile.get(violation.file).push(violation);
  }
  for (const [file, items] of byFile) {
    console.error(`  ${file}`);
    for (const item of items.slice(0, 5)) {
      console.error(`    ${item.line}: ${item.text}`);
    }
    if (items.length > 5) console.error(`    … ${items.length - 5} more`);
  }
  console.error(
    '\n  Tokens: bg-canvas paper paper-2 rule rule-strong ink ink-2 ink-3\n' +
      '          solid on-solid accent accent-wash accent-line\n' +
      '          critical caution settled (+ -wash / -line)\n'
  );
  process.exit(1);
}

console.log('✓ No hardcoded colour classes; every surface follows the palette.');

const byFile = new Map();
for (const literal of literals) {
  byFile.set(literal.file, (byFile.get(literal.file) ?? 0) + 1);
}

if (literals.length > 0) {
  const worst = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(
    `  note: ${literals.length} literal hex value(s) in ${byFile.size} file(s) — ` +
      'inline styles, charts and gradients. These do not follow the palette:'
  );
  for (const [file, count] of worst) {
    console.log(`    ${count.toString().padStart(3)}  ${file}`);
  }
}
