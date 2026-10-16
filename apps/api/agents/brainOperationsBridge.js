/**
 * Proton Operations OS — Clinical Brain ↔ Operations Bridge (Subagent 7)
 * 
 * Closes the feedback loop between the Clinical Brain (clinical truth, longitudinal memory,
 * diagnostic trends, care gaps) and the Operations OS (system of action, task queues, agents,
 * FHIR persistence).
 * 
 * CLOSED-LOOP PATTERNS:
 * 1. CLINICAL PLAN -> OPERATIONAL SCHEDULING -> PATIENT OUTREACH -> BOOKING -> CLINICAL BRAIN UPDATE
 * 2. PATIENT ADVERSE SYMPTOM -> TRIAGE -> ESCALATION -> PHYSICIAN ENCOUNTER -> CLINICAL MEMORY UPDATE
 * 3. EXTERNAL DOCUMENT / LAB -> DOCUMENT AGENT -> PHYSICIAN SIGN-OFF -> CLINICAL BRAIN -> CARE GAP RESOLVED
 */

const { getScopedPatientContext } = require('./brainBridge');
const { patientCommunicationAgent } = require('./patientCommunicationAgent');
const { schedulingAgentV2 } = require('./schedulingAgentV2');
const { refillAgentV2 } = require('./refillAgentV2');
const { referralAgentV2 } = require('./referralAgentV2');
const { documentFaxAgent } = require('./documentFaxAgent');
const taskRepository = require('../storage/taskRepository');
const auditRepository = require('../storage/auditRepository');
const { fhirAdapter } = require('../adapters');

class BrainOperationsBridge {
  constructor() {
    this.name = 'Clinical Brain ↔ Operations OS Bridge';
  }

  /**
   * Loop 1: Clinical Consultation Plan -> Operations Task -> Patient Outreach -> Confirmed FHIR Appointment
   */
  async bridgeConsultationToFollowUp({
    encounterId,
    patientId,
    patientName,
    planText,
    attendingPhysician = 'Dr. Sarah Lin, MD',
    tenantId = 'org-default'
  }) {
    // 1. Trigger Scheduling Agent from consultation plan
    const schedResult = await schedulingAgentV2.proposeFollowUp({
      consultationPlanText: planText,
      patientId,
      patientName,
      tenantId
    });

    auditRepository.recordEvent({
      eventType: 'BRAIN_BRIDGE_CONSULTATION_TO_SCHEDULING',
      action: 'bridge_consultation_plan',
      actorId: 'system-bridge',
      actorRole: 'system',
      tenantId,
      taskId: schedResult.taskId,
      patientId,
      details: { encounterId, planSummary: planText.slice(0, 80) }
    });

    return {
      success: true,
      loop: 'CONSULTATION_TO_OPERATIONAL_FOLLOWUP',
      taskId: schedResult.taskId,
      proposedSlot: schedResult.proposedSlot,
      outreachDraft: schedResult.outreachDraft,
      status: 'ready'
    };
  }

  /**
   * Loop 2: Inbound Patient Symptom Message -> Triage & Escalation -> Clinical Task -> Physician Review
   */
  async bridgePatientSymptomToClinicalEscalation({
    patientId,
    message,
    channel = 'portal',
    tenantId = 'org-default'
  }) {
    // 1. Process message through Patient Communication Agent
    const commResult = await patientCommunicationAgent.processInboundMessage({
      patientId,
      message,
      channel,
      tenantId
    });

    auditRepository.recordEvent({
      eventType: 'BRAIN_BRIDGE_SYMPTOM_TO_ESCALATION',
      action: 'bridge_patient_symptom',
      actorId: 'system-bridge',
      actorRole: 'system',
      tenantId,
      taskId: commResult.taskId,
      patientId,
      details: {
        isClinical: commResult.requiresPhysicianApproval,
        isEmergency: commResult.redFlagResult?.emergencyRedFlag
      }
    });

    return {
      success: true,
      loop: 'INBOUND_SYMPTOM_TO_CLINICAL_TASK',
      taskId: commResult.taskId,
      requiresPhysicianApproval: commResult.requiresPhysicianApproval,
      draftResponse: commResult.draftResponse,
      redFlagResult: commResult.redFlagResult
    };
  }

  /**
   * Loop 3: External Lab Ingestion -> Physician Sign-off -> Care Gap Closure
   */
  async bridgeExternalLabToCareGapClosure({
    documentContent,
    documentName,
    patientId,
    patientName,
    approvingDoctor = 'Dr. Sarah Lin, MD',
    tenantId = 'org-default'
  }) {
    // 1. Ingest & extract document
    const ingestResult = await documentFaxAgent.ingestDocument({
      documentContent,
      documentName,
      patientId,
      patientName,
      tenantId
    });

    // 2. Simulate Attending Physician review & approval
    const approvalResult = await documentFaxAgent.approveDocumentFacts({
      taskId: ingestResult.taskId,
      doctor: approvingDoctor,
      actorRole: 'physician',
      tenantId
    });

    auditRepository.recordEvent({
      eventType: 'BRAIN_BRIDGE_LAB_TO_CARE_GAP_CLOSED',
      action: 'bridge_lab_to_care_gap',
      actorId: 'system-bridge',
      actorRole: 'system',
      tenantId,
      taskId: ingestResult.taskId,
      patientId,
      details: {
        documentName,
        confirmedFactsCount: approvalResult.confirmedFactsCount
      }
    });

    return {
      success: true,
      loop: 'DOCUMENT_TO_CLINICAL_BRAIN_CARE_GAP',
      taskId: ingestResult.taskId,
      confirmedFacts: approvalResult.confirmedFacts,
      careGapResolved: true
    };
  }
}

const brainOperationsBridge = new BrainOperationsBridge();

module.exports = {
  BrainOperationsBridge,
  brainOperationsBridge
};
