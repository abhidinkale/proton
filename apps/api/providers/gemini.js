const { GoogleGenAI } = require('@google/genai');
const { AIProvider } = require('./ai');

class GeminiProvider extends AIProvider {
  constructor(apiKey) {
    super();
    if (!apiKey) throw new Error("GEMINI_API_KEY is required for Gemini provider");
    this.ai = new GoogleGenAI({ apiKey });
    this.modelName = 'gemini-3.8-flash';
  }

  async transcribe(audioBuffer, mimeType) {
    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/webm',
        data: audioBuffer.toString('base64')
      }
    };
    
    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: [
        audioPart,
        "Transcribe this medical consultation accurately. Output ONLY the raw transcript, nothing else. Do not add formatting or speaker labels unless explicit."
      ]
    });

    return { text: response.text, usageMetadata: response.usageMetadata, model: this.modelName };
  }

  async generateNote(transcript, patientContext, noteSchema, template) {
    const prompt = `You are an expert clinical AI. Given the following consultation transcript and patient context, generate a structured clinical note formatted as ${template}. 
Do not fabricate information. If information for a section is missing from the transcript, put "Not mentioned" or "None".

Patient Context:
${patientContext || 'None provided'}

Consultation Transcript:
${transcript}`;

    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: noteSchema,
        temperature: 0.2
      }
    });

    return { text: response.text, usageMetadata: response.usageMetadata, model: this.modelName };
  }

  async extractDocument(fileBuffer, mimeType, filename, documentSchema) {
    const filePart = {
      inlineData: {
        mimeType: mimeType,
        data: fileBuffer.toString('base64')
      }
    };
    
    const prompt = `Extract clinically useful facts from this medical document. 
Do NOT invent information. If uncertain, mark confidence low.
Categorize facts carefully into medication, diagnosis, lab, procedure, allergy, or other.`;

    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: [filePart, prompt],
      config: {
        responseMimeType: "application/json",
        responseSchema: documentSchema,
        temperature: 0.1
      }
    });

    return { text: response.text, usageMetadata: response.usageMetadata, model: this.modelName };
  }
}

module.exports = GeminiProvider;
