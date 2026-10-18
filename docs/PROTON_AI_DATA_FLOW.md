# PROTON AI DATA FLOW & PIPELINE LIFECYCLE

**Date:** 2026-10-18  
**Architecture Version:** Milestone 2  
**System:** Proton AI-Native Clinical Operating System

---

## 1. End-to-End Clinical Data Flow

```
+-----------------------------------------------------------------------------------+
| 1. INPUT STAGE                                                                    |
|    Physician Consultation Audio, Dialogue Transcript, Intake, or Documents       |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 2. VALIDATION & SECURITY GATE                                                     |
|    Strict Payload & Schema Checks | Patient Identity Verification                  |
|    Tenant Isolation (HTTP 403 on Cross-Tenant Probe)                              |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 3. CLINICAL CONTEXT ENGINE                                                        |
|    Patient-Bound Retrieval (Allergies, Active Meds, Diagnoses, Prior Encounters)   |
|    Missing Data Flagged Explicitly (NOT_DOCUMENTED)                                |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 4. JEV TYPED DECISION ROUTER                                                      |
|    Noul (Multi-Specialty Check) | Choice (Primary & Secondary Specialties)         |
|    Score (Triage Urgency Calibration)                                             |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 5. SPECIALIST AGENT ORCHESTRATION                                                 |
|    Concurrent Execution (Cardiology, Neurology, Endo, Internal Med)               |
|    Fault Isolation (Timeout/Crash in Agent B Does Not Crash Agent A)             |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 6. GENERATIVE SYNTHESIS & DRAFTING                                                |
|    Narrative SOAP Note Synthesis | Consensus & Disagreement Preservation          |
|    Status: DRAFT | ClinicianConfirmed: FALSE                                      |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 7. SAFETYGATE (DETERMINISTIC VERIFICATION)                                       |
|    Allergy Contraindications (Penicillin -> Amoxicillin CRITICAL Hard Stop)       |
|    Drug-Drug Interactions (Warfarin + NSAIDs) | Daily Dose Ceilings               |
|    Physician Directive Required to Override Hard Stop (>= 10 chars rationale)     |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 8. PHYSICIAN REVIEW & CRYPTOGRAPHIC PROVENANCE                                    |
|    Licensed Clinician Reviews & Edits Draft Note and Prescriptions                |
|    Tamper Hash Minted Over Input Digest, Output Digest, and Model ID              |
|    Physician Signature Seals Transition from DRAFT to APPROVED                    |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 9. ATOMIC FHIR TRANSACTION COMMIT                                                 |
|    Medplum R4 Atomic Bundle (Encounter, ClinicalImpression, Condition, Meds)      |
|    Tamper-Evident SHA-256 Audit Trail Entry Recorded                              |
+-----------------------------------------------------------------------------------+
```

---

## 2. Server-Sent Events (SSE) Streaming Contract

For ambient consultations and real-time frontend synchronization, the pipeline emits standard events:

| Event Name | Stage | Payload Content |
|---|---|---|
| `INPUT_RECEIVED` | Stage 1 | `{ patientId, hasAudio, hasTranscript, template }` |
| `VALIDATION_COMPLETE` | Stage 2 | `{ patientId, practitionerId, commitToFhir }` |
| `CLINICAL_CONTEXT_READY`| Stage 3 | `{ conditionsCount, medicationsCount, allergiesCount, evidenceCount }` |
| `ROUTING_COMPLETE` | Stage 4 | `{ routedSpecialists: ['Cardiology', 'Internal Medicine'] }` |
| `SPECIALIST_COMPLETE` | Stage 5 | `{ specialist, confidence, considerationsCount }` |
| `AI_ANALYSIS_COMPLETE` | Stage 6 | `{ model, usage: { promptTokens, completionTokens } }` |
| `SAFETY_WARNING` | Stage 7 | `{ contraindications, warnings, hardStop: boolean }` |
| `CLINICAL_OUTPUT_READY` | Stage 8 | `{ suggestedDiagnosesCount, prescriptionCount, draftProvenance }` |
| `FHIR_COMMIT_COMPLETE` | Stage 9 | `{ committed: true, encounterId, bundleId }` |
| `STREAM_COMPLETE` | End | `{ pipelineRunId, durationMs, provenance: { auditId, currentHash } }` |
| `STREAM_ERROR` | Error | `{ stage, code, message, status }` |
