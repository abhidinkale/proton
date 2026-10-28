# Attestation canonical JSON — `attest_v1`

**Status:** proposed, reviewed against the code in this workspace.
**Implementation:** [`apps/api/services/workflow/attestation.js`](../../apps/api/services/workflow/attestation.js)
**Tests:** [`apps/api/tests/attestation_canonical_validation.cjs`](../../apps/api/tests/attestation_canonical_validation.cjs)

The point of this document is to pin the exact bytes that a physician's
signature covers. "Canonicalize" is not a specification. This is.

---

## 1. The decision

**RFC 8785 JSON Canonicalization Scheme (JCS), restricted to the subset the
attestation needs.** The restrictions are not a new format; they remove values
that JCS allows but that can differ across languages or runtimes.

| Rule | Decision |
|---|---|
| Encoding | UTF-8, no BOM |
| Whitespace | none |
| Object keys | sorted by UTF-16 code units (JavaScript default string order) |
| Strings | JSON escapes; unpaired surrogates are rejected |
| Numbers | ECMAScript `Number::toString`; `-0` → `0`; NaN/Infinity rejected |
| Decimals | **strings**, not numbers, for all measurements (`"38.4"`) |
| Integers | numbers, limited to safe integers (severity, duration_days, seq) |
| Arrays | order preserved; diagnoses/prescriptions/proposals are sorted by id **before** hashing |
| `undefined` | rejected; optional fields use `null` |
| Objects | plain objects only; Date/Map/Set/class instances rejected |
| Cycles | rejected |
| Timestamps | `YYYY-MM-DDTHH:mm:ss.sssZ`, UTC, milliseconds mandatory |

Why decimals are strings: JCS number formatting is deterministic inside one
runtime, but a verifier in Python or Java can format a float differently at the
edges. A temperature is a measurement with a unit, not an arithmetic operand.
Making it a string removes the entire class of cross-language hash drift. The
cost is that a consumer must parse `"38.4"` before doing math; that is the
right place to pay it.

Why `content_canonical` is stored as `TEXT`, not `JSONB`: Postgres JSONB
normalizes numbers and key order. Hashing the JSONB rendering after a dump and
restore can produce a different hash. The row stores the exact canonical text;
`content` may also be stored as JSONB for queries, but it is never the hash
input.

---

## 2. The exact field list (closed)

Unknown fields are not silently included. The builder emits exactly these.

| Field | Type | Notes |
|---|---|---|
| `attestation_version` | string | `"attest_v1"` |
| `tenant_id` | string | non-empty |
| `encounter_id` | string | non-empty |
| `patient_id` | string | non-empty |
| `note.note_id` | string | non-empty |
| `note.schema_version` | string | must be `"note_v1"` |
| `note.content` | object | validated by `note_v1` before this step |
| `diagnoses[]` | array | sorted by `diagnosis_id` |
| `diagnoses[].diagnosis_id` | string | |
| `diagnoses[].code_system` | string \| null | |
| `diagnoses[].code` | string \| null | |
| `diagnoses[].display` | string | |
| `diagnoses[].certainty` | enum | `PROPOSED` \| `CONFIRMED` \| `RULED_OUT` |
| `diagnoses[].is_primary` | boolean | |
| `prescriptions[]` | array | sorted by `prescription_id` |
| `prescriptions[].prescription_id` | string | |
| `prescriptions[].medication_name` | string | |
| `prescriptions[].rxnorm_code` | string \| null | |
| `prescriptions[].dose` | string | |
| `prescriptions[].route` | string | |
| `prescriptions[].frequency` | string | |
| `prescriptions[].duration_days` | integer \| null | 1..365 |
| `proposals[]` | array | sorted by `proposal_id` |
| `proposals[].proposal_id` | string | |
| `proposals[].kind` | enum | `note` \| `differential` \| `prescription` \| `summary` |
| `proposals[].content_hash` | string | `sha256:` + 64 hex |
| `kernel.version` | string | e.g. `kernel_v1` |
| `kernel.verdict_hash` | string \| null | hash of the canonical kernel verdict |
| `attested_by.actor_id` | string | |
| `attested_by.actor_name` | string | snapshot, not a join |
| `attested_by.role` | string | must be `"physician"` |
| `attested_by.npi` | string \| null | |
| `attested_at` | string | ISO-8601 UTC with milliseconds |

