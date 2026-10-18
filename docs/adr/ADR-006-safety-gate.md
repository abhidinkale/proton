# ADR-006: Unified Safety Gate & Clinical Approval Boundary

## Status
Accepted

## Context
Proton has proven, highly battle-tested safety mechanisms:
1. `SafetyService` in `apps/api/services/safety/safetyService.js`: Deterministic hard-stops for drug allergies, cross-reactivity, drug interactions, and dosage ceilings.
2. `JevSafetyGuardrailService` in `apps/api/services/clinical/jevSafetyGuardrailService.js`: 95% safety cutoff and zero-hallucination drug verification.
3. `ClinicianConfirmationService` and RBAC middleware in `apps/api/middleware/rbac.js`: Non-physicians cannot sign prescriptions or commit clinical actions.

However, as we add the new `SpecialistAgentRegistry`, `AgentOrchestrator`, and external model providers, there is a serious risk that a new execution path might bypass these safety checks (e.g. an agent writing directly to FHIR or presenting an unverified recommendation).

## Decision
Create a unified `SafetyGate` in `apps/api/services/safety/safetyGate.js`:
1. **Mandatory Single Gateway for All Clinical Outputs:**
   * **No clinical output (prescriptions, diagnoses, orders, care plans) may be returned to the physician UI or committed to FHIR without passing through `SafetyGate.verify()`**.
   * It enforces:
     ```
     AI Agent Output
           ↓
     Deterministic SafetyService (Allergy, DDI, Max Dose)
           ↓
     Jev Probabilistic Guardrail (95% Safety Threshold, Zero-Hallucination)
           ↓
     Missing Context Checks (Unknown vs. Safe)
           ↓
     ClinicalApprovalGate (Physician Review & Sign-Off)
           ↓
     FHIR Persistence
     ```
2. **Absolute Gating Invariants:**
   * **Delegation to Existing Safety:** `SafetyGate` delegates directly to existing `SafetyService` and `JevSafetyGuardrailService`. It does **NOT** replace them with duplicate rules.
   * **No Second Path:** Bypassing `SafetyGate` to persist to FHIR is architecturally prohibited.
   * **Missing Data Is Not Safe:** If allergy or medication data is unavailable, status is flagged `UNKNOWN / MISSING_CONTEXT`, never `SAFE`.
   * **Physician Authority:** Critical contraindications require explicit, documented physician directive overrides ($\ge 10$ chars). All non-physician override attempts are rejected with HTTP 403.

## Alternatives Considered
1. *Replace `SafetyService` with a new LLM-based safety checker:* Strictly rejected. Deterministic safety rules (penicillin cross-reactivity, 4,000mg acetaminophen limit) must remain 100% deterministic code.
2. *Rely on individual agents to self-police safety:* Strictly rejected. An agent may hallucinate; safety enforcement must be external and mandatory.

## Why This Decision
* Preserves 100% of existing safety tests (`milestone1_architecture_validation.cjs`, `milestone1_clinical_integrity_validation.cjs`, `workstream_3_adversarial_suite.ts`).
* Guarantees zero regression while scaling the multi-specialty agent network.

## Risks & Mitigations
* *Risk:* Multiple safety layers add cumulative latency.
* *Mitigation:* `SafetyService` executes in $< 2$ ms, and Jev guardrails execute in $< 15$ ms. Total safety overhead is $< 20$ ms.

## Migration Strategy
1. Construct `SafetyGate` encapsulating `SafetyService` and Jev guardrails.
2. Wire `ClinicalPipeline` Stage 5 and `AgentOrchestrator` through `SafetyGate`.
3. Keep all existing safety tests passing.

## Testing Strategy
* Adversarial suite replay (250 tests).
* Hallucination test cases (missing allergies, fake lab values).
* Unauthorized bypass attempts (frontend spoofing, non-physician overrides).
