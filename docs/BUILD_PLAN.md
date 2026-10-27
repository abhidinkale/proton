# Proton Build Plan — From Cockpit to Durable Clinical Loop

**Status:** in progress — Phases 1–2 complete; Phase 3 mostly complete; the live care loop (3b) shipped ahead of schedule; 4–10 open
**Baseline:** branch `build/vertical-slice`, working tree of 2026-10-27
**Goal:** one durable, end-to-end, doctor-supervised encounter loop — booking → context → capture → note → diagnosis → prescription → patient app → report → follow-up — that survives a restart and works on real (non-fixture) data.

## Progress

*Revised 2026-10-27. The previous revision said "1 done, 2–3 partial, 4–10 not
started"; four things landed after it — patient identity, organization tenancy,
the live care loop, and the clinical agent stack. This table is now the code's
status, not the plan's aspiration.*

| Phase | Status | Evidence |
| --- | --- | --- |
| 1 — Persistence & durable orchestration | **done** | `docs/adr/0001`, `docs/adr/0002`, `workflow_state_machine_validation.cjs` (29 checks), `workflow_api_validation.cjs` (23 checks) |
| 2 — One authenticated API client | **done, minus a live-IdP proof** | `docs/adr/0003`; `medplum_session_exchange_validation.cjs` (8 checks); `src/lib/api.ts` + `sessionToken.ts`; `npm run check:api-client` green (all browser calls, 6 allowlisted) |
| 3 — Real booking & patient context | **partial** | `services/scheduling/durableBooking.js`, `durable_booking_validation.cjs` (9 checks); pre-visit intake now persists; FHIR `Appointment` still unwritten |
| 3b — The live care loop *(not in the original plan)* | **done** | `patient_auth_validation` (11), `patient_sync_validation` (16), `clinic_live_validation` (14), `clinic_link_validation` (11), `organization_provisioning_validation` (9), `route_auth_coverage_validation`; `docs/DEMO.md` |
| 4 — Real ambient capture | not started (engine is a stub) | `whisperStreamingEngine.js` is deterministic, not ASR |
| 5 — Grounded notes & diagnosis | **partial — built ahead of the gate** | `evidence/loop/*`, `diagnosticDoctorAgent`, `specialistConsensusCouncil`; see `docs/adr/0004` for what is missing |
| 6 — Real medication safety | **partial** | `safety/pharmacologyGraph.js` replaces the pairwise table; still no RxNorm |
| 7 — One encounter UI | not started | three remain: `DoctorDeskEncounter`, `DoctorGuidedEncounter`, `LegacyEncounterWorkspace` |
| 8 — Follow-up loop & real channels | **partial** — the loop closes, the channels do not | loop shipped as 3b; EMAIL is `simulated`, SMS has no adapter, no push |
| 9 — Truthful CI, E2E, observability | **partial** | 49 suites + Android Gradle gate in CI; no Playwright, no OTel |
| 10 — Pilot hardening | not started | — |

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

### Phase 2 — One authenticated API client · 2–3 d · **DONE**

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
- **Codemod.** All 23 web files that called `fetch` now use `apiFetch` (64 call
  sites). `npm run check:api-client` guards the invariant; the allowlist is down
  to 6 files, each with a written reason.

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

Residual, not blocking:

- Hardcoded demo accounts are still resolvable behind `resolveSyntheticMode()` +
  `PROTON_ALLOW_DEMO_ACCOUNTS`; they should leave the request path entirely.
- The acceptance path has not been run in a browser against a live Medplum
  instance (Medplum is still not in compose). The exchange itself is tested.
- The doctor profile and token still live in `localStorage`. Role and tenant come
  from the signed token server-side, so tampering cannot escalate privileges, but
  an httpOnly session cookie is the right end state (tracked for Phase 10).

### Phase 3 — Real booking and real patient context · 2–3 d · **PARTIAL**

Shipped — durable booking:

- Deleted the fabricated `/api/patient/appointment-booking` handler (it returned
  `apt-${Date.now()}` and never wrote anything).
- `services/scheduling/durableBooking.js`: one transaction creates the patient (if
  self-registering), the appointment, and the encounter in `BOOKED`, with the
  first event + workflow audit entry. Explicit future instant required; no
  guessed "Tomorrow 10:00 AM". Unknown patients are rejected unless a name is
  supplied. Idempotency key (header or deterministic fingerprint) makes retries
  return the original booking.
- If the workflow database is not configured the route returns
  `503 DURABLE_BOOKING_UNAVAILABLE` instead of a fake confirmation.
- `durable_booking_validation.cjs` — 9 checks: persistence, clinician schedule
  visibility, encounter event trail, idempotent replay, and four rejection paths.