`kernel` may be `null` when no kernel-bearing proposal exists. If it is present,
both fields are required.

### What is deliberately not in the hash

| Excluded | Why |
|---|---|
| `attestation.id` | generated after the content; including it would make the hash depend on a database default |
| `seq` | chain position is bound by `chain_hash`, not by the content |
| `prev_hash` | same |
| `chain_hash` | it is the output |
| server `created_at` | a clock reading, not a clinical assertion |
| request id, IP, user agent | operational metadata belongs in an envelope, not a signature |
| model latency/cost | not clinical content |

If an auditor needs the excluded values, store them in a separate envelope
table keyed by `attestation.id`. Do not add them to `attest_v1`.

---

## 3. Canonical example

The object (pretty-printed for reading):

```json
{
  "attestation_version": "attest_v1",
  "tenant_id": "org-1",
  "encounter_id": "enc-1",
  "patient_id": "pat-1",
  "note": {
    "note_id": "note-1",
    "schema_version": "note_v1",
    "content": {
      "schema_version": "note_v1",
      "subjective": {
        "chief_complaint": {
          "text": "Sore throat",
          "onset": "2 days",
          "duration": "2 days",
          "severity": 6
        }
      },
      "plan": { "medications": [] }
    }
  },
  "diagnoses": [
    {
      "diagnosis_id": "dx-1",
      "code_system": "ICD-10",
      "code": "J02.0",
      "display": "Streptococcal pharyngitis",
      "certainty": "CONFIRMED",
      "is_primary": true
    }
  ],
  "prescriptions": [
    {
      "prescription_id": "rx-1",
      "medication_name": "Amoxicillin",
      "rxnorm_code": "723",
      "dose": "500 mg",
      "route": "PO",
      "frequency": "three times daily",
      "duration_days": 10
    }
  ],
  "proposals": [
    {
      "proposal_id": "prop-1",
      "kind": "prescription",
      "content_hash": "sha256:bbbb…bbbb"
    }
  ],
  "kernel": {
    "version": "kernel_v1",
    "verdict_hash": "sha256:cccc…cccc"
  },
  "attested_by": {
    "actor_id": "usr-md-1",
    "actor_name": "Dr. A",
    "role": "physician",
    "npi": "1928374650"
  },
  "attested_at": "2026-10-28T07:00:00.000Z"
}
```

The canonical text is one line, keys sorted. Its exact beginning is:

```text
{"attestation_version":"attest_v1","attested_at":"2026-10-28T07:00:00.000Z","attested_by":{"actor_id":"usr-md-1","actor_name":"Dr. A","npi":"1928374650","role":"physician"},"diagnoses":[{"certainty":"CONFIRMED","code":"J02.0","code_system":"ICD-10","diagnosis_id":"dx-1","display":"Streptococcal pharyngitis","is_primary":true}],"encounter_id":"enc-1",...
```

Pinned hashes for this vector (see the test, which fails if the canonical form
changes):

```text
content_hash = sha256:524ec1dcb65d3da1bab89476c3df03280c63ea28f1e12a4a29884c61da9e3b04
chain_hash   = sha256:10237bd092b620d7b5828c5c5202730692f2de994053c121ce9ddc8278afcb52
               (seq = 1, prev_hash = null, actor_id = usr-md-1)
```

A verifier in another language should reproduce both strings byte-for-byte
before it is trusted. If it cannot, it must refuse, not "approximately match."

The vector is deliberately minimal: it pins the canonical form, not a clinically
complete note. A real note passes `note_v1` validation first; the vector does not,
because it is testing the hash, not the schema.

