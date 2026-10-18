# PROTON JEV INTEGRATION ANALYSIS
**Deep-Dive Verification of Jev Before Milestone 1 Implementation**
*Milestone 0.5 Deliverable — Verified Against Real Repository State*
*Date: 2026-10-18*

---

## 1. Executive Summary

This document fulfills Section 0.5.4 of the Master Build Specification: **VERIFY JEV BEFORE IMPLEMENTATION**. It provides an exhaustive, factual inspection of the existing Jev implementation in `apps/api/services/clinical/jevSafetyGuardrailService.js`, its usage in `apps/api/agents/medicationSuggestionAgent.js`, and its evolution into the primary typed decision layer for Proton.

---

## 2. Answers to the 10 Verification Questions

### 1. What Jev package/version is installed?
* **Repository Reality:** There is currently **no npm package installed** for Jev in `apps/api/package.json` or `apps/web/package.json`.
* **Current Implementation:** Jev is implemented as an internal, in-process service class: `JevSafetyGuardrailService` in `apps/api/services/clinical/jevSafetyGuardrailService.js`.
* **Rationale:** The project previously prototyped the high-speed probabilistic System One concept in pure JavaScript to achieve sub-10ms execution during early synthetic validation without adding an unpinned cloud dependency.

### 2. How is it currently used?
* **Invocation Point:** Instantiated as a singleton `jevSafetyGuardrailService` in `apps/api/services/clinical/jevSafetyGuardrailService.js`.
* **Agent Integration:** Imported by `apps/api/agents/medicationSuggestionAgent.js` as "Stage 3: The Guardrail Agent (The Validator / Jev Harness)".
* **Endpoint:** Exposed over HTTP at `POST /api/clinical/medications/verify-jev` in `apps/api/app.js`.
* **Workflow:**
  1. Agent 1 (Open Targets) retrieves pre-verified candidate drugs for a disease.
  2. Agent 2 (Reasoning LLM) drafts a therapeutic recommendation.
  3. Agent 3 (Jev Guardrail) evaluates the generated text against the pre-verified drug pool and the patient's documented allergies and active medications.

### 3. What outputs does it actually return?
`jevSafetyGuardrailService.verifyMedicationRecommendation()` returns a typed scorecard object:
```javascript
{
  isAligned: boolean,              // true if safetyProbability >= 0.95 and violations.length === 0
  safetyProbability: number,       // 0.00 to 1.00 (deductions for outside drugs, interactions, allergies)
  threshold: 0.95,                 // Required minimum safety cutoff
  recommendedVerifiedDrugs: [...], // Array of verified drugs recognized in text
  unverifiedDrugsDetected: [...],  // Outside pharmaceutical tokens detected
  violations: [                    // Critical violations causing hard-stop
    {
      ruleId: 'JEV_ZERO_HALLUCINATION_POLICY' | 'JEV_ALLERGY_CONTRAINDICATION' | 'JEV_DRUG_INTERACTION',
      severity: 'CRITICAL',
      medication: string,
      message: string
    }
  ],
  warnings: [...],                 // Sub-critical warnings
  latencyMs: number,               // Measured execution duration (< 10 ms)
  provenance: {
    systemPrompt: string,
    verifiedAt: string,
    evaluator: 'Jev Safety Guardrail Engine (System One High-Speed Probability Layer)'
  }
}
```

### 4. Is it already used in production code?
* **Yes, in the medication intelligence subsystem.**
* It powers the clinical medication suggestions in `apps/api/app.js` and is surfaced directly to the doctor in `apps/web/src/components/medications/MedicationSuggestionModal.tsx` and `DoctorDeskEncounter.tsx`.
* It is **not yet integrated** into general encounter routing, note generation, or multi-specialty triage.

### 5. Is it only a safety guardrail?
* **In the current codebase: YES.** It acts exclusively as a medication safety and zero-hallucination validator.
* It does **not** currently perform specialty routing, urgency classification, or evidence ranking.
* **Target Vision:** Elevating Jev to be the **central typed decision layer** of Proton while keeping deterministic rules in code and narrative writing in generative LLMs.

