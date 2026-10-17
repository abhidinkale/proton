const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Type } = require('@google/genai');
const { getProvider, getProviderStatus } = require('./providers/factory');

const app = express();
app.disable('x-powered-by');

// --- SECURITY HEADERS MIDDLEWARE ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// --- IN-MEMORY RATE LIMITER ---
const rateLimitMap = new Map();
function createRateLimiter({ windowMs, maxRequests, message, code }) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const key = req.actor?.actorId || req.ip || req.connection?.remoteAddress || 'anonymous';
    const now = Date.now();
    let record = rateLimitMap.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitMap.set(key, record);
    } else {
      record.count++;
      if (record.count > maxRequests) {
        res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
        return res.status(429).json({ error: message, code });
      }
    }
    next();
  };
}

const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 500,
  message: 'Too many requests. Please try again later.',
  code: 'RATE_LIMIT_EXCEEDED'
});

const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'AI endpoint rate limit exceeded. Please wait before retrying.',
  code: 'AI_RATE_LIMIT_EXCEEDED'
});

app.use(generalLimiter);
app.use(['/api/transcribe', '/api/generate-note', '/api/chat', '/api/extract-documents'], aiLimiter);

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

const { telemetryMiddleware } = require('./middleware/telemetry');
const { validateConfig } = require('./config');

// In production, ensure configuration fails closed if required secrets are missing
if (process.env.NODE_ENV === 'production') {
  try {
    validateConfig();
  } catch (err) {
    console.error(err.message);
    if (!process.env.SUPPRESS_CONFIG_EXIT) {
      process.exit(1);
    }
  }
}

app.use(express.json({ limit: '10mb' }));
app.use(telemetryMiddleware);

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
    return res.status(400).json({
      error: 'TRANSCRIPTION_INPUT_INVALID',
      message: 'No valid audio input was provided.'
    });
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
    if (error.code === 'TRANSCRIPTION_INPUT_INVALID' || error.name === 'TranscriptionInputError') {
      return res.status(400).json({
        error: 'TRANSCRIPTION_INPUT_INVALID',
        message: error.message || 'No valid audio input was provided.'
      });
    }
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

// ==========================================
// PROTON HEALTHCARE OPERATIONS OS ENDPOINTS
// ==========================================
const operationsEngine = require('./agents/engine');
const { verifyRefillProposal } = require('./agents/refillReferralAgent');
const { resolvePatientIdentity } = require('./agents/identityResolver');
const { executeInternalTool, ToolExecutionError } = require('./agents/tools');
const { IdempotencyConflictError } = require('./agents/idempotency');
const { resolveActorMiddleware, requireRole } = require('./middleware/rbac');
const { globalSyntheticGateway } = require('./storage/communicationGateway');
const { patientCommunicationAgent } = require('./agents/patientCommunicationAgent');
const { schedulingAgentV2 } = require('./agents/schedulingAgentV2');
const { refillAgentV2 } = require('./agents/refillAgentV2');
const { referralAgentV2 } = require('./agents/referralAgentV2');
const { documentFaxAgent } = require('./agents/documentFaxAgent');
const { brainOperationsBridge } = require('./agents/brainOperationsBridge');

// Mount authoritative actor resolution & dev persona adapter
app.use(['/api/operations', '/operations', '/api/clinical'], resolveActorMiddleware);

// ==========================================
// PROTON CANONICAL CLINICAL PIPELINE (V2)
// ==========================================
// PROTON CANONICAL CLINICAL PIPELINE (V2) & SSE STREAMING (M2C-3)
// ==========================================
const { clinicalPipeline, streamManager, StreamSecurityError } = require('./services');

// Create an opaque clinical streaming session (M2C-3)
app.post('/api/clinical/streams', resolveActorMiddleware, (req, res) => {
  try {
    if (!req.actor) {
      return res.status(401).json({ error: 'Authenticated actor required.', code: 'UNAUTHENTICATED' });
    }
    const { patientId, encounterId, operation } = req.body || {};
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required to initialize a clinical stream.', code: 'PATIENT_ID_REQUIRED' });
    }

    const cleanPatientId = String(patientId).replace(/^Patient\//, '').trim();

    // Patient isolation check: patient actor cannot create stream for other patients
    const actorRole = req.actor.actorRole || req.actor.role || '';
    if (actorRole === 'patient') {
      const actorPatientId = String(req.actor.actorId || req.actor.patientId || '').replace(/^Patient\//, '').trim();
      if (cleanPatientId !== actorPatientId) {
        return res.status(403).json({
          error: 'Forbidden: Patients can only create streams for their own records.',
          code: 'CROSS_PATIENT_ACCESS_DENIED'
        });
      }
    }

    const stream = streamManager.createStream({
      patientId: cleanPatientId,
      encounterId,
      actor: req.actor,
      operation: operation || 'CLINICAL_PIPELINE'
    });

    res.status(201).json(stream);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'STREAM_CREATE_ERROR',
      message: err.message
    });
  }
});