---

## 4. Hash chain

Two hashes, two jobs:

```text
content_hash = "sha256:" + SHA256( UTF8( JCS(content) ) )

chain_hash   = "sha256:" + SHA256( UTF8( JCS({
  seq,
  prev_hash,       // previous chain_hash, or null at genesis
  content_hash,
  attested_at,
  actor_id
}) ) )
```

`content_hash` answers "what was signed?" `chain_hash` answers "where in the
sequence, after what, by whom, at what time?" Binding `seq` makes deletion and
reordering detectable; binding `prev_hash` makes insertion detectable.

`seq` is a **per-tenant** counter, not a global `BIGSERIAL`. A global sequence
leaves gaps in each tenant's chain (other tenants' rows consume numbers), and a
gap is exactly what `verifyChain` treats as a deletion. A tenant-wide chain is
still simpler to verify and harder to truncate than one chain per encounter.

### Storage

```sql
-- One row per tenant; the atomic allocator for seq.
CREATE TABLE IF NOT EXISTS clinical_attestation_chain (
  tenant_id  TEXT PRIMARY KEY,
  next_seq   BIGINT NOT NULL DEFAULT 1 CHECK (next_seq > 0)
);

CREATE TABLE IF NOT EXISTS clinical_attestations (
  tenant_id        TEXT NOT NULL,
  seq              BIGINT NOT NULL CHECK (seq > 0),
  id               TEXT NOT NULL UNIQUE,
  encounter_id     TEXT NOT NULL REFERENCES encounters(id),
  patient_id       TEXT NOT NULL REFERENCES patients(id),
  actor_id         TEXT NOT NULL,
  actor_name       TEXT NOT NULL,
  actor_role       TEXT NOT NULL CHECK (actor_role = 'physician'),
  note_id          TEXT NOT NULL REFERENCES notes(id),
  content_canonical TEXT NOT NULL,
  content_hash     TEXT NOT NULL,
  prev_hash        TEXT,
  chain_hash       TEXT NOT NULL,
  attested_at      TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_clinical_attestations_encounter
  ON clinical_attestations(tenant_id, encounter_id);
CREATE INDEX IF NOT EXISTS idx_clinical_attestations_note
  ON clinical_attestations(note_id);
```

Allocate the sequence inside the sign transaction with one atomic upsert:

```sql
INSERT INTO clinical_attestation_chain (tenant_id, next_seq)
VALUES ($1, 2)
ON CONFLICT (tenant_id) DO UPDATE
  SET next_seq = clinical_attestation_chain.next_seq + 1
RETURNING next_seq - 1 AS seq;
```

The first attestation for a tenant gets `seq = 1`; each subsequent one gets the
old `next_seq`. `prev_hash` is the `chain_hash` of `(tenant_id, seq - 1)`, read
in the same transaction. Two concurrent signs for one tenant serialize on the
counter row; two tenants do not contend.

The write happens in the same transaction as the `sign` transition. The row is
inserted with `content_canonical`, `content_hash`, `prev_hash`, `chain_hash`,
and `attested_at` all computed inside that transaction. If any other part of
the sign fails, the attestation rolls back with it.

### Proposal records

The proposals the physician saw are part of the content, by id and content
hash. Their full text lives in a separate table:

```sql
CREATE TABLE IF NOT EXISTS clinical_proposals (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  encounter_id       TEXT NOT NULL REFERENCES encounters(id),
  kind               TEXT NOT NULL CHECK (kind IN ('note', 'differential', 'prescription', 'summary')),
  model              TEXT NOT NULL,
  model_version      TEXT NOT NULL,
  prompt_version     TEXT NOT NULL,
  context_hash       TEXT NOT NULL,
  content            JSONB NOT NULL,
  content_canonical  TEXT NOT NULL,
  content_hash       TEXT NOT NULL,
  kernel_version     TEXT,
  kernel_verdict     JSONB,
  kernel_verdict_hash TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The attestation references `proposal_id` and `content_hash`; it does not
duplicate the proposal. The proposal's own canonical text is what the hash
covers.

---

## 5. Verification algorithm

For a tenant, in `seq` order:

1. `JSON.parse(content_canonical)`.
2. Re-canonicalize the parsed value with the same JCS rules.
3. Compare the result to `content_canonical` **exactly**. A pretty-printed or
   key-reordered string is a failure (`CANONICAL_MISMATCH`), even if the hash
   was recomputed to match it. This catches a serializer change or a tamper
   that recomputed the hash over a non-canonical form.
4. Recompute `content_hash` from the parsed value; compare.
5. Compare `prev_hash` to the previous row's `chain_hash` (or `null` for seq 1).
6. Check `seq` is contiguous. A gap is `CHAIN_GAP`.
7. Recompute `chain_hash` from `{seq, prev_hash, content_hash, attested_at, actor_id}`; compare.

Then a second, independent check:

8. Rebuild the content from the current `notes`, `diagnoses`, `prescriptions`,
   and `clinical_proposals` rows, canonicalize it, and compare its
   `content_hash` to the stored one. If the note changed after signing, this
   fails even though the chain itself is intact.

Step 8 is the one that catches "the note was edited and the attestation row was
left alone." Steps 1–7 only prove the attestation row is internally consistent.

### Tamper model

A hash chain inside the same Postgres is tamper-evident against an application
bug, a careless migration, or an attacker who can write rows but not rewrite the
chain. It is **not** tamper-proof against a database administrator who can
rewrite every row and recompute every hash. If the claim is "cryptographic,"
anchor a daily Merkle root outside the database:

- write the root to an object store with immutability/Object Lock, or
- obtain an RFC 3161 timestamp over the root, or
- publish the root in a signed transparency log.

Until one of those exists, the accurate phrase is "tamper-evident audit chain,"
not "cryptographic ledger."

---

## 6. Versioning

- `attestation_version` is inside the hash. Changing any field, any ordering
  rule, or any canonicalization rule requires `attest_v2`.
- A verifier must refuse an unknown `attestation_version`; it must not fall
  back to a best-effort parse.
- Existing rows are never re-hashed. A v2 row can coexist with v1 rows; the
  chain includes both, and each row's version tells the verifier which rules to
  apply. If the chain mixes versions, the chain hash input is the same shape, so
  verification remains possible.
- The pinned vector in the test is the guard. Updating it without a version
  bump is a defect.

---

## 7. Erasure and retention

The canonical content contains PHI. Two obligations conflict:

- the ledger wants immutability;
- GDPR/DPDP wants deletion.

The workable pattern is crypto-shredding: encrypt the canonical content (and
the note payload) with a per-patient data key; store the key in KMS. On a valid
erasure request, destroy the key. The attestation row remains, the hashes remain,
the chain verifies, and the content is unreadable. Record the erasure event
itself in the audit chain.

Do not store an unencrypted copy "for the auditors" and call the ledger
immutable; that is the version that fails a deletion request.

---

## 8. Acceptance tests

The current suite proves:

- JCS key ordering and number formatting, including the RFC 8785 numeric vector;
- rejection of NaN, Infinity, undefined, Date, Map, cycles, lone surrogates;
- stable content hash across input array order;
- physician-only attestation;
- exact timestamp format;
- mandatory dose/route/frequency;
- one changed character fails;
- non-canonical text is rejected even if the hash matches;
- a two-row chain verifies; a gap and a missing predecessor fail;
- a pinned `attest_v1` vector, so the canonical form cannot drift silently.

Not yet proven in this cut, because it needs the write path:

- the attestation is written in the same transaction as `sign`;
- the content rebuilt from current rows matches the attested hash;
- the daily root is anchored outside Postgres;
- the KMS erasure path.

Those are the next tests, not claims.
