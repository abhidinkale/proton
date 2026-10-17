/**
 * Proton Clinical Vision & Clinician Review Types (M2C-1 & M2C-2)
 */

export interface VisionObservation {
  label: string;
  description: string;
  severity: string;
}

export interface VisionDifferential {
  condition: string;
  rationale: string;
  likelihood: string;
  status: 'unconfirmed';
}

export interface VisionAnalysisResult {
  success: boolean;
  analysisId: string;
  mediaId: string;
  patientId: string;
  encounterId?: string;
  tenantId: string;
  observations: VisionObservation[];
  anatomicalLocation?: {
    site: string;
    laterality?: string;
  };
  confidence: number;
  uncertaintyDescription?: string;
  differentialSuggestions: VisionDifferential[];
  limitations: string[];
  imageQualityObservations?: string | Record<string, any>;
  modelMetadata: {
    provider: string;
    model: string;
    latencyMs?: number;
  };
  fhir: {
    observationId: string;
    provenanceId: string;
    status: string;
  };
  decisionSupportOnly: boolean;
  requiresPhysicianReview: boolean;
  timestamp: string;
}

export interface ClinicianReviewRecord {
  id: string;
  tenantId: string;
  analysisId: string;
  mediaId: string;
  patientId: string;
  encounterId?: string;
  actorId: string;
  actorRole: string;
  actorName: string;
  action: 'ACCEPT' | 'REJECT' | 'MODIFY';
  findingIndex: number;
  originalFinding: any;
  clinicianModification?: string | Record<string, any> | null;
  clinicianNotes?: string | null;
  fhirConditionId?: string | null;
  fhirObservationId?: string | null;
  fhirProvenanceId?: string | null;
  reviewedAt: string;
}

export interface SubmitVisionReviewParams {
  analysisId: string;
  findingIndex: number;
  targetType?: 'observation' | 'differential';
  action: 'ACCEPT' | 'REJECT' | 'MODIFY';
  modification?: string | Record<string, any>;
  notes?: string;
  patientId?: string;
  encounterId?: string;
}