Still open:

- Persist the corresponding FHIR `Appointment` (DB row exists; `fhir_appointment_id`
  is nullable and no Medplum write happens yet). Requires the Medplum service in
  compose and a practitioner token exchange for server-side FHIR writes.
- Route booking through `schedulingAgentV2` for slot search/recall/no-show flows;
  the durable row is now the source of truth those flows can build on.
- The pre-visit brief is still assembled from fixtures even though intake now
  persists; the brief must read the stored `QuestionnaireResponse`.
- **Acceptance not yet met:** booking is real and the fixture *booking* path is
  gone, but no code path is fully free of `clinicSchedule`.

Closed since the last revision:

- ~~Intake compiles in memory~~ — `/api/patient/pre-visit-interview` writes a real
  intake record, and the patient app's intake screen feeds it.
- ~~`clinicSchedule.ts` feeds the clinic console~~ — the dashboard, schedule and
  Care Loop read `/api/clinic/live`. The fixture survives in the consultation
  surfaces only.

### Phase 3b — The live care loop · **DONE** *(added after the plan was written)*

The plan had this as Phase 8. It shipped first, because without it the two halves
of the product were two products.

One Postgres database, written from both sides:

- Patient: `POST /api/patient/sync/{bookings,cancels,reschedules,intake,follow-ups,refills}`
  and one `GET /api/patient/sync/pull`. Identity from the signed patient session;
  a body `tenantId` / `patientId` is ignored.
- Clinic: `GET /api/clinic/live/overview`, confirm, reply, resolve. Polled every
  three seconds — honest about being a poll, not dressed as a push.
- Tenancy: `org_*` tables, six-character link codes hashed at rest, and
  `route_auth_coverage_validation.cjs` failing the build if a route loses its
  guard.
- Delivery: patient sign-in codes go out by email (Brevo/Resend) when configured;
  a failed send is a 502 and the code is invalidated.

Evidence: `patient_auth_validation` (11), `patient_sync_validation` (16),
`clinic_live_validation` (14), `clinic_link_validation` (11),
`organization_provisioning_validation` (9), `otp_email_delivery_validation` (14).
Stage script: `docs/DEMO.md`.

What this phase deliberately does **not** claim:

- No push (FCM). "Your refill is ready" waits for the patient to open the app.
- No SMS. Phone-number sign-in is refused rather than silently ignored.
- Clinical-outbox EMAIL is still recorded `simulated`.
- A patient who joins two clinics gets two records, one per tenant. Isolation by
  design, but it must become a product decision before a patient tries it.

### Phase 4 — Real ambient capture · 4–5 d

**Current state:** `services/voice/whisperStreamingEngine.js` produces
speaker-labelled turns and millisecond timestamps, but it is a deterministic
generator — there is no ASR model behind it and no container in the stack. The
`test_consultation.m4a` fixture at the repo root has never been through it. It is
a contract, not a capability, and must not be demoed as transcription.

- Containerize `faster-whisper` (MIT) with a small/medium model; optional `WhisperX` + `pyannote.audio` for diarization. Verify model licenses at adoption.
- Web: `MediaRecorder` → chunked upload over WebSocket/SSE; live partial transcript; speaker labels.
- Feed patient medications/conditions into the decoding prompt (the existing `buildClinicalPrompt` logic is good — wire it to real data).
- Retire `whisperStreamingEngine` from the product path; keep a tiny replay fixture for deterministic tests.
- **Acceptance:** a 5-minute real recording yields a speaker-labelled transcript with word timestamps; measured WER on a 10-clip internal set is recorded in `docs/VALIDATION.md`.

### Phase 5 — Grounded notes, diagnosis, recommendations · 5–6 d

**Current state:** the evidence-side half is built and gated
(`services/evidence/loop/`, 28 phases, claim verifier, contradiction engine,
`pgvectorClinicalMemory`), and the diagnostic agents sit on top
(`agents/diagnosticDoctorAgent`, `agents/specialistConsensusCouncil`). It was
built ahead of this phase's other prerequisites and is **not yet bound to a
clinician attestation** — a differential can be produced without a signature.
[`adr/0004`](./adr/0004-closed-loop-clinical-agents.md) records the boundary and
the missing wiring; closing that gap is the first task here, before any further
agent capability.

- Note generation already calls a real provider; add zod schemas for structured output and server-side validation.
- Evidence: ingest a licensed/open guideline corpus into pgvector (Europe PMC REST + local PDFs with provenance). Claim verifier must cite a retrieved passage or return `NO_EVIDENCE`.
- Diagnosis: LLM proposes differential → deterministic red-flag and contraindication gates → physician review. The 68-specialist registry becomes routing metadata, not a reasoning engine.
- **Acceptance:** 20 synthetic cases, every diagnosis/recommendation either cited or flagged; zero ungrounded citations in the audit report.

