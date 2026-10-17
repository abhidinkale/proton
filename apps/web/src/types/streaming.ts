/**
 * Proton Real-Time Clinical Streaming / SSE Type Definitions (M2C-3)
 */

export type ClinicalEventType =
  | 'HEARTBEAT'
  | 'INPUT_RECEIVED'
  | 'VALIDATION_COMPLETE'
  | 'MULTIMODAL_CONTEXT_STARTED'
  | 'FHIR_CONTEXT_READY'
  | 'INTAKE_CONTEXT_READY'
  | 'DOCUMENT_CONTEXT_READY'
  | 'VISION_CONTEXT_READY'
  | 'TRANSCRIPT_CONTEXT_READY'
  | 'EVIDENCE_RETRIEVAL_STARTED'
  | 'EVIDENCE_RETRIEVAL_COMPLETE'
  | 'CLINICAL_CONTEXT_READY'
  | 'AI_ANALYSIS_STARTED'
  | 'AI_ANALYSIS_DELTA'
  | 'AI_ANALYSIS_COMPLETE'
  | 'SAFETY_CHECK_STARTED'
  | 'SAFETY_WARNING'
  | 'EMERGENCY_DETECTED'
  | 'SAFETY_LOCKED'
  | 'CLINICAL_OUTPUT_READY'
  | 'FHIR_COMMIT_STARTED'
  | 'FHIR_COMMIT_COMPLETE'
  | 'AUDIT_COMPLETE'
  | 'STREAM_COMPLETE'
  | 'STREAM_ERROR';

export interface ClinicalSSEEvent<T = any> {
  version: string;
  eventId: string;
  streamId: string;
  type: ClinicalEventType;
  timestamp: string;
  sequence: number;
  payload: T;
}

export interface StreamMetadata {
  streamId: string;
  status: 'INITIALIZED' | 'CONNECTED' | 'STREAMING' | 'CLOSED';
  createdAt: string;
}

export interface StreamExecutionOptions {
  onEvent?: (event: ClinicalSSEEvent) => void;
  onError?: (err: Error) => void;
  onComplete?: (event: ClinicalSSEEvent) => void;
  signal?: AbortSignal;
}
