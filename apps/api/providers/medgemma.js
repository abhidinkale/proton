const { AIProvider } = require('./ai');

function normalizeCategory(cat) {
  if (!cat || typeof cat !== 'string') return 'other';
  const lower = cat.toLowerCase().trim();
  if (lower.includes('med')) return 'medication';
  if (lower.includes('diag') || lower.includes('condition') || lower.includes('problem')) return 'diagnosis';
  if (lower.includes('lab') || lower.includes('test') || lower.includes('result')) return 'lab';
  if (lower.includes('proc') || lower.includes('surger') || lower.includes('operat')) return 'procedure';
  if (lower.includes('allerg')) return 'allergy';
  return 'other';
}

function ensureString(val) {
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    return Object.entries(val)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n');
  }
  return String(val || 'None');
}

function extractJsonFromContent(content) {
  if (typeof content !== 'string') return '';
  let text = content.trim();

  // Strip special tokens / thinking tags like <unused94>thought...<unused95> or <thought>...</thought>
  text = text.replace(/<unused94>thought[\s\S]*?<unused95>/gi, '');
  text = text.replace(/<unused\d+>[\s\S]*?<unused\d+>/gi, '');
  text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
  text = text.trim();

  // If there are markdown json fences, extract the fenced content
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  } else {
    // If no clean fence, find outermost JSON object { ... }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.slice(firstBrace, lastBrace + 1).trim();
    }
  }

  return text;
}

/**
 * MedGemma 1.5 4B Local AI Provider
 * Connects to local OpenAI-compatible MLX-VLM server on Apple Silicon
 * hosting mlx-community/medgemma-1.5-4b-it-4bit at http://localhost:8000/v1.
 *
 * Designed for local development and synthetic evaluation.
 * NEVER writes directly to FHIR. All outputs are preliminary proposals
 * requiring deterministic verification and explicit physician approval.
 */
class MedGemmaProvider extends AIProvider {
  constructor(baseUrl, modelName) {
    super();
    this.baseUrl = (baseUrl || process.env.MEDGEMMA_BASE_URL || 'http://localhost:8000/v1').replace(/\/+$/, '');
    this.modelName = modelName || process.env.MEDGEMMA_MODEL || 'mlx-community/medgemma-1.5-4b-it-4bit';
    this.timeoutMs = parseInt(process.env.MEDGEMMA_TIMEOUT_MS || '60000', 10);
  }

