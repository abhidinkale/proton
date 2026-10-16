/**
 * Proton Healthcare Operations OS — PostgreSQL Task Repository
 * 
 * Provides durable multi-tenant persistence for operational tasks backed by PostgreSQL.
 */

const { getPostgresPool } = require('../postgresDb');

function serializeDetails(task) {
  const details = {};
  if (task.triageDetails) details.triageDetails = task.triageDetails;
  if (task.refillDetails) details.refillDetails = task.refillDetails;
  if (task.schedulingDetails) details.schedulingDetails = task.schedulingDetails;
  if (task.referralDetails) details.referralDetails = task.referralDetails;
  if (task.identityResolution) details.identityResolution = task.identityResolution;
  if (task.requiresManualResolution !== undefined) details.requiresManualResolution = task.requiresManualResolution;
  if (task.targetQueue) details.targetQueue = task.targetQueue;
  return details;
}

function deserializeTaskPg(row) {
  if (!row) return null;
  const details = typeof row.task_details_json === 'string' ? JSON.parse(row.task_details_json) : (row.task_details_json || {});
  return {
    id: row.id,
    tenantId: row.tenant_id,
    category: row.category,
    priority: row.priority,
    status: row.status,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientAgeSex: row.patient_age_sex,
    title: row.title,
    summary: row.summary,
    sourceEvent: row.source_event,
    reconciliationStatus: row.reconciliation_status,
    reconciliationError: row.reconciliation_error || null,
    fhirResourceId: row.fhir_resource_id || null,
    fhirResourceType: row.fhir_resource_type || null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    ...details
  };
}

async function saveTask(task, tenantId = 'org-default', pool = null) {
  const p = pool || getPostgresPool();
  const detailsJson = JSON.stringify(serializeDetails(task));

  const query = `
    INSERT INTO operational_tasks (
      id, tenant_id, category, priority, status,
      patient_id, patient_name, patient_age_sex,
      title, summary, source_event,
      reconciliation_status, reconciliation_error,
      fhir_resource_id, fhir_resource_type,
      task_details_json, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11,
      $12, $13,
      $14, $15,
      $16::jsonb, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      category = EXCLUDED.category,
      priority = EXCLUDED.priority,
      status = EXCLUDED.status,
      patient_id = EXCLUDED.patient_id,
      patient_name = EXCLUDED.patient_name,
      patient_age_sex = EXCLUDED.patient_age_sex,
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      source_event = EXCLUDED.source_event,
      reconciliation_status = EXCLUDED.reconciliation_status,
      reconciliation_error = EXCLUDED.reconciliation_error,
      fhir_resource_id = EXCLUDED.fhir_resource_id,
      fhir_resource_type = EXCLUDED.fhir_resource_type,
      task_details_json = EXCLUDED.task_details_json,
      updated_at = NOW()
    WHERE operational_tasks.tenant_id = $2
    RETURNING *;
  `;

  const values = [
    task.id,
    tenantId,
    task.category,
    task.priority,
    task.status,
    task.patientId,
    task.patientName,
    task.patientAgeSex,
    task.title,
    task.summary,
    task.sourceEvent,
    task.reconciliationStatus || 'none',
    task.reconciliationError || null,
    task.fhirResourceId || null,
    task.fhirResourceType || null,
    detailsJson
  ];

  const { rows } = await p.query(query, values);
  return deserializeTaskPg(rows[0]);
}

async function getTaskById(taskId, tenantId = 'org-default', pool = null) {
  const p = pool || getPostgresPool();
  const { rows } = await p.query(
    'SELECT * FROM operational_tasks WHERE id = $1 AND tenant_id = $2;',
    [taskId, tenantId]
  );
  return deserializeTaskPg(rows[0]);
}

async function listTasks({ status, category, patientId, tenantId = 'org-default' } = {}, pool = null) {
  const p = pool || getPostgresPool();
  const conditions = ['tenant_id = $1'];
  const params = [tenantId];
  let paramIdx = 2;

  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }
  if (category) {
    conditions.push(`category = $${paramIdx++}`);
    params.push(category);
  }
  if (patientId) {
    conditions.push(`patient_id = $${paramIdx++}`);
    params.push(patientId);
  }

  const query = `
    SELECT * FROM operational_tasks
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC;
  `;

  const { rows } = await p.query(query, params);
  return rows.map(deserializeTaskPg);
}

async function getSummary(tenantId = 'org-default', pool = null) {
  const tasks = await listTasks({ tenantId }, pool);
  return {
    totalActiveTasks: tasks.filter(t => t.status !== 'completed' && t.status !== 'rejected').length,
    pendingTriageCount: tasks.filter(t => t.category === 'triage' && (t.status === 'requested' || t.status === 'ready')).length,
    urgentRefillCount: tasks.filter(t => t.category === 'refill' && t.status !== 'completed' && t.status !== 'rejected').length,
    schedulingCareGapCount: tasks.filter(t => t.category === 'scheduling' && t.status !== 'completed').length,
    openReferralCount: tasks.filter(t => t.category === 'referral' && t.status !== 'completed').length,
    reconciliationPendingCount: tasks.filter(t => t.reconciliationStatus === 'pending').length,
    reconciliationFailedCount: tasks.filter(t => t.reconciliationStatus === 'failed').length
  };
}

module.exports = {
  saveTask,
  getTaskById,
  listTasks,
  getSummary
};
