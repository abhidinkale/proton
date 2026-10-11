# PROTON SYSTEM MAP — GROUND TRUTH ARCHITECTURE

This document is the canonical ground truth codebase map for the **Proton Physician Web Beta**. Every file, component, route, and FHIR resource listed here exists in the current repository and has been verified against live integration tests.

---

## 1. Directory Structure

```
proton/
├── apps/
│   ├── api/                     # Backend API & AI Provider Gateway (Express)
│   │   ├── providers/           # AI Provider Abstraction Layer
│   │   │   ├── base.js          # Base AI Provider Interface
│   │   │   ├── factory.js       # Provider Factory (Gemini, DeepSeek, Demo)
│   │   │   ├── gemini.js        # Active Provider: Google Gemini (gemini-3.8-flash)
│   │   │   └── deepseek.js      # DeepSeek Provider (deepseek-chat)
│   │   ├── tests/               # Backend & AI clinical test suites
│   │   │   ├── clinical_ai_validation.cjs
│   │   │   ├── gemini_live_smoke.cjs
│   │   │   └── verify_gemini_smoke.cjs
│   │   ├── package.json
│   │   └── server.js            # Express API Server (Port 3002)
│   └── web/                     # Physician Frontend Web App (React 19 + Vite)
│       ├── src/
│       │   ├── components/      # UI & Clinical Workspace Components
│       │   │   ├── ui/          # Primitives & Command Palette (⌘K)
│       │   │   ├── EvidenceModal.tsx
│       │   │   ├── Layout.tsx
│       │   │   ├── PrescriptionBuilder.tsx
│       │   │   ├── ProvenanceBadge.tsx
│       │   │   ├── SafetyAlertBanner.tsx
│       │   │   └── TimelineEvidenceDrawer.tsx
│       │   ├── lib/             # Core Client Setup
│       │   │   └── medplum.ts   # Medplum FHIR Client Singleton
│       │   ├── pages/           # Screen Implementations
│       │   │   ├── Consultation.tsx
│       │   │   ├── Dashboard.tsx
│       │   │   ├── DocumentReview.tsx
│       │   │   ├── Login.tsx
│       │   │   ├── PatientProfile.tsx
│       │   │   ├── Patients.tsx
│       │   │   └── Settings.tsx
│       │   ├── services/        # Deterministic Safety & Clinical Services
│       │   │   ├── audit.ts
│       │   │   ├── auth.ts
│       │   │   ├── clinicalIntelligence.ts
│       │   │   ├── demoPatient.ts
│       │   │   ├── prescriptionSafety.ts
│       │   │   ├── safetyChecker.ts
│       │   │   ├── telemetry.ts
│       │   │   └── verification.ts
│       │   ├── types/           # Domain & FHIR TypeScript Interfaces
│       │   │   └── provenance.ts
│       │   ├── App.tsx          # Client-Side Router & Protected Route Boundary
│       │   ├── config.ts        # App Configuration & Endpoints
│       │   └── main.tsx         # Root Bootstrap & MedplumProvider
│       ├── tests/               # Puppeteer E2E & Verification Suites
│       │   ├── web_beta_verification.cjs
│       │   ├── physician_validation_checklist.cjs
│       │   ├── command_center_v2_e2e.cjs
│       │   ├── clinical_brain_e2e.cjs
│       │   ├── safety_e2e.cjs
│       │   ├── prescription_e2e.cjs
│       │   ├── ai_provider_e2e.cjs
│       │   └── physician_polish_e2e.cjs
│       └── package.json
├── docs/                        # Architecture & Operational Documentation
│   ├── DEPLOYMENT.md
│   ├── PROTON_SYSTEM_MAP.md
│   ├── PROTON_WEB_BETA.md
│   └── PROTON_WEB_BETA_STATUS.md
└── package.json                 # Monorepo Root Workspace
```

---

## 2. Frontend Core Map (`apps/web`)

