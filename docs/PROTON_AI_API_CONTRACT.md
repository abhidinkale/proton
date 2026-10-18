# PROTON AI API CONTRACT SPECIFICATION

**Date:** 2026-10-18  
**Architecture Version:** Milestone 2  
**System:** Proton AI-Native Clinical Operating System

---

## 1. Overview & Authentication

All Proton AI endpoints require authenticated actor context via `Authorization: Bearer <jwt>` or session headers. Actors carry `{ actorId, actorRole, actorName, tenantId }`.

Roles:
- `physician`: Full clinical authority, directive overrides, note approval, FHIR commit.
- `practitioner`: Mid-level clinician, routine note preparation.
- `operations_staff`: Non-clinical operations, task triage, scheduling confirmation.
- `system`: Automated background workers and event reconcilers.
- `patient`: Patient portal read/intake write only.

---

## 2. API Endpoints

### 2.1 `POST /api/ai/route`
Routes a clinical presentation to relevant specialist agents using Jev typed decisions.

**Request:**
```json
{
  "chiefComplaint": "Substernal chest pressure and dyspnea on exertion",
  "transcript": "Patient reports 2-week history of worsening exertional tightness...",
  "patientContext": {
    "patientId": "patient-102",
    "age": 58,
    "gender": "male"
  }
}
```

**Response (HTTP 200):**
```json
{
  "success": true,
  "count": 2,
  "routedSpecialists": [
    {
      "id": "cardiology.v1",
      "name": "Cardiology Clinical Intelligence Agent",
      "specialty": "Cardiology",
      "version": "1.0.0",
      "capabilities": ["arrhythmia_analysis", "coronary_risk_stratification"],
      "description": "Evaluates cardiovascular presentations..."
    },
    {
      "id": "internal-medicine.v1",
      "name": "Internal Medicine Clinical Intelligence Agent",
      "specialty": "Internal Medicine",
      "version": "1.0.0",
      "capabilities": ["multimorbid_synthesis", "polypharmacy_review"],
      "description": "Comprehensive adult medical care..."
    }
  ]
}
```

---

### 2.2 `POST /api/ai/specialists/run`
Executes designated or dynamically routed specialist agents in parallel with fault isolation.

**Request:**
```json
{
  "specialistIds": ["cardiology.v1", "endocrinology.v1"],
  "context": {
    "chiefComplaint": "Exertional chest pain and elevated fasting glucose",
    "patientId": "patient-102",
    "encounterId": "enc-994"
  },
  "timeoutMs": 3500
}
```

**Response (HTTP 200):**
```json
{
  "success": true,
  "count": 2,
  "assessments": [
    {
      "specialist": "Cardiology",
      "version": "1.0.0",
      "caseId": "enc-994",
      "confidence": 0.92,
      "clinicalConsiderations": [
        {
          "name": "Angina Pectoris",
          "supportingEvidence": "Retrosternal chest tightness on exertion",
          "status": "unconfirmed"
        }
      ],
      "supportingEvidence": ["Hypertension history"],
      "missingInformation": ["Recent troponin"],
      "contradictions": [],
      "suggestedQuestions": ["Does the pain radiate?"],
      "draftRecommendations": ["Order 12-lead ECG"],
      "uncertainty": "Requires objective stress testing for ischemia.",
      "provenance": {
        "provenanceId": "prov-1792267800-4b2a",
        "status": "DRAFT",
        "tamperHash": "3f8c...",
        "generatedAt": "2026-10-18T01:35:00Z"
      },
      "requiresPhysicianReview": true,
      "failed": false
    }
  ]
}
```

---

### 2.3 `POST /api/ai/synthesize`
Synthesizes multiple specialist assessments, preserving consensus, disagreements, and uncertainty.

**Request:**
```json
{
  "assessments": [ /* Array of Phase F specialist assessment objects */ ]
}
```

**Response (HTTP 200):**
```json
{
  "success": true,
  "synthesis": {
    "status": "COMPLETE",
    "synthesis": "Cross-Specialty Review uniting Cardiology and Endocrinology...",
    "consensus": [
      {
        "finding": "Elevated Cardiovascular Risk",
        "agreedBy": ["Cardiology", "Endocrinology"],
        "type": "CONSENSUS_DIAGNOSTIC_CONSIDERATION"
      }
    ],
    "disagreement": [
      {
        "finding": "Consider Metformin initiation",
        "proponent": "Endocrinology",
        "evidence": "HbA1c 8.2%",
        "type": "SPECIALIST_SPECIFIC_CONSIDERATION"
      }
    ],
    "missingInformation": ["Recent eGFR lab"],
    "evidence": ["Fasting glucose 154 mg/dL", "BP 142/88"],
    "uncertainty": "Diagnostic uncertainty present across 1 specialist considerations.",
    "participatingSpecialists": ["Cardiology", "Endocrinology"],
    "unavailableSpecialists": [],
    "requiresPhysicianReview": true
  }
}
```

---

### 2.4 `POST /api/ai/approve`
Physician review and cryptographic sign-off transition for an AI provenance draft.

**Role Required:** `physician`

**Request:**
```json
{
  "provenanceEnvelope": { /* Envelope object minted with status DRAFT */ },
  "physicianDirective": "Reviewed differential and verified diagnostic plan directly with patient.",
  "comments": "Signed in clinic."
}
```

**Response (HTTP 200):**
```json
{
  "success": true,
  "approvedEnvelope": {
    "provenanceId": "prov-1792267800-4b2a",
    "status": "APPROVED",
    "physicianId": "usr-md-clara-01",
    "physicianActionAt": "2026-10-18T01:36:10Z",
    "directiveOverride": "Reviewed differential...",
    "tamperHash": "9e1c..."
  }
}
```
