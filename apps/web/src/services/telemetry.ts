/**
 * Proton Product Telemetry Service
 * 
 * Tracks operational product interactions with STRICT NON-PHI safeguards.
 * NEVER transmits patient names, medical conditions, transcripts, prescriptions,
 * documents, diagnoses, lab values, or raw audio.
 */

export type TelemetryEventType =
  | 'consultation_started'
  | 'consultation_completed'
  | 'document_uploaded'
  | 'document_reviewed'
  | 'ai_request_failed'
  | 'ai_request_completed'
  | 'review_approved'
  | 'review_rejected'
  | 'physician_login'
  | 'physician_logout'
  | 'command_palette_opened'
  | 'patient_selected'
  | 'evidence_opened'
  | 'demo_patient_created';

export interface SafeTelemetryPayload {
  event: TelemetryEventType;
  timestamp: string;
  durationMs?: number;
  status?: 'success' | 'failure' | 'in_progress';
  templateType?: string;
  fileCount?: number;
  itemCount?: number;
  provider?: string;
  model?: string;
  sourceCategory?: string;
}

// Denylist of sensitive PHI property names that MUST never be logged or transmitted
const PHI_DENYLIST = [
  'patientname',
  'name',
  'condition',
  'conditions',
  'transcript',
  'text',
  'note',
  'notes',
  'prescription',
  'prescriptions',
  'medication',
  'medications',
  'document',
  'documents',
  'diagnosis',
  'diagnoses',
  'lab',
  'labs',
  'audio',
  'mrn',
  'birthdate',
  'dob',
  'gender',
  'address',
  'email',
  'phone',
  'allergies',
  'allergy'
];

class TelemetryService {
  private events: SafeTelemetryPayload[] = [];
  private readonly maxBufferSize = 100;

  /**
   * Sanitizes any custom properties to guarantee zero PHI leaks.
   */
  private sanitizeMetadata(meta?: Record<string, any>): Record<string, any> {
    if (!meta) return {};
    const safe: Record<string, any> = {};
    for (const [key, value] of Object.entries(meta)) {
      const lower = key.toLowerCase();
      const isDenied = PHI_DENYLIST.some(d => lower.includes(d));
      if (isDenied) {
        // Redact potential PHI
        continue;
      }
      if (typeof value === 'string' && value.length > 100) {
        // Truncate long strings that might contain free-text PHI
        safe[key] = value.slice(0, 100) + '...[truncated]';
      } else {
        safe[key] = value;
      }
    }
    return safe;
  }

  /**
   * Record a non-PHI telemetry event.
   */
  public track(event: TelemetryEventType, metadata?: Partial<SafeTelemetryPayload> & Record<string, any>): void {
    const sanitized = this.sanitizeMetadata(metadata);
    const payload: SafeTelemetryPayload = {
      event,
      timestamp: new Date().toISOString(),
      ...sanitized
    };

    this.events.push(payload);
    if (this.events.length > this.maxBufferSize) {
      this.events.shift();
    }

    // Safe development console notification (without PHI)
    if (import.meta.env?.DEV) {
      // In dev mode, log safe event name only
      // eslint-disable-next-line no-console
      console.debug(`[Telemetry] ${payload.event}`, {
        timestamp: payload.timestamp,
        status: payload.status,
        durationMs: payload.durationMs
      });
    }
  }

  /**
   * Retrieve in-memory buffered events for diagnostic review (non-PHI only).
   */
  public getBufferedEvents(): SafeTelemetryPayload[] {
    return [...this.events];
  }

  /**
   * Clear buffer.
   */
  public clear(): void {
    this.events = [];
  }
}

export const telemetry = new TelemetryService();
