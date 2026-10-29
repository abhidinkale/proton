# Proton — Spine-First Plan (v2)

**Supersedes:** v1 of this file. v1 sequenced "data → EHR → evidence → agents → patient" and treated the attestation ledger and outcome loop as downstream features. That was wrong. They are the product.

**Status:** plan, not a status report. `docs/VALIDATION.md` remains the source of truth for what is tested. Milestone numbering stays aligned with [`PROTON_MOAT_SEQUENCE.md`](./PROTON_MOAT_SEQUENCE.md) — **do not create a second roadmap with different names for the same work.**

---

## 0. The opening decision (gates everything below)

**Which market gives you one cohort, with a working follow-up channel, in 90 days?**

That is the only question that matters first, because the spine is not code — it is *labels*. A ledger with no outcomes is a notary. An outcome loop with no ledger is a survey. You need both, on one condition, in one clinic, inside one quarter.

| | India | US |
|---|---|---|
| Follow-up channel | WhatsApp / phone / IVR — near-universal, cheap | Portal + app — historically 10–25% response |
| Consent | DPDP + ABDM HIE-CM artefacts | HIPAA authorization |
| Incumbent to displace | none | Epic / athena |
| Certification gate | ABDM HIP registration | ONC HTI-1 (multi-quarter) |

**Recommendation: India first — for the dataset, not for the market.**

The outcome loop's viability is a function of follow-up reachability. A 70% response rate on WhatsApp costs you a fraction of what a 20% response rate costs through a US portal, and response rate *is* the moat metric. Prove the label loop in India where the channel works, then port the same spine to the US rail (TEFCA + SMART) where the revenue is.

This is not "India is easier." It is "the label loop is the asset, and India is where you can close it."

---

## 1. The spine

```
        clinician decision
                │
                ▼
   ┌───────────────────────────┐
   │  ATTESTATION LEDGER       │   what was decided, by whom, over exactly what bytes,
   │  attest_v1 + hash chain   │   against which kernel verdict, with which evidence
   └────────────┬──────────────┘
                │  binds encounter → diagnoses → prescriptions → evidence → outcome
                ▼
   ┌───────────────────────────┐
   │  OUTCOME LOOP             │   label_v1, one cohort, 30-day window,
   │  label_v1 + 3 numbers     │   documented non-response, published response rate
   └────────────┬──────────────┘
                │  turns signed decisions into a claim: "X worked, Y% of the time"
                ▼
        the only defensible asset
```

**Definition of done for the company, v1:**
> *A signed encounter is content-bound, externally verifiable, and joins to a 30-day outcome label with a published response rate — for one condition cohort, in one clinic, with zero manual reconciliation.*

Everything else is instrumentation that makes that sentence true or valuable.

---

## 2. What each workstream produces (each rung produces a number)

| Stage | Not "we shipped X" | Produces |
|---|---|---|
| **WS0** | Ledger exists | "100% of signed notes have a content-bound attestation; flipping one character fails verification" |
| **WS0.5** | Loop closes | "X% resolved, Y% documented non-response, Z% lost to follow-up — published" |
| **WS1** | Minimum surface to generate the dataset | "Every cohort encounter has a coded diagnosis and a scheduled follow-up that the labeler can join" |
| **WS2** | Evidence makes attestation meaningful | "0 uncited differentials; every citation resolves to a versioned row" |
| **WS3** | Agents make attestation necessary | "0 unsafe passes on the published adversarial list; kernel version recorded on 100% of proposals" |
| **WS4** | Patient closes the loop | "Follow-up captured at 48h/7d/30d; response rate ≥ N% with documented bias" |

Note the inversion: **WS4 is not last.** The patient app is the instrument that measures the outcome. It ships in the 90-day window, not in year two.

---

## 3. WS0 — single write path + attestation ledger + anchoring

**This is P0.1 + P0.2 + P0.6 from the moat sequence, plus anchoring. Nothing new is invented here; the specs already exist.**

### 3.1 Order of operations (P0.1 before P0.2 — non-negotiable)

