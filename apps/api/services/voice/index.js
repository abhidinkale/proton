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
const {
  PatientVoiceAgentService,
  patientVoiceAgentService,
  OUTREACH_PROTOCOLS
} = require('./patientVoiceAgentService');

module.exports = {
  VoiceService,
  voiceService,
  VoiceServiceError,
  WhisperProvider,
  TranscriptionInputError,
  MediaValidationError,
  PatientVoiceAgentService,
  patientVoiceAgentService,
  OUTREACH_PROTOCOLS
};
