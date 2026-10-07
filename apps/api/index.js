require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Type } = require('@google/genai');
const { getProvider } = require('./providers/factory');

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
    // Allow non-browser requests (e.g. server-to-server, health checks, curl) or allowed origins
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

app.use(express.json());

// Minimal, operational health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: process.env.PROTON_AI_MODE || 'demo',
    timestamp: new Date().toISOString()
  });
});

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10MB limit per file, max 5 files
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'audio/webm', 'audio/wav', 'audio/mp3', 'audio/mp4', 'audio/mpeg'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, JPG, PNG, and Audio files are allowed.`));
    }
  }
});

if (process.env.PROTON_AI_MODE === 'real' && !process.env.GEMINI_API_KEY) {
  console.warn("WARNING: PROTON_AI_MODE is 'real' but GEMINI_API_KEY is missing. AI endpoints will fail.");
}


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


// --- AI STRUCTURED LOGGING & RETRY WRAPPER ---
async function withRetryAndLogging(operationName, modelName, fn, maxRetries = 6) {
  const startTime = Date.now();
  let attempt = 0;
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'REQUEST_STARTED',
    operation: operationName,
    model: modelName,
    mode: 'live'
  }));

  while (attempt < maxRetries) {
    try {
      const response = await fn();
      const latency = Date.now() - startTime;
      
      const usage = response.usageMetadata || {};
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'REQUEST_SUCCESS',
        operation: operationName,
        latencyMs: latency,
        retries: attempt,
        tokens: {
          input: usage.promptTokenCount || null,
          output: usage.candidatesTokenCount || null,
          total: usage.totalTokenCount || null
        }
      }));
      
      return response;
    } catch (error) {
      attempt++;
      const status = error.status || (error.response && error.response.status) || 500;
      const isTransient = status === 429 || status === 503 || (status >= 500 && status < 600);
      
      if (!isTransient || attempt >= maxRetries) {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          event: 'REQUEST_FAILED',
          operation: operationName,
          latencyMs: Date.now() - startTime,
          retries: attempt,
          error: error.message,
          status: status
        }));
        throw error;
      }
      
      // Exponential backoff with jitter: 2^attempt * 1000 + random(0..1000)
      const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'RETRYING',
        operation: operationName,
        status: status,
        nextAttemptInMs: Math.round(delayMs),
        attempt: attempt,
        maxRetries: maxRetries
      }));
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// --- HELPER FOR MODE CHECKING ---
function checkMode(req, res, operationName) {
  const mode = process.env.PROTON_AI_MODE || 'demo';
  if (mode === 'live') {
    try {
      getProvider(); // Will throw if configuration is missing
    } catch (err) {
      res.status(500).json({ error: err.message });
      return false;
    }
    return 'live';
  } else if (mode === 'demo') {
    return 'demo';
  } else {
    res.status(500).json({ error: 'Invalid PROTON_AI_MODE. Must be "live" or "demo".' });
    return false;
  }
}

// --- STT ENDPOINT ---
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const mode = checkMode(req, res, 'STT');
  if (!mode) return;
  
  if (mode === 'demo') {
    setTimeout(() => {
      res.json({ transcript: "Patient presents with a 3-day history of moderate frontal headache and mild nausea. They have taken ibuprofen with minimal relief. No recent travel. No fever." });
    }, 2000);
    return;
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  try {
    const audioBase64 = req.file.buffer.toString('base64');
    const audioPart = {
      inlineData: {
        mimeType: req.file.mimetype || 'audio/webm',
        data: audioBase64
      }
    };
    
    const provider = getProvider();
    const response = await withRetryAndLogging('STT', provider.modelName, async () => {
      return await provider.transcribe(req.file.buffer, req.file.mimetype);
    });
    
    res.json({ transcript: response.text });
  } catch (error) {
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

// --- AI NOTE ENDPOINT ---
app.post('/api/generate-note', async (req, res) => {
  const template = req.body.template || 'General Consultation';
  const noteSchema = getNoteSchema(template);
  const { transcript, patientContext } = req.body;
  const mode = checkMode(req, res, 'AI_NOTE');
  if (!mode) return;

  if (mode === 'demo') {
    setTimeout(() => {
      if (template === 'SOAP') {
        res.json({ note: {
          subjective: "Patient reports a 3-day history of moderate throbbing frontal headache and mild nausea. Pain has been intermittent but worsening in afternoons. Denies fever, vomiting, neck stiffness, or recent travel. Has taken OTC Ibuprofen occasionally with minimal relief.",
          objective: "Vital signs pending review. Patient alert, oriented x3, in mild distress secondary to headache pain. No acute focal neurological deficits.",
          assessment: "1. Tension-type headache vs mild migraine without aura.\n2. Mild nausea secondary to headache.",
          plan: "1. Recommend over-the-counter analgesics (e.g., Acetaminophen 500 mg or Ibuprofen 400 mg) taken with meals as needed.\n2. Ensure adequate hydration and rest precautions.\n3. Follow up in clinic if symptoms persist beyond 1 week or if red flag symptoms develop."
        }});
        return;
      }
      res.json({ note: {
        chiefComplaint: "Moderate frontal headache and mild nausea",
        historyOfPresentIllness: "Patient reports a 3-day history of moderate frontal headache and mild nausea. Pain is described as throbbing. Patient has taken ibuprofen occasionally with minimal relief.",
        relevantHistory: "Denies recent travel or medication changes. No fever, no vomiting.",
        medications: ["Ibuprofen (occasionally)"],
        allergies: ["None reported"],
        examinationFindings: "Pending physical examination",
        investigations: ["None"],
        assessment: "1. Headache, likely tension-type or mild migraine.\n2. Nausea, secondary to headache.",
        plan: "1. Recommend over-the-counter analgesics (e.g., Acetaminophen/Ibuprofen) as needed with consistent dosing.\n2. Ensure adequate rest and hydration.",
        followUp: "Follow up in clinic if symptoms worsen or persist beyond 1 week. Return precautions given."
      }});
    }, 3000);
    return;
  }

  if (!transcript) {
    return res.status(400).json({ error: 'Transcript is required' });
  }

  try {
    const prompt = `You are an expert clinical AI. Given the following consultation transcript and patient context, generate a structured clinical note formatted as a ${template}. 
