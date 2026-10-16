/**
 * Proton Healthcare Operations OS — Structured Observability & Telemetry Module
 * 
 * Provides:
 * - Request correlation tracking (X-Correlation-Id)
 * - Structured JSON logging for operational metrics, latencies, and statuses
 * - INVARIANT: Zero PHI Leakage. Clinical notes, message bodies, patient transcripts,
 *   and model prompts are strictly redacted and never logged in operational telemetry.
 */

const crypto = require('crypto');

const REDACTED_PHI_KEYS = new Set([
  'message',
  'messagebody',
  'message_body',
  'inboundmessage',
  'inbound_message',
  'transcript',
  'transcription',
  'prompt',
  'clinicalnotes',
  'clinical_notes',
  'physiciandirective',
  'physician_directive',
  'patientinstruction',
  'hpisummary',
  'hpi_summary',
  'patientcontext',
  'patient_context',
  'consultationplantext',
  'consultation_plan_text',
  'patientname',
  'patient_name',
  'mrn',
  'phone',
  'birthdate',
  'birth_date',
  'dob',
  'medications',
  'allergies',
  'conditions',
  'thought',
  'thinking',
  'scratchpad',
  'internalmonologue'
]);

/**
 * Strips raw clinical payloads and PHI from an object before logging.
 */
function sanitizeForTelemetry(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeForTelemetry);
  }

  const clean = {};
  for (const [key, val] of Object.entries(data)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (REDACTED_PHI_KEYS.has(normalizedKey)) {
      clean[key] = '[REDACTED_CLINICAL_CONTENT]';
    } else if (val && typeof val === 'object') {
      clean[key] = sanitizeForTelemetry(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Emits a structured telemetry log entry
 */
function logTelemetry(eventType, metadata = {}) {
  const sanitized = sanitizeForTelemetry(metadata);
  const logEntry = {
    timestamp: new Date().toISOString(),
    event_type: eventType,
    ...sanitized
  };

  // Only emit operational telemetry in structured format
  if (process.env.NODE_ENV !== 'test') {
    console.log(JSON.stringify(logEntry));
  }
  return logEntry;
}

/**
 * Express middleware for request correlation ID and HTTP telemetry
 */
function telemetryMiddleware(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || `req-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  const startHrTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endHrTime = process.hrtime.bigint();
    const latencyMs = Number(endHrTime - startHrTime) / 1e6;

    logTelemetry('http_request_lifecycle', {
      correlation_id: correlationId,
      method: req.method,
      path: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
      status_code: res.statusCode,
      latency_ms: Math.round(latencyMs * 100) / 100,
      tenant_id: req.actor?.tenantId || req.query?.tenantId || 'unscoped',
      actor_id: req.actor?.actorId || 'anonymous',
      actor_role: req.actor?.actorRole || 'unverified',
      success: res.statusCode < 400
    });
  });

  next();
}

module.exports = {
  telemetryMiddleware,
  logTelemetry,
  sanitizeForTelemetry,
  REDACTED_PHI_KEYS
};
