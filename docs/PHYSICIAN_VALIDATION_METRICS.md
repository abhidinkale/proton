# PROTON PHYSICIAN VALIDATION METRICS & SCORING RUBRIC
**Document Version:** 1.0.0-metrics  
**Scope:** Quantitative and Qualitative Evaluation Metrics for In-Person Physician Validation Sessions  
**Target Group:** 3–5 Board-Certified / Practicing Ambulatory Physicians  
**Standard:** Rigorous, empirical clinical scoring — Zero fabricated baseline claims.

---

## 1. OBJECTIVE MEASUREMENT FRAMEWORK

During each validation encounter, the session observer records the following quantitative indicators using stopwatch and interface interaction logging:

| Metric Code | Metric Name | Definition & Measurement Method | Target Clinical Threshold |
| :--- | :--- | :--- | :--- |
| **M-01** | **Consultation Documentation Time** | Total time from conclusion of dialogue capture to final "Approve & Save" click. | $< 120$ seconds (vs 6–10 min EHR average) |
| **M-02** | **Pre-Consultation Scan Time** | Time spent on Patient Intelligence / Pre-Consultation brief before dialogue begins. | $< 45$ seconds |
| **M-03** | **Physician Editing Rate** | Percentage of AI-generated text sections modified by the physician. | $15\% - 35\%$ (indicates active review without total rewrite) |
| **M-04** | **AI Note Acceptance Rate** | Ratio of unchanged AI note characters to total submitted note characters. | $> 70\%$ acceptable draft accuracy |
| **M-05** | **Clinically Important Correction Rate** | Number of factual inaccuracies or clinical hallucinations corrected by physician. | Goal: $0$ uncorrected hallucinations; identify any missed errors |
| **M-06** | **Clinically Important Omission Rate** | Number of key clinical facts from dialogue omitted from the AI draft that required manual addition. | $< 1$ omission per encounter |
| **M-07** | **Prescription Correction Rate** | Percentage of AI medication suggestions edited, deleted, or rejected by physician. | Track acceptance vs rejection breakdown |
| **M-08** | **Document Extraction Accuracy** | Accuracy of extracted clinical facts from uploaded PDFs/images (tested in Doc Review). | $> 85\%$ high confidence |
| **M-09** | **Source & Provenance Click Rate** | Frequency with which the physician clicks `[View source]` or inspects evidence modals. | Track whether doctors verify evidence |
| **M-10** | **Safety Warning False Alarm Rate** | Number of warnings flagged by verification engine deemed clinically irrelevant or noisy by physician. | $< 20\%$ noise threshold |
| **M-11** | **Warning Acknowledgment Duration** | Time taken from warning display to physician review and acknowledgment. | $3 - 10$ seconds |

---

## 2. SUBJECTIVE CLINICAL EXPERIENCE METRICS (LIKERT 1–5)

Administered immediately following the completion of the 6-task protocol:

| Dimension | Question Item | 1 (Very Poor / Strongly Disagree) | 3 (Neutral) | 5 (Exceptional / Strongly Agree) |
| :--- | :--- | :---: | :---: | :---: |
| **Patient Context Utility** | *"The Pre-Consultation Brief gave me clear situational awareness before the visit."* | Irrelevant / Distracting | Moderate | Critical time-saver |
| **Temporal Trajectory Utility** | *"The 'What Changed Since Last Consultation' section highlighted the true clinical priorities."* | Missed main changes | Partially helpful | Immediate clarity on HbA1c/meds |
| **Longitudinal Story Utility** | *"The longitudinal clinical narrative felt clinically grounded and trustworthy."* | Hallucinatory / Fluff | Acceptable | Coherent, accurate chronology |
| **Safety Verification Value** | *"The deterministic verification layer caught important items without creating annoying friction."* | Bureaucratic hurdle | Balanced | Vital clinical safety guardrail |
| **Memory Proposal Gating** | *"Reviewing proposed updates to permanent medical memory felt appropriate and natural."* | Too tedious | Manageable | Essential to prevent chart drift |
| **Physician Trust Score** | *"I felt completely in control of all final prescriptions and FHIR commitments."* | Felt unsafe / Out of control | Mostly in control | 100% physician-governed |
| **Cognitive Load (NASA-TLX)** | *"Compared to my standard EHR charting routine, the mental effort required was..."* | Much more exhausting | Equal effort | Dramatically reduced mental fatigue |
| **Overall Clinical Utility** | *"How valuable would Proton be in your ambulatory outpatient workflow?"* | No value | Marginal | High daily clinical value |

