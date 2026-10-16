/**
 * Proton Operations OS — SMS Messaging Integration Adapter
 * 
 * Supports:
 * - SMS transmission with delivery callbacks
 * - Character count / GSM segment calculations
 * - Failure mode injection for reliability testing
 * - Opt-out / STOP compliance check
 */

const BaseAdapter = require('./baseAdapter');

class SmsAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('SMS_GATEWAY', config);
    this.failureMode = false;
    this.failureReason = null;
    this.optedOutNumbers = new Set(['+15550009999']); // Synthetic opt-out test list
  }

  setFailureMode(enable, reason = 'Carrier network outage') {
    this.failureMode = Boolean(enable);
    this.failureReason = enable ? reason : null;
  }

  async sendSms({ to, message, correlationId, appointmentId }) {
    if (!to || !message) {
      throw new Error('Recipient phone number and message body are required.');
    }

    if (this.optedOutNumbers.has(to)) {
      const err = new Error(`Recipient '${to}' has opted out of SMS communications.`);
      err.code = 'RECIPIENT_OPTED_OUT';
      this.logCall('sendSms', { to, correlationId }, null, err);
      throw err;
    }

    if (this.failureMode) {
      const err = new Error(`SMS delivery failed: ${this.failureReason}`);
      err.code = 'SMS_CARRIER_FAILURE';
      this.logCall('sendSms', { to, correlationId }, null, err);
      throw err;
    }

    const segments = Math.ceil(message.length / 160);
    const result = {
      messageId: `sms-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      to,
      status: 'delivered',
      segments,
      correlationId,
      appointmentId,
      dispatchedAt: new Date().toISOString()
    };

    this.logCall('sendSms', { to, messageLength: message.length, correlationId }, result);
    return result;
  }
}

module.exports = SmsAdapter;
