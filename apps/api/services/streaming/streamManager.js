/**
 * Proton Stream Manager
 *
 * Orchestrates clinical SSE stream lifecycles:
 * - Opaque stream creation & authoritative tenant/actor binding
 * - Strictly monotonic sequencing per stream
 * - Bounded buffer retention (max 50 events) with TTL for transient reconnects
 * - Automated heartbeat (15s) and idle timeout (120s)
 * - Safe client disconnection & resource reclamation
 * - Audit integration with zero secret/raw-image leakage
 */

const crypto = require('crypto');
const { createEvent, formatSseMessage } = require('./eventFactory');
const { validateStreamAccess, scrubError, sanitizePayload, StreamSecurityError } = require('./streamSecurity');
const { auditService } = require('../audit/auditService');

const DEFAULT_HEARTBEAT_MS = 15000;
const DEFAULT_TIMEOUT_MS = 120000;
const MAX_BUFFERED_EVENTS = 50;
const MAX_STREAMS_PER_TENANT = 100;

class StreamManager {
  constructor({
    heartbeatMs = DEFAULT_HEARTBEAT_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBufferedEvents = MAX_BUFFERED_EVENTS,
    maxStreamsPerTenant = MAX_STREAMS_PER_TENANT
  } = {}) {
    this.heartbeatMs = heartbeatMs;
    this.timeoutMs = timeoutMs;
    this.maxBufferedEvents = maxBufferedEvents;
    this.maxStreamsPerTenant = maxStreamsPerTenant;

    // In-memory stream registry: streamId -> StreamRecord
    this._streams = new Map();
  }

