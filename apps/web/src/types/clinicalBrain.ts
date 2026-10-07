export type ChangeCategory = 'NEW' | 'CHANGED' | 'RESOLVED' | 'PENDING';

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
