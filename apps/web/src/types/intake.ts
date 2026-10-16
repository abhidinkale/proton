/**
 * Proton Clinical Intake Types
 * FHIR R4-aligned dynamic questionnaire and response schemas.
 */

export interface QuestionnaireAnswerOption {
  valueCoding?: {
    code: string;
    display: string;
  };
  valueString?: string;
  code?: string;
  display?: string;
}

export interface QuestionnaireEnableWhen {
  question: string;
  operator: '=' | '!=' | 'exists' | '>' | '<' | '>=' | '<=';
  answerBoolean?: boolean;
  answerString?: string;
  answerInteger?: number;
  answerCoding?: {
    code: string;
  };
}

export interface QuestionnaireItem {
  linkId: string;
  text: string;
  type: 'boolean' | 'choice' | 'integer' | 'string' | 'text';
  required?: boolean;
  enableWhen?: QuestionnaireEnableWhen[];
  enableBehavior?: 'all' | 'any';
  answerOption?: QuestionnaireAnswerOption[];
}

export interface Questionnaire {
  resourceType: 'Questionnaire';
  id: string;
  url?: string;
  version?: string;
  name?: string;
  title: string;
  status: 'draft' | 'active' | 'retired';
  description?: string;
  item: QuestionnaireItem[];
}

export interface QuestionnaireResponseAnswer {
  valueBoolean?: boolean;
  valueString?: string;
  valueInteger?: number;
  valueCoding?: {
    code: string;
    display: string;
  };
}

export interface QuestionnaireResponseItem {
  linkId: string;
  text?: string;
  answer: QuestionnaireResponseAnswer[];
}

export interface QuestionnaireResponse {
  resourceType: 'QuestionnaireResponse';
  id: string;
  questionnaire: string;
  status: 'in-progress' | 'completed' | 'amended';
  subject: {
    reference: string;
  };
  authored: string;
  author?: {
    reference: string;
  };
  item: QuestionnaireResponseItem[];
  meta?: {
    tag?: Array<{ system: string; code: string }>;
  };
}

export interface IntakeRedFlag {
  linkId: string;
  flag: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  reason: string;
}

export interface IntakeEscalationReport {
  requiresEscalation: boolean;
  escalationLevel: 'EMERGENCY' | 'URGENT' | 'ROUTINE';
  redFlagsDetected: IntakeRedFlag[];
  clinicalAction: string;
  evaluatedAt: string;
}

export interface IntakeFact {
  linkId: string;
  question: string;
  answerDisplay: string;
  code?: string;
  source: 'patient_reported';
  authored: string;
}

export interface PatientReportedClinicalContext {
  source: 'patient_reported';
  questionnaireId: string;
  questionnaireTitle: string;
  questionnaireResponseId: string;
  patientId: string;
  authored: string;
  facts: IntakeFact[];
  clinicalNarrative: string;
  escalation: IntakeEscalationReport | null;
  provenance?: any;
}
