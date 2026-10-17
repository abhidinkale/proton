# PROTON ARCHITECTURE: HEALTH ASSISTANT DOMAIN SEPARATION & BOUNDARY SPECIFICATION

**Status:** Approved Architectural Standard
**Date:** October 17, 2026
**Scope:** Decoupling Proton Core (Clinical OS) from Proton Health Assistant (Patient-Facing App)
**Baseline Git Commit:** `8c3110274424ef911527f0f15d864875e67d6193`

---

## 1. ARCHITECTURAL OVERVIEW & PURPOSE

Proton is partitioned into two distinct conceptual and operational layers:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       PROTON HEALTH ASSISTANT                            │
│                 (Patient-Facing Experience & Companion)                  │
│                                                                          │
│  - Conversational Health Chat             - Voice Dialogue Capture       │
│  - Dynamic Symptom Intake                 - Camera / Lesion Capture      │
│  - Patient Health Education               - Clinician Handoff Packaging  │
│  - Specialty Experiences (Derm, Resp)     - Care Gap & Scheduling Bridge │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     │  [Explicit, Controlled API Boundary]
                                     │  (Read-Only or Draft Observational)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            PROTON CORE                                   │
│                  (Authoritative Clinical Platform)                       │
│                                                                          │
│  - Authoritative FHIR R4 Engine           - Deterministic Safety Engine  │
│  - Longitudinal Patient Trajectory        - Multimodal Clinical Pipeline │
│  - Attending Physician Doctor Desk        - Clinician Confirmation Gate  │
│  - Cryptographic Provenance & Audit Chain - Tenant & Patient Isolation  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Core Invariant
**The Health Assistant MUST NOT become part of Proton Core's authoritative clinical workflow.** It is a patient-facing client application that consumes Proton Core capabilities through explicit, authenticated, and gated service/API contracts.

---

## 2. DOMAIN BOUNDARIES & RESPONSIBILITIES

### A. Proton Core Responsibilities
1. **Authoritative Clinical Record (EHR):** Sole custodian of confirmed FHIR R4 resources (`Condition`, `MedicationRequest`, `AllergyIntolerance`, `Observation`, `Encounter`, `Provenance`).
2. **Deterministic Safety Enforcement:** Executes drug-allergy contraindication checks, maximum dosage limits, and acute emergency red-flag halts before any clinical action can be persisted.
3. **Clinical Authority & Attestation:** Enforces that only verified clinicians (`physician`, `practitioner`) can confirm diagnoses, order medications, or sign clinical notes.
4. **Multimodal Clinical Intelligence:** Coordinates speech recognition (Whisper), document intelligence (OCR), clinical vision, and clinical reasoning (Gemini/DeepSeek) into a unified narrative.
5. **Audit & Regulatory Integrity:** Immutably records every clinical stage in an encrypted, SHA-256 tamper-evident hash chain.
6. **Multi-Tenant & Patient Isolation:** Enforces strict boundary verification across all operations; fails closed with HTTP 403 on tenant or patient mismatches.

### B. Health Assistant Responsibilities
1. **Patient-Facing Interaction:** Provides conversational health guidance, symptom triage, empathetic explanations, and health literacy translations.
2. **Dynamic Intake Collection:** Administers branchable clinical questionnaires (e.g. dermatological, respiratory) and captures patient answers.
3. **Capture Guidance:** Assists patients in taking sharp, well-lit clinical photos (lesions, rashes, pills) and recording voice notes.
4. **Non-Diagnostic Health Assessment:** Displays preliminary, educational risk considerations with explicit medical disclaimers ("This is not a diagnosis. Consult your doctor.").
5. **Clinician Handoff Generation:** Packages patient-reported symptoms, intake responses, and media artifacts into a structured handoff packet for doctor review.
6. **Care Gap & Navigation Support:** Prompts patients to schedule follow-ups or address preventative screening gaps.

---

## 3. PERMITTED VS. FORBIDDEN INTERACTIONS

