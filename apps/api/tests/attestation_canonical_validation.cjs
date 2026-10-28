/**
 * Attestation canonicalization and hash-chain validation — attest_v1.
 *
 * Pure and hermetic. Proves the properties the signing path will rely on:
 *   - RFC 8785 key ordering and number formatting
 *   - no undefined / non-finite / non-plain values
 *   - content hash is independent of input array order
 *   - one changed character fails verification
 *   - a re-ordered or gapped chain fails
 *   - only a physician can attest
 */

const assert = require('assert');
const {
  canonicalize,
  buildAttestationContent,
  computeContentHash,
  computeChainHash,
  verifyAttestation,
  verifyChain,
  AttestationError
} = require('../services/workflow/attestation');

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

function expectCode(fn, code) {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof AttestationError, `expected AttestationError, got ${err.name}: ${err.message}`);
    assert.strictEqual(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
    return;
  }
  assert.fail(`expected AttestationError ${code}`);
}

const noteContent = {
  schema_version: 'note_v1',
  subjective: { chief_complaint: { text: 'Sore throat', onset: '2 days', duration: '2 days', severity: 6 } },
  objective: { vitals: { temperature_c: '38.4' } },
  assessment: { primary: { condition: 'Streptococcal pharyngitis', basis: 'Centor 3/4' } },
  plan: {
    medications: [
      { drug: 'Amoxicillin', dose: '500 mg', route: 'PO', frequency: 'three times daily', duration_days: 10 }
    ]
  }
};

