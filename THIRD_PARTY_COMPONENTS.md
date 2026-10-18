# THIRD PARTY COMPONENTS & LICENSE AUDIT
**Proton Clinical Operating System**
*Controlled Milestone 0 License & Legal Compliance Audit*
*Date: 2026-10-18*

---

## 1. Compliance Policy & Standards

Proton operates in the healthcare and clinical enterprise domain. Third-party components must satisfy:
1. **Permissive Commercial Licensing:** Only software licenses permitting commercial use, modification, and private distribution (MIT, Apache 2.0, BSD, PostgreSQL License) are approved.
2. **Copyleft Isolation:** No strict copyleft licenses (GPLv3, AGPLv3) are permitted in core distributed artifacts without explicit architectural isolation boundaries.
3. **Model Weights Governance:** AI model weights (OpenAI Whisper, Google MedGemma / Gemma) must comply with acceptable use policies, patient privacy regulations (HIPAA/GDPR), and medical device advisory guidelines.
4. **Data Sourced Licensing:** Biomedical datasets (Open Targets, PubMed, ADA guidelines) are queried via public APIs or referenced under fair use and open research licenses with mandatory source attribution.

---

## 2. External Third-Party Component Audit

### 2.1 Medplum Monorepo
* **Repository:** `medplum/medplum` (`medplum-main/`)
* **Version:** 5.2.1
* **License:** Apache License 2.0
* **Copyright:** (c) 2021-2026 Medplum Inc.
* **Commercial Usage:** Permitted (Apache 2.0 explicitly grants commercial usage).
* **Modification Rights:** Permitted (Patent and copyright grant included).
* **Redistribution Rights:** Permitted with NOTICE and LICENSE preservation.
* **Model License:** N/A (FHIR Software Stack).
* **Attribution Requirements:** Must retain NOTICE file and original copyright notices.
* **Potential Restrictions:** Trademark protection on "Medplum" brand. No patent litigation against contributors.
* **Proton Usage:** Foundational clinical data storage, FHIR R4 schema validation, OAuth2 SMART-on-FHIR provider, and `@medplum/react` components.

### 2.2 OpenAI Whisper
* **Repository:** `openai/whisper` (`whisper-main/`)
* **Version:** Upstream master (commit 2024-08-31)
* **License:** MIT License
* **Copyright:** (c) 2022 OpenAI
* **Commercial Usage:** Permitted without restriction.
* **Modification Rights:** Permitted.
* **Redistribution Rights:** Permitted.
* **Model License:** Model weights released under MIT License; commercial use permitted.
* **Attribution Requirements:** Retain original copyright notice and permission notice.
* **Potential Restrictions:** High audio noise or multi-speaker overlapping speech may degrade transcription fidelity; requires clinical validation.
* **Proton Usage:** Ambient clinical conversation capture, voice dictation, and speech-to-text pipeline.

### 2.3 Tesseract OCR
* **Repository:** `tesseract-ocr/tesseract` (`tesseract-main/`)
* **Version:** 5.5.0-alpha
* **License:** Apache License 2.0
* **Copyright:** (c) 2006-2026 Google Inc., Ray Smith, and Tesseract contributors.
* **Commercial Usage:** Permitted.
* **Modification Rights:** Permitted.
* **Redistribution Rights:** Permitted.
* **Model License:** Tesseract traineddata (LSTM models) released under Apache 2.0.
* **Attribution Requirements:** Retain copyright notices and Apache 2.0 license text.
* **Potential Restrictions:** Scanned handwritten prescriptions have lower OCR confidence; must enforce unconfirmed draft status.
* **Proton Usage:** Local / edge OCR for laboratory reports, medical discharge summaries, and uploaded physical prescription images.

