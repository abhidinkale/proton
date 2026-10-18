# PROTON JEV TYPED DECISION ARCHITECTURE

**Date:** 2026-10-18  
**Architecture Version:** Milestone 2  
**System:** Proton AI-Native Clinical Operating System

---

## 1. System Vision & Purpose

In Proton, Artificial Intelligence is divided into distinct, non-overlapping architectural layers:

```
                     PROTON AI SYSTEM
                          INPUT
                            │
                            ▼
                  Clinical Context Engine
                            │
                            ▼
                     ┌─────────────┐
                     │     JEV     │
                     │ Typed Logic │
                     └──────┬──────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
          ROUTING        CLASSIFY        GATING
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                   Specialist Orchestrator
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
          Cardiology     Neurology     Surgery
              │             │             │
              └─────────────┼─────────────┘
                            ▼
                   Generative Models
                            │
                            ▼
                     Clinical Draft
                            │
                            ▼
                       SafetyGate
                            │
                            ▼
                   Physician Review
                            │
                            ▼
                     Provenance
                            │
                            ▼
                     FHIR Persistence
```

### Tripartite Division of Responsibilities

1. **Jev (TypeSafe AI Layer):**
   - **Role:** High-speed, deterministic & calibrated probabilistic typed decision-making.
   - **Responsibilities:** Case routing, specialty candidate selection, triage urgency scoring, workflow state transitions, safety threshold verification.
   - **Boundary Invariant:** Never asked to write prose, patient dialogue, or long-form SOAP notes.
2. **Generative Models (ModelGateway Layer):**
   - **Role:** Complex narrative synthesis, speech-to-text transcript normalization, clinical draft drafting, multi-specialty differential explanation.
   - **Responsibilities:** Generating human-readable drafts for physician review.
   - **Boundary Invariant:** Draft outputs are strictly marked `status: 'DRAFT'` and `clinicianConfirmed: false`. Zero direct FHIR write privileges.
3. **Deterministic Code (Core Service Layer):**
   - **Role:** Non-negotiable mathematical, relational, and regulatory boundaries.
   - **Responsibilities:** Authorization (RBAC), tenant compartmentalization, dosage unit conversion, arithmetic, date math, database foreign keys, and FHIR schema validation.
   - **Boundary Invariant:** AI models can never override deterministic safety gates without an authenticated licensed physician directive.

---

## 2. Jev Primitives & Runtime Implementation

Proton's `JevAdapter` exposes three core primitives:

### 2.1 `choice<T>(question, options, context): Promise<{ choice, confidence, rationale, latencyMs }>`
- **Behavior:** Constrained discrete classification from an immutable set of candidate options $T \in \text{options}$.
- **Clinical Applications:**
  - Routing chief complaints to primary specialties (`'Cardiology'`, `'Neurology'`, `'Endocrinology'`, `'Internal Medicine'`).
  - Selecting encounter workflows (`'New Consultation'`, `'Chronic Disease Follow-up'`, `'Acute Escalation'`).
- **Fail-Closed Semantics:** Empty options or missing questions immediately throw `JevError(400)`. If confidence drops below 0.50, falls back to conservative General Internal Medicine.

### 2.2 `score(question, context): Promise<{ score, confidence, latencyMs }>`
- **Behavior:** Calibrated continuous probability scoring strictly bounded to $[0.0, 1.0]$.
- **Clinical Applications:**
  - Triage acuity scoring (e.g., crushing chest pain $\rightarrow 0.98$; routine refill $\rightarrow 0.15$).
  - Evidence relevance ranking in RAG document retrieval.
- **Fail-Closed Semantics:** Scores are clamped to $[0, 1]$. NaN or infinite values trigger immediate fail-closed rejection.

### 2.3 `noul(question, context): Promise<{ result, probability, latencyMs }>`
- **Behavior:** Binary assertion verification with calibrated posterior probability.
- **Clinical Applications:**
  - Multi-specialty presentation detection (identifying whether a case spans multiple organ systems).
  - Safety boundary pre-flight checks (evaluating whether a draft violates contraindications).
- **Fail-Closed Semantics:** If safety contraindications or allergies are detected in context, returns `result: false, probability: 0.12`.

---

## 3. Decision Control & State Transitions

Jev enforces typed output states for all clinical artifacts:

```
[ AI GENERATION ] ──> DRAFT ──> REVIEWED ──> EDITED ──> ACCEPTED / REJECTED / APPROVED
```

- Any attempt to bypass the `DRAFT` state or directly emit an `APPROVED` record from an AI service is rejected at the API boundary.
- State transitions to `ACCEPTED` or `APPROVED` strictly require an authenticated actor with role `physician`.

---

## 4. Failure Modes & Resilience Policy

| Failure Condition | Jev Response | System Action | Fabricated Clinical Result? |
|---|---|---|---|
| **Upstream Network Drop** | Throws `JevError('UPSTREAM_FAILURE')` | Fails closed; routes to conservative general triage | **NO** |
| **Timeout ($> 2500$ms)** | Abort signal triggered | Fails closed; notifies attending physician | **NO** |
| **Ambiguous Symptoms** | Calibrated confidence $< 0.50$ | Assigns conservative primary care differential; flags for review | **NO** |
| **Malformed Schema** | Throws `JevError('INVALID_INPUT')` | HTTP 400 Bad Request; logs immutable audit event | **NO** |
