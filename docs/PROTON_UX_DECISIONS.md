# Proton UX Architectural & Interaction Design Decisions

## Purpose
This document records the architectural and interaction design decisions implemented across Proton to fulfill the North Star objective: **Doctor productivity without sacrificing clinical safety**.

---

## Decision 1: Ambient Scribe Real-Time Status Communicator

### Context
In clinical environments, clinicians must know with 100% certainty whether room audio is being captured, whether the microphone is muted for a private physical exam, or whether an audio device error has occurred.

### Decision
Implement a persistent, visible, and color-coded status badge in the workstation header communicating exact state:
- `READY` (Slate): Audio pipeline connected, awaiting start.
- `LISTENING` (Emerald with pulsing indicator): Microphone actively streaming room audio.
- `PAUSED` (Amber): Microphone muted by clinician for private examination.
- `PROCESSING` (Indigo): Audio buffer being transcribed and processed through clinical synthesis.
- `ERROR` (Rose): Microphone or streaming issue detected; audio buffered locally.
- `OFFLINE` (Zinc): Operating in Degraded Manual Mode.

### Impact
Zero ambiguity regarding acoustic privacy and transcription state. Clinicians can pause/resume with a single keyboard shortcut (`Space` or `Cmd+Shift+A`).

---

## Decision 2: 4-Quadrant SOAP Note Structure with Inline Click-to-Edit

### Context
Physicians reject "monolithic block" notes produced by naive LLM wrappers because reviewing a 600-word paragraph for subtle dosage or clinical errors imposes high cognitive load.

### Decision
Standardize on the clinical 4-Quadrant SOAP model:
1. **Subjective:** Chief complaint, HPI, and structured dialogue summary.
2. **Objective:** Structured vitals and physical examination findings.
3. **Assessment:** Differential diagnoses and active clinical problems.
4. **Plan:** Evidence-backed orders, prescriptions, follow-up timelines, and patient instructions.

Each quadrant is an isolated interactive card with inline click-to-edit. Clinicians can edit any sentence directly without entering a disruptive modal editing mode.

### Impact
Enables rapid visual scanning (< 5 seconds) and granular editing of specific findings with 0 keystrokes required for untouched sections.

---

## Decision 3: Scenario Quick-Selector on Today Schedule

### Context
During clinical workstation trials, testing, and multi-specialty reviews, clinicians and evaluators must rapidly switch between varied clinical presentations (Primary Care, Diabetes, Asthma, Cardiology, Neurology, Medication Hard Stops, Degraded Mode).

### Decision
Add a high-ergonomics horizontal scenario selector pill bar at the top of `TodaySchedule.tsx` mapping to the 10 master synthetic cases and Degraded Mode.

### Impact
Instantaneous single-click loading of any clinical archetype without manual patient search or chart ID entry.

---

## Decision 4: Deterministic Hard Stops vs. Non-Blocking Advisories

### Context
Alert fatigue in legacy EHRs is caused by displaying critical drug contraindications and minor dietary suggestions with the exact same intrusive popup modal.

### Decision
Strictly bifurcate safety feedback into two distinct tiers:
1. **Tier 1: Critical Hard Stops (Deterministic SafetyGate)**
   - Triggered by severe drug-allergy conflicts (e.g. Penicillin anaphylaxis vs Augmentin) or lethal drug-drug interactions.
   - Non-bypassable red modal dialog blocking pharmacy transmission.
   - Bypassing requires explicit authenticated physician credentials and a documented clinical rationale directive (≥ 10 characters).
2. **Tier 2: Informational Advisories & Monitoring Badges**
   - Triggered by guideline-directed monitoring suggestions (e.g., check lipid panel in 6 months).
   - Displayed as non-blocking amber/blue badges in the Specialist Perspectives pane.
   - Never steals focus or prevents encounter completion.

### Impact
Eliminates alert fatigue while guaranteeing 100% adherence to patient safety guardrails.

---

## Decision 5: Cryptographic AI Provenance Transparency

### Context
Clinicians are legally and professionally accountable for everything entered into the medical record. They will not sign AI drafts without understanding model provenance and verifying that content was not tampered with.

### Decision
Stamp every AI draft with a cryptographic SHA-256 tamper-evident envelope (`ProvenanceSystem`).
- Visual provenance badge displays generating agent (`Internal Medicine Specialist Agent`), base model ID, and generation timestamp.
- Any manual edit by the clinician updates the payload digest and transitions the state to `EDITED`.
- Physician sign-off records the authenticated clinician ID, timestamp, and seals the tamper hash.

### Impact
Gives clinicians complete medicolegal confidence and auditability.

---

## Decision 6: Specialty-Bound Context Filtering (Anti-Clutter)

### Context
Dumping 50 pages of longitudinal history into an encounter creates information overload and risks model distraction.

### Decision
The `ClinicalContextEngine` applies relevance filtering:
- Surfacing recent vitals, active medications, and documented allergies.
- Filtering prior conditions and historical encounters based on the active specialty (e.g., Cardiology filters for coronary, hypertensive, and lipid history; Pulmonology filters for asthma, COPD, and peak flow).
- Core Safety Anchor: Active allergies and current medications are **NEVER filtered out**, regardless of specialty.

### Impact
Reduces time to patient understanding to **< 10 seconds** while preserving 100% medication safety.

---

## Decision 7: Degraded / Offline Manual Fallback Mode

### Context
Clinical operating systems must never fail completely when network connectivity, third-party LLM providers, or cloud APIs experience an outage.

### Decision
Incorporate automatic degraded mode fallback:
- When AI endpoints fail or are unreachable, Proton transitions gracefully to manual clinical workstation mode.
- Clinicians can manually draft SOAP notes, enter prescriptions, view cached patient records, and sign off.
- The UI displays an amber `Degraded Mode — Manual Documentation` indicator.
- Preserves full atomic FHIR persistence and PDF prescription generation locally.

### Impact
Zero clinical downtime. The physician can always complete the consultation and discharge the patient safely.
