/**
 * Proton Attestation Canonicalization & Hash Chain — attest_v1
 *
 * The signature is only meaningful if it is bound to the exact clinical
 * content the physician saw. This module is the canonical form that binding
 * uses. It is deliberately pure: no database, no clock, no environment.
 *
 * Canonicalization is RFC 8785 (JCS) as a subset:
 *   - UTF-8, no insignificant whitespace
 *   - object keys sorted by UTF-16 code units
 *   - numbers use ECMAScript Number::toString (JSON.stringify)
 *   - no NaN, Infinity, -0 preserved as 0, no undefined, no cycles
 *   - no non-plain objects (Date, Map, Set, class instances)
 *
 * Two design choices are pinned here because changing them invalidates every
 * existing attestation:
 *
 * 1. Decimal measurements are strings in note_v1, not JSON numbers. JCS number
 *    formatting is deterministic in one runtime but a cross-language verifier
 *    (Python, Java, Go) can disagree on edge cases. Strings remove the class of
 *    bug entirely; integers remain numbers because they are exact.
 *
 * 2. The stored hash is computed over `content_canonical` TEXT, not over a
 *    JSONB round-trip. Postgres JSONB normalizes numbers and key order, so
 *    hashing JSONB output would produce a different hash after a restore.
 *    The row stores both; verification re-canonicalizes and compares the text.
 */

const crypto = require('crypto');

const ATTESTATION_VERSION = 'attest_v1';
const NOTE_SCHEMA_VERSION = 'note_v1';
const HASH_PREFIX = 'sha256:';

const CERTAINTY = ['PROPOSED', 'CONFIRMED', 'RULED_OUT'];
const PROPOSAL_KINDS = ['note', 'differential', 'prescription', 'summary'];
const ROLES = ['physician'];

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

class AttestationError extends Error {
  constructor(code, message, details = null) {
    super(`[attestation:${code}] ${message}`);
    this.name = 'AttestationError';
    this.code = code;
    this.details = details;
    this.status = 400;
  }
}

function fail(code, message, details) {
  throw new AttestationError(code, message, details);
}

function assertWellFormedString(value, label) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        fail('LONE_SURROGATE', `${label} contains an unpaired high surrogate at index ${i}.`);
      }
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      fail('LONE_SURROGATE', `${label} contains an unpaired low surrogate at index ${i}.`);
    }
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * RFC 8785 canonical JSON. Throws AttestationError on anything that cannot be
 * represented deterministically.
 */