### Phase 6 — Real medication safety · 3–4 d

**Current state:** `services/safety/pharmacologyGraph.js` replaces the pairwise
interaction table with a class graph (shared mechanism, cross-reactivity, renal
and hepatic ceilings) and `safety/escalationRouter.js` consumes it. The data is
still hand-written — no RxNorm, no RxNav, no openFDA — so the graph is only as
good as the few dozen entries committed with it.

- RxNorm normalization + RxNav interaction API (free, US government). Self-host via RxNav-in-a-Box if offline/air-gapped is required.
- Renal dosing (CKD-EPI), weight/age pediatric ranges, duplicate-therapy detection.
- Keep the deterministic engine and its regression tests; replace only the data source and matching logic.
- **Acceptance:** curated 50-pair interaction set with zero false negatives; p95 lookup < 300 ms with cache.

### Phase 7 — One encounter UI · 3–4 d

**Current state:** all three UIs are still in the tree — `DoctorDeskEncounter`,
`DoctorGuidedEncounter` and `LegacyEncounterWorkspace` — and `pages/Consultation.tsx`
still routes to the legacy one. The dashboard rewrite did not touch the
consultation surface, so this phase is untouched.

- Keep `DoctorDeskEncounter` (it owns the shared types); delete `LegacyEncounterWorkspace` and fold `DoctorGuidedEncounter` into the desk flow.
- Split the 2.5k-line component into feature modules (< 400 lines each): transcript, note, orders, safety, sign-off.
- One design-system primitive set; remove the Mantine/Tailwind/custom overlap.
- **Acceptance:** one route, one component tree; no file > 500 lines in `src/features/encounter`; visual diff reviewed.

### Phase 8 — Follow-up loop and real channels · 3–4 d

**Current state:** the loop half shipped early as Phase 3b; the channel half did
not. `services/workflow/outboxDispatcher.js` delivers IN_APP for real and records
EMAIL as `simulated: true`; there is no SMS adapter and no push. `escalationRouter`
routes red flags into the queue, but the patient app has no path back to it yet.
What remains here is delivery, not plumbing.

- Transactional outbox → worker → channel adapter. Start with a provider sandbox (Twilio) and a `SyntheticProvider` for tests. Self-host Jambonz if telephony must be open source.
- Patient check-in → structured symptom capture → deterministic triage → escalation into the physician queue.
- Appointment reminders and no-show follow-ups as retryable jobs.
- **Acceptance:** follow-up survives restart, retries with backoff, records delivery status, escalates on red flags.

### Phase 9 — Truthful CI, E2E, observability · 2–3 d

**Current state:** two of the goals are met and two are not. CI already gates the
web build, 49 hermetic API suites against a real `postgres:16`, and the Android
unit tests + debug assemble (`REQUIRE_POSTGRES=1`, so durability cannot silently
skip). `VALIDATION.md` is the single status page and the historical milestone
reports are already labelled as such in `docs/README.md`. Still missing: any
browser E2E, any front-end unit test, and any trace.

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

## 6. Decisions taken since this plan was written

All five open questions were answered by the pilot plan; recorded here so the
plan stops asking.

| # | Question | Answer | Where |
| --- | --- | --- | --- |
| 1 | Deployment target | One free VM (Oracle Always Free) behind a Cloudflare Tunnel, Postgres 16 on the same box. Not serverless. | [`PILOT_90_DAY_PLAN.md`](./PILOT_90_DAY_PLAN.md), `deploy/README.md` |
| 2 | Identity | Medplum as the clinician IdP, exchanged for a Proton session (ADR 0003). Patient identity is separate: OTP → HMAC session. | `docs/adr/0003`, `middleware/patientAuth.js` |
| 3 | ASR runtime | Not decided, because no ASR exists yet. Phase 4 opens with `faster-whisper` on CPU/MPS; the engine shipped so far is a stub. | this file, Phase 4 |
| 4 | Language | English only for the pilot. Code-switching is out of scope until WER is measured on real clips. | — |
| 5 | Channels | Email + in-app. **No SMS** — it is the one thing genuinely not free, so phone-number sign-in is refused rather than faked. No WhatsApp (ToS/ban risk). | `docs/PILOT_90_DAY_PLAN.md` §5 |

Still genuinely open: whether the pilot runs on synthetic data only (it must,
until a BAA exists), and whether the consult surface is rebuilt before or after
real ASR lands.
