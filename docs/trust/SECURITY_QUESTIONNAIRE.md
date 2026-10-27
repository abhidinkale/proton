# Security Questionnaire

**Product:** Proton — clinical AI copilot for physicians, plus the Dork patient app (Android)
**Version:** 1.0 · **Date:** 26 October 2026
**Answers apply to:** the private synthetic beta as it exists in this repository today

> **Current posture.** Proton is pre-revenue, runs on free and low-cost tiers, has no Business Associate Agreement (BAA) with any vendor, and processes **only synthetic or de-identified data**. It is **not HIPAA-compliant** and does not claim to be. Every answer below is written to that reality. Where something is a plan rather than a fact, it says so.

**How to read the status tags**

| Tag | Meaning |
| :--- | :--- |
| `[IMPLEMENTED]` | In code and operating today for the synthetic beta. |
| `[PARTIAL]` | Exists, but is incomplete for a real-PHI deployment or depends on configuration we do not currently run. |
| `[ROADMAP]` | Designed or specified, not built. |
| `[NOT SUPPORTED]` | Does not exist and is not planned for this pilot. |

**If you have five minutes,** read A3, B2, B8, C1, C5, D5, D6, E2, F1, F2, G3, and H3. Those twelve answers decide whether this pilot is viable. The rest is detail for your reviewer.

---

## A. Company & product

| # | Question | Answer | Status | Source |
| :--- | :--- | :--- | :--- | :--- |
| A1 | What does Proton do? | It drafts clinical notes from a consultation, extracts facts from uploaded documents, and builds prescription orders. A licensed physician reviews and signs everything. The AI never writes to the record on its own. | `[IMPLEMENTED]` | `README.md`; `docs/BETA_READINESS.md` §2 |
| A2 | What stage is the company? | Pre-revenue. Single founder. No customers, no production contracts, no funding disclosed here. | `[IMPLEMENTED]` | `README.md` |
| A3 | What is the deployment model? | Multi-tenant SaaS. React single-page app on Vercel, Express API on Render or Fly.io, Medplum (FHIR R4) for clinical records, PostgreSQL for workflow state. No on-premise or self-hosted option is offered. | `[IMPLEMENTED]` | `docs/DEPLOYMENT.md` §1, §3; `docs/PRIVATE_SYNTHETIC_BETA_DEPLOYMENT.md` §1 |
| A4 | Who at Proton can see hospital data? | One person — the founder — via vendor dashboards and database access. There is no support team, no shared admin account, and no role separation between "founder" and "production administrator". | `[PARTIAL]` | `README.md`; `docs/BETA_READINESS.md` |
| A5 | Do you have a named security officer or DPO? | No. Security is the founder's responsibility by default. A DPO has not been appointed. | `[NOT SUPPORTED]` | — |
| A6 | Do you have a written information security program? | No formal program, no annual policy review, no security awareness training. Individual controls are documented across `docs/` and this pack. | `[PARTIAL]` | `docs/WORKSTREAM_3_SECURITY_REVIEW.md` |

---

## B. Data handling

