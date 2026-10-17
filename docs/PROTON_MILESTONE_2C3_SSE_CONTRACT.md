# Proton Clinical SSE Event Contract (v1)

## 1. Specification Overview

This document specifies the Server-Sent Events (SSE) protocol for real-time clinical AI orchestration in Proton V2.

The streaming subsystem provides tamper-evident, authenticated, patient-isolated, and deterministically sequenced real-time events during clinical pipeline execution, AI synthesis, deterministic safety evaluation, and atomic FHIR persistence.

---

## 2. Event Envelope Schema

Every event emitted across an active SSE connection conforms to the following strict JSON schema:

```json
{
  "version": "1",
  "eventId": "evt-7f8e3d2a-c45b-49e0-81f3-e52d3a1b0c9f",
  "streamId": "str-1792198000-a4f9b8c2d1e0f3a5",
  "type": "<EVENT_TYPE>",
  "timestamp": "2026-10-17T06:30:00.000Z",
  "sequence": 1,
  "payload": {}
}
```

### Envelope Fields:
- **`version`** (`string`, mandatory): Contract version identifier (strictly `"1"`).
- **`eventId`** (`string`, mandatory): Cryptographically strong unique event identifier (`evt-<UUIDv4>` or 128-bit hex entropy).
- **`streamId`** (`string`, mandatory): Opaque, cryptographically random stream identifier (`str-<timestamp>-<128-bit-hex>`). Must NEVER contain patient identifiers, MRNs, diagnosis codes, or PHI.
- **`type`** (`string`, mandatory): Standard event type from the canonical event catalog.
- **`timestamp`** (`string`, mandatory): ISO-8601 UTC timestamp.
- **`sequence`** (`integer`, mandatory): Strictly monotonic integer per stream, starting at `1`.
- **`payload`** (`object`, mandatory): Event-specific structured metadata. Contains clinical information only when required for the specific phase.

---

## 3. Canonical Event Catalog

| Event Type | Category | Description | Terminal? |
| :--- | :--- | :--- | :--- |
| **`HEARTBEAT`** | Keepalive | Periodic ping every 15s to keep proxy/browser connection alive. Zero clinical state mutation. | No |
| **`INPUT_RECEIVED`** | Pipeline Lifecycle | Pipeline input payload validated for schema and format. | No |
| **`VALIDATION_COMPLETE`** | Pipeline Lifecycle | Patient reference, encounter binding, and actor credentials validated. | No |
| **`CLINICAL_CONTEXT_READY`**| Pipeline Lifecycle | Authoritative patient chart context (conditions, medications, allergies) loaded. | No |
| **`AI_ANALYSIS_STARTED`** | Model Execution | AI synthesis/transcription provider invocation initiated. | No |
| **`AI_ANALYSIS_DELTA`** | Model Execution | Incremental token delta (reserved for future token streaming). | No |
| **`AI_ANALYSIS_COMPLETE`** | Model Execution | AI synthesis completed; raw clinical draft generated. | No |
| **`SAFETY_CHECK_STARTED`** | Deterministic Safety | Deterministic rule engine evaluating drug-allergy, DDI, and dose limits. | No |
| **`SAFETY_WARNING`** | Deterministic Safety | Non-critical advisory, drug-drug interaction warning, or missing allergy context flag. | No |
| **`EMERGENCY_DETECTED`** | Deterministic Safety | Critical clinical emergency or red-flag symptom detected. Immediate clinical escalation. | No |
| **`SAFETY_LOCKED`** | Deterministic Safety | Critical contraindication or hard-stop detected without valid physician override. Pipeline halted. | **Yes** |
| **`CLINICAL_OUTPUT_READY`** | Pipeline Lifecycle | Structured, safety-cleared consultation note (SOAP) ready for physician review. | No |
| **`FHIR_COMMIT_STARTED`** | Persistence | Atomic FHIR R4 Bundle commit initiated. | No |
| **`FHIR_COMMIT_COMPLETE`** | Persistence | FHIR resources persisted (Encounter, ClinicalImpression, Condition, Provenance). | No |
| **`AUDIT_COMPLETE`** | Governance | Tamper-evident SHA-256 cryptographic audit record sealed. | No |
| **`STREAM_COMPLETE`** | Terminal Success | End of stream; all requested stages successfully executed. | **Yes** |
| **`STREAM_ERROR`** | Terminal Failure | Pipeline failure, validation rejection, or unexpected server error. Stack traces scrubbed. | **Yes** |

---

## 4. Security & Isolation Architecture

1. **Strict Pre-Stream Authentication:**
   SSE stream endpoints reject unauthenticated requests immediately with HTTP 401. Sessions require a valid session Bearer token or development persona header (`x-proton-dev-persona`).
2. **Tenant & Patient Authorization:**
   Streams are strictly bound to server-authoritative tenant, authenticated actor, patient, and encounter. Cross-tenant and cross-patient requests fail closed with HTTP 403 before any SSE stream is opened.
3. **No Capability Surrender:**
   Knowing an opaque `streamId` is never sufficient to hijack or view a stream. Reconnection requires valid authentication matching the stream's original tenant and actor context.
4. **Zero PHI in Generic Identifiers or Logs:**
   Neither `streamId`, `eventId`, nor URL query parameters may contain patient names, MRNs, diagnosis descriptions, or medication lists.
5. **Deterministic Safety Priority:**
   AI-generated drafts are NEVER committed to FHIR prior to safety validation. If a critical contraindication occurs, `SAFETY_LOCKED` is emitted and the stream terminates before any FHIR transaction.
6. **Stack Trace Scrubbing:**
   `STREAM_ERROR` payloads contain standardized error codes and safe clinician-facing messages; stack traces, internal paths, and API keys are strictly scrubbed.

---

## 5. Connection Lifecycle & Transport Semantics

### Wire Format
Conforms to W3C Server-Sent Events standard:
```
event: <EVENT_TYPE>
id: <EVENT_ID>
data: <JSON_STRINGIFIED_ENVELOPE>

```

### Heartbeat / Keepalive
- The server emits a `HEARTBEAT` event every 15,000 ms of inactivity.
- Heartbeats increment sequence numbers monotonically but carry an empty payload.

### Disconnect & Cancellation
- When the client closes the connection (`req.on('close')`), the server aborts in-flight pipeline tasks, releases stream memory, and records a stream lifecycle audit entry.

### Inactivity Timeout
- Streams have a maximum hard idle timeout of 120,000 ms. If no client activity occurs within this window, the server terminates the stream with `STREAM_ERROR` (code: `STREAM_TIMEOUT`) and closes the connection.

### Reconnection & Replay
- Streams are single-consumer, short-lived pipeline execution channels. If a disconnect occurs during execution, clients can inspect the authoritative persistent encounter state rather than maintaining indefinite replay buffers. Bounded in-memory event buffers (maximum 50 events, TTL 5 minutes) support transient reconnects using `Last-Event-ID`.
