/**
 * PROTON CLINICAL DOMAIN CONTRACT: ENCOUNTER & CONSULTATION
 * Strict states for ambient scribe and physician authorization.
 */

import type { PatientId } from '../patient/types';

export type EncounterId = string;

export type ConsultationState =
  | 'IDLE'
  | 'RECORDING'
  | 'PAUSED'
  | 'PROCESSING'
  | 'REVIEW'
  | 'COMPLETE'
  | 'ERROR';

export type ScribeState =
  | 'READY'
  | 'LISTENING'
  | 'PAUSED'
  | 'PROCESSING'
  | 'DRAFT_READY'
  | 'ERROR'
  | 'OFFLINE';

export type SOAPProvenance =
  | 'AI_DRAFT'
  | 'PHYSICIAN_REVIEW'
  | 'PHYSICIAN_EDITED'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'SIGNED';

export interface TranscriptEntry {
  id: string;
  speaker: 'doctor' | 'patient' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  confidence?: number;
  isEdited?: boolean;
}

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  provenance: SOAPProvenance;
  sectionProvenances?: {
    subjective: SOAPProvenance;
    objective: SOAPProvenance;
    assessment: SOAPProvenance;
    plan: SOAPProvenance;
  };
  lastEditedAt?: string;
  editedByClinician?: string;
  cryptographicHash?: string;
}

export interface PrescriptionOrder {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
  provenance: 'AI_SUGGESTION' | 'PHYSICIAN_ENTERED' | 'APPROVED';
  safetyVerified: boolean;
  contraindications?: string[];
}

export interface Encounter {
  id: EncounterId;
  patientId: PatientId;
  type: 'emergency' | 'follow-up' | 'annual-exam' | 'telehealth' | 'urgent-care';
  title: string;
  startTime: string;
  endTime?: string;
  consultationState: ConsultationState;
  scribeState: ScribeState;
  transcript: TranscriptEntry[];
  note: SOAPNote;
  prescriptions: PrescriptionOrder[];
  isSignedOff: boolean;
  signedOffAt?: string;
  signedOffBy?: string;
  tamperSeal?: string;
}