### 2.4 pgvector PostgreSQL Extension
* **Repository:** `pgvector/pgvector` (`pgvector-master/`)
* **Version:** 0.8.0
* **License:** PostgreSQL License / BSD-style
* **Copyright:** (c) 1996-2026 PostgreSQL Global Development Group, (c) Andrew Kane
* **Commercial Usage:** Permitted.
* **Modification Rights:** Permitted.
* **Redistribution Rights:** Permitted.
* **Model License:** N/A (Database extension).
* **Attribution Requirements:** Retain copyright and permission notice.
* **Potential Restrictions:** Requires PostgreSQL C compiler toolchain to compile binary extension.
* **Proton Usage:** Vector database extension for PostgreSQL to perform HNSW/IVFFlat similarity searches across patient clinical history, guidelines, and specialist agent knowledge.

### 2.5 Google GenAI SDK & Gemini Models
* **Repository:** `@google/genai`
* **Version:** 2.27.0
* **License:** Apache License 2.0
* **Copyright:** (c) Google LLC
* **Commercial Usage:** Permitted (SDK). API usage governed by Google Cloud / AI Studio Terms of Service.
* **Modification Rights:** Permitted.
* **Redistribution Rights:** Permitted.
* **Model License:** Proprietary cloud model API (Gemini 3.8 Flash / Pro).
* **Attribution Requirements:** Standard API client terms.
* **Potential Restrictions:** Real PHI requires enterprise BAA (Business Associate Agreement) with Google Cloud Vertex AI. Never store raw unmasked PHI in consumer AI studio keys.
* **Proton Usage:** General clinical intelligence, SOAP note generation, multimodal image review, and document fact extraction.

### 2.6 MedGemma (Gemma 2 / Medical Specialization)
* **Repository:** `google/medgemma` / `google/gemma-2`
* **Version:** MedGemma 1.5 4B / Gemma 2
* **License:** Gemma Terms of Use (Permissive Open Weights License)
* **Copyright:** (c) Google LLC
* **Commercial Usage:** Permitted under Gemma Open Terms of Use.
* **Modification Rights:** Fine-tuning and quantization permitted.
* **Redistribution Rights:** Permitted with downstream flow-through of terms.
* **Model License:** Gemma Terms of Use (Prohibits illegal, malicious, or deceptive medical diagnosis generation).
* **Attribution Requirements:** Attribution to Google and Gemma.
* **Potential Restrictions:** Medical advisory disclaimer: Not cleared as an autonomous diagnostic device.
* **Proton Usage:** Local on-device / hospital private cloud model for offline clinical synthesis via MLX-VLM or vLLM.

### 2.7 React & React DOM
* **Repository:** `facebook/react`
* **Version:** 19.2.8
* **License:** MIT License
* **Copyright:** (c) Meta Platforms, Inc.
* **Commercial Usage:** Permitted.
* **Modification Rights:** Permitted.
* **Redistribution Rights:** Permitted.
* **Model License:** N/A.
* **Attribution Requirements:** MIT notice preservation.
* **Potential Restrictions:** None.
* **Proton Usage:** Physician web workstation user interface.

### 2.8 Mantine UI Suite
* **Repository:** `mantinedev/mantine` (`@mantine/core`, `@mantine/hooks`, `@mantine/spotlight`)
* **Version:** 8.3.18
* **License:** MIT License
* **Copyright:** (c) 2021-2026 Vitaly Rtishchev
* **Commercial Usage:** Permitted.
* **Modification Rights:** Permitted.
* **Redistribution Rights:** Permitted.
* **Model License:** N/A.
* **Attribution Requirements:** Standard MIT notice.
* **Potential Restrictions:** None.
* **Proton Usage:** Accessible modals, notifications, spotlight command palette, and UI components in web app.

### 2.9 Tailwind CSS
* **Repository:** `tailwindlabs/tailwindcss`
* **Version:** 4.3.3
* **License:** MIT License
* **Copyright:** (c) Tailwind Labs, Inc.
* **Commercial Usage:** Permitted.
* **Modification Rights:** Permitted.
* **Redistribution Rights:** Permitted.
* **Model License:** N/A.
* **Attribution Requirements:** MIT notice.
* **Potential Restrictions:** None.
* **Proton Usage:** Minimalist slab design system styling.

