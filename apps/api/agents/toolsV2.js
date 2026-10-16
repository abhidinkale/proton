/**
 * Proton Operations OS — Agent Tool Registry V2 & Policy Gate
 * 
 * Implements strict ToolDefinition schema:
 * - toolName
 * - purpose
 * - allowedRoles
 * - allowedAgents
 * - tenantScope
 * - patientScope
 * - sideEffect ('read', 'write', 'none')
 * - category ('clinical', 'operational', 'communication')
 * - approvalRequirement ('none', 'physician', 'operations_staff', 'policy_conditional')
 * - idempotencyStrategy ('payload_hash', 'deterministic_key', 'none')
 * - auditRequirement ('mandatory', 'optional')
 * - parameters
 * - execute
 */

const { screenRedFlags } = require('./triageAgent');
const { verifyRefillProposal } = require('./refillReferralAgent');
const { fhirAdapter, calendarAdapter, smsAdapter, emailAdapter, patientMessagingAdapter, ehrPmsAdapter } = require('../adapters');

class ToolExecutionError extends Error {
  constructor(message, statusCode = 400, code = 'TOOL_EXECUTION_ERROR') {
    super(message);
    this.name = 'ToolExecutionError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

class ToolDefinition {
  constructor({
    toolName,
    purpose,
    allowedRoles = ['physician', 'operations_staff', 'admin'],
    allowedAgents = ['connect', 'scheduler', 'refill', 'referral', 'document', 'system'],
    tenantScope = 'strict',
    patientScope = 'required',
    sideEffect = 'read', // 'read', 'write', 'none'
    category = 'operational', // 'clinical', 'operational', 'communication'
    approvalRequirement = 'none', // 'none', 'physician', 'operations_staff', 'policy_conditional'
    idempotencyStrategy = 'payload_hash', // 'payload_hash', 'deterministic_key', 'none'
    auditRequirement = 'mandatory',
    parameters = {},
    execute
  }) {
    this.toolName = toolName;
    this.purpose = purpose;
    this.allowedRoles = allowedRoles;
    this.allowedAgents = allowedAgents;
    this.tenantScope = tenantScope;
    this.patientScope = patientScope;
    this.sideEffect = sideEffect;
    this.category = category;
    this.approvalRequirement = approvalRequirement;
    this.idempotencyStrategy = idempotencyStrategy;
    this.auditRequirement = auditRequirement;
    this.parameters = parameters;
    this.execute = execute;
  }
}

const REGISTERED_TOOLS_V2 = {
  get_patient_intelligence: new ToolDefinition({
    toolName: 'get_patient_intelligence',
    purpose: 'Retrieve structured longitudinal context (conditions, medications, allergies, labs) from patient chart.',
    allowedRoles: ['physician', 'operations_staff', 'admin', 'INTERNAL_AGENT_ENGINE'],
    allowedAgents: ['connect', 'scheduler', 'refill', 'referral', 'document', 'system'],
    tenantScope: 'strict',
    patientScope: 'required',
    sideEffect: 'read',
    category: 'clinical',
    approvalRequirement: 'none',
    idempotencyStrategy: 'none',
    auditRequirement: 'mandatory',
    parameters: {
      patientId: { type: 'string', required: true }
    },
    execute: async ({ patientId }) => {
      return {
        patientId,
        conditions: patientId === 'eleanor-vance'
          ? ['Essential Hypertension', 'Type 2 Diabetes Mellitus', 'Orthostatic symptoms']
          : ['Atrial Fibrillation', 'Chronic Kidney Disease Stage 3a'],
        activeMedications: patientId === 'eleanor-vance'
          ? ['Lisinopril 20mg daily', 'Metformin 1000mg BID']
          : ['Apixaban (Eliquis) 5mg BID', 'Metoprolol Succinate 50mg daily'],
        allergies: patientId === 'eleanor-vance'
          ? ['Penicillin (Beta-lactam class)']
          : ['NSAID class (Bronchospasm)'],
        latestVitals: patientId === 'eleanor-vance'
          ? { bp: '152/94 mmHg', hr: 76 }
          : { bp: '138/84 mmHg', hr: 78 }
      };
    }
  }),

  screen_emergency_red_flags: new ToolDefinition({
    toolName: 'screen_emergency_red_flags',
    purpose: 'Deterministic screening for acute cardiac, neurological, respiratory, or anaphylactic symptoms.',
    allowedRoles: ['physician', 'operations_staff', 'admin', 'INTERNAL_AGENT_ENGINE'],
    allowedAgents: ['connect', 'system'],
    tenantScope: 'none',
    patientScope: 'optional',
    sideEffect: 'none',
    category: 'clinical',
    approvalRequirement: 'none',
    idempotencyStrategy: 'none',
    auditRequirement: 'optional',
    parameters: {
      text: { type: 'string', required: true }
    },
    execute: async ({ text }) => {
      return screenRedFlags(text);
    }
  }),

  check_refill_safety: new ToolDefinition({
    toolName: 'check_refill_safety',
    purpose: 'Deterministic evaluation of drug-allergy cross reactivity, duplicate therapies, and longitudinal renal drift.',
    allowedRoles: ['physician', 'operations_staff', 'admin', 'INTERNAL_AGENT_ENGINE'],
    allowedAgents: ['refill', 'system'],
    tenantScope: 'strict',
    patientScope: 'required',
    sideEffect: 'none',
    category: 'clinical',
    approvalRequirement: 'none',
    idempotencyStrategy: 'none',
    auditRequirement: 'mandatory',
    parameters: {
      medicationName: { type: 'string', required: true },
      patientId: { type: 'string', required: true }
    },
    execute: async (params) => {
      return verifyRefillProposal(params);
    }
  }),

  find_matching_slots: new ToolDefinition({
    toolName: 'find_matching_slots',
    purpose: 'Query clinic scheduling system for open appointment openings matching timeframe.',
    allowedRoles: ['physician', 'operations_staff', 'admin', 'INTERNAL_AGENT_ENGINE'],
    allowedAgents: ['scheduler', 'connect', 'system'],
    tenantScope: 'strict',
    patientScope: 'optional',
    sideEffect: 'read',
    category: 'operational',
    approvalRequirement: 'none',
    idempotencyStrategy: 'none',
    auditRequirement: 'mandatory',
    parameters: {
      practitionerId: { type: 'string', required: false },
      durationMinutes: { type: 'number', required: false },
      targetDaysAhead: { type: 'number', required: false }
    },
    execute: async (params) => {
      const slots = await calendarAdapter.findAvailableSlots(params);
      return { slots };
    }
  }),

  schedule_appointment: new ToolDefinition({
    toolName: 'schedule_appointment',
    purpose: 'Book a confirmed calendar slot and create or update FHIR Appointment resource.',
    allowedRoles: ['physician', 'operations_staff', 'admin'],
    allowedAgents: ['scheduler'],
    tenantScope: 'strict',
    patientScope: 'required',
    sideEffect: 'write',
    category: 'operational',
    approvalRequirement: 'operations_staff',
    idempotencyStrategy: 'deterministic_key',
    auditRequirement: 'mandatory',
    parameters: {
      appointmentId: { type: 'string', required: true },
      slotId: { type: 'string', required: true },
      patientId: { type: 'string', required: true },
      patientName: { type: 'string', required: true },
      start: { type: 'string', required: true },
      end: { type: 'string', required: true }
    },
    execute: async (params) => {
      return await calendarAdapter.bookAppointment(params);
    }
  }),

  create_medication_request: new ToolDefinition({
    toolName: 'create_medication_request',
    purpose: 'Formulate an official FHIR MedicationRequest clinical prescription order.',
    allowedRoles: ['physician'],
    allowedAgents: ['refill'],
    tenantScope: 'strict',
    patientScope: 'required',
    sideEffect: 'write',
    category: 'clinical',
    approvalRequirement: 'physician',
    idempotencyStrategy: 'deterministic_key',
    auditRequirement: 'mandatory',
    parameters: {
      patientId: { type: 'string', required: true },
      medicationName: { type: 'string', required: true },
      dose: { type: 'string', required: true },
      frequency: { type: 'string', required: true },
      prescribingPhysician: { type: 'string', required: true }
    },
    execute: async (params, context) => {
      const fhirResource = {
        resourceType: 'MedicationRequest',
        id: `mr-${params.patientId}-${Date.now()}`,
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: { text: `${params.medicationName} ${params.dose}` },
        subject: { reference: `Patient/${params.patientId}` },
        dosageInstruction: [{ text: `${params.dose} ${params.frequency}` }],
        requester: { display: params.prescribingPhysician },
        authoredOn: new Date().toISOString()
      };
      return await fhirAdapter.persistResource(fhirResource, { tenantId: context.tenantId || 'org-default' });
    }
  }),

  send_patient_message: new ToolDefinition({
    toolName: 'send_patient_message',
    purpose: 'Dispatch a validated message to patient via portal, SMS, or email.',
    allowedRoles: ['physician', 'operations_staff', 'admin', 'INTERNAL_AGENT_ENGINE'],
    allowedAgents: ['connect', 'scheduler'],
    tenantScope: 'strict',
    patientScope: 'required',
    sideEffect: 'write',
    category: 'communication',
    approvalRequirement: 'policy_conditional',
    idempotencyStrategy: 'payload_hash',
    auditRequirement: 'mandatory',
    parameters: {
      patientId: { type: 'string', required: true },
      channel: { type: 'string', required: true },
      body: { type: 'string', required: true }
    },
    execute: async (params) => {
      if (params.channel === 'sms') {
        return await smsAdapter.sendSms({ to: '+15555551234', message: params.body });
      } else if (params.channel === 'email') {
        return await emailAdapter.sendEmail({ to: 'patient@example.com', subject: 'Notice from Proton Care', textBody: params.body });
      }
      return await patientMessagingAdapter.sendPortalMessage({ patientId: params.patientId, body: params.body });
    }
  }),

  draft_triage_communication: new ToolDefinition({
    toolName: 'draft_triage_communication',
    purpose: 'Propose a draft FHIR Communication resource awaiting physician review.',
    allowedRoles: ['physician', 'operations_staff', 'admin', 'INTERNAL_AGENT_ENGINE'],
    allowedAgents: ['connect', 'system'],
    tenantScope: 'strict',
    patientScope: 'required',
    sideEffect: 'write',
    category: 'communication',
    approvalRequirement: 'none',
    idempotencyStrategy: 'payload_hash',
    auditRequirement: 'mandatory',
    parameters: {
      patientId: { type: 'string', required: true },
      responseText: { type: 'string', required: true },
      requiresReview: { type: 'boolean', required: true }
    },
    execute: async ({ patientId, responseText, requiresReview }) => {
      return {
        resourceType: 'Communication',
        status: 'preparation',
        subject: { reference: `Patient/${patientId}` },
        payload: [{ contentString: responseText }],
        meta: {
          tag: [
            { system: 'https://proton.health/provenance', code: 'AI_DRAFT' },
            { system: 'https://proton.health/safety-gate', code: requiresReview ? 'REVIEW_REQUIRED' : 'AUTO_PERMITTED' }
          ]
        }
      };
    }
  })
};

/**
 * Validates caller tool execution permissions against ToolDefinition.
 */
function validateToolPermission(tool, callerContext = {}) {
  const callerRole = callerContext.role || callerContext.actorRole || 'anonymous';
  const callerAgent = callerContext.agent || 'user';

  // 1. Internal Engine or Authenticated Admin bypass for basic execution checks
  const isInternalEngine = callerRole === 'INTERNAL_AGENT_ENGINE' || callerRole === 'AUTHENTICATED_ADMIN';

  // 2. Allowed Role Check
  if (!isInternalEngine && !tool.allowedRoles.includes(callerRole)) {
    throw new ToolExecutionError(
      `Permission Denied: Caller role '${callerRole}' is not authorized to execute tool '${tool.toolName}'. Required roles: [${tool.allowedRoles.join(', ')}]`,
      403,
      'ROLE_PERMISSION_DENIED'
    );
  }

  // 3. Allowed Agent Check (if invoked by an agent)
  if (callerContext.agent && !tool.allowedAgents.includes(callerAgent) && !isInternalEngine) {
    throw new ToolExecutionError(
      `Permission Denied: Agent '${callerAgent}' is not authorized to execute tool '${tool.toolName}'. Allowed agents: [${tool.allowedAgents.join(', ')}]`,
      403,
      'AGENT_PERMISSION_DENIED'
    );
  }

  // 4. Clinical Approval Requirement Check
  if (tool.approvalRequirement === 'physician' && callerRole !== 'physician') {
    throw new ToolExecutionError(
      `Clinical Safety Invariant: Tool '${tool.toolName}' strictly requires Attending Physician execution/approval.`,
      403,
      'PHYSICIAN_APPROVAL_REQUIRED'
    );
  }

  return true;
}

/**
 * Execute registered tool through V2 policy gate.
 */
async function executeInternalToolV2(toolName, params = {}, callerContext = {}) {
  const tool = REGISTERED_TOOLS_V2[toolName];
  if (!tool) {
    throw new ToolExecutionError(`Tool '${toolName}' is not registered in Tool Registry V2.`, 404, 'UNKNOWN_TOOL');
  }

  // Validate permissions
  validateToolPermission(tool, callerContext);

  // Validate parameters against schema
  for (const [paramName, spec] of Object.entries(tool.parameters)) {
    if (spec.required && (params[paramName] === undefined || params[paramName] === null)) {
      throw new ToolExecutionError(
        `Missing required parameter '${paramName}' for tool '${toolName}'.`,
        400,
        'INVALID_TOOL_PARAMETERS'
      );
    }
  }

  try {
    const result = await tool.execute(params, callerContext);
    return {
      success: true,
      toolName,
      category: tool.category,
      sideEffect: tool.sideEffect,
      approvalRequirement: tool.approvalRequirement,
      provenance: 'INTERNAL_AGENT_TOOL_V2',
      result,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    if (err instanceof ToolExecutionError) throw err;
    throw new ToolExecutionError(`Tool '${toolName}' execution failed: ${err.message}`, 500, 'TOOL_EXECUTION_FAILURE');
  }
}

module.exports = {
  ToolExecutionError,
  ToolDefinition,
  REGISTERED_TOOLS_V2,
  validateToolPermission,
  executeInternalToolV2
};
