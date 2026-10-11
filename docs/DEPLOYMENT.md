# Proton Physician Web Beta — Deployment Architecture & Operations Guide

This guide details the deployment architecture, configuration, infrastructure requirements, and operational procedures for hosting the **Proton Physician Web Beta**.

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
| FRONTEND HOST (Vercel / Static Edge CDN)                                          |
|                                                                                   |
|  Proton Web App (React 19 + Vite + Tailwind + Mantine)                            |
|  - Landing Page & "How Proton Works" Walkthrough                                  |
|  - Doctor Command Center (Deterministic Priorities)                               |
|  - Patient Profile & "What Matters Today" Signal                                  |
|  - Longitudinal Patient Timeline & Evidence Modal                                 |
|  - Consultation Workspace (Capture -> Draft -> Verify -> Review -> Approve)       |
|  - Review Center Inbox ("Nothing gets confirmed without you")                     |
+---------------------+-------------------------------------------------------------+
                      |
        HTTPS API     | CORS-restricted
                      v
+-----------------------------------------------------------------------------------+
| BACKEND HOST (Render / Fly.io / AWS ECS)                                          |
|                                                                                   |
|  Proton Backend API (Node.js / Express 5)                                         |
|  - Safe Telemetry Logger (Strict Zero-PHI enforcement)                            |
|  - Health Endpoints: /health, /health/ai                                          |
|  - POST /api/transcribe (Audio streaming -> Provider)                             |
|  - POST /api/generate-note (Clinical prompt + JSON Schema validation)             |
|  - POST /api/extract-documents (Multi-document clinical fact parsing)             |
+----------+----------------------------------------------------+-------------------+
           |                                                    |
           | Secret Server-to-Server                            | FHIR R4 API
           | (GEMINI_API_KEY)                                   | (OAuth Bearer)
           v                                                    v
+--------------------------+                         +------------------------------+
| AI PROVIDER              |                         | FHIR DATA STORE              |
| Google Gemini API        |                         | Medplum Cloud / Hosted       |
| (gemini-3.8-flash)       |                         | (PostgreSQL + pgvector)      |
+--------------------------+                         +------------------------------+
```

---

## 2. Environment Variables Specification

### A. Frontend Environment Variables (`apps/web/.env`)

These variables are bundled by Vite at build time. **NEVER put AI API keys, Medplum client secrets, or administrative credentials here.**

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | Yes | `https://api.proton.example.com` | Base URL for Proton Backend API |
| `VITE_MEDPLUM_BASE_URL` | Yes | `https://api.medplum.com/` | Base URL for Medplum FHIR server |
| `VITE_MEDPLUM_CLIENT_ID` | Optional | `client-id-uuid` | Public Medplum Client ID (if using OAuth app) |
| `VITE_AUTH_PROVIDER` | No | `medplum_synthetic` | Auth mode (`medplum_synthetic` or `supabase`) |

### B. Backend Environment Variables (`apps/api/.env`)

These variables are server-side only and must be kept strictly confidential.

| Variable | Required | Production Value | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | Yes | `3002` (or injected by platform) | Port for Express API server |
| `PROTON_AI_MODE` | Yes | `real` | AI operating mode (`real` or `demo`) |
| `PROTON_AI_PROVIDER` | Yes | `gemini` | Active AI provider (`gemini`) |
| `GEMINI_API_KEY` | Yes (for real AI) | `AIzaSy...` | Private Google Gemini API key |
| `PROTON_AI_MODEL` | No | `gemini-3.8-flash` | Primary Gemini model identifier |
| `CORS_ALLOWED_ORIGINS` | Yes | `https://app.proton.example.com` | Comma-separated allowed frontend origins |
| `MEDPLUM_BASE_URL` | Yes | `https://api.medplum.com` | Target Medplum FHIR endpoint |

---

## 3. Frontend Deployment (Vercel)

