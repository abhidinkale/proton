# PROTON — Clinical AI Copilot

> **Controlled Physician Validation Release**  
> Ambient Intelligence • Structured Clinical Notes • Deterministic Safety Verification • FHIR R4 Persistence

<p align="left">
  <a href="https://abhijeetdinkale-arch.github.io/proton-trailer/"><img src="https://img.shields.io/badge/🎬%20Watch%20Trailer-Live%20Interactive%20Preview-0ea5e9?style=for-the-badge" alt="Live Trailer" /></a>
  <a href="https://github.com/abhijeetdinkale-arch/proton-trailer"><img src="https://img.shields.io/badge/Trailer%20Repo-proton--trailer-emerald?style=for-the-badge&logo=github" alt="Trailer Repo" /></a>
</p>

---

> [!WARNING]
> **SYNTHETIC BETA — NO REAL PATIENT DATA**  
> This version of Proton is configured exclusively for controlled physician workflow validation using **100% synthetic patient cohorts** (e.g., Eleanor Vance and Arthur Pendelton). Do not input real patient data or Protected Health Information (PHI). Real-world PHI deployment requires enterprise HIPAA Business Associate Agreements (BAAs), tenant compartment boundaries, and production KMS encryption.

---

## Overview

Proton is an AI-native clinical operating system and ambient copilot designed for practicing physicians. Rather than acting as another passive form-filling tool, Proton delivers:

1. **Pre-Consultation Patient Intelligence:** Generates a 10-second situational brief before the doctor enters the exam room, computing deterministic temporal changes (e.g. HbA1c escalation 7.1% $\rightarrow$ 8.2%, medication titrations) directly from confirmed FHIR memory.
2. **Ambient Dialogue Capture:** Transcribes clinical dialogue in real time (with optional zero-hardware sample simulation).
3. **Structured Note Generation:** Drafts structured SOAP and General Consultation notes with clear provenance badges (`AI DRAFT — REVIEW REQUIRED` shifting to `DOCTOR EDITED` upon modification).
4. **Deterministic Clinical Verification:** Strictly blocks invalid prescriptions (missing dose, frequency, duration) and flags duplicate orders or cross-reactive allergy conflicts (e.g., Penicillin vs Amoxicillin, NSAID classes).
5. **Prescription Builder & PDF Export:** Physician-governed medication order composer with confirmation gating and formatted prescription PDF generation.
6. **Post-Consultation Memory Gating:** Proposals to update permanent medical memory (e.g., new conditions, resolved problems) require explicit doctor approval before committing to FHIR.
7. **Document Ingestion with Provenance:** Extracts clinical facts from uploaded medical records with fact-level approve/reject controls and source citations.
8. **Doctor Command Center & Longitudinal Timeline:** Clinic attention queues, practice metric cards, and filterable timeline navigation.
9. **Closed-Loop Patient Care:** an Android patient app syncs with the durable backend (clinic desk writes mirror into the durable Postgres store; the patient app syncs directly to Postgres) — booking, intake, refills, follow-ups, and clinic messages that survive airplane mode, land exactly once, and appear in the clinician's attention queue. See [`docs/DEMO.md`](docs/DEMO.md).

---

## Architecture

```
                  ┌───────────────────────────────────────────┐
                  │          Physician Web Browser            │
                  │   (Laptop / Desktop / Clinic Terminal)    │
                  └─────────────────────┬─────────────────────┘
                                        │ HTTPS
                                        ▼
                  ┌───────────────────────────────────────────┐
                  │           Proton Frontend (Web)           │
                  │       (SPA: React 19 + Vite + Tailwind)   │
                  └──────────────┬─────────────────────┬──────┘
                                 │ HTTPS (FHIR SDK)    │ HTTPS (/api)
                                 ▼                     ▼
┌──────────────────────────────────────┐     ┌────────────────────────────────────────┐
│        Medplum Backend (FHIR)        │     │            Proton API Server           │
│         (PostgreSQL + OAuth2)        │     │         (Node.js 20+ Express API)      │
│     Standard FHIR R4 Store & Auth    │     └───────────────────┬────────────────────┘
└──────────────────────────────────────┘                         │ HTTPS (Server-Side)
                                                                 ▼
                                                     ┌────────────────────────┐
                                                     │   AI Provider Gateway  │
                                                     │  Gemini / Grok / Demo  │
                                                     └────────────────────────┘
```

- **Frontend (`apps/web`):** React 19, TypeScript, Vite, Tailwind CSS, `@medplum/react`, Lucide Icons.
- **Backend API (`apps/api`):** Node.js 20+, Express, Multer, Provider Gateway.
- **Patient App (`apps/dork-android`):** Kotlin, Jetpack Compose, durable outbox (DorkStore) with per-row idempotency keys, exact-alarm reminders. Syncs over `/api/patient/sync/*`; identity comes from an OTP-issued patient session, never from the request body.
- **FHIR / Auth:** Medplum OAuth2 PKCE authentication and atomic FHIR R4 batch transactions (`medplum.executeBatch`).

---

## Local Development Setup

### Prerequisites
- Node.js 20.x or higher
- PostgreSQL 16 (for durable workflow state) — `brew install postgresql@16` or the compose service
- Docker (optional, for local Medplum FHIR server)

