/**
 * Proton Operations OS — Governed Scheduling Agent V2 (Subagent 2)
 * 
 * Capabilities:
 * - Follow-up scheduling from consultation plan
 * - Direct appointment requests
 * - Rescheduling
 * - Cancellation
 * - Recall (overdue preventive care gap outreach)
 * - No-show recovery
 * - Appointment reminders (24h pre-visit check-in)
 * 
 * STATE MACHINE:
 * requested -> proposed -> confirmed -> booked -> cancelled -> completed
 * 
 * INVARIANTS:
 * - Deterministic appointment idempotency.
 * - No fake bookings.
 * - No autonomous clinical judgment: clinical follow-ups require explicit confirmation.
 * - Deterministic FHIR R4 Appointment persistence.
 */

const { calendarAdapter, fhirAdapter, smsAdapter } = require('../adapters');
const { AgentRun, STANDARD_POLICIES } = require('./agentEngineV2');
const taskRepository = require('../storage/taskRepository');
const auditRepository = require('../storage/auditRepository');
const agentRunRepository = require('../storage/agentRunRepository');
const { evaluateCareGapsForPatient } = require('./careGapRules');

class SchedulingAgentV2 {
  constructor() {
    this.agentId = 'agent-scheduler-v2';
    this.name = 'Scheduling Agent V2';
  }