| Component / File | Absolute Path | Role & Key Responsibilities |
| :--- | :--- | :--- |
| **App Routing** | `apps/web/src/App.tsx` | Protected route boundary with `useMedplumProfile` + `medplum.isLoading()` check; redirects unauthenticated visitors to `/login`. |
| **Layout** | `apps/web/src/components/Layout.tsx` | Canonical 6-item sidebar navigation, persistent `SYNTHETIC BETA` safety banner, ⌘K Command Palette trigger, logout boundary. |
| **Public Landing & Login** | `apps/web/src/pages/Login.tsx` | Physician Beta entry screen, value props, 6-stage "How Proton Works" walkthrough modal, 1-click synthetic evaluator access. |
| **Command Center** | `apps/web/src/pages/Dashboard.tsx` | Physician's morning workspace: Needs Attention (urgent safety alerts), Continue Where You Left Off, 60s Onboarding Callout, deterministic metrics. |
| **Patient Directory** | `apps/web/src/pages/Patients.tsx` | Patient list, live search, 1-click "Create Clinical Brain Demo Patient" (`Eleanor Vance`) seed button. |
| **Patient Profile** | `apps/web/src/pages/PatientProfile.tsx` | Central clinical workspace: "What Matters Today", allergy alerts, active problems, confirmed medications, Longitudinal Timeline, Evidence Drawer. |
| **Consultation Workspace** | `apps/web/src/pages/Consultation.tsx` | Core consultation loop: Audio capture, real-time draft, SOAP note editing, deterministic verification reports, warning acknowledgment gate, atomic FHIR batch save. |
| **Review Center** | `apps/web/src/pages/DocumentReview.tsx` | Unified physician review inbox ("Nothing gets confirmed without you"): Ingest clinical documents, review extracted facts, edit/approve/reject, atomic FHIR commit. |
| **Settings** | `apps/web/src/pages/Settings.tsx` | AI Provider selection, model inspection, Medplum server connection status, safety threshold parameters. |
| **Command Palette** | `apps/web/src/components/ui/CommandPalette.tsx` | Global ⌘K / `/` search modal: Fast patient search (no PHI in URLs), navigation actions, recent consultations. |
| **Evidence Modal** | `apps/web/src/components/EvidenceModal.tsx` | Source-grounded clinical drawer showing source resource, excerpt quote, date, and provenance level. |
| **Prescription Builder** | `apps/web/src/components/PrescriptionBuilder.tsx` | Physician-controlled medication order composer with instant safety check against allergies and active orders. |
| **Safety Alert Banner** | `apps/web/src/components/SafetyAlertBanner.tsx` | Visual blocker/warning alerts for allergy conflicts, duplicate medications, and incomplete orders. |
| **Telemetry Service** | `apps/web/src/services/telemetry.ts` | Privacy-preserving telemetry service with an enforced denylist stripping all patient names, dates, transcripts, and notes. |
| **Auth Boundary** | `apps/web/src/services/auth.ts` | Clean interface bridging `ProtonDoctorUser` to Medplum Practitioner identity; Supabase Auth ready. |

---

## 3. Backend & AI Architecture (`apps/api`)

| Module / File | Absolute Path | Role & Key Responsibilities |
| :--- | :--- | :--- |
| **Express Server** | `apps/api/server.js` | API server listening on port 3002; rate limiting, CORS configuration, request validation, file upload handling (multer). |
| **Provider Factory** | `apps/api/providers/factory.js` | Dynamic provider factory selecting AI backend via `AI_PROVIDER` (`gemini`, `deepseek`, `demo`). |
| **Base Provider** | `apps/api/providers/base.js` | Base contract defining `transcribe()`, `generateNote()`, `extractDocument()`, `healthCheck()`. |
| **Gemini Provider** | `apps/api/providers/gemini.js` | **Default Active Provider**: Integrates `@google/genai` with `gemini-3.8-flash`. Structured JSON clinical note synthesis, document extraction, and simulated/real audio transcription. |
| **DeepSeek Provider** | `apps/api/providers/deepseek.js` | OpenAI-compatible DeepSeek integration using `deepseek-chat` for structured clinical text generation. |

---

## 4. Deterministic Clinical Safety Layer

The clinical safety layer is **100% deterministic code** with zero LLM hallucinations in the decision gate.

| Safety Module | File Path | Deterministic Invariant Enforced |
| :--- | :--- | :--- |
| **Note Verification** | `apps/web/src/services/verification.ts` | Checks that required SOAP sections exist (HPI, Exam, Assessment, Plan); verifies non-empty text; blocks approval if critical sections are missing. |
| **Prescription Safety** | `apps/web/src/services/prescriptionSafety.ts` | Strict allergy cross-checking (e.g. Amoxicillin vs Penicillin); duplicate medication detection; dose/frequency completeness checking. |
| **Clinical Intelligence** | `apps/web/src/services/clinicalIntelligence.ts` | Temporal change detection (NEW, CHANGED, RESOLVED, PERSISTENT); medication discrepancy detection against active FHIR orders. |
| **General Safety Checker**| `apps/web/src/services/safetyChecker.ts` | High-risk dosage boundaries, drug interaction verification, contraindicated conditions. |
| **Physician Gate** | `apps/web/src/pages/Consultation.tsx` | The "Approve & Save to FHIR" button is hard-disabled until: (1) All blockers are resolved, (2) All warnings are explicitly acknowledged, (3) Physician checks the confirmation box. |

---

## 5. Review & Provenance System

Proton enforces transparent provenance across every clinical item to guarantee that AI inference is never confused with physician-verified facts.