  /**
   * Fast connectivity check against the local MLX-VLM inference server.
   * Pings /models endpoint with a short timeout.
   */
  async isReachable(timeoutMs = 1500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        signal: controller.signal
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Audio transcription constraint:
   * MedGemma 1.5 4B is a vision-language clinical foundation model,
   * not a speech-to-text model. Audio workflow requires Whisper or multimodal Gemini.
   */
  async transcribe(audioBuffer, mimeType) {
    throw new Error(
      'MedGemma audio transcription is not supported natively. ' +
      'MedGemma 1.5 4B is a vision-language medical model. ' +
      'Audio consultation workflow requires Whisper or multimodal audio provider (e.g., Gemini).'
    );
  }

  async chat(messages) {
    return this._callMedGemma(messages, false);
  }

  /**
   * Clinical note generation from consultation transcript and patient context.
   */
  async generateNote(transcript, patientContext, noteSchema, template) {
    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      throw new Error('Consultation transcript is required to generate a clinical note.');
    }

    const templateName = template || 'General Consultation';
    const schemaInstructions = templateName === 'SOAP'
      ? `The output JSON object MUST have these exact keys:
- "subjective": string summarizing patient-reported symptoms, history, concerns
- "objective": string summarizing examination, observations, vital signs
- "assessment": string summarizing clinical impression and differential
- "plan": string summarizing treatment recommendations, prescriptions, follow-up`
      : `The output JSON object MUST have these exact keys:
- "chiefComplaint": string
- "historyOfPresentIllness": string
- "relevantHistory": string
- "medications": array of strings
- "allergies": array of strings
- "examinationFindings": string
- "investigations": array of strings
- "assessment": string
- "plan": string
- "followUp": string`;

    const prompt = `You are MedGemma, a specialized clinical AI assistant running locally.
Given the consultation transcript and patient background, generate a structured clinical note formatted for a ${templateName}.

CLINICAL CONSTRAINTS:
1. You generate preliminary drafts ONLY. The attending physician remains the final authority and must review, edit, and sign off.
2. Do NOT fabricate, assume, or extrapolate clinical facts not mentioned in the transcript or context.
3. If information for a section is missing from dialogue, write "Not mentioned" or "None".
4. You must respond ONLY with a valid JSON object matching the schema below. No conversational preambles, output valid JSON only.

SCHEMA REQUIREMENTS:
${schemaInstructions}

PATIENT CONTEXT:
${patientContext || 'None provided'}

CONSULTATION TRANSCRIPT:
${transcript}`;

    const messages = [
      {
        role: "user",
        content: prompt
      }
    ];

    const result = await this._callMedGemma(messages, true);

    // Ensure parsed note satisfies required clinical fields
    try {
      const parsed = JSON.parse(result.text);
      if (templateName === 'SOAP') {
        const cleanedSOAP = {
          subjective: ensureString(parsed.subjective),
          objective: ensureString(parsed.objective),
          assessment: ensureString(parsed.assessment),
          plan: ensureString(parsed.plan)
        };
        result.text = JSON.stringify(cleanedSOAP);
      } else {
        const cleanedGeneral = {
          chiefComplaint: ensureString(parsed.chiefComplaint),
          historyOfPresentIllness: ensureString(parsed.historyOfPresentIllness),
          relevantHistory: ensureString(parsed.relevantHistory),
          medications: Array.isArray(parsed.medications) ? parsed.medications : [],
          allergies: Array.isArray(parsed.allergies) ? parsed.allergies : [],
          examinationFindings: ensureString(parsed.examinationFindings),
          investigations: Array.isArray(parsed.investigations) ? parsed.investigations : [],
          assessment: ensureString(parsed.assessment),
          plan: ensureString(parsed.plan),
          followUp: ensureString(parsed.followUp)
        };
        result.text = JSON.stringify(cleanedGeneral);
      }
    } catch {
      // If parsing failed, result.text remains as extracted so downstream validator provides clean error
    }

    return result;
  }