The API boots without PostgreSQL, but `/api/workflow/*` then returns
`503 WORKFLOW_PERSISTENCE_DISABLED` and the clinical loop is not durable.
Production refuses to start without `DATABASE_URL`.

### 1. Clone the Repository
```bash
git clone <your-repo-url> proton
cd proton
```

### 2. Start Medplum FHIR Server (Local Docker)
```bash
# If running Medplum locally via Docker:
docker compose up -d
```
Medplum local admin will be available at `http://localhost:8103`. Default development admin: `admin@example.com` / `medplum_admin`.

### 3. Install Dependencies
```bash
# Install Web Client dependencies
cd apps/web && npm install

# Install API dependencies
cd ../api && npm install
```

### 4. Configure Environment Variables

Create `apps/web/.env.local`:
```env
VITE_API_URL=http://localhost:3002
VITE_MEDPLUM_BASE_URL=http://localhost:8103/
VITE_MEDPLUM_CLIENT_ID=your-medplum-client-id
```

Create `apps/api/.env`:
```env
PORT=3002
PROTON_AI_MODE=demo
PROTON_AI_PROVIDER=demo
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173
# Local development only: resolve unauthenticated requests to a seeded physician.
# Never enable this on a public deployment.
PROTON_SYNTHETIC_MODE=true
# Durable clinical workflow (PostgreSQL). Omit to run without persistence.
DATABASE_URL=postgres://localhost:5432/proton_ops
WORKFLOW_PERSISTENCE=postgres
# Optional: Set when testing live AI
# GEMINI_API_KEY=your-gemini-key
# XAI_API_KEY=your-grok-key
```

Create the database once:

```bash
createdb proton_ops     # or: docker compose up -d postgres
```

The API applies its migrations and starts the pg-boss worker at boot.

Production deployments additionally require strong `PROTON_AUTH_SECRET` and
`INTERNAL_AGENT_SECRET` values; the API refuses to boot without them. See
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

### 5. Run the Application
In separate terminals:

```bash
# Terminal 1: Backend API
cd apps/api
node index.js

# Terminal 2: Web Client
cd apps/web
npm run dev
```

Open `http://localhost:3001` in your browser.

---

## Automated Test Verification

The gated suite is hermetic: it needs no API keys, no local model, and no running
server. See [`docs/VALIDATION.md`](docs/VALIDATION.md) for exactly what is and is
not covered.

```bash
# Web type-check and production build
npm --prefix apps/web run build

# All deterministic API + clinical safety suites (65 suites)
npm --prefix apps/api test

# One suite, e.g. the security matrix
npm --prefix apps/api test -- --filter=milestone6
```

`apps/web/tests/*.cjs` are legacy manual browser scripts that require `puppeteer`
and a running web/API stack. They are not part of CI.

---

## Deployment Structure

| Service | Recommended Platform | Build Command | Output / Start |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | Vercel or Render Static Site | `npm run build` (in `apps/web`) | `dist` |
| **Backend API** | Render Web Service or Fly.io | `npm install` (in `apps/api`) | `node index.js` |
| **FHIR / Auth** | Medplum Cloud (`api.medplum.com`) or Self-Hosted Docker | Managed PaaS | `http://localhost:8103` / Cloud |

Detailed step-by-step deployment and clinician invitation procedures are documented in [`docs/PRIVATE_SYNTHETIC_BETA_DEPLOYMENT.md`](docs/PRIVATE_SYNTHETIC_BETA_DEPLOYMENT.md).

---

## Project Documentation Directory

- [`docs/VALIDATION.md`](docs/VALIDATION.md) — **Single source of truth for test coverage.**
- [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) — **Known issues register: trigger conditions and deferred remediation.**
- [`docs/PILOT_CUT.md`](docs/PILOT_CUT.md) — **The active plan: deploy, prove on devices, then build.** Start here.
- [`docs/PILOT_90_DAY_PLAN.md`](docs/PILOT_90_DAY_PLAN.md) — **90-day pilot plan: $0 infrastructure, 1000 patients, 50 hospital design partners.**
- [`docs/trust/`](docs/trust/) — Hospital-facing trust pack: security questionnaire, subprocessor list, DPA template, BAA stance, privacy policy, incident runbook.
- [`docs/README.md`](docs/README.md) — Documentation index; explains which reports are historical.
- [`docs/PRIVATE_SYNTHETIC_BETA_DEPLOYMENT.md`](docs/PRIVATE_SYNTHETIC_BETA_DEPLOYMENT.md) — Remote PaaS deployment guide and physician account setup.
- [`docs/DEMO.md`](docs/DEMO.md) — The 3-minute phone + laptop demo, and what is actually happening behind it.
- [`docs/adr/`](docs/adr/) — Decisions that are expensive to reverse, including [ADR 0004](docs/adr/0004-closed-loop-clinical-agents.md): clinical agents propose, the physician attests.
- [`docs/PROTON_M6_THREAT_MODEL.md`](docs/PROTON_M6_THREAT_MODEL.md) — Threat model and trust boundaries.
- [`docs/PHYSICIAN_VALIDATION_PROTOCOL.md`](docs/PHYSICIAN_VALIDATION_PROTOCOL.md) — 14-section validation test protocol for practicing physicians.

---

## License

Proprietary — Internal Physician Evaluation and Controlled Beta Testing Only.
