# Proton Physician Web Beta — Deployment Architecture & Operations Guide

This guide details the deployment architecture, configuration, infrastructure requirements, and operational procedures for hosting the **Proton Physician Web Beta** on **Vercel** and local environments.

---

## 1. System Deployment Architecture

```
                       +-----------------------------+
                       |       Doctor Browser        |
                       |  (Desktop / Laptop Chrome)  |
                       +--------------+--------------+
                                      |
                         HTTPS (443)  |  (Zero API Keys in Browser)
                                      v
+-----------------------------------------------------------------------------------+
| VERCEL FRONTEND SERVICE (apps/web)                                                |
|                                                                                   |
|  Proton Web App (React 19 + Vite + Tailwind CSS)                                  |
|  - Landing Page & "How Proton Works" Walkthrough                                  |
|  - Doctor Command Center (Deterministic Priorities)                               |
|  - Patient Profile & "What Matters Today" Signal                                  |
|  - Longitudinal Patient Timeline & Evidence Modal                                 |
|  - Consultation Workspace (Capture -> Draft -> Verify -> Review -> Approve)       |
|  - Review Center Inbox ("Nothing gets confirmed without you")                     |
+---------------------+-------------------------------------------------------------+
                      |
        HTTPS API     | CORS-restricted (or same-domain /api)
                      v
+-----------------------------------------------------------------------------------+
| VERCEL BACKEND SERVICE (apps/api - Serverless Function)                           |
|                                                                                   |
|  Proton Backend API (Node.js / Express 5 via apps/api/app.js)                     |
|  - Safe Telemetry Logger (Strict Zero-PHI enforcement)                            |
|  - Health Endpoints: /health, /health/ai                                          |
|  - POST /api/transcribe (Audio streaming -> Provider)                             |
|  - POST /api/generate-note (Clinical prompt + JSON Schema validation)             |
|  - POST /api/extract-documents (Multi-document clinical fact parsing)             |
+----------+----------------------------------------------------+-------------------+
           |                                                    |
           | Secret Server-to-Server                            | FHIR R4 API (HTTPS)
           | (GEMINI_API_KEY)                                   | (Client-side Bearer)
           v                                                    v
+--------------------------+                         +------------------------------+
| AI PROVIDER              |                         | FHIR DATA STORE              |
| Google Gemini API        |                         | Medplum Cloud / Hosted       |
| (gemini-3.8-flash)       |                         | (PostgreSQL + pgvector)      |
+--------------------------+                         +------------------------------+
```

---

## 2. Environment Variables Specification

### A. Local Development

In local development, fallbacks are built-in so developers can run without complex configurations:

```ini
# apps/api/.env (Local Backend API)
PORT=3002
PROTON_AI_MODE=real
PROTON_AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...your_gemini_key...
GEMINI_MODEL=gemini-3.8-flash
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173

# apps/web/.env.local (Local Frontend Web App - Optional)
# Defaults to http://localhost:3002 and http://localhost:8103/ if omitted:
VITE_API_URL=http://localhost:3002
VITE_MEDPLUM_BASE_URL=http://localhost:8103/
```

### B. Vercel Web Service (`apps/web`)

Configure these in the Vercel Project Settings for **`apps/web`**:

| Variable | Required | Production Value | Purpose |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | `https://proton-api.vercel.app` (or `""` if using same-domain `/api` routing) | Endpoint URL of the deployed Proton API server. |
| `VITE_MEDPLUM_BASE_URL` | **Yes** | `https://api.medplum.com/` (or your reachable HTTPS Medplum server) | Endpoint for Medplum FHIR operations. **`localhost:8103` will NOT work from Vercel.** |
| `VITE_MEDPLUM_CLIENT_ID` | Optional | `your-client-id-uuid` | Public Medplum OAuth Client ID if authenticating against a customized Medplum app. |

> [!CAUTION]
> **NEVER put `GEMINI_API_KEY`, provider secrets, or database credentials into `VITE_*` variables.** `VITE_*` variables are compiled into static client JavaScript bundles sent to the browser.

