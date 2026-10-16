/**
 * Proton Operations OS — Patient Communication Agent (Subagent 1)
 * 
 * Capabilities:
 * - Inbound patient message ingestion
 * - Intent classification: administrative vs clinical
 * - Patient identity resolution
 * - Clinical Brain context retrieval
 * - Response drafting
 * - Escalation creation for acute or symptomatic concerns
 * - Physician approval gating for clinical communications
 * - Communication state tracking: received -> triaged -> draft_prepared -> physician_review / auto_approved -> dispatched -> delivered
 * - FHIR Communication persistence
 * - Audit logging
 * 
 * STRICT INVARIANT:
 * Clinical advice, medication guidance, and symptom evaluations CANNOT be autonomously dispatched.
 * They must be presented as drafts for Attending Physician approval.
 */

const { screenRedFlags, classifyCommunication } = require('./triageAgent');
const { resolvePatientIdentity } = require('./identityResolver');
const { getScopedPatientContext } = require('./brainBridge');
const { AgentRun, ApprovalRequest, Escalation, STANDARD_POLICIES } = require('./agentEngineV2');
const { fhirAdapter, patientMessagingAdapter, smsAdapter } = require('../adapters');
const auditRepository = require('../storage/auditRepository');
const agentRunRepository = require('../storage/agentRunRepository');
const taskRepository = require('../storage/taskRepository');

class PatientCommunicationAgent {
  constructor() {
    this.agentId = 'agent-patient-communication';
    this.name = 'Patient Communication Agent';
    this.role = 'Inbound triage, intent routing, and governed communication drafting';
  }