| # | Question | Answer | Status | Source |
| :--- | :--- | :--- | :--- | :--- |
| B1 | What data do you collect in the pilot? | Synthetic patient records only: three seeded cohorts (Eleanor Vance, Arthur Pendelton, Demo Patient) covering demographics, appointments, encounters, notes, diagnoses, prescriptions, documents, and audit events. Clinician name, email, role, tenant, and NPI are real. Consultation audio is captured in the browser if the clinician presses record. | `[IMPLEMENTED]` | `docs/PRIVATE_SYNTHETIC_BETA_READINESS.md` §F; `apps/api/db/workflowMigrations.js` |
| B2 | Do you process real PHI today? | No. There is no production tenant and no real patient record in the system. | `[IMPLEMENTED]` | `README.md` warning block |
| B3 | Where does data live? | Three places: (1) Medplum FHIR store — the clinical system of record; (2) PostgreSQL `proton_ops` — workflow projections, notes, prescriptions, audit chains; (3) the clinician's browser `sessionStorage` — in-progress drafts and a UI audit log capped at 100 entries. | `[IMPLEMENTED]` | `apps/api/db/workflowMigrations.js`; `docs/BETA_READINESS.md` §3 |
| B4 | Which regions? | Chosen per vendor at deploy time; no region is pinned in code or contract. Defaults are US. Medplum Cloud and the AI providers are US-hosted; DeepSeek is China-hosted. See `SUBPROCESSORS.md`. | `[PARTIAL]` | `docs/PRIVATE_SYNTHETIC_BETA_DEPLOYMENT.md` |
| B5 | How long is data retained? | **Not yet defined.** No retention schedule is implemented and no purge job exists. The DR specification names 7 years for audit records and 35 days for database point-in-time recovery; both are targets, not running jobs. | `[ROADMAP]` | `docs/BACKUP_AND_DISASTER_RECOVERY.md` §2 |
| B6 | How does deletion work? | There is no patient-deletion workflow and no self-service erasure. Deleting a patient would today mean a manual database operation by the founder, and `ON DELETE RESTRICT` on encounters blocks it until child rows are removed. A deletion runbook has to be written before real data. | `[NOT SUPPORTED]` | `apps/api/db/workflowMigrations.js` lines 53, 77, 107 |
| B7 | Can a patient export their data? | Not in full. The patient app has no record export. Clinicians can export an individual prescription as a PDF. A machine-readable export is not built. | `[PARTIAL]` | `apps/dork-android`; `docs/BETA_READINESS.md` §1 |
| B8 | Are backups taken? | No application-level backup job exists in the repository. Whatever the hosting and database provider retains by default is the only copy. No restore has been tested. The DR document is a specification, not an operating procedure. | `[ROADMAP]` | `docs/BACKUP_AND_DISASTER_RECOVERY.md` (header: "Designed & Specified") |
| B9 | Encryption at rest? | Only the provider's own volume/disk encryption. No application-level encryption, no field-level encryption, no customer-managed keys, no KMS. | `[PARTIAL]` | `docs/BETA_READINESS.md` §3 |
| B10 | Encryption in transit? | TLS terminated at the Vercel/Render edge with HSTS (`max-age=31536000; includeSubDomains`). Local development runs over plain HTTP. | `[IMPLEMENTED]` | `apps/api/app.js` lines 20–25 |
| B11 | Are logs free of PHI? | Structured JSON logs redact a fixed list of clinical field names (transcript, prompt, patient_name, mrn, dob, medications, allergies, and similar) before writing. This is **key-name redaction, not content scanning** — a PHI value placed in an unexpected field would be logged. | `[PARTIAL]` | `apps/api/middleware/telemetry.js` |
| B12 | Is hospital data used to train models? | No. Proton does not train or fine-tune models. Whether a provider retains or trains on API inputs is governed by that provider's terms — and none of the AI providers in use offers us a BAA or a contracted zero-retention guarantee. | `[PARTIAL]` | `apps/api/providers/factory.js`; `SUBPROCESSORS.md` |
| B13 | Data minimisation? | Prompts are built from a scoped clinical context (allergies, active medications, recent observations, prior encounters) rather than the full record. There is no automated check that the context is minimal. | `[PARTIAL]` | `docs/WORKSTREAM_3_SECURITY_REVIEW.md` §7.1 |

---

## C. Access control