Do not fabricate information. If information for a section is missing from the transcript, put "Not mentioned" or "None".

Patient Context:
${patientContext || 'None provided'}

Consultation Transcript:
${transcript}`;

    const provider = getProvider();
    const response = await withRetryAndLogging('AI_NOTE', provider.modelName, async () => {
      return await provider.generateNote(transcript, patientContext, noteSchema, template);
    });

    const jsonNote = JSON.parse(response.text);
    const required = noteSchema.required;
    for (const field of required) {
      if (jsonNote[field] === undefined) {
        throw new Error(`Model returned malformed JSON: missing field ${field}`);
      }
    }
    
    res.json({ note: jsonNote });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate clinical note. Validation or generation failed.' });
  }
});


// --- DOCUMENT EXTRACTION ENDPOINT ---
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

app.post('/api/extract-documents', upload.array('documents', 5), async (req, res) => {
  const mode = checkMode(req, res, 'DOCUMENT_EXTRACTION');
  if (!mode) return;
  
  if (mode === 'demo') {
    setTimeout(() => {
      res.json({
        extractions: [
          {
            document_date: "2026-08-12",
            document_type: "Blood Test Report",
            facts: [
              { category: "lab", text: "HbA1c: 7.2%", confidence: 0.99, source_quote: "HbA1c result: 7.2%" },
              { category: "diagnosis", text: "Type 2 diabetes", confidence: 0.95, source_quote: "Patient has history of T2DM" }
            ],
            originalFileName: req.files && req.files[0] ? req.files[0].originalname : "medical_report.png"
          },
          {
            document_date: "2026-09-01",
            document_type: "Clinic Notes",
            facts: [
              { category: "allergy", text: "Patient unsure about penicillin allergy", confidence: 0.30, source_quote: "might have had a mild rash with penicillin" },
              { category: "diagnosis", text: "Hypertension", confidence: 0.40, source_quote: "Elevated, but not enough to confirm hypertension" },
              { category: "medication", text: "Metformin 500mg", confidence: 0.95, source_quote: "Metformin 500 mg" }
            ],
            originalFileName: req.files && req.files[1] ? req.files[1].originalname : "test_doc_ambiguous.png"
          }
        ]
      });
    }, 2000);
    return;
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No documents provided' });
  }

  try {
    const extractions = [];
    
    for (const file of req.files) {
      const filePart = {
        inlineData: {
          mimeType: file.mimetype,
          data: file.buffer.toString('base64')
        }
      };
      
      const prompt = `Extract clinically useful facts from this medical document. 
Do NOT invent information. If uncertain, mark confidence low.
Categorize facts carefully into medication, diagnosis, lab, procedure, allergy, or other.`;

      const provider = getProvider();
      const response = await withRetryAndLogging('DOCUMENT_EXTRACTION', provider.modelName, async () => {
        return await provider.extractDocument(file.buffer, file.mimetype, file.originalname, documentSchema);
      });
      
      const result = JSON.parse(response.text);
      result.originalFileName = file.originalname;
      extractions.push(result);
    }
    
    res.json({ extractions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to extract document information.' });
  }
});

app.use((err, req, res, next) => {
  if (err) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'EXPRESS_ERROR',
      error: err.message
    }));
    const status = err.message?.includes('CORS') ? 403 : (err.status || 400);
    res.status(status).json({ error: err.message || 'Request could not be processed.' });
  } else {
    next();
  }
});

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Proton Backend API running on port ${port}`);
  console.log(`Mode: ${process.env.PROTON_AI_MODE || 'demo'}`);
});
