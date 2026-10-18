import { API_BASE_URL } from '../config';

export interface ClinicalAIService {
  generateNote(transcript: string, patientContext?: string, template?: string): Promise<any>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendClinicalChat(messages: ChatMessage[], patientContext?: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, patientContext }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Clinical chat is unavailable. Please try again.');
  }
  if (typeof data.message !== 'string' || !data.message.trim()) {
    throw new Error('Clinical chat returned an empty response. Please try again.');
  }
  return data.message;
}

export class RealAIService implements ClinicalAIService {
  async generateNote(transcript: string, patientContext?: string, template?: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/generate-note`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript, patientContext, template }),
    });
    
    if (!response.ok) {
      const errPayload = await response.json().catch(() => ({}));
      throw new Error(errPayload.error || 'AI service unavailable. Please retry or continue manually.');
    }
    
    const data = await response.json();
    return data.note;
  }
}

export interface NoteTemplateDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: string[];
}

export async function fetchNoteTemplates(): Promise<NoteTemplateDefinition[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/note-templates`);
    if (!res.ok) return getDefaultTemplates();
    const data = await res.json();
    return data.templates || getDefaultTemplates();
  } catch {
    return getDefaultTemplates();
  }
}

function getDefaultTemplates(): NoteTemplateDefinition[] {
  return [
    {
      id: 'SOAP',
      name: 'SOAP Note',
      category: 'Standard Clinical',
      description: 'Subjective, Objective, Assessment, Plan structured note for outpatient and hospital rounds.',
      fields: ['subjective', 'objective', 'assessment', 'plan']
    },
    {
      id: 'GENERAL',
      name: 'Comprehensive Consultation',
      category: 'Full Visit',
      description: 'Detailed multi-system clinical note with HPI, medications, allergies, physical exam, and follow-up.',
      fields: ['chiefComplaint', 'historyOfPresentIllness', 'relevantHistory', 'medications', 'allergies', 'examinationFindings', 'investigations', 'assessment', 'plan', 'followUp']
    },
    {
      id: 'HANDOVER',
      name: 'Emergency / Shift Handover (SBAR)',
      category: 'Transitions of Care',
      description: 'Succinct shift transfer note formatted as Situation, Background, Assessment, Recommendation.',
      fields: ['situation', 'background', 'assessment', 'recommendation']
    },
    {
      id: 'PSYCH',
      name: 'Psychiatric Evaluation (MSE)',
      category: 'Specialty Mental Health',
      description: 'Mental health encounter with detailed Mental Status Exam (MSE), presenting stressors, and impression/plan.',
      fields: ['historyOfPresentingIllness', 'mentalStatusExam', 'impressionAndPlan']
    }
  ];
}

export async function generateConsultationLabel(transcript: string, patientName?: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/consultation/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, patientName })
    });
    if (!res.ok) throw new Error('Labeling failed');
    const data = await res.json();
    return data.label;
  } catch {
    const prefix = patientName ? `[${patientName.split(' ')[0]}]: ` : '';
    return `${prefix}Clinical Brief`;
  }
}

