# Proton Real AI Runtime Path & Provider Architecture

**Milestone 4 Deliverable**  
**Date:** October 18, 2026  
**System:** Proton — AI-Native Multi-Specialty Clinical Operating System  
**Environment:** Node.js Backend API (`apps/api`) & Vite React Frontend (`apps/web`)

---

## 1. Runtime Path Architecture Diagram

```
User (Physician & Patient Dialogue)
  │
  ▼
Web Workstation UI (apps/web)
  ├── Microphone Capture (AudioLevelMeter / Web Audio API)
  ├── Live Consultation Workspace (DoctorDeskEncounter)
  ├── Today Schedule & Patient Brief (TodaySchedule, PatientBriefModal)
  └── Clinical Perspectives & Orders (ClinicalPerspectivesPanel, StructuredTreatmentPlan)
  │
  ▼ [HTTP REST / SSE Streaming / Multipart Audio]
Proton Backend API (apps/api/app.js)
  │
  ├── Middleware Layer: Security Headers, Rate Limiter, RBAC Identity (resolveActorMiddleware)
  │
  ▼
Canonical Clinical Pipeline (apps/api/services/clinical/clinicalPipeline.js)
  │
  ├── Stage 1 & 2: Input & Schema Validation (MediaService.validateAudioInput)
  │
  ├── Stage 3: Clinical Context Retrieval (ClinicalContextEngine.buildContext)
  │     └── Authoritative FHIR R4 Store (FhirService)
  │     └── Longitudinal Trajectory Matching (LongitudinalService)
  │     └── PubMed / Clinical Knowledge Grounding (EvidenceService)
  │
  ├── Stage 4: ModelGateway & Multi-Agent Intelligence Layer
  │     ├── ModelGateway (services/ai/modelGateway.js)
  │     │     ├── Transcription Provider (GeminiProvider.transcribe / WhisperProvider)
  │     │     ├── Generative Narrative Provider (GeminiProvider.generateNote)
  │     │     ├── Structured Output Provider (GeminiProvider / Google GenAI Schema)
  │     │     └── Embedding Provider (ModelGateway.embed - 384-dim normalized)
  │     │
  │     ├── Jev Typed Decision Adapter (services/ai/jevAdapter.js)
  │     │     ├── Choice: Constrained discrete specialty routing
  │     │     ├── Score: Continuous relevance and evidence scoring
  │     │     └── Noul: Multi-specialty boundary verification
  │     │
  │     ├── Specialist Agent Registry (agents/registry/specialistAgentRegistry.js)
  │     │     ├── cardiology.v1
  │     │     ├── neurology.v1
  │     │     ├── endocrinology.v1
  │     │     └── internal-medicine.v1
  │     │
  │     └── Agent Orchestrator (agents/registry/agentOrchestrator.js)
  │           ├── Concurrent Parallel Execution (Promise.allSettled)
  │           ├── Fault Isolation & Timeout Guard (3,500ms SLA)
  │           └── Cross-Specialty Synthesis (Consensus & Disagreement Preservation)
  │
  ├── Stage 5: Safety Gate Boundary (services/safety/safetyGate.js)
  │     ├── Deterministic Drug-Allergy Matrix (Penicillin, Sulfa, Cephalosporin)
  │     ├── Drug-Drug Interaction Ceilings (Warfarin + NSAIDs, Acetaminophen >4g)
  │     └── Clinician Directive Override Verification (>= 10 chars substantive rationale)
  │
  ├── Stage 6: Structured Output & Provenance Minting (services/clinical/provenanceSystem.js)
  │     └── Mints DRAFT Provenance Envelope with SHA-256 Tamper Hash
  │
  ├── Stage 7: Explicit Physician Review & Cryptographic Sign-Off (POST /api/ai/approve)
  │     ├── 5-Point Consequential Checklist
  │     ├── Attending Physician RBAC Verification (Role = 'physician')
  │     └── Provenance Status Transition: DRAFT -> EDITED -> APPROVED
  │
  └── Stage 8: Atomic FHIR R4 Transaction Bundle Commit (POST /api/fhir/encounter/sync)
        ├── DocumentReference (Canonical SOAP Clinical Note)
        ├── MedicationRequest (Physician-Signed Prescriptions)
        ├── Condition (Provisional -> Confirmed Diagnoses)
        └── Provenance (Cryptographic Chain Seal)
```

