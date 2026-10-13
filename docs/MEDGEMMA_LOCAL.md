# Proton — MedGemma 1.5 4B Local AI Provider Guide (MLX-VLM on Apple Silicon)

> **Status:** Local Development & Synthetic Physician Evaluation Build  
> **Server Runtime:** MLX-VLM 0.7.6 (Apple Silicon Metal / Unified Memory)  
> **Model:** `mlx-community/medgemma-1.5-4b-it-4bit` (4-bit quantized MedGemma 1.5 4B)  
> **Base URL:** `http://localhost:8000/v1`  
> **Notice:** *Not clinically validated, certified medical device, production-ready, or PHI-ready. For local development and controlled synthetic physician evaluation only.*

---

## 1. Overview & Architecture

Proton integrates **MedGemma 1.5 4B** (`mlx-community/medgemma-1.5-4b-it-4bit`) as a **local development AI provider** on Apple Silicon (M4/M3/M2/M1). MedGemma acts as a local vision-language medical foundation model for preliminary clinical note drafting and multimodal document fact extraction.

```
┌────────────────────────────────────────────────────────┐
│                      PROTON WEB                        │
│   Document Review UI / Consultation Scribe Interface   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                      PROTON API                        │
│             AI Provider Factory (getProvider)          │
│   ├── Gemini (Cloud Reference Provider)                │
│   ├── Demo (Deterministic Offline Fixtures)            │
│   └── MedGemma (Local Apple Silicon Specialist)        │
└──────────────────────────┬─────────────────────────────┘
                           │  HTTP OpenAI-Compatible (/v1)
                           ▼
┌────────────────────────────────────────────────────────┐
│                LOCAL MLX-VLM SERVER                    │
│              http://localhost:8000/v1                  │
│             Apple Silicon M4 Metal GPU                 │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│       mlx-community/medgemma-1.5-4b-it-4bit            │
│       4-Bit Quantized Vision-Language Foundation Model │
└────────────────────────────────────────────────────────┘
```

### Safety & Clinical Boundary Rules
1. **The Attending Physician Remains the Final Authority:** MedGemma outputs are preliminary draft proposals only.
2. **Zero Autonomous FHIR Writes:** The model never writes directly to Medplum FHIR or persistent clinical storage.
3. **Mandatory Deterministic Safety Gates:** All AI outputs undergo deterministic clinical verification (allergy conflicts, medication therapy rules, 5-field prescription checks) and explicit physician sign-off.
4. **Synthetic Beta Only:** Zero real patient or protected health information (PHI) may be entered into this environment.

---

## 2. Environment & Prerequisites

- **Hardware:** Apple Silicon Mac (M4, M3, M2, or M1 with unified memory)
- **Memory Footprint:** ~3.2 GB peak memory for the 4-bit model
- **Python Environment:** Python 3.12 (e.g. via virtualenv or conda)
- **MLX-VLM Version:** 0.7.6+

---

## 3. How to Start the Local MedGemma Server

In your Python 3.12 environment:

```bash
# 1. Ensure mlx-vlm is installed
pip install "mlx-vlm>=0.7.6"

# 2. Launch the MLX-VLM OpenAI-compatible server on port 8000
python -m mlx_vlm.server \
  --model mlx-community/medgemma-1.5-4b-it-4bit \
  --port 8000
```

The server is ready when the log shows:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

---

## 4. Proton Environment Variables

Configure Proton API to route to your local MLX-VLM server.

In `apps/api/.env`:

```env
# AI Provider Selection
PROTON_AI_PROVIDER=medgemma
PROTON_AI_MODE=local

# Local MLX-VLM Inference Server
MEDGEMMA_BASE_URL=http://localhost:8000/v1
MEDGEMMA_MODEL=mlx-community/medgemma-1.5-4b-it-4bit

# Maximum tokens and timeout
MEDGEMMA_MAX_TOKENS=1024
MEDGEMMA_TIMEOUT_MS=60000
```

> **Security Note:** Real API keys or cloud credentials are NOT required for the local MedGemma provider. Never commit secrets to source control.

---

## 5. How to Verify the Local Server

