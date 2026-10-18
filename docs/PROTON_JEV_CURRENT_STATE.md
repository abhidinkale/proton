# PROTON JEV CURRENT-STATE ARCHITECTURAL ANALYSIS

**Date:** 2026-10-18  
**Auditor:** Antigravity AI  
**Scope:** In-depth inspection of Jev / TypeSafe AI integration, runtime primitives, production usages, limitations, and recommended abstractions.

---

## 1. Actual Discovered API

The repository contains two complementary Jev layers:
1. `apps/api/services/clinical/jevSafetyGuardrailService.js` — The deterministic & probabilistic System 1 safety guardrail evaluating drug candidate recommendations against Open Targets pre-verified pools and chart contraindications.
2. `apps/api/services/ai/jevAdapter.js` — The unified typed decision adapter implementing TypeSafe AI's core primitives (`choice`, `score`, `noul`) with dual-mode support (live REST API client and deterministic calibrated local engine).

### Public Interface:
```typescript
interface JevAdapter {
  choice<T>(question: string, options: T[], context?: object): Promise<{
    choice: T;
    confidence: number;
    rationale: string;
    latencyMs: number;
  }>;

  score(question: string, context?: object): Promise<{
    score: number;       // Calibrated float [0.0, 1.0]
    confidence: number;
    latencyMs: number;
  }>;

  noul(question: string, context?: object): Promise<{
    result: boolean;
    probability: number; // Calibrated float [0.0, 1.0]
    latencyMs: number;
  }>;
}

interface JevSafetyGuardrailService {
  verifyMedicationRecommendation(params: {
    generatedText: string;
    preVerifiedDrugs: Array<object>;
    patientProfile: object;
  }): {
    isSafe: boolean;
    safetyProbability: number;
    hardStop: boolean;
    recommendedDrugs: Array<object>;
    violations: Array<object>;
    warnings: Array<object>;
    latencyMs: number;
  };
}
```

---

## 2. Discovered Primitives & Supported Semantics

| Primitive | Method | Semantics & Implementation | Fail-Closed Policy |
|---|---|---|---|
| **choice** | `jevAdapter.choice(q, opts, ctx)` | Strictly constrained discrete classification from a bounded candidate set $T \in \text{options}$. Evaluates clinical tokens and symptom patterns. | Missing question or empty options throws `JevError('INVALID_INPUT' / 'INVALID_OPTIONS')`. Ambiguous cases default to conservative general internal medicine. |
| **score** | `jevAdapter.score(q, ctx)` | Calibrated continuous scoring in $[0.0, 1.0]$. Used for urgency evaluation, evidence relevance ranking, and risk level assignment. | Out-of-bounds scores are strictly clamped $[0, 1]$. Missing input throws `JevError(400)`. |
| **noul** | `jevAdapter.noul(q, ctx)` | Binary assertion verification with calibrated posterior probability. Used for multi-specialty detection and safety boundary verification. | If safety context has contraindications or allergies, returns `result: false, probability: 0.12`. |
| **schemas** | Input validation | Runtime validation on input types; arrays and strings strictly checked before execution. | Malformed schema rejected before upstream dispatch. |
| **confidence** | `confidence` property | Returns calibrated confidence ratings (e.g. $0.94, 0.78, 0.45$). | Low confidence ($< 0.50$) triggers fallback to general internal medicine or manual physician review. |
| **errors** | `JevError` | Structured error class carrying HTTP status, error code, and metadata details. | All upstream HTTP errors ($401, 403, 429, 500, 502$) fail closed. |

---

## 3. Current Production Usage

1. **Autonomous Medication Intelligence:**
   - `apps/api/agents/medicationSuggestionAgent.js`: Evaluates generated pharmacological drafts against Open Targets pre-verified candidates using `jevSafetyGuardrailService.verifyMedicationRecommendation()`.
   - `POST /api/clinical/medications/verify-jev`: Exposes high-speed System 1 verification directly for client/frontend pre-flight checks.
2. **Clinical Decision Orchestration:**
   - `apps/api/agents/registry/agentOrchestrator.js`: Utilizes `jevAdapter.choice()` and `jevAdapter.noul()` to classify incoming clinical cases and route them to relevant specialists (`cardiology`, `neurology`, `endocrinology`, `internal-medicine`).
   - `apps/api/services/ai/modelGateway.js`: Routes high-speed classification calls (`decide()`) to `jevAdapter`.

---

## 4. Current Limitations

1. **Not a Generative Engine:** Jev cannot and must not generate free-text SOAP notes, narrative patient discharge instructions, or conversational replies. Doing so violates the typed decision contract.
2. **Deterministic Code Primacy:** Jev cannot replace deterministic code for arithmetic, date calculations, dosage unit conversions, or FHIR bundle construction.
3. **No Direct FHIR Mutation:** Jev decisions cannot autonomously commit resources to Medplum without physician review and cryptographic provenance.

---

## 5. Recommended Proton Abstraction

- **Keep and Wrap `JevAdapter`:** `JevAdapter` is the clean, idiomatic TypeSafe AI abstraction. It wraps both live remote endpoints and deterministic local engines seamlessly.
- **Do NOT create a third Jev abstraction.**
- Standardize all routing, classification, and scoring in Milestone 2 on `jevAdapter` and integrate its outputs into `AgentOrchestrator` and `/api/ai/route`.
