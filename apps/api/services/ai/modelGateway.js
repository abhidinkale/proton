/**
 * Proton Unified Model Gateway & Provider Abstraction
 * 
 * Provides a resilient, fail-closed gateway separating Proton clinical logic
 * from individual underlying model providers (Jev, Gemini, MedGemma, DeepSeek, Grok, Demo).
 * 
 * Capabilities:
 * - decide: Typed decision layer (delegates to JevAdapter)
 * - generate: Unstructured prose, summaries, and narratives
 * - structuredGenerate: Schema-constrained clinical JSON extraction
 * - embed: Vector embeddings for knowledge & record retrieval
 * - transcribe: Speech-to-text audio decoding
 * 
 * Safety Invariants:
 * 1. Fails closed: Upstream failures, timeouts, and rate limits throw ModelGatewayError;
 *    NEVER convert provider failure into fabricated clinical output.
 * 2. Zero credential leakage: Privileged tokens remain strictly server-side.
 * 3. Complete provenance: Every gateway execution returns model metadata, latency, and status.
 */

const { getProvider } = require('../../providers/factory');

class ModelGatewayError extends Error {
  constructor(code, message, status = 502, details = null) {
    super(`[ModelGateway:${code}] ${message}`);
    this.name = 'ModelGatewayError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class ModelGateway {
  constructor(options = {}) {
    this.options = options;
    this._jevAdapter = options.jevAdapter || null;
    this._defaultTimeoutMs = options.timeoutMs || 8000;
  }

  get jevAdapter() {
    if (!this._jevAdapter) {
      const { jevAdapter } = require('./jevAdapter');
      this._jevAdapter = jevAdapter;
    }
    return this._jevAdapter;
  }

  setJevAdapter(adapter) {
    this._jevAdapter = adapter;
  }

  /**
   * Helper to execute an async operation with a strict timeout.
   */
  async _withTimeout(promise, timeoutMs, operationName) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new ModelGatewayError('TIMEOUT', `Operation '${operationName}' timed out after ${timeoutMs}ms`, 504));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timer);
      return result;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ModelGatewayError) throw err;
      throw new ModelGatewayError('EXECUTION_FAILURE', err.message, 502, { originalError: err.name });
    }
  }

  /**
   * Executes a typed decision request using the Jev decision layer.
   * 
   * @param {Object} request
   * @param {string} request.type - 'choice' | 'score' | 'noul'
   * @param {string} request.question - Constrained decision prompt
   * @param {Array<string>} [request.options] - Candidate choices (for 'choice')
   * @param {Object} [request.context] - Structured patient/clinical context
   * @param {number} [request.timeoutMs] - Optional override timeout
   * @returns {Promise<Object>} Typed decision result
   */
  async decide(request) {
    if (!request || !request.question) {
      throw new ModelGatewayError('INVALID_REQUEST', 'Decision request must include a question.', 400);
    }

    const type = request.type || 'choice';
    const timeout = request.timeoutMs || 2500; // Decision calls must be high-speed

    return await this._withTimeout((async () => {
      if (type === 'choice') {
        return await this.jevAdapter.choice(request.question, request.options || [], request.context);
      } else if (type === 'score') {
        return await this.jevAdapter.score(request.question, request.context);
      } else if (type === 'noul') {
        return await this.jevAdapter.noul(request.question, request.context);
      } else {
        throw new ModelGatewayError('UNSUPPORTED_DECISION_TYPE', `Decision type '${type}' is not supported.`, 400);
      }
    })(), timeout, `decide:${type}`);
  }

  /**
   * Generates clinical text, summaries, or narratives using generative models.
   * 
   * @param {Object} request
   * @param {string} request.prompt - Generation instructions
   * @param {Object} [request.context] - Context data
   * @param {string} [request.systemPrompt] - System instruction
   * @param {number} [request.timeoutMs] - Timeout
   * @returns {Promise<Object>} Generated text and metadata
   */
  async generate(request) {
    if (!request || !request.prompt) {
      throw new ModelGatewayError('INVALID_REQUEST', 'Generation request requires a prompt.', 400);
    }

    const timeout = request.timeoutMs || this._defaultTimeoutMs;
    const provider = getProvider();

    return await this._withTimeout((async () => {
      const startTime = Date.now();
      
      // If provider has generateNote method (e.g. DemoProvider or Gemini)
      let responseText = '';
      if (typeof provider.generateNote === 'function') {
        const res = await provider.generateNote(request.prompt, request.context || {}, null, 'General');
        responseText = typeof res === 'string' ? res : (res.rawNote || (res.subjective ? `${res.subjective}\n${res.assessment}\n${res.plan}` : JSON.stringify(res)));
      } else if (typeof provider.chat === 'function') {
        try {
          const messages = [
            ...(request.systemPrompt ? [{ role: 'system', text: request.systemPrompt }] : []),
            { role: 'user', text: request.prompt }
          ];
          const res = await provider.chat(messages);
          responseText = typeof res === 'string' ? res : res.text;
        } catch (chatErr) {
          throw new ModelGatewayError('CHAT_UNAVAILABLE', chatErr.message, 502);
        }
      } else {
        throw new ModelGatewayError('PROVIDER_NOT_CAPABLE', 'Active provider cannot perform text generation.', 500);
      }


      if (!responseText || !responseText.trim()) {
        throw new ModelGatewayError('EMPTY_RESPONSE', 'Model returned an empty response.', 502);
      }

      return {
        text: responseText.trim(),
        latencyMs: Date.now() - startTime,
        model: provider.model || 'active-provider',
        provider: provider.name || 'default'
      };
    })(), timeout, 'generate');
  }

  /**
   * Generates schema-constrained structured output (JSON).
   * 
   * @template T
   * @param {Object} request
   * @param {string} request.prompt - Extraction/synthesis prompt
   * @param {Object} request.schema - JSON Schema / Zod specification
   * @param {Object} [request.context] - Context data
   * @param {number} [request.timeoutMs] - Timeout
   * @returns {Promise<T>} Structured typed output
   */
  async structuredGenerate(request) {
    if (!request || !request.prompt || !request.schema) {
      throw new ModelGatewayError('INVALID_REQUEST', 'structuredGenerate requires prompt and schema.', 400);
    }

    const timeout = request.timeoutMs || this._defaultTimeoutMs;
    const provider = getProvider();

    return await this._withTimeout((async () => {
      const startTime = Date.now();
      
      let parsed = null;
      if (typeof provider.generateNote === 'function') {
        const res = await provider.generateNote(request.prompt, request.context || {}, request.schema, 'Structured');
        if (res && typeof res.text === 'string') {
          try {
            parsed = JSON.parse(res.text);
          } catch (err) {
            throw new ModelGatewayError('MALFORMED_OUTPUT', 'Provider returned non-JSON text for structured output.', 502);
          }
        } else if (typeof res === 'string') {
          try {
            parsed = JSON.parse(res);
          } catch (err) {
            throw new ModelGatewayError('MALFORMED_OUTPUT', 'Provider returned non-JSON string for structured output.', 502);
          }
        } else {
          parsed = res;
        }
      } else {
        throw new ModelGatewayError('PROVIDER_NOT_CAPABLE', 'Active provider cannot perform structured generation.', 500);
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new ModelGatewayError('MALFORMED_OUTPUT', 'Failed to generate valid structured object from provider.', 502);
      }

      // Strict Runtime Schema Validation
      if (request.schema) {
        this.validateAgainstSchema(parsed, request.schema);
      }

      return {
        data: parsed,
        latencyMs: Date.now() - startTime,
        model: provider.model || 'active-provider'
      };
    })(), timeout, 'structuredGenerate');
  }

  /**
   * Validates structured object against JSON schema specification.
   */
  validateAgainstSchema(data, schema) {
    if (!data || typeof data !== 'object') {
      throw new ModelGatewayError('SCHEMA_VALIDATION_FAILED', 'Structured AI output is not a valid JSON object.', 502);
    }

    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (data[field] === undefined || data[field] === null) {
          throw new ModelGatewayError('SCHEMA_VALIDATION_FAILED', `Structured output missing required field: '${field}'.`, 502, { missingField: field });
        }
      }
    }

    if (schema.properties && typeof schema.properties === 'object') {
      for (const [propName, propDef] of Object.entries(schema.properties)) {
        if (data[propName] !== undefined && data[propName] !== null) {
          const val = data[propName];
          const expectedType = String(propDef.type || '').toLowerCase();
          if (expectedType === 'string' || propDef.type === 1) {
            if (typeof val !== 'string') {
              throw new ModelGatewayError('SCHEMA_VALIDATION_FAILED', `Field '${propName}' must be a string, received ${typeof val}.`, 502);
            }
          } else if (expectedType === 'array' || propDef.type === 4) {
            if (!Array.isArray(val)) {
              throw new ModelGatewayError('SCHEMA_VALIDATION_FAILED', `Field '${propName}' must be an array, received ${typeof val}.`, 502);
            }
          } else if (expectedType === 'number' || propDef.type === 2) {
            if (typeof val !== 'number') {
              throw new ModelGatewayError('SCHEMA_VALIDATION_FAILED', `Field '${propName}' must be a number, received ${typeof val}.`, 502);
            }
          }
          if (propDef.enum && Array.isArray(propDef.enum) && !propDef.enum.includes(val)) {
            throw new ModelGatewayError('SCHEMA_VALIDATION_FAILED', `Field '${propName}' has invalid enum value '${val}'. Allowed: ${propDef.enum.join(', ')}`, 502);
          }
        }
      }
    }

    return true;
  }

  /**
   * Sanitizes external prompt text to prevent control character injection.
   */
  sanitizePromptText(untrustedText) {
    if (!untrustedText || typeof untrustedText !== 'string') return '';
    return untrustedText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Embeddings are not implemented.
   *
   * This method used to return a deterministic sine-wave vector derived from a
   * string hash and label it `proton-clinical-embed-v1`. That is not an
   * embedding: it carries no semantic information, and two unrelated notes can
   * collide. Returning a fake vector is worse than returning nothing, because a
   * caller cannot tell it apart from a real one. Wire a provider (for example
   * Google text-embedding-004 or a local model) and replace this body.
   */
  async embed(request) {
    if (!request || !request.text) {
      throw new ModelGatewayError('INVALID_REQUEST', 'Embedding request requires text.', 400);
    }
    throw new ModelGatewayError(
      'EMBEDDING_NOT_IMPLEMENTED',
      'No embedding provider is configured. This build does not fabricate vectors.',
      501
    );
  }

  /**
   * Transcribes audio into clinical dialogue transcript.
   * 
   * @param {Object} request
   * @param {Buffer} request.audioBuffer - Raw audio binary
   * @param {string} [request.mimeType] - Audio MIME type
   * @param {number} [request.timeoutMs] - Timeout
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(request) {
    if (!request || !request.audioBuffer || !Buffer.isBuffer(request.audioBuffer)) {
      throw new ModelGatewayError('INVALID_REQUEST', 'Transcription requires valid audioBuffer.', 400);
    }

    const timeout = request.timeoutMs || 10000;
    const provider = getProvider();

    return await this._withTimeout((async () => {
      const startTime = Date.now();
      const mimeType = request.mimeType || 'audio/wav';

      if (typeof provider.transcribe !== 'function') {
        throw new ModelGatewayError('PROVIDER_NOT_CAPABLE', 'Active provider lacks transcribe capability.', 500);
      }

      const text = await provider.transcribe(request.audioBuffer, mimeType);
      if (!text || typeof text !== 'string') {
        throw new ModelGatewayError('EMPTY_TRANSCRIPTION', 'Provider returned empty transcript.', 502);
      }

      return {
        transcript: text.trim(),
        mimeType,
        byteSize: request.audioBuffer.length,
        latencyMs: Date.now() - startTime,
        model: provider.model || 'active-transcriber'
      };
    })(), timeout, 'transcribe');
  }
}

const modelGateway = new ModelGateway();

module.exports = {
  ModelGateway,
  modelGateway,
  ModelGatewayError
};
