# Proton — MedGemma 1.5 4B Local AI Provider Guide

> **Status:** Local Development & Synthetic Physician Evaluation Build  
> **Target Model:** `google/medgemma-1.5-4b-it` (Google MedGemma 1.5 4B Instruction-Tuned)  
> **Serving Engine:** Local OpenAI-compatible server (vLLM recommended)  
> **Notice:** *Not clinically validated, certified medical device, production-ready, or PHI-ready. For local development and controlled synthetic physician evaluation only.*

---

## 1. Overview & Architecture

Proton integrates **MedGemma 1.5 4B** (`google/medgemma-1.5-4b-it`) as a **local development AI provider**. MedGemma serves as a medical specialist model for draft clinical note generation and multimodal medical document understanding.

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
│   ├── Gemini (Cloud)                                   │
│   ├── Demo (Offline Fixtures)                          │
│   └── MedGemma (Local Development Provider)            │
└──────────────────────────┬─────────────────────────────┘
                           │  HTTP / OpenAI-Compatible (/v1)
                           ▼
┌────────────────────────────────────────────────────────┐
│             LOCAL INFERENCE SERVER (vLLM)              │
│                 http://localhost:8000/v1               │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│             google/medgemma-1.5-4b-it                  │
│       4B Vision-Language Medical Foundation Model      │
└────────────────────────────────────────────────────────┘
```

### Safety & Clinical Boundary Rules
1. **The Attending Physician Remains the Final Authority:** MedGemma outputs are preliminary draft proposals only.
2. **Zero Autonomous FHIR Writes:** The model never writes directly to Medplum FHIR or persistent storage.
3. **Mandatory Deterministic Safety Gates:** All AI outputs undergo deterministic clinical verification (allergy conflicts, medication therapy rules, 5-field prescription checks) and explicit physician sign-off.
4. **Synthetic Beta Only:** Zero real patient or protected health information (PHI) may be entered into this environment.

---

## 2. Prerequisites

To run MedGemma 1.5 4B locally, you need:

- **Operating System:** Linux (Ubuntu 20.04+ recommended) or macOS (Apple Silicon M1/M2/M3/M4)
- **Python:** Python 3.10 or 3.11
- **Inference Engine:** `vllm` (recommended for Linux/CUDA) or `ollama` / `transformers`
- **Hugging Face Account:** MedGemma is a gated Google model requiring community terms acceptance.
- **Hardware:**
  - **NVIDIA GPU (CUDA):** >= 10-12 GB VRAM for bfloat16, or >= 6 GB VRAM for 4-bit/8-bit quantized.
  - **Apple Silicon:** M-series Mac with >= 16 GB unified memory.
  - **CPU-only:** Supported for testing and functional development (slower generation speed).

---

## 3. How to Download & Access the Model

MedGemma 1.5 4B is distributed via Hugging Face:
[https://huggingface.co/google/medgemma-1.5-4b-it](https://huggingface.co/google/medgemma-1.5-4b-it)

### Step 1: Accept the License Agreement
1. Visit `https://huggingface.co/google/medgemma-1.5-4b-it` in your browser.
2. Log in with your Hugging Face account and accept the MedGemma research & development terms.

### Step 2: Authenticate via Hugging Face CLI
In your local terminal:
```bash
pip install huggingface_hub
huggingface-cli login
```
Enter your Hugging Face user access token when prompted.

---

## 4. How to Start the Local Inference Server

We recommend **vLLM** because it natively exposes high-throughput OpenAI-compatible endpoints (`/v1/chat/completions` and `/v1/models`) supporting vision-language inputs.

### Option A: Standard vLLM Server (Linux / NVIDIA CUDA)
```bash
# 1. Install vLLM
pip install vllm

# 2. Launch the inference server on port 8000
vllm serve google/medgemma-1.5-4b-it \
  --port 8000 \
  --dtype bfloat16 \
  --gpu-memory-utilization 0.85 \
  --max-model-len 4096
```

### Option B: Apple Silicon (Mac MPS) / Alternative Local Serving
On Apple Silicon or machines using Ollama or llama.cpp:
```bash
# If using Ollama (with GGUF / converted weights):
ollama run medgemma:4b

# If using Hugging Face Transformers local test server:
python -m vllm.entrypoints.openai.api_server \
  --model google/medgemma-1.5-4b-it \
  --port 8000
```

The server is ready when you see:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

---

## 5. Expected Localhost Endpoint

Once running, the inference server exposes standard OpenAI-compatible endpoints:

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `http://localhost:8000/v1/models` | `GET` | Health check and loaded model verification |
| `http://localhost:8000/v1/chat/completions` | `POST` | Text & multimodal image generation |

---

