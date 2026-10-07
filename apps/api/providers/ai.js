const { GoogleGenAI, Type } = require('@google/genai');

class AIProvider {
  async transcribe(audioBuffer, mimeType) { throw new Error('Not implemented'); }
  async generateNote(transcript, patientContext, noteSchema, template) { throw new Error('Not implemented'); }
  async extractDocument(fileBuffer, mimeType, filename, documentSchema) { throw new Error('Not implemented'); }
}

module.exports = { AIProvider };
