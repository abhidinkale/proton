# Proton Degraded Mode & Offline Resilience Specification

**Milestone 4 Deliverable**  
**Date:** October 18, 2026  
**System:** Proton — AI-Native Multi-Specialty Clinical Operating System  
**Status:** **ACTIVE ARCHITECTURAL CAPABILITY**

---

## 1. Core Degraded Mode Philosophy

A clinical operating system cannot freeze, crash, or block medical care when external internet access, LLM providers, or cloud microservices degrade or fail.

> **Clinical Operating Invariant:**  
> If all AI and network endpoints become completely unreachable, Proton degrades gracefully to a high-speed manual physician workstation. A physician can open the application, examine the patient chart, dictate or type the clinical note, stage prescriptions, review safety warnings, sign off, and print or export the care plan without encountering blocking spinners, white screens, or data loss.

---

## 2. Capability Matrix: Online vs. Degraded vs. Total Offline

| Functional Domain | Online Mode (Cloud Providers Active) | Degraded Mode (AI / Jev Offline) | Total Offline Mode (No Internet / Local Network) |
| :--- | :--- | :--- | :--- |
| **Patient Schedule & Roster** | Real-time EHR roster sync | Local cached schedule & synthetic scenarios | Local session storage / IndexedDB cache |
| **Patient Brief & Pre-Intake** | Full longitudinal trajectory + live biomarker fetch | Local cached patient profile & history | Local cached patient profile & history |
| **Ambient Speech Transcription** | Gemini Multimodal / Cloud Whisper STT | Local Whisper CLI runtime (if installed) or manual typing | Manual keyboard documentation or local audio memo recording |
| **SOAP Note Drafting** | Automatic continuous LLM generation from transcript | Physician types directly into 4 SOAP quadrants | Physician types directly into 4 SOAP quadrants |
| **Specialist Intelligence** | Dynamic routing to 4+ specialists with cross-specialty synthesis | Panel displays `AI Unavailable (Offline)` with contextual fallback evidence | Panel collapsed; direct physician diagnostic assessment |
| **Treatment Plan & Orders** | AI-suggested draft orders from clinical perspectives | Physician enters medications, labs, and instructions manually | Physician enters medications, labs, and instructions manually |
| **Safety Gate Evaluation** | Cloud Jev probability score + Deterministic rule engine | Deterministic rule engine executes locally in Node / client | Deterministic rule engine executes locally in Node / client |
| **Physician Review & Sign-Off** | Cryptographic provenance minted & signed via API | Local draft envelope signed by attending physician | Local draft envelope signed and stored in local queue |
| **FHIR Persistence** | Live atomic transaction bundle committed to Medplum R4 / Epic | Transaction bundle staged in background reconciliation queue | Transaction bundle saved to offline retry queue |
| **Patient Handoff Care Plan** | Formatted plain-language summary with print / copy | Formatted plain-language summary with print / copy | Formatted plain-language summary with print / copy |

---

## 3. Truthful Declaration of Current Limitations

To prevent false claims of full peer-to-peer or local edge LLM autonomy, the following limitations are explicitly documented:

1. **Local Speech Recognition Dependency:**
   Full offline speech-to-text requires the host machine to have a local Whisper binary installed (e.g., `whisper` CLI or MLX whisper). If the local binary is absent and internet access is severed, voice recording buffers are preserved locally, but real-time text transcription degrades to manual keyboard entry. Proton **NEVER** fabricates a simulated transcript during an outage.
2. **Local Vector Search:**
   Vector retrieval uses deterministic normalized projections (`proton-clinical-embed-v1`) that operate entirely in-memory with zero network latency. If deep external PubMed RAG is requested while offline, the workstation surfaces an explicit alert: `Evidence Grounding: Offline Mode (Local Guidelines Only)`.
3. **FHIR Store Synchronization:**
   When the remote FHIR server is unreachable, encounters are committed to the local `jobRepository` queue with status `PENDING_SYNC`. Upon network restoration, the background `reconciliationWorker` commits transactions in chronological order.

---

## 4. UI/UX Degraded State Presentation

When an AI provider error occurs:
- **No Infinite Spinners:** Timeouts terminate strictly within 3,500ms.
- **Clear Status Badge:** The workstation header displays `AI Offline • Manual Documentation Mode` in calm slate styling (no alarming red banners that induce panic during a patient encounter).
- **Collapsible Transcript Drawer:** Pressing `⌘T` collapses the ambient scribe drawer to give maximum screen real estate to the physician's SOAP note editor.
- **Unimpeded Sign-Off:** The "Review & Complete Encounter" flow remains 100% active. A physician does not need AI clearance to approve a consultation.