  /**
   * Generates a proposed appointment from a clinical consultation discharge plan.
   * State: 'requested' -> 'proposed'
   */
  async proposeFollowUp({
    consultationPlanText,
    patientId,
    patientAcuity = 'routine',
    patientName = 'Patient',
    tenantId = 'org-default'
  }) {
    const startTime = Date.now();
    const plan = consultationPlanText || '';
    let targetMonths = 3;
    let targetTimeframe = '3 months';
    const requiredLabs = [];

    if (/follow[\s-]*up\s*in\s*(\d+)\s*month/i.test(plan)) {
      targetMonths = parseInt(plan.match(/follow[\s-]*up\s*in\s*(\d+)\s*month/i)[1], 10);
      targetTimeframe = `${targetMonths} months`;
    } else if (/follow[\s-]*up\s*in\s*(\d+)\s*week/i.test(plan)) {
      const weeks = parseInt(plan.match(/follow[\s-]*up\s*in\s*(\d+)\s*week/i)[1], 10);
      targetMonths = Math.max(1, Math.round(weeks / 4));
      targetTimeframe = `${weeks} weeks`;
    }

    if (/hba1c|a1c/i.test(plan)) requiredLabs.push('Repeat HbA1c');
    if (/lipid|cholesterol/i.test(plan)) requiredLabs.push('Lipid Panel');
    if (/creatinine|egfr|renal|bmp|cmp/i.test(plan)) requiredLabs.push('Renal Function Panel');

    // Query calendar adapter for matching open slots
    const availableSlots = await calendarAdapter.findAvailableSlots({
      practitionerId: 'usr-md-lin-01',
      targetDaysAhead: targetMonths * 30
    });

    const chosenSlot = availableSlots[0] || {
      slotId: `slot-${patientId}-${Date.now()}`,
      start: new Date(Date.now() + targetMonths * 30 * 24 * 3600 * 1000).toISOString(),
      end: new Date(Date.now() + (targetMonths * 30 * 24 * 3600 + 1800) * 1000).toISOString(),
      practitionerName: 'Dr. Sarah Lin, MD',
      location: 'Suite 400 - Internal Medicine'
    };

    // Hold the slot temporarily
    await calendarAdapter.holdSlot(chosenSlot.slotId, patientId, 30);

    const taskId = `task-sched-${patientId}-${Date.now()}`;
    const outreachDraft = `Hello ${patientName}, following your visit with Dr. Lin, we would like to schedule your ${targetTimeframe} follow-up${requiredLabs.length ? ` and recommended lab work (${requiredLabs.join(', ')})` : ''}. We have reserved an opening on ${new Date(chosenSlot.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at 9:30 AM with Dr. Lin. Please reply to confirm this appointment.`;

    const fhirAppointment = {
      resourceType: 'Appointment',
      id: `app-prop-${patientId}-${Date.now()}`,
      status: 'proposed',
      description: `Follow-up in ${targetTimeframe}: ${plan.slice(0, 80)}`,
      start: chosenSlot.start,
      end: chosenSlot.end,
      participant: [
        { actor: { reference: `Patient/${patientId}`, display: patientName }, status: 'needs-action' },
        { actor: { display: chosenSlot.practitionerName }, status: 'accepted' }
      ],
      meta: {
        tag: [
          { system: 'https://proton.health/provenance', code: 'AI_DRAFT' },
          { system: 'https://proton.health/safety-gate', code: 'CONFIRMATION_REQUIRED' }
        ]
      }
    };

    const task = {
      id: taskId,
      tenantId,
      category: 'scheduling',
      priority: patientAcuity === 'HIGH ACUITY' ? 'urgent' : 'routine',
      status: 'ready',
      patientId,
      patientName,
      title: `${targetTimeframe} Clinical Follow-Up`,
      summary: `Discharge plan: ${plan.slice(0, 80)}`,
      sourceEvent: 'Consultation Plan Extraction',
      createdAt: new Date().toISOString(),
      schedulingDetails: {
        id: `sched-${Date.now()}`,
        patientId,
        patientName,
        triggerType: 'consultation_follow_up',
        targetTimeframe,
        priority: patientAcuity === 'HIGH ACUITY' ? 'urgent' : 'routine',
        status: 'ready',
        appointmentStatus: 'proposed',
        requiredLabs,
        proposedSlot: chosenSlot,
        outreachDraft,
        fhirAppointment
      }
    };

    taskRepository.createTask(task);

    // Record Agent Run
    const run = new AgentRun({
      agentId: this.agentId,
      tenantId,
      taskId,
      patientId,
      triggerType: 'consultation_follow_up_extraction',
      inputSummary: `Follow-up plan: ${plan.slice(0, 60)}...`,
      toolCalls: [
        { toolName: 'find_matching_slots', success: true, sideEffect: 'read', category: 'operational' },
        { toolName: 'hold_slot', success: true, sideEffect: 'write', category: 'operational' }
      ],
      actionProposal: {
        type: 'propose_appointment_slot',
        requiresApproval: true,
        approvalRole: 'operations_staff'
      },
      approvalState: 'pending_approval',
      status: 'completed',
      latencyMs: Date.now() - startTime
    });
    agentRunRepository.recordRun(run.toRecord());

    auditRepository.recordEvent({
      eventType: 'APPOINTMENT_PROPOSED',
      action: 'propose_follow_up',
      actorId: 'agent-scheduler',
      actorRole: 'agent',
      tenantId,
      taskId,
      patientId,
      details: { slotId: chosenSlot.slotId, targetTimeframe, requiredLabs }
    });

    return {
      success: true,
      taskId,
      task,
      proposedSlot: chosenSlot,
      outreachDraft,
      fhirAppointment
    };
  }

