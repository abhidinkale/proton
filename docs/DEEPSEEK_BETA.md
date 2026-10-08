# Proton — DeepSeek AI Provider Integration Guide (Controlled Physician Beta)

> **Status:** Controlled Synthetic-Data Physician Validation Build  
> **Target Provider:** DeepSeek API  
> **Primary Model:** `deepseek-flash` (DeepSeek V4.1-Flash)  
> **Notice:** *Not certified as medical-grade, clinically validated, production-ready, or PHI-ready. For controlled synthetic physician validation only.*

---

## 1. Overview & Architecture

Proton integrates DeepSeek via its pluggable AI provider architecture (`AIProvider` interface). DeepSeek serves as an alternative/primary LLM backend for generating draft clinical notes and structured document extractions from synthetic consultation data.

```
┌────────────────────────────────────────────────────────┐
│                   AMBIENT / DIALOGUE                   │
│      Synthetic consultation transcript or document     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                  DEEPSEEK PROVIDER                     │
│    Model: deepseek-flash | JSON-schema enforcement     │
│    Preliminary DRAFT generation ONLY                   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│         DETERMINISTIC CLINICAL SAFETY GATES            │
│    - Template completeness (SOAP / Standard)           │
│    - Allergy conflict detection                        │
│    - Duplicate medication therapy checks               │
│    - 5-field structured prescription validation        │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│               PHYSICIAN REVIEW & SIGN-OFF              │
│    Doctor edits, acknowledges warnings, signs off      │
│    Note provenance: "Edited by physician"              │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                ATOMIC FHIR PERSISTENCE                 │
│    Medplum FHIR Encounter + MedicationRequest Bundle   │
│    Immutable Audit Trail Record                        │
└────────────────────────────────────────────────────────┘
```

### Core Clinical Rule:
**The attending physician remains the final authority.** DeepSeek produces drafts and preliminary extractions only. DeepSeek never autonomously diagnoses, prescribes, modifies active medications, or writes to FHIR.

---

## 2. Environment Configuration

### Required Server-Side Environment Variables

When running in **Real Mode with DeepSeek**, configure `apps/api/.env`:

```bash
# Operating Mode
PROTON_AI_MODE=real
PROTON_AI_PROVIDER=deepseek

# DeepSeek API Secret & Model
DEEPSEEK_API_KEY=<your-deepseek-api-key>
DEEPSEEK_MODEL=deepseek-flash
```

### Security & Secret Isolation:
- `DEEPSEEK_API_KEY` is strictly server-side.
- The API key is **never** bundled or exposed to frontend code.
- The API key is **never** printed in server logs or included in telemetry.
- All errors are programmatically sanitized to redact authorization tokens and key patterns (`_sanitizeError`).

---

## 3. Demo Mode vs. Real Mode

### Returning to Demo Mode (Default):
To switch back to deterministic local mock generation without making external API calls:

```bash
PROTON_AI_MODE=demo
PROTON_AI_PROVIDER=demo
```

In Demo Mode:
- Zero external network requests are made.
- Zero API credits are consumed.
- Deterministic mock clinical notes and document extractions are generated instantly.

### Real Mode with DeepSeek:
When `PROTON_AI_MODE=real` and `PROTON_AI_PROVIDER=deepseek`:
- The API factory initializes `DeepSeekProvider`.
- If `DEEPSEEK_API_KEY` is missing, the backend returns an explicit HTTP 503 configuration error:
  `"AI note generation service configuration error. Please check server settings."`
- There is **no silent fallback** to Demo Mode when Real Mode is requested.

---

## 4. Telemetry & Cost Observability

Proton captures safe, non-PHI telemetry on every AI provider invocation:

- `provider`: `deepseek`
- `operation`: `generateNote` / `extractDocument`
- `status`: `success` / `failure`
- `model`: `deepseek-flash`
- `latencyMs`: Elapsed time in milliseconds
- `tokens`:
  - `input`: Prompt tokens (`prompt_tokens`)
  - `output`: Completion tokens (`completion_tokens`)
  - `total`: Total tokens (`total_tokens`)

**Zero PHI Protection:** Prompts, transcripts, patient names, medical histories, full completions, and API keys are strictly excluded from telemetry payloads.

---

## 5. Testing & Verification

### 1. Deterministic Architecture & Unit Tests (Local, zero API credits):
```bash
node apps/api/tests/deepseek_provider_test.cjs
```
Verifies:
- Factory routing in demo and real modes
- Safe configuration errors when credentials are absent
- Model initialization with `deepseek-flash`
- Error message sanitization and key redaction
- Safe rejection of empty inputs

### 2. Live Smoke Test (Opt-in with real key):
```bash
node apps/api/tests/deepseek_live_smoke.cjs
```
- If `DEEPSEEK_API_KEY` is absent, cleanly skips and exits 0.
- If `DEEPSEEK_API_KEY` is present, executes live synthetic note generation and document extraction, validating JSON schema outputs.

### 3. Full Physician Regression Suite:
```bash
node apps/web/tests/physician_validation_checklist.cjs
node apps/web/tests/command_center_v2_e2e.cjs
node apps/web/tests/safety_e2e.cjs
node apps/web/tests/prescription_e2e.cjs
```

---

## 6. Disabling DeepSeek

To disable DeepSeek completely and return Proton to local demo execution:
1. In `apps/api/.env`, set:
   ```bash
   PROTON_AI_MODE=demo
   PROTON_AI_PROVIDER=demo
   ```
2. Restart the API daemon (`node apps/api/index.js`).
3. Check status:
   ```bash
   curl http://localhost:3002/health/ai
   ```
   Output: `{"status":"ok","mode":"demo","provider":"demo","model":"demo-mock-model","configured":true}`
