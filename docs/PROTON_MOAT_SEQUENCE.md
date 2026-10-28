# Proton — The Moat, Sequenced

**Status:** planning document, 2026-10-28
**Question:** of everything in the "Groundbreaking Tech" brief, what should be built, in what order, and what does it actually depend on?
**No dates.** Sequence is expressed as dependency depth and gates, not weeks.
**Artifacts:** [`docs/moat/`](./moat/README.md) holds the reviewed schemas, canonical JSON, SQL, and adversarial cases this plan refers to.
**Status (2026-10-28):** P0.7 (kernel_v2) and P0.8 (bind the verdict to the write) are implemented and gated; P0.1–P0.6 and the P0.2/P0.3 wiring remain.

---

## 0. The answer in one paragraph

The brief is directionally right and strategically inverted. It treats the graph, the knowledge base, and the verifier as the moat, then asks for them first. But the comparables in its own table — Abridge, Nabla, Ambience, Harvey — did not win on architecture. They won on distribution, EHR integration, coding workflow, and clinical validation. Architecture is what makes the data usable; **the only thing in this list that compounds and cannot be copied quickly is outcome-labeled clinical data produced by a workflow a clinic actually uses every day.** Before Proton can accumulate that, it has one blocking problem the brief does not mention: the repository does not have "two apps, one database." It has three clinical stores, and the doctor's signature currently lands in the one the backup does not cover. Fix that, bind attestation to content, and make the note structured. Those three are the foundation. The graph, the knowledge base, the verifier, and the signals are all downstream of them.

### 0.1 The principle: every rung produces a number

The deeper correction is not sequencing. It is **what counts as evidence**. The original brief treated architecture as a moat because architecture is legible. Measured outcomes are a moat because they are not. Applied to this list, that gives a rule:

> Every item on the ladder must be justified by a number it produces, not by a system it adds. If it does not produce a number, it is not on the ladder.

P0.2 produces "the hash verifies; one character fails." P0.3 produces "100% of signed notes validate; every rejection carries a field path." P1.5 produces "X% positive, Y% documented non-response, Z% lost to follow-up." P2.4 produces "zero unsafe passes on a published adversarial list." That rule is why the verifier is an experiment and why the graph is a substrate, not a milestone.

---

## 1. Three corrections before any priority list

### 1.1 A feature is not a moat, and the brief's own table says so

| Company | What the brief says they sell | What that actually is |
|---|---|---|
| Abridge | clinical validation + health-system distribution | sales access and liability cover |
| Nabla | deep EHR integration + specialty templates | workflow lock-in |
| Ambience | ambient + coding/billing automation | revenue-cycle attachment |
| Harvey | proprietary workflow + case-law grounding | a domain-specific retrieval corpus (which does compound) plus workflow distribution; the corpus is the asset, not the workflow |

None of those is "a graph schema." A graph schema is a weekend of DDL. A clinic's 10,000 encounters with 30-day outcomes is not. The brief's list of five moats is right; its proposed build order optimises for the two that are *easiest to copy* (graph, KB) and defers the one that is *hardest* (outcome-labeled data) until last.

The correct strategic sentence is not "we have a clinical state graph." It is:

> "We have N clinics, M encounters, and a known outcome for X% of them. Our differential was right in the top three in Y% of adjudicated cases, and zero unsafe prescriptions passed the kernel in Z adversarial cases."

The graph is how you produce those numbers. It is not the number.

### 1.2 The repo has three clinical stores, not one

This is the finding that reorders everything.

| Store | What lives there | Written by | Covered by backup? |
|---|---|---|---|
| **Postgres** (`apps/api/db/workflowMigrations.js`) | `patients`, `appointments`, `encounters`, `encounter_events`, `notes`, `diagnoses`, `prescriptions`, `reports`, `outbox`, `patient_messages`, `audit`, `idempotency`, `documents` | workflow state machine, patient sync | **Yes** — `scripts/backup-to-r2.sh` runs `pg_dump` |
| **SQLite** (`apps/api/storage/db.js`, `storage/clinicRepository.js`) | clinic desk: `clinic_notes`, attention queue, appointments, notifications, audit chain | `/api/clinic/*`, including `signNote` | **No** — the backup script never touches `api_data/proton_ops.db` |
| **Medplum / FHIR** | read for context; agent writes are explicitly not implemented | not the agent stack | separate system |

Consequences that matter more than any feature in the brief:

- **The doctor's signature is not in the backed-up database.** `AmbientClinicalCockpit.handleSignEncounter` calls `clinicApi.signNote`, which calls `clinicRepository.signNote` → SQLite `clinic_notes`. The Postgres `workflow` path is a different signature surface. A restore drill that restores only Postgres restores an empty doctor's desk.
- **The encounter state machine is bypassed by the main signing UI.** The cockpit does not call `transitionEncounter({ action: 'sign' })`. So the 29-check state machine — the thing ADR 0004 calls "the only way anything is written" — is not the path the demo uses.
- **The "Merkle root" shown in the signature panel is `note.id`.** In `AmbientClinicalCockpit.tsx`, `merkleRoot: note.id`. There is no Merkle tree, no content hash, and no binding between the attestation string and the note it attests. The attestation string is a constant in the client.
- **Tenant isolation is app-layer on the workflow tables.** `tenant_id` appears 30 times in `workflowMigrations.js`, but there are no `ENABLE ROW LEVEL SECURITY` policies there. RLS exists only as DDL in `storage/postgresAdapter.js` for a *different* `encounters` table that the workflow path does not use. That is not a control; it is a schema fragment.