| # | Question | Answer | Status | Source |
| :--- | :--- | :--- | :--- | :--- |
| C1 | Is MFA enforced? | No. An MFA code path exists (TOTP and WebAuthn assertion), it is off unless `PROTON_REQUIRE_MFA=true`, and the TOTP branch **accepts any non-zero six-digit code** — it is a synthetic placeholder, not real verification. Do not treat MFA as a live control today. | `[PARTIAL]` | `apps/api/middleware/authService.js` lines 239–263, 344–359 |
| C2 | Do you have role-based access control? | Yes, server-side. Roles are `physician`, `operations_staff`, `admin`, `agent`, and scoped external physician. Clinical sign-off and prescribing are physician-only; other roles receive 403. Role and tenant come from the signed token, and any client-supplied `X-Proton-Actor-*` header is stripped. | `[IMPLEMENTED]` | `apps/api/middleware/rbac.js`; `docs/WORKSTREAM_3_SECURITY_REVIEW.md` §3 |
| C3 | Session timeout? | Two limits: a **15-minute sliding inactivity timeout** and a **24-hour absolute expiry**. Both are enforced server-side. | `[IMPLEMENTED]` | `apps/api/middleware/authService.js` lines 38, 43, 137–153 |
| C4 | What algorithm signs session tokens? | HMAC-SHA256 (HS256), signed with `PROTON_AUTH_SECRET`, which must be at least 32 characters and must not be the development default; the API refuses to boot in production otherwise. Comparison is constant-time. | `[IMPLEMENTED]` | `apps/api/middleware/authService.js` lines 21–31, 104–114; `apps/api/config.js` |
| C5 | Can you revoke a session immediately? | Yes — by token or `jti` — but the revocation list lives in process memory unless `REDIS_URL` is configured. **Without Redis, a restart clears the list and an unexpired token verifies again** until its 24-hour expiry. The pilot does not run Redis. | `[PARTIAL]` | `apps/api/middleware/authService.js` lines 33–36, 187–221; `apps/api/services/distributed/distributedStateManager.js` |
| C6 | How are passwords stored? | Proton's own evaluation accounts store a SHA-256 hash of the password with no salt or KDF — acceptable only for throwaway synthetic fixtures, and disabled outside synthetic mode. Real clinician login is delegated to Medplum OAuth2 with PKCE, so Proton never stores a clinician password. | `[PARTIAL]` | `apps/api/middleware/authService.js` lines 265–342 |
| C7 | How does offboarding work? | Removing the clinician from the Medplum project ends their login. Proton-issued session tokens are not automatically revoked by that action; each live token survives until expiry or manual revocation. There is no documented offboarding checklist. | `[PARTIAL]` | `apps/api/middleware/authService.js`; `docs/PRIVATE_SYNTHETIC_BETA_READINESS.md` §L |
| C8 | Is privileged/admin access separated? | No. The `admin` role exists and is gated in code, but the same person holds every role in practice. There is no break-glass procedure and no just-in-time access. | `[NOT SUPPORTED]` | `apps/api/middleware/rbac.js` |
| C9 | Is access audited? | Yes, in two SHA-256 hash-chained Postgres tables: `workflow_audit_events` (sequence-ordered) and `operational_audit_events` (timestamp-ordered). Every encounter transition records actor id, actor role, and action. The chain detects tampering; it does not prevent a database administrator from rewriting it wholesale. | `[IMPLEMENTED]` | `apps/api/db/workflowMigrations.js` lines 245–261; `docs/WORKSTREAM_3_SECURITY_REVIEW.md` §8 |
| C10 | Are audit logs exported to a SIEM or retained for 6 years? | No. They live in the application database with no export, no offsite copy, and no retention job. There is no SIEM. | `[ROADMAP]` | `docs/BETA_READINESS.md` gap list |
| C11 | How are secrets managed? | Environment variables in the hosting provider's dashboard. No vault, no key rotation schedule, no envelope encryption. Client bundles are checked for leaked keys in the build step. | `[PARTIAL]` | `docs/DEPLOYMENT.md` §2C; `docs/DEPLOYMENT.md` §6 |
| C12 | Is there rate limiting? | Yes: 500 requests/minute per actor or IP generally, 60/minute on AI and transcription endpoints, 10/minute on login. Counters are in memory, so they reset on restart. | `[IMPLEMENTED]` | `apps/api/app.js` lines 83–105 |

---

## D. AI — read this section first

