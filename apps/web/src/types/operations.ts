import type { 
  Task, 
  AuditEvent 
} from '@medplum/fhirtypes';
import type { VerificationReport } from '../services/verification';

export type AgentType = 'triage' | 'scheduling' | 'refill' | 'referral';

export type AgentExecutionStatus = 
  | 'PENDING_TRIGGER'
  | 'CONTEXT_ASSEMBLING'
  | 'REASONING'
  | 'DETERMINISTIC_VERIFYING'
  | 'ESCALATED_TO_PHYSICIAN'
  | 'AUTONOMOUS_COMPLETED'
  | 'BLOCKED_SAFETY'
  | 'FAILED';

export type OperationalTaskCategory = 'triage' | 'scheduling' | 'refill' | 'referral';

export type OperationalTaskPriority = 'routine' | 'urgent' | 'emergency';

export type OperationalTaskStatus = 
  | 'requested' 
  | 'ready' 
  | 'in_progress' 
  | 'pending_reconciliation'
  | 'completed' 
  | 'rejected'
  | 'reconciliation_failed';

export interface OperationalRiskAssessment {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  emergencyRedFlag: boolean;
  redFlagCategory?: 'cardiac' | 'neurological' | 'respiratory' | 'toxicology' | 'none';
  clinicalGatingReason?: string;
  deterministicViolations: string[];
}

export interface ProposedAction {
  id: string;
  actionType: 'send_message' | 'book_appointment' | 'propose_refill' | 'dispatch_referral' | 'create_task';
  targetResourceType: 'Communication' | 'Appointment' | 'MedicationRequest' | 'ServiceRequest' | 'Task';
  payload: any;
  provenance: 'AI_DRAFT' | 'PHYSICIAN_APPROVED' | 'DOCTOR_EDITED';
  requiresPhysicianReview: boolean;
}

export interface AgentExecutionResult {
  executionId: string;
  idempotencyKey: string;
  agentType: AgentType;
  patientId: string;
  status: AgentExecutionStatus;
  risk: OperationalRiskAssessment;
  verificationReport: VerificationReport;
  proposedActions: ProposedAction[];
  fhirTask?: Task;
  auditRecord?: AuditEvent;
  timestamp: string;
}

export interface TriageItem {
  id: string;
  patientId: string;
  patientName: string;
  patientAgeSex: string;
  channel: 'portal' | 'sms' | 'voice_transcript';
  inboundMessage: string;
  receivedAt: string;
  priority: OperationalTaskPriority;
  status: OperationalTaskStatus;
  risk: OperationalRiskAssessment;
  aiDraftResponse: string;
  relevantLongitudinalContext: string[];
  communicationCategory?: 'clinical' | 'administrative';
  autonomousDispatchAllowed?: boolean;
  dispatchedAt?: string;
  physicianApprovedResponse?: string;
  physicianEdited?: boolean;
  approvedAt?: string;
  approvedBy?: string;
}

export interface RefillRequestItem {
  id: string;
  patientId: string;
  patientName: string;
  patientAgeSex: string;
  medicationName: string;
  requestedDose: string;
  requestedFrequency: string;
  daysSupply: number;
  pharmacyName?: string;
  priorMedicationRequestId?: string;
  lastPrescribedDate?: string;
  receivedAt: string;
  status: OperationalTaskStatus;
  safetyReport: {
    canApprove: boolean;
    allergyConflict: boolean;
    allergyDetails?: string;
    duplicateTherapy: boolean;
    labRecencyWarning?: string;
    renalDriftWarning?: string;
    dosageBoundaryWarning?: string;
    warnings: string[];
    blockers: string[];
  };
  clinicalContext: {
    indication: string;
    relevantLabSummary: string;
    latestCreatinine?: string;
    latestEgfr?: string;
    egfrBaseline?: string;
  };
  // Strictly enforced: AI must NOT generate, rank, or present predefined treatment/dosage options
  physicianDecisionRequired: boolean;
  physicianAction?: {
    actionType: 'approve_standard' | 'modify_dosage' | 'deny_request';
    clinicalDecisionNotes: string;
    prescribedDose?: string;
    directions?: string;
    daysSupply?: number;
    confirmedAt?: string;
    confirmedBy?: string;
  };
  fhirMedicationRequest?: any;
  approvedAt?: string;
  approvedBy?: string;
}