// Connect SSE transport socket to an active stream (M2C-3)
app.get('/api/clinical/streams/:id', resolveActorMiddleware, (req, res) => {
  try {
    if (!req.actor) {
      return res.status(401).json({ error: 'Authenticated actor required.', code: 'UNAUTHENTICATED' });
    }
    streamManager.attachResponse(req.params.id, res, req, {
      lastEventId: req.headers['last-event-id']
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(err.status || 400).json({
        error: err.code || 'STREAM_CONNECT_ERROR',
        message: err.message
      });
    }
  }
});

// Direct Streaming Clinical Pipeline execution (SSE transport) (M2C-3)
app.post('/api/clinical/pipeline/stream', resolveActorMiddleware, upload.single('audio'), async (req, res) => {
  let streamMeta = null;
  try {
    if (!req.actor) {
      return res.status(401).json({ error: 'Authenticated actor required.', code: 'UNAUTHENTICATED' });
    }

    // RBAC: Only clinical roles can execute clinical pipeline
    const allowedRoles = ['physician', 'practitioner', 'operations_staff', 'system'];
    const actorRole = req.actor.actorRole || req.actor.role || '';
    if (!allowedRoles.includes(actorRole)) {
      return res.status(403).json({
        error: `Forbidden: Role '${actorRole}' is not authorized to execute clinical pipelines.`,
        code: 'UNAUTHORIZED_ROLE'
      });
    }

    const inputPayload = {
      ...req.body,
      actor: req.actor,
      tenantId: req.actor.tenantId || req.body.tenantId || 'org-default'
    };

    if (req.file) {
      inputPayload.audioBuffer = req.file.buffer;
      inputPayload.audioMimeType = req.file.mimetype;
    }

    if (typeof inputPayload.prescriptions === 'string') {
      try { inputPayload.prescriptions = JSON.parse(inputPayload.prescriptions); } catch {}
    }
    if (typeof inputPayload.confirmedPrescriptions === 'string') {
      try { inputPayload.confirmedPrescriptions = JSON.parse(inputPayload.confirmedPrescriptions); } catch {}
    }
    if (typeof inputPayload.confirmedConditions === 'string') {
      try { inputPayload.confirmedConditions = JSON.parse(inputPayload.confirmedConditions); } catch {}
    }
    if (typeof inputPayload.commitToFhir === 'string') {
      inputPayload.commitToFhir = inputPayload.commitToFhir === 'true';
    }

    if (!inputPayload.patientId) {
      return res.status(400).json({ error: 'Encounter must be bound to a valid patientId.', code: 'PATIENT_ID_REQUIRED' });
    }

    // Initialize stream
    streamMeta = streamManager.createStream({
      patientId: inputPayload.patientId,
      encounterId: inputPayload.encounterId,
      actor: req.actor,
      operation: 'PIPELINE_STREAM'
    });

    // Attach SSE transport
    streamManager.attachResponse(streamMeta.streamId, res, req);

    // Execute pipeline with real-time event streaming
    try {
      const result = await clinicalPipeline.execute(inputPayload, {
        onEvent: (type, payload) => {
          streamManager.publishEvent(streamMeta.streamId, type, payload);
        }
      });
      streamManager.closeStream(streamMeta.streamId, 'STREAM_COMPLETE', {
        pipelineRunId: result.pipelineRunId,
        durationMs: result.durationMs,
        output: result.output,
        provenance: result.provenance
      });
    } catch (pipelineErr) {
      streamManager.abortStream(streamMeta.streamId, pipelineErr);
    }
  } catch (err) {
    if (streamMeta) {
      streamManager.abortStream(streamMeta.streamId, err);
    } else if (!res.headersSent) {
      res.status(err.status || 400).json({
        error: err.code || 'STREAM_INIT_ERROR',
        message: err.message
      });
    }
  }
});

// Standard unary clinical pipeline endpoint with optional streamId forwarding
app.post('/api/clinical/pipeline', upload.single('audio'), async (req, res) => {
  try {
    const inputPayload = {
      ...req.body,
      actor: req.actor || null,
      tenantId: req.actor?.tenantId || req.body.tenantId || 'org-default'
    };

    if (req.file) {
      inputPayload.audioBuffer = req.file.buffer;
      inputPayload.audioMimeType = req.file.mimetype;
    }

    if (typeof inputPayload.prescriptions === 'string') {
      try { inputPayload.prescriptions = JSON.parse(inputPayload.prescriptions); } catch {}
    }
    if (typeof inputPayload.confirmedPrescriptions === 'string') {
      try { inputPayload.confirmedPrescriptions = JSON.parse(inputPayload.confirmedPrescriptions); } catch {}
    }
    if (typeof inputPayload.confirmedConditions === 'string') {
      try { inputPayload.confirmedConditions = JSON.parse(inputPayload.confirmedConditions); } catch {}
    }
    if (typeof inputPayload.commitToFhir === 'string') {
      inputPayload.commitToFhir = inputPayload.commitToFhir === 'true';
    }

    const options = {};
    const streamId = req.body.streamId || req.headers['x-stream-id'];
    if (streamId) {
      const streamRecord = streamManager.getStream(streamId);
      if (streamRecord && streamRecord.tenantId === inputPayload.tenantId) {
        options.onEvent = (type, payload) => {
          streamManager.publishEvent(streamId, type, payload);
        };
      }
    }

    try {
      const result = await clinicalPipeline.execute(inputPayload, options);
      if (streamId) {
        streamManager.closeStream(streamId, 'STREAM_COMPLETE', {
          pipelineRunId: result.pipelineRunId,
          durationMs: result.durationMs
        });
      }
      res.json(result);
    } catch (pipelineErr) {
      if (streamId) {
        streamManager.abortStream(streamId, pipelineErr);
      }
      throw pipelineErr;
    }
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({
      error: err.code || 'CLINICAL_PIPELINE_ERROR',
      stage: err.stage || 'UNKNOWN',
      message: err.message,
      details: err.details || null
    });
  }
});

// ==========================================
// PROTON DYNAMIC CLINICAL INTAKE (V2)
// ==========================================
const { intakeService } = require('./services');

app.use(['/api/intake'], resolveActorMiddleware);

// List available questionnaires
app.get('/api/intake/questionnaires', (req, res) => {
  res.json({ questionnaires: intakeService.listQuestionnaires() });
});

// Retrieve specific questionnaire
app.get('/api/intake/questionnaires/:id', (req, res) => {
  try {
    const q = intakeService.getQuestionnaire(req.params.id);
    res.json(q);
  } catch (err) {
    res.status(err.status || 404).json({ error: err.code || 'QUESTIONNAIRE_NOT_FOUND', message: err.message });
  }
});

// Dynamic branching evaluation
app.post('/api/intake/questionnaires/:id/branching', (req, res) => {
  try {
    const result = intakeService.evaluateBranching(req.params.id, req.body.answers || req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.code || 'BRANCHING_EVALUATION_ERROR', message: err.message });
  }
});