> **The short version.** Three AI providers are wired in: Google Gemini, xAI Grok, and DeepSeek. **None of them offers us a BAA.** No PHI may be sent to any of them. That rule is enforced by keeping real data out of the environment, not by a filter on the request path.

| # | Question | Answer | Status | Source |
| :--- | :--- | :--- | :--- | :--- |
| D1 | Which models and providers do you use? | Google Gemini (via an AI Studio API key; Google Vertex AI only if `GOOGLE_GENAI_USE_VERTEXAI=true`, which we do not set), xAI Grok, and DeepSeek. A deterministic `demo` provider runs with no external call. Model identifiers vary by configuration and are recorded per note in `notes.provenance`. | `[IMPLEMENTED]` | `apps/api/providers/factory.js`; `apps/api/providers/gemini.js`, `grok.js`, `deepseek.js` |
| D2 | What exactly is sent to the provider? | The model prompt, which includes the consultation transcript, the scoped clinical context (allergies, active medications, recent observations), uploaded document text, and — for transcription — the raw audio file. All content travels over TLS. | `[IMPLEMENTED]` | `apps/api/app.js` lines 576–600; `docs/PROTON_AI_DATA_FLOW.md` |
| D3 | Do you send patient identifiers? | Only whatever appears in the transcript or context; there is no de-identification step and no identifier allowlist. In the pilot this is synthetic, so the question does not arise. With real data it would. | `[NOT SUPPORTED]` | no de-identification module exists in `apps/api` |
| D4 | Is our data used to train the providers' models? | Not under our control. We hold no contract term, no zero-retention guarantee, and no BAA with any provider. Default developer terms govern, and those terms vary by provider. | `[PARTIAL]` | `SUBPROCESSORS.md` |
| D5 | Do you have a BAA with the AI providers? | No. Google offers a BAA for Vertex AI under a Google Cloud agreement — we are not on it. xAI and DeepSeek offer none that we are aware of. | `[NOT SUPPORTED]` | `BAA_STANCE.md` |
| D6 | How is "no PHI to the AI providers" actually enforced? | Four things, none of them a content filter: (1) the environment contains only seeded synthetic cohorts; (2) production config refuses to boot with synthetic persistence or demo accounts enabled, so the demo path cannot be mistaken for a real one; (3) a persistent banner reads "SYNTHETIC BETA — NO REAL PATIENT DATA"; (4) the pilot agreement restricts input to synthetic data. **There is no automated PHI detector on the AI request path.** If a clinician pasted a real note, it would be sent. | `[PARTIAL]` | `apps/api/config.js`; `apps/web/src/components/Layout.tsx`; `README.md` |
| D7 | Is there a human in the loop? | Yes. AI output is a draft marked `AI DRAFT — REVIEW REQUIRED`. Nothing reaches the record until a physician approves it, and the safety engine hard-blocks prescriptions missing dose, route, frequency, or duration, plus cross-reactive allergy conflicts. | `[IMPLEMENTED]` | `docs/BETA_READINESS.md` §2; `apps/api/db/workflowMigrations.js` |
| D8 | How do you control hallucination? | Three layers: structured JSON output validated against a schema; deterministic verification that does not use a model at all (missing fields, duplicate orders, allergy cross-reactivity); and mandatory physician review with per-fact approve/reject. Document extraction below 0.70 confidence is flagged. There is no model-level factuality guarantee and no benchmark that would survive a regulator's scrutiny. | `[PARTIAL]` | `docs/BETA_READINESS.md` §2; `docs/WORKSTREAM_3_SECURITY_REVIEW.md` §4 |
| D9 | Can a clinician see where an AI statement came from? | Yes. Every clinical fact and temporal change links to a source panel showing resource type, provenance badge, record date, and the source excerpt. Notes keep a provenance object naming the provider and model used. | `[IMPLEMENTED]` | `docs/BETA_READINESS.md` §2; `docs/PROTON_AI_DATA_FLOW.md` |
| D10 | Does the AI diagnose or prescribe on its own? | No. It proposes. A physician signs. Agents are hard-blocked from signing notes or authorising prescriptions by policy and by role gate. | `[IMPLEMENTED]` | `docs/WORKSTREAM_3_SECURITY_REVIEW.md` §3.1 |
| D11 | What happens if the model is unavailable? | The request fails with an explicit error banner and a retry control; a deterministic `demo` provider can answer without any external call. There is no automatic failover between providers, and no queue. | `[PARTIAL]` | `docs/BETA_READINESS.md` §4; `apps/api/providers/factory.js` |
| D12 | How do you handle prompt injection from uploaded documents? | Document text is scanned for override phrases, jailbreak patterns, and executable payloads. Flagged documents are quarantined, fact extraction is suppressed entirely, and a `SECURITY_INJECTION_QUARANTINE` audit event is written. | `[IMPLEMENTED]` | `docs/WORKSTREAM_3_SECURITY_REVIEW.md` §4.2 |

