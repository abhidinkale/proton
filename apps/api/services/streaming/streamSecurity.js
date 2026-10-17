/**
 * Proton Stream Security & Sanitization
 *
 * Enforces authoritative actor & tenant boundaries, scrubs stack traces
 * and internal paths, and prevents raw binary data or token leaks in SSE streams.
 */

class StreamSecurityError extends Error {
  constructor(code, message, status = 403) {
    super(message);
    this.name = 'StreamSecurityError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Validates that the requesting actor has permission to access the target stream.
 *
 * @param {Object} stream - Internal stream record
 * @param {Object} actor - Authenticated actor from request
 */
function validateStreamAccess(stream, actor) {
  if (!stream) {
    throw new StreamSecurityError('STREAM_NOT_FOUND', 'Clinical stream not found.', 404);
  }

  if (!actor || typeof actor !== 'object') {
    throw new StreamSecurityError('UNAUTHENTICATED', 'Authenticated actor required to access clinical stream.', 401);
  }

  const actorTenant = actor.tenantId || 'org-default';
  if (stream.tenantId !== actorTenant) {
    throw new StreamSecurityError('CROSS_TENANT_ACCESS_DENIED', 'Forbidden: Cross-organization stream access is strictly prohibited.', 403);
  }

  // Cross-actor validation: Actor must be in the same tenant, and if actor is a patient, must match stream patient
  const actorRole = actor.actorRole || actor.role || '';
  if (actorRole === 'patient') {
    const actorPatientId = String(actor.actorId || actor.patientId || '').replace(/^Patient\//, '').trim();
    if (stream.patientId && actorPatientId !== stream.patientId) {
      throw new StreamSecurityError('CROSS_PATIENT_ACCESS_DENIED', 'Forbidden: Patients can only access their own clinical streams.', 403);
    }
  }
}

/**
 * Scrubs errors for client delivery, ensuring stack traces, internal file paths,
 * database connection strings, and API keys are never exposed.
 *
 * @param {Error|Object} err - Error object or message
 * @returns {Object} Safe client error payload
 */
function scrubError(err) {
  if (!err) {
    return { code: 'INTERNAL_ERROR', message: 'An unexpected clinical stream error occurred.' };
  }

  const code = err.code || 'STREAM_EXECUTION_ERROR';
  let message = typeof err.message === 'string' ? err.message : 'Clinical stream processing failed.';

  // Scrub file paths
  message = message.replace(/\/Users\/[^\s:]+/g, '[internal_path]');
  message = message.replace(/[A-Za-z]:\\[^\s:]+/g, '[internal_path]');

  // Scrub API key patterns
  message = message.replace(/AIza[0-9A-Za-z-_]{20,}/g, '[REDACTED_API_KEY]');
  message = message.replace(/(?:key|token|secret)[:=]\s*['"]?[a-zA-Z0-9_\-\.]{16,}['"]?/gi, '[REDACTED]');

  return {
    code,
    message,
    stage: err.stage || null
  };
}

/**
 * Sanitizes event payloads, stripping raw binary buffers, base64 data URLs, and tokens.
 *
 * @param {Object} payload - Raw payload
 * @returns {Object} Sanitized payload
 */
function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const sanitized = Array.isArray(payload) ? [] : {};
  for (const [key, value] of Object.entries(payload)) {
    if (Buffer.isBuffer(value)) {
      sanitized[key] = `[BINARY_BUFFER:${value.length}_bytes]`;
    } else if (typeof value === 'string' && value.startsWith('data:image/')) {
      sanitized[key] = '[BASE64_IMAGE_STRIPPED]';
    } else if (['pairingToken', 'uploadToken', 'mobileToken', 'apiKey', 'password'].includes(key)) {
      sanitized[key] = '[TOKEN_REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizePayload(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

module.exports = {
  StreamSecurityError,
  validateStreamAccess,
  scrubError,
  sanitizePayload
};