You cannot bind a signature to bytes that exist in two disagreeing stores. `docs/moat/p0.1a-write-path-migration.md` is right: move the clinical trio (patients, appointments, notes) off SQLite first, or explicitly freeze the SQLite desk as demo-only.

| Step | Work | File |
|---|---|---|
| P0.1a | Clinical trio off SQLite → Postgres | `apps/api/storage/db.js`, `apps/api/scripts/backfill-clinic-desk.js`, `apps/api/api/clinic.js:66` |
| P0.1b | Interim honesty if migration slips: `PROTON_DB_PATH` in the backup tarball, named `LEGACY_DESK_TEMP` | `scripts/backup-to-r2.sh`, `scripts/restore-from-r2.sh` |
| P0.2 | `clinical_attestations` table, canonical `attest_v1`, hash chain, written **in the same transaction as `sign`** | `apps/api/services/workflow/attestation.js`, `encounterStateMachine.js:255` |
| P0.2 | Replace the boolean + constant string + fake merkle at `clinicRepository.js:1170` and `workflow.js:440` | those files |
| P0.6 | Consent + per-patient keys **before** any real outcome row | new `apps/api/services/consent/` |

### 3.2 Anchoring — specify it precisely

"External anchoring" means three different things and only two are sound.

| Layer | Mechanism | Verdict |
|---|---|---|
| **Chain** | `prev_hash` per tenant, append-only, recomputed on verify | Required. Already specified. |
| **External timestamp** | RFC 3161 Time-Stamp Authority over the daily chain root | **Do this.** Cheap, legally recognized, proves "this existed before T". |
| **Transparency log** | Append-only Merkle log (Trillian/Rekor-style) with signed checkpoints | **Do this** once >1 clinic. Gives inclusion + consistency proofs without a blockchain. |
| **Public chain** | On-chain anchoring | **Don't.** Adds cost, latency, jurisdictional ambiguity, and zero additional trust over a TSA + transparency log. |

**Legal caveat that must be written down now:** a hash chain is *evidence*, not a *signature*. Legal e-signature validity is a separate regime — ESIGN/UETA (US), and India's IT Act 2000 §3A (Aadhaar eSign / DSC / eSign-ESP). If you ever claim "legally signed," you will need a qualified signature provider. Do not let a hash chain be described as a digital signature in any UI string or doc.

### 3.3 Acceptance

- Recomputing from the stored note matches the attestation; one changed character fails.
- Attestation written in the same transaction as the state transition; a failed sign leaves the note `DRAFT`.
- Daily root anchored; verify endpoint returns TSA receipt + log inclusion proof.
- Backup + restore reproduces a signed note **and** its attestation.

---

## 4. WS0.5 — the outcome loop, 0–90 days, one cohort

`docs/moat/outcome-label-v1.md` is already a better spec than most companies have. Implement it; don't redesign it.

### 4.1 Cohort choice

Pick a condition with a **short, standardized natural history and a high follow-up willingness**: pharyngitis, UTI, or low back pain. Not diabetes, not hypertension. You need the loop closed in 30 days, not 12 months.

### 4.2 Minimum components

| Component | Where |
|---|---|
| `outcome_cohort` row created **at scheduling time**, not at response time | new migration beside `apps/api/db/moat/clinical-links.sql` |
| `outcomes` table + append-only labels + `label_version` | same |
| Labeler implementing precedence rules 1–5 and the `unknown` reason enum | new `apps/api/services/outcomes/labeler.js` |
| Follow-up scheduler with declared attempts per wave (48h / 7d / 30d) | extend `apps/dork-android/.../core/reminder/` + server scheduler |
| Three-number report, generated automatically, published even when bad | new `apps/api/scripts/outcome-report.js` |

### 4.3 Designing for response rate (the part that decides whether this is real)

Portal push alone will give you 20%. That is not a moat, it is a footnote. The loop must be multi-channel from day one:

1. **In-app** (already exists)
2. **WhatsApp template message** with a 3-button reply (better/same/worse) — highest reach in India
3. **IVR callback** for feature phones and low literacy
4. **SMS fallback** for everything else

