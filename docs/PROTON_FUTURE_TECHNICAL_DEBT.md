# Proton Future Technical Debt & Architectural Roadmap

**Milestone 4 Deliverable**  
**Date:** October 18, 2026  
**System:** Proton — AI-Native Multi-Specialty Clinical Operating System

---

## 1. Principles of Pragmatic Engineering

During Milestones 0 through 4, Proton deliberately avoided premature architectural refactoring, fashionable rewrites (such as introducing Rust before the clinical workflow was stabilized), and unneeded microservices.

This document catalogs genuine future enhancements and architectural debt identified during Milestone 4 reality testing, structured with rationale, clinical impact, and recommended milestone assignment.

---

## 2. Technical Debt Catalog

### TD-01: Native OS Desktop Shell (Tauri / Rust)
- **Current Implementation:** Browser-based responsive web app (`apps/web`) running in Chrome/Edge/Safari.
- **Limitation:** Browser sandbox restricts access to global hardware hotkeys (when window is out of focus) and low-level system audio drivers (e.g., capturing remote telehealth audio from Zoom or Epic Teams).
- **Recommended Action:** Wrap `apps/web` in a lightweight Tauri desktop container with native audio capture hooks.
- **Target Milestone:** Milestone 5 (Desktop Packaging & Telehealth Audio Loopback).

### TD-02: Local On-Device Speech Model (Embedded Whisper / MLX)
- **Current Implementation:** Primary transcription delegates to Gemini Multimodal Audio or host `whisper` CLI when installed.
- **Limitation:** In total offline mode without a local Whisper CLI installed, audio is recorded but real-time text transcription degrades to manual typing.
- **Recommended Action:** Package a self-contained WebAssembly / ONNX Whisper base model directly within the client workstation bundle for zero-install offline speech recognition.
- **Target Milestone:** Milestone 5.

### TD-03: Real-Time Bidirectional WebSocket Streaming
- **Current Implementation:** Audio is captured in discrete webm audio chunks sent via HTTP POST to `/api/transcribe` and `/api/clinical/pipeline/stream`.
- **Limitation:** Discrete HTTP chunks introduce ~200ms connection overhead per dialogue turn compared to persistent bidirectional WebSocket or gRPC streams.
- **Recommended Action:** Upgrade ambient scribe transport to persistent WebSocket connection with Gemini Live / Live Audio streaming.
- **Target Milestone:** Milestone 6.

### TD-04: Scaled Specialist Manifest (50+ Sub-Specialties)
- **Current Implementation:** Dynamic registry with 4 baseline specialists (`cardiology.v1`, `neurology.v1`, `endocrinology.v1`, `internal-medicine.v1`).
- **Limitation:** While `SpecialistAgentRegistry` is architecturally unbounded and validates Phase F contracts, clinical scenarios needing Oncology, Rheumatology, or Infectious Disease rely on Internal Medicine fallback.
- **Recommended Action:** Expand plugin definitions in `specialistDefinitions.js` to include 20 high-frequency ambulatory sub-specialties.
- **Target Milestone:** Milestone 6.

### TD-05: Production SMART on FHIR Epic App Orchard Certification
- **Current Implementation:** Full OAuth2 PKCE, token exchange, and R4 Medplum / synthetic Epic transaction bundle syncing operational.
- **Limitation:** Live Epic / Cerner production deployment requires official EHR vendor partner certification and signed institutional certificates.
- **Recommended Action:** Execute Epic App Orchard sandbox test harness and production institutional certificate integration.
- **Target Milestone:** Enterprise Deployment Phase.