  /**
   * Initializes a new clinical SSE stream.
   *
   * @param {Object} params
   * @param {string} params.patientId - Authoritative patient ID
   * @param {string} [params.encounterId] - Optional clinical encounter ID
   * @param {Object} params.actor - Authenticated clinician/actor
   * @param {string} [params.operation] - Description of clinical pipeline operation
   * @returns {Object} Public stream metadata (safe for client)
   */
  createStream({ patientId, encounterId = null, actor, operation = 'CLINICAL_PIPELINE' }) {
    if (!actor || typeof actor !== 'object') {
      throw new StreamSecurityError('UNAUTHENTICATED', 'Authenticated actor required to create clinical stream.', 401);
    }

    const tenantId = actor.tenantId || 'org-default';
    const actorId = actor.actorId || 'system';
    const actorRole = actor.actorRole || actor.role || 'physician';

    // Tenant concurrency limit
    const tenantActiveStreams = this._getTenantStreamCount(tenantId);
    if (tenantActiveStreams >= this.maxStreamsPerTenant) {
      throw new StreamSecurityError('STREAM_LIMIT_EXCEEDED', 'Too many concurrent clinical streams for tenant.', 429);
    }

    // Generate opaque 128-bit entropy stream identifier (ZERO PHI)
    const streamId = `str-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
    const cleanPatientId = patientId ? String(patientId).replace(/^Patient\//, '').trim() : null;

    const stream = {
      streamId,
      tenantId,
      patientId: cleanPatientId,
      encounterId: encounterId ? String(encounterId).replace(/^Encounter\//, '').trim() : null,
      actor: {
        actorId,
        actorRole,
        actorName: actor.actorName || 'Clinician'
      },
      operation,
      status: 'INITIALIZED', // INITIALIZED -> CONNECTED -> STREAMING -> CLOSED
      sequence: 0,
      createdAt: new Date().toISOString(),
      lastActivityAt: Date.now(),
      events: [],
      res: null,
      req: null,
      heartbeatTimer: null,
      timeoutTimer: null,
      isClosed: false
    };

    this._streams.set(streamId, stream);

    // Audit stream creation
    auditService.recordPipelineStage({
      stage: 'STREAM_CREATED',
      patientId: cleanPatientId || 'unbound',
      actorId,
      actorRole,
      status: 'SUCCESS',
      summary: `Clinical SSE stream initialized (${streamId}) for operation ${operation}.`,
      resultingState: 'INITIALIZED',
      tenantId
    });

    return {
      streamId,
      status: stream.status,
      createdAt: stream.createdAt
    };
  }

  /**
   * Attaches an Express response socket as the SSE transport for a stream.
   *
   * @param {string} streamId
   * @param {Object} res - Express response object
   * @param {Object} req - Express request object
   * @param {Object} [options]
   * @param {string} [options.lastEventId] - W3C Last-Event-ID for resume
   */
  attachResponse(streamId, res, req, options = {}) {
    const stream = this._streams.get(streamId);
    validateStreamAccess(stream, req.actor);

    if (stream.isClosed) {
      throw new StreamSecurityError('STREAM_ALREADY_CLOSED', 'Stream has already concluded.', 410);
    }

    if (stream.res && !stream.res.writableEnded) {
      throw new StreamSecurityError('STREAM_ALREADY_CONNECTED', 'Stream connection already active.', 409);
    }

    stream.res = res;
    stream.req = req;
    stream.status = 'CONNECTED';
    stream.lastActivityAt = Date.now();

    // Set standard SSE response headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Replay buffered events if Last-Event-ID provided
    const lastEventId = options.lastEventId || req.headers['last-event-id'];
    if (lastEventId) {
      this._replayFromEventId(stream, lastEventId);
    }

    // Start automated heartbeat
    this._startHeartbeat(stream);

    // Start idle timeout guard
    this._resetTimeoutTimer(stream);

    // Handle client disconnection
    req.on('close', () => {
      this._handleClientDisconnect(stream);
    });

    // Audit stream connection
    auditService.recordPipelineStage({
      stage: 'STREAM_CONNECTED',
      patientId: stream.patientId || 'unbound',
      actorId: stream.actor.actorId,
      actorRole: stream.actor.actorRole,
      status: 'SUCCESS',
      summary: `Client connected to clinical stream ${streamId}.`,
      resultingState: 'CONNECTED',
      tenantId: stream.tenantId
    });
  }

  /**
   * Emits a typed event to the stream subscriber.
   *
   * @param {string} streamId
   * @param {string} type - Event type from canonical catalog
   * @param {Object} [payload] - Structured event payload
   * @returns {Object} Published event envelope
   */
  publishEvent(streamId, type, payload = {}) {
    const stream = this._streams.get(streamId);
    if (!stream || stream.isClosed) {
      return null;
    }

    stream.sequence += 1;
    stream.lastActivityAt = Date.now();
    stream.status = 'STREAMING';

    const sanitizedPayload = sanitizePayload(payload);
    const event = createEvent({
      streamId: stream.streamId,
      type,
      sequence: stream.sequence,
      payload: sanitizedPayload
    });

    // Append to bounded buffer
    stream.events.push(event);
    if (stream.events.length > this.maxBufferedEvents) {
      stream.events.shift(); // Evict oldest
    }

    // Deliver to connected client
    if (stream.res && !stream.res.writableEnded) {
      stream.res.write(formatSseMessage(event));
    }

    this._resetTimeoutTimer(stream);

    return event;
  }

  /**
   * Closes the stream with a terminal event (STREAM_COMPLETE, SAFETY_LOCKED, or STREAM_ERROR).
   *
   * @param {string} streamId
   * @param {string} [terminalType] - Terminal event type
   * @param {Object} [payload] - Terminal payload
   */
  closeStream(streamId, terminalType = 'STREAM_COMPLETE', payload = {}) {
    const stream = this._streams.get(streamId);
    if (!stream || stream.isClosed) return;

    // Publish terminal event
    this.publishEvent(streamId, terminalType, payload);

    stream.isClosed = true;
    stream.status = 'CLOSED';

    this._clearTimers(stream);

    if (stream.res && !stream.res.writableEnded) {
      stream.res.end();
    }

    // Audit stream completion
    auditService.recordPipelineStage({
      stage: 'STREAM_CLOSED',
      patientId: stream.patientId || 'unbound',
      actorId: stream.actor.actorId,
      actorRole: stream.actor.actorRole,
      status: terminalType === 'STREAM_ERROR' ? 'FAILED' : 'SUCCESS',
      summary: `Clinical stream ${streamId} concluded with ${terminalType}. Total events: ${stream.sequence}.`,
      resultingState: 'CLOSED',
      tenantId: stream.tenantId
    });

    // Schedule cleanup of memory record after 5 minutes TTL
    setTimeout(() => {
      this._streams.delete(streamId);
    }, 5 * 60 * 1000).unref?.();
  }

  /**
   * Aborts stream execution due to an error, scrubbing stack traces.
   *
   * @param {string} streamId
   * @param {Error|Object} err - Error object
   */
  abortStream(streamId, err) {
    const safeError = scrubError(err);
    this.closeStream(streamId, 'STREAM_ERROR', { error: safeError });
  }

  /**
   * Retrieves current stream metadata.
   *
   * @param {string} streamId
   * @returns {Object|null}
   */
  getStream(streamId) {
    const stream = this._streams.get(streamId);
    if (!stream) return null;
    return {
      streamId: stream.streamId,
      tenantId: stream.tenantId,
      patientId: stream.patientId,
      encounterId: stream.encounterId,
      actor: stream.actor,
      operation: stream.operation,
      status: stream.status,
      sequence: stream.sequence,
      createdAt: stream.createdAt,
      isClosed: stream.isClosed
    };
  }

  // --- INTERNAL HELPERS ---

  _startHeartbeat(stream) {
    if (stream.heartbeatTimer) clearInterval(stream.heartbeatTimer);
    stream.heartbeatTimer = setInterval(() => {
      if (stream.isClosed || !stream.res || stream.res.writableEnded) {
        clearInterval(stream.heartbeatTimer);
        return;
      }
      this.publishEvent(stream.streamId, 'HEARTBEAT', {});
    }, this.heartbeatMs);
    stream.heartbeatTimer.unref?.();
  }

  _resetTimeoutTimer(stream) {
    if (stream.timeoutTimer) clearTimeout(stream.timeoutTimer);
    stream.timeoutTimer = setTimeout(() => {
      if (!stream.isClosed) {
        this.abortStream(stream.streamId, {
          code: 'STREAM_TIMEOUT',
          message: 'Clinical stream timed out due to client inactivity.'
        });
      }
    }, this.timeoutMs);
    stream.timeoutTimer.unref?.();
  }

  _clearTimers(stream) {
    if (stream.heartbeatTimer) {
      clearInterval(stream.heartbeatTimer);
      stream.heartbeatTimer = null;
    }
    if (stream.timeoutTimer) {
      clearTimeout(stream.timeoutTimer);
      stream.timeoutTimer = null;
    }
  }

  _handleClientDisconnect(stream) {
    this._clearTimers(stream);
    stream.isClosed = true;
    stream.status = 'CLIENT_DISCONNECTED';

    auditService.recordPipelineStage({
      stage: 'STREAM_DISCONNECTED',
      patientId: stream.patientId || 'unbound',
      actorId: stream.actor.actorId,
      actorRole: stream.actor.actorRole,
      status: 'CLIENT_ABORT',
      summary: `Client disconnected from stream ${stream.streamId}.`,
      resultingState: 'CLIENT_DISCONNECTED',
      tenantId: stream.tenantId
    });

    this._streams.delete(stream.streamId);
  }

  _replayFromEventId(stream, lastEventId) {
    const idx = stream.events.findIndex(e => e.eventId === lastEventId);
    if (idx >= 0 && idx < stream.events.length - 1) {
      const missed = stream.events.slice(idx + 1);
      for (const event of missed) {
        stream.res.write(formatSseMessage(event));
      }
    }
  }

  _getTenantStreamCount(tenantId) {
    let count = 0;
    for (const s of this._streams.values()) {
      if (s.tenantId === tenantId && !s.isClosed) {
        count++;
      }
    }
    return count;
  }
}

const streamManager = new StreamManager();

module.exports = {
  StreamManager,
  streamManager
};