Every attempt is logged with channel + timestamp, because `non_response_reason` must be *documented*, not assumed. `docs/moat/outcome-label-v1.md` already enforces `(label = 'unknown') = (non_response_reason IS NOT NULL)` at the DB level. Keep that.

### 4.4 The honesty rule

Publish the response rate **before** you know it, and publish it even if it's 34%. Pre-commit to the sensitivity analysis: responders vs non-responders differ in age, severity, and digital access. A label without a bias statement is marketing.

### 4.5 Acceptance

> At day 90: every mature cohort row has a label or a documented non-response reason; the report states positive %, documented non-response %, lost-to-follow-up %, and the channel mix.

---

## 5. WS1 — the minimum surface to *produce attestable encounters*

Not "EHR parity." The minimum surface is defined by the labeler's joins, not by feature checklists.

**The counter-intuitive consequence: the first EHR surface you need is not e-prescribing. It is coded diagnosis + scheduled follow-up.**

Because `label_v1` joins on `(encounter, condition_code)` and requires a follow-up to have been scheduled at index time, the prerequisites are:

| Prerequisite | Why the labeler needs it | Status |
|---|---|---|
| Coded diagnosis (SNOMED/ICD-10) | the cohort key | text-only today → **fix** |
| Signed note (`note_v1`) | the attestation payload | schema exists, not enforced |
| Scheduled follow-up | the cohort row's existence | `durableBooking` exists |
| Prescription with RxNorm | the treatment being evaluated | text-only today → **fix** |
| Encounter state machine | `SIGNED` is the cohort entry gate | exists (`encounterStateMachine.js`) |

**So WS1's done criterion is:**

> A clinician can code a diagnosis, sign a note, schedule a follow-up, and prescribe — and 100% of those encounters produce a joinable cohort row, with zero manual reconciliation.

e-Rx (Surescripts/EPCS), labs, immunizations, CCDA ingest: **after** the above, and gated by the market decision in §0, not by a feature list.

---

## 6. WS2 / WS3 / WS4 — re-scoped to serve the spine

### WS2 — evidence exists to make the attestation *mean* something

The attestation says "the physician decided X." WS2 makes X defensible.

- Replace the 64-dim hash pseudo-embedding in `services/evidence/pgvectorClinicalMemory.js` with real retrieval. Delete or rename the current file — it is a credibility landmine.
- `citationVerifier.js`: every differential entry cites a versioned KB row or says "no criterion met." `docs/moat/README.md` P1.3 already requires this.
- **Done:** 0 uncited differential entries; citation coverage % published.

### WS3 — agents exist to make the attestation *necessary*

An agent that nobody has to sign is a demo. An agent whose proposal is bound into a signed attestation is a product.

- Wire `kernel_verdict` onto every proposal (P1.4), bound into `attest_v1.proposals[]`.
- Eval harness before more agents (P2.4). 6 deep + 1 falsifier. Registry keeps 70; runtime exposes 3.
- **Done:** 0 unsafe passes on the published adversarial list; kernel version on 100% of proposals.

### WS4 — the patient app closes the loop

Its job in the first 90 days is **one thing**: capture the follow-up and prove the response rate. Booking, records, reminders, and the passport all matter — but they are the retention layer that makes the follow-up channel reachable. Treat them as infrastructure for the loop, not as parallel products.

---

## 7. Regulatory workstream (R0) — gates WS1, not after it

Six to twelve months of scope can be avoided with two weeks of writing.

| Artifact | Why | When |
|---|---|---|
| **Regulatory determination memo** — is this CDS or SaMD? | FDA's 2022 CDS guidance turns on clinician-independence, transparency of basis, and whether the output is a recommendation vs a directive. Write down which criterion each feature meets. | Before WS1 |
| **Claims register** (`docs/CLAIMS.md`) | Every user-visible claim mapped to the code that proves it. This is what your truthfulness audit did manually — make it a living file. | Before WS1 |
| **India:** CDSCO SaMD classification + NMC Telemedicine Guidelines + DPDP consent artefacts | determines whether you need a licence and what consent text must say | Before India pilot |
| **US:** HIPAA BAA with every model provider, ONC HTI-1 scope memo | `docs/BETA_READINESS.md:71` already flags the BAA gap | Before any US PHI |

