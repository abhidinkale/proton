# PROTON CAPABILITY MATRIX
**Functional Capability Baseline & Transition Targets**
*Controlled Milestone 0 Deliverable — Verified Against Real Repository State*
*Goal: MAXIMUM REUSE + MINIMUM DUPLICATION*
*Date: 2026-10-18*

---

| Capability | Existing Implementation | Technology | Location | Quality | License | Reusable | New Target (Milestone 1–15) |
|---|---|---|---|:---:|:---:|:---:|---|
| **Ambient Speech Transcription** | `WhisperProvider` + `MediaService` + Gemini Audio | Node.js, Web Audio, vendored Whisper | `apps/api/services/voice/`, `services/media/` | High | MIT / Apache 2.0 | YES | Wrap in unified `ModelGateway.transcribe()` with local `whisper-main` fallback (Milestone 1 & 7). |
| **Real-time Audio Streaming** | Web AudioWorklet + SSE event stream | AudioWorklet, SSE, Node Streams | `apps/web/public/worklets/`, `apps/api/services/streaming/` | High | Proprietary | YES | Connect to ambient scribe streaming pipeline in Doctor Desk and Android (Milestone 7 & 12). |
| **Clinical Note Generation (SOAP)** | `AIProvider.generateNote()` with Zod schema | Node.js, Gemini Flash, MedGemma | `apps/api/services/ai/aiService.js`, `providers/` | High | Proprietary | YES | Route through `ModelGateway.structuredGenerate()` with generative LLMs (Milestone 1 & 8). |
| **Clinical Provenance Tracking** | `auditService`, `ProvenanceBadge.tsx`, SHA-256 | Node.js Crypto, React TSX | `apps/api/services/audit/`, `apps/web/src/components/ui/ProvenanceBadge.tsx` | Excellent | Proprietary | YES | Maintain immutable provenance badges across all specialist drafts (`ProvenanceSystem`, Milestone 1 & 9). |
| **Deterministic Clinical Safety** | `SafetyService` (Allergy, DDI, Dose ceilings) | In-memory rules engine, zero network | `apps/api/services/safety/safetyService.js` | Critical / 100% | Proprietary | YES | Core foundation for `SafetyGate` and `ClinicalApprovalGate` (Milestone 1 & 9). KEEP as-is. |
| **Typed Decision & Classification (Jev)** | `JevSafetyGuardrailService` (95% safety heuristic) | JS heuristic / TypeSafe AI concept | `apps/api/services/clinical/jevSafetyGuardrailService.js` | Medium | Proprietary | REFACTOR | Elevate to official `JevAdapter` supporting choice, score, noul probability decisions (Milestones 1 & 2). |
| **Specialty Routing & Intent Classification** | `triageAgent.js` keyword and acuity scoring | Node.js | `apps/api/agents/triageAgent.js` | Medium | Proprietary | WRAP | Migrate specialty routing to `JevAdapter.decide()` backed by `SpecialistAgentRegistry` (Milestones 2 & 4). |
| **Specialist Clinical Agents** | Monolithic operational agents | Node.js agents | `apps/api/agents/` | Medium | Proprietary | REFACTOR | Decouple into `SpecialistAgentRegistry` starting with Internal Medicine, Cardiology, Neurology (Milestones 4 & 5). |
| **Cross-Specialty Synthesis** | Basic aggregate note drafting | Node.js / React | `apps/web/src/components/DoctorDeskEncounter.tsx` | Basic | Proprietary | REPLACE | Dedicated `CrossSpecialtySynthesizer` highlighting points of agreement and disagreement (Milestone 6). |
| **Clinical Context Retrieval** | `longitudinalService.js`, `fhirService.js` | Node.js FHIR resource traversal | `apps/api/services/clinical/longitudinalService.js` | High | Proprietary | WRAP | Abstract into `ClinicalContextEngine` with specialty-specific relevance filtering (Milestone 3). |
| **Evidence & Guideline Grounding** | `EvidenceService` (ADA, ACC/AHA, SPRINT, EMPA-REG) | In-memory verified clinical index | `apps/api/services/evidence/evidenceService.js` | High | Proprietary | YES | Integrate with `pgvector` for scalable guideline and literature retrieval (Milestones 3 & 75). |
| **Vector Similarity Search (RAG)** | Uncompiled vendored `pgvector-master/` | C, PostgreSQL extension | `pgvector-master/`, `apps/api/storage/postgresAdapter.js` | Untapped | PostgreSQL / BSD | YES | Activate pgvector index for longitudinal patient records and specialist guidelines (Milestone 3). |
| **Document Ingestion & OCR** | `DocumentService` (PDF/Image inspection & Gemini) | Multer, Crypto, Multimodal LLM | `apps/api/services/document/documentService.js` | High | Proprietary | YES | Integrate `tesseract-main` for zero-cloud OCR fallback when offline (Milestones 7 & 13). |
| **Clinical Vision & Acute Triage** | `VisionService`, `AcuteTriageService`, Review Gating | Express, `@google/genai`, React | `apps/api/services/vision/`, `apps/web/src/components/vision/` | High | Proprietary | YES | Preserve intact for radiology and dermatologic specialist agent tool invocations (Milestones 5 & 8). |
| **Atomic FHIR R4 Store** | `FhirService` + Medplum v5.2.1 | Express, Medplum Batch Transactions | `apps/api/services/fhir/fhirService.js`, `medplum-main/` | Excellent | Apache 2.0 | YES | Permanent clinical data store for Patient, Encounter, Condition, MedicationRequest, Observation (Milestone 10). |
| **Physician Approval Gate** | `ClinicalVerificationPanel`, `clinicianConfirmationService` | React TSX, Express | `apps/web/src/components/ClinicalVerificationPanel.tsx`, `apps/api/services/clinical/` | High | Proprietary | YES | Strict barrier: No AI draft commits to FHIR or leaves clinic without explicit physician approval (Milestone 9). |
| **Patient Handoff & Discharge** | `DischargeSummaryService`, `AfterVisitSummaryModal` | Node.js, React TSX | `apps/api/services/clinical/dischargeSummaryService.js`, `apps/web/src/components/discharge/` | High | Proprietary | YES | Generate patient handoff strictly from approved items, filtering out rejected drafts (Milestone 11). |
| **Native Android Experience** | `health.dork.app` (Compose, Navigation, MVVM) | Kotlin 2.1.0, Jetpack Compose | `apps/dork-android/` | Excellent | Proprietary | YES | Add Physician Mode (Today, Patient Brief, Consultation, Review, Approval) while preserving patient features (Milestone 12). |
| **Offline-First Resilience** | Dork local seed container, Web draft recovery | Room / Memory cache, SessionStorage | `apps/dork-android/`, `apps/web/src/services/` | Medium | Proprietary | REFACTOR | Build unified offline SQLite / Room sync queue with conflict resolution (Milestone 13). |
| **Model Gateway & Local Inference** | `providers/factory.js` (Gemini, MedGemma, Grok, Demo) | Express, Fetch, MLX-VLM | `apps/api/providers/` | Good | Proprietary | REFACTOR | Build formal `ModelGateway` interface supporting Cloud, Local, Hospital, and On-Device models (Milestones 1 & 14). |
| **Practice Operations OS** | `AgentEngineV2` (Refills, Referrals, Scheduling, Billing) | Node.js, SQLite / Postgres | `apps/api/agents/agentEngineV2.js`, `apps/web/src/pages/Operations.tsx` | Excellent | Proprietary | YES | Retain as operational automation layer operating under physician supervisory tasks (Milestone 8 & Operations). |
| **Tamper-Evident Audit Trail** | `AuditService` (Cryptographic SHA-256 chaining) | Node.js Crypto | `apps/api/services/audit/auditService.js` | Critical / 100% | Proprietary | YES | Continue logging every pipeline run, override, and agent execution with cryptographic chaining (Milestone 1 & All). |

---

## 4. Key Architectural Insights for Milestone Plan

1. **Safety and Persistence are Already Exceptional:**
   The deterministic safety checks in `safetyService.js` and the atomic FHIR transactions in `fhirService.js` are robust and have passed hundreds of adversarial and simulation tests. We will preserve these completely.

2. **Jev Must Be Elevated From A Helper to A First-Class Architecture Layer:**
   Currently `jevSafetyGuardrailService.js` performs heuristic safety scoring. Moving to Milestone 1 & 2, Jev becomes the typed decision router (Choice, Score, Noul) deciding which specialist agents run, assessing urgency, and enforcing safety gates before generative models are ever called.

3. **Specialist Registry Enables Infinite Scalability:**
   Instead of hardcoded agent files, creating `SpecialistAgentRegistry` enables dynamic registration of 10, 50, or 100+ medical specialties with typed schemas, scoped tools, and specific evaluation benchmarks without modifying core orchestration code.

4. **Zero Throwaway Strategy:**
   Every single existing capability—from the Web Doctor Desk, to the Android Dork app, to the Medplum FHIR backend, to the offline Demo provider—is preserved, wrapped, and strengthened under the unified Proton Master Build Specification.
