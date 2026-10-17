/**
 * Proton Clinical Streaming Services Module
 * Exports streamManager, eventFactory, and streamSecurity.
 */

const { streamManager, StreamManager } = require('./streamManager');
const { createEvent, formatSseMessage, CONTRACT_VERSION, CANONICAL_EVENT_TYPES } = require('./eventFactory');
const { validateStreamAccess, scrubError, sanitizePayload, StreamSecurityError } = require('./streamSecurity');

module.exports = {
  streamManager,
  StreamManager,
  createEvent,
  formatSseMessage,
  CONTRACT_VERSION,
  CANONICAL_EVENT_TYPES,
  validateStreamAccess,
  scrubError,
  sanitizePayload,
  StreamSecurityError
};