**Hard rule:** no autonomous diagnosis output, ever, in v1. Clinician-in-the-loop with transparent rationale keeps you outside device regulation. One autonomous-diagnosis feature reclassifies the product.

---

## 8. Cuts, enforced by CI (not tables)

Tables get ignored. Gates don't.

| Cut | Gate |
|---|---|
| "Epic parity" / "Cerner parity" claims | `scripts/check-claims.js` greps `apps/web/src` + docs for banned strings; `docs/CLAIMS.md` is the only allowlist. Fails CI. |
| Unvalidated profile claims | `fhirService.js:462` asserts US Core 3.1.1 → gate requires a passing `$validate` against US Core **or** the string is removed. |
| Text-only coding | `fhir_conformance.test.js` fails if any `Condition.code` or `MedicationRequest.medicationCodeableConcept` lacks `system` + `code`. |
| Uncited differentials | `evidence_citation_validation.cjs` fails on any proposal without a resolving citation. |
| Unsigned-but-attested | `attestation_canonical_validation.cjs` extended: no `SIGNED` encounter without a matching attestation row. |
| >6 runtime agents | registry test asserts runtime exposure count. |
| Fake vector search | CI fails if `EVIDENCE_MODE=static` is the default in a deployed env. |

**Rationale:** every cut above has already regressed once in this repo. A document did not stop it; a test will.

---

## 9. One fixture factory (merge synthetic cohort + eval harness)

Today these are three separate efforts with three different schemas: the synthetic demo cohort (`apps/web/src/services/demoPatient.ts`), the eval sets in `apps/api/tests/`, and the future outcome cohort.

Merge them into **one generator**:

```
Synthea (or hand-authored) patient journeys
        │
        ├─► ground-truth sidecar (diagnosis, treatment, expected label)
        │
        ├─► eval set (P2.4: 300–500 adjudicated cases)
        ├─► adversarial kernel cases (published list)
        └─► labelable cohort (same encounters, synthetic follow-ups)
```

One schema, three consumers. This is `P2.5` in the moat sequence, and it should exist **before** P2.4 so that the eval set and the label set cannot drift apart. It also gives you a way to test the labeler end-to-end without a real clinic, which is what makes the 90-day deadline achievable while the clinic contract is still being signed.

---

## 10. The 90-day calendar

| Week | Work | Gate |
|---|---|---|
| 1–2 | §0 market decision signed off; R0 memo + claims register started; P0.1a scoped | R0 memo exists |
| 3–4 | P0.1a migration; interim backup honesty if it slips | Signed note is a Postgres row; restore reproduces it |
| 5–6 | P0.2 attestation + canonical JSON + same-transaction write | Hash verifies; one character fails |
| 7 | TSA anchoring + verify endpoint | External receipt verifies |
| 8–9 | Coded diagnosis + RxNorm (WS1 minimum) + conformance gate | 0 text-only codings |
| 10–11 | `outcome_cohort` + labeler + multi-channel follow-up scheduler | Labeler passes fixture suite incl. `unknown` reasons |
| 12 | One cohort live; three-number report; merge fixture factory | Report generated automatically, response rate published |

**If only one thing survives the quarter, it must be week 12.** A ledger with no labels is a notary; a label with no ledger is a survey.

---

## 11. What changed from v1 (so the diff is auditable)

1. Ledger and outcome loop promoted from features to the spine; every workstream re-scoped to serve them.
2. P0.1 (SQLite→Postgres, `docs/moat/p0.1a-write-path-migration.md`) moved ahead of the FHIR split-brain fix — a signature cannot bind to bytes that live in two stores.
3. Outcome loop pulled from 18 months to 0–90 days, one cohort, three published numbers.
4. WS1 redefined: minimum surface = **coded diagnosis + signed note + scheduled follow-up + RxNorm**, not e-Rx parity. The labeler's joins define the EHR scope.
5. Regulatory workstream (R0) added as a WS1 gate.
6. India-vs-US decision moved to §0, reframed as *which market closes the label loop fastest* — recommending India for the dataset, US for revenue.
7. Cuts converted from tables into CI gates, with a claims register as the allowlist.
8. Synthetic cohort, eval set, adversarial list, and labelable cohort merged into one fixture factory.
9. Anchoring specified as TSA + transparency log, explicitly **not** on-chain, with the e-signature legal caveat written down.

