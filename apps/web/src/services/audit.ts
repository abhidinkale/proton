import type { AuditEvent } from '@medplum/fhirtypes';

export type AuditActionType = 
  | 'ai_draft_generated'
  | 'doctor_edited_note'
  | 'warning_generated'
  | 'warning_acknowledged'
  | 'note_approved'
  | 'prescription_added'
  | 'prescription_edited'
  | 'prescription_approved'
  | 'document_fact_approved'
  | 'document_fact_rejected'
  | 'memory_proposal_generated'
  | 'memory_proposal_approved'
  | 'memory_proposal_rejected'
  | 'memory_proposal_edited'
  | 'physician_feedback_submitted'
  | 'draft_autosaved'
  | 'operation_inbound_received'
  | 'agent_triage_evaluated'
  | 'agent_draft_generated'
  | 'red_flag_alert_triggered'
  | 'refill_safety_verified'
  | 'refill_physician_approved'
  | 'refill_physician_rejected'
  | 'appointment_scheduled'
  | 'referral_dispatched';

export interface LocalAuditEvent {
  id: string;
  timestamp: string;
  action: AuditActionType;
  actor: string;
  patientId?: string;
  encounterId?: string;
  summary: string;
  details?: Record<string, any>;
}

const AUDIT_STORAGE_KEY = 'proton_audit_session_log';

/**
 * Lightweight in-memory/session audit logger.
 * Never stores unhashed credentials or raw PHI audio.
 */
class AuditTrailService {
  private events: LocalAuditEvent[] = [];

  constructor() {
    try {
      const stored = sessionStorage.getItem(AUDIT_STORAGE_KEY);
      if (stored) {
        this.events = JSON.parse(stored);
      }
    } catch {
      this.events = [];
    }
  }

  public record(
    action: AuditActionType,
    summary: string,
    options: {
      patientId?: string;
      encounterId?: string;
      actor?: string;
      details?: Record<string, any>;
    } = {}
  ): LocalAuditEvent {
    const event: LocalAuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      action,
      actor: options.actor || 'Dr. Alex Morgan, MD',
      patientId: options.patientId,
      encounterId: options.encounterId,
      summary,
      details: options.details
    };

    this.events.unshift(event);
    if (this.events.length > 100) {
      this.events = this.events.slice(0, 100);
    }

    try {
      sessionStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(this.events));
    } catch {
      // In-memory fallback
    }

    return event;
  }

  public getEvents(patientId?: string): LocalAuditEvent[] {
    if (patientId) {
      return this.events.filter(e => e.patientId === patientId);
    }
    return this.events;
  }

  /**
   * Generates a valid FHIR AuditEvent resource for inclusion in Medplum batch transactions.
   */
  public createFHIRResource(
    action: AuditActionType,
    summary: string,
    patientId: string,
    encounterRef?: string,
    actorName: string = 'Dr. Alex Morgan, MD'
  ): AuditEvent {
    return {
      resourceType: 'AuditEvent',
      type: {
        system: 'http://terminology.hl7.org/CodeSystem/audit-event-type',
        code: 'rest',
        display: 'RESTful Operation'
      },
      subtype: [
        {
          system: 'http://proton.local/fhir/audit-actions',
          code: action,
          display: summary
        }
      ],
      action: action.includes('approved') ? 'E' : 'C',
      recorded: new Date().toISOString(),
      outcome: '0', // Success
      agent: [
        {
          who: { display: actorName },
          requestor: true
        }
      ],
      source: {
        observer: { display: 'Proton Clinical OS' }
      },
      entity: [
        {
          what: { reference: `Patient/${patientId}` },
          type: {
            system: 'http://terminology.hl7.org/CodeSystem/audit-entity-type',
            code: '1',
            display: 'Person'
          },
          description: summary
        },
        ...(encounterRef ? [{
          what: { reference: encounterRef },
          description: 'Linked Clinical Encounter'
        }] : [])
      ]
    };
  }
}

export const auditService = new AuditTrailService();
