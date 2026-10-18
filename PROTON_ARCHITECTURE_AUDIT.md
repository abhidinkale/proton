# PROTON ARCHITECTURE AUDIT
**AI-Native Multi-Specialty Clinical Operating System**
*Controlled Milestone 0 Audit Report — Verified Against Real Repository State*
*Date: 2026-10-18*

---

## 1. Executive Summary

Proton is an AI-native clinical operating system engineered to reduce physician cognitive and administrative workload while keeping the licensed clinician as the final, uncompromised clinical authority. 

This audit provides a comprehensive, ground-truth inventory and structural analysis of the existing Proton repository. It establishes the baseline before building subsequent milestone components, adhering strictly to the principle: **REUSE WHAT IS GOOD, REPLACE ONLY WHAT IS DEMONSTRABLY INADEQUATE, AND NEVER BREAK EXISTING VALIDATED CLINICAL SAFETY INVARIANTS.**

---

## 2. Actual Repository Structure

```
/Users/abhidinkale/Downloads/proton
├── apps/
│   ├── api/                     # Node.js 20+ Express API backend & clinical services
│   │   ├── adapters/            # FHIR, EHR/PMS, Email, SMS, Voice, Calendar adapters
│   │   ├── agents/              # Operational & clinical intelligence agents (Refill, Scheduling, Triage, etc.)
│   │   ├── api/                 # Serverless Vercel function entry points
│   │   ├── data/                # SQLite local development databases & tenant uploads
│   │   ├── middleware/          # RBAC, cryptographic audit telemetry, auth service
│   │   ├── providers/           # AI provider gateway (Gemini, Grok, DeepSeek, MedGemma, Demo)
│   │   ├── services/            # Clinical pipeline, safety, intake, vision, speech, billing, fhir, jobs
│   │   ├── storage/             # Postgres RLS adapter, audit/task/job repositories, idempotency
│   │   ├── tests/               # 36 clinical, architectural, adversarial, and benchmarking test suites
│   │   ├── workers/             # Durable background job reconciliation workers
│   │   ├── app.js               # Express 5 application setup, security headers, rate limits, routes
│   │   ├── config.js            # Unified configuration manager & environment validation
│   │   ├── index.js             # HTTP/HTTPS server bootstrap
│   │   └── package.json         # Backend dependencies manifest
│   ├── dork-android/            # Native Android clinical application (Kotlin + Jetpack Compose)
│   │   ├── app/                 # Main application module
│   │   │   ├── src/main/java/health/dork/app/
│   │   │   │   ├── core/        # Design system, FHIR client, SecurityManager, data models, repositories
│   │   │   │   ├── ui/          # Compose screens (Home, Records, Medications, Care, Chat, AI, Profile)
│   │   │   │   └── MainActivity.kt
│   │   │   └── build.gradle.kts # Android app build configuration (CompileSdk 36, MinSdk 26)
│   │   ├── build.gradle.kts     # Root Gradle build script
│   │   └── gradle/              # Gradle wrapper & version catalogs (libs.versions.toml)
│   └── web/                     # Physician Web Clinical Workspace (React 19 + Vite + Tailwind CSS)
│       ├── public/              # Static assets and AudioWorklet processors
│       ├── src/
│       │   ├── components/      # Doctor desk, ambient consultation, clinical verification, billing, fhir
│       │   ├── pages/           # Dashboard, Consultation, DocumentReview, Operations, SmartLaunch
│       │   ├── services/        # AI client, clinical brain, speech, FHIR SDK, telemetry, audit
│       │   ├── types/           # TypeScript domain definitions (prescriptions, vision, intake, etc.)
│       │   ├── App.tsx          # React application routes & shell
│       │   └── main.tsx         # Root DOM bootstrap
│       └── package.json         # Frontend dependencies manifest
├── docs/                        # Clinical validation reports, security audits, benchmark metrics
├── medplum-main/                # Upstream Medplum FHIR R4 server monorepo (v5.2.1, Apache-2.0)
├── pgvector-master/             # PostgreSQL pgvector extension source (BSD-style)
├── tesseract-main/              # Tesseract OCR engine source (v5.5.0, Apache-2.0)
├── whisper-main/                # OpenAI Whisper speech recognition source (MIT)
├── tools/
│   └── proton-bridge/           # MCP bridge service for local testing and orchestration
├── tests/                       # Live AI validation scripts and test scenarios
├── .env.example                 # Example environment variable template
├── proton.env                   # Development environment configuration
└── README.md                    # Project README & controlled validation setup
```

