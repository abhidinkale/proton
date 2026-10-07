export type ChangeCategory = 
  | 'NEW' 
  | 'CHANGED' 
  | 'RESOLVED' 
  | 'PENDING'
  | 'PERSISTENT'
  | 'UNRESOLVED'
  | 'POSSIBLE DISCREPANCY';

export type ClaimProvenanceLabel = 'Confirmed' | 'Reported' | 'AI-generated suggestion' | 'Needs review';

export type EvidenceSourceType = 'encounter' | 'observation' | 'medication' | 'document' | 'condition' | 'allergy';

export type ProvenanceType = 'FACT' | 'AI SYNTHESIS' | 'PHYSICIAN ENTERED';

export interface ClinicalEvidence {
  id: string;
  sourceType: EvidenceSourceType;
  sourceId: string;
  resourceType: string;
  date: string;
  title: string;
  excerpt: string;
  provenance: ProvenanceType;
}

export interface ClinicalChange {
  id: string;
  category: ChangeCategory;
  title: string;
  statement: string;
  detail?: string;
  evidence: ClinicalEvidence;
  severity: 'critical' | 'warning' | 'info';
  confidence: number;
}

export type OutstandingCategory = 
  | 'PENDING_INVESTIGATION' 
  | 'FOLLOW_UP' 
  | 'MEDICATION_DISCREPANCY' 
  | 'UNAPPROVED_DOCUMENT' 
  | 'CARE_GAP';

export interface OutstandingItem {
  id: string;
  category: OutstandingCategory;
  title: string;
  statement: string;
  detail?: string;
  evidence?: ClinicalEvidence;
  daysPending?: number;
  priority: 'high' | 'medium' | 'low';
}

export interface ClinicalStoryParagraph {
  text: string;
  evidenceIds: string[];
}

export interface ClinicalStory {
  narrative: string;
  paragraphs: ClinicalStoryParagraph[];
}

export interface PatientIntelligence {
  patientId: string;
  summary: string;
  changes: ClinicalChange[];
  activeConcerns: { name: string; date?: string; evidence?: ClinicalEvidence }[];
  currentMedications: { name: string; dose?: string; frequency?: string; evidence?: ClinicalEvidence }[];
  allergies: { allergen: string; criticality?: string; evidence?: ClinicalEvidence }[];
  recentFindings: { test: string; value: string; date?: string; isAbnormal?: boolean; evidence?: ClinicalEvidence }[];
  outstandingItems: OutstandingItem[];
  clinicalStory: ClinicalStory;
  evidenceStore: Record<string, ClinicalEvidence>;
  whatMattersToday: WhatMattersTodayItem[];
}

export type ProposalStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'EDITED';

export interface MemoryProposal {
  id: string;
  category: ChangeCategory;
  targetResourceType: 'Condition' | 'MedicationStatement' | 'MedicationRequest' | 'Observation' | 'CarePlan';
  title: string;
  proposedChange: string;
  reasoning: string;
  evidence: ClinicalEvidence[];
  status: ProposalStatus;
  editedContent?: string;
}

export interface MedicationDiscrepancy {
  id: string;
  medicationName: string;
  approvedOrder: string;
  patientReported: string;
  sourceEncounterDate?: string;
  evidence: ClinicalEvidence;
}

export interface PhysicianConsultationFeedback {
  id: string;
  patientId?: string;
  rating: number; // 1 to 5
  corrections: string[];
  comment?: string;
  timestamp: string;
  doctor: string;
  workflowDurationSeconds?: number;
}

export type FactClaimProvenance =
  | 'CONFIRMED FACT'
  | 'REPORTED BY PATIENT'
  | 'AI-INFERRED'
  | 'POSSIBLE DISCREPANCY'
  | 'NEEDS PHYSICIAN REVIEW';

export interface WhatMattersTodayItem {
  id: string;
  rank: number;
  iconType: 'safety' | 'change' | 'unresolved' | 'discrepancy' | 'finding' | 'context';
  title: string;
  statement: string;
  source: string;
  sourceDate?: string;
  provenance: FactClaimProvenance;
  evidence: ClinicalEvidence;
  severity: 'critical' | 'warning' | 'info';
}

export interface RelevantContext {
  id: string;
  title: string;
  category: 'observation' | 'medication' | 'condition' | 'allergy' | 'encounter' | 'note';
  relevance: number; // 0.0 to 1.0
  statement: string;
  source: string;
  sourceDate?: string;
  resourceType: string;
  resourceId: string;
  confidence: number;
  requiresReview: boolean;
  provenance: FactClaimProvenance;
  evidence: ClinicalEvidence;
}

export interface ConsultationChangesSummary {
  newItems: {
    category: 'problem' | 'medication' | 'symptom';
    title: string;
    statement: string;
  }[];
  changedItems: {
    category: 'dosage' | 'finding' | 'status';
    title: string;
    statement: string;
  }[];
  resolvedItems: {
    title: string;
    statement: string;
  }[];
  followUpItems: {
    title: string;
    statement: string;
    timeframe?: string;
  }[];
}
