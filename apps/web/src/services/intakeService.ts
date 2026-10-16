/**
 * Proton Web Intake Service
 * Communicates with backend /api/intake endpoints for dynamic clinical intake.
 */

import type { Questionnaire, QuestionnaireResponse, PatientReportedClinicalContext, IntakeEscalationReport } from '../types/intake';

const API_BASE = '/api/intake';

export interface SubmitIntakeResult {
  success: boolean;
  questionnaireResponseId: string;
  patientId: string;
  questionnaireId: string;
  questionnaireTitle: string;
  questionnaireResponse: QuestionnaireResponse;
  clinicalContext: PatientReportedClinicalContext;
  escalation: IntakeEscalationReport;
  provenance: {
    auditId: string;
    currentHash: string;
    fhirProvenanceId?: string;
    timestamp: string;
  };
}

export async function fetchQuestionnaires(): Promise<Questionnaire[]> {
  const res = await fetch(`${API_BASE}/questionnaires`);
  if (!res.ok) {
    throw new Error(`Failed to load questionnaires: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.questionnaires || [];
}

export async function fetchQuestionnaire(id: string): Promise<Questionnaire> {
  const cleanId = id.replace(/^Questionnaire\//, '');
  const res = await fetch(`${API_BASE}/questionnaires/${cleanId}`);
  if (!res.ok) {
    throw new Error(`Failed to load questionnaire ${id}: HTTP ${res.status}`);
  }
  return await res.json();
}

export async function submitIntakeResponse(
  questionnaireId: string,
  payload: {
    patientId: string;
    answers: Record<string, any>;
  }
): Promise<SubmitIntakeResult> {
  const cleanId = questionnaireId.replace(/^Questionnaire\//, '');
  const res = await fetch(`${API_BASE}/questionnaires/${cleanId}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to submit clinical intake.');
  }
  return data;
}

export async function fetchIntakeResponse(responseId: string): Promise<QuestionnaireResponse> {
  const cleanId = responseId.replace(/^QuestionnaireResponse\//, '');
  const res = await fetch(`${API_BASE}/responses/${cleanId}`);
  if (!res.ok) {
    throw new Error(`Failed to load response ${responseId}: HTTP ${res.status}`);
  }
  return await res.json();
}
