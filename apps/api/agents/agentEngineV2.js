/**
 * Proton Operations OS — Agent Engine V2 Core Architecture
 * 
 * Formal implementations of:
 * - AgentDefinition
 * - AgentRun
 * - AgentPolicy
 * - ToolDefinition (imported from toolsV2.js)
 * - ToolPermission
 * - AgentTask
 * - ApprovalRequest
 * - Escalation
 * 
 * ARCHITECTURE PRINCIPLE:
 * TRIGGER -> IDENTITY -> TENANT -> PATIENT CONTEXT -> CLINICAL BRAIN ->
 * POLICY / SAFETY CHECK -> TOOL SELECTION -> ACTION PROPOSAL ->
 * HUMAN APPROVAL WHEN REQUIRED -> FHIR / EXTERNAL SYSTEM -> AUDIT -> MEMORY / STATE UPDATE
 * 
 * INVARIANTS:
 * 1. Zero chain-of-thought persisted.
 * 2. Never allow an agent to silently modify clinical truth.
 * 3. Never skip policy or authorization.
 */

const crypto = require('crypto');
const { REGISTERED_TOOLS_V2, executeInternalToolV2, validateToolPermission } = require('./toolsV2');
const auditRepository = require('../storage/auditRepository');
const agentRunRepository = require('../storage/agentRunRepository');
const { getScopedPatientContext } = require('./brainBridge');

class AgentPolicy {
  constructor({ policyId, name, category, description, evaluate }) {
    this.policyId = policyId;
    this.name = name;
    this.category = category; // 'clinical', 'operational', 'security'
    this.description = description;
    this.evaluate = evaluate; // (context) => { pass: boolean, violations: string[], requiresApproval: boolean, reason?: string }
  }
}

class AgentDefinition {
  constructor({ agentId, name, role, allowedTools = [], policies = [], clinicalAuthority = false }) {
    this.agentId = agentId;
    this.name = name;
    this.role = role;
    this.allowedTools = allowedTools;
    this.policies = policies;
    this.clinicalAuthority = clinicalAuthority; // Strictly false for all autonomous agents
  }
}

class AgentRun {
  constructor({
    runId,
    agentId,
    tenantId = 'org-default',
    taskId = null,
    patientId = null,
    triggerType,
    inputSummary,
    policyResults = [],
    toolCalls = [],
    actionProposal = null,
    approvalState = 'not_required', // 'not_required', 'pending_approval', 'approved', 'rejected'
    status = 'completed',
    error = null,
    latencyMs = 0
  }) {
    this.runId = runId || `run-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.agentId = agentId;
    this.tenantId = tenantId;
    this.taskId = taskId;
    this.patientId = patientId;
    this.triggerType = triggerType;
    this.inputSummary = inputSummary;
    this.policyResults = policyResults;
    this.toolCalls = toolCalls;
    this.actionProposal = actionProposal;
    this.approvalState = approvalState;
    this.status = status;
    this.error = error;
    this.latencyMs = latencyMs;
    this.timestamp = new Date().toISOString();
  }

  // Ensures ZERO chain-of-thought or internal scratchpad is stored
  toRecord() {
    return {
      runId: this.runId,
      agentId: this.agentId,
      tenantId: this.tenantId,
      taskId: this.taskId,
      patientId: this.patientId,
      triggerType: this.triggerType,
      inputSummary: this.inputSummary,
      policyResults: this.policyResults,
      toolCalls: this.toolCalls.map(tc => ({
        toolName: tc.toolName,
        success: tc.success,
        sideEffect: tc.sideEffect,
        category: tc.category
      })),
      actionProposal: this.actionProposal ? {
        type: this.actionProposal.type,
        requiresApproval: this.actionProposal.requiresApproval,
        approvalRole: this.actionProposal.approvalRole
      } : null,
      approvalState: this.approvalState,
      status: this.status,
      latencyMs: this.latencyMs,
      timestamp: this.timestamp
    };
  }
}

class ApprovalRequest {
  constructor({ approvalId, taskId, patientId, category, proposedAction, proposedResource, clinicalRationale, riskTier, requiresRole = 'physician' }) {
    this.approvalId = approvalId || `appr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.taskId = taskId;
    this.patientId = patientId;
    this.category = category; // 'clinical_communication', 'medication_refill', 'specialist_referral', 'document_extraction'
    this.proposedAction = proposedAction;
    this.proposedResource = proposedResource;
    this.clinicalRationale = clinicalRationale;
    this.riskTier = riskTier; // 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'
    this.requiresRole = requiresRole;
    this.status = 'pending'; // 'pending', 'approved', 'rejected'
    this.createdAt = new Date().toISOString();
  }
}

