# Proton Multimodal AI-Native Clinical Architecture

## 1. Executive Summary & Purpose

Proton is an AI-native healthcare operating system designed for outpatient clinical consultations. It unifies multimodal clinical inputs—including patient-reported dynamic intake, ambient consultation audio dialogue, clinical documents (PDF/lab reports), captured clinical photography, evidence-based clinical guidelines, and longitudinal FHIR history—into an atomic, streaming clinical workflow.

The core design philosophy is founded on an uncompromised clinical safety principle:
**AI models provide assistive decision support only; physicians maintain sole clinical authority.**

```
+----------------------------------------------------------------------------------------------------+
|                                    MULTIMODAL INGESTION LAYER                                      |
|  +--------------------+  +--------------------+  +--------------------+  +-----------------------+  |
|  | Dynamic Intake     |  | Ambient Voice / Tx |  | Document Intel     |  | Clinical Vision       |  |
|  | (FHIR QuestResp)   |  | (Whisper / Gemini) |  | (OCR / PDF Labs)   |  | (FHIR Media / Review) |  |
|  +---------+----------+  +---------+----------+  +---------+----------+  +-----------+-----------+  |
+------------|-----------------------|-----------------------|-------------------------|--------------+
             |                       |                       |                         |
             +-----------------------+-----------+-----------+-------------------------+
                                                 |
                                                 v
                               +-----------------------------------+
                               | MULTIMODAL CONTEXT SERVICE        |
                               | - Patient & Tenant Isolation      |
                               | - Immutable Source Attribution    |
                               | - Longitudinal FHIR Context       |
                               | - Clinical Evidence & Guidelines  |
                               +-----------------+-----------------+
                                                 |
                                                 v
                               +-----------------------------------+
                               | UNIFIED CLINICAL PIPELINE         |
                               | - Real-time SSE Stream Emission   |
                               | - Schema-Validated AI Synthesis   |
                               | - Differentials Forced UNCONFIRMED|
                               +-----------------+-----------------+
                                                 |
                                                 v
                               +-----------------------------------+
                               | DETERMINISTIC SAFETY GATES        |
                               | - Allergy Contraindication Check  |
                               | - Drug-Drug Interaction Check     |
                               | - Red-Flag Emergency Detection    |
                               | (Hard-stop halts before FHIR)     |
                               +-----------------+-----------------+
                                                 |
                                                 v
                               +-----------------------------------+
                               | CLINICIAN REVIEW (DOCTOR DESK)    |
                               | - Explicit ACCEPT / REJECT/ MODIFY|
                               | - Sole Authority to Commit FHIR   |
                               +-----------------+-----------------+
                                                 |
                                                 v
                               +-----------------------------------+
                               | ATOMIC FHIR COMMIT & AUDIT        |
                               | - Active Condition & MedRequest   |
                               | - FHIR Provenance Attestation     |
                               | - Tamper-Evident SHA-256 Chaining |
                               +-----------------------------------+
```

---

## 2. Core Safety Invariants

Proton enforces ten non-negotiable architectural safety invariants:

1. **Zero Autonomous Clinical Persistence**: AI synthesis models are strictly barred from autonomously generating active `Condition`, `MedicationRequest`, or diagnostic persistence. All AI-generated diagnoses are forced to status `unconfirmed` / `PROPOSED_BY_AI`.
2. **Sole Physician Authority**: Only an authenticated clinician (`physician` role) can promote an unconfirmed AI suggestion into an active FHIR resource via explicit `confirmDiagnosis` or `confirmMedication` directives.
3. **Deterministic Safety Precedence**: Hard-stop safety engines (allergy contraindications, drug interactions, red-flag emergency escalations) execute **before** any FHIR persistence can occur. If a critical contraindication is detected, persistence is halted (`SAFETY_LOCKED`, `CONTRAINDICATION_HARD_STOP`).
4. **Strict Patient & Tenant Isolation**: Every document, audio recording, image analysis, stream connection, and FHIR resource is authoritatively scoped by `tenantId` and `patientId`. Cross-tenant or cross-patient resource tampering fails closed with HTTP 403.
5. **Zero Fabricated Fallbacks**: When speech transcription, OCR extraction, or model APIs fail or produce silence/unintelligible input, the system throws deterministic errors (`SILENT_AUDIO_REJECTED`, `WHISPER_UNAVAILABLE`, `DOCUMENT_BUFFER_REQUIRED`). It never generates hallucinations or dummy clinical findings.
6. **Binary Magic Byte Verification**: Document and media uploads inspect physical magic bytes (`%PDF-`, `\x89PNG`, `\xFF\xD8\xFF`, etc.) rather than trusting user-supplied MIME headers or file extensions.
7. **Immutable Source Attribution**: Every clinical fact in the multimodal context carries a strict source attribution tag:
   - `PATIENT_REPORTED`
   - `CLINICIAN_ENTERED`
   - `AI_INFERRED`
   - `FHIR_EXISTING`
   - `DOCUMENT_DERIVED`
   - `IMAGE_DERIVED`
