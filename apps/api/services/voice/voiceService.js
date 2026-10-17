/**
 * Proton Clinical Voice & Speech Transcription Service
 *
 * Provides audio validation, speech-to-text processing, provenance,
 * and clinical context integration.
 *
 * Invariants:
 * 1. INVALID / SILENT / UNSUPPORTED AUDIO MUST RETURN A REAL ERROR.
 * 2. NEVER use a fake fallback transcript.
 * 3. Enforces patient and tenant isolation boundaries.
 * 4. Audit logging on success and failure without logging raw audio bytes or credentials.
 */

const crypto = require('crypto');
const { mediaService, TranscriptionInputError, MediaValidationError } = require('../media/mediaService');
const { getProvider } = require('../../providers/factory');
const { WhisperProvider } = require('./whisperProvider');
const { auditService } = require('../audit/auditService');

class VoiceServiceError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'VoiceServiceError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class VoiceService {
  constructor(options = {}) {
    this._provider = options.provider || null;
    this._whisperProvider = new WhisperProvider(options.whisper || {});
  }

  get provider() {
    if (!this._provider) {
      this._provider = getProvider();
    }
    return this._provider;
  }

  setProvider(provider) {
    this._provider = provider;
  }

  /**
   * Transcribes a consultation audio buffer with strict validation.
   *
   * @param {Object} params
   * @param {Buffer} params.audioBuffer - Raw audio binary
   * @param {string} [params.mimeType='audio/webm'] - Audio MIME type
   * @param {string} [params.patientId] - Target patient ID
   * @param {string} [params.tenantId='org-default'] - Organization tenant ID
   * @param {string} [params.encounterId] - Optional encounter ID
   * @param {Object} [params.actor] - Authenticated actor performing transcription
   * @returns {Promise<Object>} Transcription envelope
   */
  async transcribeAudio({
    audioBuffer,
    mimeType = 'audio/webm',
    patientId = null,
    tenantId = 'org-default',
    encounterId = null,
    actor = null
  }) {
    // 1. Strict media input validation
    try {
      mediaService.validateAudioInput(audioBuffer, mimeType);
    } catch (valErr) {
      auditService.recordPipelineStage({
        stage: 'TRANSCRIPTION_FAILED',
        patientId: patientId || 'unbound',
        actorId: actor?.actorId || 'system',
        actorRole: actor?.actorRole || 'system',
        status: 'FAILED',
        summary: `Audio validation rejected: ${valErr.message}`,
        resultingState: 'VALIDATION_REJECTED',
        tenantId
      });

      if (valErr instanceof TranscriptionInputError || valErr instanceof MediaValidationError) {
        throw valErr;
      }
      throw new VoiceServiceError('AUDIO_VALIDATION_FAILED', valErr.message, 400);
    }

    const cleanPatientId = patientId ? String(patientId).replace(/^Patient\//, '').trim() : null;
    const sha256 = crypto.createHash('sha256').update(audioBuffer).digest('hex');
    const transcriptionId = `tx-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

    // 2. Execute Transcription via Provider (Gemini / Whisper / Demo)
    let result = null;
    try {
      result = await this.provider.transcribe(audioBuffer, mimeType);
    } catch (providerErr) {
      auditService.recordPipelineStage({
        stage: 'TRANSCRIPTION_FAILED',
        patientId: cleanPatientId || 'unbound',
        actorId: actor?.actorId || 'system',
        actorRole: actor?.actorRole || 'system',
        status: 'FAILED',
        summary: `Transcription provider failure: ${providerErr.message}`,
        resultingState: 'PROVIDER_ERROR',
        tenantId
      });

      if (providerErr.code === 'WHISPER_UNAVAILABLE' || providerErr.code === 'MEDGEMMA_UNAVAILABLE') {
        throw new VoiceServiceError(providerErr.code, providerErr.message, 503);
      }
      if (providerErr.name === 'TimeoutError') {
        throw new VoiceServiceError('TRANSCRIPTION_TIMEOUT', 'Speech-to-text service timed out.', 504);
      }
      throw new VoiceServiceError('TRANSCRIPTION_ERROR', `Audio transcription failed: ${providerErr.message}`, 502);
    }

    // 3. Silence / Empty Speech Guard
    // INVARIANT: NEVER fabricate fallback text if transcription produces empty speech
    if (!result || !result.text || !result.text.trim()) {
      auditService.recordPipelineStage({
        stage: 'TRANSCRIPTION_FAILED',
        patientId: cleanPatientId || 'unbound',
        actorId: actor?.actorId || 'system',
        actorRole: actor?.actorRole || 'system',
        status: 'FAILED',
        summary: 'No speech recognized from audio recording.',
        resultingState: 'SILENT_AUDIO_REJECTED',
        tenantId
      });
      throw new TranscriptionInputError('No speech could be recognized from the provided audio.');
    }

    const recognizedText = result.text.trim();

    // 4. Record Successful Audit
    auditService.recordPipelineStage({
      stage: 'TRANSCRIPTION_COMPLETED',
      patientId: cleanPatientId || 'unbound',
      actorId: actor?.actorId || 'system',
      actorRole: actor?.actorRole || 'system',
      status: 'SUCCESS',
      summary: `Audio transcribed (${recognizedText.length} chars, model: ${result.model || 'provider'}). SHA256: ${sha256}`,
      resultingState: 'TRANSCRIPTION_AVAILABLE',
      tenantId
    });

    return {
      transcriptionId,
      text: recognizedText,
      model: result.model || this.provider.modelName || 'voice-provider',
      usage: result.usageMetadata || null,
      sha256,
      mimeType,
      byteSize: audioBuffer.length,
      patientId: cleanPatientId,
      tenantId,
      encounterId,
      sourceAttribution: 'PATIENT_REPORTED',
      transcribedAt: new Date().toISOString()
    };
  }
}

const voiceService = new VoiceService();

module.exports = {
  VoiceService,
  voiceService,
  VoiceServiceError,
  TranscriptionInputError,
  MediaValidationError
};