Any clinical graph, attestation ledger, or outcome loop built before this is resolved becomes a **fourth** store that reconciles with the other three. That is not a moat. It is a reconciliation liability.

### 1.3 Much of the "additions" list already exists, in part

The brief reads as if the app is a shell. It is not. Building the deltas, not duplicates, changes the scope by roughly half.

| Brief item | Already present | What is actually missing |
|---|---|---|
| M1 structured symptom capture | `IntakeScreen.kt` has onset buckets, 1–10 severity, a symptom catalog | character, aggravating/relieving, associated symptoms, and mapping to a persisted graph node |
| M6/M7 follow-up + outcome | `FollowUpScreen.kt` + `FollowUpViewModel`: 48h check-in, better/same/worse, side effects, needs-to-be-seen, escalation | server-side outcome label, response-rate tracking, linkage to prescription/condition, 72h cadence |
| M9 medication course tracker | medications screens and refill flow | per-dose events and adherence math |
| M10 "what your doctor recorded" | care packet / records screens | rendering the signed structured note |
| 3.1.1 Pre-Visit Brief | `PreConsultationBrief.tsx` with provenance badges | recurrence, prior treatment/outcome, deterministic red flags |
| 1.2 safety kernel | `SafetyGate`, `safetyService`, `pharmacologyGraph` (allergy classes, DDI, cumulative dose) | versioning, property tests, renal/hepatic adjustments, explicit kernel verdict record |
| 1.8 audit chain | `clinicRepository.appendAudit` / `verifyAudit` is a real SHA-256 chain | binding it to clinical content; it currently chains metadata, not the note |
| 3.2 compare visits | absent | the schema and snapshot to compare by field |
| 1.1 graph, 1.3 KB, 1.4 synthetic, 1.5 outcomes, 1.6 signals | absent | as described, but re-specified below |

The honest read: Proton already has more surface than validation. Adding eight systems increases demo area, not enterprise value. The brief's own principle — "depth over breadth" — argues against implementing its own summary list.

---

## 2. The dependency graph

Read top to bottom. Nothing below a gate can be made true before the gate above it.

```
GATE 0 — THE RECORD IS TRUE
  P0.1  one clinical write path (SQLite desk → Postgres, or freeze desk as demo-only)
  P0.2  content-bound attestation record (replace boolean + constant string + fake merkle)
  P0.3  structured note schema v1 (core subset, lossless fallback)
  P0.4  backup covers every clinical store; read-access audit (same store)
  P0.5  synthetic/pilot build boundary (fail closed on BAA flag)
  P0.6  consent + per-patient keys (after P0.2; before any real outcome)
  P0.7  kernel critical fixes (done; the four probe bypasses)
  P0.8  bind the verdict to the write (done: pipeline + clinic sign)
        │
        ├──────────────────────────────┐
        ▼                              ▼
GATE 1 — MEMORY                    GATE 2 — GROUNDING
  P1.1 clinical links + snapshots    P1.3 KB v1, 20 conditions,
  P1.2 pre-visit brief v2 /            executable criteria, field citations
       compare visits                P1.4 kernel coverage + versioning
        │                              │
        └──────────────┬───────────────┘
                       ▼
GATE 3 — THE LOOP LEARNS
  P1.5 outcome capture for 1–2 cohorts
  P2.1 reliability / abstention (not fake confidence)
  P2.2 decision trail UI
        │
        ├──────────────────────────────┐
        ▼                              ▼
GATE 4 — VERIFICATION (experiment)   GATE 5 — SIGNALS (deferred)
  P2.3 shadow verifier                P3.1 threshold detectors only
  P2.4 golden + adversarial eval      after volume, pre-registered,
  P2.5 Synthea regression harness     FDR-controlled, no identities
```

**Why this order and not the brief's:**

- The graph has nothing trustworthy to point at until P0.1 and P0.3 exist. Its nodes would reference either the SQLite notes or the Postgres notes, and the two disagree.
- Attestation must exist *before* the graph, not after. Every later feature (differential, prescription proposal, follow-up instruction) has to write a proposal record and an attestation. Retrofitting that into a graph is a migration, not a feature.
- The KB can start in parallel with the graph, but only after the note schema defines what a citation attaches to.
- Outcomes need a stable encounter + prescription + condition identity. That is P0.1 + P0.3 + P1.1. Starting earlier yields labels that cannot be joined.
- The verifier is an experiment, not a gate. It depends on an eval set (P2.4) that does not exist until the KB and schema do.
- Signals are last because at pilot volume they are statistically meaningless and a privacy hazard. See §4.6.

---

## 3. Priority ladder

Effort is not stated in days. "Scope" is the size of the change surface, because that is what determines sequencing risk.

### P0 — make the record true (blocks everything; do not start anything below)

