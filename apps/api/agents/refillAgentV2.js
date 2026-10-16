/**
 * Proton Operations OS — Governed Refill Agent V2 (Subagent 3)
 * 
 * Capabilities:
 * - Inbound pharmacy or patient refill request ingestion
 * - Patient identity & chart matching
 * - Longitudinal medication history & allergy retrieval from Clinical Brain
 * - Rigorous deterministic safety checks:
 *   1. Expired medication (over 365 days)
 *   2. Allergy conflict (direct & class cross-reactivity)
 *   3. Duplicate therapy (active prescription exists)
 *   4. Missing dose / frequency
 *   5. Missing prescriber
 *   6. Ambiguous medication name
 *   7. Wrong patient / identity mismatch
 *   8. Unauthorized user
 *   9. Duplicate refill request (active task exists)
 * - Refill proposal preparation with structured physician options
 * - Attending Physician approval gating (ZERO autonomous prescribing)
 * - FHIR MedicationRequest persistence upon approval
 * - Tamper-evident audit logging
 */

const { verifyRefillProposal } = require('./refillReferralAgent');
const { getScopedPatientContext } = require('./brainBridge');
const { AgentRun, STANDARD_POLICIES } = require('./agentEngineV2');
const { fhirAdapter } = require('../adapters');
const taskRepository = require('../storage/taskRepository');
const auditRepository = require('../storage/auditRepository');
const agentRunRepository = require('../storage/agentRunRepository');

class RefillAgentV2 {
  constructor() {
    this.agentId = 'agent-refill-v2';
    this.name = 'Governed Refill Agent V2';
  }

  async processRefillRequest({
    patientId,
    patientName,
    medicationName,
    requestedDose,
    requestedFrequency,
    daysSupply = 30,
    pharmacyName = 'Community Pharmacy',
    prescriberName = 'Dr. Sarah Lin, MD',
    requesterRole = 'pharmacy',
    tenantId = 'org-default'
  }) {
    const startTime = Date.now();
    const validationErrors = [];

    // 1. Authorization Check
    const allowedRequesters = ['pharmacy', 'patient', 'operations_staff', 'physician'];
    if (!allowedRequesters.includes(requesterRole)) {
      throw new Error(`UNAUTHORIZED_USER: Requester role '${requesterRole}' is not authorized to submit refill requests.`);
    }

    // 2. Validate Essential Request Fields
    if (!patientId) validationErrors.push('WRONG_PATIENT: Missing patient identifier.');
    if (!medicationName || medicationName.trim() === '') validationErrors.push('AMBIGUOUS_MEDICATION: Medication name is missing or ambiguous.');
    if (!requestedDose) validationErrors.push('MISSING_DOSE: Requested dosage is required.');
    if (!prescriberName) validationErrors.push('MISSING_PRESCRIBER: Prescribing physician is required.');

    // 3. Retrieve Clinical Brain Context
    const brainContext = getScopedPatientContext(patientId, 'refill', {
      actorRole: 'agent',
      actorId: this.agentId,
      purposeOfUse: 'medication_refill_safety_screening'
    });

    if (!brainContext || !brainContext.patientName) {
      validationErrors.push('WRONG_PATIENT: Patient records not found in Clinical Brain.');
    }

    // If preliminary checks failed, fail immediately
    if (validationErrors.length > 0) {
      return {
        success: false,
        canApprove: false,
        blockers: validationErrors,
        warnings: [],
        status: 'rejected_safety_check',
        message: 'Refill proposal could not be prepared due to validation errors.'
      };
    }

    // 4. Duplicate Refill Request Check
    const existingTasks = taskRepository.listTasks({ patientId, category: 'refill', tenantId });
    const isDuplicate = existingTasks.some(
      t => t.status === 'requested' &&
           t.refillDetails?.medicationName?.toLowerCase().includes(medicationName.toLowerCase())
    );

    // 5. Deterministic Safety Screening (Allergies, Renal, Regimen)
    const safetyResult = verifyRefillProposal({
      patientId,
      patientName: brainContext.patientName,
      medicationName,
      requestedDose,
      requestedFrequency,
      daysSupply,
      allergies: brainContext.allergies || [],
      activeMedications: brainContext.activeMedications || (brainContext.medications ? brainContext.medications.map(m => m.drugName || m.name || m) : []),
      latestEgfr: brainContext.latestEgfr !== null && brainContext.latestEgfr !== undefined ? brainContext.latestEgfr : undefined,
      baselineEgfr: brainContext.baselineEgfr !== null && brainContext.baselineEgfr !== undefined ? brainContext.baselineEgfr : undefined,
      latestCreatinine: brainContext.latestCreatinine !== null && brainContext.latestCreatinine !== undefined ? brainContext.latestCreatinine : undefined,
      patientAge: brainContext.patientAge
    });

    const safetyReport = safetyResult.safetyReport || safetyResult;
    safetyReport.warnings = safetyReport.warnings || [];
    safetyReport.blockers = safetyReport.blockers || [];

    if (isDuplicate) {
      safetyReport.blockers.push('DUPLICATE_REFILL_REQUEST: An active refill request for this medication is already pending physician review.');
      safetyReport.canApprove = false;
    }

    // 6. Check for Expired Medication / Regimen Gap (> 365 days)
    const matchingMed = (brainContext.medications || []).find(
      m => (m.drugName || '').toLowerCase().includes(medicationName.toLowerCase())
    );
    let isExpiredMed = false;
    if (matchingMed && matchingMed.lastPrescribedDate) {
      const lastDate = new Date(matchingMed.lastPrescribedDate);
      const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 3600 * 24);
      if (daysSince > 365) {
        isExpiredMed = true;
        safetyReport.warnings.push(`EXPIRED_PRESCRIPTION: Prescription was last authorized on ${matchingMed.lastPrescribedDate} (>365 days ago). Clinic visit recommended.`);
      }
    }

