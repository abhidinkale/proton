# PROTON PRIVATE SYNTHETIC PHYSICIAN BETA — DEPLOYMENT GUIDE
**Document Version:** 1.0.0-beta-ops  
**Target Milestone:** Controlled Remote Testing with 3–5 Practicing Physicians  
**Scope:** Strictly 100% Synthetic Patient Data Only — No Real PHI  
**Target Architecture:** Lightweight, cost-efficient PaaS deployment (Vercel/Render/Fly.io + Medplum Cloud/Self-Hosted)

---

## 1. RECOMMENDED HOSTING ARCHITECTURE

To keep operational complexity minimal while guaranteeing high uptime, reliability, and security for 3–5 physicians:

```
                  ┌───────────────────────────────────────────┐
                  │          Physician Web Browser            │
                  │   (Laptop / Desktop / Clinic Terminal)    │
                  └─────────────────────┬─────────────────────┘
                                        │ HTTPS
                                        ▼
                  ┌───────────────────────────────────────────┐
                  │           Proton Frontend (Web)           │
                  │          Hosted on Vercel / Render        │
                  │       (SPA: React 19 + Vite + Tailwind)   │
                  └──────────────┬─────────────────────┬──────┘
                                 │ HTTPS (FHIR SDK)    │ HTTPS (/api)
                                 ▼                     ▼
┌──────────────────────────────────────┐     ┌────────────────────────────────────────┐
│        Medplum Backend (FHIR)        │     │            Proton API Server           │
│  Option A: Medplum Cloud (Managed)   │     │         Hosted on Render / Fly.io      │
│  Option B: Medplum Docker on Render  │     │      (Node.js 20+ Express, Port-bound) │
│   (PostgreSQL + OAuth2 + FHIR R4)    │     └───────────────────┬────────────────────┘
└──────────────────────────────────────┘                         │ HTTPS (Server-Side)
                                                                 ▼
                                                     ┌────────────────────────┐
                                                     │   AI Provider Gateway  │
                                                     │  Gemini / Grok / Demo  │
                                                     └────────────────────────┘
```

- **Frontend:** Vercel or Render Static Site (free/hobby tier). Instant global CDN, automatic SSL.
- **API Server:** Render Web Service or Fly.io (Node.js runtime, automatic TLS, health checks).
- **FHIR / Auth Database:** Medplum Cloud (free developer tier at `api.medplum.com` or single-container Docker on Render).

---

## 2. FRONTEND DEPLOYMENT (Vercel or Render Static Site)