function canonicalize(value, path = '$', seen = new WeakSet()) {
  if (value === null) return 'null';

  const type = typeof value;
  if (type === 'boolean') return value ? 'true' : 'false';

  if (type === 'number') {
    if (!Number.isFinite(value)) {
      fail('NON_FINITE_NUMBER', `${path} is not a finite number.`);
    }
    if (Object.is(value, -0)) return '0';
    // JSON.stringify uses ECMAScript Number::toString, which is the JCS rule.
    return JSON.stringify(value);
  }

  if (type === 'string') {
    assertWellFormedString(value, path);
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) fail('CYCLIC_REFERENCE', `${path} is a cyclic reference.`);
    seen.add(value);
    const parts = value.map((item, index) => {
      if (item === undefined) {
        fail('UNDEFINED_IN_ARRAY', `${path}[${index}] is undefined.`);
      }
      return canonicalize(item, `${path}[${index}]`, seen);
    });
    seen.delete(value);
    return `[${parts.join(',')}]`;
  }

  if (type === 'object') {
    if (!isPlainObject(value)) {
      fail('NON_PLAIN_OBJECT', `${path} is not a plain object (Date/Map/Set/class instances are not canonicalizable).`);
    }
    if (seen.has(value)) fail('CYCLIC_REFERENCE', `${path} is a cyclic reference.`);
    seen.add(value);
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      if (value[key] === undefined) {
        fail('UNDEFINED_PROPERTY', `${path}.${key} is undefined. Omit it or use null.`);
      }
      assertWellFormedString(key, `${path} key`);
    }
    const parts = keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], `${path}.${key}`, seen)}`);
    seen.delete(value);
    return `{${parts.join(',')}}`;
  }

  fail('UNSUPPORTED_TYPE', `${path} has unsupported type '${type}'.`);
  return '';
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function hashOf(value) {
  return `${HASH_PREFIX}${sha256Hex(canonicalize(value))}`;
}

function requireString(value, field, { allowNull = false, max = 2000 } = {}) {
  if (value === null && allowNull) return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('FIELD_REQUIRED', `${field} must be a non-empty string.`, { field });
  }
  if (value.length > max) {
    fail('FIELD_TOO_LONG', `${field} exceeds ${max} characters.`, { field });
  }
  return value;
}

function optionalString(value, field, { max = 2000 } = {}) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') fail('FIELD_TYPE', `${field} must be a string or null.`, { field });
  if (value.length > max) fail('FIELD_TOO_LONG', `${field} exceeds ${max} characters.`, { field });
  return value;
}

function requireTimestamp(value, field) {
  if (typeof value !== 'string' || !TIMESTAMP_RE.test(value)) {
    fail('TIMESTAMP_FORMAT', `${field} must be an ISO-8601 UTC timestamp with milliseconds (YYYY-MM-DDTHH:mm:ss.sssZ).`, {
      field,
      value
    });
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail('TIMESTAMP_INVALID', `${field} is not a valid instant.`, { field, value });
  return value;
}

function requireHash(value, field, { allowNull = false } = {}) {
  if (value === null && allowNull) return null;
  if (typeof value !== 'string' || !HASH_RE.test(value)) {
    fail('HASH_FORMAT', `${field} must be 'sha256:' followed by 64 lowercase hex characters.`, { field });
  }
  return value;
}

function normalizeDiagnoses(diagnoses = []) {
  if (!Array.isArray(diagnoses)) fail('DIAGNOSES_TYPE', 'diagnoses must be an array.');
  return diagnoses
    .map((d, index) => {
      if (!d || typeof d !== 'object') fail('DIAGNOSIS_TYPE', `diagnoses[${index}] must be an object.`);
      const diagnosisId = requireString(d.diagnosis_id, `diagnoses[${index}].diagnosis_id`, { max: 128 });
      if (!CERTAINTY.includes(d.certainty)) {
        fail('CERTAINTY_INVALID', `diagnoses[${index}].certainty must be one of ${CERTAINTY.join(', ')}.`);
      }
      if (typeof d.is_primary !== 'boolean') {
        fail('PRIMARY_TYPE', `diagnoses[${index}].is_primary must be a boolean.`);
      }
      return {
        diagnosis_id: diagnosisId,
        code_system: optionalString(d.code_system, `diagnoses[${index}].code_system`, { max: 64 }),
        code: optionalString(d.code, `diagnoses[${index}].code`, { max: 64 }),
        display: requireString(d.display, `diagnoses[${index}].display`, { max: 500 }),
        certainty: d.certainty,
        is_primary: d.is_primary
      };
    })
    .sort((a, b) => (a.diagnosis_id < b.diagnosis_id ? -1 : a.diagnosis_id > b.diagnosis_id ? 1 : 0));
}

function normalizePrescriptions(prescriptions = []) {
  if (!Array.isArray(prescriptions)) fail('PRESCRIPTIONS_TYPE', 'prescriptions must be an array.');
  return prescriptions
    .map((p, index) => {
      if (!p || typeof p !== 'object') fail('PRESCRIPTION_TYPE', `prescriptions[${index}] must be an object.`);
      const duration = p.duration_days;
      if (duration !== null && duration !== undefined) {
        if (!Number.isInteger(duration) || duration <= 0 || duration > 365) {
          fail('DURATION_INVALID', `prescriptions[${index}].duration_days must be an integer in 1..365 or null.`);
        }
      }
      return {
        prescription_id: requireString(p.prescription_id, `prescriptions[${index}].prescription_id`, { max: 128 }),
        medication_name: requireString(p.medication_name, `prescriptions[${index}].medication_name`, { max: 200 }),
        rxnorm_code: optionalString(p.rxnorm_code, `prescriptions[${index}].rxnorm_code`, { max: 32 }),
        dose: requireString(p.dose, `prescriptions[${index}].dose`, { max: 120 }),
        route: requireString(p.route, `prescriptions[${index}].route`, { max: 60 }),
        frequency: requireString(p.frequency, `prescriptions[${index}].frequency`, { max: 120 }),
        duration_days: duration === undefined ? null : duration
      };
    })
    .sort((a, b) =>
      a.prescription_id < b.prescription_id ? -1 : a.prescription_id > b.prescription_id ? 1 : 0
    );
}

function normalizeProposals(proposals = []) {
  if (!Array.isArray(proposals)) fail('PROPOSALS_TYPE', 'proposals must be an array.');
  return proposals
    .map((p, index) => {
      if (!p || typeof p !== 'object') fail('PROPOSAL_TYPE', `proposals[${index}] must be an object.`);
      if (!PROPOSAL_KINDS.includes(p.kind)) {
        fail('PROPOSAL_KIND', `proposals[${index}].kind must be one of ${PROPOSAL_KINDS.join(', ')}.`);
      }
      return {
        proposal_id: requireString(p.proposal_id, `proposals[${index}].proposal_id`, { max: 128 }),
        kind: p.kind,
        content_hash: requireHash(p.content_hash, `proposals[${index}].content_hash`)
      };
    })
    .sort((a, b) => (a.proposal_id < b.proposal_id ? -1 : a.proposal_id > b.proposal_id ? 1 : 0));
}

/**
 * Build the closed attest_v1 object. Unknown input keys are ignored; the output
 * has exactly the fields below, in canonical (sorted) order at hash time.
 */
function buildAttestationContent({
  tenantId,
  encounterId,
  patientId,
  note,
  diagnoses = [],
  prescriptions = [],
  proposals = [],
  kernel = null,
  attestedBy,
  attestedAt
} = {}) {
  requireString(tenantId, 'tenant_id', { max: 128 });
  requireString(encounterId, 'encounter_id', { max: 128 });
  requireString(patientId, 'patient_id', { max: 128 });

  if (!note || typeof note !== 'object') fail('NOTE_REQUIRED', 'note is required.');
  const noteId = requireString(note.note_id, 'note.note_id', { max: 128 });
  if (note.schema_version !== NOTE_SCHEMA_VERSION) {
    fail('NOTE_SCHEMA_VERSION', `note.schema_version must be '${NOTE_SCHEMA_VERSION}'.`, {
      received: note.schema_version
    });
  }
  if (!isPlainObject(note.content)) fail('NOTE_CONTENT', 'note.content must be a plain object.');

  if (!attestedBy || typeof attestedBy !== 'object') fail('ATTESTOR_REQUIRED', 'attested_by is required.');
  if (!ROLES.includes(attestedBy.role)) {
    fail('ATTESTOR_ROLE', `attested_by.role must be '${ROLES[0]}'; only a physician may attest.`);
  }

  const normalizedKernel =
    kernel === null
      ? null
      : {
          version: requireString(kernel.version, 'kernel.version', { max: 64 }),
          verdict_hash: requireHash(kernel.verdict_hash, 'kernel.verdict_hash', { allowNull: true })
        };

  return {
    attestation_version: ATTESTATION_VERSION,
    tenant_id: tenantId,
    encounter_id: encounterId,
    patient_id: patientId,
    note: {
      note_id: noteId,
      schema_version: NOTE_SCHEMA_VERSION,
      content: note.content
    },
    diagnoses: normalizeDiagnoses(diagnoses),
    prescriptions: normalizePrescriptions(prescriptions),
    proposals: normalizeProposals(proposals),
    kernel: normalizedKernel,
    attested_by: {
      actor_id: requireString(attestedBy.actor_id, 'attested_by.actor_id', { max: 128 }),
      actor_name: requireString(attestedBy.actor_name, 'attested_by.actor_name', { max: 200 }),
      role: attestedBy.role,
      npi: optionalString(attestedBy.npi, 'attested_by.npi', { max: 32 })
    },
    attested_at: requireTimestamp(attestedAt, 'attested_at')
  };
}

function computeContentHash(content) {
  return `${HASH_PREFIX}${sha256Hex(canonicalize(content))}`;
}

/**
 * Chain hash binds position, predecessor, content, signer, and time. It does
 * not change when the same content is re-verified.
 */
function computeChainHash({ seq, prevHash, contentHash, attestedAt, actorId }) {
  if (!Number.isInteger(seq) || seq <= 0) fail('SEQ_INVALID', 'seq must be a positive integer.');
  const previous = prevHash === null || prevHash === undefined ? null : requireHash(prevHash, 'prev_hash');
  const content = requireHash(contentHash, 'content_hash');
  requireTimestamp(attestedAt, 'attested_at');
  requireString(actorId, 'actor_id', { max: 128 });

  return hashOf({
    seq,
    prev_hash: previous,
    content_hash: content,
    attested_at: attestedAt,
    actor_id: actorId
  });
}

/**
 * Verify one row against its predecessor.
 *
 * Expected row shape (from clinical_attestations):
 *   { seq, prev_hash, content_canonical, content_hash, chain_hash,
 *     attested_at, actor_id }
 */
function verifyAttestation(row, previous = null) {
  const errors = [];

  if (!row || typeof row !== 'object') {
    return { valid: false, errors: [{ code: 'ROW_INVALID', message: 'row is not an object' }] };
  }

  if (typeof row.content_canonical !== 'string') {
    errors.push({ code: 'CANONICAL_MISSING', message: 'content_canonical must be stored as TEXT.' });
  } else {
    let parsed;
    try {
      parsed = JSON.parse(row.content_canonical);
    } catch (err) {
      errors.push({ code: 'CANONICAL_PARSE', message: `content_canonical is not valid JSON: ${err.message}` });
    }
    if (parsed !== undefined) {
      const recanonicalized = canonicalize(parsed);
      if (recanonicalized !== row.content_canonical) {
        errors.push({
          code: 'CANONICAL_MISMATCH',
          message: 'content_canonical is not in canonical form; it was modified or produced by a different serializer.'
        });
      }
      const expectedContentHash = computeContentHash(parsed);
      if (row.content_hash !== expectedContentHash) {
        errors.push({
          code: 'CONTENT_HASH_MISMATCH',
          message: 'content_hash does not match the canonical content.',
          expected: expectedContentHash,
          actual: row.content_hash
        });
      }
    }
  }

  const expectedPrev = previous ? previous.chain_hash : null;
  if ((row.prev_hash ?? null) !== (expectedPrev ?? null)) {
    errors.push({
      code: 'PREV_HASH_MISMATCH',
      message: 'prev_hash does not match the previous row in the chain.',
      expected: expectedPrev,
      actual: row.prev_hash
    });
  }

  if (previous && row.seq !== previous.seq + 1) {
    errors.push({
      code: 'CHAIN_GAP',
      message: 'seq is not contiguous with the previous row.',
      expected: previous.seq + 1,
      actual: row.seq
    });
  }

  if (!Number.isInteger(row.seq) || row.seq <= 0) {
    errors.push({ code: 'SEQ_INVALID', message: 'seq must be a positive integer.' });
  }

  if (errors.length === 0) {
    const expectedChainHash = computeChainHash({
      seq: row.seq,
      prevHash: row.prev_hash ?? null,
      contentHash: row.content_hash,
      attestedAt: row.attested_at,
      actorId: row.actor_id
    });
    if (row.chain_hash !== expectedChainHash) {
      errors.push({
        code: 'CHAIN_HASH_MISMATCH',
        message: 'chain_hash does not match the chain inputs.',
        expected: expectedChainHash,
        actual: row.chain_hash
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Verify a tenant's chain in seq order. Returns the first broken seq.
 */
function verifyChain(rows = []) {
  if (!Array.isArray(rows)) return { valid: false, errors: [{ code: 'CHAIN_INPUT', message: 'rows must be an array' }] };

  const ordered = [...rows].sort((a, b) => a.seq - b.seq);
  const tenantIds = new Set(ordered.map((row) => row.tenant_id).filter(Boolean));
  if (tenantIds.size > 1) {
    return {
      valid: false,
      brokenAt: null,
      errors: [{ code: 'TENANT_MISMATCH', message: 'rows from more than one tenant were passed to one chain.' }]
    };
  }
  let previous = null;
  for (const row of ordered) {
    const result = verifyAttestation(row, previous);
    if (!result.valid) {
      return { valid: false, brokenAt: row.seq ?? null, errors: result.errors };
    }
    previous = row;
  }
  return { valid: true, brokenAt: null, errors: [], length: ordered.length, head: previous?.chain_hash ?? null };
}

module.exports = {
  ATTESTATION_VERSION,
  NOTE_SCHEMA_VERSION,
  HASH_PREFIX,
  AttestationError,
  canonicalize,
  sha256Hex,
  hashOf,
  buildAttestationContent,
  computeContentHash,
  computeChainHash,
  verifyAttestation,
  verifyChain
};
