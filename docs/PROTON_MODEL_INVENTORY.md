# PROTON MODEL INVENTORY
**Comprehensive Inventory of AI & Inference Providers**
*Milestone 0.5 Deliverable — Baseline Verification of Existing Models as of 2026-10-18*

---

## 1. Overview

Proton utilizes a multi-model architecture where distinct providers handle transcription, clinical structured reasoning, multimodal analysis, and local inference. This inventory catalogs every model integration present in the codebase today.

---

## 2. Active Model Ledger

### 2.1 Google Gemini Provider
* **Provider:** Google AI / Google Cloud Vertex AI
* **Model:** `gemini-3.8-flash` (configurable via `GEMINI_MODEL` or `PROTON_AI_MODEL`)
* **Purpose:** Primary cloud generative intelligence for clinical note synthesis (SOAP), consultation labeling, conversational chat, and multimodal document/image inspection.
* **Location:** `apps/api/providers/gemini.js`
* **API / SDK:** Official `@google/genai` Node.js SDK (v2.27.0)
* **Input:** Audio buffers, text dialogue strings, patient demographic/clinical context, image/PDF binary buffers, target JSON schemas.
* **Output:** Structured JSON conforming to `responseSchema` (e.g. `SOAP_NOTE_SCHEMA`, `DOCUMENT_SCHEMA`), raw transcription text, chat responses.
* **Streaming Support:** Supported via SSE in `/api/clinical/pipeline/stream` and `/api/clinical/streams`.
* **Structured Output Support:** Native `responseSchema` with strict schema validation.
* **Cost:** Variable API pricing per million tokens; highly cost-efficient Flash tier.
* **Latency:** 450 ms–1.8 s typical turn-around for full SOAP note drafting.
* **Failure Behavior:** Catches API timeouts and errors; throws `AIProviderError` with status code 502/504.
* **Fallback Behavior:** Fails closed. In live mode, **NEVER** silently falls back to synthetic mock data.
* **Clinical Usage:** Drafts clinical documentation; all outputs tagged with `AI DRAFT — REVIEW REQUIRED` provenance badges.
* **Tests:** `apps/api/tests/gemini_live_smoke.cjs`, `apps/api/tests/clinical_ai_validation.cjs`.

### 2.2 Local MedGemma Provider (Private / On-Premise)
* **Provider:** Local Apple Silicon MLX-VLM / vLLM runtime
* **Model:** `mlx-community/medgemma-1.5-4b-it-4bit` (configurable via `MEDGEMMA_MODEL`)
* **Purpose:** Fully offline, zero-data-leakage private clinical reasoning and local note synthesis for hospital/clinic environments.
* **Location:** `apps/api/providers/medgemma.js`
* **API / SDK:** Local HTTP OpenAI-compatible endpoints (`/v1/chat/completions`)
* **Input:** Prompt strings, transcribed consultation text, JSON output templates.
* **Output:** Parsed JSON clinical notes and consultation summaries.
* **Streaming Support:** Yes (supports OpenAI-compatible chunked SSE streams).
* **Structured Output Support:** Enforces JSON schema through prompt templates and post-generation regex/JSON parsing.
* **Cost:** $0 marginal compute cost (runs on local Apple Silicon M2/M3/M4 or server GPU).
* **Latency:** 800 ms–2.5 s on Apple Silicon hardware with 4-bit quantization.
* **Failure Behavior:** Detects connection refusal (`ECONNREFUSED`); raises explicit `MEDGEMMA_UNAVAILABLE` error (503).
* **Fallback Behavior:** Fails closed. Does not fabricate output if local server is down.
* **Clinical Usage:** Hospital and private clinic deployments requiring complete PHI data localization.
* **Tests:** `apps/api/tests/medgemma_provider_test.cjs`, `apps/api/tests/medgemma_benchmark.cjs`, `apps/api/tests/medgemma_e2e_verification.cjs`.

### 2.3 DeepSeek Provider
* **Provider:** DeepSeek AI
* **Model:** `deepseek-chat` / `deepseek-flash`
* **Purpose:** High-efficiency alternative generative LLM provider for note drafting and clinical summarization.
* **Location:** `apps/api/providers/deepseek.js`
* **API / SDK:** DeepSeek REST API (`https://api.deepseek.com/v1/chat/completions`)
* **Input:** System prompt, user clinical context, note schema.
* **Output:** JSON structured clinical notes.
* **Streaming Support:** Yes.
* **Structured Output Support:** Prompt-enforced JSON schema.
* **Cost:** Low cost per million tokens.
* **Latency:** 600 ms–2.0 s.
* **Failure Behavior:** Throws formatted `AIProviderError` on API failure or invalid authentication.
* **Fallback Behavior:** Fails closed.
* **Clinical Usage:** Alternative cloud provider option for cost optimization.
* **Tests:** `apps/api/tests/deepseek_provider_test.cjs`, `apps/api/tests/deepseek_live_smoke.cjs`.