// Submit questionnaire response
app.post('/api/intake/questionnaires/:id/responses', async (req, res) => {
  try {
    const result = await intakeService.submitResponse({
      questionnaireId: req.params.id,
      submission: req.body,
      actor: req.actor || null,
      tenantId: req.actor?.tenantId || req.body.tenantId || 'org-default'
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'INTAKE_SUBMISSION_ERROR',
      message: err.message,
      details: err.details || null
    });
  }
});

// Retrieve submitted questionnaire response
app.get('/api/intake/responses/:id', async (req, res) => {
  try {
    if (req.query.tenantId && req.actor?.tenantId && req.query.tenantId !== req.actor.tenantId) {
      return res.status(403).json({
        error: 'Forbidden: Cross-organization tenant access is strictly prohibited.',
        code: 'CROSS_TENANT_ACCESS_DENIED'
      });
    }
    const tenantId = req.actor?.tenantId || req.query.tenantId || 'org-default';
    const qr = await intakeService.getResponse(req.params.id, tenantId, req.actor);
    res.json(qr);
  } catch (err) {
    res.status(err.status || 404).json({ error: err.code || 'RESPONSE_NOT_FOUND', message: err.message });
  }
});

// ==========================================
// PROTON SECURE CAPTURE SESSIONS (V2 M2B-1)
// ==========================================
const { captureSessionService, sessionStore, storageService } = require('./services');

// Create a new capture session (Desktop Clinician)
app.post('/api/capture/sessions', resolveActorMiddleware, requireRole(['physician', 'operations_staff', 'system']), (req, res) => {
  try {
    const { patientId, encounterId, ttlMs } = req.body;
    const session = captureSessionService.createSession({
      patientId,
      encounterId,
      actor: req.actor,
      ttlMs
    });
    res.status(201).json(session);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'CAPTURE_SESSION_ERROR',
      message: err.message
    });
  }
});

// Pair a mobile device using opaque single-use capability token
app.post('/api/capture/sessions/:id/pair', (req, res) => {
  try {
    const { pairingToken } = req.body;
    const result = captureSessionService.pairSession(req.params.id, pairingToken);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'CAPTURE_PAIRING_ERROR',
      message: err.message
    });
  }
});

// Retrieve safe session state (Desktop Clinician)
app.get('/api/capture/sessions/:id', resolveActorMiddleware, (req, res) => {
  try {
    const session = captureSessionService.getSession(req.params.id, req.actor);
    res.json(session);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'CAPTURE_SESSION_ERROR',
      message: err.message
    });
  }
});

// Cancel capture session (Desktop Clinician)
app.post('/api/capture/sessions/:id/cancel', resolveActorMiddleware, (req, res) => {
  try {
    const result = captureSessionService.cancelSession(req.params.id, req.actor);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'CAPTURE_SESSION_ERROR',
      message: err.message
    });
  }
});