| # | Item | Depends on | Done when | Produces |
|---|---|---|---|---|
| P0.1 | **One clinical write path.** Move the doctor's desk off SQLite, or explicitly mark the SQLite desk as demo-only and point the cockpit at the Postgres workflow. Until then, make `backup-to-r2.sh` dump `proton_ops.db` too. | — | A note signed in the cockpit is a row in Postgres `notes`, the encounter transitions through `sign`, and an R2 restore reproduces it. | A restore that reproduces a signed note; a single write path in the state-machine test. |
| P0.2 | **Content-bound attestation.** `clinical_attestations`; canonical JSON hash of note + diagnoses + prescriptions + patient/encounter; proposal refs; kernel verdict ref; actor; decision; edits; reason; prev_hash chain. Written in the *same* transaction as `sign`. Verify endpoint recomputes. | P0.1 | Recomputing the hash from the stored note matches the attestation; flipping one character fails; the UI shows the hash, not `note.id`. | Hash verifies / one character fails; attestation coverage % of signed notes. |
| P0.3 | **Structured note schema v1.** `note_v1`, versioned, lossless `narrative`, validate at write, render PDF from schema. | P0.1 | A note cannot be signed unless it validates; an invalid write is rejected with a field path. | 100% of signed notes validate; rejection reasons by field. |
| P0.4 | **Backup + read audit, in the same store as the notes.** Every clinical store in the dump; `audit.read` on patient record access; restore drill includes the desk. If reads are audited in SQLite while notes are in Postgres, the audit is outside the backup and outside RLS. | P0.1 | Restore drill shows a signed note on the desk; a read event exists for every patient view in the same tenant-scoped store. | Restore drill pass/fail; read events per patient view. |
| P0.5 | **Build boundary: `synthetic` vs `pilot`.** The pilot variant refuses to start unless `BAA_CONFIGURED=true` and `PROTON_SYNTHETIC_MODE=false`; the check is compiled into the variant, not an env default a deployment can forget. | — | A pilot build with the flag unset exits non-zero; a synthetic build cannot reach a BAA-configured endpoint. | 0 or 1 startup gate; no ambiguous build in the field. |
| P0.6 | **Consent before collection.** Versioned consent per patient (data use, AI processing, follow-up contact); per-patient data key for note/outcome payloads; erasure drill destroys the key and leaves a verifiable hash skeleton. | P0.2 | Every outcome row references a consent version; the erasure drill leaves the chain valid and the content unreadable. | Consent coverage %; erasure drill pass/fail. |
| P0.7 | **Kernel critical fixes (done — `kernel_v2`).** The probe found `q4h` acetaminophen (6000 mg/day), tablet-count undercounting, duplicate orders, and metformin at eGFR 12 all `VERIFIED`; a `HIGH` DDI is recorded but cleared. Fix frequency/units parsing (refuse unparseable), duplicate ingredient rule, pass eGFR/weight into the kernel, and make `HIGH` non-clearing. | — | The probe's four `designedToPassAndDid` cases block; both controls hold; the fixes are rules, not whitelisted strings. | 0 designed-to-pass cases; 0 unsafe passes on the published list. |
| P0.8 | **Bind the verdict to the write (done: AI pipeline + clinic sign + workflow sign).** `clinicalPipeline` refuses `cleared: false`; the clinic `signNote` and the workflow `sign` transition re-run the gate over the prescriptions being signed and store the verdict. | P0.7 | A HIGH DDI or CRITICAL conflict cannot be signed without a directive; a clean order stores `kernel_v2`; a refused sign leaves the note DRAFT. | 8-check clinic suite + 4-check workflow suite; no sign without a verdict. |

**P0.1 is the one that will be resisted** because it touches the demo surface. Plan for that rather than asserting "do it anyway":

- tag the current demo (`demo-2026-10-28`) and keep it buildable;
- do the migration on `migration/p0.1-postgres-desk`;
- run [`DEMO.md`](./DEMO.md) §3 against both builds, beat by beat;
- merge only when the Postgres path reproduces every beat.

If the migration slips, the interim is the P0.4 partial: add `PROTON_DB_PATH` (the SQLite file) to the backup tarball and the restore drill, name it `LEGACY_DESK_TEMP`, and track its removal as an issue. It buys honesty without buying the architecture. It must not become the new permanent.

### P1 — memory that pays for itself

| # | Item | Depends on | Done when | Produces |
|---|---|---|---|---|
| P1.1 | **Clinical links + snapshots.** `clinical_links` references *existing* entities (`from_type/from_id`, `to_type/to_id`) — it does not duplicate them. Relations: `RECURRENCE_OF`, `TREATED_WITH`, `RESOLVED_BY`, `CONTRAINDICATES`, and `CAUSED_BY` only when physician-authored with a reason. Status: `authored`, `confirmed`, `hypothesized`. `patient_state_snapshots` materialized at encounter close. Three queries only: active problems/meds, prior episode for a code, last outcome for a treatment. | P0.1–P0.3 | The pre-visit brief shows a confirmed recurrence and the prior outcome; a hypothesized link is visibly distinct and cannot drive the kernel. | Three queries in budget; recurrence precision (confirmed / proposed). |
| P1.2 | **Pre-visit brief v2 + compare visits.** Reuse `PreConsultationBrief.tsx`; add recurrence, prior treatment/outcome, deterministic red flags. Compare two encounters by schema field. | P1.1 | A doctor can answer "what changed since last time" and "did this work last time" without opening a document. | Time to brief; prior episodes surfaced per 100 visits. |
| P1.3 | **KB v1, narrow.** 20 conditions the pilot actually sees. `clinical_criteria` (executable: Centor, CURB-65, etc.), `guideline_recs` with grade and version, `drug_interactions`, `red_flags`, `reference_ranges`. Every row: source, retrieved_at, effective window, reviewer. | P0.3 | Every differential suggestion cites a criterion or says "no criterion met"; every citation resolves to a versioned row. | Citation coverage %; 0 uncited differential entries. |
| P1.4 | **Kernel coverage + versioning.** After P0.7: freeze `kernel_v2`; property-based tests; renal/hepatic dose adjustments beyond the first rules; explicit `kernel_verdict` JSON stored on every proposal. | P0.2, P0.7, P1.3 | The adversarial suite stays at zero unsafe passes as coverage grows; every proposal records which kernel version ruled. | 0 unsafe passes on the published adversarial list; kernel version on 100% of proposals. |
| P1.5 | **Outcome capture v1, one cohort.** Pick one condition with a short, measurable natural history (pharyngitis, UTI, or low back pain). Follow-up already fires at 48h on Android; add a server-side cohort row at scheduling time, append-only outcome labels, `label_version`, response-rate, and a documented non-response reason. | P1.1 | At 30 days, every mature encounter in the cohort has a label or a documented reason; the report states response rate and selection bias. | Positive %, documented non-response %, lost-to-follow-up %. |

