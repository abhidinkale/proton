const { AIProvider } = require('./ai');

class DeepSeekProvider extends AIProvider {
  constructor(apiKey, modelName) {
    super();
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new Error("DEEPSEEK_API_KEY is required for DeepSeek provider");
    }
    this.apiKey = apiKey.trim();
    this.modelName = modelName || process.env.DEEPSEEK_MODEL || 'deepseek-flash';
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  }

  async transcribe(audioBuffer, mimeType) {
    throw new Error('DeepSeek audio transcription not supported natively. Audio consultation workflow requires Whisper or multimodal audio provider.');
  }

  async chat(messages) {
    return this._callDeepSeek(messages, false);
  }

  async generateNote(transcript, patientContext, noteSchema, template) {
    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      throw new Error("Consultation transcript is required to generate a clinical note.");
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

    const prompt = `You are an expert clinical AI assisting a licensed physician.
Given the consultation transcript and patient background, generate a structured clinical note formatted for a ${templateName}.

CLINICAL CONSTRAINTS:
1. You generate preliminary drafts ONLY. The attending physician remains the final authority and will review, edit, and sign off.
2. Do NOT fabricate, assume, or extrapolate clinical facts not mentioned in the transcript or context.
3. If information for a section is missing from dialogue, write "Not mentioned" or "None".
4. You must respond ONLY with a valid JSON object matching the schema below. No markdown backticks, no conversational preambles.

SCHEMA REQUIREMENTS:
${schemaInstructions}

PATIENT CONTEXT:
${patientContext || 'None provided'}

CONSULTATION TRANSCRIPT:
${transcript}`;

    const messages = [
      {
        role: "system",
        content: "You are an expert clinical AI assistant. You generate structured clinical note drafts strictly adhering to JSON formatting rules. Respond only with valid JSON."
      },
      {
        role: "user",
        content: prompt
      }
    ];

    return await this._callDeepSeek(messages, true);
  }

  async extractDocument(fileBuffer, mimeType, filename, documentSchema) {
    if (!fileBuffer || !(fileBuffer instanceof Buffer) || fileBuffer.length === 0) {
      throw new Error("Invalid or empty document buffer provided for extraction.");
    }

    const textContent = fileBuffer.toString('utf-8');

    const prompt = `You are an expert clinical document analyst. Extract clinically relevant facts from this medical document (${filename || 'unnamed document'}).

RULES:
1. Do NOT invent, assume, or extrapolate facts.
2. For each extracted fact, provide an exact quote from the document text in "source_quote".
3. Categorize facts strictly as: "medication", "diagnosis", "lab", "procedure", "allergy", or "other".
4. Provide a confidence score between 0.0 and 1.0 reflecting extraction certainty.
5. Provide the document date if documented, or "Recent".
6. The output must strictly be a JSON object with this structure:
{
  "document_date": "YYYY-MM-DD or Recent",
  "document_type": "string (e.g. Lab Report, Discharge Summary, Clinic Note)",
  "facts": [
    {
      "category": "medication" | "diagnosis" | "lab" | "procedure" | "allergy" | "other",
      "text": "string describing the clinical fact",
      "confidence": number between 0.0 and 1.0,
      "source_quote": "exact verbatim quote from document"
    }
  ]
}

DOCUMENT CONTENT:
${textContent}`;

    const messages = [
      {
        role: "system",
        content: "You are an expert clinical document analysis AI assistant. You respond ONLY with valid JSON."
      },
      {
        role: "user",
        content: prompt
      }
    ];

    return await this._callDeepSeek(messages, true);
  }

  async _callDeepSeek(messages, requireJson = true) {
    const payload = {
      model: this.modelName,
      messages,
      temperature: 0.1,
      stream: false
    };

    if (requireJson) {
      payload.response_format = { type: "json_object" };
    }

    let res;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });
    } catch (networkErr) {
      const sanitizedMsg = this._sanitizeError(networkErr.message);
      const err = new Error(`DeepSeek network error: ${sanitizedMsg}`);
      err.status = 502;
      throw err;
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let errorMsg = `DeepSeek API Error: ${res.status} ${res.statusText}`;
      try {
        const errObj = JSON.parse(errorText);
        if (errObj.error && errObj.error.message) {
          errorMsg += ` - ${this._sanitizeError(errObj.error.message)}`;
        }
      } catch (e) {
        if (errorText) {
          errorMsg += ` - ${this._sanitizeError(errorText.slice(0, 200))}`;
        }
      }
      const err = new Error(errorMsg);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    let textContent = data.choices?.[0]?.message?.content || '';

    if (requireJson && typeof textContent === 'string') {
      textContent = textContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
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

  _sanitizeError(msg) {
    if (!msg || typeof msg !== 'string') return '';
    let sanitized = msg;
    if (this.apiKey) {
      sanitized = sanitized.split(this.apiKey).join('[REDACTED_API_KEY]');
    }
    sanitized = sanitized.replace(/sk-[a-zA-Z0-9_-]{20,}/g, '[REDACTED_KEY]');
    sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
    return sanitized;
  }
}

module.exports = DeepSeekProvider;