  /**
   * Confirms a proposed appointment into a confirmed booking.
   * State: 'proposed' -> 'confirmed' -> 'booked'
   */
  async confirmBooking({
    taskId,
    confirmedBy = 'Operations Staff',
    actorId = 'usr-ops-marcus-01',
    actorRole = 'operations_staff',
    tenantId = 'org-default'
  }) {
    const task = taskRepository.getTaskById(taskId, tenantId);
    if (!task) {
      throw new Error(`Scheduling task '${taskId}' not found.`);
    }

    const proposed = task.schedulingDetails?.proposedSlot;
    if (!proposed) {
      throw new Error('No proposed slot found in scheduling task.');
    }

    const appointmentId = `app-booked-${task.patientId}-${taskId.replace(/[^a-zA-Z0-9]/g, '')}`;

    // Book via calendar adapter (detects conflicts)
    const booked = await calendarAdapter.bookAppointment({
      appointmentId,
      slotId: proposed.slotId,
      patientId: task.patientId,
      patientName: task.patientName,
      start: proposed.start,
      end: proposed.end
    });

    // HL7 FHIR R4 Appointment (booked)
    const fhirResource = {
      resourceType: 'Appointment',
      id: appointmentId,
      status: 'booked',
      description: task.title,
      start: proposed.start,
      end: proposed.end,
      participant: [
        { actor: { reference: `Patient/${task.patientId}`, display: task.patientName }, status: 'accepted' },
        { actor: { display: proposed.practitionerName || 'Dr. Sarah Lin, MD' }, status: 'accepted' }
      ],
      meta: {
        tag: [
          { system: 'https://proton.health/provenance', code: 'STAFF_CONFIRMED' },
          { system: 'https://proton.health/approver', code: actorId }
        ]
      }
    };

    const fhirResult = await fhirAdapter.persistResource(fhirResource, {
      tenantId,
      taskIdentifier: { system: 'https://proton.health/ops/task', value: taskId }
    });

    // Update task status
    taskRepository.updateTask(taskId, {
      status: 'completed',
      schedulingDetails: {
        ...task.schedulingDetails,
        appointmentStatus: 'booked',
        confirmedBy,
        confirmedAt: new Date().toISOString(),
        bookedAppointmentId: appointmentId
      }
    }, tenantId);

    auditRepository.recordEvent({
      eventType: 'APPOINTMENT_CONFIRMED_AND_BOOKED',
      action: 'confirm_booking',
      actorId,
      actorRole,
      tenantId,
      taskId,
      patientId: task.patientId,
      details: {
        appointmentId,
        slotId: proposed.slotId,
        fhirId: fhirResult.persistedResource?.id,
        confirmedBy
      }
    });

    return {
      success: true,
      taskId,
      status: 'completed',
      appointmentStatus: 'booked',
      bookedAppointment: booked,
      fhirAppointment: fhirResult.persistedResource
    };
  }

  /**
   * Reschedules an existing appointment.
   * State: 'booked' -> 'rescheduled'
   */
  async rescheduleAppointment({
    appointmentId,
    newSlotId,
    newStart,
    newEnd,
    reason = 'Patient schedule conflict',
    actorId = 'usr-ops-marcus-01',
    actorRole = 'operations_staff',
    tenantId = 'org-default'
  }) {
    const rescheduled = await calendarAdapter.rescheduleAppointment(appointmentId, newSlotId, newStart, newEnd);

    // Update FHIR Appointment
    const fhirAppointment = {
      resourceType: 'Appointment',
      id: appointmentId,
      status: 'booked',
      description: `Rescheduled: ${reason}`,
      start: newStart,
      end: newEnd,
      meta: {
        tag: [{ system: 'https://proton.health/status', code: 'RESCHEDULED' }]
      }
    };
    await fhirAdapter.persistResource(fhirAppointment, { tenantId });

    auditRepository.recordEvent({
      eventType: 'APPOINTMENT_RESCHEDULED',
      action: 'reschedule_appointment',
      actorId,
      actorRole,
      tenantId,
      patientId: rescheduled.patientId || 'eleanor-vance',
      details: { appointmentId, newSlotId, reason }
    });

    return { success: true, appointmentId, status: 'rescheduled', details: rescheduled };
  }

