/**
 * Proton Cross-Device Capture Session Types (M2B-1)
 */

export type CaptureSessionStatusType = 
  | 'CREATED'
  | 'PAIRING'
  | 'PAIRED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REVOKED';

export interface CaptureSession {
  sessionId: string;
  status: CaptureSessionStatusType;
  patientId: string;
  encounterId?: string | null;
  createdAt: string;
  expiresAt: string;
  pairedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
}

export interface CreateCaptureSessionResponse {
  sessionId: string;
  pairingToken: string;
  expiresAt: string;
  status: 'PAIRING';
  qrPayload: string;
}

export interface PairCaptureSessionResponse {
  success: boolean;
  sessionId: string;
  status: 'PAIRED';
  mobileToken: string;
  expiresAt: string;
}

export interface UploadCapabilityResponse {
  success: boolean;
  sessionId: string;
  uploadToken: string;
  expiresAt: string;
  status: CaptureSessionStatusType;
}

export interface UploadMediaResponse {
  success: boolean;
  sessionId: string;
  mediaId: string;
  fhirMediaId: string;
  fhirProvenanceId: string;
  status: 'COMPLETED';
  dimensions: { width: number; height: number };
  size: number;
}

export interface CapturedMediaItem {
  id: string;
  tenantId: string;
  sessionId: string;
  patientId: string;
  encounterId?: string | null;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  width?: number | null;
  height?: number | null;
  fhirMediaId?: string | null;
  fhirProvenanceId?: string | null;
  capturedAt: string;
}