### C. Vercel API Service (`apps/api`)

Configure these in the Vercel Project Settings for **`apps/api`**:

| Variable | Required | Production Value | Purpose |
| :--- | :---: | :--- | :--- |
| `PROTON_AI_MODE` | **Yes** | `real` | Operating mode (`real` or `demo`). |
| `PROTON_AI_PROVIDER` | **Yes** | `gemini` | Active AI provider (`gemini`, `deepseek`, or `demo`). |
| `GEMINI_API_KEY` | **Yes** | `AIzaSy...` | Private Google Gemini API key (server-side secret). |
| `GEMINI_MODEL` | Optional | `gemini-3.8-flash` | Gemini model identifier (defaults to `gemini-3.8-flash`). |
| `CORS_ALLOWED_ORIGINS` | **Yes** | `https://proton-web.vercel.app` | Comma-separated list of allowed frontend origins (e.g. `https://proton-web.vercel.app,https://*-proton.vercel.app`). Wildcard `*` for all origins is strictly disallowed. |
| `PROTON_AUTH_SECRET` | **Yes** | `openssl rand -base64 48` | HMAC key for clinical session tokens. 32+ chars, not the dev default. The API refuses to boot without it. |
| `INTERNAL_AGENT_SECRET` | **Yes** | `openssl rand -base64 32` | Shared secret for internal tool invocation. 16+ chars, not the dev default. |
| `PROTON_SYNTHETIC_MODE` | **Yes** | `false` | Must be `false` in production. When true, unauthenticated requests resolve to a seeded development physician. Production refuses to boot if set true. |
| `PROTON_ALLOW_DEMO_ACCOUNTS` | Optional | `false` | Enables the hardcoded evaluation accounts. Never enable in production. |
| `PROTON_REQUIRE_MFA` | Optional | `true` | Requires an MFA challenge on `/api/auth/login`. |
| `DATABASE_URL` | **Yes** | `postgres://user:pass@host:5432/proton_ops` | PostgreSQL system of record for workflow state. The API refuses to boot in production without it. |
| `WORKFLOW_PERSISTENCE` | Optional | `postgres` | `disabled` turns off durable workflow (returns `503` on `/api/workflow/*`). Production requires `postgres`. |
| `WORKFLOW_SCHEDULER` | Optional | `on` | `off` disables the recurring outbox safety-net job; the worker still drains on demand. |
| `MEDPLUM_TOKEN` | If `PROTON_FHIR_PERSISTENCE_MODE=medplum` | server token | Server-side FHIR credential. |