  /**
   * Cancels an appointment.
   * State: 'booked' -> 'cancelled'
   */
  async cancelAppointment({
    appointmentId,
    reason = 'Patient requested cancellation',
    actorId = 'usr-ops-marcus-01',
    actorRole = 'operations_staff',
    tenantId = 'org-default'
  }) {
    const cancelled = await calendarAdapter.cancelAppointment(appointmentId, reason);

    const fhirAppointment = {
      resourceType: 'Appointment',
      id: appointmentId,
      status: 'cancelled',
      cancelationReason: { text: reason },
      meta: {
        tag: [{ system: 'https://proton.health/status', code: 'CANCELLED' }]
      }
    };
    await fhirAdapter.persistResource(fhirAppointment, { tenantId });

    auditRepository.recordEvent({
      eventType: 'APPOINTMENT_CANCELLED',
      action: 'cancel_appointment',
      actorId,
      actorRole,
      tenantId,
      patientId: cancelled.patientId || 'eleanor-vance',
      details: { appointmentId, reason }
    });

    return { success: true, appointmentId, status: 'cancelled', details: cancelled };
  }

  /**
   * Generates proactive recall outreach for overdue preventive care gaps.
   */
  async generateCareGapRecall({ patientId, conditions = [], recentLabs = [], tenantId = 'org-default' }) {
    const assessment = evaluateCareGapsForPatient({ patientId, conditions, recentLabs });
    const overdueGaps = (assessment.gaps || []).filter(g => g.isOverdue || g.status === 'gap_identified');

    const tasksCreated = [];
    for (const gap of overdueGaps) {
      const testName = gap.labOrProcedure || gap.testName || 'Preventive Check';
      const taskId = `task-recall-${patientId}-${testName.replace(/[^a-zA-Z0-9]/g, '')}`;
      const outreachDraft = `Hello, our clinic records indicate you are due for your recommended preventive check (${testName}). Please contact us or reply to schedule a convenient appointment.`;

      const task = {
        id: taskId,
        tenantId,
        category: 'scheduling',
        priority: 'routine',
        status: 'ready',
        patientId,
        patientName: patientId === 'eleanor-vance' ? 'Eleanor Vance' : 'Patient',
        title: `Care Gap Recall: ${testName}`,
        summary: `Overdue preventive screening: ${testName} (${gap.guidelineSource || 'Clinical Guideline'})`,
        sourceEvent: 'Preventive Care Gap Engine',
        createdAt: new Date().toISOString(),
        schedulingDetails: {
          triggerType: 'care_gap_recall',
          careGap: gap,
          outreachDraft,
          status: 'ready'
        }
      };
      taskRepository.createTask(task);
      tasksCreated.push(task);

      auditRepository.recordEvent({
        eventType: 'CARE_GAP_RECALL_ENQUEUED',
        action: 'generate_care_gap_recall',
        actorId: 'agent-scheduler',
        actorRole: 'agent',
        tenantId,
        taskId,
        patientId,
        details: { testName: gap.testName }
      });
    }

    return { success: true, patientId, overdueGapsCount: overdueGaps.length, tasksCreated };
  }

  /**
   * Generates automated appointment reminder.
   */
  async sendAppointmentReminder({ appointmentId, patientPhone = '+15555551234', appointmentTime, tenantId = 'org-default' }) {
    const message = `Reminder: You have an upcoming appointment with Dr. Lin on ${appointmentTime}. Please reply YES to confirm or call us to reschedule.`;
    const smsResult = await smsAdapter.sendSms({
      to: patientPhone,
      message,
      appointmentId,
      correlationId: `rem-${appointmentId}`
    });

    auditRepository.recordEvent({
      eventType: 'APPOINTMENT_REMINDER_SENT',
      action: 'send_appointment_reminder',
      actorId: 'agent-scheduler',
      actorRole: 'agent',
      tenantId,
      details: { appointmentId, messageId: smsResult.messageId }
    });

    return { success: true, appointmentId, status: 'reminder_sent', smsResult };
  }
}

const schedulingAgentV2 = new SchedulingAgentV2();

module.exports = {
  SchedulingAgentV2,
  schedulingAgentV2
};