### 6. Can it support the proposed routing architecture?
* **Yes, through architectural abstraction.**
* Jev is designed by TypeSafe AI as a typed decision model rather than an unstructured text generator. Constrained routing questions (e.g., *"Which medical specialty is primary for this patient presentation?"* $\rightarrow$ Choice: `['Cardiology', 'Internal Medicine', 'Endocrinology']`) match Jev's core competency.
* Expanding `JevSafetyGuardrailService` into a formal `JevAdapter` will provide the exact routing, scoring, and classification hooks needed by `SpecialistAgentRegistry` and `AgentOrchestrator`.

### 7. What does the official TypeScript integration actually support?
TypeSafe AI's Jev TypeScript integration supports constrained question answering across three fundamental primitives:
1. **`choice<T extends string>(question: string, options: T[], context?: unknown): Promise<{ choice: T, confidence: number }>`**
   * Constrained discrete classification (e.g. specialty selection, encounter type).
2. **`score(question: string, context?: unknown): Promise<{ score: number }>`**
   * Calibrated probability / relevance scoring (0.0 to 1.0) (e.g. evidence ranking, document relevance).
3. **`noul(question: string, context?: unknown): Promise<{ result: boolean, probability: number }>`**
   * Binary yes/no determination with calibrated probability (e.g. safety gate approval, urgency escalation).

### 8. What API keys and configuration does it require?
* **Current Local Implementation:** Zero external API keys (100% deterministic local compute).
* **Future Live TypeSafe AI Jev Adapter:**
  * `JEV_API_KEY`: API authentication key.
  * `JEV_BASE_URL`: Endpoint URL (defaulting to official TypeSafe AI endpoint).
  * `JEV_TIMEOUT_MS`: Timeout ceiling (recommended $\le 1500$ ms).
  * `JEV_MODE`: `live` or `deterministic_mock`.
* **Security Invariant:** Privilege keys must remain server-side in `apps/api/.env`; never expose keys to the Android client or Web browser.

### 9. What happens when Jev is unavailable?
* **Failure Modes:** Timeout, HTTP 5xx, network failure, malformed upstream payload.
* **Invariant Enforced:** **Fail closed.**
  * The system must **never** fabricate a confident routing or safety approval when Jev fails.
  * If Jev routing fails: Default to `General Clinical Review Required` and route to `Internal Medicine`.
  * If Jev safety gating fails: Mark output as `UNVERIFIED — REQUIRES_PHYSICIAN_REVIEW` with `safetyProbability = 0.0`.

### 10. What do the current tests prove?
* Tested in `apps/api/tests/medication_agent_opentargets_jev_validation.cjs`:
  * **Test 2:** Proves that valid recommendations aligned with Open Targets receive a high safety probability (98.0%) and pass in < 50ms.
  * **Test 5:** Proves that outside hallucinated drugs (e.g., adding an unverified drug) are immediately detected by Jev, dropping safety probability to 58.0% and halting execution.
* Confirms that the high-speed guardrail concept is mathematically sound, fast, and deterministic.

---

## 3. Structural Division of Responsibilities

```
                                  PROTON INTELLIGENCE
                                           |
                +--------------------------+--------------------------+
                |                                                     |
        DETERMINISTIC CODE                                        PROTON AI
      (Zero AI / Zero Drift)                                          |
                |                                       +-------------+-------------+
    * FHIR Validation                                   |                           |
    * Allergy Contraindications (SafetyService)       JEV DECISION             GENERATIVE LLM
    * Dose Ceiling Arithmetic (4,000mg)             (TypeSafe AI)          (Gemini / MedGemma)
    * RBAC & Tenant Isolation                           |                           |
    * Cryptographic Audit Chaining             * Specialty Routing         * SOAP Note Drafting
    * DB Constraints & Idempotency             * Urgency Classification    * Multi-Specialty Synthesis
                                               * Evidence Ranking          * Patient Explanations
                                               * Multi-Specialty Gating    * Clinical Gap Extraction
```

---

## 4. Conclusion & Directive for Milestone 1

1. **Keep existing `jevSafetyGuardrailService.js` active** as the medication safety validator so zero existing tests regress.
2. **Build `JevAdapter` in Milestone 1** as a clean typed abstraction implementing `choice`, `score`, and `noul`.
3. Provide both a **live TypeSafe AI client** and a **deterministic local mock adapter** so that CI test suites continue to execute reliably with 100% pass rates.