### P2 — earn the learning claim

| # | Item | Depends on | Done when | Produces |
|---|---|---|---|---|
| P2.1 | **Reliability, not a confidence number.** Until there are ≥200 labels per proposal type, display ordinal bands and an explicit "insufficient data" state; trigger abstention on missing vitals/labs. When labels exist, publish a reliability diagram and ECE. | P1.5 | The UI never shows a two-decimal probability that is not backed by a calibration curve. | ECE / reliability diagram; abstention rate. |
| P2.2 | **Decision trail UI.** Proposal → kernel → (optional verifier) → physician edit → attestation, hash-chained and readable. | P0.2 | A reviewer can reconstruct any signed note's path in one panel; the chain verifies. | 100% of signed notes with a reconstructable trail. |
| P2.3 | **Shadow verifier, pre-registered.** A second model runs offline, never in the signing path. The promotion threshold is written before the run: it must catch ≥20% of kernel-passing errors that a physician later edits (drug/dose/frequency/duration/diagnosis), with ≤5% false alarms on the golden set, within an agreed cost/latency budget. | P1.3, P2.4 | A written result either promotes the verifier for one proposal type or kills it. No default, no post-hoc threshold. | Errors caught %; false-alarm %; promotion decision. |
| P2.4 | **Golden + adversarial eval.** 300–500 hand-adjudicated cases, plus 100 adversarial kernel cases built per rule (see `docs/moat/kernel-adversarial-cases.md`). Run on every prompt/kernel/model change; block merge on regression. | P1.3 | The suite runs in CI and the number is quotable with a methodology appendix. | 0 unsafe passes; top-3 accuracy with methodology. |
| P2.5 | **Synthea regression harness.** Synthea for record generation + a ground-truth sidecar for the 20 conditions. Used for plumbing, kernel edge cases, load, and UI states. Not called clinical validation. | P0.3 | 10k synthetic journeys run deterministically; the kernel passes zero unsafe orders; the harness catches a seeded regression. | 10k journeys; seeded regression caught. |

### P3 — only after volume

| # | Item | Gate | Produces |
|---|---|---|---|
| P3.1 | **Signals v0.** Pre-registered thresholds, minimum 200 encounters/clinic/90 days, Benjamini–Hochberg across detectors, counts ≥11, human review, no patient identities. No DBSCAN, no LLM detection. | Two clinics with a real baseline. | Signals acknowledged/actioned; false-positive rate. |
| P3.2 | **Coding/billing.** Separate product surface; certified code sets; audit. Do not attach it to the note schema casually. | A billing partner and a compliance review. | Clean-claim rate; denial rate. |
| P3.3 | **Full causal graph / ontology.** `CAUSED_BY` as a first-class traversable fact. | A physician-authored corpus, not a model. | Confirmed causal links; precision against adjudication. |

---

## 4. The eight systems, re-specified

### 4.1 Longitudinal clinical state graph — build the link layer, not a parallel universe

**Verdict: build narrow, after P0.**

The graph is not the moat. It is the substrate the moat sits on — and that distinction is not permission to skip it. A label without a link is a row that cannot attach to a diagnosis, a prescription, or a recurrence. The three traversals below are what make an outcome joinable; without them the dataset is a pile of survey answers with no clinical spine.

The brief's node model duplicates `patients`, `encounters`, `notes`, `diagnoses`, `prescriptions`, `documents`, `observations`. If you materialize those as `clinical_nodes`, you have two copies of every clinical fact, and the copy will drift. The layer that is actually needed is a **typed edge table over the existing rows**, plus a **snapshot** for fast diffs.

The executable schema is in [`apps/api/db/moat/clinical-links.sql`](../apps/api/db/moat/clinical-links.sql); the three queries and their fixture test are in [`clinical-links.queries.sql`](../apps/api/db/moat/clinical-links.queries.sql) and [`clinical_links_sql_validation.cjs`](../apps/api/tests/clinical_links_sql_validation.cjs). Decisions pinned there:

