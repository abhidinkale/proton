/**
 * Proton Operations OS — Agent Tool Registry & Policy Gate
 * 
 * SECURITY ARCHITECTURE:
 * Agent Engine -> Tool Registry -> Permission/Policy Gate -> Tool Execution -> Result
 * 
 * INVARIANTS:
 * 1. Tool execution is restricted to internal Agent Engine callers.
 * 2. Side effects are strictly classified ('none', 'read_chart', 'propose_fhir_draft').
 * 3. Client/browser cannot directly execute privileged tools or perform arbitrary FHIR writes.
 * 4. Tools proposing clinical artifacts generate DRAFT structures marked for physician review.
 * 5. Unknown tools or unauthorized side effects are rejected immediately.
 */

const { screenRedFlags } = require('./triageAgent');
const { verifyRefillProposal } = require('./refillReferralAgent');

class ToolExecutionError extends Error {
  constructor(message, statusCode = 400, code = 'TOOL_EXECUTION_ERROR') {
    super(message);
    this.name = 'ToolExecutionError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const REGISTERED_TOOLS = {
  get_patient_intelligence: {
    name: 'get_patient_intelligence',
    description: 'Retrieve structured longitudinal context (conditions, medications, allergies, labs) from patient chart.',
    sideEffect: 'read_chart',
    parameters: {
      patientId: { type: 'string', required: true }
    },
    execute: async ({ patientId }, context) => {
      // In synthetic development mode, return grounded patient context
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
  },

  screen_emergency_red_flags: {
    name: 'screen_emergency_red_flags',
    description: 'Deterministic non-LLM screening for acute cardiac, neurological, respiratory, or anaphylactic symptoms.',
    sideEffect: 'none',
    parameters: {
      text: { type: 'string', required: true }
    },
    execute: async ({ text }) => {
      return screenRedFlags(text);
    }
  },

  check_refill_safety: {
    name: 'check_refill_safety',
    description: 'Deterministic evaluation of drug-allergy cross reactivity, duplicate therapies, and longitudinal renal drift.',
    sideEffect: 'none',
    parameters: {
      medicationName: { type: 'string', required: true },
      patientId: { type: 'string', required: true }
    },
    execute: async (params) => {
      return verifyRefillProposal(params);
    }
  },

  find_matching_slots: {
    name: 'find_matching_slots',
    description: 'Query clinic scheduling system for open appointment openings matching timeframe.',
    sideEffect: 'read_chart',
    parameters: {
      practitionerId: { type: 'string', required: false },
      durationMinutes: { type: 'number', required: false },
      targetDaysAhead: { type: 'number', required: false }
    },
    execute: async ({ targetDaysAhead = 90 }) => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + targetDaysAhead);
      return {
        slots: [
          {
            slotId: `slot-${Date.now()}-1`,
            start: targetDate.toISOString().split('T')[0] + 'T09:30:00Z',
            end: targetDate.toISOString().split('T')[0] + 'T10:00:00Z',
            practitionerName: 'Dr. Sarah Lin, MD',
            location: 'Suite 400 - Internal Medicine'
          },
          {
            slotId: `slot-${Date.now()}-2`,
            start: targetDate.toISOString().split('T')[0] + 'T14:00:00Z',
            end: targetDate.toISOString().split('T')[0] + 'T14:30:00Z',
            practitionerName: 'Dr. Sarah Lin, MD',
            location: 'Suite 400 - Internal Medicine'
          }
        ]
      };
    }
  },

  draft_triage_communication: {
    name: 'draft_triage_communication',
    description: 'Propose a draft FHIR Communication resource awaiting physician review.',
    sideEffect: 'propose_fhir_draft',
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
  }
};

/**
 * Executes a registered tool through the Permission & Policy Gate.
 * Caller must be internal or pass authorized authentication context.
 */
async function executeInternalTool(toolName, params = {}, callerContext = {}) {
  // 1. Verify caller authorization
  if (callerContext.role !== 'INTERNAL_AGENT_ENGINE' && callerContext.role !== 'AUTHENTICATED_ADMIN') {
    throw new ToolExecutionError(
      'Unauthorized: Direct external browser invocation of privileged tools is forbidden.',
      403,
      'UNAUTHORIZED_TOOL_INVOCATION'
    );
  }

  // 2. Reject unknown tools
  const tool = REGISTERED_TOOLS[toolName];
  if (!tool) {
    throw new ToolExecutionError(
      `Tool '${toolName}' is not registered in the Agent Tool Registry.`,
      404,
      'UNKNOWN_TOOL'
    );
  }

  // 3. Enforce side-effect bounds
  const allowedSideEffects = callerContext.allowedSideEffects || ['none', 'read_chart', 'propose_fhir_draft'];
  if (!allowedSideEffects.includes(tool.sideEffect)) {
    throw new ToolExecutionError(
      `Execution blocked: Tool '${toolName}' declares sideEffect '${tool.sideEffect}' which exceeds the caller's allowed permissions [${allowedSideEffects.join(', ')}].`,
      403,
      'UNAUTHORIZED_SIDE_EFFECT'
    );
  }

  // 4. Validate parameters against tool schema
  for (const [paramName, spec] of Object.entries(tool.parameters)) {
    if (spec.required && (params[paramName] === undefined || params[paramName] === null)) {
      throw new ToolExecutionError(
        `Missing required parameter '${paramName}' for tool '${toolName}'.`,
        400,
        'INVALID_TOOL_PARAMETERS'
      );
    }
  }

  // 5. Execute tool safely
  try {
    const result = await tool.execute(params, callerContext);
    return {
      success: true,
      toolName,
      sideEffect: tool.sideEffect,
      provenance: 'INTERNAL_AGENT_TOOL',
      result,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    throw new ToolExecutionError(
      `Tool '${toolName}' execution failed: ${err.message}`,
      500,
      'TOOL_EXECUTION_FAILURE'
    );
  }
}

module.exports = {
  ToolExecutionError,
  REGISTERED_TOOLS,
  executeInternalTool
};
