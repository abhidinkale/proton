# Moat artifacts — schemas before implementation

This directory is the contact surface between the plan and the code. It exists
so the schemas can be reviewed against acceptance tests before a migration or a
signing-path change is written.

**Read this first:** [`../PROTON_MOAT_SEQUENCE.md`](../PROTON_MOAT_SEQUENCE.md).

| Artifact | What it pins | Test |
|---|---|---|
| [`attestation-canonical-json.md`](./attestation-canonical-json.md) | the exact bytes a signature covers; `attest_v1` field list, JCS rules, hash chain, verification | [`attestation_canonical_validation.cjs`](../../apps/api/tests/attestation_canonical_validation.cjs) |
| [`note_v1.schema.json`](../../apps/api/schemas/note_v1.schema.json) | the structured note schema, generated from the Zod source | [`note_schema_validation.cjs`](../../apps/api/tests/note_schema_validation.cjs) |
| [`clinical-links.sql`](../../apps/api/db/moat/clinical-links.sql) | link edges, snapshots, outcomes, six node projections | [`clinical_links_sql_validation.cjs`](../../apps/api/tests/clinical_links_sql_validation.cjs) |
| [`clinical-links.queries.sql`](../../apps/api/db/moat/clinical-links.queries.sql) | the three traversals the pre-visit brief needs | same suite |
| [`p0.1a-write-path-migration.md`](./p0.1a-write-path-migration.md) | the staged move of patients, appointments, and notes from SQLite to Postgres | not executed |
| [`outcome-label-v1.md`](./outcome-label-v1.md) | `label_v1` rules, `unknown`, denominator, three numbers | schema tested; labeler not implemented |
| [`kernel-adversarial-cases.md`](./kernel-adversarial-cases.md) | the four `kernel_v1` bypasses, fixed in `kernel_v2`, plus two controls | [`kernel_safety_v2_validation.cjs`](../../apps/api/tests/kernel_safety_v2_validation.cjs), in CI |

Run the hermetic tests:

```bash
cd apps/api
node tests/attestation_canonical_validation.cjs
node tests/note_schema_validation.cjs
node tests/clinical_links_sql_validation.cjs   # needs Postgres
node scripts/probe-kernel-gaps.js              # diagnostic: 0 bypasses, 2 controls
node tests/kernel_safety_v2_validation.cjs     # gated regression: 14 checks
```

The SQL suite is registered in `tests/run-deterministic-suite.cjs` as
Postgres-required, so CI cannot skip it.

---

## 1. The six node shapes

A node is a `(node_type, node_id)` reference. The payload is a projection for
traversal and display; the source row is the truth. Nothing is copied into a
second clinical store.

| `node_type` | `node_id` | Payload keys | Source |
|---|---|---|---|
| `encounter` | `encounters.id` | `encounter_id`, `state`, `clinician_id`, `appointment_id`, `fhir_encounter_id` | existing |
| `note` | `notes.id` | `note_id`, `encounter_id`, `status`, `schema_version`, `signed_by`, `signed_at` | existing |
| `diagnosis` | `diagnoses.id` | `diagnosis_id`, `encounter_id`, `code_system`, `code`, `display`, `certainty`, `is_primary` | existing |
| `prescription` | `prescriptions.id` | `prescription_id`, `encounter_id`, `medication_name`, `rxnorm_code`, `dose`, `route`, `frequency`, `duration_days`, `status` | existing |
| `document` | `patient_documents.id` | `document_id`, `category`, `title`, `mime_type`, `sha256`, `source`, `uploaded_at` | existing |
| `outcome` | `outcomes.id` | `outcome_id`, `encounter_id`, `condition_code`, `label`, `label_version`, `window_days`, `window_complete`, `non_response_reason`, `assessed_at` | new (P1.5) |

All six are exposed by `clinical_nodes_v1` in `clinical-links.sql`. The first
five work today. The sixth activates when the `outcomes` table is created by
the same migration.

### Why the edge table does not copy payloads

If `clinical_nodes` stored a copy of each diagnosis, there would be two copies
of every clinical fact. They would drift. The edge table stores only the
reference:

```text
clinical_links(from_type, from_id) -> clinical_links(to_type, to_id)
```

Integrity is not a foreign key, because the target is polymorphic. It is:

- a writer that resolves the node before inserting (to be added with P1.1);
- the orphan query in `clinical-links.queries.sql`, run nightly;
- a test that inserts an orphan and proves the query finds it.

### The one relation that needs a physician

`CAUSED_BY` is never inferred. The table check enforces:

```sql
CHECK (relation <> 'CAUSED_BY' OR status IN ('authored', 'confirmed')),
CHECK (relation <> 'CAUSED_BY' OR (reason IS NOT NULL AND length(btrim(reason)) >= 10))
```

The UI label is "physician-attributed cause," not "cause." `RESOLVED_BY` with a
treatment and an outcome is a weaker causal claim; it is allowed as an
`authored`/`confirmed` link, with the outcome and time window attached.

---

## 2. The three queries, and what they proved

### Q1 — active problems and medications

The first run exposed a schema gap: `diagnoses` has `PROPOSED`, `CONFIRMED`,
and `RULED_OUT`, but no `RESOLVED`. "Confirmed" is not "active"; a resolved
strep throat would stay on the problem list forever.

The query therefore defines active as **confirmed and not the source of a
confirmed `RESOLVED_BY` edge**. That is a deliberate dependency on the link
layer. The test fixture proves it:

- `dx-1` is confirmed and resolved by `rx-1` → excluded;
- `dx-2` is confirmed and not resolved → included;
- `dx-3` is proposed → excluded;
- `rx-1` is expired → excluded; `rx-3` is in duration → included.

### Q2 — prior episode for a coded condition

Returns one row: the most recent prior encounter with the same code, every
signed treatment from that encounter, and the latest outcome for the same
condition. `before` is the current encounter's `created_at`, so the query
cannot return the encounter being prepared.

### Q3 — last outcome for a treatment

This is the join that makes an outcome label attach to a prescription. It
returns the latest signed prescription for a drug (RxNorm or name) and the
latest outcome for its encounter, filtered by condition when supplied, with the
day delta.

The test asserts `rx-3` (latest) joins to `out-3` (improved, `label_v1`).

### What the queries do not do

- They do not detect recurrence. That is a writer rule (same code, within 365
  days, `hypothesized` until a clinician confirms), not a read query.
- They do not resolve a diagnosis automatically. `RESOLVED_BY` is authored or
  confirmed; the query only respects it.
- They do not aggregate across patients. Population signals are P3 and have
  different statistical requirements.

---

## 3. Attestation: the four things that make it real

1. **Content binding.** `content_hash` covers note + diagnoses + prescriptions +
   proposal hashes + kernel verdict hash + attestor + time. One changed
   character fails.
2. **Canonical form.** RFC 8785, with decimals as strings and `content_canonical`
   stored as `TEXT`, not `JSONB`. A pinned vector prevents drift.
3. **Atomicity.** The attestation row is written in the same transaction as the
   `sign` transition. That is why P0.1 (one write path) comes first.
4. **External anchoring.** A chain inside Postgres is tamper-evident only against
   someone who cannot rewrite Postgres. If the claim is "cryptographic," anchor
   a daily root outside.

The current code has none of these at the signing surface: the cockpit sends a
constant attestation sentence, `signNote` stores it, and the UI showed
`merkleRoot: note.id`. The false Merkle label has been corrected to a record id;
the content binding is still missing. The module and the spec are ready; the
wiring is P0.2.

---

## 4. What changed from the review

| Review point | Where it landed |
|---|---|
| "Graph is the substrate, not the moat — say it explicitly" | `PROTON_MOAT_SEQUENCE.md` §1.1 and §4.1; the six node shapes above |
| "`CAUSED_BY` as a physician-attributed cause, not never" | `clinical-links.sql` check constraints; §1 above |
| "Harvey's corpus compounds" | §1.1 table corrected |
| "Pre-register the verifier promotion threshold" | §4.2 now states the threshold before the run |
| "P0.1 needs a demo-protection plan" | §3 P0.1 and §8 now include the tag/branch/both-demos merge gate, and the interim SQLite backup is named temporary |
| "Adversarial suite needs construction discipline" | `kernel-adversarial-cases.md` §1 and §5; the probe prints the case list, not a rate |
| "A known bypass is a P0 defect, not P1 coverage work" | `PROTON_MOAT_SEQUENCE.md` P0.7; fixed in `kernel_v2`, gated in `kernel_safety_v2_validation.cjs`; P1.4 is coverage/versioning |
| "Version the outcome label; keep both" | `outcome-label-v1.md` §5; `label_version` on every row |
| "Unknown inflation: report three numbers" | `outcome-label-v1.md` §4; `outcome_cohort` is the denominator |
| "Mobile build variants in P0" | §3 P0.5 |
| "Consent before outcome collection" | §3 P0.6 |
| "Read audit in the same store as the notes" | §3 P0.4 |
| "Narrative needs a number, or state the methodology" | §9 number gate |
| "Every rung produces a number" | §0.1 principle; each P0–P2 row has a "produces" column |

---

## 5. Open questions for the reviewer

1. **`note_v1` shape.** Is the core set right, or is `objective.vitals` too
   rigid at eight required nullable fields? The alternative is a keyed
   `observations[]` with LOINC codes, which is more correct and more work.
2. **`RESOLVED_BY` direction.** The current model is diagnosis → prescription.
   A treatment can resolve a condition without being the cause; is the edge
   enough, or does the outcome need its own node? The link target allows
   `outcome`; v1 does not write it.
3. **`window_complete` for `improved`.** Early improvement is labeled
   `improved`, not `resolved`. Is that the right line for the first cohort, or
   should early labels be suppressed entirely until 30 days?
4. **Attestation scope.** The content includes the full note. A 50 KB narrative
   makes a 50 KB canonical row. Is that acceptable, or should the note be
   hashed and the hash attested? The current decision is full content, because a
   hash of a hash is harder to explain to a regulator.
5. **`seq` scope.** Tenant-wide chain (current) vs per-encounter chain. Tenant-
   wide is simpler to verify and harder to truncate; per-encounter is easier to
   show a patient. The current decision is tenant-wide.
6. **External anchor.** Object Lock, RFC 3161, or a transparency log. The choice
   changes the operational runbook; it does not change the hash format.

---

## 6. What is not built

- The writer that creates `clinical_links` and snapshots.
- The transaction that writes `clinical_attestations` with `sign`.
- The proposal records (`clinical_proposals`) and their kernel verdicts.
- The labeler and the cohort scheduler.
- Renal/hepatic/pregnancy coverage beyond the first `kernel_v2` rules (P1.4).
- Any UI for the decision trail, compare visits, or the three outcome numbers.

Those are P0/P1 work, not this artifact set. This set exists so that work has a
contract to build against.
