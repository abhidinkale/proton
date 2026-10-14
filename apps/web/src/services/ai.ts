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

  return `CHIEF COMPLAINT:
${noteJson.chiefComplaint || 'None'}

HISTORY OF PRESENT ILLNESS:
${noteJson.historyOfPresentIllness || 'None'}

RELEVANT HISTORY:
${noteJson.relevantHistory || 'None'}

MEDICATIONS:
${(noteJson.medications || []).join(', ') || 'None'}

ALLERGIES:
${(noteJson.allergies || []).join(', ') || 'None'}

EXAMINATION FINDINGS:
${noteJson.examinationFindings || 'None'}

INVESTIGATIONS:
${(noteJson.investigations || []).join(', ') || 'None'}

ASSESSMENT:
${noteJson.assessment || 'None'}

PLAN:
${noteJson.plan || 'None'}

FOLLOW UP:
${noteJson.followUp || 'None'}`;
}
