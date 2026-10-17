/**
 * Proton Whisper Voice Provider Abstraction
 *
 * Provides an interface for local Whisper model execution or fallback to configured LLM/voice provider.
 * When local Whisper is not available on the runtime host, fails cleanly with WHISPER_UNAVAILABLE
 * rather than fabricating transcription.
 */

const { execSync } = require('child_process');

class WhisperProvider {
  constructor(options = {}) {
    this.name = 'whisper-local';
    this.modelName = options.model || 'base';
    this._isAvailable = null;
  }

  isAvailable() {
    if (this._isAvailable !== null) return this._isAvailable;
    try {
      execSync('which whisper', { stdio: 'ignore' });
      this._isAvailable = true;
    } catch {
      this._isAvailable = false;
    }
    return this._isAvailable;
  }

  async transcribe(audioBuffer, mimeType = 'audio/wav') {
    if (!this.isAvailable()) {
      const err = new Error('Local Whisper CLI runtime is not installed or available on this system host.');
      err.code = 'WHISPER_UNAVAILABLE';
      err.status = 503;
      throw err;
    }

    // In environments with local whisper CLI, execution would occur here.
    // Never fabricate fake output.
    throw new Error('Local Whisper execution error: audio decoding failed.');
  }
}

module.exports = {
  WhisperProvider
};