### C. Allowed Health Assistant → Proton Core Interactions
- `POST /api/intake/questionnaires/:id/responses`: Submit patient-reported questionnaire responses.
- `POST /api/capture/sessions/:id/upload`: Upload patient-captured clinical images using ephemeral pairing tokens.
- `POST /api/vision/analyze`: Request preliminary computer vision finding proposals on uploaded media.
- `POST /api/clinical/pipeline` (with `commitToFhir: false`): Request preliminary multimodal AI analysis and safety triage without committing active FHIR records.
- `POST /api/chat`: Engage in patient-friendly clinical reference Q&A with strict safety framing.
- `GET /api/clinical/trajectory/:patientId`: Retrieve approved, patient-accessible longitudinal health history.
- `POST /api/operations/bridge/symptom`: Submit a patient triage request to stage an encounter for clinician review.

### D. Forbidden Health Assistant Interactions (Strictly Enforced)
- ❌ **Direct FHIR Mutation:** Cannot call `POST /api/clinical/confirm/diagnosis` or `POST /api/clinical/confirm/medication` (requires `physician` role).
- ❌ **Autonomous Clinical Persistence:** Cannot pass `commitToFhir: true` to `/api/clinical/pipeline` (fails closed with 403 `CLINICIAN_AUTHORIZATION_REQUIRED`).
- ❌ **Prescription / Medication Ordering:** Zero capability to generate active `MedicationRequest` resources.
- ❌ **Safety Override:** Cannot override, disable, or bypass Stage 5 deterministic safety checks or allergy hard-stops.
- ❌ **Cross-Patient Access:** Cannot query, submit, or view records belonging to any other patient ID.
- ❌ **Cross-Tenant Access:** Cannot access resources across organizational tenant boundaries.
- ❌ **Competing Clinical Pipeline:** Cannot implement an independent parallel pipeline that writes unvetted clinical diagnoses to storage.

---

