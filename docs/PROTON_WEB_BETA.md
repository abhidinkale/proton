# PROTON PHYSICIAN WEB BETA — PRODUCT & OPERATIONS GUIDE

> **"Turn every consultation into structured clinical intelligence."**

Proton is an AI-native clinical copilot designed specifically for physicians. It augments the doctor with intelligent documentation, longitudinal patient memory, and actionable clinical insight while strictly preserving physician authority over every note, medication order, and clinical memory commit.

---

## 1. Product Vision & Positioning

### What Proton Is
- **An AI-Native Clinical Copilot**: Listens to or receives consultation dialogue, synthesizes structured SOAP notes, cross-references active patient history, and maintains longitudinal clinical intelligence.
- **Physician-Controlled**: The treating doctor remains the final clinical authority. Nothing is confirmed, billed, or committed to medical memory without explicit physician sign-off.
- **Source-Grounded**: Every extracted fact and longitudinal memory links back to verifiable evidence in the patient's record.

### What Proton Is NOT
- Not an autonomous doctor or automated diagnostic engine.
- Not an autonomous prescribing system.
- Not a generic chatbot or consumer wellness app.
- Not a hospital appointment scheduling or billing ERP.

---

## 2. Core 6-Stage Clinical Loop

Proton's clinical workspace visibly guides the physician through a structured, transparent 6-stage lifecycle:

```
┌─────────────┐
│ 1. CAPTURE  │  Ambient dialogue recording, audio upload, or sample consultation.
└──────┬──────┘
       ▼
┌─────────────┐
│  2. DRAFT   │  Real-time structured SOAP note synthesis (HPI, Exam, Assessment, Plan).
└──────┬──────┘
       ▼
┌─────────────┐
│  3. VERIFY  │  Deterministic safety checking (allergies, missing fields, duplicates).
└──────┬──────┘
       ▼
┌─────────────┐
│  4. REVIEW  │  Doctor inspects, edits note, and acknowledges safety warnings.
└──────┬──────┘
       ▼
┌─────────────┐
│ 5. APPROVE  │  Doctor checks review confirmation box and clicks "Approve & Save".
└──────┬──────┘
       ▼
┌─────────────┐
│ 6. REMEMBER │  Atomic commit to FHIR: Encounter, ClinicalImpression, Rx, & Memories.
└─────────────┘
```

---

## 3. Architecture Overview

Proton uses a modern, modular web architecture separating client presentation, secure backend AI gateway, and standards-compliant FHIR persistence:

```
┌────────────────────────────────────────────────────────┐
│                   Doctor's Web Browser                 │
│         (React 19 + TypeScript + Vite + Tailwind CSS)   │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│     Proton API Server     │   │     Medplum FHIR Server   │
│   (Node.js / Express)     │   │      (HL7 FHIR R4 API)    │
│       Port 3002           │   │         Port 8103         │
└─────────────┬─────────────┘   └─────────────┬─────────────┘
              │                               │
              ▼                               │
┌───────────────────────────┐                 │
│   Configured AI Provider  │                 │
│  Google Gemini 3.8 Flash  │                 │
│ (Multimodal Notes & Docs) │                 │
└───────────────────────────┘                 │
                                              │
              ▲                               │
              └───────────────┬───────────────┘
                              │
               Atomic FHIR Batch Persistence
```

- **Frontend (`apps/web`)**: Runs at `http://localhost:3001`. Client-side React SPA with protected routes, Command Center, Patient Profile, Consultation Workspace, and Review Center.
- **Backend API (`apps/api`)**: Runs at `http://localhost:3002`. Secure gateway isolating AI API keys from the browser; provides structured note generation, document fact extraction, and health diagnostics.
- **FHIR Persistence (`Medplum`)**: Runs at `http://localhost:8103` (or Medplum Cloud). Stores all clinical entities as HL7 FHIR R4 resources (`Patient`, `Encounter`, `ClinicalImpression`, `MedicationRequest`, `Condition`, `Observation`, `DocumentReference`).
- **Active AI Provider**: **Google Gemini (`gemini-3.8-flash`)** via official `@google/genai` SDK.

---

## 4. How to Run Locally

### Prerequisites
- Node.js 18+ (tested with Node 20 / 22 / 24)
- npm 9+
- Docker (for local Medplum server) or a Medplum Cloud account
- Google Gemini API Key (`GEMINI_API_KEY`)

### Quick Start (3 Terminal Windows)

#### 1. Medplum FHIR Server (Terminal 1)
```bash
# If running local Docker Medplum:
docker run -p 8103:8103 ghcr.io/medplum/medplum-server:latest

# Or ensure your existing Medplum instance is listening on port 8103
curl http://localhost:8103/healthcheck
```

