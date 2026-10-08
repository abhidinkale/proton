require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Type } = require('@google/genai');
const { getProvider, getProviderStatus } = require('./providers/factory');

const app = express();

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS 
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173'
    ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS request blocked: Origin not allowed.'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// --- SAFE NON-PHI TELEMETRY LOGGER ---
function logAiTelemetry({ provider, operation, status, latencyMs, inputBytes, outputBytes, model, errorCategory, tokens }) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'AI_PROVIDER_TELEMETRY',
    provider: provider || 'unknown',
    operation: operation || 'unknown',
    status: status || 'unknown',
    latencyMs: latencyMs || 0,
    inputBytes: inputBytes || 0,
    outputBytes: outputBytes || 0,
    model: model || 'unknown',
    errorCategory: errorCategory || null,
    tokens: tokens || null
  }));
}

// Operational health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: process.env.PROTON_AI_MODE || 'demo',
    timestamp: new Date().toISOString()
  });
});

// Phase 15: Developer / Admin AI Status endpoint
app.get('/health/ai', (req, res) => {
  const status = getProviderStatus();
  res.json({
    status: 'ok',
    mode: status.mode,
    provider: status.provider,
    model: status.model,
    configured: status.configured,
    timestamp: new Date().toISOString()
  });
});

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10MB limit per file, max 5 files
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'audio/webm', 'audio/wav', 'audio/mp3', 'audio/mp4', 'audio/mpeg', 'audio/ogg'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, JPG, PNG, and Audio files are allowed.`));
    }
  }
});

const getNoteSchema = (template) => {
  if (template === 'SOAP') {
    return {
      type: Type.OBJECT,
      properties: {
        subjective: { type: Type.STRING },
        objective: { type: Type.STRING },
        assessment: { type: Type.STRING },
        plan: { type: Type.STRING }
      },
      required: ["subjective", "objective", "assessment", "plan"]
    };
  }
  return {
    type: Type.OBJECT,
    properties: {
      chiefComplaint: { type: Type.STRING },
      historyOfPresentIllness: { type: Type.STRING },
      relevantHistory: { type: Type.STRING },
      medications: { type: Type.ARRAY, items: { type: Type.STRING } },
      allergies: { type: Type.ARRAY, items: { type: Type.STRING } },
      examinationFindings: { type: Type.STRING },
      investigations: { type: Type.ARRAY, items: { type: Type.STRING } },
      assessment: { type: Type.STRING },
      plan: { type: Type.STRING },
      followUp: { type: Type.STRING }
    },
    required: ["chiefComplaint", "historyOfPresentIllness", "relevantHistory", "medications", "allergies", "examinationFindings", "investigations", "assessment", "plan", "followUp"]
  };
};

const documentSchema = {
  type: Type.OBJECT,
  properties: {
    document_date: { type: Type.STRING },
    document_type: { type: Type.STRING },
    facts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: ["medication", "diagnosis", "lab", "procedure", "allergy", "other"] },
          text: { type: Type.STRING },
          confidence: { type: Type.NUMBER, description: "0.0 to 1.0" },
          source_quote: { type: Type.STRING }
        },
        required: ["category", "text", "confidence", "source_quote"]
      }
    }
  },
  required: ["document_date", "document_type", "facts"]
};

// Safe timeout wrapper (Phase 11)
function withTimeout(promise, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`Operation timed out after ${timeoutMs}ms`);
      err.name = 'TimeoutError';
      reject(err);
    }, timeoutMs);

    promise.then(
      res => { clearTimeout(timer); resolve(res); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

// Resilient execution with capped retries and safe logging (Phase 10 & 11)
async function executeProviderOperation(operationName, provider, inputBytes, fn, maxRetries = 2) {
  const startTime = Date.now();
  let attempt = 0;
  const modelName = provider.modelName || 'unknown';
  const providerType = provider.constructor.name.replace('Provider', '').toLowerCase();

  while (attempt <= maxRetries) {
    try {
      const response = await withTimeout(fn(), 30000);
      const latencyMs = Date.now() - startTime;
      const outputBytes = response.text ? Buffer.byteLength(response.text, 'utf-8') : 0;
      const usage = response.usageMetadata || {};

      logAiTelemetry({
        provider: providerType,
        operation: operationName,
        status: 'success',
        latencyMs,
        inputBytes,
        outputBytes,
        model: modelName,
        tokens: usage.totalTokenCount ? {
          input: usage.promptTokenCount,
          output: usage.candidatesTokenCount,
          total: usage.totalTokenCount
        } : null
      });

      return response;
    } catch (error) {
      attempt++;
      const isTimeout = error.name === 'TimeoutError';
      const status = error.status || 500;
      const isTransient = isTimeout || status === 429 || status === 503;

      if (!isTransient || attempt > maxRetries) {
        const latencyMs = Date.now() - startTime;
        const errorCategory = isTimeout ? 'timeout' : status === 429 ? 'rate_limit' : status === 401 || status === 403 ? 'auth_error' : 'provider_error';

        logAiTelemetry({
          provider: providerType,
          operation: operationName,
          status: 'failure',
          latencyMs,
          inputBytes,
          outputBytes: 0,
          model: modelName,
          errorCategory
        });

        throw error;
      }

      // Brief backoff before capped retry
      const delayMs = attempt * 800 + Math.random() * 400;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// --- 1. TRANSCRIPTION ENDPOINT (Phase 5) ---
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
    return res.status(400).json({ error: 'No audio file provided or audio file is empty.' });
  }

  let provider;
  try {
    provider = getProvider();
  } catch (configErr) {
    return res.status(503).json({ error: 'AI transcription service configuration error. Please check server settings.' });
  }

  try {
    const inputBytes = req.file.buffer.length;
    const response = await executeProviderOperation('transcribe', provider, inputBytes, async () => {
      return await provider.transcribe(req.file.buffer, req.file.mimetype);
    });

    if (!response || typeof response.text !== 'string') {
      return res.status(502).json({ error: 'Malformed response received from transcription service.' });
    }

    res.json({ transcript: response.text });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      return res.status(504).json({ error: 'AI transcription service timed out. Please retry or continue manually.' });
    }
    const status = error.status === 429 ? 429 : 502;
    res.status(status).json({ error: 'AI transcription service unavailable. Please retry or continue manually.' });
  }
});

// --- 2. CLINICAL NOTE GENERATION ENDPOINT (Phase 6 & 7) ---
app.post('/api/generate-note', async (req, res) => {
  const { transcript, patientContext, template = 'General Consultation' } = req.body || {};

  if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
    return res.status(400).json({ error: 'Transcript is required to generate a clinical note.' });
  }

  let provider;
  try {
    provider = getProvider();
  } catch (configErr) {
    return res.status(503).json({ error: 'AI note generation service configuration error. Please check server settings.' });
  }

  const noteSchema = getNoteSchema(template);

  try {
    const inputBytes = Buffer.byteLength(transcript + (patientContext || ''), 'utf-8');
    const response = await executeProviderOperation('generateNote', provider, inputBytes, async () => {
      return await provider.generateNote(transcript, patientContext, noteSchema, template);
    });

    let jsonNote;
    try {
      jsonNote = typeof response.text === 'string' ? JSON.parse(response.text) : response.text;
    } catch (parseErr) {
      return res.status(502).json({ error: 'AI response could not be validated: malformed JSON output.' });
    }

    // Phase 7: Strict runtime validation of required clinical fields
    const requiredFields = noteSchema.required || [];
    for (const field of requiredFields) {
      if (jsonNote[field] === undefined || jsonNote[field] === null) {
        return res.status(502).json({ error: `AI response could not be validated against clinical note schema: missing '${field}'.` });
      }
    }

    res.json({
      note: jsonNote,
      usage: response.usageMetadata || undefined
    });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      return res.status(504).json({ error: 'AI note generation service timed out. Please retry or continue manually.' });
    }
    const status = error.status === 429 ? 429 : 502;
    res.status(status).json({ error: 'AI note generation service unavailable. Please retry or continue manually.' });
  }
});

// --- 3. DOCUMENT EXTRACTION ENDPOINT (Phase 8) ---
app.post('/api/extract-documents', upload.array('documents', 5), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No documents provided for clinical fact extraction.' });
  }

  let provider;
  try {
    provider = getProvider();
  } catch (configErr) {
    return res.status(503).json({ error: 'Document extraction service configuration error. Please check server settings.' });
  }

  try {
    const extractions = [];

    for (const file of req.files) {
      const inputBytes = file.buffer.length;
      const response = await executeProviderOperation('extractDocument', provider, inputBytes, async () => {
        return await provider.extractDocument(file.buffer, file.mimetype, file.originalname, documentSchema);
      });

      let result;
      try {
        result = typeof response.text === 'string' ? JSON.parse(response.text) : response.text;
      } catch (parseErr) {
        return res.status(502).json({ error: `Document extraction failed: malformed JSON for ${file.originalname}.` });
      }

      // Phase 8: Validate structured document extraction schema
      if (!result.document_date || !result.document_type || !Array.isArray(result.facts)) {
        return res.status(502).json({ error: `Extracted facts could not be validated against document schema for ${file.originalname}.` });
      }

      result.originalFileName = file.originalname;
      extractions.push(result);
    }

    res.json({ extractions });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Document extraction service timed out. Please retry or continue manually.' });
    }
    const status = error.status === 429 ? 429 : 502;
    res.status(status).json({ error: 'Document extraction service unavailable. Please retry or continue manually.' });
  }
});

// Safe Express error handling
app.use((err, req, res, next) => {
  if (err) {
    const status = err.message?.includes('CORS') ? 403 : (err.status || 400);
    res.status(status).json({ error: err.message || 'Request could not be processed.' });
  } else {
    next();
  }
});

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Proton Backend API running on port ${port}`);
  const status = getProviderStatus();
  console.log(`AI Pipeline: mode=${status.mode}, provider=${status.provider}, model=${status.model}, configured=${status.configured}`);
});
