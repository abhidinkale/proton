const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Type } = require('@google/genai');
const { getProvider, getProviderStatus } = require('./providers/factory');

const app = express();

const defaultLocalOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173'
];

const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS 
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];

const allowedOrigins = [...new Set([...defaultLocalOrigins, ...configuredOrigins])];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    const isAllowed = allowedOrigins.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        return regex.test(origin);
      }
      return pattern === origin;
    });

    if (isAllowed) {
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

// Operational health check (accessible at root or /api for various routing setups)
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    mode: process.env.PROTON_AI_MODE || 'demo',
    timestamp: new Date().toISOString()
  });
});

// Phase 15: Developer / Admin AI Status endpoint
app.get(['/health/ai', '/api/health/ai'], async (req, res) => {
  const status = getProviderStatus();
  let reachable = status.configured;

  if (status.provider === 'medgemma') {
    try {
      const provider = getProvider();
      if (typeof provider.isReachable === 'function') {
        reachable = await provider.isReachable(1000);
      }
    } catch {
      reachable = false;
    }
  }

  res.json({
    status: 'ok',
    mode: status.mode,
    provider: status.provider,
    model: status.model,
    configured: status.configured,
    reachable,
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
      const isTransient = (isTimeout || status === 429 || status === 503) && error.code !== 'AI_CHAT_UNAVAILABLE';

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
    if (error.message?.includes('MedGemma audio transcription is not supported')) {
      return res.status(501).json({ error: error.message, provider: 'medgemma' });
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
    if (error.code === 'MEDGEMMA_UNAVAILABLE' || error.message?.includes('MedGemma local inference server is unavailable')) {
      return res.status(503).json({ error: error.message, provider: 'medgemma', code: 'MEDGEMMA_UNAVAILABLE' });
    }
    const status = error.status === 429 ? 429 : 502;
    res.status(status).json({ error: 'AI note generation service unavailable. Please retry or continue manually.' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { messages, patientContext } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 16) {
    return res.status(400).json({ error: 'Provide between 1 and 16 recent chat messages.' });
  }

  const validMessages = messages.every(message =>
    message &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string' &&
    message.content.trim().length > 0 &&
    message.content.length <= 4000
  );
  if (!validMessages || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Chat messages must contain text and end with a clinician message.' });
  }

  let systemContent = 'You are a clinical copilot assistant for a practicing physician. Answer clearly, concisely, and practically as an executive clinical colleague. Do not give generic textbook disclaimers. Give structured, decision-ready answers.';
  if (patientContext && typeof patientContext === 'string' && patientContext.trim()) {
    systemContent += `\n\nACTIVE PATIENT CLINICAL CHART:\n${patientContext.trim()}\n\nUse this active patient chart data to answer the physician's questions specifically and accurately.`;
  }

  const providerMessages = [
    {
      role: 'system',
      content: systemContent
    },
    ...messages.map(({ role, content }) => ({ role, content: content.trim() }))
  ];

  let provider;
  try {
    provider = getProvider();
  } catch {
    return res.status(503).json({ error: 'Clinical chat provider is not configured. Check server settings.' });
  }

  try {
    const inputBytes = Buffer.byteLength(JSON.stringify(providerMessages), 'utf-8');
    const response = await executeProviderOperation('chat', provider, inputBytes, async () => provider.chat(providerMessages));
    if (!response || typeof response.text !== 'string' || !response.text.trim()) {
      return res.status(502).json({ error: 'Clinical chat returned an empty or invalid response.' });
    }
    res.json({ message: response.text.trim() });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Clinical chat timed out. Please try again.' });
    }
    if (error.code === 'MEDGEMMA_UNAVAILABLE' || error.message?.includes('MedGemma local inference server is unavailable')) {
      return res.status(503).json({ error: error.message, provider: 'medgemma', code: 'MEDGEMMA_UNAVAILABLE' });
    }
    const status = error.status === 429 ? 429 : error.status === 503 ? 503 : 502;
    res.status(status).json({ error: status === 503 ? error.message : 'Clinical chat is unavailable. Please try again.' });
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
    if (error.code === 'MEDGEMMA_UNAVAILABLE' || error.message?.includes('MedGemma local inference server is unavailable')) {
      return res.status(503).json({ error: error.message, provider: 'medgemma', code: 'MEDGEMMA_UNAVAILABLE' });
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

module.exports = app;
