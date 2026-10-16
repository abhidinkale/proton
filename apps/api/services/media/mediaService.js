/**
 * Proton Media Service
 * Validates audio, vision, and document payloads before passing to clinical AI or storage.
 * Enforces strict input validation to prevent silent fake fallbacks.
 */

class TranscriptionInputError extends Error {
  constructor(message = "No valid audio input was provided.") {
    super(message);
    this.name = "TranscriptionInputError";
    this.code = "TRANSCRIPTION_INPUT_INVALID";
    this.status = 400;
  }
}

class MediaValidationError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "MediaValidationError";
    this.code = code;
    this.status = status;
  }
}

const SUPPORTED_AUDIO_MIMES = new Set([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/aac'
]);

const SUPPORTED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

class MediaService {
  /**
   * Validates an audio buffer prior to speech-to-text processing.
   * @param {Buffer|Uint8Array|null} audioBuffer
   * @param {string} mimeType
   * @returns {{ valid: boolean, size: number, mimeType: string }}
   */
  validateAudioInput(audioBuffer, mimeType = 'audio/webm') {
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer) && !(audioBuffer instanceof Uint8Array)) {
      throw new TranscriptionInputError("No valid audio input was provided.");
    }

    const size = audioBuffer.length || 0;
    if (size < 64) {
      throw new TranscriptionInputError(`Audio buffer is too small (${size} bytes) to contain valid speech.`);
    }

    const normalizedMime = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (!SUPPORTED_AUDIO_MIMES.has(normalizedMime)) {
      throw new MediaValidationError(
        "UNSUPPORTED_AUDIO_FORMAT",
        `Audio format '${normalizedMime}' is not supported. Supported: ${Array.from(SUPPORTED_AUDIO_MIMES).join(', ')}`
      );
    }

    return {
      valid: true,
      size,
      mimeType: normalizedMime
    };
  }

  /**
   * Validates an image buffer prior to clinical vision processing.
   * @param {Buffer|Uint8Array|null} imageBuffer
   * @param {string} mimeType
   * @returns {{ valid: boolean, size: number, mimeType: string }}
   */
  validateImageInput(imageBuffer, mimeType = 'image/jpeg') {
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer) && !(imageBuffer instanceof Uint8Array)) {
      throw new MediaValidationError("IMAGE_INPUT_INVALID", "No valid image buffer was provided.");
    }

    const size = imageBuffer.length || 0;
    if (size < 128) {
      throw new MediaValidationError("IMAGE_TOO_SMALL", `Image buffer is too small (${size} bytes) to be a valid clinical image.`);
    }

    const normalizedMime = (mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();
    if (!SUPPORTED_IMAGE_MIMES.has(normalizedMime)) {
      throw new MediaValidationError(
        "UNSUPPORTED_IMAGE_FORMAT",
        `Image format '${normalizedMime}' is not supported. Supported: ${Array.from(SUPPORTED_IMAGE_MIMES).join(', ')}`
      );
    }

    return {
      valid: true,
      size,
      mimeType: normalizedMime
    };
  }
}

const mediaService = new MediaService();

module.exports = {
  MediaService,
  mediaService,
  TranscriptionInputError,
  MediaValidationError
};
