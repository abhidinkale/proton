# Proton Build Plan — From Cockpit to Durable Clinical Loop

**Status:** proposed
**Baseline:** current `main` working tree (hardening pass applied)
**Goal:** one durable, end-to-end, doctor-supervised encounter loop — booking → context → capture → note → diagnosis → prescription → patient app → report → follow-up — that survives a restart and works on real (non-fixture) data.

---

## 0. Principles

1. **Depth over breadth.** No new stages until one stage is real end-to-end.
2. **The database is the product.** Every clinical fact, transition, and scheduled action lives in Postgres. No `Map()` may hold state that matters.
3. **Doctor signs everything.** AI drafts, the physician attests. This is both the safety model and the only deployable regulatory posture (NMC Telemedicine Guidelines; FDA SaMD). "Autonomous doctor" is explicitly out of scope; "supervised autopilot" is the target.
4. **Every claim is traceable.** A diagnosis or recommendation without a citation or an explicit "no evidence" flag does not render.
5. **Delete duplicates.** Two booking paths, three encounter UIs, and a simulated ASR engine are liabilities, not assets.
6. **Tests gate the loop.** A phase is done when a Playwright/integration test proves the loop, not when a unit suite says 100%.

### Working method

- Branch `build/vertical-slice` cut from the current tree (uncommitted work is preserved).
- One phase = one or more commits, each with a short design note in `docs/adr/`.
- Every phase ends with: `npm --prefix apps/api test`, `npm --prefix apps/web run build`, and the new end-to-end test.
- No phase deletes user-authored UI without a before/after screenshot comparison.

### What I will *not* do

- Vendor upstream source zips (`medplum-main/`, `whisper-main/`) into the product. Use npm packages and Docker images. Vendored source is already 931 MB of noise.
- Adopt unofficial WhatsApp libraries (ToS and ban risk). Use a provider abstraction plus a sanctioned channel.
- Put an LLM in the deterministic safety path. Rules stay deterministic; LLMs propose.

---

## 1. Target architecture

```
Browser (React)
  └─ one apiFetch()  ── Bearer(Medplum JWT) ──┐
                                              ▼
                                     Express API (routers)
                                              │
                    ┌─────────────────────────┼──────────────────────────┐
                    ▼                         ▼                          ▼
             Postgres (system of record)   Medplum FHIR            Workers (pg-boss)
             patients, encounters,         Patient, Encounter,     follow-up, reminders,
             events, jobs, audit,          Observation,            outbox delivery,
             appointments, outbox          MedicationRequest       OCR/ASR jobs
                    │
                    └─ pgvector: guideline corpus, embeddings, evidence cache
```

**Decision:** Postgres is the system of record for *workflow state*; Medplum/FHIR is the system of record for *clinical resources*. The encounter state machine references FHIR resource IDs. This keeps the loop durable without fighting FHIR's lack of workflow semantics.

---

## 2. Phase plan

Estimates are focused engineering days, not calendar days.

### Phase 1 — Persistence & durable orchestration · 4–5 d

The foundation. Nothing else is worth building before this.

- Add `postgres:16` + `medplum/medplum-server` to `docker-compose.yml` (local profile).
- Schema (migrations, versioned):
  - `patients`, `appointments`, `encounters`, `encounter_events` (append-only), `encounter_state` (current + version)
  - `notes`, `diagnoses`, `prescriptions`, `reports`
  - `outbox` (transactional outbound messages)
  - `audit_events` (hash chain, tenant-scoped)
  - `jobs` (pg-boss schema)
- Encounter state machine: `BOOKED → CHECKED_IN → INTAKE → READY → CAPTURING → DRAFTED → PENDING_REVIEW → SIGNED → REPORTED → FOLLOW_UP_DUE → CLOSED` (+ `ESCALATED`, `CANCELLED`). Illegal transitions throw; every transition writes an event row and an audit row in the same transaction.
- Replace the in-memory repositories behind a `PersistenceMode` flag (`memory` for tests, `postgres` for everything else).
- `pg-boss` for all async work. Remove `services/jobs/jobQueueService.js` in-memory queue from the request path.
- Session revocation and idempotency keys move to Postgres (they currently vanish on restart).
- **Acceptance:** start an encounter, kill the API mid-flight, restart, resume from the same state; a queued follow-up still fires; audit chain verifies after restart.

### Phase 2 — One authenticated API client · 2–3 d

Closes the P0 gap that strict mode currently exposes.

