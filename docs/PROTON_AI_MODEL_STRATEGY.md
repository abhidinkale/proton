# PROTON AI MODEL STRATEGY & PROVIDER ABSTRACTION

**Date:** 2026-10-18  
**Architecture Version:** Milestone 2  
**System:** Proton Multi-Model Gateway Architecture

---

## 1. Provider Independence & ModelGateway

Proton is engineered with a strict **no-vendor-lock-in** policy. All generative AI requests are brokered through `ModelGateway` (`apps/api/services/ai/modelGateway.js`), which abstracts the underlying inference backends.

```
                  ModelGateway
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
[ Gemini 1.5 ]  [ DeepSeek R1 ]  [ Local MedGemma ]
  (Primary Cloud) (Complex Reason) (On-Premises / Offline)
```

### Supported Provider Types
1. **Cloud Foundation Models:**
   - Google Gemini (`gemini-1.5-flash`, `gemini-1.5-pro`): High-speed multimodal understanding, long-context chart synthesis, ambient audio transcription.
   - DeepSeek (`deepseek-reasoner`, `deepseek-chat`): Complex multi-step clinical differential reasoning and pharmacological contradiction cross-checking.
   - Anthropic / OpenAI Compatible: Drop-in alternative providers using standard REST / structured output endpoints.
2. **Local Healthcare Models:**
   - Google MedGemma: Future on-premises inference for high-privacy offline clinic deployments.
   - Self-hosted embedding models (e.g. `all-MiniLM-L6-v2` / `med-embeddings`): Generating normalized 384-dimensional dense vectors for local semantic retrieval.

---

## 2. Model Policy & Routing Rules

Each clinical agent registers an explicit `modelPolicy`:
- **`preferredModel`:** The primary model matched to the agent's reasoning requirements (e.g. `gemini-1.5-flash` for high-throughput note generation).
- **`fallbackModel`:** The backup model invoked if the primary provider experiences a rate limit (HTTP 429) or cloud outage (HTTP 500/503).
- **`timeoutMs`:** Strict execution timeout (default 3500ms for specialists, 10000ms for general consultation).
- **`temperature`:** Low temperature ($\le 0.1$) for deterministic clinical consistency.

---

## 3. Security, Privacy & Secret Management

1. **Server-Side Credentials:** API keys (`GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `JEV_API_KEY`) reside exclusively in server-side environment variables.
2. **Zero Client Secrets:** Provider credentials are never packaged into the Android APK, Web client bundles, Git commits, or client-facing SSE event streams.
3. **PHI Minimization:** Prompts sent to cloud model providers exclude unnecessary direct patient identifiers (SSN, home address, phone numbers) while preserving clinically necessary parameters (age, gender, symptoms, active medications, allergies).
4. **Fail-Closed Principle:** If all configured providers are unavailable, the gateway immediately returns a structured error (`PROVIDER_UNAVAILABLE`), preventing any synthetic fabrication of clinical drafts.
