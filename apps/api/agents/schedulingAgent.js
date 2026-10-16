/**
 * Proton Scheduler — Scheduling, Follow-Up & Care Gap Agent
 * 
 * Bridges clinical consultation discharge plans to calendar slots,
 * identifies overdue preventive care gaps, and prepares draft booking proposals.
 */

const { evaluateCareGapsForPatient } = require('./careGapRules');

function evaluateFollowUpPlan({ consultationPlanText, patientId, patientAcuity, patientName = 'Patient' }) {
  const plan = consultationPlanText || '';
  let targetTimeframe = '3 months';
  let targetMonths = 3;
  let requiredLabs = [];

  if (/follow[\s-]*up\s*in\s*(\d+)\s*month/i.test(plan)) {
    const match = plan.match(/follow[\s-]*up\s*in\s*(\d+)\s*month/i);
    targetMonths = parseInt(match[1], 10);
    targetTimeframe = `${targetMonths} months`;
  } else if (/follow[\s-]*up\s*in\s*(\d+)\s*week/i.test(plan)) {
    const match = plan.match(/follow[\s-]*up\s*in\s*(\d+)\s*week/i);
    const weeks = parseInt(match[1], 10);
    targetTimeframe = `${weeks} weeks`;
    targetMonths = Math.max(1, Math.round(weeks / 4));
  }

  if (/hba1c|a1c/i.test(plan)) requiredLabs.push('Repeat HbA1c');
  if (/lipid|cholesterol/i.test(plan)) requiredLabs.push('Lipid Panel');
  if (/creatinine|egfr|renal|bmp|cmp|metabolic/i.test(plan)) requiredLabs.push('Basic Metabolic / Renal Panel');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + (targetMonths * 30));
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 14);

  const slotStart = startDate.toISOString().split('T')[0] + 'T09:30:00Z';
  const slotEnd = startDate.toISOString().split('T')[0] + 'T10:00:00Z';

  const proposedSlot = {
    slotId: `slot-${patientId}-${Date.now()}`,
    start: slotStart,
    end: slotEnd,
    practitionerName: 'Dr. Sarah Lin, MD',
    location: 'Suite 400 - Internal Medicine'
  };

  const outreachDraft = `Hello ${patientName}, following your consultation with Dr. Lin, we would like to schedule your follow-up visit in ${targetTimeframe}${requiredLabs.length ? ` along with recommended lab work (${requiredLabs.join(', ')})` : ''}. We have reserved an opening on ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at 9:30 AM with Dr. Lin. Please reply to confirm this time.`;

  // HL7 FHIR R4 Appointment Representation (Draft / Proposed)
  const fhirAppointment = {
    resourceType: 'Appointment',
    id: `app-prop-${patientId}-${Date.now()}`,
    status: 'proposed',
    description: `Follow-up consultation in ${targetTimeframe}: ${plan.slice(0, 80)}`,
    start: slotStart,
    end: slotEnd,
    created: new Date().toISOString(),
    participant: [
      {
        actor: { reference: `Patient/${patientId}`, display: patientName },
        status: 'needs-action'
      },
      {
        actor: { display: 'Dr. Sarah Lin, MD' },
        status: 'accepted'
      }
    ],
    meta: {
      tag: [
        { system: 'https://proton.health/provenance', code: 'AI_DRAFT' },
        { system: 'https://proton.health/safety-gate', code: 'CONFIRMATION_REQUIRED' }
      ]
    }
  };

  return {
    triggerType: 'consultation_follow_up',
    patientId,
    targetTimeframe,
    targetDateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    priority: patientAcuity === 'HIGH ACUITY' ? 'urgent' : 'routine',
    requiredLabs,
    proposedSlot,
    fhirAppointment,
    outreachDraft,
    status: 'ready'
  };
}

module.exports = {
  evaluateFollowUpPlan,
  evaluateCareGapsForPatient
};