---

## 3. LIVE OBSERVER SCORING SHEET

Use this template to score each physician session:

```text
================================================================================
PROTON PHYSICIAN VALIDATION SCORING SHEET
================================================================================
Physician ID / Code: DR-______    Specialty: __________________   Date: ________
Facilitator: __________________   Observer / Scribe: __________________________
Case Tested: [ ] Eleanor Vance (Complex Chronic)  [ ] Arthur Pendelton (Ambiguous)

SECTION A: WORKFLOW TIMINGS
- T1: Pre-Consultation Review Time:        _____ seconds
- T2: Audio / Dialogue Review Time:        _____ seconds
- T3: Note Review & Edit Duration:          _____ seconds
- T4: Prescription Formulation Duration:    _____ seconds
- T5: Memory Proposal Review Duration:     _____ seconds
- TOTAL TIME TO SUBMIT (T1 to T5):         _____ seconds (_____ minutes)

SECTION B: CLINICAL ACTIONS & CORRECTIONS
- Note Sections Modified (Check all): 
  [ ] Chief Complaint  [ ] HPI  [ ] Assessment  [ ] Plan  [ ] None (Accepted verbatim)
- AI Prescriptions Accepted: _____ / _____
- Custom Prescriptions Added: _____
- Verification Warnings Encountered: _____
  - Legitimate warnings acknowledged: _____
  - False positive / noisy warnings flagged: _____
- Memory Proposals:
  - Approved: _____   - Rejected: _____   - Edited: _____

SECTION C: SUBJECTIVE RATINGS (1–5 Scale)
1. Pre-Consultation Brief Usefulness:    [ 1   2   3   4   5 ]
2. Note Quality & Accuracy:              [ 1   2   3   4   5 ]
3. Prescription Workflow Clarity:         [ 1   2   3   4   5 ]
4. Trust & Autonomy:                     [ 1   2   3   4   5 ]
5. Cognitive Load Reduction:             [ 1   2   3   4   5 ]

SECTION D: QUALITATIVE OBSERVATIONS
- Where did the physician pause, hesitate, or squint?
  ______________________________________________________________________________
- What clinical information did they explicitly ask for that was missing?
  ______________________________________________________________________________
- What was their verbatim quote regarding trust and control?
  "____________________________________________________________________________"

SECTION E: PRODUCT VIABILITY
- Would they use this in their clinic? [ ] Yes  [ ] No  [ ] Only with changes
- Net Promoter Score (0 to 10): _____
================================================================================
```

---

## 4. AGGREGATION & GO / NO-GO CRITERIA

Following validation across 3–5 physicians, calculate aggregate medians. The project reaches **Clinical Viability** for Phase 2 beta expansion when:

1. **Median Chart Completion Time:** $\le 150$ seconds ($2.5$ minutes).
2. **Physician Trust Score (Autonomy):** Mean $\ge 4.2 / 5.0$.
3. **Safety Verification Approval:** $100\%$ of physicians confirm approval gates felt safe rather than obstructive.
4. **Zero Silent Hallucination Persistence:** $0$ unreviewed AI assertions committed to FHIR.
5. **Willingness to Continue:** At least 3 out of 4 participating physicians indicate "Definitely Yes" or "Probably Yes" to clinical pilot adoption.