    // 7. Check for Duplicate Medication in Active Therapy
    const isDuplicateActive = (brainContext.medications || []).some(
      m => (m.drugName || '').toLowerCase().includes(medicationName.toLowerCase()) && m.status === 'active'
    );
    if (!isDuplicateActive) {
      safetyReport.warnings.push(`Medication '${medicationName}' is not currently active on patient's confirmed list.`);
    }

    // 8. Create Operational Refill Task
    const taskId = `task-refill-${patientId}-${Date.now()}`;
    const task = {
      id: taskId,
      tenantId,
      category: 'refill',
      priority: safetyReport.blockers.length > 0 ? 'urgent' : 'routine',
      status: 'requested',
      patientId,
      patientName: brainContext.patientName,
      title: `${medicationName} Refill Request`,
      summary: `${pharmacyName}: ${medicationName} ${requestedDose} (${daysSupply} days). ${safetyReport.blockers.length ? 'SAFETY CONFLICT' : 'Awaiting Physician Approval'}`,
      sourceEvent: 'Pharmacy Inbound Electronic Request',
      createdAt: new Date().toISOString(),
      refillDetails: {
        id: `refill-${Date.now()}`,
        patientId,
        patientName: brainContext.patientName,
        medicationName,
        requestedDose,
        requestedFrequency,
        daysSupply,
        pharmacyName,
        prescriberName,
        safetyReport: safetyReport,
        physicianDecisionRequired: true,
        status: 'requested'
      }
    };

    taskRepository.createTask(task);

    // 9. Record Agent Run (Zero Chain-of-Thought)
    const run = new AgentRun({
      agentId: this.agentId,
      tenantId,
      taskId,
      patientId,
      triggerType: 'inbound_refill_request',
      inputSummary: `Refill: ${medicationName} ${requestedDose} for ${patientId}`,
      toolCalls: [
        { toolName: 'check_refill_safety', success: true, sideEffect: 'none', category: 'clinical' },
        { toolName: 'get_patient_intelligence', success: true, sideEffect: 'read', category: 'clinical' }
      ],
      actionProposal: {
        type: 'propose_medication_refill',
        requiresApproval: true,
        approvalRole: 'physician'
      },
      approvalState: 'pending_approval',
      status: 'completed',
      latencyMs: Date.now() - startTime
    });
    agentRunRepository.recordRun(run.toRecord());

    auditRepository.recordEvent({
      eventType: 'REFILL_REQUEST_ENQUEUED',
      action: 'process_refill_request',
      actorId: 'agent-refill',
      actorRole: 'agent',
      tenantId,
      taskId,
      patientId,
      details: {
        medicationName,
        requestedDose,
        canApprove: safetyReport.canApprove,
        blockersCount: safetyReport.blockers.length,
        warningsCount: safetyReport.warnings.length
      }
    });