### 2.4 Grok Provider
* **Provider:** xAI
* **Model:** `grok-2-vision-1212`
* **Purpose:** Alternative multimodal visual reasoning and clinical document review provider.
* **Location:** `apps/api/providers/grok.js`
* **API / SDK:** xAI REST API (`https://api.x.ai/v1/chat/completions`)
* **Input:** Multi-modal image URLs/base64 strings, user prompt.
* **Output:** JSON structured note or visual analysis.
* **Streaming Support:** Yes.
* **Structured Output Support:** Prompt-guided JSON schema.
* **Cost:** Standard xAI commercial pricing.
* **Latency:** 1.0 s–3.0 s.
* **Failure Behavior:** Fails closed; requires valid `XAI_API_KEY`.
* **Fallback Behavior:** Fails closed without fallback fabrication.
* **Clinical Usage:** Secondary provider for multimodal benchmark validation.
* **Tests:** `apps/api/tests/grok_live_validation.cjs`.

### 2.5 Demo / Offline Synthetic Mock Provider
* **Provider:** Internal Proton Deterministic Engine
* **Model:** `demo-mock-model`
* **Purpose:** 100% deterministic, zero-credential, offline development and automated CI testing using synthetic patient cohorts (Eleanor Vance, Arthur Pendelton).
* **Location:** `apps/api/providers/demo.js`
* **API / SDK:** Synchronous in-memory JavaScript class.
* **Input:** Audio buffers, text dialogue, document buffers.
* **Output:** Pre-calculated, realistic clinical SOAP notes with valid FHIR references, structured findings, and differential candidates.
* **Streaming Support:** Simulated progressive emission via timer ticks.
* **Structured Output Support:** 100% schema-compliant JSON.
* **Cost:** $0.
* **Latency:** < 10 ms.
* **Failure Behavior:** Fails predictably when passed null/corrupt inputs.
* **Fallback Behavior:** Default provider when `PROTON_AI_MODE=demo`.
* **Clinical Usage:** Strictly for validation, education, and automated test pipelines.
* **Tests:** `milestone1_architecture_validation.cjs`, `milestone1_clinical_integrity_validation.cjs`.

### 2.6 Whisper Speech Recognition
* **Provider:** OpenAI Whisper / Local CLI wrapper
* **Model:** Whisper `base` / `small` / `turbo`
* **Purpose:** High-fidelity ambient speech transcription for clinical consultations and physician dictation.
* **Location:** `apps/api/services/voice/whisperProvider.js` (backed by vendored `whisper-main/`)
* **API / SDK:** Child process CLI / Python execution.
* **Input:** Raw audio buffers (`audio/wav`, `audio/m4a`).
* **Output:** Plaintext clinical dialogue transcript with timestamps.
* **Streaming Support:** Chunked audio processing.
* **Structured Output Support:** Plaintext transcript; downstream stages perform clinical extraction.
* **Cost:** $0 compute cost when run locally.
* **Latency:** 200 ms–1.2 s per audio segment depending on model size.
* **Failure Behavior:** Returns `WHISPER_UNAVAILABLE` (503) if runtime binary is absent.
* **Fallback Behavior:** Fails closed or passes raw audio buffer to Gemini audio transcription.
* **Clinical Usage:** Ambient room transcription.
* **Tests:** Audio input validation in `milestone1_architecture_validation.cjs`.

### 2.7 Jev Safety Guardrail & Verification Harness
* **Provider:** TypeSafe AI / Jev System One Architecture (currently implemented as an in-process probabilistic validator)
* **Model:** Jev Probability Engine
* **Purpose:** Fast-path (< 10 ms) probabilistic evaluation of medication safety, zero-hallucination drug verification against Open Targets, and safety gating.
* **Location:** `apps/api/services/clinical/jevSafetyGuardrailService.js`
* **API / SDK:** Native Node.js service module.
* **Input:** Drafted medication text, pre-verified candidate drug pool, patient clinical profile (allergies, active meds, eGFR, conditions).
* **Output:** Jev Safety Scorecard with probability (0.00–1.00), violations, warnings, and boolean gate approval ($\ge 0.95$).
* **Streaming Support:** Synchronous sub-millisecond calculation.
* **Structured Output Support:** Strict scorecard object schema.
* **Cost:** $0 marginal compute cost.
* **Latency:** 2 ms–15 ms.
* **Failure Behavior:** Returns `{ isAligned: false, safetyProbability: 0.0 }` on critical error or missing context.
* **Fallback Behavior:** Flags draft as `UNSAFE`; triggers regenerative critique loop or requires manual physician override.
* **Clinical Usage:** Gating medication suggestions before doctor review.
* **Tests:** `apps/api/tests/medication_agent_opentargets_jev_validation.cjs`.

---

## 3. Model Architecture Matrix

| Model Provider | Primary Role | Hosting | Structured Output | Live In Live Pipeline? |
|---|---|---|:---:|:---:|
| **Google Gemini 3.8 Flash** | Note generation, multimodal analysis | Cloud (Google Cloud Vertex) | YES (Zod / Schema) | YES |
| **Local MedGemma 1.5 4B** | Private note generation & extraction | Local (Apple Silicon / GPU) | YES (Template) | Configurable |
| **DeepSeek Chat** | General note generation | Cloud (DeepSeek API) | YES (Prompt Schema) | Configurable |
| **xAI Grok-2-vision** | Multimodal clinical imaging | Cloud (xAI API) | YES (Prompt Schema) | Configurable |
| **Demo Provider** | CI test & offline synthetic validation | Local Memory | YES (Deterministic) | Default in demo |
| **OpenAI Whisper** | Ambient speech-to-text | Local / CLI | N/A (Transcription) | YES |
| **Jev Guardrail Engine** | High-speed safety & routing decision | Local / In-process | YES (Scorecard) | YES |