## 4. TRUST, AUTHENTICATION & ISOLATION BOUNDARIES

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TRUST BOUNDARY SPECIFICATION                                                │
├──────────────────────┬────────────────────────┬─────────────────────────────┤
│ Domain               │ Actor Identity         │ Permitted Operations        │
├──────────────────────┼────────────────────────┼─────────────────────────────┤
│ Health Assistant     │ role: 'patient' or     │ Read patient data, submit   │
│ (Untrusted / Client) │ role: 'health_assistant'│ intake, upload media, draft │
│                      │ (Scoped JWT / Token)   │ analysis (commitToFhir=false)│
├──────────────────────┼────────────────────────┼─────────────────────────────┤
│ Doctor Desk          │ role: 'physician' or   │ Confirm diagnoses, sign     │
│ (Authoritative Core) │ role: 'practitioner'   │ prescriptions, review media,│
│                      │ (Hospital IAM / OIDC)  │ commit FHIR transactions    │
└──────────────────────┴────────────────────────┴─────────────────────────────┘
```

### E. Trust Boundaries
- All data originating from the Health Assistant is treated as **Untrusted Input**.
- Patient inputs must pass through schema validation, length caps, and sanitization.
- AI inferences requested by the Health Assistant are strictly **Advisory / Draft** and carry status `unconfirmed`.

### F. Authentication & Authorization Expectations
- Health Assistant clients authenticate using scoped patient tokens or ephemeral session pairing tokens.
- RBAC middleware (`resolveActorMiddleware`, `requireRole`) strictly inspects `actorRole`.
- Any attempt by a `patient` or `health_assistant` actor to invoke clinician-gated endpoints results in HTTP 403.

### G. Patient & Tenant Isolation
- Every request payload must explicitly include matching `patientId` and `tenantId`.
- Any mismatch between the authenticated actor's token context and the target resource fails closed with:
  - `CROSS_PATIENT_ACCESS_DENIED` (HTTP 403)
  - `CROSS_TENANT_ACCESS_DENIED` (HTTP 403)

### H. Clinical Data Ownership
- **Proton Core** is the authoritative system of record for all longitudinal clinical data.
- The Health Assistant maintains local cache/session state only for conversational continuity and UI rendering. It owns zero permanent clinical databases.

---

## 5. FORMAL DATA CLASSIFICATION SCHEMA

Every data point entering Proton Core carries explicit, unambiguous provenance attribution:

| Data Classification | Description | Originating Layer | Authoritative Layer | Clinical Status |
|---|---|---|---|---|
| `PATIENT_REPORTED` | Subjective symptoms, questionnaire answers, self-reported pain/history | Health Assistant | Health Assistant (collection) / Core (storage) | Unconfirmed / Observational |
| `CLINICIAN_ENTERED` | Physical exam notes, physician directives, confirmed diagnoses, signed orders | Doctor Desk | Proton Core | Authoritative / Legal Record |
| `AI_INFERRED` | Differential diagnoses, risk scores, summary notes, visual observation proposals | Proton Core AI Engine | Proton Core | Draft / Non-Authoritative |
| `FHIR_EXISTING` | Baseline EHR data: active conditions, documented allergies, verified medications | Proton Core FHIR Store | Proton Core | Authoritative Baseline |
| `DOCUMENT_DERIVED` | OCR facts and lab values extracted from uploaded PDFs / images | Proton Core Document Engine | Proton Core | Observational / Requires Review |
| `IMAGE_DERIVED` | Clinical photographs, lesion metrics, image quality scores | Proton Core Capture Engine | Proton Core | Media Artifact / Requires Review |
| `VOICE_DERIVED` | Speech-to-text transcripts generated from patient audio dialogue | Proton Core Voice Engine | Proton Core | Unverified Spoken Dialogue |

---

## 6. CONCEPTUAL HEALTH ASSISTANT API CONTRACT

The Health Assistant interacts with Proton Core via 7 standardized service contracts:

### 1. Create Patient-Reported Intake
- **Contract:** `POST /api/intake/questionnaires/:id/responses`
- **Consumer:** Health Assistant
- **Provider:** `IntakeService` (`apps/api/services/intake`)
- **Input:** `{ questionnaireId, patientId, items, answers, actor }`
- **Output:** `{ questionnaireResponseId, intakeContext: { facts }, escalation }`
- **Guarantees:** Extracts `PATIENT_REPORTED` facts; evaluates red-flag escalations; creates 0 active Conditions.

### 2. Submit Captured Media
- **Contract:** `POST /api/capture/sessions/:id/upload`
- **Consumer:** Health Assistant (Mobile Camera / Upload)
- **Provider:** `CaptureSessionService` + `StorageService`
- **Input:** `multipart/form-data` with image binary and pairing token
- **Output:** `{ mediaId, fhirMedia: { id, status: 'preliminary' }, quality: { pass: true } }`
- **Guarantees:** Validates image format and blur; creates FHIR `Media` resource with status `preliminary`.

### 3. Request Image Analysis
- **Contract:** `POST /api/vision/analyze`
- **Consumer:** Health Assistant
- **Provider:** `VisionService` (`apps/api/services/vision`)
- **Input:** `{ mediaId, patientId, tenantId }`
- **Output:** `{ analysisId, findings, differential, status: 'unconfirmed' }`
- **Guarantees:** Runs anatomical privacy filter; returns `AI_INFERRED` visual suggestions; creates 0 active Conditions.

### 4. Request Clinical Assessment
- **Contract:** `POST /api/clinical/pipeline` (with `commitToFhir: false`)
- **Consumer:** Health Assistant
- **Provider:** `ClinicalPipeline` (`apps/api/services/clinical`)
- **Input:** `{ patientId, transcript, intakeContext, commitToFhir: false }`
- **Output:** `{ aiAnalysis: { differential, summary }, safety: { contraindications } }`
- **Guarantees:** Runs deterministic safety engine; rejects `commitToFhir: true` for non-physicians; returns draft guidance.

### 5. Retrieve Allowed Patient Context
- **Contract:** `GET /api/clinical/trajectory/:patientId`
- **Consumer:** Health Assistant
- **Provider:** `LongitudinalService` + `FhirService`
- **Input:** `patientId` (verified against actor token)
- **Output:** `{ patientId, timeline: [...], activeConditions: [...] }`
- **Guarantees:** Returns patient-safe longitudinal timeline; redacts sensitive internal clinician notes.

### 6. Create Clinician Handoff
- **Contract:** `POST /api/operations/bridge/symptom`
- **Consumer:** Health Assistant
- **Provider:** `OperationsService` + `MultimodalContextService`
- **Input:** `{ patientId, symptom, intakeResponseId, mediaIds, urgency }`
- **Output:** `{ handoffId, taskId, triagePriority: 'ROUTINE' | 'URGENT' }`
- **Guarantees:** Stages an encounter packet for the Doctor Desk triage queue; zero automated prescribing.

### 7. Retrieve Handoff Status
- **Contract:** `GET /api/operations/tasks` (filtered by patient)
- **Consumer:** Health Assistant
- **Provider:** `OperationsService`
- **Input:** `patientId`
- **Output:** `{ tasks: [{ id, type, status: 'PENDING_CLINICIAN_REVIEW' | 'COMPLETED' }] }`
- **Guarantees:** Informs patient of review progress without exposing internal clinician deliberation.

---

## 7. CLINICIAN HANDOFF MODEL

When a patient completes an interaction in the Health Assistant, the handoff to the attending clinician follows this strict lifecycle:

```
[Health Assistant Interaction]
  ├── Patient completes dynamic intake
  ├── Patient uploads clinical photo
  └── Patient describes symptoms
               │
               ▼
   [Clinician Handoff Packet]
  ├── Intake: QuestionnaireResponse (PATIENT_REPORTED)
  ├── Image: FHIR Media (IMAGE_DERIVED, preliminary)
  ├── AI Preview: Vision Findings (AI_INFERRED, unconfirmed)
  └── Triage Priority: Computed by Escalation Engine
               │
               ▼
      [Doctor Desk Inbox]
  ├── Attending physician inspects patient packet
  ├── Physician reviews visual findings (Accept / Modify / Reject)
  ├── Physician edits or confirms preliminary differential
  └── Physician signs prescription (if clinically warranted)
               │
               ▼
    [Proton Core FHIR EHR]
  ├── Active Condition committed (with FHIR Provenance attestation)
  ├── Active MedicationRequest committed (after allergy safety pass)
  └── Audit trail recorded in cryptographic SHA-256 chain