---

## 3. Subsystem Breakdown

### 3.1 Backend & Clinical Services (`apps/api`)
* **Technology:** Node.js 20+, Express 5.2.1, Zod 4.6.5, pg 8.23.1, `@google/genai` 2.27.0.
* **Architecture:** Modular service-oriented design with strict separation of concerns:
  1. `services/clinical/clinicalPipeline.js`: Canonical 8-stage clinical execution pipeline (`INPUT` $\rightarrow$ `VALIDATION` $\rightarrow$ `CLINICAL_CONTEXT` $\rightarrow$ `AI_ANALYSIS` $\rightarrow$ `SAFETY_CHECK` $\rightarrow$ `CLINICAL_OUTPUT` $\rightarrow$ `FHIR_TRANSACTION` $\rightarrow$ `AUDIT_PROVENANCE`).
  2. `services/safety/safetyService.js`: Deterministic safety engine enforcing allergy contraindications (e.g., Penicillin cross-reactivity with Amoxicillin), drug-drug interactions (e.g., Warfarin + NSAIDs), dosage ceilings (Acetaminophen 4,000 mg/day max), and completeness gates.
  3. `services/clinical/jevSafetyGuardrailService.js`: High-speed probabilistic safety verification layer evaluating drafted recommendations against pre-verified Open Targets candidate pools and patient charts with a strict 95% safety threshold.
  4. `services/clinical/longitudinalService.js`: Deterministic extraction of temporal changes across FHIR observations, medications, and conditions (e.g., tracking HbA1c elevation over time).
  5. `services/clinical/nurseRoomingService.js`: Clinical intake and vitals capture orchestration.
  6. `services/clinical/dischargeSummaryService.js`: Structured discharge summaries with patient instructions grounded in approved clinical records.
  7. `services/evidence/evidenceService.js`: Deterministic clinical guideline index (ADA, ACC/AHA, GINA, KDIGO) and landmark clinical trial citations (EMPA-REG, SPRINT) with zero hallucinated references.
  8. `services/fhir/fhirService.js`: Atomic FHIR R4 transaction bundle assembly, patient isolation, and Medplum REST/SDK execution.
  9. `services/document/documentService.js`: Clinical document ingestion, MIME and magic-byte inspection, cryptographic SHA-256 hashing, and LLM-based structured fact extraction.
  10. `services/vision/`: Clinical image inspection, acute imaging triage worklist, and clinician review gating.
  11. `services/voice/`: Ambient transcription service, AudioWorklet ingestion, and patient voice outreach.
  12. `services/storage/postgresAdapter.js`: PostgreSQL adapter with tenant Row-Level Security (RLS) simulation for standalone development and live Postgres deployment.
  13. `services/jobs/jobQueueService.js` & `workers/reconciliationWorker.js`: Durable background job persistence and reconciliation for failed external FHIR transactions.

### 3.2 AI Provider Gateway (`apps/api/providers`)
* **Factory Pattern:** `providers/factory.js` dynamically initializes providers based on `PROTON_AI_PROVIDER` and `PROTON_AI_MODE`.
* **Implemented Providers:**
  1. `gemini.js`: Google Gemini 3.8 Flash integration via official `@google/genai` SDK with strict JSON schema enforcement.
  2. `medgemma.js`: Local Apple Silicon MLX-VLM / vLLM runtime for private, on-premise clinical inference.
  3. `deepseek.js`: OpenAI-compatible DeepSeek API client.
  4. `grok.js`: xAI Grok-2-vision client.
  5. `demo.js`: Deterministic offline clinical mock provider for zero-credential development, testing, and continuous integration.

### 3.3 Operations OS & Agent System (`apps/api/agents`)
* **Agents:** Refill Agent V2, Scheduling Agent V2, Referral Agent V2, Triage Agent, Patient Communication Agent, Document Fax Agent, and Medication Suggestion Agent (Open Targets + Jev).
* **Guiding Invariant:** **Zero autonomous clinical actions.** All agent proposals generate pending operational tasks in `storage/taskRepository.js` and require explicit human (physician or operations staff) sign-off before committing to FHIR.

