# PROTON PHYSICIAN VALIDATION PROTOCOL
**Document Version:** 1.0.0-clinical-eval  
**Scope:** Controlled In-Person & Remote Validation with 3–5 Practicing Physicians  
**Data Policy:** Strictly Synthetic Patient Data Only (Eleanor Vance & Arthur Pendelton)  
**Objective:** Measure physician behavior, cognitive load, trust boundaries, friction, and clinical utility in natural simulated workflows without leading questions or forced guidance.

---

## 1. PHYSICIAN INTRODUCTION SCRIPT

Use this verbatim script when seating the physician tester:

> "Doctor, thank you for taking the time to test Proton. Proton is designed as an ambient clinical copilot that prepares patient context before you enter the room, captures clinical dialogue, drafts structured clinical notes and prescriptions, and updates longitudinal memory under your explicit review.
>
> Today, you will be using a fully sandboxed clinical environment populated strictly with realistic synthetic patient profiles. No real patient data or protected health information is present or will be stored.
>
> We want to observe how you naturally interact with the software. Please think out loud as you work: speak aloud what catches your eye, what you expect to happen, any hesitations you feel, and whether anything feels confusing or clinically questionable.
>
> There are no wrong actions today. We are testing the software, not your clinical expertise. If something is difficult or confusing, that is a flaw in our software that we need to fix."

---

## 2. WHAT NOT TO EXPLAIN TO THE PHYSICIAN

To observe natural discovery and identify design flaws, the facilitator **MUST NOT**:

1. **Do NOT explain how the Clinical Brain works** or mention that temporal changes are deterministically computed. Let the physician discover the "What Changed Since Last Consultation" section on their own.
2. **Do NOT explain how to start the consultation or find the recording controls.** Observe whether the visual hierarchy guides them to the "Start Consultation" CTA.
3. **Do NOT point out the AI Provenance badges** (`AI DRAFT — REVIEW REQUIRED`, `DOCTOR EDITED`, `PHYSICIAN APPROVED`). Observe whether they notice them independently or ask who generated the note.
4. **Do NOT explain the Safety Verification Panel.** Observe if they notice blocking vs warning checks and whether the confirmation gating is intuitive or annoying.
5. **Do NOT instruct them to edit the AI note or prescription.** Observe whether they instinctively trust the AI text or immediately move their cursor to verify and edit facts.
6. **Do NOT explain the Post-Consultation Memory Update Panel.** Observe whether the concept of updating permanent longitudinal memory makes immediate clinical sense to them.
7. **Do NOT intervene when the physician pauses or hesitates.** Silently record the duration of the hesitation and note what on the screen caused pause.

---

## 3. SYNTHETIC PATIENT SETUP

The validation session provides two validated synthetic patient scenarios:

### Case A: Eleanor Vance (Multimorbid Complex Longitudinal Chronic Care)
- **Demographics:** 48-year-old female (DOB: 1978-04-12)
- **Active Conditions:** Type 2 Diabetes Mellitus, Essential Hypertension
- **Documented Allergy:** Penicillin (Anaphylaxis Risk)
- **Clinical Trajectory:**
  - HbA1c escalated from baseline 7.1% (2 months ago) to 8.2% (abnormal, 5 days ago).
  - Blood Pressure recorded at 142/88 mmHg.
  - Metformin titrated from 500 mg once daily to 500 mg twice daily.
  - Historical encounter notes document GI upset and missed weekend doses.
- **Historical Records:** `Metabolic_Panel_2026.pdf` attached in FHIR memory.

### Case B: Arthur Pendelton (Conflicting History & Ambiguous Records)
- **Demographics:** 62-year-old male (DOB: 1964-08-22)
- **Active Conditions:** Exertional Fatigue, Reactive Airway Disease Query
- **Documented Allergy:** Sulfa / Sulfamethoxazole (Urticaria Rash)
- **Clinical Trajectory:**
  - Encounter 1 (3 months ago): Documented no shortness of breath.
  - Encounter 2 (3 weeks ago): Urgent care visit reports 6 months of episodic wheezing (conflicting).
  - Medication: Unspecified Albuterol inhaler (strength/canister unverified).
  - Lab: Serum Creatinine 1.4 mg/dL (borderline elevated, requires drug caution).
