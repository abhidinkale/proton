# PROTON MILESTONE 6 — OBSERVABILITY & AUDIT ARCHITECTURE

**Classification:** Security Architecture & Compliance Standard  
**System:** Proton AI-Native Multi-Specialty Clinical Operating System  
**Milestone:** 6 — Production Hardening, Security, Reliability & Clinical Integrity  

---

## 1. Compliance Mandate & Zero-PHI Logging Invariant

Under HIPAA (45 CFR § 164.312(b)) and SOC 2 Type II compliance standards, a clinical operating system must maintain comprehensive, immutable audit records of all system activities involving electronic Protected Health Information (ePHI).

Simultaneously, **operational logs and distributed telemetry streams must NEVER contain raw ePHI, clinical narrative transcripts, patient identifiable names, or model API keys.**

### Proton's Zero-PHI Invariant
Every telemetry event emitted by `logAiTelemetry` and `telemetryMiddleware` strictly sanitizes data:
- **Recorded:** Request ID, Trace ID, HTTP Method, Route Path, Status Code, Latency (ms), Token Usage Counts, Model Name, Provider Name, Tenant ID, and Actor Role.
- **Strictly Excluded:** Patient Names, MRNs, SSNs, Transcripts, Generated Notes, Medication Names, Diagnoses, Raw Audio Bytes, Image Blobs, and Authorization Bearer Tokens.

---

## 2. Cryptographic Tamper-Evident Audit Trail

For legal evidentiary defense and clinical malpractice audits, Proton implements an append-only, tamper-evident audit ledger in `apps/api/storage/auditRepository.js`.

### 2.1 Hash Chaining Mechanism
Each audit event is linked to its immediate predecessor via SHA-256 hash chaining:

$$H_0 = \text{"0000000000000000000000000000000000000000000000000000000000000000"} \quad \text{(Genesis Hash)}$$

$$H_i = \text{SHA-256}\Big( H_{i-1} \parallel \text{id}_i \parallel \text{timestamp}_i \parallel \text{tenantId}_i \parallel \text{actorId}_i \parallel \text{action}_i \parallel \text{patientId}_i \parallel \text{resultingState}_i \parallel \text{summary}_i \parallel \text{directive}_i \Big)$$

```sql
CREATE TABLE IF NOT EXISTS operational_audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  patient_id TEXT,
  target_resource_id TEXT,
  summary TEXT NOT NULL,
  previous_state TEXT,
  resulting_state TEXT,
  physician_directive TEXT,
  prev_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL
);
```

### 2.2 Root-to-Tip Chain Verification (`auditService.verifyChain`)
The verification algorithm reads all historical events sequentially for a given tenant from rowid 1 to $N$:
1. Checks that `event[i].prev_hash === event[i-1].current_hash`.
2. Recalculates the SHA-256 hash over event fields and verifies that `calculatedHash === event[i].current_hash`.
3. If an adversary or compromised database admin modifies any row's text or deletes an event, verification fails immediately, identifying `failingEventId` and `failingIndex`.

---

## 3. Observability & Verification Endpoints

Proton exposes two authenticated administrative endpoints for operational monitoring and regulatory audits:

### 3.1 Cryptographic Audit Verification
`GET /api/system/audit/verify?tenantId=org-default`
- **Required Role:** `physician`, `admin`, `system`, or `operations_staff`.
- **Response:**
```json
{
  "tenantId": "org-default",
  "verifiedAt": "2026-10-18T10:53:15.172Z",
  "valid": true,
  "totalEventsVerified": 142,
  "rootAnchor": "0000000000000000000000000000000000000000000000000000000000000000",
  "latestTipHash": "7c9e1f2b3a4d5e6f..."
}
```

### 3.2 Referential Data Integrity Scanner
`GET /api/system/integrity?tenantId=org-default`
- **Required Role:** `physician`, `admin`, `system`, or `operations_staff`.
- **Function:** Scans all stored FHIR resources across the tenant. Detects orphan Conditions (missing Patient reference), orphan MedicationRequests, broken Encounter pointers, and corrupted Provenance targets.
- **Response:**
```json
{
  "status": "HEALTHY",
  "tenantId": "org-default",
  "checkedAt": "2026-10-18T10:53:15.174Z",
  "counts": {
    "patients": 12,
    "encounters": 28,
    "conditions": 45,
    "medications": 32,
    "provenances": 28
  },
  "orphans": [],
  "inconsistencies": [],
  "warnings": []
}
```

---

## 4. Verification Evidence

Validated in `apps/api/tests/milestone6_security.cjs`:
- **Test 9.1:** Distributed correlation headers (`X-Request-Id` and `X-Trace-Id`) propagated and returned on every response (PASS).
- **Test 9.2:** `auditService.verifyChain` validates unbroken SHA-256 hash chain across all recorded operations (PASS).
- **Test 9.3:** Direct database tamper mutation (corrupted record insertion) detected immediately, failing chain verification at the exact sequence (PASS).
- **Test 8.1:** Data integrity scanner confirms 0 orphan conditions, 0 orphan medications, and 0 broken references (PASS).