8. **Cryptographic Provenance Linking**: Confirmed clinical resources link to source artifacts (FHIR `Media`, `DocumentReference`, `QuestionnaireResponse`) and identify the attending physician as `attester` via FHIR `Provenance`.
9. **Tamper-Evident Audit Chaining**: All pipeline transitions, confirmation actions, stream events, and safety evaluations are immutably logged to an append-only cryptographic ledger chained using SHA-256 hashes (`operational_audit_events`).
10. **Zero PHI or Secret Leakage**: Audit logs, SSE event IDs, stream tokens, and error payloads scrub stack traces, filesystem paths, API keys, credentials, and raw image/audio bytes.

---

## 3. Subsystem Specifications

### 3.1 Multimodal Context Layer (`MultimodalContextService`)
- **Location**: `apps/api/services/clinical/multimodalContextService.js`
- **Responsibilities**:
  - Assembles unified context combining:
    - Authoritative FHIR patient demographics and longitudinal history (active conditions, current medications, documented allergies, prior encounters).
    - Patient intake responses (`QuestionnaireResponse`).
    - Ambient consultation dialogue transcripts (`VoiceService`).
    - Extracted document facts (`DocumentService`).
    - Captured image intelligence findings (`VisionService`).
    - Scoped clinical guidelines and evidence references (`EvidenceService`).
  - Enforces cross-patient and cross-tenant isolation on all input artifacts.
  - Builds normalized narrative blocks for downstream clinical synthesis while preserving provenance tags.

### 3.2 Document Intelligence (`DocumentService`)
- **Location**: `apps/api/services/document/documentService.js`
- **Capabilities**:
  - Enforces binary bounds: Minimum 16 bytes, maximum 15 MB.
  - Inspects binary headers for valid magic numbers (PDF `%PDF-`, JPEG `\xFF\xD8\xFF`, PNG `\x89PNG\r\n\x1a\n`).
  - Provider abstraction architecture (`GeminiProvider`, `TesseractProvider`, `DemoProvider`) enabling deterministic extraction of clinical facts (lab values, dates, normal ranges).
  - Facts are tagged `DOCUMENT_DERIVED` and `unconfirmed`.

### 3.3 Voice & Consultation Transcription (`VoiceService`)
- **Location**: `apps/api/services/voice/voiceService.js`
- **Capabilities**:
  - Audio validation: 64 bytes to 25 MB; supported formats: `audio/webm`, `audio/wav`, `audio/mp3`, `audio/ogg`, `audio/m4a`.
  - Provider abstraction: `WhisperProvider` (local CLI binary detection), `GeminiVoiceProvider`, and `DemoProvider`.
  - Silence guard: Zero tolerance for silent or corrupt audio; rejects with `SILENT_AUDIO_REJECTED`.
  - Audit logging of transcript length, SHA-256 digest, and provider model without logging raw audio buffers.

### 3.4 Evidence & Clinical Guidelines (`EvidenceService`)
- **Location**: `apps/api/services/evidence/evidenceService.js`
- **Capabilities**:
  - Deterministic clinical guideline catalog covering ADA Type 2 Diabetes, ACC/AHA Hypertension, GINA Asthma, and Penicillin cross-reactivity.
  - Document-derived evidence extraction strictly isolated by tenant and patient.
  - Clean separation between established clinical evidence and AI speculation.