### 3.4 Native Android Application (`apps/dork-android`)
* **Technology:** Kotlin 2.1.0, Jetpack Compose (BOM 2025.02.00), Coroutines & StateFlow, Navigation 3.x, Kotlinx Serialization.
* **Target SDK:** 36 (Android 16), Min SDK: 26 (Android 8.0).
* **Architecture:** Unidirectional Data Flow (UDF) with MVVM, Repository pattern, and strict offline-first capability (`AppContainer`, `FhirApiClient`, `DorkSeedData`).
* **Design Language:** Custom calm, clinical-grade design system tokens (`Color.kt`, `Type.kt`, `Shape.kt`, `Spacing.kt`).
* **Key Workflows:** Home dashboard, longitudinal timeline, appointments booking, prescription adherence, encrypted practitioner messaging, AI health assistant with record citations, and emergency Medical ID.

### 3.5 Physician Web Application (`apps/web`)
* **Technology:** React 19.2.8, Vite 8.3.0, TypeScript 6.0.2, Tailwind CSS 4.3.3, Mantine Core 8.3.18, `@medplum/react` 5.2.1.
* **Workspaces:**
  1. `DoctorDeskHome.tsx`: Minimalist slab, Nolla-inspired floating interaction bar, appointment schedule, clinical alerts.
  2. `DoctorDeskEncounter.tsx`: High-velocity ambient consultation workspace with real-time transcription, SOAP note drafting, provenance badges (`AI DRAFT` $\rightarrow$ `DOCTOR EDITED`), deterministic clinical verification panel, prescription composer, and atomic FHIR sign-off.
  3. `Operations.tsx`: Practice queues, triage inbox, refill approvals, referral pipeline, and practice ROI dashboard.
  4. `DocumentReview.tsx`: Multi-page clinical document viewer with fact-level approve/reject controls.
  5. `SmartLaunch.tsx`: SMART on FHIR OAuth2 launch context handler.

---

## 4. Strengths & High-Value Reusable Assets

1. **Deterministic Safety Engine:** Complete, tested hard-stops for drug-allergy contraindications and dose ceilings.
2. **FHIR R4 Atomic Batch Transactions:** Medplum batch execution with zero orphan resources on failure.
3. **Rigorous Test Suite:** Over 36 test files, including a 250-case adversarial security suite, 105-scenario agent simulation, and clinical contradiction suites with 100% pass rates.
4. **Android Native Foundations:** Clean Jetpack Compose implementation with zero web wrappers.
5. **Multi-Tenant Isolation:** Cryptographically verifiable SHA-256 audit chaining and tenant-bound query enforcement.

---

## 5. Architectural Gaps & Targets for Jev Multi-Specialty Architecture

1. **Jev Integration Scope:** Jev is currently implemented as an in-process safety heuristic in `jevSafetyGuardrailService.js`. It must be elevated into a typed decision engine for specialty routing, urgency classification, multi-specialty detection, and evidence ranking.
2. **Specialist Agent Registry:** Specialist logic is currently distributed across monolithic agent files (`agents/`). There is no dynamic registry capable of scaling to 100+ specialties and subspecialties with isolated scopes, tools, and schemas.
3. **Model Gateway Abstraction:** `providers/factory.js` binds directly to transcription and note generation. A unified `ModelGateway` is required to abstract decisions (Jev), generative writing (LLM), embeddings, and speech/vision.
4. **Clinical Context Engine:** Context gathering is currently embedded inside `clinicalPipeline.js` and `fhirService.js`. A dedicated `ClinicalContextEngine` is needed to perform specialty-tailored relevance filtering without chart bloat.
5. **Cross-Specialty Synthesis:** Currently, no multi-agent consensus or conflict-resolution mechanism exists when conditions span multiple disciplines (e.g., Cardiology + Endocrinology).

---

## 6. Audit Conclusion & Next Steps

The repository contains an exceptionally solid, production-grade foundation. **No destructive rewrite is warranted.** Development must proceed incrementally:
* Maintain all existing passing tests and clinical invariants.
* Abstract the model layer via `ModelGateway`.
* Formalize the official `JevAdapter` for typed decisions.
* Introduce the extensible `SpecialistAgentRegistry` and `ClinicalContextEngine`.
