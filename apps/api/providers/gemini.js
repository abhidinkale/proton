const { GoogleGenAI } = require('@google/genai');
const { AIProvider } = require('./ai');

class GeminiProvider extends AIProvider {
  constructor(apiKey, modelName) {
    super();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required for Gemini provider");
    }
    this.apiKey = apiKey;
    this.modelName = modelName || process.env.PROTON_AI_MODEL || 'gemini-3.5-flash';
    this.ai = new GoogleGenAI({ apiKey });
  }

  async transcribe(audioBuffer, mimeType) {
    if (!audioBuffer || !(audioBuffer instanceof Buffer) || audioBuffer.length === 0) {
      throw new Error("Invalid or empty audio buffer provided for transcription.");
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/webm',
        data: audioBuffer.toString('base64')
      }
    };

    const prompt = "You are a professional medical scribe. Transcribe this patient-doctor clinical consultation accurately, completely, and verbatim. Output ONLY the raw transcript text. Do not add formatting, conversational preambles, or markdown blocks.";

    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: [audioPart, prompt],
      config: {
        temperature: 0.1
      }
    });

    const text = response.text ? response.text.trim() : '';
    return {
      text,
      usageMetadata: response.usageMetadata || null,
      model: this.modelName
    };
  }

  async generateNote(transcript, patientContext, noteSchema, template) {
    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      throw new Error("Consultation transcript is required to generate a clinical note.");
    }

    const prompt = `You are an expert clinical AI assisting a licensed physician. 
Given the consultation transcript and patient background, generate a structured clinical note formatted for a ${template || 'General Consultation'}.

CLINICAL CONSTRAINTS:
1. Do NOT fabricate or assume clinical facts not mentioned in the transcript or context.
2. If information for a section is missing from dialogue, write "Not mentioned" or "None".
3. Structure your response strictly in accordance with the provided JSON schema.
4. The output will be reviewed and signed off by the attending physician before committing to medical records.

PATIENT CONTEXT:
${patientContext || 'None provided'}

CONSULTATION TRANSCRIPT:
${transcript}`;

    const config = {
      responseMimeType: "application/json",
      temperature: 0.1
    };

    if (noteSchema) {
      config.responseSchema = noteSchema;
    }

    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: prompt,
      config
    });

    const text = response.text ? response.text.trim() : '{}';
    return {
      text,
      usageMetadata: response.usageMetadata || null,
      model: this.modelName
    };
  }

  async extractDocument(fileBuffer, mimeType, filename, documentSchema) {
    if (!fileBuffer || !(fileBuffer instanceof Buffer) || fileBuffer.length === 0) {
      throw new Error("Invalid or empty document buffer provided for extraction.");
    }

    const filePart = {
      inlineData: {
        mimeType: mimeType || 'image/png',
        data: fileBuffer.toString('base64')
      }
    };

    const prompt = `You are an expert clinical document analyst. Extract clinically relevant facts from this medical document.
Rules:
1. Do NOT invent, assume, or extrapolate facts.
2. For each extracted fact, provide an exact quote from the document text in "source_quote".
3. Categorize facts strictly as: "medication", "diagnosis", "lab", "procedure", "allergy", or "other".
4. Provide a confidence score between 0.0 and 1.0 reflecting extraction certainty.
5. Provide the document date if documented, or "Recent".
6. The output must strictly match the JSON schema.`;

    const config = {
      responseMimeType: "application/json",
      temperature: 0.1
    };

    if (documentSchema) {
      config.responseSchema = documentSchema;
    }

    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: [filePart, prompt],
      config
    });

    const text = response.text ? response.text.trim() : '{}';
    return {
      text,
      usageMetadata: response.usageMetadata || null,
      model: this.modelName
    };
  }
}

module.exports = GeminiProvider;
