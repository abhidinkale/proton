/**
 * Proton Operations OS — Email Notification Integration Adapter
 * 
 * Supports:
 * - HTML & Plain text clinical outreach email
 * - Patient portal notification links
 * - Bounce / spam simulation
 */

const BaseAdapter = require('./baseAdapter');

class EmailAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('EMAIL_GATEWAY', config);
    this.failureMode = false;
  }

  setFailureMode(enable) {
    this.failureMode = Boolean(enable);
  }

  async sendEmail({ to, subject, htmlBody, textBody, correlationId }) {
    if (!to || !subject || (!htmlBody && !textBody)) {
      throw new Error('Recipient email, subject, and message content are required.');
    }

    if (this.failureMode) {
      const err = new Error('Email gateway failed: SMTP connection timeout.');
      err.code = 'EMAIL_GATEWAY_FAILURE';
      this.logCall('sendEmail', { to, subject, correlationId }, null, err);
      throw err;
    }

    const result = {
      messageId: `email-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      to,
      subject,
      status: 'delivered',
      correlationId,
      dispatchedAt: new Date().toISOString()
    };

    this.logCall('sendEmail', { to, subject, correlationId }, result);
    return result;
  }
}

module.exports = EmailAdapter;
