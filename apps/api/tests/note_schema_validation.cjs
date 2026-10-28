/**
 * note_v1 schema and validator — acceptance tests.
 *
 * The signing path must reject an invalid note with a field path, not a
 * paragraph of prose. These tests pin the paths the cockpit will focus.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateNote, toJsonSchema } = require('../services/clinical/noteSchema');
const { buildAttestationContent, computeContentHash, canonicalize } = require('../services/workflow/attestation');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    passCount += 1;
    console.log(`✓ [PASS] ${name}`);
  } catch (err) {
    failCount += 1;
    console.error(`✗ [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

function validNote() {
  return {
    schema_version: 'note_v1',
    subjective: {
      chief_complaint: { text: 'Sore throat', onset: '2 days', duration: '2 days', severity: 6 },
      hpi: [
        {
          symptom: 'sore throat',
          onset: '2 days',
          character: 'sharp',
          aggravating: ['swallowing'],
          relieving: ['warm fluids'],
          associated: ['fever']
        }
      ],
      pmh: [],
      medications: [],
      allergies: [{ substance: 'Penicillin', reaction: 'rash', severity: 'moderate' }],
      narrative: 'Patient reports sore throat and fever for two days.'
    },
    objective: {
      vitals: {
        temperature_c: '38.4',
        heart_rate_bpm: '98',
        systolic_bp_mmhg: '118',
        diastolic_bp_mmhg: '76',
        respiratory_rate_bpm: '16',
        spo2_pct: '98',
        weight_kg: '72.5',
        height_cm: '178'
      },
      exam: [{ system: 'HEENT', finding: 'tonsillar exudate', laterality: 'bilateral' }],
      labs: []
    },
    assessment: {
      differential: [
        {
          condition: 'Streptococcal pharyngitis',
          band: 'supported',
          for: ['Centor 3/4'],
          against: ['no rash'],
          guideline_ref: 'IDSA-2012'
        }
      ],
      primary: { condition: 'Streptococcal pharyngitis', basis: 'Centor 3/4 and prior episode' }
    },
    plan: {
      medications: [
        {
          drug: 'Amoxicillin',
          dose: '500 mg',
          route: 'PO',
          frequency: 'three times daily',
          duration_days: 10,
          rationale: 'IDSA first-line for confirmed strep'
        }
      ],
      orders: [],
      follow_up: { interval: '48h', method: 'app check-in', triggers: ['worse', 'cannot swallow'] },
      education: []
    }
  };
}

function errorPaths(note) {
  const result = validateNote(note);
  assert.strictEqual(result.valid, false, 'expected invalid note');
  return result.errors.map((e) => e.path);
}

test('a complete note validates', () => {
  const result = validateNote(validNote());
  assert.strictEqual(result.valid, true);
  assert.deepStrictEqual(result.errors, []);
});

test('missing plan dose is rejected at plan.medications[0].dose', () => {
  const note = validNote();
  note.plan.medications[0].dose = '';
  assert.ok(errorPaths(note).includes('plan.medications[0].dose'));
});

test('severity outside 1..10 is rejected at the severity field', () => {
  const note = validNote();
  note.subjective.chief_complaint.severity = 11;
  assert.ok(errorPaths(note).includes('subjective.chief_complaint.severity'));
});

test('a decimal measurement sent as a JSON number is rejected', () => {
  const note = validNote();
  note.objective.vitals.temperature_c = 38.4;
  assert.ok(errorPaths(note).includes('objective.vitals.temperature_c'));
});

test('an unknown field is rejected at the field path', () => {
  const note = validNote();
  note.subjective.unknown_field = 'x';
  assert.ok(errorPaths(note).includes('subjective.unknown_field'));
});

test('a wrong schema_version is rejected', () => {
  const note = validNote();
  note.schema_version = 'note_v0';
  assert.ok(errorPaths(note).includes('schema_version'));
});

test('free-text narrative survives unchanged so no clinical detail is lost', () => {
  const note = validNote();
  note.subjective.narrative = 'Line one.\nLine two — with an em dash.';
  const result = validateNote(note);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.data.subjective.narrative, note.subjective.narrative);
});

test('the generated JSON Schema matches the Zod source (no drift)', () => {
  const file = path.resolve(__dirname, '../schemas/note_v1.schema.json');
  const expected = `${JSON.stringify(toJsonSchema(), null, 2)}\n`;
  assert.strictEqual(fs.readFileSync(file, 'utf8'), expected);
});

test('a validated note can be attested: canonical content hashes and verifies', () => {
  const parsed = validateNote(validNote());
  const built = buildAttestationContent({
    tenantId: 'org-1',
    encounterId: 'enc-1',
    patientId: 'pat-1',
    note: { note_id: 'note-1', schema_version: 'note_v1', content: parsed.data },
    diagnoses: [
      { diagnosis_id: 'dx-1', code_system: 'ICD-10', code: 'J02.0', display: 'Strep pharyngitis', certainty: 'CONFIRMED', is_primary: true }
    ],
    prescriptions: [
      {
        prescription_id: 'rx-1',
        medication_name: 'Amoxicillin',
        rxnorm_code: '723',
        dose: '500 mg',
        route: 'PO',
        frequency: 'three times daily',
        duration_days: 10
      }
    ],
    proposals: [],
    kernel: null,
    attestedBy: { actor_id: 'usr-md-1', actor_name: 'Dr. A', role: 'physician', npi: null },
    attestedAt: '2026-10-28T07:00:00.000Z'
  });
  const canonical = canonicalize(built);
  assert.ok(canonical.includes('"temperature_c":"38.4"'));
  assert.ok(canonical.includes('"severity":6'));
  assert.match(computeContentHash(built), /^sha256:[0-9a-f]{64}$/);
});

console.log(`\n${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