> [!WARNING]
> **Strict-mode client gap.** Outside synthetic mode the API now rejects anonymous
> clinician traffic (`401 AUTHENTICATION_REQUIRED`). The web client does not yet
> send a Proton session token with its API calls, so clinician screens will fail
> closed until a single authenticated API client (or a Medplum→Proton token
> exchange) is wired. See [`VALIDATION.md`](./VALIDATION.md#what-is-not-covered).

---

## 3. Vercel Monorepo Deployment Setup

Vercel detects the Proton repository as a monorepo containing:
- `apps/web`: Vite frontend
- `apps/api`: Express backend

Deploy them as two coordinated Vercel projects:

### Service 1: Web Frontend (`proton-web`)
1. In Vercel, click **Add New Project** and import the `proton` repository.
2. Under **Root Directory**, click Edit and select **`apps/web`**.
3. **Framework Preset**: Vite (automatically detected).
4. **Build Settings**:
   - Build Command: `npm run build` (runs `tsc -b && vite build`)
   - Output Directory: `dist`
   - Install Command: `npm install`
5. **Rewrites Configuration**: `apps/web/vercel.json` contains:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
   This ensures client-side React Router navigation (e.g., refreshing on `/patients/:id` or `/consultation`) resolves properly without 404 errors.
6. **Environment Variables**: Add `VITE_API_URL` and `VITE_MEDPLUM_BASE_URL`.
7. Click **Deploy**.

### Service 2: Backend API (`proton-api`)
1. In Vercel, click **Add New Project** and import the same `proton` repository a second time.
2. Under **Root Directory**, click Edit and select **`apps/api`**.
3. **Framework Preset**: Other.
4. **Build Settings**:
   - Build Command: leave empty
   - Output Directory: leave empty
   - Install Command: `npm install`
5. **Serverless Architecture**:
   - `apps/api/app.js`: Clean Express application export (`module.exports = app`).
   - `apps/api/api/index.js`: Vercel serverless function entrypoint forwarding to `../app`.
   - `apps/api/vercel.json`: Rewrites all incoming paths to `/api/index.js`:
     ```json
     {
       "version": 2,
       "rewrites": [
         { "source": "/(.*)", "destination": "/api/index.js" }
       ]
     }
     ```
6. **Environment Variables**: Add `PROTON_AI_MODE`, `PROTON_AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and `CORS_ALLOWED_ORIGINS`.
7. Click **Deploy**.

---

## 4. Medplum / FHIR Production Requirements

> [!IMPORTANT]
> **`http://localhost:8103` cannot be reached by browsers visiting a Vercel-hosted web application.**

For a cloud Vercel deployment, you must point `VITE_MEDPLUM_BASE_URL` to a publicly reachable Medplum instance over HTTPS:

### Option A: Medplum Cloud (Recommended for Beta)
1. Register for an account on [Medplum Cloud](https://app.medplum.com).
2. Create a project and seed a test practitioner account.
3. In Vercel Web settings:
   - `VITE_MEDPLUM_BASE_URL=https://api.medplum.com/`

### Option B: Self-Hosted Medplum with HTTPS
1. Host Medplum on a cloud VM or Kubernetes cluster (Render, Fly.io, AWS, DigitalOcean).
2. Configure TLS/HTTPS and set Medplum's `allowedOrigins` to permit your Vercel frontend URL.
3. In Vercel Web settings:
   - `VITE_MEDPLUM_BASE_URL=https://fhir.yourdomain.com/`

*Note: The Proton API (`apps/api`) does not directly connect to Medplum; all FHIR transactions are securely executed directly from the authenticated physician's browser using short-lived Medplum session tokens.*

---

## 5. Local Development (Preserved & Unbroken)

Local development remains 100% operational on standard local ports:

```bash
# 1. Medplum Server (Port 8103)
docker run -p 8103:8103 ghcr.io/medplum/medplum-server:latest

# 2. Proton API Server (Port 3002)
cd apps/api
npm install
npm start
# -> Listens on http://localhost:3002 via apps/api/index.js

# 3. Proton Web App (Port 3001)
cd ../web
npm install
npm run dev
# -> Listens on http://localhost:3001
```

---

## 6. Pre-Deployment Verification Checklist

Before promoting any build to physician beta access:

- [x] Production build succeeds cleanly (`npm run build --prefix apps/web` in ~350ms).
- [x] Express app exports cleanly without listening when imported as a module (`apps/api/app.js`).
- [x] Local listener works unchanged on port 3002 (`apps/api/index.js`).
- [x] 10-area web beta verification test suite passes (`NODE_PATH=apps/web/node_modules node apps/web/tests/web_beta_verification.cjs`).
- [x] 11-point physician validation checklist passes (`NODE_PATH=apps/web/node_modules node apps/web/tests/physician_validation_checklist.cjs`).
- [x] API health endpoints report live status: `GET /health` and `GET /health/ai`.
- [x] Zero API keys or secrets detected in compiled frontend assets (`apps/web/dist`).
- [x] `.gitignore` excludes all `.env` and `.env.local` files.
- [x] Persistent `SYNTHETIC BETA — NO REAL PATIENT DATA` regulatory banner is active.
- [x] Strict deterministic safety gates prevent unverified prescription orders.