- **Historical Records:** `Outpatient_Cardiopulmonary_Summary_2025.pdf`.

---

## 4. EXACT TASKS THE PHYSICIAN SHOULD PERFORM

The evaluation session is divided into 6 continuous sequential tasks:

### Task 1: Pre-Consultation Review (60-Second Chart Scan)
- **Prompt:** *"You are about to see Eleanor Vance, who has arrived for a follow-up visit. Please review her chart in Proton and prepare for the encounter."*
- **Target Actions:** Locate patient in directory, open chart, review "Patient Intelligence" section, inspect temporal changes (HbA1c change, medication titration), check allergy status.

### Task 2: Provenance Verification
- **Prompt:** *"You notice an elevated HbA1c result. Before talking to the patient, verify where that number came from."*
- **Target Actions:** Click `[View source]` or inspect provenance badge to open the Evidence Drawer, verifying the underlying diagnostic laboratory Observation.

### Task 3: Ambient Encounter Capture & Note Review
- **Prompt:** *"Now begin the consultation with Eleanor. Conduct the visit (or capture the dialogue) and review the generated documentation."*
- **Target Actions:** Click "Start Consultation", review Pre-Consultation 10-second brief, start recording (or click Sample Dialogue), stop recording, inspect transcribed dialogue, and review the drafted clinical note.

### Task 4: Note Editing & Provenance Shift
- **Prompt:** *"Review the AI-drafted note. Make any clinical adjustments you feel are warranted based on standard practice."*
- **Target Actions:** Edit a section of the note (e.g. adjust assessment or add lifestyle advice). Observe if the physician notices the badge shift from `AI DRAFT` to `DOCTOR EDITED`.

### Task 5: Prescription Composer & Safety Gate
- **Prompt:** *"The patient needs medication management for acute headache symptoms. Review any suggested prescriptions or compose new medication orders."*
- **Target Actions:** Accept or reject AI suggestions, add custom medication, evaluate safety verification warnings (e.g. test allergy alert with Amoxicillin or dosage checks), check the physician confirmation checkbox, and approve.

### Task 6: Post-Consultation Memory Gating & Timeline Verification
- **Prompt:** *"Finalize the visit and ensure the patient's longitudinal record accurately reflects today's encounter."*
- **Target Actions:** Review the Memory Proposal Panel, approve/reject individual proposals, click "Approve & Save to FHIR", return to Patient Profile, and verify updated timeline and trajectory.

---

## 5. OBSERVATION CHECKLIST (FOR OBSERVER / SCRIBE)

Record timestamps and observations for each item:

| Observation Dimension | Observed Behavior | Timestamp / Notes |
| :--- | :--- | :--- |
| **Initial Glance & Orientation** | Does doctor look at metrics first, or dive straight into patient? | |
| **Pre-Consultation Brief** | Did doctor read "What Changed Since Last Consultation"? Duration of scan? | |
| **Source Tracing** | Did doctor attempt to click `[View source]` without prompting? | |
| **Recording State Comfort** | Did doctor understand when audio was capturing vs transcribing? | |
| **Transcript vs Note Split** | Did doctor read the raw transcript, or focus entirely on the note? | |
| **AI Output Scrutiny** | Did doctor skim the note or read word-for-word? | |
| **Editing Friction** | Was note editing natural (standard textarea vs blocked fields)? | |
| **Prescription Caution** | Did doctor notice the confirmation checkbox requirement before saving? | |
| **Safety Warning Reaction** | Did doctor read warning details or blindly click acknowledge? | |
| **Memory Proposal Understanding** | Did doctor understand why the system proposed updating long-term memory? | |
| **Timeline Reflection** | Did doctor check the profile timeline after saving to verify write? | |

---

## 6. QUESTIONS TO ASK AFTER EACH TASK

Immediately following each task, ask the specific question and record the unvarnished response:

- **After Task 1 (Pre-Consultation Scan):**  
  *"In the 30–60 seconds you spent on this screen, what stood out to you about this patient's current trajectory?"*  
  *(Assess whether they caught the HbA1c 7.1% $\rightarrow$ 8.2% spike and Metformin titration).*

