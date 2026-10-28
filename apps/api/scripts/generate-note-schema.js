#!/usr/bin/env node
/**
 * Generate apps/api/schemas/note_v1.schema.json from the Zod source of truth.
 *
 * Run after changing services/clinical/noteSchema.js:
 *   node scripts/generate-note-schema.js
 *
 * The JSON Schema is a build artifact for consumers that cannot run Zod
 * (the web app's form generator, external reviewers, a future validator in
 * another language). It must never be edited by hand.
 */

const fs = require('fs');
const path = require('path');
const { toJsonSchema } = require('../services/clinical/noteSchema');

const outPath = path.resolve(__dirname, '../schemas/note_v1.schema.json');
const schema = toJsonSchema();

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');

console.log(`Wrote ${path.relative(process.cwd(), outPath)} (${JSON.stringify(schema).length} bytes)`);
