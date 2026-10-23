# Proton Build Plan — From Cockpit to Durable Clinical Loop

**Status:** in progress — Phase 1 complete; Phase 2 token bridge shipped, codemod 19/23 files
**Baseline:** current `main` working tree (hardening pass applied)
**Goal:** one durable, end-to-end, doctor-supervised encounter loop — booking → context → capture → note → diagnosis → prescription → patient app → report → follow-up — that survives a restart and works on real (non-fixture) data.

## Progress

| Phase | Status | Evidence |
| --- | --- | --- |
| 1 — Persistence & durable orchestration | **done** | `docs/adr/0001`, `docs/adr/0002`, `workflow_state_machine_validation.cjs` (29 checks), `workflow_api_validation.cjs` (23 checks) |
| 2 — One authenticated API client | **partial** | medplum→Proton exchange (`docs/adr/0003`, `medplum_session_exchange_validation.cjs`, 8 checks); `src/lib/api.ts`; 19/23 `fetch` files codemodded; 4 files deferred |
| 3 — Real booking & patient context | not started | booking endpoint exists on the durable schema; the old stub and fixtures are still present |
| 4–10 | not started | — |

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
  └─ one apiFetch()  ── Bearer(Proton session) ──┐
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

The browser's Bearer is a **Proton** session token obtained by exchanging its
Medplum access token at `POST /api/auth/exchange` (ADR 0003). Medplum's JWT is
never sent to ordinary API routes.

**Decision:** Postgres is the system of record for *workflow state*; Medplum/FHIR is the system of record for *clinical resources*. The encounter state machine references FHIR resource IDs. This keeps the loop durable without fighting FHIR's lack of workflow semantics.

---

## 2. Phase plan

Estimates are focused engineering days, not calendar days.

### Phase 1 — Persistence & durable orchestration · 4–5 d · **DONE**

The foundation. Nothing else is worth building before this.

Shipped:

- `postgres:16` service in `docker-compose.yml` (Medplum service still pending Phase 3).
- Versioned migrations (`apps/api/db/workflowMigrations.js`, v2) for `patients`,
  `appointments`, `encounters`, `encounter_events` (append-only), `notes`,
  `diagnoses`, `prescriptions`, `reports`, `outbox`, `patient_messages`,
  `workflow_audit_events`, `workflow_idempotency`. The migration runner now uses
  one dedicated client per migration inside a transaction, guarded by an
  advisory lock (previously `BEGIN`/`COMMIT` went through the pool and could
  spread across connections).
- `services/workflow/encounterStateMachine.js`: the 11-state lifecycle, 15
  transitions, role gates, attestation gate, reason gates, `SELECT … FOR UPDATE`
  + version precondition, and atomic event + audit + outbox writes.
- `storage/postgres/workflowRepository.js` and
  `storage/postgres/workflowAuditRepository.js`.
- `services/workflow/outboxDispatcher.js` + channel adapters. IN_APP is a real
  delivery; EMAIL is honestly flagged `simulated`.
- `services/workflow/runtime.js`: pg-boss on the same database, recurring
  outbox dispatch, wired into `index.js` with graceful shutdown.
- `api/workflow.js` mounted at `/api/workflow` behind actor resolution.
- **Acceptance met:** stop the runtime, drop the pool, restart — encounter state
  and pending messages survive and are dispatched
  (`workflow_state_machine_validation.cjs`, SUITE 8).

Not done in this phase, carried forward:

- In-memory session revocation and the legacy `jobQueueService` are still in
  place for the pre-existing endpoints; the new workflow path does not use them.
- No Medplum service in compose yet (Phase 3).
- Multi-process worker behaviour is designed for (`SKIP LOCKED`) but only
  single-process tested.

### Phase 2 — One authenticated API client · 2–3 d · **PARTIAL**

Closes the P0 gap that strict mode exposes.

Shipped:

- **Server exchange.** `POST /api/auth/exchange` (ADR 0003) accepts a Medplum
  access token, verifies it against `${MEDPLUM_BASE_URL}/auth/me`, maps a
  `Practitioner` to a Proton actor (`usr-medplum-<id>`, role `physician`, tenant,
  NPI), and issues a 12-hour Proton session. `Patient`, inactive practitioners,
  expired tokens, and an unreachable IdP all fail closed. MFA is recorded as
  `false` — the API does not claim an assurance level it cannot prove.
- **Rate limiting.** The exchange shares the 10/minute login limiter.
- **Client credential.** `src/lib/sessionToken.ts` owns the Proton token;
  `authService` performs the exchange at login and heals pre-existing Medplum
  sessions via `ensureProtonSession()`.
- **One API client.** `src/lib/api.ts` provides `apiFetch` / `apiJson`: attaches
  the Bearer token, normalises `/api/...` against `VITE_API_URL` when the web and
  API are on different origins, and turns an authenticated 401 into exactly one
  `proton:session-expired` event. The shell reacts once (logout + redirect)
  instead of every panel racing to redirect.
- **Codemod.** 19 of 23 web files that called `fetch` now use `apiFetch`
  (64 call sites). `npm run check:api-client` guards the invariant with an
  explicit allowlist.
- **Tests.** `medplum_session_exchange_validation.cjs` — 8 checks against a stub
  Medplum, including that the access token is never echoed and that the issued
  token authenticates a protected route with synthetic mode off.

Deliberately different from the original sketch:

- **No 401 refresh-and-retry.** Replaying a clinician's signed write after a
  silent refresh is worse than making them re-authenticate. The client ends the
  session once; the server remains the only place a role is decided.
- **No oxlint rule for raw `fetch`.** oxlint does not support project-local rules;
  the standalone `check:api-client` script provides the same gate without a
  plugin dependency.

Remaining before Phase 2 is done:

- Codemod the 4 deferred files (actively edited by the UI workstream):
  `AmbientClinicalCockpit.tsx`, `DoctorGuidedEncounter.tsx`,
  `MDSpecialistBoardPanel.tsx`, `DocumentReview.tsx`.
- Remove the hardcoded demo accounts from the request path entirely (currently
  behind `resolveSyntheticMode()` + `PROTON_ALLOW_DEMO_ACCOUNTS`).
- Prove the acceptance path against a running Medplum instance: strict-mode login
  → booking → sign-off with zero 401s. The exchange itself is tested; the
  end-to-end browser run is not yet possible locally (Medplum is not in compose).
- Move the doctor profile / token out of `localStorage` into an httpOnly session
  cookie (tracked for Phase 10; role and tenant already come from the signed
  token server-side, so storage tampering cannot escalate privileges).

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