### Configuration (`apps/web/vercel.json`)
The repository includes an optimized SPA rewrite configuration:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Vercel Project Setup Steps
1. In Vercel, import the repository.
2. Set **Root Directory** to `apps/web`.
3. Set **Framework Preset** to `Vite`.
4. Build settings:
   - **Build Command**: `npm run build` (`tsc -b && vite build`)
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Configure Environment Variables:
   - `VITE_API_URL`: URL of the deployed backend API (e.g. `https://proton-api.onrender.com`)
   - `VITE_MEDPLUM_BASE_URL`: URL of the Medplum server (e.g. `https://api.medplum.com/` or hosted instance)
6. Deploy.

---

## 4. Backend Deployment (Render / Fly.io / Container)

### Render Setup Steps
1. Create a **Web Service** on Render connected to the repository.
2. Set **Root Directory** to `apps/api`.
3. Set **Environment** to `Node`.
4. Build & Start commands:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start` (`node index.js`)
5. Configure Environment Variables:
   - `PORT`: `10000` (or leave default)
   - `PROTON_AI_MODE`: `real`
   - `PROTON_AI_PROVIDER`: `gemini`
   - `GEMINI_API_KEY`: *(Securely injected from Google AI Studio / Google Cloud)*
   - `PROTON_AI_MODEL`: `gemini-3.8-flash`
   - `CORS_ALLOWED_ORIGINS`: `https://app.proton.example.com`
   - `MEDPLUM_BASE_URL`: `https://api.medplum.com`
6. Health Check Path: `/health`.

---

## 5. Medplum / FHIR Infrastructure

Proton uses FHIR R4 for clinical memory persistence.

### Option A: Medplum Cloud (Recommended for Beta)
- Register a clinical workspace project on [Medplum](https://app.medplum.com).
- Create a dedicated Practitioner account for the evaluating physician.
- Configure `VITE_MEDPLUM_BASE_URL=https://api.medplum.com/`.

### Option B: Self-Hosted Medplum (OrbStack / Docker / Kubernetes)
- Spin up Medplum server with PostgreSQL 16 + pgvector.
- Ensure SSL termination is enabled via reverse proxy (Caddy / Nginx / Cloudflare).
- Set CORS in Medplum configuration to allow requests from the Proton frontend origin.

---

## 6. Health & Operational Endpoints

Proton exposes safe, non-sensitive health check endpoints:

### `GET /health`
Validates basic server uptime and operating mode.
```json
{
  "status": "ok",
  "mode": "real",
  "timestamp": "2026-10-12T02:28:51.485Z"
}
```

### `GET /health/ai`
Exposes AI pipeline readiness without leaking credentials or API keys.
```json
{
  "status": "ok",
  "mode": "real",
  "provider": "gemini",
  "model": "gemini-3.8-flash",
  "configured": true,
  "timestamp": "2026-10-12T02:28:51.494Z"
}
```

---

## 7. Local Development Guide

To run the entire Proton physician workspace locally:

```bash
# 1. Start Medplum FHIR service (Port 8103)
# (via Docker / OrbStack or Medplum Cloud account)

# 2. Start Proton Backend API (Port 3002)
cd apps/api
npm install
npm start

# 3. Start Proton Web Application (Port 3001)
cd ../web
npm install
npm run dev -- --port 3001
```

Access in browser:
`http://localhost:3001`

---

## 8. Pre-Deployment Verification Checklist

Before promoting any build to public physician beta access:

- [x] Run comprehensive 10-area web beta verification test suite (`node apps/web/tests/web_beta_verification.cjs`).
- [x] Run AI clinical validation scorecard (`node apps/api/tests/clinical_ai_validation.cjs`).
- [x] Run live Gemini smoke test (`node apps/api/tests/gemini_live_smoke.cjs`).
- [x] Run Command Center 2.0 operational suite (`node apps/web/tests/command_center_v2_e2e.cjs`).
- [x] Run physician validation checklist (`node apps/web/tests/physician_validation_checklist.cjs`).
- [x] Verify zero API keys or secrets in frontend bundle (`apps/web/dist`).
- [x] Verify `.gitignore` excludes all `.env` files.
- [x] Verify persistent "SYNTHETIC BETA — NO REAL PATIENT DATA" banner is present across all views.
- [x] Verify deterministic safety checks block unverified medication orders.
- [x] Verify physician confirmation checkbox is required before saving prescriptions.
