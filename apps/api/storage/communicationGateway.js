/**
 * Proton Healthcare Operations OS — Communication Gateway Abstraction
 * 
 * Provides an abstract gateway interface and SyntheticCommunicationProvider for Phase 1.4.
 * Pluggable for future production adapters (Twilio, SendGrid, WhatsApp).
 * Supports the delivery state machine:
 *   draft -> queued -> sending -> delivered
 *   sending -> failed -> retry -> escalated
 * Includes deterministic failure injection for testing.
 */

const crypto = require('crypto');
const { getDatabase } = require('./db');

class CommunicationGateway {
  async dispatch(message) {
    throw new Error('CommunicationGateway.dispatch() must be implemented.');
  }

  async getDeliveryStatus(gatewayRef) {
    throw new Error('CommunicationGateway.getDeliveryStatus() must be implemented.');
  }
}

class SyntheticCommunicationProvider extends CommunicationGateway {
  constructor() {
    super();
    this.failureMode = false;
    this.failureReason = null;
    this.dispatches = new Map();
  }

  /**
   * For testing resilience: forces synthetic provider to simulate gateway transmission failure.
   */
  setFailureMode(enable, reason = 'SIMULATED_CARRIER_OUTAGE') {
    this.failureMode = enable;
    this.failureReason = reason;
  }

  async dispatch(message) {
    const gatewayRef = `gw-synth-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    if (this.failureMode) {
      const result = {
        success: false,
        gatewayRef,
        status: 'failed',
        error: this.failureReason,
        timestamp: new Date().toISOString()
      };
      this.dispatches.set(gatewayRef, result);
      return result;
    }

    const result = {
      success: true,
      gatewayRef,
      status: 'delivered',
      channel: message.channel,
      recipient: message.patientId,
      dispatchedAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString()
    };
    this.dispatches.set(gatewayRef, result);
    return result;
  }

  async getDeliveryStatus(gatewayRef) {
    return this.dispatches.get(gatewayRef) || { status: 'unknown', gatewayRef };
  }
}

const globalSyntheticGateway = new SyntheticCommunicationProvider();

/**
 * Queue & Dispatch an Outbound Message through the Gateway
 */
async function processOutboundMessage({
  taskId,
  patientId,
  tenantId = 'org-default',
  channel = 'portal',
  category = 'administrative',
  messageBody,
  approvedBy = null,
  approvedAt = null,
  gateway = globalSyntheticGateway
}) {
  const db = getDatabase();
  const messageId = `msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const now = new Date().toISOString();

  // 1. Initial State: 'queued'
  db.prepare(`
    INSERT INTO outbound_communications (
      id, tenant_id, task_id, patient_id,
      channel, category, message_body,
      status, delivery_attempts, approved_by,
      approved_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?);
  `).run(
    messageId,
    tenantId,
    taskId,
    patientId,
    channel,
    category,
    messageBody,
    approvedBy || null,
    approvedAt || null,
    now
  );

  // 2. Transition to 'sending'
  db.prepare(`
    UPDATE outbound_communications SET status = 'sending', delivery_attempts = delivery_attempts + 1
    WHERE id = ?;
  `).run(messageId);

  // 3. Dispatch through Gateway
  const dispatchResult = await gateway.dispatch({
    messageId,
    taskId,
    patientId,
    channel,
    category,
    messageBody
  });

  // 4. Transition to final state: 'delivered' or 'failed' / 'escalated'
  if (dispatchResult.success) {
    db.prepare(`
      UPDATE outbound_communications SET
        status = 'delivered',
        gateway_ref = ?,
        dispatched_at = ?,
        delivered_at = ?
      WHERE id = ?;
    `).run(dispatchResult.gatewayRef, dispatchResult.dispatchedAt, dispatchResult.deliveredAt, messageId);

    return {
      success: true,
      messageId,
      status: 'delivered',
      gatewayRef: dispatchResult.gatewayRef,
      dispatchedAt: dispatchResult.dispatchedAt,
      deliveredAt: dispatchResult.deliveredAt
    };
  } else {
    // If attempts >= 3, transition to 'escalated'
    const record = db.prepare('SELECT delivery_attempts FROM outbound_communications WHERE id = ?;').get(messageId);
    const newStatus = record.delivery_attempts >= 3 ? 'escalated' : 'failed';

    db.prepare(`
      UPDATE outbound_communications SET
        status = ?,
        gateway_ref = ?,
        error_message = ?
      WHERE id = ?;
    `).run(newStatus, dispatchResult.gatewayRef, dispatchResult.error, messageId);

    return {
      success: false,
      messageId,
      status: newStatus,
      gatewayRef: dispatchResult.gatewayRef,
      error: dispatchResult.error
    };
  }
}

function getMessageById(id, tenantId = 'org-default') {
  const db = getDatabase();
  return db.prepare('SELECT * FROM outbound_communications WHERE id = ? AND tenant_id = ?;').get(id, tenantId);
}

function listMessagesForTask(taskId, tenantId = 'org-default') {
  const db = getDatabase();
  return db.prepare('SELECT * FROM outbound_communications WHERE task_id = ? AND tenant_id = ? ORDER BY created_at DESC;').all(taskId, tenantId);
}

module.exports = {
  CommunicationGateway,
  SyntheticCommunicationProvider,
  globalSyntheticGateway,
  processOutboundMessage,
  getMessageById,
  listMessagesForTask
};
