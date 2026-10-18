# PROTON SPECIALIST AGENT ARCHITECTURE & CROSS-SPECIALTY SYNTHESIS

**Date:** 2026-10-18  
**Architecture Version:** Milestone 2  
**System:** Proton Multi-Specialty Clinical Operating System

---

## 1. Architectural Principles

Proton is designed to scale from 4 to 100+ clinical specialty and subspecialty agents without modifying core orchestrator code, database schemas, or frontend layouts.

Key principles:
1. **Plugin-Style Registry:** Specialist agents are registered dynamically with explicit capability manifests, safety constraints, and model policies.
2. **Clinical Decision Support Only:** Specialist agents are advisors, not doctors. Misleading identities (`Dr. Name`) and autonomous system permissions (`FULL_SYSTEM_ACCESS`) are strictly prohibited at the registry boundary.
3. **Structured Output Contract:** Every specialist returns a strictly typed evaluation envelope carrying explicit provenance, confidence, and uncertainty.
4. **Fault Isolation:** Individual agent timeouts, crashes, or malformed responses do not corrupt or block sibling agents.
5. **Truthful Synthesis:** The multi-specialist synthesis layer explicitly highlights disagreements, opposing viewpoints, and missing data rather than artificially choosing a winner.

---

## 2. Specialist Definition Contract (Phase E)

Every registered specialist implements the following specification:

```typescript
interface SpecialistDefinition {
  id: string;                      // e.g. 'cardiology.v1'
  name: string;                    // e.g. 'Cardiology Clinical Intelligence Agent'
  displayName: string;             // e.g. 'Cardiology Clinical Intelligence'
  specialty: string;               // e.g. 'Cardiology'
  version: string;                 // e.g. '1.0.0'
  description: string;             // Clinical scope description
  inputSchema: object;             // JSON Schema for input context
  outputSchema: object;            // JSON Schema for structured considerations
  modelPolicy: {
    preferredModel: string;        // e.g. 'gemini-1.5-flash'
    fallbackModel?: string;        // e.g. 'medgemma-local'
    maxTokens: number;
    temperature: number;
  };
  capabilities: string[];          // e.g. ['arrhythmia_analysis', 'coronary_risk_stratification']
  safetyPolicy: {
    blockDirectPrescribing: true;  // Invariant
    requireAllergyVerification: boolean;
    maxDailyDoseCeiling: boolean;
  };
  evidencePolicy: {
    requireGuidelineCitations: boolean;
    allowUncertainty: boolean;
  };
  timeout: number;                 // e.g. 3500ms
  enabled: boolean;
  routingTags: string[];           // Evaluated by Jev router
  systemInstructions: string;      // Medical knowledge prompts
  tools: Array<{
    name: string;
    permission: AllowedPermission; // Scoped permissions (e.g. READ_LABS, DRAFT_NOTE)
  }>;
}
```

---

## 3. Production Specialist Plugins (Milestone 2 Baseline)

Proton seeds four canonical clinical specialists:
1. `cardiology.v1`: Cardiovascular disease, ischemic symptoms, ECG patterns, troponin evaluation, arrhythmia risk.
2. `neurology.v1`: Stroke triage (FAST criteria), headache classification, focal deficits, seizure evaluation, neuropathies.
3. `endocrinology.v1`: Glycemic optimization (HbA1c, glucose), thyroid panels (TSH, free T4), metabolic syndrome.
4. `internal-medicine.v1`: Multi-morbid synthesis, polypharmacy review, preventive care, diagnostic synthesis.

---

## 4. Specialist Output Contract (Phase F)

When executed, every specialist must return the canonical Phase F envelope:

```json
{
  "specialist": "Cardiology",
  "version": "1.0.0",
  "caseId": "enc-2026-10-18-001",
  "confidence": 0.88,
  "clinicalConsiderations": [
    {
      "name": "Coronary Artery Disease",
      "supportingEvidence": "Exertional retrosternal tightness relieved by rest",
      "status": "unconfirmed"
    }
  ],
  "supportingEvidence": [
    "Elevated LDL cholesterol (165 mg/dL)",
    "Resting ECG with non-specific ST-T changes"
  ],
  "missingInformation": [
    "Recent high-sensitivity troponin level",
    "Current exercise tolerance (METs)"
  ],
  "contradictions": [],
  "suggestedQuestions": [
    "Does the pain radiate to the left arm or jaw?",
    "Is there associated diaphoresis or nausea?"
  ],
  "draftRecommendations": [
    "Order resting 12-lead ECG and high-sensitivity troponin I",
    "Consider referral for exercise stress testing"
  ],
  "uncertainty": "Differential requires biomarker exclusion of acute coronary syndrome.",
  "provenance": {
    "provenanceId": "prov-1792267500-abc123",
    "status": "DRAFT",
    "tamperHash": "4a7f9b8c...",
    "generatedAt": "2026-10-18T01:30:00Z"
  },
  "requiresPhysicianReview": true
}
```

---

## 5. Multi-Specialist Synthesis & Conflict Preservation (Phase G)

When a case spans multiple specialties (e.g. chest pain with reflux symptoms):

```
       [ Router (Jev Choice / Noul) ]
                     │
       ┌─────────────┴─────────────┐
       ▼                           ▼
[ Cardiology.v1 ]          [ Gastroenterology.v1 ]
       │                           │
       └─────────────┬─────────────┘
                     ▼
            [ Synthesis Layer ]
```

The synthesis layer enforces five non-negotiable outputs:
1. **Consensus:** Findings supported by multiple specialties (e.g. *Coronary Artery Disease* considered by both).
2. **Disagreement:** Differential points championed by only one specialty (e.g. *Stable Angina* vs *GERD*).
3. **Missing Information:** Chart gaps identified across specialists (e.g. missing troponin or endoscopy).
4. **Evidence Spans:** Authoritative patient facts supporting each viewpoint.
5. **Uncertainty Rating:** Transparent disclosure of clinical ambiguity.

**Core Invariant:** The synthesis engine NEVER averages conflicting opinions or silences a dissenting specialist. All differing perspectives are presented side-by-side to the attending physician.
