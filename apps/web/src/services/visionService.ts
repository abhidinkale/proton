/**
 * Proton Vision Intelligence & Clinician Review Client
 */

import type {
  VisionAnalysisResult,
  ClinicianReviewRecord,
  SubmitVisionReviewParams
} from '../types/vision';
import { apiFetch } from '../lib/api';

const API_BASE = '/api/vision';

export async function analyzeMedia(params: {
  mediaId: string;
  patientId?: string;
  encounterId?: string;
  prompt?: string;
}): Promise<VisionAnalysisResult> {
  const res = await apiFetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Failed to analyze media (${res.status})`);
  }

  return res.json();
}

export async function getAnalysesForMedia(mediaId: string): Promise<{ analyses: VisionAnalysisResult[] }> {
  const res = await apiFetch(`${API_BASE}/analyses/${encodeURIComponent(mediaId)}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Failed to fetch analyses (${res.status})`);
  }
  return res.json();
}

export async function submitVisionReview(params: SubmitVisionReviewParams): Promise<ClinicianReviewRecord & { success: boolean; isDuplicate?: boolean }> {
  const res = await apiFetch(`${API_BASE}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Failed to submit clinician review (${res.status})`);
  }

  return res.json();
}

export async function getVisionReviews(analysisId: string): Promise<{ reviews: ClinicianReviewRecord[] }> {
  const res = await apiFetch(`${API_BASE}/reviews/${encodeURIComponent(analysisId)}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Failed to fetch clinician reviews (${res.status})`);
  }
  return res.json();
}

export function getMediaFileUrl(mediaId: string): string {
  return `/api/capture/media/${encodeURIComponent(mediaId)}/file`;
}
