# ADR-002: Role and Boundaries of Jev in Proton Architecture

## Status
Accepted

## Context
Proton currently has `JevSafetyGuardrailService` in `apps/api/services/clinical/jevSafetyGuardrailService.js`, which evaluates medication suggestions against a pre-verified candidate pool with a 95% safety threshold.
However, the master build specification envisions Jev as one of Proton's major intelligence layers—specifically as a **typed decision engine** rather than a free-form narrative generator.
There is a risk that developers might mistakenly attempt to use Jev for long-form clinical prose (SOAP notes, patient instructions, consultation narratives) or conversely, use AI where deterministic code should be used.

## Decision
Establish strict architectural boundaries for Jev:
1. **Jev is a typed decision model (TypeSafe AI):**
   * Designed to answer constrained questions: `choice`, `score`, `noul` (yes/no probability).
   * Used for:
     * Specialty routing (*Which specialist agent is relevant?*)
     * Encounter classification (*Routine, urgent, emergency escalation*)
     * Multi-specialty detection (*Single specialty vs. multi-specialty*)
     * Evidence ranking (*Relevance of guideline sources*)
     * Safety & output quality gating (*Should draft be flagged for additional review?*)
2. **Jev must NOT be used to generate clinical prose:**
   * Narrative summaries, SOAP notes, patient instructions, and consultation narratives are delegated to generative LLMs (Gemini, MedGemma).
3. **Jev must NOT replace normal programming (CODE > AI):**
   * Deterministic logic (age calculation, date math, dosage arithmetic, unit conversion, FHIR schema validation, permissions, RBAC, DB integrity) must remain in deterministic code.
4. **Implement `JevAdapter`:**
   * Supports `choice`, `score`, and `noul` methods.
   * Provides both a live TypeSafe AI client adapter and a deterministic local mock adapter for offline CI/CD.

## Alternatives Considered
1. *Use a single large LLM for both decisions and text generation:* Rejected because LLMs have higher latency (1–3s vs <50ms for Jev), are non-deterministic, and frequently hallucinate unstructured routing tags.
2. *Keep Jev solely inside `medicationSuggestionAgent.js`:* Rejected because specialty routing and triage would then rely on brittle regex or slow general LLM calls.

## Why This Decision
* Combines sub-50ms typed decision routing with expressive generative clinical summaries while ensuring deterministic safety rules remain completely rigid.

## Risks & Mitigations
* *Risk:* Jev service unavailability or network partition.
* *Mitigation:* Fail closed. Route ambiguous cases to `General Clinical Review Required` / `Internal Medicine` and mark safety probability as unverified (0.0), never silently approving a draft.

## Migration Strategy
1. Wrap existing `jevSafetyGuardrailService.js` under the new `JevAdapter`.
2. Introduce typed methods (`choice`, `score`, `noul`).
3. Connect `JevAdapter` into the `SpecialistAgentRegistry` routing pipeline.

## Testing Strategy
* Adversarial routing tests (ambiguous symptoms, multi-specialty cases).
* Failure tests (upstream timeout, malformed response, low confidence fallback).
