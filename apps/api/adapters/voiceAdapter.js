/**
 * Proton Operations OS — Voice / Telephony Integration Adapter
 * 
 * Supports:
 * - Automated appointment reminder voice calls
 * - Post-discharge check-in IVR simulation
 * - Call disposition tracking (completed, voicemail, busy, unanswered)
 */

const BaseAdapter = require('./baseAdapter');

class VoiceAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('VOICE_TELEPHONY', config);
    this.failureMode = false;
  }

  setFailureMode(enable) {
    this.failureMode = Boolean(enable);
  }

  async placeCall({ to, script, expectedResponse = 'confirm_appointment', correlationId }) {
    if (!to || !script) {
      throw new Error('Recipient phone number and voice script are required.');
    }

    if (this.failureMode) {
      const err = new Error('Voice telephony failed: SIP gateway trunk unavailable.');
      err.code = 'SIP_TRUNK_FAILURE';
      this.logCall('placeCall', { to, correlationId }, null, err);
      throw err;
    }

    const result = {
      callId: `call-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      to,
      disposition: 'completed',
      durationSeconds: 42,
      patientResponse: '1', // '1' to confirm
      correlationId,
      dispatchedAt: new Date().toISOString()
    };

    this.logCall('placeCall', { to, correlationId }, result);
    return result;
  }
}

module.exports = VoiceAdapter;
