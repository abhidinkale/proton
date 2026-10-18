/**
 * PROTON CLINICAL DOMAIN CONTRACT: PATIENT
 * Fully typed, decoupled from underlying FHIR R4 or database specifics.
 */

export type PatientId = string;
export type MRN = string;

export interface Demographics {
  id: PatientId;
  mrn: MRN;
  name: string;
  age: number;
  dob: string;
  gender: 'female' | 'male' | 'other' | 'unknown';
  avatarUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Vitals {
  bp: string;      // e.g. "128/82"
  hr: string;      // e.g. "72 bpm"
  rr?: string;     // e.g. "16 /min"
  spo2: string;    // e.g. "98%"
  temp?: string;   // e.g. "98.6 °F"
  bmi: string;     // e.g. "24.6"
  weightKg?: number;
  heightCm?: number;
  recordedAt: string;
}

export interface Allergy {
  id: string;
  allergen: string;
  category: 'medication' | 'food' | 'environment';
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
  isCritical: boolean;
}

export interface Condition {
  id: string;
  code?: string;
  name: string;
  status: 'active' | 'chronic' | 'remission' | 'resolved';
  diagnosedDate?: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  status: 'active' | 'discontinued' | 'completed';
  prescribedDate: string;
}

export interface LabResult {
  id: string;
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'NORMAL' | 'NEEDS_ATTENTION' | 'CRITICAL';
  recordedAt: string;
  flagNotes?: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'encounter' | 'lab' | 'medication' | 'document' | 'vital' | 'safety';
  title: string;
  summary: string;
  details?: Record<string, string>;
  severity?: 'normal' | 'info' | 'attention' | 'critical';
}

export interface Patient {
  id: PatientId;
  mrn: MRN;
  name: string;
  age: number;
  dob: string;
  gender: 'female' | 'male' | 'other' | 'unknown';
  chiefComplaint: string;
  vitals: Vitals;
  allergies: Allergy[];
  conditions: Condition[];
  medications: Medication[];
  recentLabs: LabResult[];
  timeline: TimelineEvent[];
  activeEncounterId?: string;
  riskScore?: 'low' | 'moderate' | 'high' | 'critical';
  carePlanOverview?: string;
}

export interface PatientSummary {
  id: PatientId;
  mrn: MRN;
  name: string;
  age: number;
  gender: 'female' | 'male' | 'other' | 'unknown';
  chiefComplaint: string;
  appointmentTime?: string;
  status: 'WAITING' | 'IN_CONSULTATION' | 'READY_FOR_REVIEW' | 'COMPLETED';
  criticalAllergies: string[];
  primaryCondition?: string;
  vitalsSummary?: string;
  needsAttention: boolean;
  attentionReason?: string;
}