export async function submitEncounterFeedback(payload: {
  encounterId: string;
  patientId: string;
  clinicianId?: string;
  overallRating: number;
  noteDraftStatus?: string;
  comments?: string;
  encounterDurationMinutes?: number;
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/pilot/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        encounterDurationMinutes: payload.encounterDurationMinutes || 8,
        noteWordCount: 150
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function formatNoteToText(noteJson: any, template?: string): string {
  if (!noteJson) return '';
  
  if (template === 'SOAP') {
    return `SUBJECTIVE:
${noteJson.subjective || 'None'}

OBJECTIVE:
${noteJson.objective || 'None'}

ASSESSMENT:
${noteJson.assessment || 'None'}

PLAN:
${noteJson.plan || 'None'}`;
  }

  if (template === 'HANDOVER') {
    return `SITUATION:
${noteJson.situation || 'None'}

BACKGROUND:
${noteJson.background || 'None'}

ASSESSMENT:
${noteJson.assessment || 'None'}

RECOMMENDATION:
${noteJson.recommendation || 'None'}`;
  }

  if (template === 'PSYCH') {
    return `HISTORY OF PRESENTING ILLNESS:
${noteJson.historyOfPresentingIllness || 'None'}

MENTAL STATUS EXAM (MSE):
${noteJson.mentalStatusExam || 'None'}

PAST MEDICAL & PSYCH HISTORY:
${noteJson.pastMedicalHistory || 'None'}

CURRENT MEDICATIONS:
${noteJson.medications || 'None'}

IMPRESSION AND SAFETY PLAN:
${noteJson.impressionAndPlan || 'None'}`;
  }

  return `CHIEF COMPLAINT:
${noteJson.chiefComplaint || 'None'}

HISTORY OF PRESENT ILLNESS:
${noteJson.historyOfPresentIllness || 'None'}

RELEVANT HISTORY:
${noteJson.relevantHistory || 'None'}

MEDICATIONS:
${(Array.isArray(noteJson.medications) ? noteJson.medications : [noteJson.medications]).filter(Boolean).join(', ') || 'None'}

ALLERGIES:
${(Array.isArray(noteJson.allergies) ? noteJson.allergies : [noteJson.allergies]).filter(Boolean).join(', ') || 'None'}

EXAMINATION FINDINGS:
${noteJson.examinationFindings || 'None'}

INVESTIGATIONS:
${(Array.isArray(noteJson.investigations) ? noteJson.investigations : [noteJson.investigations]).filter(Boolean).join(', ') || 'None'}

ASSESSMENT:
${noteJson.assessment || 'None'}

PLAN:
${noteJson.plan || 'None'}

FOLLOW UP:
${noteJson.followUp || 'None'}`;
}

export interface SpecialistAssessment {
  specialist: string;
  version?: string;
  confidence?: number;
  clinicalConsiderations?: Array<{ name: string; likelihood?: string; supportingFindings?: string[] }>;
  possibleConditions?: Array<{ name: string; likelihood?: string; supportingFindings?: string[] }>;
  supportingEvidence?: string[];
  relevantFindings?: string[];
  missingInformation?: string[];
  contradictions?: string[];
  suggestedQuestions?: string[];
  draftRecommendations?: string[];
  treatmentConsiderations?: string[];
  uncertainty?: string;
  provenance?: any;
  agentId?: string;
  specialty?: string;
  name?: string;
  status?: string;
  summary?: string;
  redFlags?: string[];
  failed?: boolean;
  error?: string;
}

export interface CrossSpecialtySynthesisResult {
  status: string;
  synthesis: string;
  participatingSpecialists: string[];
  unavailableSpecialists?: string[];
  consensus: any[];
  disagreement: any[];
  missingInformation: string[];
  evidence: string[];
  uncertainty: string;
  consensusFindings?: any[];
  differingPerspectives?: Array<{ specialist: string; perspective: string }>;
  suggestedQuestions?: string[];
  redFlags?: string[];
  requiresPhysicianReview: boolean;
}

export async function routeClinicalCase(payload: {
  chiefComplaint: string;
  transcript?: string;
  patientContext?: any;
}): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/api/ai/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Routing failed');
  const data = await res.json();
  return data.routedSpecialists || [];
}

export async function runSpecialists(payload: {
  specialistIds?: string[];
  context: any;
  timeoutMs?: number;
}): Promise<SpecialistAssessment[]> {
  const res = await fetch(`${API_BASE_URL}/api/ai/specialists/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Specialist execution failed');
  const data = await res.json();
  return data.assessments || [];
}

export async function synthesizeCrossSpecialty(assessments: SpecialistAssessment[]): Promise<CrossSpecialtySynthesisResult> {
  const res = await fetch(`${API_BASE_URL}/api/ai/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assessments })
  });
  if (!res.ok) throw new Error('Cross-specialty synthesis failed');
  const data = await res.json();
  return data.synthesis;
}

export async function approveEncounterProvenance(payload: {
  provenanceEnvelope: any;
  physicianDirective?: string;
  comments?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/ai/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Approval failed');
  }
  const data = await res.json();
  return data.approvedEnvelope;
}