1. **Ids are `TEXT`, not `UUID`.** The existing `patients`, `encounters`, `notes`, `diagnoses`, and `prescriptions` ids are `TEXT`. A uuid column would require a migration of every row before the first edge.
2. **Six node types:** `encounter`, `note`, `diagnosis`, `prescription`, `document`, `outcome`. The first five exist today; `outcome` is the one new table and activates the third query.
3. **No foreign key on the edge endpoints.** The target is polymorphic. Integrity is the writer (resolve before insert), the nightly orphan query, and a test that inserts an orphan and proves it is found.
4. **`RESOLVED_BY` is the only way a confirmed diagnosis stops being active.** `diagnoses.certainty` has `PROPOSED`, `CONFIRMED`, `RULED_OUT` — "the diagnosis was wrong" — but no `RESOLVED`. Pretending `CONFIRMED` equals active would keep every resolved strep throat on the problem list forever. Q1 depends on the link layer for this reason, and the fixture proves a resolved diagnosis is excluded.
5. **`CAUSED_BY` is physician-authored, never inferred.** The check constraint requires `authored`/`confirmed` and a reason of at least 10 characters. The UI label is "physician-attributed cause," not "cause." `RESOLVED_BY` with a treatment and an outcome is a weaker causal claim; it is allowed, with the outcome and time window attached.

Rules:

1. **Only `authored` and `confirmed` links may influence the kernel or the clinical display.** `hypothesized` links render as "suggested relationship" with confirm/dismiss, and cannot drive a safety rule.
2. **`CAUSED_BY` is never inferred.** A model may surface a causal hypothesis in its proposal record, but it cannot be written to `clinical_links` as `hypothesized`. The edge exists only when a physician authors it with a reason. It is displayed as attributed, not established.
3. **Recurrence is deterministic first.** Same coded condition (or curated synonym) within 365 days, written `hypothesized`, confirmed by a clinician. Only after that may a model propose other links; it never writes `confirmed`.
4. **Snapshot is derived, never authored.** Rebuild on encounter close; if it disagrees with the links, the links win.
5. **FHIR is one-way out.** The graph feeds a projection to Medplum (`Condition`, `Observation`, `MedicationRequest`, `DocumentReference`). Never read FHIR back into the graph and write FHIR out again — that is a reconciliation loop with no owner.

The three queries that justify the whole layer:

```
active_problems_and_meds(patient)
prior_episode(patient, condition_code)   -> encounter, diagnosis, treatment, outcome
last_treatment_outcome(patient, treatment_code)
```

If those three do not measurably improve the pre-visit brief, the graph is not earning its keep.

### 4.2 Two-model verifier — keep the kernel; treat the second model as an experiment

**Verdict: kernel yes; verifier in shadow only; no PHI to non-BAA providers.**

Three problems with the brief's version:

1. **"Nobody else has this publicly" is not true.** Multi-model consensus, LLM-as-judge, second-reader radiology, and verifier models are standard. A different vendor is not an independent error process — models trained on overlapping corpora fail on the same edge cases. Agreement is not correctness.
2. **The legal constraint is harder than the architectural one.** `docs/trust/BAA_STANCE.md` is explicit: no BAA with any vendor; free tiers and developer API keys are outside a BAA; Gemini via Vertex or an AWS/Azure equivalent is the path. Sending PHI to DeepSeek or Grok without a signed BAA is not a design choice, it is a breach. A "Model B from a different provider" may simply be unavailable for clinical data.
3. **A verifier that says AGREE creates false reassurance.** If it is wrong, the liability is worse than no verifier, because the record says two models agreed. It must be measured against ground truth before it is allowed to influence a human.

What to keep:

- The **deterministic kernel is already the strongest asset in the repo.** `SafetyGate` + `pharmacologyGraph` covers allergy classes, cross-reactivity, DDI, cumulative daily dose, duplicate ingredients, and the first renal rules. It is not complete: the probe in [`docs/moat/kernel-adversarial-cases.md`](./moat/kernel-adversarial-cases.md) found `q4h` acetaminophen (6000 mg/day), duplicate amoxicillin, metformin at eGFR 12, and a cleared `HIGH` warfarin/NSAID interaction. Those were P0.7; `kernel_v2` fixes them and the gated suite asserts each case. Next: freeze `kernel_v2`, store `kernel_verdict` on every proposal, and expand renal/hepatic/paediatric coverage. The architecture is real; the coverage is not finished.
- **Structured output validation** is the missing second gate: every model output parsed against JSON Schema; malformed output is rejected, not repaired. This catches more real failures than a second opinion.
- **The verifier as an offline experiment**: run it on the golden set and a sample of live proposals, store its verdict, never show it. The promotion threshold is written **before** the run, because a result interpreted afterwards will always fit: it must catch **≥20% of kernel-passing errors that a physician later edits** (a change to drug, dose, frequency, duration, or diagnosis), with **≤5% false alarms** on the golden set, inside an agreed cost/latency budget. If it misses, delete it. A threshold chosen after the run is not a test; it is a narrative.

Confidence:

- A logistic regression on five features with no labels is not calibrated; it is a heuristic with a sigmoid. At launch, use **abstention rules** (missing vitals, missing labs, no prior episode, low guideline grade) and **ordinal bands** ("supported / weak / insufficient"). Once P1.5 produces labels, fit and publish a reliability curve. Do not display `0.87`.

### 4.3 Clinical knowledge base — narrow, executable, licensed

