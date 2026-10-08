# Proton V1 — Product Specification & Architecture Guide

> **Proton Version:** 1.0.0-beta (Physician Productization Build)  
> **Classification:** Premium Synthetic-Data Physician Validation Build  
> **Repository:** [https://github.com/abhijeetdinkale-arch/proton](https://github.com/abhijeetdinkale-arch/proton)  
> **Canonical Motto:** *Calm Clinical Intelligence &bull; Doctor Remains the Final Authority*

---

## 1. Product Philosophy & Non-Negotiable Core Principle

Proton is an AI-native clinical operating system and copilot engineered specifically for physicians in outpatient and ambulatory practice. Traditional EHR software forces clinicians into clerical data entry, fragmented tabs, and alert fatigue. Proton reverses this paradigm by providing ambient capture, grounded clinical synthesis, deterministic safety verification, and streamlined approval workflows.

### The Canonical Workflow Loop:
```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   CAPTURE   │ ──> │    DRAFT    │ ──> │    VERIFY    │
└─────────────┘     └─────────────┘     └──────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  REMEMBER   │ <── │   APPROVE   │ <── │  DR. REVIEW  │
└─────────────┘     └─────────────┘     └──────────────┘
```

1. **CAPTURE**: Ambient consultation dialogue capture (microphone stream or typed transcript) with live timer and audio indicators.
2. **DRAFT**: AI note drafting formatting raw dialogue into structured SOAP clinical sections with transparent AI provenance labels.
3. **VERIFY**: Deterministic clinical verification runs safety checks (allergy conflicts, duplicate therapies, dosage omissions, patient linkage).
4. **PHYSICIAN REVIEW**: Doctor edits the note, adjusts medications, and acknowledges warnings. The note provenance updates to `Edited by physician`.
5. **APPROVE**: Doctor signs off with explicit confirmation. Unmet safety blocks prevent approval.
6. **REMEMBER**: Encounter, clinical impression, and approved prescriptions persist atomically to the Medplum FHIR backend. Post-encounter memory proposals update the patient's longitudinal record only upon doctor sign-off.

---

## 2. Workspaces & Feature Modules

### 2.1 Doctor Command Center V1
- **Heading**: *Good morning, Doctor &bull; Today's Clinical Workspace &bull; Here's what needs your attention.*
- **5-Tier Deterministic Priority Architecture**:
  1. **Needs Your Attention**: Critical allergy conflicts, high-risk medication changes, unfinished encounter drafts.
  2. **Continue Where You Left Off**: In-progress consultation drafts and pending document reviews.
  3. **Follow-up & Unresolved**: Documented interval follow-ups (e.g., HbA1c titration monitoring).
  4. **Documents to Review**: Uploaded medical reports awaiting physician fact verification.
  5. **Recent Patients**: Instant access to recent patient encounters with quick-launch consult actions.
- **Operational Metrics Bar**: Real-time counters tracking Active Patients, Completed Consults, Drafts Awaiting Approval, Documents to Review, and Follow-ups.
- **Search Shortcut**: Instant keyboard focus on search input via `/` key.

### 2.2 Global Command Palette (⌘K / Ctrl+K)
- Accessible from anywhere in the application via `⌘K` (Mac) or `Ctrl+K` (Windows/Linux) or the persistent sidebar pill.
- **Instant Patient Jump**: Real-time filtering across the patient panel by name, DOB, or MRN.
- **Quick Workflow Actions**: Fast keyboard navigation to Start New Consultation, Review Center, Document Upload, Patient Directory, or Command Center.
- **Keyboard Accessible**: Arrow up/down navigation, `Enter` to select, `Esc` to dismiss.

### 2.3 Patient Intelligence & "What Matters Today"
- **"What Matters Today" Block**: Top 3–5 high-value clinical items ranked by urgency, complete with `[View evidence]` drawers linking to original FHIR source observations.
- **Deterministic Temporal Change Detection**: Automated delta analysis comparing the current visit to prior encounters (e.g. `HbA1c increased: 7.1% → 8.2%`).
- **Current Clinical State**: Active medical conditions, active prescriptions, and documented allergies with severity badges.

### 2.4 Longitudinal Interactive Clinical Timeline
- **Unified Chronology**: Chronological stream integrating Encounters, Prescriptions, Lab Observations, Uploaded Documents, and Conditions.
- **Type Filtering**: One-click filter pills for *All*, *Consultations*, *Prescriptions*, *Labs*, and *Documents*.
- **In-Place Expansion**: Interactive accordion cards displaying full clinical summaries, transcripts, and prescription details without leaving the timeline.
- **Provenance Badges**: Every timeline item explicitly displays its provenance source.

### 2.5 Active Consultation Workspace
- **Pre-Consultation Brief**: High-density 10-second patient briefing summarizing key conditions, medications, and recent shifts.
- **Audio Capture & Sample Dialogue**: Dual-mode capture supporting live microphone recording with animated pulse and fallback sample dialogue for testing.
- **Editable Transcript**: Synchronized transcript area with speaker attribution.
- **Direct Note Editing**: Inline editor with real-time provenance tracking (`AI DRAFT` &rarr; `Edited by physician`).
- **Draft Autosave & Session Recovery**: Automatic persistence of in-progress drafts to browser session storage to guard against accidental navigation or data loss.

### 2.6 Deterministic Clinical Safety & Verification Engine
- Evaluates clinical notes and prescription orders against hard programmatic rules:
  - **Rule 1: Template Completeness**: Verifies presence of Subjective, Objective, Assessment, and Plan sections.
  - **Rule 2: Allergy Conflicts**: Cross-checks prescribed medications against documented allergies (e.g., Amoxicillin vs Penicillin anaphylaxis).
  - **Rule 3: Duplicate Therapies**: Flags duplicate drug orders within the active encounter.
  - **Rule 4: Mandatory 5-Field Prescription Validation**: Blocks approval if medication name, strength, dose, route, or duration is missing.
  - **Rule 5: Physician Acknowledgment Gate**: Requires explicit physician acknowledgment for non-blocking clinical warnings before approval is enabled.

### 2.7 Structured Prescription Workflow & PDF Generator
- **5-Field Structured Prescriptions**: Drug Name, Strength, Dose, Route, Frequency, Duration, and Patient Instructions.
- **AI Suggestions**: Context-aware medication suggestions requiring one-click physician acceptance or editing.
- **Prescription PDF Modal**: Generates printable prescription documents featuring physician credentials, patient demographics, medication instructions, and regulatory synthetic disclaimers.

### 2.8 Post-Consult Memory Proposals
- Analyzes completed consultation notes to propose permanent longitudinal memory updates:
  - New conditions (e.g., Tension-type headache)
  - Resolved issues
  - Follow-up intervals
- **Doctor Authority Gate**: Proposals are strictly non-autonomous. Physicians can Approve, Edit, or Reject each proposal individually before persistence.

### 2.9 Dedicated Review Center ("Nothing gets confirmed without you")
- Accessible via `/review` or `/document-review`.
- Serves as the central staging queue for AI-extracted facts from lab PDFs, referral letters, and scanned reports.
- Doctors inspect extracted values, model confidence scores, and verbatim source quotes before confirming facts to FHIR memory.

---

## 3. Design System & Visual Polish

Proton utilizes an Apple/Linear-inspired calm clinical aesthetic designed to reduce visual fatigue:
- **Typography**: Clean sans-serif hierarchy using Inter and system font stacks.
- **Semantic Palette**:
  - `Violet / Indigo`: AI synthesis and draft states (requires review).
  - `Sky / Blue`: Physician-edited content.
  - `Emerald / Teal`: Physician-approved and persisted clinical memory.
  - `Amber`: Clinical warnings and unverified extractions requiring attention.
  - `Rose / Red`: Blocking errors and critical safety alerts.
  - `Slate`: Neutral metadata and baseline clinical facts.
- **Design System Primitives**:
  - `ProvenanceBadge`: Semantic badges (`AI DRAFT`, `AI EXTRACTED`, `PHYSICIAN EDITED`, `PHYSICIAN APPROVED`, `REJECTED`, `CONFIRMED FACT`).
  - `StatusBadge`: Semantic state indicators.
  - `ClinicalAlert`: High-visibility clinical alerts with structured action slots.
  - `ConfidenceBadge`: Color-coded percentage indicators for AI extractions.
  - `CommandPalette`: Keyboard-first global search and action dispatcher.

---

## 4. Synthetic Beta Guardrails & Compliance

Proton V1 is deployed exclusively as a **Controlled Synthetic Beta**:
- **Synthetic Data Only**: All patient records, histories, and documents are synthetically generated.
- **Top Bar Notice**: Persistent banner: `SYNTHETIC BETA — NO REAL PATIENT DATA &bull; Proton Validation Environment`.
- **Zero Real PHI**: Real patient data, protected health information, and live production clinical use are strictly prohibited in this version.
- **Audit Logging**: All physician actions (edits, approvals, rejections, acknowledgments) are immutably recorded via `auditService`.
