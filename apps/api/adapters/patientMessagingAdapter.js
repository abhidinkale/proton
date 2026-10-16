/**
 * Proton Operations OS — Patient Portal Messaging Integration Adapter
 * 
 * Supports:
 * - Inbound patient portal message retrieval
 * - Outbound secure clinical message delivery
 * - Thread tracking & read receipts
 */

const BaseAdapter = require('./baseAdapter');

class PatientMessagingAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('PATIENT_PORTAL_MESSAGING', config);
    this.messageThreads = new Map(); // key: threadId -> array of messages
  }

  async sendPortalMessage({ patientId, threadId, subject, body, senderName = 'Proton Care Team', correlationId }) {
    if (!patientId || !body) {
      throw new Error('patientId and body are required for portal messages.');
    }

    const effectiveThreadId = threadId || `thr-${patientId}-${Date.now()}`;
    const message = {
      messageId: `msg-portal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      threadId: effectiveThreadId,
      patientId,
      senderName,
      subject: subject || 'Message from Your Care Team',
      body,
      status: 'delivered',
      isRead: false,
      correlationId,
      sentAt: new Date().toISOString()
    };

    if (!this.messageThreads.has(effectiveThreadId)) {
      this.messageThreads.set(effectiveThreadId, []);
    }
    this.messageThreads.get(effectiveThreadId).push(message);

    this.logCall('sendPortalMessage', { patientId, threadId: effectiveThreadId, correlationId }, message);
    return message;
  }

  async getThreadMessages(threadId) {
    return this.messageThreads.get(threadId) || [];
  }
}

module.exports = PatientMessagingAdapter;
