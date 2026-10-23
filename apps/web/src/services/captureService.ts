/**
 * Proton Capture Session API Client
 * Facilitates desktop session management and mobile device pairing.
 */

import type {
  CaptureSession,
  CreateCaptureSessionResponse,
  PairCaptureSessionResponse
} from '../types/capture';
import { apiFetch } from '../lib/api';

const API_BASE = '/api/capture';

export async function createCaptureSession(params: {
  patientId: string;
  encounterId?: string;
  ttlMs?: number;
}): Promise<CreateCaptureSessionResponse> {
  const res = await apiFetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Failed to create capture session (${res.status})`);
  }

  return res.json();
}

export async function getCaptureSession(sessionId: string): Promise<CaptureSession> {
  const res = await apiFetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Failed to fetch session (${res.status})`);
  }
  return res.json();
}

export async function cancelCaptureSession(sessionId: string): Promise<{ success: boolean; sessionId: string; status: string }> {
  const res = await apiFetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Failed to cancel session (${res.status})`);
  }
  return res.json();
}

export async function pairCaptureSession(
  sessionId: string,
  pairingToken: string
): Promise<PairCaptureSessionResponse> {
  const res = await apiFetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairingToken })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Failed to pair session (${res.status})`);
  }
  return res.json();
}

export async function getUploadCapability(
  sessionId: string,
  mobileToken: string
): Promise<import('../types/capture').UploadCapabilityResponse> {
  const res = await apiFetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/upload-capability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileToken })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Failed to acquire upload capability (${res.status})`);
  }
  return res.json();
}

export async function uploadImage(
  sessionId: string,
  uploadToken: string,
  imageBlob: Blob | File
): Promise<import('../types/capture').UploadMediaResponse> {
  const formData = new FormData();
  formData.append('uploadToken', uploadToken);
  formData.append('image', imageBlob, 'capture.jpg');

  const res = await apiFetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Failed to upload image (${res.status})`);
  }
  return res.json();
}

export async function getSessionMedia(
  sessionId: string
): Promise<{ media: import('../types/capture').CapturedMediaItem[] }> {
  const res = await apiFetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/media`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Failed to fetch session media (${res.status})`);
  }
  return res.json();
}