// Request upload capability (Paired Mobile Device)
app.post('/api/capture/sessions/:id/upload-capability', (req, res) => {
  try {
    const { mobileToken } = req.body;
    const result = captureSessionService.issueUploadCapability(req.params.id, mobileToken);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'CAPTURE_CAPABILITY_ERROR',
      message: err.message
    });
  }
});

// Secure image upload from paired mobile device
app.post('/api/capture/sessions/:id/upload', upload.single('image'), async (req, res) => {
  try {
    const uploadToken = req.body.uploadToken || req.headers['x-upload-token'];
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        error: 'IMAGE_FILE_REQUIRED',
        message: 'No image file uploaded.'
      });
    }

    const result = await captureSessionService.processUpload({
      sessionId: req.params.id,
      uploadToken,
      buffer: req.file.buffer,
      declaredMimeType: req.file.mimetype
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'CAPTURE_UPLOAD_ERROR',
      message: err.message,
      details: err.details || null
    });
  }
});

// Retrieve media list for a capture session (Desktop Clinician)
app.get('/api/capture/sessions/:id/media', resolveActorMiddleware, (req, res) => {
  try {
    const mediaList = captureSessionService.getMediaForSession(req.params.id, req.actor);
    res.json({ media: mediaList });
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'CAPTURE_MEDIA_ERROR',
      message: err.message
    });
  }
});

// Retrieve media binary file (Desktop Clinician)
app.get('/api/capture/media/:id/file', resolveActorMiddleware, async (req, res) => {
  try {
    const media = sessionStore.getMediaById(req.params.id);
    if (!media) {
      return res.status(404).json({ error: 'MEDIA_NOT_FOUND', message: 'Media not found' });
    }
    const tenantId = req.actor?.tenantId || 'org-default';
    if (media.tenantId !== tenantId) {
      return res.status(403).json({ error: 'CROSS_TENANT_ACCESS_DENIED', message: 'Access denied' });
    }
    const asset = await storageService.retrieve(media.storageKey, media.tenantId);
    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Content-Length', asset.size);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(asset.buffer);
  } catch (err) {
    res.status(err.status || 500).json({ error: 'MEDIA_ERROR', message: err.message });
  }
});

// ==========================================
// PROTON CLINICAL VISION INTELLIGENCE (V2 M2C-1 & M2C-2)
// ==========================================
const { visionService, visionReviewService } = require('./services');

// Evaluate clinical image asset for unconfirmed decision support
app.post('/api/vision/analyze', resolveActorMiddleware, requireRole(['physician', 'operations_staff', 'system']), async (req, res) => {
  try {
    const { mediaId, patientId, encounterId, timeoutMs, prompt } = req.body;
    const result = await visionService.analyzeMedia({
      mediaId,
      patientId,
      encounterId,
      actor: req.actor,
      timeoutMs,
      prompt
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'VISION_ERROR',
      message: err.message,
      details: err.details || null
    });
  }
});

// Retrieve past vision analyses for a media asset
app.get('/api/vision/analyses/:mediaId', resolveActorMiddleware, (req, res) => {
  try {
    const analyses = visionService.getAnalysesForMedia(req.params.mediaId, req.actor);
    res.json({ analyses });
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'VISION_ERROR',
      message: err.message
    });
  }
});

// Submit clinician review (Accept, Reject, Modify) for an AI finding (M2C-2)
app.post('/api/vision/reviews', resolveActorMiddleware, requireRole(['physician']), async (req, res) => {
  try {
    const { analysisId, findingIndex, targetType, action, modification, notes, patientId, encounterId } = req.body;
    const result = await visionReviewService.reviewFinding({
      analysisId,
      findingIndex,
      targetType,
      action,
      modification,
      notes,
      actor: req.actor,
      patientId,
      encounterId
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'VISION_REVIEW_ERROR',
      message: err.message,
      details: err.details || null
    });
  }
});

// Retrieve clinician reviews for a vision analysis (M2C-2)
app.get('/api/vision/reviews/:analysisId', resolveActorMiddleware, (req, res) => {
  try {
    const reviews = visionReviewService.getReviewsForAnalysis({
      analysisId: req.params.analysisId,
      actor: req.actor
    });
    res.json({ reviews });
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'VISION_REVIEW_ERROR',
      message: err.message
    });
  }
});

// Get high-level summary of active operational tasks
app.get(['/api/operations/summary', '/operations/summary'], (req, res) => {
  const tenantId = req.query.tenantId || req.actor?.tenantId || 'org-default';
  if (req.query.tenantId && req.actor && req.query.tenantId !== req.actor.tenantId) {
    return res.status(403).json({
      error: 'Forbidden: Cross-organization tenant access is strictly prohibited.',
      code: 'CROSS_TENANT_ACCESS_DENIED'
    });
  }
  res.json(operationsEngine.getSummary(tenantId));
});

