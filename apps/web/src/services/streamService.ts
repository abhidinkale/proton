/**
 * Proton Real-Time Clinical Streaming Service (M2C-3)
 *
 * Provides client-side SSE connection management, line parsing,
 * monotonic sequence validation, and streaming pipeline execution.
 */

import { API_BASE_URL } from '../config';
import type { ClinicalSSEEvent, StreamMetadata, StreamExecutionOptions } from '../types/streaming';
import { medplum } from '../lib/medplum';
import { apiFetch } from '../lib/api';

function getStoredToken(): string | null {
  try {
    const raw = sessionStorage.getItem('proton_auth_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.token) return parsed.token;
    }
    return medplum.getAccessToken() || null;
  } catch {
    return null;
  }
}

/**
 * Creates an opaque clinical streaming session.
 */
export async function createClinicalStream(params: {
  patientId: string;
  encounterId?: string;
  operation?: string;
}): Promise<StreamMetadata> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await apiFetch(`${API_BASE_URL}/api/clinical/streams`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Failed to create clinical stream (${response.status})`);
  }

  return response.json();
}

/**
 * Parses an SSE text chunk stream and delivers validated events.
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  options: StreamExecutionOptions = {}
): Promise<ClinicalSSEEvent | null> {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let lastSequence = 0;
  let terminalEvent: ClinicalSSEEvent | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        if (!block.trim()) continue;

        let parsedEventType = 'message';
        let parsedEventId = '';
        let eventData = '';

        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) {
            parsedEventType = line.slice(6).trim();
          } else if (line.startsWith('id:')) {
            parsedEventId = line.slice(3).trim();
          } else if (line.startsWith('data:')) {
            eventData += (eventData ? '\n' : '') + line.slice(5).trim();
          }
        }

        if (eventData) {
          try {
            const parsed: ClinicalSSEEvent = JSON.parse(eventData);
            if (parsedEventType && parsedEventType !== 'message' && !parsed.type) {
              parsed.type = parsedEventType as any;
            }
            if (parsedEventId && !parsed.eventId) {
              parsed.eventId = parsedEventId;
            }

            // Monotonic sequence verification
            if (parsed.sequence <= lastSequence) {
              console.warn(`[SSE] Out-of-order event received: seq ${parsed.sequence} <= ${lastSequence}`);
            }
            lastSequence = parsed.sequence;

            if (options.onEvent) {
              options.onEvent(parsed);
            }

            if (parsed.type === 'STREAM_COMPLETE') {
              terminalEvent = parsed;
              if (options.onComplete) {
                options.onComplete(parsed);
              }
            } else if (parsed.type === 'STREAM_ERROR' || parsed.type === 'SAFETY_LOCKED') {
              terminalEvent = parsed;
              const err = new Error(parsed.payload?.message || parsed.payload?.reason || `Stream halted with ${parsed.type}`);
              (err as any).event = parsed;
              if (options.onError) {
                options.onError(err);
              }
            }
          } catch (parseErr) {
            console.error('[SSE] Failed to parse SSE data JSON:', parseErr, eventData);
          }
        }
      }
    }
  } catch (err: any) {
    if (err.name !== 'AbortError' && options.onError) {
      options.onError(err);
    }
    throw err;
  }

  return terminalEvent;
}

/**
 * Executes the clinical pipeline with real-time SSE event streaming.
 */
export async function streamClinicalPipeline(
  payload: any,
  options: StreamExecutionOptions = {}
): Promise<ClinicalSSEEvent | null> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body: any;
  if (payload instanceof FormData) {
    body = payload;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(payload);
  }

  const response = await apiFetch(`${API_BASE_URL}/api/clinical/pipeline/stream`, {
    method: 'POST',
    headers,
    body,
    signal: options.signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err = new Error(errorData.message || errorData.error || `Streaming pipeline failed with status ${response.status}`);
    (err as any).code = errorData.code;
    if (options.onError) {
      options.onError(err);
    }
    throw err;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Streaming response body is not readable.');
  }

  return parseSSEStream(reader, options);
}
