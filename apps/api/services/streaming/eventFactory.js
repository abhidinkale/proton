/**
 * Proton Clinical SSE Event Factory
 *
 * Constructs immutable, schema-compliant SSE event envelopes
 * adhering to the Milestone 2C-3 contract specification.
 */

const crypto = require('crypto');

const CONTRACT_VERSION = '1';

const CANONICAL_EVENT_TYPES = [
  'HEARTBEAT',
  'INPUT_RECEIVED',
  'VALIDATION_COMPLETE',
  'MULTIMODAL_CONTEXT_STARTED',
  'FHIR_CONTEXT_READY',
  'INTAKE_CONTEXT_READY',
  'DOCUMENT_CONTEXT_READY',
  'VISION_CONTEXT_READY',
  'TRANSCRIPT_CONTEXT_READY',
  'EVIDENCE_RETRIEVAL_STARTED',
  'EVIDENCE_RETRIEVAL_COMPLETE',
  'CLINICAL_CONTEXT_READY',
  'AI_ANALYSIS_STARTED',
  'AI_ANALYSIS_DELTA',
  'AI_ANALYSIS_COMPLETE',
  'SAFETY_CHECK_STARTED',
  'SAFETY_WARNING',
  'EMERGENCY_DETECTED',
  'SAFETY_LOCKED',
  'CLINICAL_OUTPUT_READY',
  'FHIR_COMMIT_STARTED',
  'FHIR_COMMIT_COMPLETE',
  'AUDIT_COMPLETE',
  'STREAM_COMPLETE',
  'STREAM_ERROR'
];

/**
 * Creates an event envelope.
 *
 * @param {Object} params
 * @param {string} params.streamId - Opaque stream ID
 * @param {string} params.type - Canonical event type
 * @param {number} params.sequence - Strictly monotonic sequence number
 * @param {Object} [params.payload] - Event-specific payload
 * @returns {Object} Strict JSON envelope
 */
function createEvent({ streamId, type, sequence, payload = {} }) {
  if (!streamId || typeof streamId !== 'string') {
    throw new Error('streamId is required and must be a string.');
  }

  const cleanType = String(type).trim().toUpperCase();
  if (!CANONICAL_EVENT_TYPES.includes(cleanType)) {
    throw new Error(`Invalid event type: ${type}. Must be one of canonical catalog.`);
  }

  if (typeof sequence !== 'number' || sequence < 1 || !Number.isInteger(sequence)) {
    throw new Error('sequence must be a positive integer.');
  }

  const eventId = `evt-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();

  return {
    version: CONTRACT_VERSION,
    eventId,
    streamId,
    type: cleanType,
    timestamp,
    sequence,
    payload: payload && typeof payload === 'object' ? payload : { value: payload }
  };
}

/**
 * Formats an event object into W3C Server-Sent Events wire format.
 *
 * @param {Object} event - Event envelope
 * @returns {string} Wire formatted string with trailing newlines
 */
function formatSseMessage(event) {
  const json = JSON.stringify(event);
  return `event: ${event.type}\nid: ${event.eventId}\ndata: ${json}\n\n`;
}

module.exports = {
  CONTRACT_VERSION,
  CANONICAL_EVENT_TYPES,
  createEvent,
  formatSseMessage
};