### 2.10 Express
* **Repository:** `expressjs/express`
* **Version:** 5.2.1
* **License:** MIT License
* **Copyright:** (c) StrongLoop, Inc., and other Express contributors.
* **Commercial Usage:** Permitted.
* **Modification Rights:** Permitted.
* **Redistribution Rights:** Permitted.
* **Model License:** N/A.
* **Attribution Requirements:** MIT notice.
* **Potential Restrictions:** None.
* **Proton Usage:** API server router, middleware execution, and HTTP request lifecycle.

### 2.11 Zod
* **Repository:** `colinhacks/zod`
* **Version:** 4.6.5
* **License:** MIT License
* **Copyright:** (c) 2020 Colin McDonnell
* **Commercial Usage:** Permitted.
* **Modification Rights:** Permitted.
* **Redistribution Rights:** Permitted.
* **Model License:** N/A.
* **Attribution Requirements:** MIT notice.
* **Potential Restrictions:** None.
* **Proton Usage:** Deterministic payload schema validation for clinical endpoints and structured agent outputs.

### 2.12 Android Jetpack Compose & AndroidX
* **Repository:** `google/android-compose`
* **Version:** Compose BOM 2025.02.00, AndroidX Core 1.15.0
* **License:** Apache License 2.0
* **Copyright:** (c) The Android Open Source Project
* **Commercial Usage:** Permitted.
* **Modification Rights:** Permitted.
* **Redistribution Rights:** Permitted.
* **Model License:** N/A.
* **Attribution Requirements:** Apache 2.0 notice.
* **Potential Restrictions:** None.
* **Proton Usage:** Native Android physician and patient UI, Material 3 design system, and state management.

### 2.13 Open Targets Platform API & Data
* **Repository:** `opentargets/platform`
* **Version:** GraphQL API v4
* **License:** Creative Commons Attribution 4.0 International (CC-BY 4.0)
* **Copyright:** (c) 2014-2026 EMBL-EBI, Wellcome Sanger Institute, GSK, Sanofi, Takeda, BMS.
* **Commercial Usage:** Permitted.
* **Modification Rights:** Permitted.
* **Redistribution Rights:** Permitted.
* **Model License:** N/A (Biomedical Target-Disease Evidence Store).
* **Attribution Requirements:** Explicit citation of Open Targets Platform and data release version.
* **Potential Restrictions:** Candidate targets and drugs must undergo deterministic clinician review before clinical action.
* **Proton Usage:** Pre-verified drug-target association candidate pool generation for Medication Suggestion Agent.

---

## 3. License Matrix Summary

| Component | License | Commercial OK | Modifications OK | Copyleft Risk | Approved for Proton |
|---|:---:|:---:|:---:|:---:|:---:|
| `medplum-main` | Apache 2.0 | YES | YES | None | **APPROVED** |
| `whisper-main` | MIT | YES | YES | None | **APPROVED** |
| `tesseract-main` | Apache 2.0 | YES | YES | None | **APPROVED** |
| `pgvector-master`| PostgreSQL (BSD)| YES | YES | None | **APPROVED** |
| `@google/genai` | Apache 2.0 | YES | YES | None | **APPROVED** |
| `react` / `react-dom` | MIT | YES | YES | None | **APPROVED** |
| `express` | MIT | YES | YES | None | **APPROVED** |
| `zod` | MIT | YES | YES | None | **APPROVED** |
| `pg` (node-postgres) | MIT | YES | YES | None | **APPROVED** |
| AndroidX / Compose | Apache 2.0 | YES | YES | None | **APPROVED** |
| Open Targets Platform | CC-BY 4.0 | YES | YES | None | **APPROVED** |

**Audit Conclusion:** Zero high-risk copyleft dependencies exist in the Proton codebase. All components are approved for commercial clinical deployment under appropriate attribution and healthcare data governance.