**Verdict: build, but 20 conditions, not 200; criteria, not PDFs.**

- Public guidelines are not proprietary. USPSTF, CDC, and openFDA are public; NICE, WHO, and specialty-society PDFs have redistribution terms. A KB built by scraping PDFs is a licensing problem and a staleness problem. Start with sources you can redistribute and cite.
- The moat is not the text; it is the **executable encoding** (Centor, CURB-65, HEART, qSOFA, renal dosing) and the **maintenance discipline** (version, reviewer, effective window).
- Add `supersedes_id`; a note must record which KB version it was written against. "The guideline changed" is a real clinical event and should be queryable.
- Citations attach to **fields**, not the note. `assessment.differential[0].guideline_ref` is useful; "sources: [1]" at the bottom is decoration.

### 4.4 Synthetic patient engine — a test harness, not validation

**Verdict: build a thin harness; never claim clinical validation from it.**

The brief says "validated against 50,000 synthetic journeys with ground truth." If the generator encodes the same guideline logic the engine uses, the evaluation is circular. A synthetic cohort proves plumbing, determinism, kernel edge cases, and load. It does not prove clinical accuracy, and a diligence team will say so.

- Use **Synthea** (Apache-2.0) for records; add a ground-truth sidecar for the 20 conditions and the specific decision you are testing.
- Use it to test the **kernel**, where ground truth is definitional ("penicillin allergy + amoxicillin must refuse"), and to generate UI states and load.
- Do not publish "50k synthetic validated" as a clinical claim. Publish it as a regression suite. The credibility comes from the methodology, not the count.

### 4.5 Outcome loop — the actual asset, but be honest about label quality

**Verdict: build for one cohort, early in P1; do not call the labels ground truth.**

- Patient-reported "better" at 48–72h is confounded by natural history, placebo, and low response. Return visits only capture within-network care. Adherence self-report is weak. The label is a **signal with a known bias**, not a ground truth.
- Pick one condition where the outcome is short, common, and standardized. Track **response rate** as a first-class metric; a 12% response rate is not a dataset, it is a anecdotes file.
- Link outcome → encounter → diagnosis → prescription, and store the **window** (7d/30d). A "resolved" label at 48h and one at 30d mean different things.
- Calibration only after enough labels; before that, use the outcome to *evaluate the note*, not to compute a probability.
- **Version the labeler.** `label_v1` is a rule set. A label computed under v1 is not comparable to one under v2. Store `label_version` on every row, never recompute history, and treat a correction as a new row with `supersedes_id`. The full rule set, `unknown` semantics, and denominator are in [`docs/moat/outcome-label-v1.md`](./moat/outcome-label-v1.md).
- **Report three numbers, not one:** positive label %, documented non-response %, and lost-to-follow-up %. The moment the third is large, the asset is smaller than the headline. `unknown` is an outcome label; counting it as coverage is the inflation trap.

### 4.6 Population signals — defer; the statistics are not there yet

**Verdict: defer to P3; the brief's thresholds will fire on noise.**

- Seven patients with sore throat in ten days is not a cluster; it is a week. DBSCAN on multi-hot symptom vectors with n<100 produces clusters from randomness. Five detectors × 50 clinics × weekly = hundreds of tests; p<0.05 yields false positives by construction.
- Small-count signals in a small clinic can re-identify patients. "7 patients" plus a date plus a condition is not anonymous in a 300-patient practice.
- When you do build it: pre-register the detectors and thresholds, require minimum counts, control FDR (Benjamini–Hochberg), show the baseline and the confidence interval, and require a named human to acknowledge before it reaches a clinician. No LLM in the detection path — the brief is right about that.
- A signal without an action is noise. Every detector must ship with the action it implies ("add a travel question", "repeat culture"), and the UI must record whether the action was taken.

### 4.7 Structured note schema — highest ROI, but do not build the whole schema

**Verdict: build the core subset now, in P0.**

The brief's schema is a good target, but building all of it before the first signed note is a classic over-model. Start with the fields the pilot actually uses, plus a `narrative` field so nothing is lost. Validate at write. Version it. Render from it.

The schema is built, not sketched. The source of truth is [`apps/api/services/clinical/noteSchema.js`](../apps/api/services/clinical/noteSchema.js) (Zod, strict objects), and the generated artifact is [`apps/api/schemas/note_v1.schema.json`](../apps/api/schemas/note_v1.schema.json). The validator returns `{ path, code, message }` for every issue, e.g. `plan.medications[0].dose`.

Core v1 fields:

- `subjective`: chief complaint (text, onset, duration, severity 1–10), HPI entries (symptom, onset, character, aggravating, relieving, associated), PMH, medications, allergies, and a lossless `narrative`.
- `objective`: eight nullable vitals (decimal measurements are strings), exam findings, labs.
- `assessment`: differential entries with `band` (`supported` / `weak` / `insufficient`), for/against, guideline ref; primary diagnosis with basis.
- `plan`: medications (drug, dose, route, frequency, duration_days, rationale), orders, follow-up (interval, method, triggers), education.
- `provenance`: optional field-path map (`transcript` / `record` / `ai` / `clinician`).

Why this order: the note is what the doctor signs; the graph reads it; the KB cites into it; compare visits diff it; coding later parses it. Everything downstream is cheaper once this exists. The full schema can grow by version, not by migration.

