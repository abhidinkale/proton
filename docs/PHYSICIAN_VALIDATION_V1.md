# Proton V1 — Controlled Physician Validation Framework

> **Status:** Premium Synthetic-Data Physician Validation Build  
> **Environment:** Controlled Synthetic Beta &bull; Strictly Fictional Patient Records &bull; No Real PHI  
> **Repository:** [https://github.com/abhijeetdinkale-arch/proton](https://github.com/abhijeetdinkale-arch/proton)  
> **Core Operating Principle:** `CAPTURE → DRAFT → VERIFY → PHYSICIAN REVIEW → APPROVE → REMEMBER`  
> **Clinical Authority:** Doctor remains the sole final clinical authority. Zero autonomous clinical actions.

---

## 1. Executive Summary & Purpose

Proton is an AI-native clinical copilot designed for outpatient and ambulatory physicians. The purpose of the **Version 1 Physician Validation** phase is to evaluate Proton's clinical ergonomics, deterministic verification safety gates, and AI drafting capabilities under realistic clinical simulation with **3–5 practicing physicians** using **strictly synthetic patient data**.

Proton operates under a strict non-autonomous clinical mandate:
- **No autonomous diagnosis**: Proton synthesizes draft assessment statements based solely on captured dialogue and confirmed history.
- **No autonomous prescribing**: All medication orders originate as unapproved drafts or AI suggestions requiring explicit physician verification, strength/dose confirmation, and electronic sign-off.
- **No silent FHIR writes**: Clinical notes, prescriptions, conditions, and observations are committed to the Medplum FHIR backend **only** upon explicit physician approval.
- **Zero real patient / PHI exposure**: All patient profiles, records, encounters, and documents are synthetic fixtures.

---

## 2. Physician Validation Checklist & Test Suite

The automated validation suite (`apps/web/tests/physician_validation_checklist.cjs`) enforces end-to-end operational integrity across all 11 core clinical requirements:

| # | Clinical Requirement | Verification Mechanism | Validation Status |
| :- | :------------------- | :--------------------- | :---------------- |
| **1** | **Calm Clinical UI & Authentication** | Low-contrast clinical theme, role-based physician login session | **PASS** |
| **2** | **Command Center 5-Tier Priorities** | Deterministic priority ranking (Safety &rarr; Unfinished &rarr; Follow-up &rarr; Docs &rarr; Recent) | **PASS** |
| **3** | **Global Command Palette (⌘K)** | Fast keyboard search & navigation across patients, consults, and reviews | **PASS** |
| **4** | **Patient Intelligence & "What Matters Today"** | Longitudinal summary, temporal change detection, and clickable clinical evidence | **PASS** |
| **5** | **Consultation Capture & AI Draft** | Real/simulated audio capture, structured SOAP note synthesis, clear AI draft labeling | **PASS** |
| **6** | **Physician Note Editing & Provenance** | Direct physician note editing with real-time transition to `Edited by physician` | **PASS** |
| **7** | **Deterministic Safety Verification** | Pre-approval blocking gates for missing fields and required warning acknowledgments | **PASS** |
| **8** | **Structured Prescription Workflow** | 5-field medication orders, AI suggestions, allergy cross-referencing, review sign-off | **PASS** |
| **9** | **Clinical Memory Proposals** | Post-encounter condition and medication changes require explicit accept/edit/reject | **PASS** |
| **10** | **Atomic FHIR Persistence** | Transactional commit of Encounter, ClinicalImpression, and MedicationRequests | **PASS** |
| **11** | **Review Center & Document Intake** | Dedicated review queue (`/review`) where nothing gets confirmed without physician sign-off | **PASS** |

---

## 3. Quantitative & Qualitative Evaluation Metrics

Participating clinicians evaluate the system across 5 structured dimensions:

### 1. Cognitive Load & Time-to-Understand (Target: < 15 seconds)
- **Metric**: Duration required for a physician to review the **Pre-Consultation Brief** and identify active clinical priorities, recent lab shifts (e.g. HbA1c increase), and documented allergies before speaking to the patient.
- **Evaluation Mechanism**: In-app scan test using synthetic patient Eleanor Vance (48y, Type 2 DM, HTN, Penicillin allergy).

### 2. Note Review & Edit Efficiency (Target: < 90 seconds)
- **Metric**: Time required to review the AI-synthesized SOAP note draft, correct any conversational nuances, and confirm accuracy.
- **Audit Tracking**: Session timing logged via `auditService.record('doctor_edited_note', ...)`.

### 3. Prescription Formulation & Safety Verification (Target: 100% adherence)
- **Metric**: Zero bypass of allergy conflicts (e.g. Amoxicillin vs Penicillin anaphylaxis risk) or missing mandatory dosage fields.
- **Enforcement**: UI blocks "Approve & Save" button whenever blocked checks exist; requires explicit acknowledgment checkbox for clinical warnings.

### 4. Memory Proposal Acceptance Rate
- **Metric**: Ratio of accepted vs. rejected memory proposals generated post-consultation.
- **Purpose**: Evaluates whether the AI proposes clinically sound longitudinal updates or creates noise that requires discarding.

### 5. Review Center Fact Verification
- **Metric**: Physician verification speed and precision across ingested lab reports, discharge summaries, and referral letters.
- **Requirement**: Unverified facts must display confidence score, original quote, and document provenance before persistence.

---

## 4. Clinician Setup & Protocol

1. **Environment Initialization**:
   ```bash
   # Ensure local Medplum FHIR backend and Proton API are running
   docker compose up -d
   npm run dev --prefix apps/web
   ```
2. **Accessing Proton**:
   - URL: `http://localhost:3001`
   - Test Credentials: `admin@example.com` / `medplum_admin`
3. **Synthetic Beta Demographics**:
   - Pre-loaded patients: Eleanor Vance (synthetic complex patient), Arthur Dent, etc.
   - Additional synthetic test patients can be generated instantly via the "Create Clinical Brain Demo Patient" button in the Patients Directory.
4. **Submitting Clinical Feedback**:
   - Following every consultation, the in-app **Physician Feedback Widget** prompts the clinician for a 1–5 star rating, qualitative clinical accuracy feedback, and correction categorization. All feedback is recorded to the audit trail.