```

---

## 8. FUTURE REPOSITORY & APPLICATION STRUCTURE

### Recommendation
The current repository is an npm monorepo with `apps/api` (backend) and `apps/web` (frontend).

When building the Health Assistant application, the repository should be structured as follows:

```
proton/
├── apps/
│   ├── api/                   # Proton Core Backend (Node.js/Express)
│   │   ├── services/clinical/ # Pipeline, safety, multimodal context
│   │   ├── services/fhir/     # Authoritative FHIR store
│   │   ├── services/intake/   # Questionnaires, branching, escalations
│   │   ├── services/vision/   # Vision analysis & safety
│   │   └── services/capture/  # Mobile pairing & media ingestion
│   │
│   ├── web/                   # Proton Clinical Platform (Doctor Desk)
│   │   └── src/pages/         # DoctorDeskEncounter, Dashboard, Operations
│   │
│   └── health-assistant/      # Future Patient-Facing App (Separate Vite/React app)
│       ├── src/components/    # Conversational chat, camera capture, triage UI
│       ├── src/services/      # Proton Core API client (restricted contracts)
│       └── src/pages/         # Symptom intake, health companion, handoff view
│
├── packages/                  # Shared Domain Types & Contracts
│   ├── clinical-types/        # Shared FHIR types, data classifications, schemas
│   └── safety-contracts/      # Canonical error codes, event formats
│
└── docs/                      # Architectural specifications
```

### Why a Separate `apps/health-assistant`?
1. **Zero UI Coupling:** Prevents accidental leakage of clinical controls, prescription pads, or internal notes into patient screens.
2. **Independent Deployment:** The patient-facing mobile/web app can be updated, scaled, and deployed to a consumer CDN independently of the hospital Doctor Desk.
3. **Strict Client-Side Security Boundary:** The Health Assistant client bundle contains zero physician code, zero administrative routes, and zero clinical confirmation logic.

---

## 9. VERIFICATION & ARCHITECTURAL INVARIANTS

The boundary is formally validated by automated test suite [`apps/api/tests/health_assistant_boundary_validation.cjs`](file:///Users/abhidinkale/Downloads/proton/apps/api/tests/health_assistant_boundary_validation.cjs), confirming:
1. `health_assistant` role cannot commit active clinical resources to FHIR (403 `CLINICIAN_AUTHORIZATION_REQUIRED`).
2. `patient` role cannot commit active clinical resources to FHIR (403 `CLINICIAN_AUTHORIZATION_REQUIRED`).
3. Health Assistant can request read-only clinical evaluation (`commitToFhir: false`).
4. Patient intake creates `QuestionnaireResponse` with `PATIENT_REPORTED` attribution and 0 active `Condition` resources.
5. Deterministic safety contraindications halt Health Assistant pipeline workflows.
6. Multimodal context assembly fails closed on cross-patient context mismatch (403 `CROSS_PATIENT_ACCESS_DENIED`).
7. Formal Data Classification schema contains all 7 canonical categories.
