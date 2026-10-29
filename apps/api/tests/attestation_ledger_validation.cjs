/**
 * Attestation ledger — P0.2 validation
 *
 * Proves the four properties the demo depends on:
 *   1. appending writes the exact canonical bytes that were signed
 *   2. verification recomputes from the ledger, not from the note
 *   3. one changed character fails verification
 *   4. the tenant chain links seq -> prev_hash -> chain_hash
 *
 * Requires PostgreSQL (the runner skips it when unavailable).
 */

const assert = require('assert');
const { prepareSuite } = require('./helpers/postgresTestHarness.cjs');

let pass = 0;
let fail = 0;

async function test(name, fn) {
  try {
    await fn();
    pass += 1;
    console.log(`✓ [PASS] ${name}`);
  } catch (err) {
    fail += 1;
    console.error(`✗ [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

const { NOTE_V1 } = require('./fixtures/noteV1.cjs');

async function run() {
  const target = await prepareSuite({
    suiteFile: 'attestation_ledger_validation.cjs',
    testDbName: process.env.PROTON_TEST_DB || 'proton_attest_test'
  });
  if (!target) return;

  const { runPostgresMigrations, getPostgresPool, closePostgresPool } = require('../storage/postgresDb');
  const repo = require('../storage/postgres/workflowRepository');
  const store = require('../services/workflow/attestationStore');
  const { validateNote } = require('../services/clinical/noteSchema');

  await runPostgresMigrations();
  const pool = getPostgresPool();

  const tenant = 'org-attest-test';
  const patient = 'pat-attest-1';
  const encounter = 'enc-attest-1';
  const noteId = 'note-attest-1';
  const actor = {
    actor_id: 'usr-md-attest',
    actor_name: 'Dr. Attest Test, MD',
    role: 'physician',
    npi: '1999999999'
  };
  const input = {
    tenantId: tenant,
    encounterId: encounter,
    patientId: patient,
    note: (() => {
      const { schema_version, ...content } = NOTE_V1;
      return { note_id: noteId, schema_version, content };
    })(),
    diagnoses: [
      {
        diagnosis_id: 'dx-attest-1',
        code_system: 'SNOMED',
        code: '43878008',
        display: 'Streptococcal pharyngitis',
        certainty: 'CONFIRMED',
        is_primary: true
      }
    ],
    prescriptions: [
      {
        prescription_id: 'rx-attest-1',
        medication_name: 'Amoxicillin 500 mg',
        rxnorm_code: '308182',
        dose: '500 mg',
        route: 'PO',
        frequency: 'three times daily',
        duration_days: 7
      }
    ],
    actor,
    kernel: null
  };

  await pool.query(
    `INSERT INTO patients (id, tenant_id, full_name, date_of_birth, sex)
     VALUES ($1, $2, 'Attest Test', '1990-02-02', 'female');`,
    [patient, tenant]
  );
  await pool.query(
    `INSERT INTO encounters (id, tenant_id, patient_id, clinician_id, state, version)
     VALUES ($1, $2, $3, $4, 'PENDING_REVIEW', 1);`,
    [encounter, tenant, patient, actor.actor_id]
  );
  await pool.query(
    `INSERT INTO notes (id, tenant_id, encounter_id, author_actor_id, status, content)
     VALUES ($1, $2, $3, $4, 'PENDING_REVIEW', $5::jsonb);`,
    [noteId, tenant, encounter, actor.actor_id, JSON.stringify(NOTE_V1)]
  );

  let first;
  let second;
  let originalCanonical;

  await test('the demo fixture is a valid note_v1', () => {
    const result = validateNote(NOTE_V1);
    assert(result.valid, JSON.stringify(result.errors));
  });

  await test('an attestation stores the canonical bytes and links to the chain head', async () => {
    first = await repo.withTransaction((client) => store.append(client, input));
    assert.strictEqual(first.seq, 1);
    assert.strictEqual(first.prev_hash, null);
    assert.match(first.content_hash, /^sha256:[0-9a-f]{64}$/);
    assert.match(first.chain_hash, /^sha256:[0-9a-f]{64}$/);
    const stored = await pool.query(
      `SELECT content_canonical FROM clinical_attestations WHERE id = $1;`,
      [first.id]
    );
    originalCanonical = stored.rows[0].content_canonical;
    assert.strictEqual(JSON.parse(originalCanonical).attestation_version, 'attest_v1');
  });

  await test('verification recomputes from the ledger and passes', async () => {
    const result = await store.verifyById(pool, tenant, first.id);
    assert.strictEqual(result.valid, true, JSON.stringify(result.errors));
    assert.strictEqual(result.content_hash, first.content_hash);
    assert.strictEqual(result.content.note.note_id, noteId);
  });

  await test('one changed character fails verification', async () => {
    await pool.query(
      `UPDATE clinical_attestations
          SET content_canonical = replace(content_canonical, '38.4', '38.5')
        WHERE id = $1;`,
      [first.id]
    );
    const tampered = await store.verifyById(pool, tenant, first.id);
    assert.strictEqual(tampered.valid, false);
    assert(
      tampered.errors.some((e) => e.code === 'CONTENT_HASH_MISMATCH' || e.code === 'CANONICAL_MISMATCH'),
      JSON.stringify(tampered.errors)
    );

    await pool.query(`UPDATE clinical_attestations SET content_canonical = $2 WHERE id = $1;`, [
      first.id,
      originalCanonical
    ]);
    const restored = await store.verifyById(pool, tenant, first.id);
    assert.strictEqual(restored.valid, true, JSON.stringify(restored.errors));
  });

  await test('the chain links the second attestation to the first', async () => {
    second = await repo.withTransaction((client) => store.append(client, input));
    assert.strictEqual(second.seq, 2);
    assert.strictEqual(second.prev_hash, first.chain_hash);
    const chain = await store.verifyTenantChain(pool, tenant);
    assert.strictEqual(chain.valid, true, JSON.stringify(chain.errors));
    assert.strictEqual(chain.length, 2);
  });

  await pool.query(`DELETE FROM clinical_attestations WHERE tenant_id = $1;`, [tenant]);
  await pool.query(`DELETE FROM notes WHERE tenant_id = $1;`, [tenant]);
  await pool.query(`DELETE FROM encounters WHERE tenant_id = $1;`, [tenant]);
  await pool.query(`DELETE FROM patients WHERE tenant_id = $1;`, [tenant]);
  await closePostgresPool();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