  /**
   * Multimodal medical document fact extraction.
   * Uses MLX-VLM's OpenAI-compatible image_url format for image inputs.
   */
  async extractDocument(fileBuffer, mimeType, filename, documentSchema) {
    if (!fileBuffer || !(fileBuffer instanceof Buffer) || fileBuffer.length === 0) {
      throw new Error('Invalid or empty document buffer provided for extraction.');
    }

    const promptText = `You are MedGemma, a specialized clinical AI model analyzing a medical document (${filename || 'unnamed document'}).
Extract all clinically relevant facts from this document.

CLINICAL SAFETY RULES:
1. Do NOT invent, assume, or extrapolate facts.
2. For each extracted fact, provide an exact quote from the document text in "source_quote".
3. Categorize facts strictly as: "medication", "diagnosis", "lab", "procedure", "allergy", or "other".
4. Provide a confidence score between 0.0 and 1.0 reflecting extraction certainty.
5. Provide the document date if documented, or "Recent".
6. The output must strictly be a JSON object with this structure:
{
  "document_date": "YYYY-MM-DD or Recent",
  "document_type": "string (e.g. Lab Report, Discharge Summary, Clinical Note, Radiology Report)",
  "facts": [
    {
      "category": "medication" | "diagnosis" | "lab" | "procedure" | "allergy" | "other",
      "text": "string describing the clinical fact",
      "confidence": number between 0.0 and 1.0,
      "source_quote": "exact verbatim quote from document"
    }
  ]
}

Respond ONLY with valid JSON.`;

    const isImage = mimeType && (mimeType.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(filename || ''));
    const messages = [];

    if (isImage) {
      const base64Data = fileBuffer.toString('base64');
      const dataUrl = `data:${mimeType || 'image/png'};base64,${base64Data}`;
      messages.push({
        role: "user",
        content: [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: dataUrl } }
        ]
      });
    } else {
      const textContent = fileBuffer.toString('utf-8');
      messages.push({
        role: "user",
        content: `${promptText}\n\nDOCUMENT CONTENT:\n${textContent}`
      });
    }

    const result = await this._callMedGemma(messages, true);

    // Normalize categories and format for Proton downstream verification and FHIR staging
    try {
      const parsed = JSON.parse(result.text);
      const rawFacts = Array.isArray(parsed.facts) ? parsed.facts : [];
      const normalizedFacts = rawFacts.map(f => ({
        category: normalizeCategory(f.category),
        text: typeof f.text === 'string' ? f.text : String(f.text || ''),
        confidence: typeof f.confidence === 'number' ? Math.min(1.0, Math.max(0.0, f.confidence)) : 0.90,
        source_quote: typeof f.source_quote === 'string' ? f.source_quote : String(f.source_quote || f.quote || f.text || '')
      }));

      const normalizedResult = {
        document_date: parsed.document_date || 'Recent',
        document_type: parsed.document_type || 'Clinical Document',
        facts: normalizedFacts
      };
      result.text = JSON.stringify(normalizedResult);
    } catch {
      // If parsing failed, result.text remains as extracted
    }

    return result;
  }

  /**
   * Internal HTTP caller for local OpenAI-compatible MLX-VLM inference server.
   * Handles timeouts, network unreachability, thinking token stripping, and error sanitization.
   */
  async _callMedGemma(messages, requireJson = true) {
    const payload = {
      model: this.modelName,
      messages,
      temperature: 0.1,
      max_tokens: parseInt(process.env.MEDGEMMA_MAX_TOKENS || '1024', 10),
      stream: false
    };

    let res;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (networkErr) {
      const isTimeout = networkErr.name === 'AbortError' || networkErr.name === 'TimeoutError';
      if (isTimeout) {
        const err = new Error(`MedGemma local inference server timed out after ${this.timeoutMs}ms at ${this.baseUrl}.`);
        err.status = 504;
        err.name = 'TimeoutError';
        err.code = 'MEDGEMMA_TIMEOUT';
        throw err;
      }

      const err = new Error(
        `MedGemma local inference server is unavailable at ${this.baseUrl} (${networkErr.message}). ` +
        `Please ensure the local MedGemma server (MLX-VLM serving ${this.modelName}) is running.`
      );
      err.status = 503;
      err.code = 'MEDGEMMA_UNAVAILABLE';
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let errorMsg = `MedGemma API Error: ${res.status} ${res.statusText}`;
      try {
        const errObj = JSON.parse(errorText);
        if (errObj.error && errObj.error.message) {
          errorMsg += ` - ${errObj.error.message}`;
        }
      } catch {
        if (errorText) {
          errorMsg += ` - ${errorText.slice(0, 200)}`;
        }
      }
      const err = new Error(errorMsg);
      err.status = res.status;
      err.code = 'MEDGEMMA_API_ERROR';
      throw err;
    }

    const data = await res.json();
    let textContent = data.choices?.[0]?.message?.content || '';

    if (requireJson && typeof textContent === 'string') {
      textContent = extractJsonFromContent(textContent);
    }

    const usage = data.usage || {};
    const usageMetadata = {
      promptTokenCount: usage.prompt_tokens || 0,
      candidatesTokenCount: usage.completion_tokens || 0,
      totalTokenCount: usage.total_tokens || 0
    };

    return {
      text: textContent,
      usageMetadata,
      model: this.modelName
    };
  }
}

module.exports = MedGemmaProvider;