#### 2. Proton API Server (Terminal 2)
```bash
cd apps/api
npm install

# Verify your apps/api/.env contains:
# AI_PROVIDER=gemini
# GEMINI_API_KEY=your_actual_gemini_api_key
# PORT=3002

npm run dev
# Server listening on http://localhost:3002
```

#### 3. Proton Web Application (Terminal 3)
```bash
cd apps/web
npm install

npm run dev
# Local app available at http://localhost:3001
```

---

## 5. AI Provider Configuration

Proton maintains a clean provider abstraction (`apps/api/providers/factory.js`) allowing zero-downtime provider switching without touching frontend UI code.

### Default Active Provider: Google Gemini
In `apps/api/.env`:
```ini
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...your_gemini_key...
GEMINI_MODEL=gemini-3.8-flash
```

Verify provider status at any time:
```bash
curl http://localhost:3002/health/ai
# {"status":"ok","provider":"gemini","model":"gemini-3.8-flash","configured":true}
```

### Switching to Alternative Providers

#### DeepSeek Provider
```ini
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...your_deepseek_key...
DEEPSEEK_MODEL=deepseek-chat
```

#### Offline Synthetic Demo Provider (Zero API Keys)
```ini
AI_PROVIDER=demo
```
The `demo` provider generates realistic deterministic SOAP notes in ~50ms without making external network calls.

---

## 6. Synthetic Beta Boundaries & Safe Demo Experience

To protect patient privacy and adhere to responsible clinical software evaluation standards:

### 1. Synthetic Data Only
- The beta environment is strictly restricted to **synthetic, de-identified clinical scenarios**.
- The persistent banner `SYNTHETIC BETA — NO REAL PATIENT DATA` is displayed across all screens.
- **NEVER enter real Protected Health Information (PHI)** into this evaluation instance.

### 2. 60-Second Evaluator Onboarding Walkthrough
1. **Log in**: Open `http://localhost:3001/login` and click **"Fill Doctor Beta Credentials"** (pre-fills `admin@example.com` / `medplum_admin`).
2. **Command Center**: Review Dr. Alex Morgan's morning clinical cockpit at `/`. Click **"Evaluate Synthetic Patient: Eleanor Vance"**.
3. **Patient Profile**: Inspect the "What Matters Today" section, notice the critical Penicillin allergy alert, and explore the Longitudinal Timeline. Click **"View evidence"** to inspect source provenance.
4. **Start Consultation**: Click **"Start Consultation"**.
5. **Simulate Dialogue**: Click **"Use Sample Dialogue"** to simulate an ambulatory patient encounter.
6. **Watch AI Synthesis**: Gemini generates a structured SOAP note with `AI DRAFT` provenance in ~3 seconds.
7. **Doctor Edits**: Edit the note text; notice the provenance instantly updates to `PHYSICIAN EDITED`.
8. **Safety Verification**: Review deterministic verification reports. Acknowledge warnings, confirm prescription review checkbox.
9. **Physician Approval**: Click **"Approve & Save to FHIR"**. The entire clinical bundle is committed atomically to Medplum.
10. **Review Center**: Navigate to **Review Center** (`/review`) to evaluate historical document ingestion under the principle: *"Nothing gets confirmed without you"*.

---

## 7. Verification & Quality Assurance

Proton includes an extensive automated test suite covering unit tests, clinical safety rules, AI integration, and end-to-end browser workflows:

```bash
# Run complete 10-area browser beta verification suite:
NODE_PATH=apps/web/node_modules node apps/web/tests/web_beta_verification.cjs

# Run 11-point physician validation checklist:
NODE_PATH=apps/web/node_modules node apps/web/tests/physician_validation_checklist.cjs

# Run 10 synthetic clinical AI validation scenarios (compliance, hallucinations, coding):
NODE_PATH=apps/api/node_modules node apps/api/tests/clinical_ai_validation.cjs

# Run production build and typecheck:
npm run build --prefix apps/web
```

---

## 8. Summary of Guarantees

1. **No Hallucinated Decisions**: All safety blockers and clinical verification gates are 100% deterministic code.
2. **No Silent Degraded Output**: If an AI provider call fails, transparent error states are presented to the physician; Proton never fakes output in real mode.
3. **Zero Secret Leaks**: All AI API keys are confined to the backend server environment and strictly excluded from browser bundles.
4. **Physician Final Authority**: The doctor always retains full control to edit, override, reject, or approve any clinical output before it becomes medical record.