class Escalation {
  constructor({ escalationId, taskId, patientId, severity, reason, redFlagCategory, routedToRole = 'physician', notificationChannel = 'urgent_inbox' }) {
    this.escalationId = escalationId || `esc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.taskId = taskId;
    this.patientId = patientId;
    this.severity = severity; // 'HIGH', 'CRITICAL_EMERGENCY'
    this.reason = reason;
    this.redFlagCategory = redFlagCategory;
    this.routedToRole = routedToRole;
    this.notificationChannel = notificationChannel;
    this.createdAt = new Date().toISOString();
  }
}

class AgentTask {
  constructor({ id, tenantId = 'org-default', category, priority = 'routine', status = 'requested', patientId, patientName, title, summary, sourceEvent }) {
    this.id = id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    this.tenantId = tenantId;
    this.category = category;
    this.priority = priority;
    this.status = status;
    this.patientId = patientId;
    this.patientName = patientName;
    this.title = title;
    this.summary = summary;
    this.sourceEvent = sourceEvent;
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
  }
}

// Standard Safety Policies
const STANDARD_POLICIES = {
  NO_AUTONOMOUS_CLINICAL_DISPATCH: new AgentPolicy({
    policyId: 'POL-01',
    name: 'No Autonomous Clinical Communication',
    category: 'clinical',
    description: 'Clinical advice, symptom evaluations, and medication changes strictly require Attending Physician sign-off.',
    evaluate: (ctx) => {
      if (ctx.isClinical || ctx.containsMedicationQuestion || ctx.containsSymptomQuestion) {
        return {
          pass: true,
          requiresApproval: true,
          approvalRole: 'physician',
          violations: [],
          reason: 'Clinical content requires Attending Physician approval prior to transmission.'
        };
      }
      return { pass: true, requiresApproval: false, violations: [] };
    }
  }),

  NO_AUTONOMOUS_PRESCRIBING: new AgentPolicy({
    policyId: 'POL-02',
    name: 'No Autonomous Prescribing or Dosage Alteration',
    category: 'clinical',
    description: 'Agents must never autonomously formulate binding prescriptions or authorize medication refills.',
    evaluate: (ctx) => {
      if (ctx.actionType === 'prescribe' || ctx.actionType === 'authorize_refill') {
        if (ctx.actorRole !== 'physician') {
          return {
            pass: false,
            requiresApproval: true,
            approvalRole: 'physician',
            violations: ['AUTONOMOUS_PRESCRIBING_PROHIBITED'],
            reason: 'Prescriptions and refill authorizations are strictly restricted to physicians.'
          };
        }
      }
      return { pass: true, requiresApproval: false, violations: [] };
    }
  }),

  PROMPT_EMERGENCY_DIVERSION: new AgentPolicy({
    policyId: 'POL-03',
    name: 'Immediate Emergency Diversion',
    category: 'clinical',
    description: 'Emergency red-flag symptoms must trigger immediate 911 / ED guidance and physician notification.',
    evaluate: (ctx) => {
      if (ctx.isEmergencyRedFlag) {
        return {
          pass: true,
          requiresEscalation: true,
          escalationSeverity: 'CRITICAL_EMERGENCY',
          violations: ['EMERGENCY_RED_FLAG_DETECTED'],
          reason: 'Severe acute cardiac, respiratory, or neurological red flag detected.'
        };
      }
      return { pass: true, requiresEscalation: false, violations: [] };
    }
  }),

  TENANT_ISOLATION_MANDATE: new AgentPolicy({
    policyId: 'POL-04',
    name: 'Strict Tenant Data Isolation',
    category: 'security',
    description: 'Operations must be strictly contained within the caller organization tenant boundary.',
    evaluate: (ctx) => {
      if (ctx.targetTenantId && ctx.callerTenantId && ctx.targetTenantId !== ctx.callerTenantId) {
        return {
          pass: false,
          requiresApproval: false,
          violations: ['CROSS_TENANT_VIOLATION'],
          reason: `Access across tenant boundary (${ctx.callerTenantId} -> ${ctx.targetTenantId}) is prohibited.`
        };
      }
      return { pass: true, violations: [] };
    }
  })
};

module.exports = {
  AgentPolicy,
  AgentDefinition,
  AgentRun,
  ApprovalRequest,
  Escalation,
  AgentTask,
  STANDARD_POLICIES
};