- Server: `POST /api/auth/exchange` accepts a Medplum access token, validates it (JWKS or introspection — whichever the deployment supports), maps `Practitioner` → Proton actor + tenant, and issues a short-lived Proton session token.
- Delete the hardcoded demo accounts from the request path. Keep them only behind `NODE_ENV=e2e`.
- Client: `src/lib/api.ts` with `apiFetch()` that attaches the token, refreshes on 401, and retries once. Codemod all 72 `fetch` call sites; ban raw `fetch` with an oxlint rule.
- Remove identity from `localStorage`; rely on the Medplum session + server-verified actor.
- **Acceptance:** in strict mode (`PROTON_SYNTHETIC_MODE=false`), a real login completes booking → sign-off with zero 401s; a persisted XSS cannot escalate role (role comes from the server, never storage).

### Phase 3 — Real booking and real patient context · 2–3 d

- Delete `/api/patient/appointment-booking` stub. Route booking through `schedulingAgentV2` and persist `Appointment` (DB + FHIR).
- Intake creates `Patient` + `QuestionnaireResponse`, not a fixture object.
- Replace `clinicSchedule.ts` / `DoctorDeskPatient` fixtures with queries. Keep fixtures only as seed data for demos.
- Pre-consult summary reads from DB/FHIR; if a field is missing, it renders "not recorded" instead of inventing a value.
- **Acceptance:** book → patient record exists → pre-visit brief cites real rows; no code path imports `clinicSchedule`.

### Phase 4 — Real ambient capture · 4–5 d

- Containerize `faster-whisper` (MIT) with a small/medium model; optional `WhisperX` + `pyannote.audio` for diarization. Verify model licenses at adoption.
- Web: `MediaRecorder` → chunked upload over WebSocket/SSE; live partial transcript; speaker labels.
- Feed patient medications/conditions into the decoding prompt (the existing `buildClinicalPrompt` logic is good — wire it to real data).
- Retire `whisperStreamingEngine` from the product path; keep a tiny replay fixture for deterministic tests.
- **Acceptance:** a 5-minute real recording yields a speaker-labelled transcript with word timestamps; measured WER on a 10-clip internal set is recorded in `docs/VALIDATION.md`.

### Phase 5 — Grounded notes, diagnosis, recommendations · 5–6 d

- Note generation already calls a real provider; add zod schemas for structured output and server-side validation.
- Evidence: ingest a licensed/open guideline corpus into pgvector (Europe PMC REST + local PDFs with provenance). Claim verifier must cite a retrieved passage or return `NO_EVIDENCE`.
- Diagnosis: LLM proposes differential → deterministic red-flag and contraindication gates → physician review. The 68-specialist registry becomes routing metadata, not a reasoning engine.
- **Acceptance:** 20 synthetic cases, every diagnosis/recommendation either cited or flagged; zero ungrounded citations in the audit report.

### Phase 6 — Real medication safety · 3–4 d

- RxNorm normalization + RxNav interaction API (free, US government). Self-host via RxNav-in-a-Box if offline/air-gapped is required.
- Renal dosing (CKD-EPI), weight/age pediatric ranges, duplicate-therapy detection.
- Keep the deterministic engine and its regression tests; replace only the data source and matching logic.
- **Acceptance:** curated 50-pair interaction set with zero false negatives; p95 lookup < 300 ms with cache.

### Phase 7 — One encounter UI · 3–4 d

- Keep `DoctorDeskEncounter` (it owns the shared types); delete `LegacyEncounterWorkspace` and fold `DoctorGuidedEncounter` into the desk flow.
- Split the 2.5k-line component into feature modules (< 400 lines each): transcript, note, orders, safety, sign-off.
- One design-system primitive set; remove the Mantine/Tailwind/custom overlap.
- **Acceptance:** one route, one component tree; no file > 500 lines in `src/features/encounter`; visual diff reviewed.

### Phase 8 — Follow-up loop and real channels · 3–4 d

- Transactional outbox → worker → channel adapter. Start with a provider sandbox (Twilio) and a `SyntheticProvider` for tests. Self-host Jambonz if telephony must be open source.
- Patient check-in → structured symptom capture → deterministic triage → escalation into the physician queue.
- Appointment reminders and no-show follow-ups as retryable jobs.
- **Acceptance:** follow-up survives restart, retries with backoff, records delivery status, escalates on red flags.

### Phase 9 — Truthful CI, E2E, observability · 2–3 d