---

## 2. Model & Provider Inventory at Runtime

| Capability | Configured Model / Provider | Location in Codebase | Input / Output Contract | Failure & Fallback Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Unstructured Generation** | `gemini-3.5-flash-lite` (fallback: `gemini-3.8-flash`, `gemini-flash-latest`) | `apps/api/providers/gemini.js` | Text / Prompt $\rightarrow$ Clinical SOAP narrative | Exponential backoff (max 2 retries), fails closed with `ModelGatewayError`. |
| **Structured JSON Generation** | `gemini-3.5-flash-lite` via `@google/genai` | `apps/api/providers/gemini.js` & `modelGateway.js` | Prompt + JSON Schema $\rightarrow$ Validated JSON object | Strict schema validation; rejects malformed output with `MALFORMED_OUTPUT`. |
| **Speech-to-Text Transcription** | `GeminiProvider.transcribe` & `WhisperProvider` | `apps/api/providers/gemini.js` & `services/voice/` | Raw audio Buffer (WebM/WAV) $\rightarrow$ Verbatim transcript | Rejects <64B or silence; fails with `TRANSCRIPTION_INPUT_INVALID` or `WHISPER_UNAVAILABLE`. |
| **Vector Embeddings** | `proton-clinical-embed-v1` (384-dim normalized) | `apps/api/services/ai/modelGateway.js` | Clinical query $\rightarrow$ Normalized vector float array | Deterministic semantic projection, zero external network dependency. |
| **Specialty Routing** | `JevAdapter.choice` & `JevAdapter.noul` | `apps/api/services/ai/jevAdapter.js` | Case text $\rightarrow$ `{ choice, confidence, rationale }` | Fails closed to General Internal Medicine review. Never silently guesses. |
| **Specialist Reasoning** | 4 Baseline Specialist Plugins | `apps/api/agents/registry/specialistDefinitions.js` | Patient context $\rightarrow$ Phase F Structured Output | `Promise.allSettled` timeout isolation; failed specialist marked `UNAVAILABLE`. |
| **Cross-Specialty Synthesis** | `AgentOrchestrator.synthesizeCrossSpecialty` | `apps/api/agents/registry/agentOrchestrator.js` | Specialist assessments $\rightarrow$ Consensus + Disagreement | Preserves conflicting viewpoints; never suppresses differences or picks silent winner. |
| **Safety Gate** | `SafetyGate.verifyMedicationGate` | `apps/api/services/safety/safetyGate.js` | Prescriptions + Allergies $\rightarrow$ Clearance Envelope | Deterministic hard stop (`CONTRAINDICATION_HARD_STOP`); blocks approval without override. |
| **Provenance Sealing** | `ProvenanceSystem` | `apps/api/services/clinical/provenanceSystem.js` | Draft payload $\rightarrow$ Signed SHA-256 Envelope | Rejects unauthorized non-physician approval with HTTP 403. |
| **FHIR Persistence** | `FhirService` (Medplum R4 Transaction Bundle) | `apps/api/services/fhir/fhirService.js` | Validated Bundle $\rightarrow$ Atomic commit receipt | Full transaction rollback on single resource failure; zero orphan writes. |

---

## 3. Strict Trust & Non-Autonomy Boundary

1. **AI Output Is Strictly Draft:** All model responses entering the physician workstation are tagged with status `DRAFT`.
2. **Zero Autonomous Mutation:** No AI agent, LLM provider, or background process has authority to write active `MedicationRequest` or `Condition` resources to FHIR without explicit physician cryptographic sign-off.
3. **Deterministic Safety Ordering:** The safety verification gate executes *before* any review modal or persistence transaction can be mounted.
4. **Client Secret Sanitization:** No API keys, service tokens, or private credentials exist in client bundles (`apps/web`). All model calls are mediated strictly through authenticated backend endpoints.