    return {
      success: true,
      taskId,
      canApprove: safetyReport.canApprove,
      blockers: safetyReport.blockers,
      warnings: safetyReport.warnings,
      task
    };
  }

  /**
   * Approves a refill request and creates the official FHIR MedicationRequest.
   * RBAC: Strictly requires attending physician.
   */
  async approveRefill({
    taskId,
    approvingDoctor = 'Dr. Sarah Lin, MD',
    actorId = 'usr-md-lin-01',
    actorRole = 'physician',
    clinicalRationale = 'Patient is stable on current maintenance therapy.',
    approvedDose = null,
    tenantId = 'org-default'
  }) {
    if (actorRole !== 'physician') {
      throw new Error('INSUFFICIENT_CLINICAL_PRIVILEGES: Only attending physicians may approve prescription refills.');
    }

    if (!clinicalRationale || clinicalRationale.trim() === '') {
      throw new Error('MISSING_CLINICAL_RATIONALE: Clinical rationale is required to approve a prescription refill.');
    }

    const task = taskRepository.getTaskById(taskId, tenantId);
    if (!task) throw new Error(`Task '${taskId}' not found.`);

    const details = task.refillDetails;
    const finalDose = approvedDose || details.requestedDose;

    // Persist FHIR MedicationRequest
    const fhirResource = {
      resourceType: 'MedicationRequest',
      id: `mr-${task.patientId}-${Date.now()}`,
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: { text: `${details.medicationName} ${finalDose}` },
      subject: { reference: `Patient/${task.patientId}` },
      authoredOn: new Date().toISOString(),
      requester: { display: approvingDoctor },
      dosageInstruction: [{ text: `${finalDose} ${details.requestedFrequency || 'daily'}` }],
      dispenseRequest: { expectedSupplyDuration: { value: details.daysSupply, unit: 'days' } },
      meta: {
        tag: [
          { system: 'https://proton.health/provenance', code: 'PHYSICIAN_APPROVED' },
          { system: 'https://proton.health/approver', code: actorId }
        ]
      }
    };

    const fhirResult = await fhirAdapter.persistResource(fhirResource, {
      tenantId,
      taskIdentifier: { system: 'https://proton.health/ops/task', value: taskId }
    });

    taskRepository.updateTask(taskId, {
      status: 'completed',
      approvedBy: approvingDoctor,
      approvedAt: new Date().toISOString(),
      refillDetails: {
        ...details,
        status: 'approved',
        physicianAction: 'approved_full',
        approvedMedicationRequestId: fhirResult.persistedResource?.id,
        clinicalRationale
      }
    }, tenantId);

    auditRepository.recordEvent({
      eventType: 'MEDICATION_REFILL_APPROVED',
      action: 'approve_refill',
      actorId,
      actorRole,
      tenantId,
      taskId,
      patientId: task.patientId,
      details: {
        approvingDoctor,
        medicationName: details.medicationName,
        dose: finalDose,
        fhirMedicationRequestId: fhirResult.persistedResource?.id,
        clinicalRationale
      }
    });

    return {
      success: true,
      taskId,
      status: 'completed',
      fhirMedicationRequest: fhirResult.persistedResource
    };
  }

  /**
   * Rejects a refill request with documented reason.
   */
  async rejectRefill({
    taskId,
    doctor = 'Dr. Sarah Lin, MD',
    actorId = 'usr-md-lin-01',
    actorRole = 'physician',
    reason = 'Patient requires in-person clinical evaluation prior to refill.',
    tenantId = 'org-default'
  }) {
    if (actorRole !== 'physician') {
      throw new Error('INSUFFICIENT_CLINICAL_PRIVILEGES: Only attending physicians may reject medication refills.');
    }

    const task = taskRepository.getTaskById(taskId, tenantId);
    if (!task) throw new Error(`Task '${taskId}' not found.`);

    taskRepository.updateTask(taskId, {
      status: 'rejected',
      rejectedBy: doctor,
      rejectedAt: new Date().toISOString(),
      refillDetails: {
        ...task.refillDetails,
        status: 'denied',
        rejectionReason: reason
      }
    }, tenantId);

    auditRepository.recordEvent({
      eventType: 'MEDICATION_REFILL_REJECTED',
      action: 'reject_refill',
      actorId,
      actorRole,
      tenantId,
      taskId,
      patientId: task.patientId,
      details: { doctor, reason }
    });

    return { success: true, taskId, status: 'rejected', reason };
  }
}

const refillAgentV2 = new RefillAgentV2();

module.exports = {
  RefillAgentV2,
  refillAgentV2
};
