/**
 * PROTON CLINICAL DOMAIN CONTRACT: DOCUMENTS & OCR EXTRACTION
 */

import type { PatientId } from '../patient/types';

export type DocumentProcessingState =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'OCR_COMPLETE'
  | 'EXTRACTION_COMPLETE'
  | 'NEEDS_REVIEW'
  | 'REVIEWED'
  | 'FAILED';

export interface ExtractedFact {
  id: string;
  category: 'medication' | 'diagnosis' | 'lab' | 'procedure' | 'allergy' | 'other';
  text: string;
  confidence: number; // 0.0 - 1.0
  sourceQuote: string;
  approved: boolean;
  edited: boolean;
}

export interface ClinicalDocument {
  id: string;
  patientId: PatientId;
  fileName: string;
  documentType: string;
  uploadedAt: string;
  fileSizeBytes: number;
  mimeType: string;
  processingState: DocumentProcessingState;
  extractedFacts: ExtractedFact[];
  physicianReviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
}