export interface SchedulingActionItem {
  id: string;
  patientId: string;
  patientName: string;
  patientAgeSex: string;
  triggerType: 'consultation_follow_up' | 'care_gap_recall' | 'cancellation_waitlist';
  title: string;
  clinicalReason: string;
  targetTimeframe: string; // e.g. "3 months"
  targetDateRange: { start: string; end: string };
  priority: OperationalTaskPriority;
  status: OperationalTaskStatus;
  careGapDetails?: {
    testName: string;
    lastDate?: string;
    overdueDays: number;
  };
  proposedSlot?: {
    slotId: string;
    start: string;
    end: string;
    practitionerName: string;
    location: string;
  };
  outreachDraft: string;
  outreachDispatchedAt?: string;
  bookedAppointmentId?: string;
  appointmentStatus?: 'proposed' | 'booked';
  fhirAppointment?: any;
  confirmedBy?: string;
  confirmedAt?: string;
}

export interface ReferralItem {
  id: string;
  patientId: string;
  patientName: string;
  patientAgeSex: string;
  specialty: string;
  specialtyCode?: string;
  targetProviderOrClinic?: string;
  clinicalIndication: string;
  referralSummaryPacket: {
    hpiSummary: string;
    relevantLabs: { name: string; value: string; date: string }[];
    currentMedications: string[];
    documentedAllergies: string[];
    vitalsSummary: string;
  };
  status: 'draft_prepared' | 'physician_signed' | 'dispatched_to_specialist' | 'scheduled' | 'consult_note_received';
  priority: OperationalTaskPriority;
  createdAt: string;
  signedAt?: string;
  signedBy?: string;
  pdfExportUrl?: string;
}

export interface OperationalTask {
  id: string;
  category: OperationalTaskCategory;
  priority: OperationalTaskPriority;
  status: OperationalTaskStatus;
  patientId: string;
  patientName: string;
  patientAgeSex: string;
  title: string;
  summary: string;
  sourceEvent: string;
  createdAt: string;
  reconciliationStatus?: 'none' | 'pending' | 'reconciled' | 'failed';
  reconciliationError?: string | null;
  fhirResourceId?: string | null;
  fhirResourceType?: string | null;
  deliveryStatus?: 'draft' | 'queued' | 'sending' | 'delivered' | 'failed' | 'escalated';
  persistenceMode?: 'in_memory_stub' | 'medplum_live' | 'offline_synthetic';
  isOfflineSynthetic?: boolean;
  targetQueue?: string;
  requiresManualResolution?: boolean;
  triageDetails?: TriageItem;
  refillDetails?: RefillRequestItem;
  schedulingDetails?: SchedulingActionItem;
  referralDetails?: ReferralItem;
}

export type OperationalActorRole = 'physician' | 'operations_staff' | 'agent' | 'admin' | 'clinical_staff' | 'patient';
export type DevPersonaKey = 'physician-lin' | 'ops-staff-marcus' | 'external-physician';

export interface OperationsSummary {
  pendingTriageCount: number;
  urgentRefillCount: number;
  schedulingCareGapCount: number;
  openReferralCount: number;
  emergencyAlertCount: number;
  totalActiveTasks: number;
}

export interface PatientIdentityResolutionResult {
  status: 'RESOLVED' | 'AMBIGUOUS_COLLISION' | 'UNRESOLVED';
  tier: 'TIER_1_EXACT_ID' | 'TIER_1_EXACT_MRN' | 'TIER_2_DEMOGRAPHIC' | 'TIER_3_COLLISION' | 'TIER_3_UNASSIGNED';
  confidence: number;
  patientId: string;
  patientName: string;
  patientAgeSex?: string;
  requiresManualResolution: boolean;
  targetQueue: 'OPERATIONAL_INBOX' | 'UNASSIGNED_PATIENT_TRIAGE';
  candidateIds?: string[];
  candidateNames?: string[];
  clinicalWarning?: string;
}

export interface CareGapRuleEvaluation {
  ruleId: string;
  ruleName: string;
  condition: string;
  labOrProcedure: string;
  guidelineSource: string;
  guidelineVersion: string;
  clinicalRationale: string;
  intervalDays: number;
  lastEvaluatedDate: string;
  lastLabDate: string | null;
  daysSince: number;
  isOverdue: boolean;
  overdueDays: number;
  priority: 'urgent' | 'routine' | 'none';
  status: 'gap_identified' | 'current';
  isClinicalTreatmentDecision: false;
  requiresPhysicianReview: boolean;
  actionPrompt: string;
}

export interface FhirPersistenceMeta {
  mode: 'in_memory_stub' | 'medplum_live';
  livePersisted: boolean;
  endpoint?: string;
  persistedAt: string;
  note?: string;
}