// List operational tasks with filter by category or status
app.get(['/api/operations/tasks', '/operations/tasks'], (req, res) => {
  const { status, category, patientId } = req.query;
  const tenantId = req.query.tenantId || req.actor?.tenantId || 'org-default';
  if (req.query.tenantId && req.actor && req.query.tenantId !== req.actor.tenantId) {
    return res.status(403).json({
      error: 'Forbidden: Cross-organization tenant access is strictly prohibited.',
      code: 'CROSS_TENANT_ACCESS_DENIED'
    });
  }
  const tasks = operationsEngine.getTasks({ status, category, patientId, tenantId });
  res.json({ tasks });
});

// Patient identity resolution endpoint (Multi-tier confidence scoring)
app.post(['/api/operations/identity/resolve', '/operations/identity/resolve'], (req, res) => {
  try {
    const { patientId, mrn, phone, birthDate } = req.body;
    const result = resolvePatientIdentity({ patientId, mrn, phone, birthDate });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Inbound triage submission from patient communication channels
app.post(['/api/operations/triage', '/operations/triage'], async (req, res) => {
  try {
    const { patientId, mrn, phone, birthDate, message, channel, patientContext, idempotencyKey } = req.body;
    const effectiveIdempotencyKey = idempotencyKey || req.headers['x-idempotency-key'];
    const tenantId = req.actor?.tenantId || 'org-default';

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required for clinical triage.' });
    }
    const result = await operationsEngine.handleTriageSubmission({
      patientId,
      mrn,
      phone,
      birthDate,
      message,
      channel: channel || 'portal',
      patientContext: patientContext || {},
      idempotencyKey: effectiveIdempotencyKey,
      tenantId
    });
    res.json(result);
  } catch (err) {
    if (err instanceof IdempotencyConflictError) {
      return res.status(409).json({ error: err.message, code: err.code });
    }
    console.error('Triage error:', err.message || err);
    res.status(500).json({ error: 'Failed to process inbound message triage.' });
  }
});

// Consultation follow-up & appointment extraction (Agent 2: Scheduler)
app.post(['/api/operations/scheduling/followup', '/operations/scheduling/followup'], async (req, res) => {
  try {
    const { consultationPlanText, patientId, patientAcuity, patientName, idempotencyKey } = req.body;
    const effectiveIdempotencyKey = idempotencyKey || req.headers['x-idempotency-key'];
    const tenantId = req.actor?.tenantId || 'org-default';

    if (!consultationPlanText) {
      return res.status(400).json({ error: 'consultationPlanText is required to extract follow-up scheduling plan.' });
    }
    const result = await operationsEngine.handleSchedulingFollowup({
      consultationPlanText,
      patientId,
      patientAcuity,
      patientName,
      idempotencyKey: effectiveIdempotencyKey,
      tenantId
    });
    res.json(result);
  } catch (err) {
    if (err instanceof IdempotencyConflictError) {
      return res.status(409).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

// Versioned Care Gap Evaluation (Agent 2: Scheduler)
app.post(['/api/operations/scheduling/care-gaps', '/operations/scheduling/care-gaps'], (req, res) => {
  try {
    const { patientId, conditions, recentLabs } = req.body;
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = operationsEngine.handleCareGapAssessment({
      patientId: patientId || 'eleanor-vance',
      conditions: conditions || ['Type 2 Diabetes Mellitus', 'Essential Hypertension'],
      recentLabs: recentLabs || [],
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deterministic refill safety verification (Agent 3: CareFlow)
app.post(['/api/operations/refills/verify', '/operations/refills/verify'], (req, res) => {
  try {
    const report = verifyRefillProposal(req.body);
    res.json(report);
  } catch (err) {
    console.error('Refill verification error:', err.message || err);
    res.status(500).json({ error: 'Failed to verify medication refill safety.' });
  }
});

// Specialist Referral Packet Compilation (Agent 3: CareFlow)
app.post(['/api/operations/referrals/compile', '/operations/referrals/compile'], async (req, res) => {
  try {
    const {
      patientId,
      patientName,
      patientAgeSex,
      specialty,
      specialtyCode,
      targetProviderOrClinic,
      clinicalIndication,
      hpiSummary,
      relevantLabs,
      currentMedications,
      documentedAllergies,
      vitalsSummary,
      orderingPhysician
    } = req.body;
    const tenantId = req.actor?.tenantId || 'org-default';

    if (!specialty || !clinicalIndication) {
      return res.status(400).json({ error: 'specialty and clinicalIndication are required.' });
    }

    const result = await operationsEngine.handleReferralCompilation({
      patientId: patientId || 'arthur-pendelton',
      patientName: patientName || 'Arthur Pendelton',
      patientAgeSex: patientAgeSex || '74M',
      specialty,
      specialtyCode,
      targetProviderOrClinic,
      clinicalIndication,
      hpiSummary: hpiSummary || 'Clinical referral order.',
      relevantLabs: relevantLabs || [],
      currentMedications: currentMedications || [],
      documentedAllergies: documentedAllergies || [],
      vitalsSummary,
      orderingPhysician,
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restricted Internal Tool Execution Gateway
// INVARIANT: Browser/client cannot invoke arbitrary tools. Protected by internal secret.
app.post(['/api/operations/internal/tools/execute', '/operations/internal/tools/execute'], async (req, res) => {
  const internalSecret = req.headers['x-proton-internal-secret'] || '';
  const expectedSecret = process.env.INTERNAL_AGENT_SECRET || 'internal-secret-token';

  const secretBuffer = Buffer.from(internalSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (!internalSecret || secretBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(secretBuffer, expectedBuffer)) {
    return res.status(403).json({
      error: 'Forbidden: Direct external browser invocation of privileged tools is blocked.',
      code: 'UNAUTHORIZED_TOOL_INVOCATION'
    });
  }

  try {
    const { toolName, params, callerContext } = req.body;
    const result = await executeInternalTool(toolName, params, callerContext || { role: 'INTERNAL_AGENT_ENGINE' });
    res.json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ error: err.message, code: err.code });
  }
});

// Physician task approval (1-click sign-off, dose adjustment, or message dispatch)
// RBAC INVARIANT: Strictly requires physician role
app.post(['/api/operations/tasks/:id/approve', '/operations/tasks/:id/approve'], requireRole(['physician']), async (req, res) => {
  try {
    const { id } = req.params;
    const { doctor, editedContent, physicianDecision, selectedOptionId, overrideReason } = req.body;
    const result = await operationsEngine.approveTask({
      taskId: id,
      doctor: doctor || req.actor?.actorName || 'Dr. Sarah Lin, MD',
      actorId: req.actor?.actorId || 'usr-md-lin-01',
      actorRole: req.actor?.actorRole || 'physician',
      tenantId: req.actor?.tenantId || 'org-default',
      editedContent,
      physicianDecision,
      selectedOptionId,
      overrideReason
    });
    res.json(result);
  } catch (err) {
    if (err instanceof operationsEngine.FhirPersistenceError) {
      return res.status(502).json({ error: err.message, code: err.code });
    }
    res.status(400).json({ error: err.message });
  }
});

// Physician task rejection
// RBAC INVARIANT: Strictly requires physician role
app.post(['/api/operations/tasks/:id/reject', '/operations/tasks/:id/reject'], requireRole(['physician']), async (req, res) => {
  try {
    const { id } = req.params;
    const { doctor, reason } = req.body;
    const result = await operationsEngine.rejectTask({
      taskId: id,
      doctor: doctor || req.actor?.actorName || 'Dr. Sarah Lin, MD',
      actorId: req.actor?.actorId || 'usr-md-lin-01',
      actorRole: req.actor?.actorRole || 'physician',
      tenantId: req.actor?.tenantId || 'org-default',
      reason
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Dispatch communication (Administrative autonomous or Approved Clinical)
app.post(['/api/operations/communications/:id/dispatch', '/operations/communications/:id/dispatch'], async (req, res) => {
  try {
    const { id } = req.params;
    const { channel } = req.body;
    const tenantId = req.actor?.tenantId || 'org-default';
    const task = operationsEngine.getTasks({ tenantId }).find(t => t.id === id);

    // RBAC INVARIANT: Clinical communication strictly requires physician role
    if (task && task.triageDetails?.communicationCategory === 'clinical') {
      if (req.actor && req.actor.actorRole !== 'physician') {
        return res.status(403).json({
          error: `Forbidden: Role '${req.actor.actorRole}' cannot approve or dispatch clinical communications. Physician sign-off required.`,
          code: 'INSUFFICIENT_CLINICAL_PRIVILEGES'
        });
      }
    }

    const result = await operationsEngine.dispatchCommunication({
      taskId: id,
      channel,
      tenantId,
      actorId: req.actor?.actorId || 'agent-connect',
      actorRole: req.actor?.actorRole || 'agent',
      actorName: req.actor?.actorName || 'Proton Connect Agent'
    });
    res.json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ error: err.message, code: err.code });
  }
});

// Explicit confirmation of proposed appointment booking (Agent 2: Scheduler)
// Allowed for Physician and Operations Staff
app.post(['/api/operations/scheduling/:id/confirm', '/operations/scheduling/:id/confirm'], requireRole(['physician', 'operations_staff']), async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmedBy } = req.body;
    const result = await operationsEngine.confirmAppointmentBooking({
      taskId: id,
      confirmedBy: confirmedBy || req.actor?.actorName || 'Operations Staff',
      actorId: req.actor?.actorId || 'usr-ops-marcus-01',
      actorRole: req.actor?.actorRole || 'operations_staff',
      tenantId: req.actor?.tenantId || 'org-default'
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// WORKSTREAM 2: AGENTIC OPERATIONS ENDPOINTS
// ==========================================

// Subagent 1: Patient Communication Agent — Inbound Message Ingestion & Intent Triage
app.post(['/api/operations/communications/inbound', '/operations/communications/inbound'], async (req, res) => {
  try {
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = await patientCommunicationAgent.processInboundMessage({
      ...req.body,
      tenantId,
      actor: req.actor || { actorId: 'system-inbound', actorRole: 'system', actorName: 'Inbound Gateway' }
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Subagent 2: Scheduling Agent V2 — Reschedule Appointment
app.post(['/api/operations/scheduling/reschedule', '/operations/scheduling/reschedule'], requireRole(['physician', 'operations_staff']), async (req, res) => {
  try {
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = await schedulingAgentV2.rescheduleAppointment({
      ...req.body,
      actorId: req.actor?.actorId || 'usr-ops-marcus-01',
      actorRole: req.actor?.actorRole || 'operations_staff',
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Subagent 2: Scheduling Agent V2 — Cancel Appointment
app.post(['/api/operations/scheduling/cancel', '/operations/scheduling/cancel'], requireRole(['physician', 'operations_staff']), async (req, res) => {
  try {
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = await schedulingAgentV2.cancelAppointment({
      ...req.body,
      actorId: req.actor?.actorId || 'usr-ops-marcus-01',
      actorRole: req.actor?.actorRole || 'operations_staff',
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Subagent 2: Scheduling Agent V2 — Appointment Reminder
app.post(['/api/operations/scheduling/reminder', '/operations/scheduling/reminder'], async (req, res) => {
  try {
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = await schedulingAgentV2.sendAppointmentReminder({
      ...req.body,
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Subagent 3: Refill Agent V2 — Process Inbound Refill Request
app.post(['/api/operations/refills/request', '/operations/refills/request'], async (req, res) => {
  try {
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = await refillAgentV2.processRefillRequest({
      ...req.body,
      requesterRole: req.body.requesterRole || req.actor?.actorRole || 'pharmacy',
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Subagent 3: Refill Agent V2 — Physician Refill Approval
app.post(['/api/operations/refills/:id/approve', '/operations/refills/:id/approve'], requireRole(['physician']), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = await refillAgentV2.approveRefill({
      taskId: id,
      approvingDoctor: req.body.doctor || req.actor?.actorName || 'Dr. Sarah Lin, MD',
      actorId: req.actor?.actorId || 'usr-md-lin-01',
      actorRole: req.actor?.actorRole || 'physician',
      clinicalRationale: req.body.clinicalRationale,
      approvedDose: req.body.approvedDose,
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Subagent 4: Referral Agent V2 — Prepare Referral Packet
app.post(['/api/operations/referrals/prepare', '/operations/referrals/prepare'], async (req, res) => {
  try {
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = await referralAgentV2.prepareReferralPacket({
      ...req.body,
      orderingPhysician: req.body.orderingPhysician || req.actor?.actorName || 'Dr. Sarah Lin, MD',
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Subagent 4: Referral Agent V2 — Physician Referral Authorization
app.post(['/api/operations/referrals/:id/authorize', '/operations/referrals/:id/authorize'], requireRole(['physician']), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = await referralAgentV2.approveAndTransmit({
      taskId: id,
      approvingDoctor: req.body.doctor || req.actor?.actorName || 'Dr. Sarah Lin, MD',
      actorId: req.actor?.actorId || 'usr-md-lin-01',
      actorRole: req.actor?.actorRole || 'physician',
      transmissionMethod: req.body.transmissionMethod || 'electronic_ehr_direct',
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Subagent 5: Document / Fax Agent — Ingest & OCR Document
app.post(['/api/operations/documents/ingest', '/operations/documents/ingest'], async (req, res) => {
  try {
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = await documentFaxAgent.ingestDocument({
      ...req.body,
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Subagent 5: Document / Fax Agent — Physician Approve Facts
app.post(['/api/operations/documents/:id/approve', '/operations/documents/:id/approve'], requireRole(['physician']), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = await documentFaxAgent.approveDocumentFacts({
      taskId: id,
      approvedFactIds: req.body.approvedFactIds || [],
      doctor: req.body.doctor || req.actor?.actorName || 'Dr. Sarah Lin, MD',
      actorId: req.actor?.actorId || 'usr-md-lin-01',
      actorRole: req.actor?.actorRole || 'physician',
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Subagent 7: Clinical Brain Bridge — Closed Loops
app.post(['/api/operations/bridge/consultation', '/operations/bridge/consultation'], async (req, res) => {
  try {
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = await brainOperationsBridge.bridgeConsultationToFollowUp({
      ...req.body,
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post(['/api/operations/bridge/symptom', '/operations/bridge/symptom'], async (req, res) => {
  try {
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = await brainOperationsBridge.bridgePatientSymptomToClinicalEscalation({
      ...req.body,
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post(['/api/operations/bridge/lab-caregap', '/operations/bridge/lab-caregap'], requireRole(['physician']), async (req, res) => {
  try {
    const tenantId = req.actor?.tenantId || 'org-default';
    const result = await brainOperationsBridge.bridgeExternalLabToCareGapClosure({
      ...req.body,
      approvingDoctor: req.body.doctor || req.actor?.actorName || 'Dr. Sarah Lin, MD',
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Operations audit log — GET is allowed, POST is strictly rejected
// INVARIANT: Authoritative audit records are exclusively emitted server-side during validated state transitions.
app.get(['/api/operations/audit', '/operations/audit'], (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const tenantId = req.query.tenantId || req.actor?.tenantId || 'org-default';
  if (req.query.tenantId && req.actor && req.query.tenantId !== req.actor.tenantId) {
    return res.status(403).json({
      error: 'Forbidden: Cross-organization tenant access is strictly prohibited.',
      code: 'CROSS_TENANT_ACCESS_DENIED'
    });
  }
  res.json({ auditEvents: operationsEngine.getAuditEvents(limit, tenantId) });
});

app.get(['/api/operations/audit/verify', '/operations/audit/verify'], (req, res) => {
  const tenantId = req.query.tenantId || req.actor?.tenantId || 'org-default';
  const verification = operationsEngine.verifyAuditChain(tenantId);
  res.json(verification);
});

// Test / Failure injection endpoint for synthetic communication gateway
// Only enabled in non-production, requires authenticated operational role
app.post(['/api/operations/gateway/failure-mode', '/operations/gateway/failure-mode'], requireRole(['physician', 'operations_staff', 'admin']), (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Endpoint unavailable in production.', code: 'NOT_FOUND' });
  }
  const { enable, reason } = req.body;
  globalSyntheticGateway.setFailureMode(enable, reason);
  res.json({ failureMode: enable, reason: reason || null });
});

app.post(['/api/operations/audit', '/operations/audit'], (req, res) => {
  res.status(403).json({
    error: 'Forbidden: Authoritative audit records can only be generated server-side during validated state transitions. Client audit injection is blocked.',
    code: 'UNAUTHORIZED_AUDIT_INJECTION'
  });
});

// Background Jobs Endpoint (Tenant-Scoped)
const jobRepository = require('./storage/jobRepository');
const { runWorkerCycle } = require('./workers/reconciliationWorker');

app.get(['/api/operations/jobs', '/operations/jobs'], (req, res) => {
  const tenantId = req.query.tenantId || req.actor?.tenantId || 'org-default';
  if (req.query.tenantId && req.actor && req.query.tenantId !== req.actor.tenantId) {
    return res.status(403).json({
      error: 'Forbidden: Cross-organization tenant access is strictly prohibited.',
      code: 'CROSS_TENANT_ACCESS_DENIED'
    });
  }
  const { status, jobType, sourceTaskId, limit } = req.query;
  const jobs = jobRepository.listJobs({ tenantId, status, jobType, sourceTaskId, limit: parseInt(limit, 10) || 50 });
  res.json({ jobs });
});

// Trigger worker reconciliation cycle (Operational Admin / Staff / Physician)
app.post(['/api/operations/jobs/worker/cycle', '/operations/jobs/worker/cycle'], requireRole(['physician', 'operations_staff', 'admin', 'agent']), async (req, res) => {
  const tenantId = req.actor?.tenantId || 'org-default';
  try {
    const workerResults = await runWorkerCycle({
      workerId: `worker-api-${req.actor?.actorId || 'daemon'}`,
      tenantId
    });
    res.json({ success: true, processedJobs: workerResults });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PHYSICIAN PILOT FEEDBACK HARNESS ---
const pilotFeedbackRepo = require('./storage/pilotFeedbackRepository');

app.post(['/api/pilot/feedback', '/pilot/feedback'], async (req, res) => {
  try {
    const feedback = pilotFeedbackRepo.recordPilotFeedback({
      ...req.body,
      tenantId: req.actor?.tenantId || req.body.tenantId || 'org-default',
      clinicianId: req.actor?.actorId || req.body.clinicianId || 'usr-md-lin-01'
    });
    res.json({ success: true, feedback });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get(['/api/pilot/summary', '/pilot/summary'], (req, res) => {
  const tenantId = req.query.tenantId || req.actor?.tenantId || 'org-default';
  const summary = pilotFeedbackRepo.getPilotSummary(tenantId);
  res.json(summary);
});

app.get(['/api/pilot/feedback', '/pilot/feedback'], (req, res) => {
  const tenantId = req.query.tenantId || req.actor?.tenantId || 'org-default';
  const clinicianId = req.query.clinicianId || null;
  const items = pilotFeedbackRepo.listPilotFeedback({ tenantId, clinicianId });
  res.json({ feedback: items });
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

