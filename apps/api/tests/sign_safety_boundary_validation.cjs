/**
 * Cut A — the safety verdict must bind the write.
 *
 * Proves:
 *   - the pipeline helper refuses an uncleared verdict;
 *   - the clinic sign action refuses a HIGH review and a CRITICAL hard stop;
 *   - a documented physician directive clears a HIGH review;
 *   - a clean order signs and stores the verdict with the signature;
 *   - a refused sign leaves the note in DRAFT;
 *   - the clinic audit chain still verifies.
 *
 * In-memory SQLite, no server, no network.
 */

process.env.PROTON_DB_PATH = ':memory:';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const assert = require('assert');
const repo = require('../storage/clinicRepository');
const { getDatabase } = require('../storage/db');
const {
  assertSafetyClearance,
  ClinicalPipelineError
} = require('../services/clinical/clinicalPipeline');

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

const actor = repo.DEFAULT_ACTOR;
const db = getDatabase();
const now = new Date().toISOString();

db.prepare(
  'INSERT INTO clinic_patients (id, tenant_id, name, mrn, data_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
).run(
  'pat-sign-test',
  actor.tenantId,
  'Sign Test',
  'MRN-SIGN',
  JSON.stringify({ allergies: ['NKDA'], medications: [], age: 40 }),
  now,
  now
);

function setPatient(data) {
  db.prepare('UPDATE clinic_patients SET data_json = ? WHERE id = ?').run(
    JSON.stringify(data),
    'pat-sign-test'
  );
}

function draft(title) {
  return repo.saveDraft(actor, {
    patientId: 'pat-sign-test',
    patientName: 'Sign Test',
    title,
    note: 'Sore throat for two days.'
  });
}

function expectSignError(noteId, body, expectedCode, expectedStatus = 409) {
  let error = null;
  try {
    repo.signNote(actor, noteId, body);
  } catch (err) {
    error = err;
  }
  assert.ok(error, `expected ${expectedCode}`);
  assert.strictEqual(error.code, expectedCode);
  assert.strictEqual(error.status, expectedStatus);
}

// ---------------------------------------------------------------------------
// A1 — pipeline helper
// ---------------------------------------------------------------------------

test('pipeline refuses an uncleared verdict', () => {
  assert.throws(
    () => assertSafetyClearance({ cleared: false, hardStop: false, requiresReview: true }),
    (err) =>
      err instanceof ClinicalPipelineError &&
      err.code === 'SAFETY_REVIEW_REQUIRED' &&
      err.status === 422
  );
});

test('pipeline allows a cleared verdict and a directive override', () => {
  assert.doesNotThrow(() => assertSafetyClearance({ cleared: true }));
  assert.doesNotThrow(() => assertSafetyClearance({ cleared: true, status: 'DIRECTIVE_OVERRIDE' }));
});

// ---------------------------------------------------------------------------
// A2 — clinic sign boundary
// ---------------------------------------------------------------------------

test('a HIGH DDI cannot be signed without a directive', () => {
  setPatient({ allergies: ['NKDA'], medications: ['Warfarin 5 mg daily'], age: 68 });
  const note = draft('High DDI');
  expectSignError(
    note.id,
    {
      prescriptions: [
        { name: 'Ibuprofen', dose: '400 mg', route: 'PO', frequency: 'three times daily', strength: '400 mg' }
      ]
    },
    'SAFETY_REVIEW_REQUIRED'
  );
  assert.strictEqual(repo.getNote(actor, note.id).status, 'DRAFT', 'a refused sign must not write SIGNED');
});

test('a CRITICAL allergy conflict cannot be signed', () => {
  setPatient({ allergies: ['Penicillin'], medications: [], age: 40 });
  const note = draft('Penicillin conflict');
  expectSignError(
    note.id,
    {
      prescriptions: [
        { name: 'Amoxicillin', dose: '500 mg', route: 'PO', frequency: 'three times daily', strength: '500 mg' }
      ]
    },
    'CONTRAINDICATION_HARD_STOP'
  );
});

test('a physician directive clears a HIGH review and is stored with the signature', () => {
  setPatient({ allergies: ['NKDA'], medications: ['Warfarin 5 mg daily'], age: 68 });
  const note = draft('Directive');
  const result = repo.signNote(actor, note.id, {
    prescriptions: [
      { name: 'Ibuprofen', dose: '400 mg', route: 'PO', frequency: 'three times daily', strength: '400 mg' }
    ],
    physicianDirective: 'Cardiology approved a short course with gastroprotection and INR monitoring.'
  });
  assert.strictEqual(result.note.status, 'SIGNED');
  assert.strictEqual(result.note.signature.safetyVerdict.status, 'DIRECTIVE_OVERRIDE');
  assert.strictEqual(result.note.signature.safetyVerdict.cleared, true);
});

test('a clean order signs and stores a VERIFIED kernel_v2 verdict', () => {
  setPatient({ allergies: ['NKDA'], medications: [], age: 40 });
  const note = draft('Clean');
  const result = repo.signNote(actor, note.id, {
    prescriptions: [
      { name: 'Azithromycin', dose: '250 mg', route: 'PO', frequency: 'daily', strength: '250 mg' }
    ]
  });
  assert.strictEqual(result.note.status, 'SIGNED');
  assert.strictEqual(result.note.signature.safetyVerdict.status, 'VERIFIED');
  assert.strictEqual(result.note.signature.safetyVerdict.kernelVersion, 'kernel_v2');
});

test('a note with no prescriptions still signs, with no verdict to store', () => {
  setPatient({ allergies: ['NKDA'], medications: [], age: 40 });
  const note = draft('No prescriptions');
  const result = repo.signNote(actor, note.id, {});
  assert.strictEqual(result.note.status, 'SIGNED');
  assert.strictEqual(result.note.signature.safetyVerdict, null);
});

test('the clinic audit chain verifies after the sign attempts', () => {
  assert.strictEqual(repo.verifyAudit(actor).valid, true);
});

console.log(`\n${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
