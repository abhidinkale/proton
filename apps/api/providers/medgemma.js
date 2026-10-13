const { AIProvider } = require('./ai');

/**
 * MedGemma 1.5 4B Local AI Provider
 * Connects to local OpenAI-compatible inference server (e.g., vLLM)
 * hosting google/medgemma-1.5-4b-it.
 *
 * Designed for local development and synthetic evaluation.
 * NEVER writes directly to FHIR. All outputs are preliminary proposals
 * requiring deterministic verification and explicit physician approval.
 */
class MedGemmaProvider extends AIProvider {
  constructor(baseUrl, modelName) {
    super();
    this.baseUrl = (baseUrl || process.env.MEDGEMMA_BASE_URL || 'http://localhost:8000/v1').replace(/\/+$/, '');
    this.modelName = modelName || process.env.MEDGEMMA_MODEL || 'google/medgemma-1.5-4b-it';
    this.timeoutMs = parseInt(process.env.MEDGEMMA_TIMEOUT_MS || '30000', 10);
  }

  /**
   * Fast connectivity check against the local inference server.
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

    const prompt = `You are MedGemma, a specialized clinical AI assistant.
Given the consultation transcript and patient background, generate a structured clinical note formatted for a ${templateName}.

CLINICAL CONSTRAINTS:
1. You generate preliminary drafts ONLY. The attending physician remains the final authority and must review, edit, and sign off.
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

    return await this._callMedGemma(messages, true);
  }

  /**
   * Multimodal medical document fact extraction.
   * Passes native image payload to MedGemma vision encoder when an image is provided.
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
}`;

    const isImage = mimeType && (mimeType.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(filename || ''));
    const messages = [
      {
        role: "system",
        content: "You are an expert clinical document analysis AI assistant. You respond ONLY with valid JSON."
      }
    ];

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

    return await this._callMedGemma(messages, true);
  }

  /**
   * Internal HTTP caller for local OpenAI-compatible inference server.
   * Handles timeouts, network unreachability, JSON validation, and error sanitization.
   */
  async _callMedGemma(messages, requireJson = true) {
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
        `Please ensure the local MedGemma server (e.g. vLLM serving ${this.modelName}) is running.`
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
      textContent = textContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
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