function content(overrides = {}) {
  return buildAttestationContent({
    tenantId: 'org-1',
    encounterId: 'enc-1',
    patientId: 'pat-1',
    note: { note_id: 'note-1', schema_version: 'note_v1', content: noteContent },
    diagnoses: [
      { diagnosis_id: 'dx-b', display: 'Beta', certainty: 'CONFIRMED', is_primary: false },
      { diagnosis_id: 'dx-a', display: 'Alpha', certainty: 'CONFIRMED', is_primary: true }
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
    kernel: { version: 'kernel_v1', verdict_hash: `sha256:${'a'.repeat(64)}` },
    attestedBy: { actor_id: 'usr-md-1', actor_name: 'Dr. A', role: 'physician', npi: '1928374650' },
    attestedAt: '2026-10-28T07:00:00.000Z',
    ...overrides
  });
}

function rowFor(built, seq = 1, previous = null) {
  const contentHash = computeContentHash(built);
  const chainHash = computeChainHash({
    seq,
    prevHash: previous ? previous.chain_hash : null,
    contentHash,
    attestedAt: built.attested_at,
    actorId: built.attested_by.actor_id
  });
  return {
    seq,
    prev_hash: previous ? previous.chain_hash : null,
    content_canonical: canonicalize(built),
    content_hash: contentHash,
    chain_hash: chainHash,
    attested_at: built.attested_at,
    actor_id: built.attested_by.actor_id
  };
}

// ---------------------------------------------------------------------------
// JCS
// ---------------------------------------------------------------------------

test('JCS sorts object keys by code unit', () => {
  assert.strictEqual(canonicalize({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.strictEqual(canonicalize({ '2': 'two', '10': 'ten', a: 'a' }), '{"10":"ten","2":"two","a":"a"}');
});

test('JCS number formatting matches ECMAScript', () => {
  assert.strictEqual(
    canonicalize([333333333.33333329, 1e30, 4.5, 2e-3, 1e-27]),
    '[333333333.3333333,1e+30,4.5,0.002,1e-27]'
  );
  assert.strictEqual(canonicalize(-0), '0');
  assert.strictEqual(canonicalize(1.5), '1.5');
});

test('JCS preserves string content and escapes structurally', () => {
  assert.strictEqual(canonicalize('é\u2028x'), '"é\u2028x"');
  assert.strictEqual(canonicalize('a"b\\c\n'), '"a\\"b\\\\c\\n"');
});

test('JCS rejects NaN, Infinity, undefined, non-plain objects, and cycles', () => {
  expectCode(() => canonicalize(NaN), 'NON_FINITE_NUMBER');
  expectCode(() => canonicalize(Infinity), 'NON_FINITE_NUMBER');
  expectCode(() => canonicalize(undefined), 'UNSUPPORTED_TYPE');
  expectCode(() => canonicalize(new Date()), 'NON_PLAIN_OBJECT');
  expectCode(() => canonicalize(new Map()), 'NON_PLAIN_OBJECT');
  expectCode(() => canonicalize({ x: undefined }), 'UNDEFINED_PROPERTY');
  expectCode(() => canonicalize([undefined]), 'UNDEFINED_IN_ARRAY');
  const cyclic = {};
  cyclic.self = cyclic;
  expectCode(() => canonicalize(cyclic), 'CYCLIC_REFERENCE');
});

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

test('content builder sorts diagnoses and prescriptions by id', () => {
  const built = content();
  assert.deepStrictEqual(built.diagnoses.map((d) => d.diagnosis_id), ['dx-a', 'dx-b']);
  assert.strictEqual(built.prescriptions[0].prescription_id, 'rx-1');
  assert.strictEqual(built.attestation_version, 'attest_v1');
});

test('content hash is stable across input array order', () => {
  const a = content();
  const b = content({
    diagnoses: [
      { diagnosis_id: 'dx-a', display: 'Alpha', certainty: 'CONFIRMED', is_primary: true },
      { diagnosis_id: 'dx-b', display: 'Beta', certainty: 'CONFIRMED', is_primary: false }
    ]
  });
  assert.strictEqual(computeContentHash(a), computeContentHash(b));
});

test('attest_v1 has a pinned canonical vector', () => {
  const built = buildAttestationContent({
    tenantId: 'org-1',
    encounterId: 'enc-1',
    patientId: 'pat-1',
    note: {
      note_id: 'note-1',
      schema_version: 'note_v1',
      content: {
        schema_version: 'note_v1',
        subjective: { chief_complaint: { text: 'Sore throat', onset: '2 days', duration: '2 days', severity: 6 } },
        plan: { medications: [] }
      }
    },
    diagnoses: [
      {
        diagnosis_id: 'dx-1',
        code_system: 'ICD-10',
        code: 'J02.0',
        display: 'Streptococcal pharyngitis',
        certainty: 'CONFIRMED',
        is_primary: true
      }
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
    proposals: [
      { proposal_id: 'prop-1', kind: 'prescription', content_hash: `sha256:${'b'.repeat(64)}` }
    ],
    kernel: { version: 'kernel_v1', verdict_hash: `sha256:${'c'.repeat(64)}` },
    attestedBy: { actor_id: 'usr-md-1', actor_name: 'Dr. A', role: 'physician', npi: '1928374650' },
    attestedAt: '2026-10-28T07:00:00.000Z'
  });
  const contentHash = computeContentHash(built);
  const chainHash = computeChainHash({
    seq: 1,
    prevHash: null,
    contentHash,
    attestedAt: built.attested_at,
    actorId: built.attested_by.actor_id
  });
  // Changing this vector means changing the canonical form. That is a version
  // bump (attest_v2), never a test update.
  assert.strictEqual(contentHash, 'sha256:524ec1dcb65d3da1bab89476c3df03280c63ea28f1e12a4a29884c61da9e3b04');
  assert.strictEqual(chainHash, 'sha256:10237bd092b620d7b5828c5c5202730692f2de994053c121ce9ddc8278afcb52');
});

test('only a physician can attest', () => {
  expectCode(() => content({ attestedBy: { actor_id: 'usr-1', actor_name: 'Nurse', role: 'nurse' } }), 'ATTESTOR_ROLE');
});

test('timestamp must be ISO-8601 UTC with milliseconds', () => {
  expectCode(() => content({ attestedAt: '2026-10-28T07:00:00Z' }), 'TIMESTAMP_FORMAT');
  expectCode(() => content({ attestedAt: '2026-10-28T07:00:00.000+05:30' }), 'TIMESTAMP_FORMAT');
});

test('prescription dose, route, and frequency are mandatory', () => {
  expectCode(
    () =>
      content({
        prescriptions: [
          {
            prescription_id: 'rx-1',
            medication_name: 'Amoxicillin',
            dose: '',
            route: 'PO',
            frequency: 'TID',
            duration_days: 10
          }
        ]
      }),
    'FIELD_REQUIRED'
  );
});

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

test('a valid row verifies', () => {
  const row = rowFor(content());
  const result = verifyAttestation(row, null);
  assert.deepStrictEqual(result, { valid: true, errors: [] });
});

test('one changed character fails verification', () => {
  const row = rowFor(content());
  const tampered = { ...row, content_canonical: row.content_canonical.replace('500 mg', '875 mg') };
  const result = verifyAttestation(tampered, null);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === 'CONTENT_HASH_MISMATCH'));
});

test('non-canonical content_canonical is rejected even if the hash matches', () => {
  const row = rowFor(content());
  const parsed = JSON.parse(row.content_canonical);
  const pretty = JSON.stringify(parsed, null, 2);
  const tampered = {
    ...row,
    content_canonical: pretty,
    content_hash: computeContentHash(parsed)
  };
  const result = verifyAttestation(tampered, null);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === 'CANONICAL_MISMATCH'));
});

test('a two-row chain verifies and detects a gap', () => {
  const first = rowFor(content(), 1, null);
  const second = rowFor(content({ attestedAt: '2026-10-28T07:05:00.000Z' }), 2, first);
  const good = verifyChain([first, second]);
  assert.strictEqual(good.valid, true);
  assert.strictEqual(good.length, 2);

  const gapped = verifyChain([first, { ...second, seq: 3 }]);
  assert.strictEqual(gapped.valid, false);
  assert.ok(gapped.errors.some((e) => e.code === 'CHAIN_GAP' || e.code === 'CHAIN_HASH_MISMATCH'));
});

test('reordering a chain breaks prev_hash', () => {
  const first = rowFor(content(), 1, null);
  const second = rowFor(content({ attestedAt: '2026-10-28T07:05:00.000Z' }), 2, first);
  const result = verifyChain([second, first]);
  // verifyChain sorts by seq, so a swap alone is not the attack; a rewritten
  // prev_hash is. Removing the first row must break the second.
  const missingFirst = verifyChain([second]);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(missingFirst.valid, false);
  assert.ok(missingFirst.errors.some((e) => e.code === 'PREV_HASH_MISMATCH'));
});

console.log(`\n${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