---

## E. Availability & disaster recovery

| # | Question | Answer | Status | Source |
| :--- | :--- | :--- | :--- | :--- |
| E1 | What uptime do you guarantee? | None. No SLA is offered. The API may run on a free tier that sleeps when idle, producing a cold start of tens of seconds. | `[NOT SUPPORTED]` | `docs/PRIVATE_SYNTHETIC_BETA_DEPLOYMENT.md` §3, troubleshooting table |
| E2 | What are your RPO and RTO? | **Targets, not measurements:** RPO under 5 minutes via continuous WAL archiving, RTO under 30 minutes for failover and under 2 hours for cold restore. None of this is running. | `[ROADMAP]` | `docs/BACKUP_AND_DISASTER_RECOVERY.md` §4 |
| E3 | Single points of failure? | All of them. One founder, one API instance, one database, one FHIR tenant, one region. Any one failing stops the service. | `[NOT SUPPORTED]` | `docs/PRIVATE_SYNTHETIC_BETA_DEPLOYMENT.md` §1 |
| E4 | Has a restore been tested? | No. The restore procedure in the DR document has never been executed against a real backup because no backup job exists. | `[ROADMAP]` | `docs/BACKUP_AND_DISASTER_RECOVERY.md` §3 |
| E5 | What monitoring exists? | `/health` and `/health/ai` endpoints and provider console logs. No uptime monitor, no alerting, no error tracker, no on-call rotation. | `[PARTIAL]` | `apps/api/app.js`; `docs/PRIVATE_SYNTHETIC_BETA_READINESS.md` §H |

---

## F. Compliance

| # | Question | Answer | Status | Source |
| :--- | :--- | :--- | :--- | :--- |
| F1 | Are you HIPAA compliant? | No. No BAA, no Security Risk Analysis, no workforce training, no 6-year audit retention, no breach runbook tested. The controls that exist are *aligned with* parts of the Security Rule; alignment is not compliance. | `[NOT SUPPORTED]` | `README.md`; `docs/BETA_READINESS.md` §3 |
| F2 | Will you sign a BAA? | Not today. `BAA_STANCE.md` lists what must be true first and what each item costs. | `[NOT SUPPORTED]` | `BAA_STANCE.md` |
| F3 | GDPR? | Not compliant. No EU representative, no DPA in place with any vendor, no records of processing, no transfer mechanism documented. Data subject rights are not operable (see B6, B7). | `[NOT SUPPORTED]` | `DPA_TEMPLATE.md` |
| F4 | India DPDP Act 2023? | Alignment only, no compliance claim. Tenant scoping, purpose-of-use logging, and consent fields exist; notice, consent management, and Data Protection Board procedures do not. | `[PARTIAL]` | `docs/WORKSTREAM_3_SECURITY_REVIEW.md` §7 |
| F5 | SOC 2 or ISO 27001? | Neither. No audit has been commissioned, no controls matrix exists, no auditor engaged. | `[NOT SUPPORTED]` | `docs/WORKSTREAM_3_SECURITY_REVIEW.md` §7 disclaimer |
| F6 | Have you had a penetration test? | No. Testing to date is internal: 37 automated suites, a security matrix, and 250 adversarial simulation cases. Internal testing is not a substitute for an external test. | `[ROADMAP]` | `README.md`; `docs/WORKSTREAM_3_SECURITY_REVIEW.md` §1 |
| F7 | Is this a regulated medical device? | No clearance or certification is claimed. It is positioned as documentation and workflow software with physician sign-off, not as a diagnostic device. Regulatory classification has not been formally determined. | `[PARTIAL]` | `docs/WORKSTREAM_3_REAL_CLINIC_READINESS_REPORT.md` |