### 4.8 Attestation ledger — the strongest differentiator, and the most likely to be theater

**Verdict: build in P0, but bind it to content and anchor it.**

The brief calls this "the single biggest gap between demo and product." That is correct, and the repo confirms it: the state machine takes `attestation === true`, the cockpit sends a constant sentence, `signNote` stores that sentence, and the UI labelled `note.id` a Merkle root. That label has been corrected to a record id in this working tree; the content binding is still missing.

The executable spec and tests are [`docs/moat/attestation-canonical-json.md`](./moat/attestation-canonical-json.md) and [`attestation_canonical_validation.cjs`](../apps/api/tests/attestation_canonical_validation.cjs). It pins the field list, the JCS rules, a fixed vector, and the verification algorithm.

What makes it real:

1. **Content binding.** RFC 8785 JCS the exact note + diagnoses + prescriptions + patient/encounter ids + proposal hashes + kernel verdict hash + attestor + time. Decimals are strings; `content_canonical` is stored as `TEXT`, not `JSONB`, because JSONB normalizes numbers and key order. Hash it. Store the hash in the attestation row and on the note. Recompute on verify. One changed character must fail.
2. **Atomicity.** The attestation write must be in the same Postgres transaction as the `sign` transition. The current clinic path writes SQLite outside it; that is why P0.1 comes first.
3. **Proposal records.** `clinical_proposals`: kind, model, prompt_version, context_hash, proposal JSON, kernel_version, kernel_verdict, created_at. The attestation points at the proposals the physician saw.
4. **Edits.** If the physician changed the dose, store a structured diff and a reason. That is the most valuable training/eval data you will ever have.
5. **External anchoring.** A hash chain inside the same Postgres is tamper-evident only against someone who cannot write to Postgres. A DBA, or an attacker with the DB, can rewrite the chain. If the claim is "cryptographic," anchor a daily Merkle root outside the database: S3 Object Lock / R2 immutability, or an RFC 3161 timestamp. Otherwise say "tamper-evident audit log," not "cryptographic ledger."
6. **Erasure.** An immutable ledger conflicts with GDPR/DPDP deletion. Encrypt note payloads with a per-patient key; on erasure, destroy the key and keep the hash skeleton. Do not store raw PHI in an undeletable table.

Narrative correction: "the first clinical AI with a cryptographic decision trail" is not credible — audit trails exist. "Every AI proposal and every signature is bound to a content hash, and the chain is anchored outside the database" is credible, checkable, and still rare in this segment.

---

## 5. Cross-cutting corrections

### 5.1 Security, in dependency order

The brief's security section is mostly right but ordered last. Three items belong in P0 because they are cheaper now:

1. **Backup coverage** (P0.4). The current drill is a Postgres drill. A clinic desk whose notes are in SQLite is not backed up. Fix or eliminate.
2. **RLS, actually applied.** `SET LOCAL app.current_tenant` per transaction, policies on every tenant table, a test that a second tenant gets zero rows with a deliberately broken `WHERE`. The existing DDL in `postgresAdapter.js` does not cover the workflow tables.
3. **Provider data handling.** No PHI to a provider without a BAA/DPA. The BAA stance document already says this; the AI gateway should enforce it with an allowlist, not a README.

Then the rest: read-access audit, secrets, retention, prompt-injection separation (untrusted text never in the same channel as the kernel), schema validation, cost caps, certificate pinning with backup pins and a kill switch, exact-alarm fallback.

### 5.2 The Jev adapter is currently a keyword mock

`services/ai/jevAdapter.js` falls back to substring/keyword matching when no API key is configured. Every "Jev decision" in demo mode is a deterministic keyword heuristic wearing a typed-decision label. That is fine for a test double; it is not fine to describe as a calibrated decision model, and it must never be the basis of a safety claim. Either integrate a real provider with a contract and an eval, or rename it and remove it from the architecture diagram.

### 5.3 Versioning and flags

The brief is right: prompt, kernel, model, and schema versions must be stored per proposal. Add `note_schema_version` and `kb_version` to the attestation too. A signature that does not record the version of the rules it was signed under is not reproducible.

### 5.4 Observability

The metrics that matter are clinical, not infrastructural: kernel refusal rate, override rate and reasons, note edit distance by section, follow-up response rate, outcome completeness, verifier disagreement, calibration error. Latency and cost are secondary but should be per-encounter, not per-request.

---

## 6. What I would not build (yet)

| Item | Why not |
|---|---|
| Two-model verification as a default gate | Cost, latency, legal exposure, correlated errors, false reassurance. Shadow first. |
| Population signal ML (DBSCAN, correlation) | Statistically invalid at pilot volume; privacy risk; no action attached. |
| Full graph ontology with `CAUSED_BY` | Causal claims the record cannot support; hypothesis at best. |
| 50,000-patient synthetic "validation" | Circular if generated from the same criteria; a diligence liability. |
| Billing/coding automation | Different product, certified code sets, compliance surface. Attach later. |
| 68-specialist marketing | ADR 0004 already says it is routing metadata. Keep it that way. |
| Full note schema in one pass | Over-model before the first signed note; grow by version. |
| DeepSeek/Grok for PHI | No BAA. This is a legal blocker, not an architecture preference. |
| A separate "graph database" | Postgres links + snapshots are enough for the three queries. Add a graph DB only when a query is proven slow. |

