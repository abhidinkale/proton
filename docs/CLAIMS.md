# Proton Claims Register & Regulatory Truthfulness Register

**Status:** Living register. Every marketing, UI, and documentation claim mapped to the code, test, and regulatory boundary that proves it.
**Regulatory Position:** Non-device Clinical Decision Support (CDS) under FDA 2022 CDS Guidance & India NMC Telemedicine Guidelines / CDSCO SaMD Framework.
**Hard Safety Invariant:** Clinician-in-the-loop on 100% of diagnostic confirmations and medication signatures. Autonomous diagnosis is explicitly banned.

---

## 1. Verified Claims (Allowlist)

| Claim ID | Claimed Statement | Grounding Code | Verification Test / Evidence |
| :--- | :--- | :--- | :--- |
| **CLM-001** | *“100% of signed clinical notes have a content-bound cryptographic attestation; flipping one character fails verification.”* | `apps/api/services/workflow/attestation.js` | `apps/api/tests/attestation_canonical_validation.cjs` |
| **CLM-002** | *“Daily audit chain root is anchored via external RFC 3161 Time-Stamp Authority (TSA) proof token.”* | `apps/api/services/workflow/rfc3161Anchor.js` | `apps/api/tests/attestation_ledger_validation.cjs` |
| **CLM-003** | *“Deterministic safety kernel enforces zero unsafe passes on published adversarial drug-drug and allergy rules.”* | `apps/api/services/safety/safetyGate.js` | `apps/api/tests/kernel_safety_v2_validation.cjs` |
| **CLM-004** | *“30-day clinical outcome cohort automatically tracks mature resolution rates, documented non-response, and published response rate.”* | `apps/api/services/clinical/outcomeWriter.js` | `apps/api/tests/outcome_loop_validation.cjs` |
| **CLM-005** | *“Patient check-ins reporting worsening symptoms or side effects trigger real-time escalation into clinician triage.”* | `apps/api/routes/patientSync.js` | `apps/api/tests/clinic_live_validation.cjs` |
| **CLM-006** | *“All primary diagnoses and prescriptions carry standardized SNOMED CT and RxNorm terminology before signing.”* | `apps/api/services/clinical/terminologyService.js` | `apps/api/tests/terminology_and_conformance_validation.cjs` |
| **CLM-007** | *“Every differential suggestion cites a verified guideline, PMID, executable criterion, or explicit NO_CRITERION_MET.”* | `apps/api/services/clinical/citationVerifier.js` | `apps/api/tests/evidence_grounding_criteria_validation.cjs` |
| **CLM-008** | *“Patient identity is derived strictly from signed server sessions; body.patientId and body.tenantId are never trusted.”* | `apps/api/middleware/patientAuth.js` | `apps/api/tests/route_auth_coverage_validation.cjs` |
| **CLM-009** | *“Tenant isolation is enforced across workflow state, outbox, and audit events.”* | `apps/api/services/workflow/encounterStateMachine.js` | `apps/api/tests/tenant_isolation_validation.cjs` |

---

## 2. Prohibited Claims & Regulatory Boundaries (Denylist)

The following terms and claims are prohibited across all UI strings, public marketing, and code comments:

1. **“Epic parity” / “Cerner parity”**: Proton is an ambient clinical intelligence and outcome spine, not a legacy enterprise billing/EHR suite.
2. **“Autonomous diagnosis” / “AI Doctor”**: Proton provides clinical decision support with transparent rationale; the licensed physician is the sole diagnostic authority.
3. **“Digital signature” without qualification**: Legal e-signatures fall under US ESIGN/UETA or India IT Act 2000 §3A (Aadhaar eSign/DSC). Proton provides content-bound cryptographic attestations and evidence chains.
4. **Uncalibrated confidence percentages**: The UI must never display pseudo-probabilities without calibration curves.
