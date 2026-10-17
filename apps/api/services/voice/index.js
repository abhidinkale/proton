/**
 * Proton Voice Services Export
 */

const {
  VoiceService,
  voiceService,
  VoiceServiceError,
  TranscriptionInputError,
  MediaValidationError
} = require('./voiceService');
const { WhisperProvider } = require('./whisperProvider');

module.exports = {
  VoiceService,
  voiceService,
  VoiceServiceError,
  WhisperProvider,
  TranscriptionInputError,
  MediaValidationError
};
