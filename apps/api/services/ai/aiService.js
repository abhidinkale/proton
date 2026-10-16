/**
 * Proton AI Service Boundary
 * Orchestrates LLM synthesis and speech-to-text without silent mock fallback.
 */

const { getProvider, getProviderStatus } = require('../../providers/factory');
const { mediaService, TranscriptionInputError } = require('../media/mediaService');

class AIService {
  constructor() {
    this._provider = null;
  }

  get provider() {
    if (!this._provider) {
      this._provider = getProvider();
    }
    return this._provider;
  }

  getStatus() {
    return getProviderStatus();
  }

  /**
   * Transcribes raw audio buffer after strict validation.
   * @param {Buffer} audioBuffer
   * @param {string} mimeType
   * @returns {Promise<{ text: string, model: string, usageMetadata?: Object }>}
   */
  async transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
    // Enforce strict media buffer validation
    mediaService.validateAudioInput(audioBuffer, mimeType);

    const provider = this.provider;
    const result = await provider.transcribe(audioBuffer, mimeType);

    if (!result || !result.text || !result.text.trim()) {
      throw new TranscriptionInputError("No speech could be recognized from the provided audio.");
    }

    return result;
  }

  /**
   * Generates a structured clinical SOAP note.
   * @param {string} transcript
   * @param {string} patientContext
   * @param {string} template
   * @returns {Promise<Object>}
   */
  async generateClinicalNote(transcript, patientContext = '', template = 'General Consultation') {
    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      throw new Error("Transcript text is required to generate a clinical note.");
    }

    const provider = this.provider;
    const rawResult = await provider.generateNote(
      transcript.trim(),
      patientContext,
      null, // noteSchema
      template
    );

    let structuredNote = null;
    try {
      structuredNote = typeof rawResult.text === 'string' ? JSON.parse(rawResult.text) : rawResult.text;
    } catch {
      structuredNote = { rawText: rawResult.text };
    }

    return {
      note: structuredNote,
      rawText: rawResult.text,
      model: rawResult.model || provider.modelName || 'proton-ai',
      usage: rawResult.usageMetadata || null,
      generatedAt: new Date().toISOString()
    };
  }
}

const aiService = new AIService();

module.exports = {
  AIService,
  aiService
};
