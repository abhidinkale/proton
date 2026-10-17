/**
 * Proton Vision AI Provider Abstraction (V2 M2C-1)
 * 
 * Defines provider interface and concrete implementations:
 * - VisionProvider (Abstract Base)
 * - DemoVisionProvider (Deterministic Testing & Offline Evaluation)
 * - GeminiVisionProvider (Google Gemini Multimodal Vision API)
 * - Provider Factory
 */

class VisionProviderError extends Error {
  constructor(code, message, status = 502, details = null) {
    super(message);
    this.name = 'VisionProviderError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Base abstract vision provider
 */
class VisionProvider {
  constructor(name = 'base-provider', modelName = 'default-model') {
    this.name = name;
    this.modelName = modelName;
  }

  /**
   * Evaluates image buffer and returns parsed JSON output.
   * 
   * @param {Object} params
   * @param {Buffer} params.buffer - Validated image buffer
   * @param {string} params.mimeType - Validated MIME type
   * @param {string} [params.prompt] - Optional clinical instruction
   * @param {number} [params.timeoutMs] - Maximum execution time
   * @returns {Promise<Object>}
   */
  async analyzeImage({ buffer, mimeType, prompt, timeoutMs = 15000 }) {
    throw new Error('analyzeImage() must be implemented by concrete VisionProvider');
  }
}

/**
 * Demo & Testing Vision Provider
 * Provides deterministic simulation of clinical vision outputs and failure scenarios.
 */
class DemoVisionProvider extends VisionProvider {
  constructor(options = {}) {
    super('demo', options.modelName || 'demo-clinical-vision-v1');
    this.scenario = options.scenario || 'normal'; // 'normal', 'timeout', 'malformed', 'empty', 'error', 'unsupported_fields', 'confirmed_diagnosis', 'prescribe'
    this.latencyMs = options.latencyMs || 50;
    this.customResponse = options.customResponse || null;
  }

  setScenario(scenario) {
    this.scenario = scenario;
    this.customResponse = null;
  }

  setCustomResponse(resp) {
    this.customResponse = resp;
  }

  async analyzeImage({ buffer, mimeType, prompt, timeoutMs = 15000 }) {
    if (this.scenario === 'timeout') {
      await new Promise(resolve => setTimeout(resolve, Math.min(timeoutMs + 50, 100)));
      throw new VisionProviderError('VISION_PROVIDER_TIMEOUT', `Vision provider timed out after ${timeoutMs}ms.`, 504);
    }

    if (this.scenario === 'error') {
      throw new VisionProviderError('VISION_PROVIDER_ERROR', 'Simulated upstream vision API internal server error (500).', 502);
    }

    if (this.scenario === 'empty') {
      return '';
    }

    if (this.scenario === 'malformed') {
      return '{ not-valid-json: true, ... ';
    }

    if (this.scenario === 'unsupported_fields') {
      return {
        observations: ['Well-demarcated plaque with silvery scale'],
        confidence: 0.88,
        prescriptions: ['Prescribe hydrocortisone 2.5% cream']
      };
    }

    if (this.scenario === 'confirmed_diagnosis') {
      return {
        observations: ['Erythematous scaly plaque'],
        confidence: 0.95,
        differentialSuggestions: [
          { condition: 'Plaque Psoriasis', status: 'confirmed' }
        ]
      };
    }

    if (this.scenario === 'prescribe') {
      return {
        observations: ['Erythematous lesion'],
        confidence: 0.82,
        differentialSuggestions: [
          { condition: 'Impetigo', rationale: 'Prescribe Mupirocin 2% ointment TID x 7 days' }
        ]
      };
    }

    if (this.customResponse) {
      return this.customResponse;
    }

    // Default realistic clinical demo response
    await new Promise(resolve => setTimeout(resolve, this.latencyMs));

    return {
      observations: [
        {
          label: 'Erythematous annular plaque with mild peripheral scale',
          description: 'Annular erythematous plaque with slight central clearing and peripheral scaling.',
          severity: 'moderate'
        },
        {
          label: 'Absence of visible central vesicular clustering or ulceration',
          description: 'No active vesicular eruption or open ulceration observed.',
          severity: 'mild'
        }
      ],
      anatomicalLocation: {
        site: 'Cutaneous surface',
        laterality: 'unspecified'
      },
      confidence: 0.85,
      uncertaintyDescription: 'Visual inspection limited by lack of dermoscopy and tactile palpation.',
      differentialSuggestions: [
        {
          condition: 'Tinea corporis',
          rationale: 'Annular lesion with active raised border and peripheral scale.',
          likelihood: 'moderate',
          status: 'unconfirmed'
        },
        {
          condition: 'Nummular eczema',
          rationale: 'Coin-shaped erythematous scaly lesion.',
          likelihood: 'possible',
          status: 'unconfirmed'
        },
        {
          condition: 'Granuloma annulare',
          rationale: 'Smooth ringed appearance without epidermal change.',
          likelihood: 'low',
          status: 'unconfirmed'
        }
      ],
      limitations: [
        'Evaluation performed solely on standard 2D smartphone photograph.',
        'No polarized dermoscopy or histopathology available.',
        'Requires attending physician correlation and clinical assessment.'
      ],
      imageQualityObservations: {
        clarity: 'adequate',
        lighting: 'acceptable',
        focus: 'sharp across central lesion area'
      },
      modelMetadata: {
        provider: this.name,
        model: this.modelName,
        latencyMs: this.latencyMs
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Google Gemini Multimodal Vision Provider
 */
class GeminiVisionProvider extends VisionProvider {
  constructor(apiKey, modelName) {
    super('gemini', modelName || process.env.GEMINI_VISION_MODEL || process.env.PROTON_AI_MODEL || 'gemini-3.8-flash');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required for GeminiVisionProvider');
    }

    const { GoogleGenAI } = require('@google/genai');
    const useVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
    this.ai = new GoogleGenAI({
      apiKey: apiKey.trim(),
      ...(useVertex ? { vertexai: true } : {})
    });
  }

  async analyzeImage({ buffer, mimeType, prompt, timeoutMs = 25000 }) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new VisionProviderError('INVALID_IMAGE_BUFFER', 'Valid image buffer required for vision analysis.', 400);
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: buffer.toString('base64')
      }
    };

    const systemPrompt = `You are an expert clinical dermatological and medical image analyst assisting an attending physician.
CRITICAL SAFETY RULES:
1. Your output is STRICT DECISION SUPPORT ONLY. You MUST NOT declare confirmed, final, or active diagnoses.
2. You MUST NOT prescribe medications, dosing, or treatment orders.
3. Every differential suggestion MUST be explicitly unconfirmed (status: "unconfirmed").
4. You MUST provide a numeric confidence score between 0.0 and 1.0.
5. You MUST output STRICT JSON only conforming exactly to this structure:
{
  "observations": [
    { "label": "description of finding", "description": "detailed visual characteristics", "severity": "mild|moderate|severe|unspecified" }
  ],
  "anatomicalLocation": { "site": "anatomical site or unspecified", "laterality": "left|right|bilateral|midline|unspecified" },
  "confidence": 0.85,
  "uncertaintyDescription": "explanation of uncertainty factors",
  "differentialSuggestions": [
    { "condition": "Condition Name", "rationale": "visual reasons", "likelihood": "high|moderate|low|possible", "status": "unconfirmed" }
  ],
  "limitations": ["photographic limitations", "lack of tactile/dermoscopy exam"],
  "imageQualityObservations": "clarity and lighting evaluation"
}
Do NOT wrap with markdown backticks if possible, or wrap cleanly in \`\`\`json \`\`\`.`;

    const userPrompt = prompt || 'Analyze this clinical image for diagnostic decision support.';

    let timeoutTimer = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutTimer = setTimeout(() => {
        const err = new VisionProviderError('VISION_PROVIDER_TIMEOUT', `Vision AI provider timed out after ${timeoutMs}ms`, 504);
        reject(err);
      }, timeoutMs);
    });

    try {
      const apiCall = this.ai.models.generateContent({
        model: this.modelName,
        contents: [imagePart, `${systemPrompt}\n\nClinical Request: ${userPrompt}`],
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      });

      const response = await Promise.race([apiCall, timeoutPromise]);
      clearTimeout(timeoutTimer);

      const rawText = response.text ? response.text.trim() : '';
      if (!rawText) {
        throw new VisionProviderError('VISION_PROVIDER_MALFORMED', 'Vision provider returned empty output.', 502);
      }

      return rawText;
    } catch (err) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (err.name === 'VisionProviderError') throw err;
      throw new VisionProviderError('VISION_PROVIDER_ERROR', `Upstream vision AI error: ${err.message}`, 502, { original: err.message });
    }
  }
}

/**
 * Provider factory for clinical vision
 */
function getVisionProvider(providerName = null, options = {}) {
  const explicit = (providerName || process.env.PROTON_VISION_PROVIDER || process.env.PROTON_AI_PROVIDER || '').toLowerCase();
  const mode = (process.env.PROTON_AI_MODE || (explicit === 'gemini' ? 'production' : 'demo')).toLowerCase();

  if (mode === 'demo' || explicit === 'demo' || !explicit) {
    return new DemoVisionProvider(options);
  }

  if (explicit === 'gemini') {
    if (!process.env.GEMINI_API_KEY) {
      // If API key is missing in demo/test mode, fall back to Demo provider
      return new DemoVisionProvider(options);
    }
    return new GeminiVisionProvider(process.env.GEMINI_API_KEY, options.modelName);
  }

  return new DemoVisionProvider(options);
}

module.exports = {
  VisionProvider,
  VisionProviderError,
  DemoVisionProvider,
  GeminiVisionProvider,
  getVisionProvider
};