---

## G. Incident response

| # | Question | Answer | Status | Source |
| :--- | :--- | :--- | :--- | :--- |
| G1 | How do you detect a security incident? | Weakly. Provider logs, application audit events, and anything a user reports. No SIEM, no anomaly detection, no error tracker, no 24/7 monitoring. | `[PARTIAL]` | `INCIDENT_RESPONSE_RUNBOOK.md` |
| G2 | What is your breach notification window? | Committed: acknowledge to the hospital contact within **4 hours** of a confirmed SEV1. Statutory clocks run from there — 72 hours to a supervisory authority under GDPR, 60 days to affected individuals under HIPAA (and only once a BAA exists). Full sequence in the runbook. | `[ROADMAP]` | `INCIDENT_RESPONSE_RUNBOOK.md` |
| G3 | Who is on call? | The founder, alone, with no rotation and no backup. If the founder is unreachable, nobody is on call. | `[NOT SUPPORTED]` | `INCIDENT_RESPONSE_RUNBOOK.md` |
| G4 | Cyber insurance? | None. It is a prerequisite in `BAA_STANCE.md`. | `[NOT SUPPORTED]` | `BAA_STANCE.md` |

---

## H. Subprocessors & data residency

| # | Question | Answer | Status | Source |
| :--- | :--- | :--- | :--- | :--- |
| H1 | Who are your subprocessors? | Vercel, Render or Fly.io, Medplum, Google (Gemini), xAI, DeepSeek, GitHub. The current list, with purpose, data categories, region, plan, and BAA position, is `SUBPROCESSORS.md`. | `[IMPLEMENTED]` | `SUBPROCESSORS.md` |
| H2 | Do you notify customers before adding a subprocessor? | No mechanism exists. There is no customer list, no change notice, and no objection window. The DPA template commits to 30 days' notice; that commitment is not yet operable. | `[ROADMAP]` | `DPA_TEMPLATE.md` §4 |
| H3 | Where is data stored and does it leave the country? | Wherever the chosen vendor region is; nothing is pinned. Gemini, Grok, Medplum, and Vercel default to the US. DeepSeek processes in China. There is no transfer impact assessment and no standard contractual clauses signed with anyone. | `[PARTIAL]` | `SUBPROCESSORS.md` |
| H4 | Is any data stored on clinician or patient devices? | Yes. The browser keeps in-progress drafts and a UI audit log in `sessionStorage` for the life of the tab. The Android app stores everything it knows in app-private `SharedPreferences`, which is **not** separately encrypted beyond OS-level file encryption, and does not sync to a server in the pilot build. | `[PARTIAL]` | `apps/web/src/components/LegacyEncounterWorkspace.tsx`; `apps/dork-android/.../DorkStore.kt` |

---

## What a reviewer should conclude

Proton is a working clinical documentation prototype with better-than-typical engineering hygiene for its stage: server-side authorisation, signed sessions, a 15-minute idle timeout, hash-chained audit, deterministic safety gates, and genuinely PHI-free operational logs.

It is not ready for real patient data, and the gaps are structural rather than cosmetic: no BAA, no encryption key management, no tested backup or restore, no deletion path, no MFA, no external test, no on-call, and a single person holding every privileged role.

A synthetic or de-identified pilot is supportable on the evidence above. A PHI pilot is not.