---

## 7. Metrics that would justify the story

If the goal is a valuation narrative, these are the numbers that survive diligence:

**Clinical safety**
- Unsafe proposals passed: **0** on the adversarial suite (a count, not a percentage).
- Kernel refusal rate and override rate, with reasons.
- Time from proposal to physician attestation.
- Attestation edits per note, by field.

**Data asset**
- Encounters with a structured note: count and %.
- Mature cohort rows: count; **positive label %**, **documented non-response %**, **lost-to-follow-up %**; response rate.
- Outcome-labeled encounters per condition (the compounding number).
- Recurrence links confirmed vs. proposed (precision).
- Consent coverage % of outcome rows; label version distribution.

**Utility**
- Median time to pre-visit brief.
- Note edit distance (how much the doctor changes).
- Follow-up escalation capture rate.
- Clinician trust score (a survey, not a proxy).

**Calibration**
- ECE / reliability curve per proposal type, once labels exist.
- Abstention rate and the reason distribution.

The headline is not "we built a graph." It is three numbers plus a safety count: "X% of mature encounters are positively labeled, Y% have a documented non-response, Z% are lost to follow-up, and the kernel has not passed an unsafe order in the published adversarial list." If Y and Z are not reported, X is not a result.

---

## 8. The next cut (concrete)

**Done since this list was written:** P0.7 (`kernel_v2`) and P0.8 (the AI pipeline, clinic sign, and workflow sign refuse an uncleared verdict). The list below is the remaining cut; step 2 now has a safety verdict to store alongside the attestation. The P0.1a staging plan is [`docs/moat/p0.1a-write-path-migration.md`](./moat/p0.1a-write-path-migration.md).

Do these in order. Each has an acceptance test; none requires a new model.

1. **Unify the desk write path, without losing the demo.**
   - Tag `demo-2026-10-28`; branch `migration/p0.1-postgres-desk`; run `docs/DEMO.md` §3 against both builds.
   - Move `clinicRepository.signNote` to Postgres `notes` + `transitionEncounter('sign')`, or gate the SQLite desk behind `PROTON_LEGACY_DESK=true` and point the cockpit at the workflow.
   - *Test:* sign in the cockpit → Postgres row exists, encounter state is `SIGNED`, event row exists; kill SQLite and the desk still works.
   - *Interim if the migration slips:* add `PROTON_DB_PATH` to the backup tarball and the restore drill under `LEGACY_DESK_TEMP`, with a removal issue. Not a second permanent store.

2. **Attestation record.**
   - Migration: `clinical_proposals`, `clinical_attestations` (with `prev_hash`, `content_canonical`, `content_hash`, `chain_hash`).
   - `services/workflow/attestation.js` is already written and tested; wire it into the sign transaction and add the verify endpoint.
   - Cockpit: send the note object; server computes the hash; display the hash, delete `merkleRoot: note.id`.
   - *Test:* the pinned vector verifies; mutate one character in the note → verify fails; the chain detects a deleted row; rebuilding from current rows catches a post-sign edit.

3. **Note schema v1.**
   - `services/clinical/noteSchema.js` and `schemas/note_v1.schema.json` are already written; wire `validateNote` into the signing path; the cockpit builds the structured object, not four strings.
   - *Test:* invalid dose/frequency rejected at `plan.medications[0].dose`; free-text narrative preserved; PDF renders from schema.

4. **One recurrence link.**
   - `clinical_links` migration; on encounter close, compute same-code recurrence within 365 days; write `hypothesized`; clinician confirms in the brief.
   - *Test:* two synthetic encounters with the same code produce a link; a different code does not; a hypothesized link does not appear as fact.

5. **One outcome label, versioned.**
   - `outcome_cohort` at scheduling time; `outcomes` append-only with `label_version='label_v1'`; wire the existing Android follow-up response; label one cohort.
   - *Test:* a "worse" response creates an escalation and a `worsened` row; a mature non-response is `unknown` + `no_contact`, not "resolved"; the three numbers are reported against the mature cohort.

6. **Backup + restore includes the desk.**
   - *Test:* sign a note, dump, restore into a scratch DB, open the desk, see the note and its attestation.

That is the honest first cut. It is unglamorous, and it is the only one that makes the graph, the KB, the verifier, and the outcome loop mean anything.

---

## 9. The narrative, corrected

Replace:

> "Proton is building the clinical memory layer for healthcare… a reasoning architecture that gets smarter with every patient."

with:

> "Proton is a clinical workspace where every note is structured, every AI proposal is bound to a content hash and a physician's attestation, and every visit is followed to an outcome. We can show you the chain for any note, the kernel verdict for any prescription, and the 30-day outcome for X% of a cohort. The graph and the knowledge base are how we make that cheap; the dataset is why it compounds."

The first sentence is a promise. The second is a diligence answer. Build the second one.

**The number gate:** "X% of a cohort" is not quotable until X is computed under a named `label_version`, with the cohort definition, mature-row count, response rate, documented non-response, and lost-to-follow-up reported beside it. Until then the sentence is: "We are building the measurement; here is the methodology and the schema." A number produced before that gate is a liability, not a headline.

---

*This document is a plan, not a status report. `docs/VALIDATION.md` remains the source of truth for what is tested; `docs/PILOT_CUT.md` remains the active operational cut.*