### 3.5 Real-Time Clinical Streaming (`StreamManager` & `EventFactory`)
- **Location**: `apps/api/services/streaming/`
- **Protocol**: Server-Sent Events (SSE) compliant with W3C standard.
- **Canonical Event Sequence**:
  1. `MULTIMODAL_CONTEXT_STARTED`
  2. `FHIR_CONTEXT_READY`
  3. `INTAKE_CONTEXT_READY`
  4. `DOCUMENT_CONTEXT_READY`
  5. `VISION_CONTEXT_READY`
  6. `TRANSCRIPT_CONTEXT_READY`
  7. `EVIDENCE_RETRIEVAL_STARTED`
  8. `EVIDENCE_RETRIEVAL_COMPLETE`
  9. `CLINICAL_CONTEXT_READY`
  10. `AI_ANALYSIS_STARTED`
  11. `AI_ANALYSIS_DELTA` (optional token streaming)
  12. `AI_ANALYSIS_COMPLETE`
  13. `SAFETY_CHECK_STARTED`
  14. `SAFETY_WARNING` / `EMERGENCY_DETECTED` (conditional)
  15. `CLINICAL_OUTPUT_READY`
  16. `AUDIT_COMPLETE`
  17. `STREAM_COMPLETE` (terminal)
- **Resilience**: Monotonic sequence indexing (`id: seq`), bounded in-memory buffer (100 events), and `Last-Event-ID` reconnection replay.

### 3.6 Clinician Confirmation & Review (`ClinicianConfirmationService`)
- **Location**: `apps/api/services/clinical/clinicianConfirmationService.js`
- **Operations**:
  - `confirmDiagnosis`: Clinician reviews AI differential. Action `ACCEPT` generates an active confirmed FHIR `Condition` and links `Provenance`. Action `REJECT` logs clinician dismissal with zero condition created.
  - `confirmMedication`: Clinician reviews suggested prescription. Validates against deterministic safety engine before creating active FHIR `MedicationRequest`. Critical contraindications trigger `CONTRAINDICATION_HARD_STOP` unless overridden with a substantive physician directive (> 10 characters).
  - `reviewRecommendation`: General clinician approval/rejection of AI recommendations.

### 3.7 Longitudinal Intelligence (`LongitudinalService`)
- **Location**: `apps/api/services/clinical/longitudinalService.js`
- **Capabilities**:
  - Aggregates multi-encounter patient history.
  - Identifies longitudinal clinical signals (chronic conditions, polypharmacy, recurrent allergies, care density).
  - Strictly enforces tenant isolation on trajectory queries.

---

## 4. Verification & Test Matrix

The full automated regression suite contains **207 tests** passing at 100%:

| Test Suite | File | Tests | Status |
| :--- | :--- | :---: | :---: |
| M1 Architecture Validation | `milestone1_architecture_validation.cjs` | 17 | **PASS** |
| M1 Clinical Integrity Validation | `milestone1_clinical_integrity_validation.cjs` | 14 | **PASS** |
| M2A Dynamic Intake Validation | `milestone2a_dynamic_intake_validation.cjs` | 22 | **PASS** |
| M2B-1 Capture Session Validation | `milestone2b_capture_session_validation.cjs` | 24 | **PASS** |
| M2B-2 Camera & Upload Validation | `milestone2b2_camera_upload_validation.cjs` | 30 | **PASS** |
| M2C-1 Vision Intelligence Validation | `milestone2c1_vision_validation.cjs` | 21 | **PASS** |
| M2C-2 Clinician Visual Review | `milestone2c2_vision_review_validation.cjs` | 22 | **PASS** |
| M2C-3 Real-Time Streaming | `milestone2c3_streaming_validation.cjs` | 22 | **PASS** |
| M3 Multimodal Validation | `milestone3_multimodal_validation.cjs` | 35 | **PASS** |
| **Total Automated Regression** | | **207** | **100% PASS** |

In addition, the complete 12-step end-to-end integration test (`apps/api/tests/verify_multimodal_e2e.cjs`) verifies live coordination of intake, PDF labs, consultation audio, image intelligence, real-time SSE streaming, safety hard-stops, physician confirmation, FHIR persistence, and SHA-256 audit chain integrity.

Frontend web build (`apps/web`):
- `tsc -b && vite build` completes with **0 errors**.