- **After Task 2 (Evidence Check):**  
  *"How confident were you that the HbA1c value shown was accurate and real? Did the source modal answer your questions?"*

- **After Task 3 (Encounter Capture):**  
  *"Looking at the drafted note, how closely does this match what you would write in your current EHR?"*

- **After Task 4 (Note Editing):**  
  *"When you edited that sentence, did the interface clearly communicate that this was now your approved text rather than AI-generated text?"*

- **After Task 5 (Prescription):**  
  *"What was your reaction to the verification warnings and the review confirmation checkbox? Did it feel like safety, or did it feel like bureaucracy?"*

- **After Task 6 (Memory Gating):**  
  *"Did the memory update step make sense? Would you want Proton proposing updates to the problem list after each visit?"*

---

## 7. QUESTIONS TO ASK AFTER THE COMPLETE WORKFLOW

Conduct a structured 15-minute debrief:

1. **Overall Experience:** *"If this were connected to your practice tomorrow, what part of your day would it change the most?"*
2. **Speed & Efficiency:** *"Compared to your current charting routine, would this make you faster, slower, or about the same?"*
3. **Frustrations:** *"Where did you feel annoyed, slowed down, or unsure of what to do next?"*
4. **Missing Information:** *"What critical clinical data did you look for that was missing from the screen?"*
5. **EHR Comparison:** *"What does this do that Epic/Cerner/Athena fails to do for you today?"*

---

## 8. TRUST EVALUATION (1–5 LIKERT SCALE)

1. *“I trust that Proton will not write unreviewed AI hallucinations into the patient’s permanent chart.”* (1 = Strongly Disagree, 5 = Strongly Agree)
2. *“I felt in control of all final clinical decisions, prescriptions, and documentation.”* (1–5)
3. *“The provenance indicators (AI Draft vs Doctor Edited) gave me clarity on who authored what.”* (1–5)
4. *“I trust the safety verification alerts to catch dangerous dosage or allergy errors.”* (1–5)

---

## 9. CLINICAL USEFULNESS EVALUATION

1. Rate utility of **What Changed Since Last Consultation** (1–5)
2. Rate utility of **Pre-Consultation Brief (10-Second Scan)** (1–5)
3. Rate utility of **Ambient SOAP Note Generation** (1–5)
4. Rate utility of **Prescription Builder & PDF Export** (1–5)
5. Rate utility of **Post-Consultation Memory Proposals** (1–5)

---

## 10. WORKFLOW SPEED EVALUATION

Measure and document:
- Time spent reviewing pre-consultation brief (target: $< 45$ seconds).
- Time spent reviewing and editing clinical note (target: $< 90$ seconds).
- Time spent reviewing and approving prescription (target: $< 30$ seconds).
- Total chart completion time per encounter (target: $< 3$ minutes vs typical 6–10 minutes).

---

## 11. COGNITIVE-LOAD EVALUATION (NASA-TLX SIMPLIFIED)

Ask the physician to rate on a 1–10 scale:
- **Mental Demand:** How mentally demanding was charting with Proton? (1 = very low, 10 = exhausting)
- **Effort:** How hard did you have to work to verify that the documentation was accurate? (1–10)
- **Frustration:** How insecure, discouraged, or annoyed were you during the workflow? (1–10)

---

## 12. ERROR DETECTION EVALUATION

Introduce 1 subtle intentional AI discrepancy during Task 3 (e.g. slight variation in symptom duration):
- Did the physician catch the discrepancy? (Yes / No)
- How long did it take to identify? (Seconds)
- Did they easily correct it in the editor? (Yes / No)

---

## 13. AI TRANSPARENCY EVALUATION

- Did the physician ever express doubt about whether an action was already saved?
- Did they understand that AI suggestions are non-binding drafts until explicitly approved?
- Did the evidence modals provide adequate clinical provenance?

---

## 14. OVERALL PRODUCT VALUE EVALUATION

1. **Willingness to Use:** *"If Proton was integrated into your clinic, would you use it for your daily ambulatory visits?"* (Definitely Yes / Probably Yes / Unsure / Probably Not / Definitely Not)
2. **Net Promoter Question:** *"How likely are you to recommend Proton to a physician colleague?"* (0–10)
3. **Founder Takeaway:** What single change would make Proton indispensable to this doctor?
