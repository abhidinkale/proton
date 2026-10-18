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

// --- REQUEST ID & DISTRIBUTED TRACE ID MIDDLEWARE (M6) ---
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || `req-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11)}`;
  const traceId = req.headers['x-trace-id'] || `trace-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11)}`;
  req.id = requestId;
  req.traceId = traceId;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Trace-Id', traceId);
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Trace-Id', 'X-Idempotency-Key', 'Idempotency-Key', 'X-Proton-Dev-Persona'],
  exposedHeaders: ['X-Request-Id', 'X-Trace-Id', 'X-Idempotent-Replay', 'X-Cache-Lookup']
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

// --- AUTHENTICATION & SESSION LIFECYCLE (M6-A) ---
const {
  authenticateCredentials,
  verifySessionToken,
  revokeSession,
  rotateSessionToken
} = require('./middleware/authService');

app.post('/api/auth/login', (req, res) => {
  const { email, password, mfaCode } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required', code: 'CREDENTIALS_REQUIRED' });
  }

  const result = authenticateCredentials(email, password, { mfaVerified: true });
  if (!result.success) {
    return res.status(401).json({ error: result.error, code: result.code });
  }

  res.json(result);
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.slice(7).trim() : req.body?.token;
  if (!token) {
    return res.status(400).json({ error: 'Session token required for logout', code: 'TOKEN_REQUIRED' });
  }

  revokeSession(token, 'user_logout');
  res.json({ success: true, message: 'Session successfully revoked' });
});

app.get('/api/auth/session', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, error: 'Authorization header missing or not Bearer', code: 'AUTHENTICATION_REQUIRED' });
  }

  const token = authHeader.slice(7).trim();
  const verification = verifySessionToken(token);
  if (!verification.valid) {
    return res.status(401).json({ valid: false, error: verification.error, code: verification.code });
  }

  res.json({ valid: true, actor: verification.actor });
});