### 1. Verify Models Endpoint (`/v1/models`)
```bash
curl -s http://localhost:8000/v1/models
```
Expected response:
```json
{
  "object": "list",
  "data": [
    {
      "id": "mlx-community/medgemma-1.5-4b-it-4bit",
      "object": "model",
      "loaded": true
    }
  ]
}
```

### 2. Verify Text Chat Completion (`/v1/chat/completions`)
```bash
curl -s http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mlx-community/medgemma-1.5-4b-it-4bit",
    "messages": [
      {"role": "user", "content": "Respond with valid JSON only: {\"status\": \"ok\"}"}
    ],
    "temperature": 0.1,
    "max_tokens": 100
  }'
```

### 3. Verify Multimodal Image Completion
```bash
curl -s http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mlx-community/medgemma-1.5-4b-it-4bit",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "Describe this image."},
          {"type": "image_url", "image_url": {"url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="}}
        ]
      }
    ],
    "temperature": 0.1,
    "max_tokens": 100
  }'
```

---

## 6. How to Start Proton

### Step 1: Start Proton API Backend
In `apps/api`:
```bash
# Starts Proton API server on port 3002
node index.js
```
Console output will confirm:
```
Proton Backend API running on port 3002
AI Pipeline: mode=local, provider=medgemma, model=mlx-community/medgemma-1.5-4b-it-4bit, configured=true
```

### Step 2: Verify Proton AI Health Status
```bash
curl -s http://localhost:3002/health/ai
```
Expected response:
```json
{
  "status": "ok",
  "mode": "local",
  "provider": "medgemma",
  "model": "mlx-community/medgemma-1.5-4b-it-4bit",
  "configured": true,
  "reachable": true
}
```

### Step 3: Start Proton Web Frontend
In `apps/web`:
```bash
npm run dev
```
Open `http://localhost:5173` (or `http://localhost:3000`).
In **Settings** or **Document Review**, the UI displays:
`AI Provider: MedGemma Local (Dev)` and `Local AI • MedGemma 1.5 4B`.

---

## 7. How to Switch Between Providers

Proton's provider factory dynamically routes requests without architectural changes:

- **Switch to Local MedGemma:**
  ```bash
  PROTON_AI_PROVIDER=medgemma
  PROTON_AI_MODE=local
  ```
- **Switch to Gemini (Cloud Reference):**
  ```bash
  PROTON_AI_PROVIDER=gemini
  PROTON_AI_MODE=real
  ```
- **Switch to Demo Fixtures (Deterministic Mock):**
  ```bash
  PROTON_AI_PROVIDER=demo
  PROTON_AI_MODE=demo
  ```

**Zero Silent Fallback:** If MedGemma is configured but the local server on port 8000 is not running, Proton returns an explicit `503 MEDGEMMA_UNAVAILABLE` error to provide clear feedback.

---

## 8. Automated Testing

Run the automated MedGemma test suite:
```bash
node apps/api/tests/medgemma_provider_test.cjs
```
Verifies 10 automated test cases:
1. Provider initialization & defaults
2. Health status metadata clean & secret-free
3. Unreachable server handling (explicit 503 `MEDGEMMA_UNAVAILABLE`)
4. Successful local request handling against OpenAI-compatible server
5. Structured output handling, thinking token stripping (`<unused94>thought...<unused95>`) and markdown fence stripping
6. Provider factory routing
7. Zero silent fallback to Gemini or DeepSeek
8. Malformed responses and HTTP 500 handling
9. Audio transcription safety refusal (informative direction to Whisper/Gemini)
10. Live local MLX-VLM server verification

---

## 9. Troubleshooting & Compatibility

### Thinking Tokens in Output
MedGemma uses reasoning tokens (`<unused94>thought...<unused95>`). The Proton `MedGemmaProvider` automatically strips these tokens before JSON parsing, preserving clean structured output.

### `response_format` Loop Prevention
In MLX-VLM 0.7.6, unconstrained `response_format: {"type": "json_object"}` can cause sampler looping (`{"": ...}`). The Proton MedGemma provider instructs the model directly via prompt schema constraints and parses the resulting JSON, ensuring rapid token generation without loops.

### Audio Transcription
MedGemma 1.5 4B is a vision-language medical model without native audio processing. The consultation audio workflow requires Whisper or multimodal Gemini.