- Playwright E2E against a docker-compose stack (Postgres + Medplum + API + web). Add `@playwright/test` and a browser matrix.
- Vitest for front-end units. Coverage gates on the encounter state machine and safety service.
- OpenTelemetry traces across API → worker → provider, with PHI scrubbing.
- Product metrics (the only ones that matter): time-to-note, edit rate, % accepted unedited, missed red flags, follow-up completion.
- Archive the 80+ self-scored milestone reports into `docs/archive/`; keep `VALIDATION.md` as the single status page.

### Phase 10 — Pilot hardening · ongoing

- 10 synthetic patients, 20 encounters, 3 physicians; measure the Phase 9 metrics.
- Load test the capture stream and the worker queue.
- Security review focused on the new Postgres/Medplum surface.

---

## 3. Open-source stack at a glance

| Need | Choice | License | Notes |
| --- | --- | --- | --- |
| Workflow DB | PostgreSQL 16 | PostgreSQL | System of record |
| Durable jobs | `pg-boss` | MIT | Postgres-backed, no Redis |
| FHIR server | Medplum | Apache-2.0 | Already the intended backend |
| Auth | Medplum OAuth2/OIDC | Apache-2.0 | Avoids a second IdP |
| ASR | `faster-whisper` | MIT | CPU/MPS friendly |
| Diarization | `WhisperX` + `pyannote.audio` | BSD-2 / MIT (models: verify) | Model weights may be gated |
| Embeddings/RAG | pgvector | PostgreSQL | Already vendored |
| Drug terminology | RxNorm / RxNav | US Gov (free) | Self-host option: RxNav-in-a-Box |
| Drug labels/adverse events | openFDA | Public domain | |
| Literature | Europe PMC REST | Open | Citation provenance |
| OCR (lab reports) | docTR or PaddleOCR | Apache-2.0 | Better tables than raw Tesseract |
| E2E | Playwright | Apache-2.0 | Replaces unusable Puppeteer scripts |
| Validation | Zod | MIT | Route + LLM output schemas |
| Telemetry | OpenTelemetry JS | Apache-2.0 | |
| Telephony (optional) | Jambonz | MIT | Or Twilio sandbox for the pilot |
| Clinical rules (future) | CQL / OpenCDS | Apache-2.0 | Only if rule complexity grows |

**Verify before pinning:** RxNav-in-a-Box repo/image tag, pyannote model licenses, and Medplum server image version. Each gets an ADR entry.

---

## 4. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Postgres + Medplum raise local setup cost | Slows onboarding | `docker compose --profile full up`; memory mode remains for unit tests |
| ASR quality on accents/code-switching | Loop unusable | Benchmark early (Phase 4); allow provider swap; keep transcript-editing UI |
| Medplum token verification differs by deployment | Auth blocked | Feature-detect JWKS vs introspection; document both |
| Real guideline licensing | Legal exposure | Only ingest sources with explicit reuse rights; store provenance |
| Scope creep into "autonomy" | Safety/regulatory failure | Explicit invariant: no unsigned clinical action |
| Regulated claims in docs | Credibility/legal | `VALIDATION.md` gates every claim |

---

## 5. Definition of done for the loop

A single automated test must prove:

1. A patient books an appointment through the public API; the appointment is in Postgres and FHIR.
2. The physician opens the encounter and sees a brief built from that patient's real records.
3. A recorded conversation produces a speaker-labelled transcript.
4. A structured note is drafted, with every clinical claim cited or flagged.
5. The physician edits and signs; a prescription passes deterministic safety and persists.
6. The medication appears in the patient app.
7. A report is generated and delivered.
8. A follow-up job fires **after an API restart**, and a red-flag response escalates to the physician queue.
9. Every transition is in the audit chain, and the chain verifies.
10. All of the above runs in CI against a disposable docker stack.

---

## 6. Decisions needed before Phase 1

1. **Deployment target for the pilot:** local Docker only, or a hosted environment? (Serverless Vercel + in-memory state is incompatible with this plan; it needs a long-lived Postgres.)
2. **Identity:** Medplum Cloud project available, or should I stand up local Medplum?
3. **ASR runtime:** local CPU/MPS for the pilot, or a GPU/paid API? This sets the model size and latency budget.
4. **Language:** English only, or English/Hindi code-switching? This changes model choice and the benchmark set.
5. **Channels:** which follow-up channel is acceptable for the pilot — email, SMS, WhatsApp Business, or in-app only?

Default if no answer: local Docker, local Medplum, small English model, in-app + email follow-up.
