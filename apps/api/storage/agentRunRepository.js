/**
 * Proton Healthcare Operations OS — Agent Execution Run Repository
 * 
 * Records execution metadata, latencies, tokens, and structured outputs.
 * INVARIANT: Never persist chain-of-thought, scratchpads, or private model reasoning tokens.
 */

const { getDatabase } = require('./db');

function sanitizeStructuredOutput(output) {
  if (!output) return null;
  if (typeof output === 'string') {
    return output;
  }
  // If an object was provided, ensure any potential private CoT keys are stripped
  const sanitized = { ...output };
  delete sanitized.thought;
  delete sanitized.thinking;
  delete sanitized.chainOfThought;
  delete sanitized.scratchpad;
  delete sanitized.internalMonologue;
  delete sanitized.privateReasoning;
  return JSON.stringify(sanitized);
}

function recordAgentRun({
  id = null,
  tenantId = 'org-default',
  taskId,
  agentName,
  modelProvider,
  modelVersion,
  contextProvenanceIds = [],
  policyChecks = {},
  toolCalls = [],
  structuredOutput = null,
  status = 'success',
  latencyMs = 0,
  tokensConsumed = 0,
  errorCode = null
}) {
  const db = getDatabase();
  const runId = id || `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const cleanOutput = sanitizeStructuredOutput(structuredOutput);

  db.prepare(`
    INSERT INTO agent_execution_runs (
      id, tenant_id, task_id, agent_name,
      model_provider, model_version,
      context_provenance_ids, policy_checks, tool_calls,
      structured_output, status, latency_ms,
      tokens_consumed, error_code, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `).run(
    runId,
    tenantId,
    taskId,
    agentName,
    modelProvider,
    modelVersion,
    JSON.stringify(contextProvenanceIds || []),
    JSON.stringify(policyChecks || {}),
    JSON.stringify(toolCalls || []),
    cleanOutput,
    status,
    latencyMs,
    tokensConsumed,
    errorCode || null,
    now
  );

  return {
    id: runId,
    tenantId,
    taskId,
    agentName,
    status,
    latencyMs,
    tokensConsumed,
    errorCode
  };
}

function listAgentRunsForTask(taskId, tenantId = 'org-default') {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM agent_execution_runs
    WHERE task_id = ? AND tenant_id = ?
    ORDER BY created_at DESC;
  `).all(taskId, tenantId);
}

function listAgentRuns({ tenantId = 'org-default', taskId = null, limit = 50 } = {}) {
  const db = getDatabase();
  if (taskId) {
    return listAgentRunsForTask(taskId, tenantId);
  }
  return db.prepare(`
    SELECT * FROM agent_execution_runs
    WHERE tenant_id = ?
    ORDER BY created_at DESC
    LIMIT ?;
  `).all(tenantId, limit);
}

function recordRun(run) {
  return recordAgentRun({
    id: run.runId,
    tenantId: run.tenantId,
    taskId: run.taskId,
    agentName: run.agentId || run.agentName || 'agent',
    modelProvider: run.modelProvider || 'gemini',
    modelVersion: run.modelVersion || 'v2',
    policyChecks: run.policyResults || run.policyChecks || {},
    toolCalls: run.toolCalls || [],
    structuredOutput: run.actionProposal || run.structuredOutput || null,
    status: run.status || 'success',
    latencyMs: run.latencyMs || 0,
    tokensConsumed: run.tokensConsumed || 0
  });
}

function listRuns(options = {}) {
  return listAgentRuns(options);
}

module.exports = {
  recordAgentRun,
  recordRun,
  listAgentRunsForTask,
  listAgentRuns,
  listRuns
};