## 6. Proton Environment Variables

Configure Proton API to route to your local MedGemma server:

In `apps/api/.env`:
```env
# AI Provider Configuration
PROTON_AI_PROVIDER=medgemma
PROTON_AI_MODE=local

# Local MedGemma Inference Server
MEDGEMMA_BASE_URL=http://localhost:8000/v1
MEDGEMMA_MODEL=google/medgemma-1.5-4b-it

# Optional Request Timeout (milliseconds)
MEDGEMMA_TIMEOUT_MS=30000
```

> **Security Note:** Never commit Hugging Face access tokens, API keys, or model weights to source control.

---

## 7. How to Switch Between Providers

Proton's provider factory dynamically routes requests without requiring application restarts:

### Switch to MedGemma (Local Development)
```bash
PROTON_AI_PROVIDER=medgemma
PROTON_AI_MODE=local
```

### Switch to Gemini (Cloud Reference Provider)
```bash
PROTON_AI_PROVIDER=gemini
PROTON_AI_MODE=real
GEMINI_API_KEY=your_gemini_api_key
```

### Switch to Demo Fixtures (Zero Dependencies)
```bash
PROTON_AI_PROVIDER=demo
PROTON_AI_MODE=demo
```

Proton strictly enforces **Zero Silent Fallback**: if MedGemma is selected but the local server is offline, Proton returns an explicit `503 MEDGEMMA_UNAVAILABLE` error rather than secretly forwarding requests to Gemini.

---

## 8. How to Test the Connection

### 1. Test Local Server Directly
```bash
curl http://localhost:8000/v1/models
```
Expected response:
```json
{"object":"list","data":[{"id":"google/medgemma-1.5-4b-it","object":"model"}]}
```

### 2. Test Proton AI Health Endpoint
```bash
curl http://localhost:3002/health/ai
```
Expected response:
```json
{
  "status": "ok",
  "mode": "local",
  "provider": "medgemma",
  "model": "google/medgemma-1.5-4b-it",
  "configured": true,
  "reachable": true
}
```

### 3. Run the Automated Provider Test Suite
```bash
node apps/api/tests/medgemma_provider_test.cjs
```
This runs 9 automated unit tests verifying initialization, reachability, vLLM payload encoding, structured JSON schema extraction, and boundary handling.

### 4. Run the Technical Benchmark
```bash
node apps/api/tests/medgemma_benchmark.cjs
```

---

## 9. Troubleshooting

### Problem: `503 MEDGEMMA_UNAVAILABLE`
- **Cause:** Proton API cannot connect to `http://localhost:8000/v1`.
- **Fix:** Verify your vLLM server is running. Check with `curl http://localhost:8000/v1/models`. Verify port matches `MEDGEMMA_BASE_URL`.

### Problem: Port 8000 Already in Use
- **Cause:** Another process is listening on port 8000.
- **Fix:** Launch vLLM on another port (e.g. `--port 8008`) and update `MEDGEMMA_BASE_URL=http://localhost:8008/v1` in `apps/api/.env`.

### Problem: CUDA Out of Memory (OOM)
- **Cause:** GPU has insufficient free VRAM for 4B parameters at `bfloat16`.
- **Fix:**
  1. Add `--gpu-memory-utilization 0.75`
  2. Reduce context length: `--max-model-len 2048`
  3. Use 4-bit or 8-bit quantized weights if supported by your runtime.

### Problem: Audio Transcription Refused
- **Cause:** Audio file uploaded to `/api/transcribe`.
- **Design:** MedGemma 1.5 4B is a vision-language foundation model, not a speech-to-text model. Audio consultations require Whisper or multimodal Gemini.

---

## 10. Hardware Limitations & Specifications

| Hardware Profile | Model Format | VRAM / RAM | Typical Latency | Supported Workloads |
| :--- | :--- | :--- | :--- | :--- |
| **High GPU (NVIDIA RTX 4090 / A10G / A100)** | `bfloat16` unquantized | 12GB - 24GB VRAM | Fast (< 1.5s) | Document extraction, image understanding, clinical notes |
| **Mid GPU (RTX 3060 / 4060 8GB-12GB)** | `bfloat16` or `float16` | 8GB - 12GB VRAM | Moderate (1.5s - 3s) | Document extraction, note generation |
| **Apple Silicon (M1/M2/M3 Max 32GB+)** | Metal / MPS | Unified Memory | Moderate (2s - 4s) | Local development & testing |
| **CPU Only (x86_64 / ARM)** | Quantized / float32 | >= 16GB System RAM | Slow (> 8s) | Development verification only |

*Note: All memory requirements are derived directly from the 4-billion parameter architecture and standard KV-cache allocations.*