---

## 12. Mark 0.1 — as built (working tree, 2026-10-29)

This section is a status report, unlike the rest of the file. It records what
the code does now, so the demo plan and the pitch cannot drift from it.

### 12.1 Option A, scoped

`services/workflow/attestation.js` is a pure library (no DB, no `pg_database`),
and `signNote` had three references. Option A was therefore a **route**, not a
rewrite:

- `clinical_attestations` (migration 10) stores `content_canonical` as `TEXT`,
  never JSONB. Verification reads only that column.
- The attestation is appended **in the same Postgres transaction** as
  `PENDING_REVIEW → SIGNED`, under `pg_advisory_xact_lock(hashtext('attest:'||tenant))`.
- No valid `note_v1` → no signature (`422 NOTE_SCHEMA_INVALID`).
- The Care Loop SOAP desk still writes SQLite (`clinicRepository.signNote`).
  **This is disclosed debt, not a claim of one store.** The certified path is
  `/api/workflow`.

### 12.2 What is real in the demo

| Beat | Real mechanism | Proof |
|---|---|---|
| Sign | Postgres transaction + attestation ledger | `POST /encounters/:id/transitions {action:sign,attestation:true}` |
| Verify outside the app | the route returns the signed bytes; recomputation uses them only | `curl /attestations/:id/verify` → `valid:true` |
| Tamper | `UPDATE content_canonical` in psql | `valid:false`, `CONTENT_HASH_MISMATCH` |
| Restore | same bytes | `valid:true`, same `content_hash` |
| Recurrence | exact SNOMED match (`43878008`) across two encounters | prior episode 2025-11-03, amoxicillin, `resolved` at 30 days |
| Follow-up | patient token → `outcomes` row + `outcome_cohort` status | `label: improved`, `window_days: 2` |
| Denominator | cohort row created at **signature** | `outcome_cohort` exists before the reply |

`scripts/demo-rehearsal.sh` asserts all eight beats and exits non-zero on the
first failure. Run it before the demo.

### 12.3 Disclosures that must stay on the slide

1. **The 2-second poll is a debug build.** `POLL_INTERVAL_MS` is 2 s when
   `BuildConfig.DEBUG`, 15 s in release. The sync is real; the interval is a
   build-type difference and we say so.
2. **"11 months", not "2 years".** 2025-11-03 → 2026-10-29 is 11.8 months.
3. **Storage is split.** Workflow + ledger + outcomes are Postgres. The Care
   Loop desk is SQLite. One sentence, no euphemism.
4. **`resolved` is not produced by a 48-hour answer.** Only a completed 30-day
   window can produce it. The demo shows `improved`.
5. **The outcome label is a patient-reported signal**, with response bias and
   natural history disclosed next to it. It is not "the treatment worked".
6. **No Merkle tree, no blockchain.** The escalation payload now carries
   `reasoningTree.hash`, a SHA-256 over canonical JSON, and says so.

### 12.4 Killed in this pass (credibility debt)

- `escalationRouter` fake Merkle root (`sha256(encounterId + timestamp)`) →
  content hash over the claims.
- `pgvectorClinicalMemory` (64-slot hash sold as a 768-dim embedding) →
  `clinicalKnowledgeIndex`, deterministic keyword retrieval with citations.
- `modelGateway.embed()` sine-wave "embeddings" → throws
  `EMBEDDING_NOT_IMPLEMENTED` instead of returning a vector no one can trust.
- The no-op "semantic embedding commit" in `closedLoopEncounterService`.

### 12.5 Still open

- The 30-day label job (§7 of `docs/moat/outcome-label-v1.md`) is not built;
  `resolved` for new data must come from it or an import.
- `fhirService.js` still claims US Core 3.1.1 without a validation run.
- `EHR-SYNC-*` receipts are local, not external acknowledgements.
- `evidenceLedgerAudit.js` still calls a root hash a "Merkle root equivalent".