### Option A: Deploy to Vercel (Recommended)
1. Push the repository to a private GitHub repository.
2. Log into [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import the `proton` repository.
4. Configure Project Settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `apps/web`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Add Environment Variables (see Section 4).
6. Click **Deploy**. Vercel will assign a production URL (e.g., `https://proton-beta.vercel.app`).

### Option B: Deploy to Render Static Site
1. Log into [render.com](https://render.com) $\rightarrow$ **New Static Site**.
2. Root Directory: `apps/web`
3. Build Command: `npm run build`
4. Publish Directory: `dist`
5. Add Single-Page App rewrite rule: `/*` $\rightarrow$ `/index.html`.

---

## 3. API DEPLOYMENT (Render Web Service or Fly.io)

### Deploy to Render Web Service
1. Log into [render.com](https://render.com) $\rightarrow$ **New Web Service**.
2. Connect repository.
3. Configure settings:
   - **Root Directory:** `apps/api`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Instance Type:** Starter (or Free tier)
4. Add Environment Variables (see Section 4).
5. Render assigns a public URL (e.g., `https://proton-api.onrender.com`).

---

## 4. REQUIRED ENVIRONMENT VARIABLES

### Frontend (`apps/web`) Environment Variables
Set these in your Vercel or Render dashboard:

| Variable | Example Production Value | Purpose |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://proton-api.onrender.com` | Base URL of deployed Proton API (No trailing slash) |
| `VITE_MEDPLUM_BASE_URL` | `https://api.medplum.com/` or your deployed Medplum URL | FHIR server base endpoint |
| `VITE_MEDPLUM_CLIENT_ID` | `your-medplum-client-id-uuid` | Medplum OAuth2 client application ID |

### Backend (`apps/api`) Environment Variables
Set these in your Render or Fly.io service dashboard:

| Variable | Example Production Value | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3002` (Automatically injected by hosting provider) | HTTP server port |
| `CORS_ALLOWED_ORIGINS` | `https://proton-beta.vercel.app` | Comma-separated list of allowed frontend domains |
| `PROTON_AI_MODE` | `demo` (or `live`) | AI mode (`demo` runs deterministic clinical mocks) |
| `PROTON_AI_PROVIDER` | `demo` (or `gemini` / `grok`) | Active AI engine abstraction |
| `GEMINI_API_KEY` | `AIzaSy...` (Only if `PROTON_AI_MODE=live`) | Google Gemini server-side developer key |
| `XAI_API_KEY` | `xai-...` (Only if using Grok provider) | xAI server-side developer key |

---

## 5. MEDPLUM CONFIGURATION

### Option 1: Managed Medplum Cloud (Fastest & Zero Devops)
1. Register a free account at [medplum.com](https://medplum.com).
2. Create a project named: `Proton-Synthetic-Beta`.
3. In the Medplum Admin Console $\rightarrow$ **Project Admin** $\rightarrow$ **Clients**:
   - Create a Client Application named `Proton Web Client`.
   - Set Redirect URI: `https://proton-beta.vercel.app/`
   - Copy the generated `Client ID`.
4. In your frontend environment variables:
   - `VITE_MEDPLUM_BASE_URL=https://api.medplum.com/`
   - `VITE_MEDPLUM_CLIENT_ID=<Your-Client-ID>`

### Option 2: Self-Hosted Medplum on Docker / PaaS
If you prefer complete data sovereignty, deploy the Medplum Docker stack (`medplum/medplum-server`) with a managed PostgreSQL instance on Render or AWS Lightsail.

---

## 6. CORS CONFIGURATION

The Proton API restricts CORS access using `CORS_ALLOWED_ORIGINS`.
- In development: Defaults to local Vite ports (`http://localhost:3000`, `3001`, `5173`).
- In beta deployment: Set `CORS_ALLOWED_ORIGINS=https://proton-beta.vercel.app` in the API host settings. Requests from other web origins receive a `403 CORS request blocked: Origin not allowed.` error.

---

## 7. AUTHENTICATION SETUP & SESSION LIFECYCLE

- Authentication is managed through Medplum OAuth2 PKCE.
- The physician logs in using email and individual password at `/login`.
- Access tokens (JWT) and refresh tokens are securely retained in browser storage.
- Protected routes (`/`, `/patients`, `/consultation`, `/document-review`) verify active session profile; expired tokens trigger a graceful redirect to `/login`.
- Clicking **"Sign Out"** invalidates the token and navigates back to `/login`.

---

## 8. SYNTHETIC PATIENT SETUP

The deployed beta automatically provisions synthetic data:
1. **Auto-Seed on Fresh Deployment:** When a physician logs in for the first time on an empty database, `Dashboard.tsx` detects 0 patient records and automatically executes batch transactions creating:
   - **Eleanor Vance:** Multimorbid chronic condition (T2D, HTN, Penicillin anaphylaxis, HbA1c escalation 7.1% $\rightarrow$ 8.2%, Metformin titration).
   - **Arthur Pendelton:** Conflicting clinical records (divergent dyspnea notes, borderline creatinine, ambiguous inhaler).
2. **On-Demand Generation:** The physician can also click **"Create Clinical Brain Demo Patient"** or **"Add Conflicting History Case"** anytime in the Patients view to test afresh.

---

## 9. CREATING PHYSICIAN ACCOUNTS (STEP-BY-STEP)

To create 3–5 distinct accounts for validating physicians:

### Via Medplum Admin Console:
1. Log into your Medplum project console (`https://app.medplum.com` or local admin).
2. Navigate to **Project Admin** $\rightarrow$ **Users** $\rightarrow$ **Invite User**.
3. Fill in the details:
   - **Email:** `doctor1@clinic.test` (or the physician's real email)
   - **Resource Type:** `Practitioner`
   - **First Name:** `Sarah`
   - **Last Name:** `Jenkins`
4. Choose **"Set Password"** (assign a temporary password e.g. `ProtonBeta2026!`) or choose **"Send Invite Link"**.
5. Repeat for doctors 2 through 5:
   - Dr. Robert Chen (`doctor2@clinic.test`)
   - Dr. Marcus Brody (`doctor3@clinic.test`)
   - Dr. Emily Davis (`doctor4@clinic.test`)
   - Dr. Alex Morgan (`doctor5@clinic.test`)
6. Deliver individual credentials securely via 1Password, Signal, or encrypted email.

---

## 10. HEALTH CHECK VERIFICATION

Verify the API is live before inviting doctors:
```bash
curl -i https://proton-api.onrender.com/health
```

Expected HTTP Response:
```json
HTTP/2 200
content-type: application/json; charset=utf-8

{
  "status": "ok",
  "mode": "demo",
  "timestamp": "2026-10-08T03:55:38.394Z"
}
```

---

## 11. BUILD COMMANDS

### Frontend:
```bash
cd apps/web
npm install
npm run build
```
Generates production build in `apps/web/dist`.

### Backend:
```bash
cd apps/api
npm install
```

---

## 12. LOCAL DEVELOPMENT WORKFLOW

To run the local stack:
```bash
# Terminal 1: Backend API (port 3002)
cd apps/api
node index.js

# Terminal 2: Frontend Client (port 3001)
cd apps/web
npm run dev
```

Open `http://localhost:3001` in your browser.

---

## 13. BETA DEPLOYMENT CHECKLIST

- [ ] Repository committed and pushed to private GitHub repository.
- [ ] Backend API deployed to Render / Fly.io.
- [ ] Backend `/health` endpoint responds with `{ "status": "ok" }`.
- [ ] Frontend deployed to Vercel / Render with `VITE_API_URL` pointing to backend.
- [ ] `CORS_ALLOWED_ORIGINS` set on backend matching frontend URL.
- [ ] Medplum Project client configured and client ID set in frontend.
- [ ] 3–5 Practitioner accounts created in Medplum.
- [ ] Tested login with test physician credentials.
- [ ] Verified synthetic banner: `"SYNTHETIC BETA — NO REAL PATIENT DATA"`.
- [ ] Completed simulated consultation and verified FHIR save.

---

## 14. SECRET MANAGEMENT

- **Client Bundle:** Verified that zero API keys, secrets, or administrative credentials are in the client bundle.
- **Backend Secrets:** `GEMINI_API_KEY` and `XAI_API_KEY` exist only as server-side environment variables in the hosting provider's encrypted secrets store.
- **Never commit `.env` or `.env.local` to git:** Guaranteed by root `.gitignore`.

---

## 15. TROUBLESHOOTING

| Symptom | Cause | Resolution |
| :--- | :--- | :--- |
| **CORS error in browser console** | Origin mismatch | Update `CORS_ALLOWED_ORIGINS` in backend environment settings to match the exact frontend URL. |
| **"Login failed. Please check your credentials"** | Incorrect Medplum Base URL or Client ID | Verify `VITE_MEDPLUM_BASE_URL` and `VITE_MEDPLUM_CLIENT_ID` in frontend settings. |
| **AI note generation fails** | API unreachable or sleep mode | Free tier hosting services (e.g. Render Free) spin down on idle. Ping `/health` or upgrade to Starter tier ($7/mo) to keep API warm. |
| **Patients table empty** | Initial load timing | Refresh page; auto-seeding provisions Eleanor Vance and Arthur Pendelton on first visit. |

---

## 16. HOW TO SHUT DOWN THE BETA

When the physician validation cohort is complete:
1. **Disable Frontend:** In Vercel or Render dashboard $\rightarrow$ Project Settings $\rightarrow$ **Pause / Delete Deployment**.
2. **Suspend API Service:** In Render / Fly dashboard $\rightarrow$ **Suspend Service**.
3. **Deactivate Medplum Project:** In Medplum Console $\rightarrow$ Project Admin $\rightarrow$ Deactivate project or remove practitioner users.