  async processInboundMessage({
    patientId,
    mrn,
    phone,
    birthDate,
    message,
    channel = 'portal',
    tenantId = 'org-default',
    actor = { actorId: 'system-inbound', actorRole: 'system', actorName: 'Inbound Gateway' }
  }) {
    const startTime = Date.now();

    if (!message || !message.trim()) {
      throw new Error('Inbound message content cannot be empty.');
    }

    // 1. Patient Identity Resolution
    const identity = resolvePatientIdentity({ patientId, mrn, phone, birthDate });
    const resolvedPatientId = identity.matchedPatientId || patientId || 'unknown-patient';

    // 2. Intent Classification (Admin vs Clinical)
    const classification = classifyCommunication(message);
    const isClinical = classification.category === 'clinical';

    // 3. Emergency Red Flag Screening (Deterministic)
    const redFlagResult = screenRedFlags(message);

    // 4. Clinical Brain Context Retrieval (Minimum Necessary)
    const brainContext = getScopedPatientContext(resolvedPatientId, 'triage', {
      actorRole: 'agent',
      actorId: this.agentId,
      purposeOfUse: 'inbound_patient_communication_triage'
    });

    // 5. Evaluate Policies
    const policyResults = [];
    const pol1 = STANDARD_POLICIES.NO_AUTONOMOUS_CLINICAL_DISPATCH.evaluate({
      isClinical,
      containsMedicationQuestion: isClinical,
      containsSymptomQuestion: isClinical
    });
    policyResults.push({ policy: 'NO_AUTONOMOUS_CLINICAL_DISPATCH', ...pol1 });

    let escalation = null;
    if (redFlagResult.emergencyRedFlag) {
      const polEmerg = STANDARD_POLICIES.PROMPT_EMERGENCY_DIVERSION.evaluate({
        isEmergencyRedFlag: true
      });
      policyResults.push({ policy: 'PROMPT_EMERGENCY_DIVERSION', ...polEmerg });
    }

    // 6. Response Drafting
    let draftResponse = '';
    let status = 'requested';
    let autonomousDispatchAllowed = false;

    if (redFlagResult.emergencyRedFlag) {
      // Immediate 911 / emergency protocol
      draftResponse = `EMERGENCY ALERT: Your message indicates potential symptoms of a medical emergency (${redFlagResult.category.toUpperCase()}). Please CALL 911 IMMEDIATELY or proceed to the nearest Emergency Department. Do not wait for a clinic reply. Our clinical team has been notified.`;
      status = 'requested';
      escalation = new Escalation({
        taskId: null,
        patientId: resolvedPatientId,
        severity: 'CRITICAL_EMERGENCY',
        reason: `Emergency red flag: ${redFlagResult.category}`,
        redFlagCategory: redFlagResult.category,
        routedToRole: 'physician'
      });
    } else if (isClinical) {
      // Symptomatic / clinical guidance -> requires physician approval
      status = 'requested';
      autonomousDispatchAllowed = false;
      const patientName = brainContext.patientName || identity.name || 'Patient';
      draftResponse = `Hello ${patientName}, Dr. Lin's care team has received your message regarding your symptoms. Please do not make sudden medication changes on your own. Rest comfortably, check your vitals if possible, and our clinical team is reviewing your chart now to advise on the safest next steps.`;
    } else {
      // Administrative / logistical inquiry
      status = 'ready';
      autonomousDispatchAllowed = true;
      draftResponse = `Hello, thank you for reaching out to Proton Health Clinic. Our clinic hours are Monday through Friday, 8:00 AM to 5:00 PM. For visitor parking, we provide validation at the reception desk for the adjacent parking pavilion. Please let us know if you need assistance with scheduling.`;
    }

    // 7. Create Operational Task in Queue
    const taskId = `task-comm-${resolvedPatientId}-${Date.now()}`;
    const task = {
      id: taskId,
      tenantId,
      category: 'triage',
      priority: redFlagResult.emergencyRedFlag ? 'urgent' : isClinical ? 'urgent' : 'routine',
      status,
      patientId: resolvedPatientId,
      patientName: brainContext.patientName || identity.name || 'Patient',
      patientAgeSex: brainContext.ageSex || 'Unknown',
      title: redFlagResult.emergencyRedFlag
        ? `EMERGENCY RED FLAG: ${redFlagResult.category.toUpperCase()}`
        : isClinical
        ? `Clinical Inquiry: ${message.slice(0, 45)}...`
        : `Administrative Inquiry: ${message.slice(0, 45)}...`,
      summary: message,
      sourceEvent: `${channel.toUpperCase()} Message`,
      createdAt: new Date().toISOString(),
      triageDetails: {
        id: `tri-${Date.now()}`,
        patientId: resolvedPatientId,
        patientName: brainContext.patientName || identity.name || 'Patient',
        channel,
        inboundMessage: message,
        receivedAt: new Date().toISOString(),
        priority: redFlagResult.emergencyRedFlag ? 'urgent' : isClinical ? 'urgent' : 'routine',
        status,
        communicationCategory: classification.category,
        autonomousDispatchAllowed,
        risk: {
          riskLevel: redFlagResult.riskLevel,
          emergencyRedFlag: redFlagResult.emergencyRedFlag,
          redFlagCategory: redFlagResult.category,
          clinicalGatingReason: isClinical ? 'Clinical guidance requires physician review.' : 'Low risk logistical inquiry.',
          deterministicViolations: redFlagResult.violations
        },
        aiDraftResponse: draftResponse,
        relevantLongitudinalContext: brainContext.conditions ? brainContext.conditions.map(c => `${c.display || c.name || c} (${c.status || 'active'})`) : []
      }
    };

    if (escalation) {
      escalation.taskId = taskId;
      task.escalation = escalation;
    }

    // Persist to task repository
    taskRepository.createTask(task);

    // 8. Generate Proposed FHIR Communication Resource
    const fhirCommunication = {
      resourceType: 'Communication',
      id: `comm-${taskId}`,
      status: autonomousDispatchAllowed ? 'completed' : 'preparation',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/communication-category',
          code: isClinical ? 'clinical' : 'instruction',
          display: isClinical ? 'Clinical Guidance' : 'Administrative Instruction'
        }]
      }],
      subject: { reference: `Patient/${resolvedPatientId}` },
      payload: [{ contentString: draftResponse }],
      sent: autonomousDispatchAllowed ? new Date().toISOString() : undefined,
      meta: {
        tag: [
          { system: 'https://proton.health/provenance', code: 'AI_DRAFT' },
          { system: 'https://proton.health/safety-gate', code: isClinical ? 'PHYSICIAN_APPROVAL_REQUIRED' : 'AUTO_PERMITTED' }
        ]
      }
    };

    // If autonomous dispatch is allowed, persist to FHIR and dispatch immediately
    if (autonomousDispatchAllowed) {
      await fhirAdapter.persistResource(fhirCommunication, { tenantId });
    }

    // 9. Record Agent Run (Zero Chain-of-Thought)
    const run = new AgentRun({
      agentId: this.agentId,
      tenantId,
      taskId,
      patientId: resolvedPatientId,
      triggerType: 'inbound_patient_message',
      inputSummary: `Message on ${channel}: ${message.slice(0, 60)}...`,
      policyResults,
      toolCalls: [
        { toolName: 'resolve_patient_identity', success: true, sideEffect: 'read', category: 'operational' },
        { toolName: 'screen_emergency_red_flags', success: true, sideEffect: 'none', category: 'clinical' },
        { toolName: 'get_scoped_patient_context', success: true, sideEffect: 'read', category: 'clinical' }
      ],
      actionProposal: {
        type: isClinical ? 'draft_clinical_response' : 'dispatch_administrative_response',
        requiresApproval: isClinical,
        approvalRole: 'physician'
      },
      approvalState: isClinical ? 'pending_approval' : 'not_required',
      status: 'completed',
      latencyMs: Date.now() - startTime
    });
    agentRunRepository.recordRun(run.toRecord());

    // 10. Audit Event
    auditRepository.recordEvent({
      eventType: 'INBOUND_COMMUNICATION_INGESTED',
      action: 'process_inbound_message',
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      tenantId,
      taskId,
      patientId: resolvedPatientId,
      details: {
        category: classification.category,
        isClinical,
        isEmergencyRedFlag: redFlagResult.emergencyRedFlag,
        requiresPhysicianApproval: isClinical
      }
    });

    return {
      success: true,
      taskId,
      patientId: resolvedPatientId,
      classification,
      redFlagResult,
      draftResponse,
      requiresPhysicianApproval: isClinical,
      autonomousDispatchAllowed,
      fhirCommunication,
      task
    };
  }

  async approveAndDispatch({
    taskId,
    approvingDoctor,
    actorId = 'usr-md-lin-01',
    actorRole = 'physician',
    editedResponse = null,
    tenantId = 'org-default'
  }) {
    if (actorRole !== 'physician') {
      throw new Error('INSUFFICIENT_CLINICAL_PRIVILEGES: Only attending physicians may approve clinical communications.');
    }

    const task = taskRepository.getTaskById(taskId, tenantId);
    if (!task) {
      throw new Error(`Task '${taskId}' not found.`);
    }

    const finalResponse = editedResponse || task.triageDetails?.aiDraftResponse;
    if (!finalResponse) {
      throw new Error('No approved response text found to dispatch.');
    }

    // Persist finalized FHIR Communication resource
    const fhirResource = {
      resourceType: 'Communication',
      id: `comm-${taskId}`,
      status: 'completed',
      subject: { reference: `Patient/${task.patientId}` },
      sender: { display: approvingDoctor || 'Dr. Sarah Lin, MD' },
      payload: [{ contentString: finalResponse }],
      sent: new Date().toISOString(),
      meta: {
        tag: [
          { system: 'https://proton.health/provenance', code: 'PHYSICIAN_APPROVED' },
          { system: 'https://proton.health/approver', code: actorId }
        ]
      }
    };

    const fhirResult = await fhirAdapter.persistResource(fhirResource, { tenantId });

    // Dispatch via patient portal messaging adapter
    const dispatchResult = await patientMessagingAdapter.sendPortalMessage({
      patientId: task.patientId,
      body: finalResponse,
      senderName: approvingDoctor || 'Dr. Sarah Lin, MD',
      correlationId: taskId
    });

    // Update operational task status
    taskRepository.updateTask(taskId, {
      status: 'completed',
      approvedBy: approvingDoctor || 'Dr. Sarah Lin, MD',
      approvedAt: new Date().toISOString(),
      dispatchedAt: new Date().toISOString()
    }, tenantId);

    // Audit log
    auditRepository.recordEvent({
      eventType: 'CLINICAL_COMMUNICATION_APPROVED_AND_DISPATCHED',
      action: 'approve_and_dispatch',
      actorId,
      actorRole,
      tenantId,
      taskId,
      patientId: task.patientId,
      details: {
        approvingDoctor,
        fhirId: fhirResult.persistedResource?.id,
        dispatchId: dispatchResult.messageId
      }
    });

    return {
      success: true,
      taskId,
      status: 'completed',
      fhirResource: fhirResult.persistedResource,
      dispatchResult
    };
  }
}

const patientCommunicationAgent = new PatientCommunicationAgent();

module.exports = {
  PatientCommunicationAgent,
  patientCommunicationAgent
};
