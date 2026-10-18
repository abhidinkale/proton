/**
 * PROTON CLINICAL DOMAIN CONTRACT: CLINICAL INTELLIGENCE & AI
 * Explicit specialist perspectives, non-hidden disagreements, and provenance.
 */

export type AIProvenance =
  | 'AI_SUGGESTION'
  | 'AI_EXTRACTED'
  | 'PHYSICIAN_EDITED'
  | 'PHYSICIAN_APPROVED'
  | 'SOURCE_DOCUMENT';

export interface SpecialistPerspective {
  id: string;
  specialtyId: string;
  specialtyName: string;
  confidence: number; // 0.0 - 1.0
  recommendation: string;
  clinicalConsiderations: string[];
  supportingEvidence: string[];
  missingInformation: string[];
  suggestedQuestions: string[];
  uncertaintyNotes?: string;
  draftRecommendations: string[];
}

export interface SpecialistDisagreement {
  topic: string;
  specialistA: { name: string; stance: string };
  specialistB: { name: string; stance: string };
  reasoning: string;
  evidenceComparison: string;
}

export interface SpecialistSynthesis {
  consensusFindings: string[];
  disagreements: SpecialistDisagreement[];
  synthesizedPlan: string;
  confidenceScore: number;
}

export interface EvidenceCitation {
  id: string;
  title: string;
  source: string;
  date?: string;
  pmid?: string;
  quote?: string;
  url?: string;
}

export interface ClinicalIntelligence {
  patientId: string;
  encounterId?: string;
  perspectives: SpecialistPerspective[];
  synthesis?: SpecialistSynthesis;
  citations: EvidenceCitation[];
  missingInfoChecklist: string[];
  lastUpdated: string;
}
