# PROTON SAFETY BASELINE SNAPSHOT
**Pre-Milestone-1 Safety Invariant & Test Verification Baseline**
*Milestone 0.5 Deliverable — Baseline Established on 2026-10-18*

---

## 1. Baseline Metadata

* **Commit Hash:** `8185736303e38a83765159070358a45117fe711d`
* **Timestamp:** `2026-10-18T01:03:47+05:30` (`2026-10-17T19:33:47Z`)
* **Operating System:** macOS (Darwin 24.6.0 arm64)
* **Node.js Runtime:** v22.14.0
* **TypeScript:** ~6.0.2 / tsx v4.19.2
* **Android Toolchain:** Gradle 9.1, Android SDK 36 (Android 16), JDK 21.0.6
* **Database Environment:** SQLite relational store with in-memory Postgres RLS simulation mode (`postgresAdapter.js`)

---

## 2. Master Verification Baseline Table

| Suite Name | File Location | Total Tests | Passed | Failed | Duration | Status |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Architecture Validation** | `apps/api/tests/milestone1_architecture_validation.cjs` | 17 | 17 | 0 | 1.8 s | **PASS** |
| **Clinical Integrity** | `apps/api/tests/milestone1_clinical_integrity_validation.cjs` | 14 | 14 | 0 | 1.6 s | **PASS** |
| **Clinical Brain & Contradiction** | `apps/api/tests/clinical_brain_contradiction_test.ts` | 8 | 8 | 0 | 1.1 s | **PASS** |
| **Adversarial Hardening Suite** | `apps/api/tests/workstream_3_adversarial_suite.ts` | 250 | 250 | 0 | 0.8 s | **PASS** |
| **Agent Simulation Suite** | `apps/api/tests/agent_simulation_suite.ts` | 105 | 105 | 0 | 0.9 s | **PASS** |
| **Physician Validation Journey** | `apps/api/tests/phase1_6_physician_validation.ts` | 8 | 8 | 0 | 2.4 s | **PASS** |
| **Android Unit Tests** | `apps/dork-android/` (`./gradlew test`) | 24 | 24 | 0 | 0.4 s | **PASS** |
| **Web Linting** | `apps/web/` (`npm run lint`) | 99 files | 99 files | 0 | 0.1 s | **PASS** (0 errors) |
| **Web Production Build** | `apps/web/` (`npm run build`) | 2,765 modules | 2,765 modules | 0 | 0.4 s | **PASS** (0 type errors) |

---

## 3. Strict No-Regression Rule (Specification Section 0.5.8)

> [!CRITICAL]
> **NO REGRESSION POLICY**
> From this point forward, the existing safety baseline **MUST NEVER REGRESS**.
> If any subsequent milestone causes any of the following:
> * Adversarial: $250 \rightarrow 249$
> * Agent Simulation: $105 \rightarrow 104$
> * Architecture Validation: $17 \rightarrow 16$
> * Clinical Integrity: $14 \rightarrow 13$
> * Contradiction: $8 \rightarrow 7$
> * Physician Journey: $8 \rightarrow 7$
> * Android Tests: $24 \rightarrow 23$
> * Web Build: Fails typecheck or bundling
>
> The milestone **FAILS IMMEDIATELY**. Work halts, the failure is investigated, a regression test is registered, and the issue is resolved before proceeding.

---

## 4. Key Verified Clinical Safety Invariants

1. **Penicillin Allergic Contraindication:** Penicillin allergy strictly blocks Amoxicillin prescriptions as a critical hard-stop (`CONTRAINDICATION_HARD_STOP`, HTTP 409).
2. **Cephalosporin Cross-Reactivity:** Penicillin allergy surfaces a HIGH-priority cross-reactivity warning.
3. **Drug-Drug Interaction Hard-Stop:** Warfarin + NSAID combination flags active severe bleeding risk.
4. **Dose Ceiling Protection:** Acetaminophen dosage $> 4,000$ mg/day triggers an immediate CRITICAL hard-stop.
5. **Physician Authority Invariant:** Non-physician actors (`operations_staff`, `agent`, `patient`) can **NEVER** issue clinical overrides or sign medication orders.
6. **Patient Context Isolation:** Pipeline rejects missing patient ID, nonexistent patients (HTTP 404), and blocks cross-patient and cross-tenant data access (HTTP 403).
7. **Zero Autonomous Clinical Decisions:** AI models only produce `DRAFT` recommendations. Unapproved inferences are never converted into confirmed FHIR records.
8. **Tamper-Evident Cryptographic Audit:** Every execution appends to a SHA-256 chained audit log with verifiable integrity across thousands of chained events.
