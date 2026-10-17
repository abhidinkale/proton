# Proton Milestone 2C-3: Real-Time Clinical Streaming / SSE

## Executive Summary

Milestone 2C-3 delivers the enterprise-grade Server-Sent Events (SSE) streaming architecture for Proton V2's clinical AI pipeline. It connects ambient acoustic/transcript capture and AI clinical synthesis directly to the clinician's Doctor Desk in real time, maintaining strict patient isolation, physician authority, deterministic safety ordering, and tamper-evident cryptographic provenance.

---

## Architecture & Data Flow

```
┌─────────────────────────┐
│ Doctor Desk / Client    │
└───────────┬─────────────┘
            │ 1. POST /api/clinical/pipeline/stream (or /api/clinical/streams)
            ▼
┌─────────────────────────┐
│ Express Route / RBAC    │ ─── Authenticate Actor (Session Token / Dev Persona)
└───────────┬─────────────┘ ─── Validate Patient & Multi-Tenant Isolation
            │ 2. Upgrade to SSE (text/event-stream)
            ▼
┌─────────────────────────┐
│ StreamManager           │ ─── Opaque 128-bit Entropy streamId (Zero PHI)
└───────────┬─────────────┘ ─── Strictly Monotonic Sequence (1, 2, 3...)
            │               ─── Automated Keepalive Heartbeat (15s)
            │               ─── Inactivity Timeout Guard (120s)
            │               ─── Bounded Event Buffer (Max 50 events)
            │ 3. Execute with onEvent callback
            ▼
┌───────────────────────────────────────────────────────────────┐
│ Canonical Clinical Pipeline (clinicalPipeline.js)            │
│                                                               │
│   [1] INPUT_RECEIVED ──────> [2] VALIDATION_COMPLETE          │
│                                           │                   │
│   [4] AI_ANALYSIS_STARTED <─── [3] CLINICAL_CONTEXT_READY     │
│             │                                                 │
│   [5] AI_ANALYSIS_COMPLETE ──> [6] SAFETY_CHECK_STARTED       │
│                                           │                   │
│                                  Deterministic Safety         │
│                              ┌────────────┴────────────┐      │
│                              ▼                         ▼      │
│                     [SAFETY_WARNING]             [SAFETY_LOCKED] ──> HALT! Zero FHIR persistence
│                              │                                │
│                              ▼                                │
│                     [CLINICAL_OUTPUT_READY]                   │
│                              │                                │
│                     [FHIR_COMMIT_STARTED]                     │
│                              │                                │
│                     [FHIR_COMMIT_COMPLETE]                    │
│                              │                                │
│                     [AUDIT_COMPLETE]                          │
│                              │                                │
│                     [STREAM_COMPLETE]                         │
└───────────────────────────────────────────────────────────────┘
```

---

## Canonical Event Catalog

| Event Type | Category | Description | Terminal |
| :--- | :--- | :--- | :--- |
| `HEARTBEAT` | Transport | 15s keepalive ping; zero clinical state mutation | No |
| `INPUT_RECEIVED` | Lifecycle | Pipeline payload parsed and format-validated | No |
| `VALIDATION_COMPLETE` | Lifecycle | Patient context and actor permissions verified | No |
| `CLINICAL_CONTEXT_READY` | Lifecycle | Authoritative patient chart context loaded | No |
| `AI_ANALYSIS_STARTED` | Model | AI transcription / SOAP synthesis started | No |
| `AI_ANALYSIS_DELTA` | Model | Reserved for incremental token streaming | No |
| `AI_ANALYSIS_COMPLETE` | Model | AI draft note generated and schema-validated | No |
| `SAFETY_CHECK_STARTED` | Safety | Deterministic allergy, DDI, and dosage validation | No |
| `SAFETY_WARNING` | Safety | Non-critical contraindication or advisory | No |
| `EMERGENCY_DETECTED` | Safety | Intake red flag or severe safety hazard | No |
| `SAFETY_LOCKED` | Safety | Hard stop without valid physician directive override | **Yes** |
| `CLINICAL_OUTPUT_READY` | Lifecycle | Structured SOAP draft ready for physician review | No |
| `FHIR_COMMIT_STARTED` | Persistence | Atomic Medplum R4 Bundle commit started | No |
| `FHIR_COMMIT_COMPLETE` | Persistence | Atomic FHIR resources committed | No |
| `AUDIT_COMPLETE` | Provenance | SHA-256 tamper-evident provenance log entry sealed | No |
| `STREAM_COMPLETE` | Lifecycle | Stream concluded successfully | **Yes** |
| `STREAM_ERROR` | Lifecycle | Execution error; stack traces & paths scrubbed | **Yes** |

---

## Security & Clinical Authority Invariants

1. **Zero PHI in Generic Identifiers:**
   Stream IDs follow the strict entropy pattern `str-<timestamp>-<32hex>`. Stream IDs never encode patient names, MRNs, diagnosis codes, or tokens.
2. **Deterministic Safety Priority:**
   AI-generated notes and suggestions are NEVER committed to FHIR prior to safety gate execution. Hard stops emit `SAFETY_LOCKED` and abort before any FHIR transaction.
3. **Physician Authority:**
   AI-suggested diagnoses are marked `PROPOSED_BY_AI` with `clinicianConfirmed: false`. Zero active FHIR `Condition` or `MedicationRequest` resources are created without explicit clinician confirmation.
4. **Scrubbed Error Payloads:**
   Internal file paths (`/Users/...`), database strings, and API keys (`AIza...`) are stripped from `STREAM_ERROR` messages before client delivery.
5. **Multi-Tenant & Patient Scope Gates:**
   Cross-tenant and cross-patient stream operations are rejected with HTTP 403 `CROSS_TENANT_ACCESS_DENIED` and `CROSS_PATIENT_ACCESS_DENIED`.
6. **Bounded In-Memory Resources:**
   Stream buffers retain a maximum of 50 events for reconnection via `Last-Event-ID`. Each tenant is capped at 100 concurrent streams. Disconnected clients are cleaned up on `req.on('close')`.

---

## Verification & Test Results

- **Milestone 2C-3 Adversarial Suite:** 22/22 Passing
- **Full Multi-Milestone Regression Suite:** 172/172 Passing
  - M1 Architecture Validation: 17/17
  - M1 Clinical Integrity Validation: 14/14
  - M2A Dynamic Intake Validation: 22/22
  - M2B-1 Capture Session Validation: 24/24
  - M2B-2 Camera Upload Validation: 30/30
  - M2C-1 Vision Intelligence Validation: 21/21
  - M2C-2 Clinician Visual Review Validation: 22/22
  - M2C-3 Real-Time Streaming Validation: 22/22
- **Web Build:** 0 errors (`npm run build` in `apps/web`)
- **Manual End-to-End Live HTTP Smoke Test:** 11/11 lifecycle events verified in real time.