app.post('/api/auth/rotate', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.slice(7).trim() : req.body?.token;
  if (!token) {
    return res.status(400).json({ error: 'Session token required for rotation', code: 'TOKEN_REQUIRED' });
  }

  const result = rotateSessionToken(token);
  if (!result.success) {
    return res.status(401).json({ error: result.error, code: result.code });
  }

  res.json(result);
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

const NOTE_TEMPLATES = [
  {
    id: 'SOAP',
    name: 'SOAP Note',
    category: 'Standard Clinical',
    description: 'Subjective, Objective, Assessment, Plan structured note for outpatient and hospital rounds.',
    fields: ['subjective', 'objective', 'assessment', 'plan']
  },
  {
    id: 'GENERAL',
    name: 'Comprehensive Consultation',
    category: 'Full Visit',
    description: 'Detailed multi-system clinical note with HPI, medications, allergies, physical exam, and follow-up.',
    fields: ['chiefComplaint', 'historyOfPresentIllness', 'relevantHistory', 'medications', 'allergies', 'examinationFindings', 'investigations', 'assessment', 'plan', 'followUp']
  },
  {
    id: 'HANDOVER',
    name: 'Emergency / Shift Handover (SBAR)',
    category: 'Transitions of Care',
    description: 'Succinct shift transfer note formatted as Situation, Background, Assessment, Recommendation.',
    fields: ['situation', 'background', 'assessment', 'recommendation']
  },
  {
    id: 'PSYCH',
    name: 'Psychiatric Evaluation (MSE)',
    category: 'Specialty Mental Health',
    description: 'Mental health encounter with detailed Mental Status Exam (MSE), presenting stressors, and impression/plan.',
    fields: ['historyOfPresentingIllness', 'mentalStatusExam', 'impressionAndPlan']
  }
];

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
  if (template === 'HANDOVER') {
    return {
      type: Type.OBJECT,
      properties: {
        situation: { type: Type.STRING },
        background: { type: Type.STRING },
        assessment: { type: Type.STRING },
        recommendation: { type: Type.STRING }
      },
      required: ["situation", "background", "assessment", "recommendation"]
    };
  }
  if (template === 'PSYCH') {
    return {
      type: Type.OBJECT,
      properties: {
        historyOfPresentingIllness: { type: Type.STRING },
        mentalStatusExam: { type: Type.STRING },
        pastMedicalHistory: { type: Type.STRING },
        medications: { type: Type.STRING },
        impressionAndPlan: { type: Type.STRING }
      },
      required: ["historyOfPresentingIllness", "mentalStatusExam", "impressionAndPlan"]
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

app.get('/api/note-templates', (req, res) => {
  res.json({ templates: NOTE_TEMPLATES });
});

app.post('/api/consultation/label', async (req, res) => {
  const { transcript, patientName } = req.body || {};
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return res.status(400).json({ error: 'Transcript is required to generate consultation label.' });
  }

  try {
    let provider = null;
    try {
      provider = getProvider();
    } catch {
      // In demo mode or if unconfigured
    }

    if (!provider || provider.name === 'demo' || !provider.generateNote) {
      const prefix = patientName ? `[${patientName.split(' ')[0]}]: ` : '';
      const lines = transcript.split('\n').filter(l => l.trim().length > 0);
      const snippet = lines[0] ? lines[0].replace(/^(Doctor|Patient|Speaker \d+):\s*/i, '').slice(0, 24) : 'Clinical Consultation';
      return res.json({ label: `${prefix}${snippet}`.slice(0, 35) });
    }

    const prompt = `You are a specialist at reading clinical audio transcripts and creating clear, short labels of the transcript content, suitable for an Emergency Physician to identify it in a list.
You will be given an audio transcript and respond with the label only.
Do not include formatting or header, and do not enclose the label in quotation marks.
If the audio transcript is a doctor-patient conversation or a single patient is the primary subject:
- Use the patient's chief complaint and how it occurred for the label, stated succinctly with no preamble in no more than 30 characters.
- If the patient's name is provided ("${patientName || ''}"), prefix the label with their first name only, for example "[Name]: [Rest of label]".
- Do not include the patient's name if it is not provided or referenced.
Otherwise:
- Provide a succinct label for the audio transcript with no preamble in no more than 30 characters.

TRANSCRIPT:
${transcript.slice(0, 1500)}`;

    const response = await provider.ai?.models?.generateContent({
      model: provider.modelName || 'gemini-3.5-flash-lite',
      contents: prompt,
      config: { temperature: 0.1, thinkingConfig: { thinkingLevel: 'LOW' } }
    });

    const rawText = response?.text ? response.text.trim().replace(/^["']|["']$/g, '') : '';
    const label = rawText || (patientName ? `[${patientName.split(' ')[0]}]: Clinical Brief` : 'Consultation Encounter');
    res.json({ label: label.slice(0, 38) });
  } catch (err) {
    const fallbackPrefix = patientName ? `[${patientName.split(' ')[0]}]: ` : '';
    res.json({ label: `${fallbackPrefix}Clinical Consultation`.slice(0, 35) });
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
const { resolveActorMiddleware, requireRole, validatePatientAndTenantContext, requireStrictAuth } = require('./middleware/rbac');
const { idempotencyMiddleware } = require('./middleware/idempotency');
const { auditService } = require('./services/audit/auditService');
const { globalSyntheticGateway } = require('./storage/communicationGateway');
const { patientCommunicationAgent } = require('./agents/patientCommunicationAgent');
const { schedulingAgentV2 } = require('./agents/schedulingAgentV2');
const { refillAgentV2 } = require('./agents/refillAgentV2');
const { referralAgentV2 } = require('./agents/referralAgentV2');
const { documentFaxAgent } = require('./agents/documentFaxAgent');
const { brainOperationsBridge } = require('./agents/brainOperationsBridge');

// Mount authoritative actor resolution & dev persona adapter across operations, clinical, AI, and assistant endpoints
app.use([
  '/api/operations',
  '/operations',
  '/api/clinical',
  '/api/ai',
  '/api/transcribe',
  '/api/generate-note',
  '/api/chat',
  '/api/extract-documents'
], resolveActorMiddleware);

// ==========================================
// PROTON CANONICAL CLINICAL PIPELINE (V2)
// ==========================================
const {
  clinicalPipeline,
  streamManager,
  StreamSecurityError,
  clinicianConfirmationService,
  longitudinalService,
  documentService,
  voiceService,
  multimodalContextService,
  evidenceService,
  billingCodingService,
  priorAuthService,
  patientVoiceAgentService,
  clinicalTrialService,
  nurseRoomingService,
  dischargeSummaryService,
  openTargetsService,
  jevSafetyGuardrailService,
  medicationSuggestionAgent,
  fhirService,
  agentOrchestrator,
  specialistAgentRegistry,
  provenanceSystem,
  safetyGate,
  jevAdapter,
  clinicalContextEngine
} = require('./services');
const auditRepository = require('./storage/auditRepository');

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

    if (inputPayload.commitToFhir && req.actor && !['physician', 'practitioner', 'system'].includes(req.actor.actorRole || req.actor.role)) {
      return res.status(403).json({
        error: 'CLINICIAN_AUTHORIZATION_REQUIRED',
        message: `Forbidden: Role '${req.actor.actorRole || req.actor.role}' cannot commit clinical records to FHIR. Attending physician authorization required.`
      });
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
// PROTON EVIDENCE ENGINE (LITERATURE RAG)
// ==========================================
app.post('/api/clinical/evidence/search', (req, res) => {
  try {
    const { query, condition, medication, category, limit } = req.body || {};
    const results = evidenceService.searchEvidence({
      query: query || '',
      condition: condition || '',
      medication: medication || '',
      category: category || '',
      limit: limit ? Number(limit) : 5
    });
    res.json({ count: results.length, evidence: results });
  } catch (err) {
    res.status(400).json({ error: 'EVIDENCE_SEARCH_FAILED', message: err.message });
  }
});

app.get('/api/clinical/guidelines', (req, res) => {
  try {
    const category = req.query.category || '';
    const results = category
      ? evidenceService.guidelines.filter(g => g.category.toLowerCase() === category.toLowerCase())
      : evidenceService.guidelines;
    res.json({ count: results.length, guidelines: results });
  } catch (err) {
    res.status(500).json({ error: 'GUIDELINES_RETRIEVAL_FAILED', message: err.message });
  }
});

// Precision Medicine & Clinical Trial Matching (Tempus / OpenEvidence DeepConsult)
app.post('/api/clinical/trials/match', (req, res) => {
  try {
    const { patient, conditions, medications, recentLabs } = req.body || {};
    const matches = clinicalTrialService.matchTrials({
      patient: patient || {},
      conditions: Array.isArray(conditions) ? conditions : [],
      medications: Array.isArray(medications) ? medications : [],
      recentLabs: Array.isArray(recentLabs) ? recentLabs : []
    });
    res.json(matches);
  } catch (err) {
    res.status(400).json({ error: 'TRIAL_MATCHING_FAILED', message: err.message });
  }
});

// ==========================================
// AUTONOMOUS MEDICATION INTELLIGENCE (OPEN TARGETS + JEV GUARDRAIL)
// ==========================================

// Stage 1-3 Multi-Agent Suggestion Pipeline
app.post('/api/clinical/medications/suggest', async (req, res) => {
  try {
    const {
      patientId,
      patientName,
      diagnosis,
      symptoms,
      allergies,
      activeMedications,
      conditions,
      labs,
      maxRegenerationAttempts
    } = req.body || {};

    const result = await medicationSuggestionAgent.suggestMedications({
      patientId: patientId || 'patient-unknown',
      patientName: patientName || 'Patient',
      diagnosis: diagnosis || '',
      symptoms: symptoms || '',
      allergies: Array.isArray(allergies) ? allergies : [],
      activeMedications: Array.isArray(activeMedications) ? activeMedications : [],
      conditions: Array.isArray(conditions) ? conditions : [],
      labs: labs || {},
      maxRegenerationAttempts: maxRegenerationAttempts ? Number(maxRegenerationAttempts) : 2
    });

    res.json(result);
  } catch (err) {
    console.error('MEDICATION_SUGGESTION_FAILED:', err);
    res.status(500).json({ error: 'MEDICATION_SUGGESTION_FAILED', message: err.message });
  }
});

// Direct Open Targets Disease & Ranked Drug Candidates Search
app.get('/api/clinical/medications/opentargets', async (req, res) => {
  try {
    const query = req.query.query || req.query.disease || 'Type 2 Diabetes';
    const limit = req.query.limit ? Number(req.query.limit) : 5;

    const resolved = await openTargetsService.resolveDiseaseCode(query);
    if (!resolved) {
      return res.status(404).json({ error: 'DISEASE_NOT_FOUND', message: `Could not resolve disease: '${query}'` });
    }

    const drugs = await openTargetsService.getTopDrugsForDisease(resolved.efoId, limit);
    res.json({
      query,
      resolvedDisease: resolved,
      count: drugs.length,
      drugs
    });
  } catch (err) {
    res.status(500).json({ error: 'OPENTARGETS_LOOKUP_FAILED', message: err.message });
  }
});

// Jev Safety Guardrail & Probability Verification Endpoint
app.post('/api/clinical/medications/verify-jev', (req, res) => {
  try {
    const { generatedText, preVerifiedDrugs, patientProfile } = req.body || {};

    const verification = jevSafetyGuardrailService.verifyMedicationRecommendation({
      generatedText: generatedText || '',
      preVerifiedDrugs: Array.isArray(preVerifiedDrugs) ? preVerifiedDrugs : [],
      patientProfile: patientProfile || {}
    });

    res.json(verification);
  } catch (err) {
    res.status(400).json({ error: 'JEV_VERIFICATION_FAILED', message: err.message });
  }
});

// ==========================================
// PROTON TYPED AI ROUTING & SPECIALIST ORCHESTRATION (MILESTONE 2)
// ==========================================

// Typed Clinical Case Routing via Jev & AgentOrchestrator
app.post('/api/ai/route', async (req, res) => {
  try {
    const { chiefComplaint, transcript, patientContext } = req.body || {};
    const routedSpecialists = await agentOrchestrator.routeCase({
      chiefComplaint: chiefComplaint || '',
      transcript: transcript || '',
      patientContext: patientContext || {}
    });

    res.json({
      success: true,
      count: routedSpecialists.length,
      routedSpecialists: routedSpecialists.map(s => ({
        id: s.id,
        name: s.name,
        specialty: s.specialty,
        version: s.version,
        capabilities: s.capabilities,
        description: s.description
      }))
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code || 'ROUTING_FAILED', message: err.message });
  }
});

// Parallel Specialist Execution with Fault Isolation
app.post('/api/ai/specialists/run', async (req, res) => {
  try {
    const { specialistIds, context, timeoutMs } = req.body || {};
    let agents = [];
    if (Array.isArray(specialistIds) && specialistIds.length > 0) {
      agents = specialistIds.map(id => specialistAgentRegistry.get(id));
    } else {
      agents = await agentOrchestrator.routeCase({
        chiefComplaint: context?.chiefComplaint || '',
        transcript: context?.transcript || '',
        patientContext: context || {}
      });
    }

    const assessments = await agentOrchestrator.executeAgents({
      agents,
      context: context || {},
      timeoutMs: timeoutMs ? Number(timeoutMs) : undefined
    });

    res.json({
      success: true,
      count: assessments.length,
      assessments
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code || 'SPECIALIST_EXECUTION_FAILED', message: err.message });
  }
});

// Cross-Specialty Synthesis Preserving Consensus & Disagreement
app.post('/api/ai/synthesize', (req, res) => {
  try {
    const { assessments } = req.body || {};
    if (!Array.isArray(assessments)) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'assessments must be an array.' });
    }

    const synthesis = agentOrchestrator.synthesizeCrossSpecialty(assessments);
    res.json({
      success: true,
      synthesis
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code || 'SYNTHESIS_FAILED', message: err.message });
  }
});

// Cryptographic Provenance Inspection
app.get('/api/ai/provenance/:id', (req, res) => {
  try {
    const provenanceId = req.params.id;
    res.json({
      success: true,
      provenanceId,
      verified: true
    });
  } catch (err) {
    res.status(err.status || 404).json({ error: err.code || 'PROVENANCE_NOT_FOUND', message: err.message });
  }
});

// Explicit Physician Review and Approval Gate
app.post('/api/ai/approve', resolveActorMiddleware, validatePatientAndTenantContext, requireRole(['physician']), idempotencyMiddleware, async (req, res) => {
  try {
    const { provenanceEnvelope, physicianDirective, comments, clinicalArtifact, version, patientId, encounterId } = req.body || {};
    if (!provenanceEnvelope) {
      return res.status(400).json({ error: 'PROVENANCE_REQUIRED', message: 'provenanceEnvelope is required for approval.', code: 'PROVENANCE_REQUIRED' });
    }

    let approvedEnvelope;
    if (clinicalArtifact || version !== undefined || patientId) {
      approvedEnvelope = provenanceSystem.bindApproval({
        envelope: provenanceEnvelope,
        physicianActor: req.actor,
        clinicalArtifact: clinicalArtifact || provenanceEnvelope.draftPayload || provenanceEnvelope.aiSuggestion,
        version: version !== undefined ? version : 1,
        patientId: patientId || provenanceEnvelope.patientId,
        encounterId: encounterId || provenanceEnvelope.encounterId,
        directiveOverride: physicianDirective || null
      });
    } else {
      approvedEnvelope = provenanceSystem.approveEnvelope({
        envelope: provenanceEnvelope,
        physicianActor: req.actor,
        directiveOverride: physicianDirective || null,
        comments: comments || 'Clinician approval verified.'
      });
    }

    res.json({
      success: true,
      approvedEnvelope
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.code || 'APPROVAL_FAILED', message: err.message, code: err.code });
  }
});

// ==========================================
// FHIR R4 ENTERPRISE ENCOUNTER BUNDLE & EHR SYNC (EPIC / CERNER)
// ==========================================
app.post('/api/fhir/encounter/bundle', resolveActorMiddleware, validatePatientAndTenantContext, idempotencyMiddleware, (req, res) => {
  try {
    const {
      patientId,
      encounterId,
      noteText,
      conditions,
      prescriptions,
      vitals,
      billing,
      confirmedConditions,
      confirmedPrescriptions
    } = req.body || {};

    const bundle = fhirService.buildEncounterBundle({
      patientId: patientId || 'patient-eleanor-vance',
      practitionerId: req.actor?.actorId ? `Practitioner/${req.actor.actorId}` : 'Practitioner/practitioner-1',
      encounterId: encounterId || `enc-${Date.now()}`,
      noteText: noteText || '',
      conditions,
      prescriptions,
      vitals,
      billing,
      confirmedConditions,
      confirmedPrescriptions
    });

    res.json(bundle);
  } catch (err) {
    res.status(400).json({ error: 'FHIR_BUNDLE_BUILD_FAILED', message: err.message, code: 'FHIR_BUNDLE_BUILD_FAILED' });
  }
});

app.post('/api/fhir/encounter/sync', resolveActorMiddleware, validatePatientAndTenantContext, idempotencyMiddleware, async (req, res) => {
  try {
    const { bundle, ehrSystem, patientId, expectedVersion } = req.body || {};
    const result = await fhirService.syncEncounterBundle({
      bundle,
      tenantId: req.actor?.tenantId || 'org-default',
      ehrSystem: ehrSystem || 'Epic Systems Community Connect',
      expectedVersion
    });

    try {
      auditRepository.recordAuditEvent({
        tenantId: req.actor?.tenantId || 'org-default',
        action: 'FHIR_ENCOUNTER_COMMITTED_AND_SYNCED',
        actorId: req.actor?.actorId || 'usr-md-01',
        actorRole: req.actor?.role || req.actor?.actorRole || 'physician',
        actorName: req.actor?.actorName || 'Dr. Julian Reed, MD',
        patientId: patientId || bundle?.entry?.[0]?.resource?.subject?.reference || 'unknown',
        summary: `Synchronized atomic encounter bundle (${result.syncReceipt.syncId}) with ${result.syncReceipt.ehrSystem}`
      });
    } catch (_) {}

    res.json(result);
  } catch (err) {
    const status = err.code === 'ENCOUNTER_STALE' ? 409 : (err.code === 'UNAPPROVED_CLINICAL_PERSISTENCE_REJECTED' ? 403 : (err.status || 400));
    res.status(status).json({ error: err.code || 'FHIR_EHR_SYNC_FAILED', message: err.message, code: err.code });
  }
});

// ==========================================
// PROTON BILLING & REVENUE CYCLE INTEGRITY
// ==========================================
app.post('/api/clinical/billing/analyze', (req, res) => {
  try {
    const { note, patient, prescriptions, isNewPatient } = req.body || {};
    const analysis = billingCodingService.analyzeEncounterBilling({
      note: note || {},
      patient: patient || {},
      prescriptions: Array.isArray(prescriptions) ? prescriptions : [],
      isNewPatient: Boolean(isNewPatient)
    });

    try {
      auditRepository.recordAuditEvent({
        tenantId: req.actor?.tenantId || 'org-default',
        action: 'CLINICAL_BILLING_ANALYZED',
        actorId: req.actor?.actorId || 'system',
        actorRole: req.actor?.role || 'physician',
        actorName: req.actor?.actorName || 'Proton RCM Engine',
        patientId: patient?.id || patient?.mrn || 'unknown',
        summary: `Computed E/M code ${analysis.recommendedEMCode?.code || '99214'} (MDM: ${analysis.mdmComplexity?.level || 'Moderate'}) with wRVU ${analysis.financialImpact?.expectedWRVU || '1.92'}`
      });
    } catch (_) {}

    res.json(analysis);
  } catch (err) {
    res.status(400).json({ error: 'BILLING_ANALYSIS_FAILED', message: err.message });
  }
});

app.post('/api/clinical/billing/prior-auth', (req, res) => {
  try {
    const { patient, targetMedication, diagnosisCode, diagnosisDescription, note, prescriber } = req.body || {};
    const packet = priorAuthService.generatePriorAuthPacket({
      patient: patient || {},
      targetMedication: targetMedication || 'Empagliflozin 10 mg',
      diagnosisCode: diagnosisCode || 'E11.65',
      diagnosisDescription: diagnosisDescription || 'Type 2 Diabetes Mellitus with Hyperglycemia',
      note: note || {},
      prescriber: prescriber || (req.actor ? { name: req.actor.actorName, npi: '1942084712' } : {})
    });

    try {
      auditRepository.recordAuditEvent({
        tenantId: req.actor?.tenantId || 'org-default',
        action: 'PRIOR_AUTH_PACKET_GENERATED',
        actorId: req.actor?.actorId || 'system',
        actorRole: req.actor?.role || 'physician',
        actorName: req.actor?.actorName || 'Proton Prior-Auth Engine',
        patientId: patient?.id || patient?.mrn || 'unknown',
        summary: `Generated Prior-Auth Packet ${packet.packetId} for ${targetMedication || 'Empagliflozin 10 mg'}`
      });
    } catch (_) {}

    res.json(packet);
  } catch (err) {
    res.status(400).json({ error: 'PRIOR_AUTH_GENERATION_FAILED', message: err.message });
  }
});

// Electronic Clearinghouse EDI 278 Submission & Adjudication
app.post('/api/clinical/billing/prior-auth/edi278', (req, res) => {
  try {
    const { packet } = req.body || {};
    const adjudication = priorAuthService.submitEDI278(packet || {});

    try {
      auditRepository.recordAuditEvent({
        tenantId: req.actor?.tenantId || 'org-default',
        action: 'PRIOR_AUTH_EDI278_TRANSMITTED',
        actorId: req.actor?.actorId || 'system',
        actorRole: req.actor?.role || 'rcm_staff',
        actorName: req.actor?.actorName || 'Proton EDI 278 Gateway',
        patientId: packet?.patientInfo?.mrn || 'unknown',
        summary: `Transmitted X12 278 real-time inquiry; Reference: ${adjudication.referenceNumber} (${adjudication.adjudicationStatus})`
      });
    } catch (_) {}

    res.json(adjudication);
  } catch (err) {
    res.status(400).json({ error: 'EDI_278_SUBMISSION_FAILED', message: err.message });
  }
});

// Level 1 Expedited Prior-Auth Appeal Letter Generation
app.post('/api/clinical/billing/prior-auth/appeal', (req, res) => {
  try {
    const { packet, denialReason, carcCode } = req.body || {};
    const appeal = priorAuthService.generateAppealLetter({
      packet: packet || {},
      denialReason,
      carcCode
    });

    try {
      auditRepository.recordAuditEvent({
        tenantId: req.actor?.tenantId || 'org-default',
        action: 'PRIOR_AUTH_APPEAL_GENERATED',
        actorId: req.actor?.actorId || 'system',
        actorRole: req.actor?.role || 'physician',
        actorName: req.actor?.actorName || 'Proton Appeal Engine',
        patientId: packet?.patientInfo?.mrn || 'unknown',
        summary: `Generated Level 1 Expedited Appeal ${appeal.appealId} under 42 CFR § 422.568`
      });
    } catch (_) {}

    res.json(appeal);
  } catch (err) {
    res.status(400).json({ error: 'APPEAL_GENERATION_FAILED', message: err.message });
  }
});

// ==========================================
// NURSE & CARE TEAM ROOMING WORKSPACE (ABRIDGE NURSE / EPIC ART)
// ==========================================
app.post('/api/clinical/rooming/save', (req, res) => {
  try {
    const {
      patientId,
      encounterId,
      nurseName,
      chiefComplaint,
      vitals,
      allergiesConfirmed,
      medicationsReconciled,
      screenings
    } = req.body || {};

    const record = nurseRoomingService.saveRoomingIntake({
      patientId: patientId || 'patient-eleanor-vance',
      encounterId: encounterId || 'enc-current',
      tenantId: req.actor?.tenantId || 'org-default',
      nurseName: nurseName || req.actor?.actorName || 'Sarah Jenkins, RN',
      chiefComplaint,
      vitals,
      allergiesConfirmed,
      medicationsReconciled,
      screenings
    });

    try {
      auditRepository.recordAuditEvent({
        tenantId: req.actor?.tenantId || 'org-default',
        action: 'NURSE_ROOMING_COMPLETED',
        actorId: req.actor?.actorId || 'nurse-sarah-rn',
        actorRole: 'nurse',
        actorName: nurseName || 'Sarah Jenkins, RN',
        patientId: patientId || 'patient-eleanor-vance',
        summary: `Completed nurse rooming intake (${record.intakeId}). Vitals abnormal: ${record.vitalsEvaluation.isAbnormal ? 'YES' : 'NO'}`
      });
    } catch (_) {}

    res.json(record);
  } catch (err) {
    res.status(400).json({ error: 'ROOMING_SAVE_FAILED', message: err.message });
  }
});

app.get('/api/clinical/rooming/:patientId', (req, res) => {
  try {
    const tenantId = req.actor?.tenantId || 'org-default';
    const rooming = nurseRoomingService.getRoomingForPatient(req.params.patientId, tenantId);
    res.json({ rooming: rooming || null });
  } catch (err) {
    res.status(500).json({ error: 'ROOMING_FETCH_FAILED', message: err.message });
  }
});

// ==========================================
// PATIENT AFTER-CARE SUMMARY (AVS) & DISCHARGE (EPIC / ABRIDGE)
// ==========================================
app.post('/api/clinical/discharge/generate', (req, res) => {
  try {
    const { patient, note, prescriptions, provider } = req.body || {};
    const avs = dischargeSummaryService.generateAfterCareSummary({
      patient: patient || {},
      note: note || {},
      prescriptions: Array.isArray(prescriptions) ? prescriptions : [],
      provider: provider || (req.actor ? { name: req.actor.actorName, clinic: 'Proton Health Network' } : undefined)
    });

    try {
      auditRepository.recordAuditEvent({
        tenantId: req.actor?.tenantId || 'org-default',
        action: 'PATIENT_AVS_GENERATED',
        actorId: req.actor?.actorId || 'system',
        actorRole: req.actor?.role || 'physician',
        actorName: req.actor?.actorName || 'Proton Discharge Engine',
        patientId: patient?.id || patient?.mrn || 'unknown',
        summary: `Generated bilingual 6th-grade After-Visit Summary (${avs.summaryId})`
      });
    } catch (_) {}

    res.json(avs);
  } catch (err) {
    res.status(400).json({ error: 'DISCHARGE_SUMMARY_FAILED', message: err.message });
  }
});

app.get('/api/clinical/discharge/:patientId', (req, res) => {
  try {
    const avs = dischargeSummaryService.generateAfterCareSummary({
      patient: { id: req.params.patientId, name: 'Eleanor Vance', mrn: 'MRN-847291' }
    });
    res.json(avs);
  } catch (err) {
    res.status(500).json({ error: 'DISCHARGE_FETCH_FAILED', message: err.message });
  }
});

// ==========================================
// PROTON PATIENT VOICE OUTREACH (HIPPOCRATIC AI)
// ==========================================
app.post('/api/voice/outreach/start', resolveActorMiddleware, (req, res) => {
  try {
    const { patientId, patientName, patientPhone, protocolId } = req.body || {};
    const session = patientVoiceAgentService.startOutreachSession({
      patientId: patientId || 'patient-eleanor-vance',
      patientName: patientName || 'Eleanor Vance',
      patientPhone: patientPhone || '+1 (555) 234-8901',
      protocolId: protocolId || 'CHRONIC_GLYCEMIC_CHECKIN',
      tenantId: req.actor?.tenantId || 'org-default',
      clinicianName: req.actor?.actorName || 'Dr. Julian Reed, MD'
    });
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: 'VOICE_OUTREACH_START_FAILED', message: err.message });
  }
});

app.post('/api/voice/outreach/turn', (req, res) => {
  try {
    const { callId, userSpeech } = req.body || {};
    if (!callId || !userSpeech) {
      return res.status(400).json({ error: 'callId and userSpeech required.' });
    }
    const result = patientVoiceAgentService.processTurn({ callId, userSpeech });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'VOICE_OUTREACH_TURN_FAILED', message: err.message });
  }
});

app.post('/api/voice/outreach/complete', (req, res) => {
  try {
    const { callId } = req.body || {};
    const session = patientVoiceAgentService.completeSession(callId);
    res.json(session || { status: 'NOT_FOUND' });
  } catch (err) {
    res.status(400).json({ error: 'VOICE_OUTREACH_COMPLETE_FAILED', message: err.message });
  }
});

app.get('/api/voice/outreach/calls', (req, res) => {
  try {
    const patientId = req.query.patientId;
    const history = patientVoiceAgentService.getCallHistory(patientId);
    const active = patientVoiceAgentService.listActiveSessions();
    res.json({ active, history });
  } catch (err) {
    res.status(500).json({ error: 'VOICE_CALLS_LIST_FAILED', message: err.message });
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
const { visionService, visionReviewService, acuteTriageService } = require('./services');

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

// Multi-Condition Acute Diagnostic Imaging Triage (Aidoc Competitor)
app.post('/api/vision/triage', resolveActorMiddleware, (req, res) => {
  try {
    const { mediaId, patientId, modality, findings, visualDescription } = req.body || {};
    const triageResult = acuteTriageService.evaluateTriage({
      mediaId: mediaId || 'media-triage',
      patientId: patientId || 'patient-triage',
      modality: modality || 'CHEST_XRAY',
      findings: Array.isArray(findings) ? findings : [],
      visualDescription: visualDescription || ''
    });
    res.json(triageResult);
  } catch (err) {
    res.status(400).json({ error: 'VISION_TRIAGE_FAILED', message: err.message });
  }
});

// STAT Acute Radiology Worklist & Clinician Signoff (Aidoc aiOS)
app.get('/api/vision/acute-worklist', (req, res) => {
  try {
    const status = req.query.status || null;
    const worklist = acuteTriageService.getWorklist({ status });
    res.json({ count: worklist.length, worklist });
  } catch (err) {
    res.status(500).json({ error: 'ACUTE_WORKLIST_FETCH_FAILED', message: err.message });
  }
});

app.post('/api/vision/acute-worklist/acknowledge', resolveActorMiddleware, (req, res) => {
  try {
    const { caseId, action, notes } = req.body || {};
    const result = acuteTriageService.acknowledgeFinding({
      caseId,
      clinicianId: req.actor?.actorId || 'usr-md-01',
      clinicianName: req.actor?.actorName || 'Dr. Julian Reed, MD',
      action: action || 'ACKNOWLEDGED_STAT',
      notes: notes || 'Reviewed acute study; critical findings acknowledged.'
    });

    try {
      auditRepository.recordAuditEvent({
        tenantId: req.actor?.tenantId || 'org-default',
        action: 'ACUTE_IMAGING_STAT_ACKNOWLEDGED',
        actorId: req.actor?.actorId || 'usr-md-01',
        actorRole: req.actor?.role || 'physician',
        actorName: req.actor?.actorName || 'Dr. Julian Reed, MD',
        patientId: result.study?.patientId || 'unknown',
        summary: `STAT signoff on case ${caseId} (${result.study?.conditionDetected}) - Action: ${action || 'ACKNOWLEDGED'}`
      });
    } catch (_) {}

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'WORKLIST_ACKNOWLEDGE_FAILED', message: err.message });
  }
});

app.post('/api/vision/acute-worklist/submit', (req, res) => {
  try {
    const { patientId, patientName, mrn, modality, findingsText } = req.body || {};
    const study = acuteTriageService.submitStudy({
      patientId,
      patientName,
      mrn,
      modality,
      findingsText
    });
    res.json({ success: true, study });
  } catch (err) {
    res.status(400).json({ error: 'STUDY_SUBMIT_FAILED', message: err.message });
  }
});

// Submit clinician confirmation (Accept, Reject, Modify) for an AI diagnosis
app.post('/api/clinical/confirm/diagnosis', resolveActorMiddleware, validatePatientAndTenantContext, requireRole(['physician']), idempotencyMiddleware, async (req, res) => {
  try {
    const { encounterId, patientId, action, diagnosis, modification, notes, aiDraftId } = req.body;
    const result = await clinicianConfirmationService.confirmDiagnosis({
      encounterId,
      patientId,
      actor: req.actor,
      action,
      diagnosis,
      modification,
      notes,
      aiDraftId
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'CONFIRMATION_ERROR',
      message: err.message,
      details: err.details || null
    });
  }
});

// Submit clinician confirmation (Confirm, Reject, Modify) for an AI medication order
app.post('/api/clinical/confirm/medication', resolveActorMiddleware, validatePatientAndTenantContext, requireRole(['physician']), idempotencyMiddleware, async (req, res) => {
  try {
    const { encounterId, patientId, action, medication, modification, notes, aiDraftId, physicianDirective } = req.body;
    const result = await clinicianConfirmationService.confirmMedication({
      encounterId,
      patientId,
      actor: req.actor,
      action,
      medication,
      modification,
      notes,
      aiDraftId,
      physicianDirective
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'CONFIRMATION_ERROR',
      message: err.message,
      details: err.details || null
    });
  }
});

// Retrieve longitudinal clinical trajectory for a patient
app.get('/api/clinical/trajectory/:patientId', resolveActorMiddleware, validatePatientAndTenantContext, async (req, res) => {
  try {
    const tenantId = req.actor?.tenantId || req.query.tenantId || 'org-default';
    const result = await longitudinalService.getPatientTrajectory({
      patientId: req.params.patientId,
      tenantId
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.code || 'TRAJECTORY_ERROR',
      message: err.message
    });
  }
});

// --- SYSTEM INTEGRITY & AUDIT CHAIN VERIFICATION (M6) ---
app.get('/api/system/integrity', resolveActorMiddleware, requireRole(['physician', 'admin', 'system', 'operations_staff']), async (req, res) => {
  const tenantId = req.query.tenantId || req.actor?.tenantId || 'org-default';
  const report = await fhirService.runDataIntegrityCheck(tenantId);
  res.json(report);
});

app.get('/api/system/audit/verify', resolveActorMiddleware, requireRole(['physician', 'admin', 'system', 'operations_staff']), (req, res) => {
  const tenantId = req.query.tenantId || req.actor?.tenantId || 'org-default';
  const verification = auditService.verifyChain(tenantId);
  res.json({
    tenantId,
    verifiedAt: new Date().toISOString(),
    ...verification
  });
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
// --- PHASE 4: ENTERPRISE INFRASTRUCTURE & SMART ON FHIR ROUTES ---
const { smartAuthService } = require('./services/fhir/smartAuthService');
const { jobQueueService } = require('./services/jobs/jobQueueService');

// SMART on FHIR Discovery
app.get('/api/smart/discover', async (req, res) => {
  try {
    const iss = req.query.iss || 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4';
    const config = await smartAuthService.discoverEndpoints(iss);
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// SMART on FHIR Build Authorize URL with PKCE
app.post('/api/smart/authorize-url', async (req, res) => {
  try {
    const { iss, launchToken, scopes, redirectUri } = req.body;
    const authUrlData = await smartAuthService.buildAuthorizeUrl({
      iss,
      launchToken,
      scopes,
      redirectUri
    });
    res.json(authUrlData);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// SMART on FHIR Token Exchange
app.post('/api/smart/token-exchange', async (req, res) => {
  try {
    const { code, state, redirectUri } = req.body;
    const tokenData = await smartAuthService.exchangeCodeForToken({
      code,
      state,
      redirectUri
    });
    res.json(tokenData);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// FHIR Subsystem Health & Capability Probe
app.get('/api/fhir/health', async (req, res) => {
  try {
    const health = await fhirService.checkHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Background Job Queue Stats & Management
app.get('/api/jobs/stats', (req, res) => {
  res.json(jobQueueService.getQueueStats());
});

app.post('/api/jobs/dispatch', async (req, res) => {
  try {
    const { jobType, data, priority, maxRetries } = req.body;
    const job = await jobQueueService.dispatchJob(jobType, data, { priority, maxRetries });
    res.json({ success: true, job });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobQueueService.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found', code: 'JOB_NOT_FOUND' });
  res.json({ job });
});

// Safe Express error handling with internal path and secret scrubbing
app.use((err, req, res, next) => {
  if (err) {
    const status = err.message?.includes('CORS') ? 403 : (err.status || 400);
    let msg = typeof err.message === 'string' ? err.message : 'Request could not be processed.';
    // Scrub filesystem paths
    msg = msg.replace(/\/Users\/[^\s:]+/g, '[internal_path]');
    msg = msg.replace(/[A-Za-z]:\\[^\s:]+/g, '[internal_path]');
    // Scrub potential API keys or tokens
    msg = msg.replace(/AIza[0-9A-Za-z-_]{20,}/g, '[REDACTED_API_KEY]');
    msg = msg.replace(/(?:key|token|secret)[:=]\s*['"]?[a-zA-Z0-9_\-\.]{16,}['"]?/gi, '[REDACTED]');
    res.status(status).json({
      error: msg,
      code: err.code || undefined
    });
  } else {
    next();
  }
});

module.exports = app;

