# PROTON SAFETY PATH AUDIT & ARCHITECTURAL VERIFICATION

**Date:** 2026-10-18  
**Auditor:** Antigravity AI  
**Scope:** Exhaustive code verification of all intelligence and persistence paths, proving the existence of exactly ONE non-bypassable safety path: `AI draft → SafetyGate → physician approval → provenance → FHIR persistence`.

---

## 1. Single Mandatory Safety Path Architecture

In Proton, autonomous AI writes to consequential clinical resources (Prescriptions, Diagnoses, Procedures, CarePlans) are architecturally prohibited.

The canonical flow is strictly linear and unidirectional:

```
[ AI Models / Specialists / Jev ]
               │
               ▼ (Status: DRAFT / UNCONFIRMED)
        [ SafetyGate ]
               │  (Deterministic Allergy, DDI, Dose Checks)
               ▼
      [ Physician Review ]
               │  (Licensed Attending Clinician Signature)
               ▼
     [ Provenance Seal ]
               │  (Cryptographic SHA-256 Tamper Envelope)
               ▼
    [ FHIR Atomic Commit ]
                  (Medplum R4 Transaction Bundle)
```

### Invariant Audit: Zero Secondary Bypass Paths
Every potential vector for clinical recommendation generation was audited:

1. **Direct Model Calls (`apps/api/providers/*`):**
   - The provider adapters (`geminiProvider`, `deepseekProvider`, etc.) return raw strings or parsed JSON. None of them possess Medplum/FHIR client tokens or database persistence logic. They can only return strings to the calling service.
2. **Medication Suggestion Agent (`apps/api/agents/medicationSuggestionAgent.js`):**
   - Employs Open Targets and Jev safety guardrails to rank candidate drugs. All output items are marked `status: 'PROPOSED_BY_AI'` and `clinicianConfirmed: false`. They cannot be committed without physician review.
3. **Specialist Agents (`apps/api/agents/registry/*`):**
   - The registry enforces a read-only execution contract. Specialist agents return structured draft envelopes (`PROVISIONAL_DRAFT`). They have zero network or disk access to FHIR endpoints.
4. **Encounter FHIR Persistence (`apps/api/services/fhir/fhirService.js`):**
   - `buildEncounterBundle` enforces that only `confirmedConditions` and `confirmedPrescriptions` generate active FHIR resources (`Condition` with `clinicalStatus: active`, `MedicationRequest` with `status: active`). Unconfirmed AI suggestions are either omitted from active resources or formatted strictly within the human-readable Consultation Note text (`DocumentReference` / narrative).

---

## 2. FHIR Safety Trace by Clinical Domain

| Clinical Domain | AI Output State | SafetyGate Check | Physician Review Required? | FHIR Resource Target | Direct AI Write Possible? |
|---|---|---|---|---|---|
| **Medications** | Draft Proposal | Allergy, DDI, Dose Ceiling | **YES** (Physician signature) | `MedicationRequest` | **NO** (Blocked by `fhirService` & `SafetyGate`) |
| **Diagnoses** | Suggested Differential | `verifyConditionGate` | **YES** (Physician confirmation) | `Condition` | **NO** (Unconfirmed kept as `provisional`/note only) |
| **Investigations / Orders** | Draft Recommendation | Evidence & Guideline Check | **YES** (Physician sign-off) | `ServiceRequest` | **NO** |
| **Treatment Plans** | Draft Narrative | Contraindication Review | **YES** (Physician sign-off) | `CarePlan` / `ClinicalImpression` | **NO** |
| **Allergies** | Proposed Discovery | Cross-reference check | **YES** (Physician confirmation) | `AllergyIntolerance` | **NO** |

---

## 3. Wrong-Patient Protection Verification

Proton enforces a **Fail-Closed** policy on any patient identity anomaly:

1. **Context Mismatch:** If an incoming request specifies `patientId: "patient-A"`, but any child prescription or intake payload contains `patientId: "patient-B"`, `validateInput()` immediately throws `ClinicalPipelineError('VALIDATION', 'PATIENT_ID_MISMATCH')` with HTTP 400.
2. **Cross-Tenant Isolation:** If an actor from `tenant-A` attempts to access a resource from `tenant-B`, `ClinicalContextEngine` and `clinicalPipeline` throw `CROSS_TENANT_ACCESS_DENIED` with HTTP 403.
3. **Zero Inference Rule:** The system NEVER attempts to "guess" or "reconcile" mismatched patient IDs. An ID mismatch results in immediate execution termination and an immutable audit log entry.

---

## 4. Provider Failure & Degraded Mode Behavior

The failure matrix for all AI providers (`ModelGateway`, `JevAdapter`, `aiService`) is strictly designed to prevent synthetic fabrication:

| Failure Mode | Raw Condition | System Response | Fabricated Clinical Result? |
|---|---|---|---|
| **Timeout** | Model latency $> 10000$ms | Fails closed with `ModelGatewayError: MODEL_TIMEOUT` (HTTP 504) | **NO** |
| **HTTP 401 / 403** | Invalid or expired API credentials | Fails closed with `AUTH_CONFIGURATION_ERROR` | **NO** |
| **HTTP 429** | Provider rate limit exceeded | Fails closed with `PROVIDER_RATE_LIMITED` | **NO** |
| **HTTP 500 / 503** | Provider cloud outage | Fails closed with `PROVIDER_UNAVAILABLE` | **NO** |
| **Malformed JSON** | Invalid response syntax | Throws `AI_SCHEMA_VALIDATION_FAILED` (HTTP 502) | **NO** |
| **Empty / Partial String** | Blank or truncated note | Throws `EMPTY_GENERATION_ERROR` (HTTP 502) | **NO** |
| **Jev Service Down** | Local/remote Jev unreachable | Degrades to fail-closed deterministic error or offline rule gate | **NO** |

---

## 5. Specialist Failure & Disagreement Semantics

When multiple specialist agents are invoked:
1. **Fault Isolation:** If Specialist B times out, Specialist A and Specialist C remain valid. Specialist B is marked `status: 'UNAVAILABLE'`.
2. **No Data Fabrication:** The synthesis layer NEVER invents findings on behalf of an unavailable specialist.
3. **Disagreement Preservation:** When Cardiology recommends Drug X and Nephrology warns against Drug X due to renal impairment, the synthesis layer records both under `conflicts` and `disagreements`. It does NOT average or pick a winner.
4. **Visible Uncertainty:** If evidence is lacking, the finding is explicitly tagged `status: 'INSUFFICIENT_INFORMATION'`.

---

## 6. Provenance Integrity & Tamper Protection

1. **Cryptographic Sealing:** Every draft generated by the pipeline is sealed with a SHA-256 tamper hash computed over the agent ID, model ID, timestamp, input digest, and draft content digest.
2. **Tamper Invalidation:** Any programmatic edit to `draftPayload` alters the draft content digest, causing `tamperHash` verification to fail.
3. **Physician Re-signature:** An edited draft cannot be persisted using the original AI provenance envelope. The physician must review the modified text and execute an explicit sign-off, which generates a new `REVIEWED` or `APPROVED` provenance envelope.

---

## 7. Diagnosis Semantics & Modality Preservation

Proton distinguishes between definitive and tentative clinical language. The AI pipeline is architecturally prevented from collapsing these distinctions:

- **"Possible pneumonia"** $\rightarrow$ Tagged `provisional`, `certainty: POSSIBLE`. Never committed as active confirmed condition.
- **"Consider pneumonia"** $\rightarrow$ Tagged `differential_consideration`.
- **"Rule out pneumonia"** $\rightarrow$ Tagged `workup_required`.
- **"History of pneumonia"** $\rightarrow$ Tagged `historical_inactive`.
- **"No evidence of pneumonia"** $\rightarrow$ Tagged `pertinent_negative`.

---

## 8. Audit Conclusion

The Proton codebase exhibits **exactly ONE safety path**. There are no backdoors, no autonomous FHIR commit bypasses, and no synthetic fallback generators that could fabricate unverified clinical care.