### Provenance State Hierarchy (`apps/web/src/types/provenance.ts`)
```
AI_DRAFT / AI_EXTRACTED / AI_INFERRED
           ↓ (Physician edits)
PHYSICIAN_EDITED
           ↓ (Physician signs off)
PHYSICIAN_APPROVED
           ↓ (Committed to FHIR)
CONFIRMED_FACT
```

- **Badges**: Implemented in `apps/web/src/components/ProvenanceBadge.tsx`. Visual tags render with distinct colors and tooltips showing provenance history.
- **Audit Logging**: Implemented in `apps/web/src/services/audit.ts`. Persists tamper-evident logs for every AI generation, note edit, warning acknowledgment, approval, and rejection.

---

## 6. Complete Route Map

### Frontend Web Routes (`apps/web/src/App.tsx`)

| Route Path | Access | Page Component | Description |
| :--- | :--- | :--- | :--- |
| `/login` | Public | `<Login />` | Physician Beta landing page & authentication portal. |
| `/` | Protected | `<Dashboard />` | Doctor Command Center & morning workspace. |
| `/patients` | Protected | `<Patients />` | Patient directory, live search, and demo patient generator. |
| `/patients/:id` | Protected | `<PatientProfile />` | Central patient workspace, "What Matters Today", Timeline, Evidence. |
| `/consultation` | Protected | `<Consultation />` | Active consultation workspace (audio capture, note draft, safety verification). |
| `/consultations/*` | Protected | `<Consultation />` | Consultation route aliases for deep-linking. |
| `/review` | Protected | `<DocumentReview />` | Unified Review Center ("Nothing gets confirmed without you"). |
| `/document-review` | Protected | `<DocumentReview />` | Document ingestion alias. |
| `/documents/review` | Protected | `<DocumentReview />` | Nested review alias. |
| `/settings` | Protected | `<Settings />` | AI Provider configuration, model diagnostics, Medplum server health. |

### API Routes (`apps/api/server.js`)

| HTTP Method | Endpoint | Auth / Input | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | None | API uptime, environment mode, and operational status. |
| `GET` | `/health/ai` | None | Safe AI provider metadata (`provider`, `model`, `configured`). Never leaks keys. |
| `POST` | `/api/transcribe` | Multipart Audio | Audio transcription via configured AI provider. Rejects empty audio. |
| `POST` | `/api/generate-note` | JSON `{ transcript, template }` | Structured SOAP note generation. Rejects empty transcript (HTTP 400). |
| `POST` | `/api/extract-documents`| Multipart Files | Document extraction into structured clinical facts. Rejects missing files (HTTP 400). |

---

## 7. FHIR Resource Map (Medplum Persistence)

Proton models all clinical data as standards-compliant HL7 FHIR R4 resources:

| FHIR Resource Type | Role in Proton | Persistence Trigger |
| :--- | :--- | :--- |
| **`Patient`** | Demographics, birth date, gender, identifiers. | Created during onboarding or via demo patient generator. |
| **`Encounter`** | Ambulatory consultation encounter with start/end periods. | Generated atomically upon consultation approval. |
| **`ClinicalImpression`**| Structured SOAP clinical note with full consultation transcript. | Bundled atomically in FHIR batch transaction upon consultation sign-off. |
| **`MedicationRequest`** | Approved prescription orders with strength, dose, route, duration. | Created atomically with provenance tag upon physician prescription approval. |
| **`MedicationStatement`**| Patient-reported medications extracted from historical documents. | Created via Review Center batch transaction after physician confirmation. |
| **`Condition`** | Active clinical diagnoses, problems, and longitudinal memories. | Committed only after explicit physician approval of memory proposals. |
| **`Observation`** | Vital signs, laboratory results, and clinical findings. | Persisted via Review Center after doctor approves document extractions. |
| **`AllergyIntolerance`**| Known patient allergies and adverse reactions (e.g. Penicillin). | Read during safety checks; alerts rendered across profile and consultation. |
| **`DocumentReference`** | Uploaded clinical documents, PDFs, and laboratory reports. | Created in Review Center linking extracted facts to source document. |
| **`AuditEvent`** | Tamper-evident record of physician approvals, edits, and overrides. | Recorded via `auditService` for regulatory compliance. |

---

## 8. AI Provider Architecture & Model Map

| Provider Key | Active Status | Model | Latency | Fallback Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **`gemini`** (Default) | **ACTIVE & VERIFIED** | `gemini-3.8-flash` | ~2.5s (Note), ~12s (Docs) | Configured in `apps/api/.env`. Fails transparently with HTTP 500/user-friendly error; never silently creates fake notes. |
| **`deepseek`** | Supported | `deepseek-chat` | ~4.0s (Note) | Configured via `DEEPSEEK_API_KEY`. Used for deep reasoning or alternative provider selection. |
| **`demo`** | Supported | Deterministic Offline | ~50ms | Synthetic provider for zero-API offline development and deterministic unit testing. |
