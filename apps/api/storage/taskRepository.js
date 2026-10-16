/**
 * Proton Healthcare Operations OS — Task Repository
 * 
 * Provides durable persistence and multi-tenant scoping for Operational Tasks.
 */

const { getDatabase } = require('./db');

function serializeDetails(task) {
  const details = {};
  if (task.triageDetails) details.triageDetails = task.triageDetails;
  if (task.refillDetails) details.refillDetails = task.refillDetails;
  if (task.schedulingDetails) details.schedulingDetails = task.schedulingDetails;
  if (task.referralDetails) details.referralDetails = task.referralDetails;
  if (task.documentDetails) details.documentDetails = task.documentDetails;
  if (task.identityResolution) details.identityResolution = task.identityResolution;
  if (task.requiresManualResolution !== undefined) details.requiresManualResolution = task.requiresManualResolution;
  if (task.targetQueue) details.targetQueue = task.targetQueue;
  return JSON.stringify(details);
}

function deserializeTask(row) {
  if (!row) return null;
  const details = JSON.parse(row.task_details_json || '{}');
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...details
  };
}

function saveTask(task, tenantId = 'org-default') {
  const db = getDatabase();
  const now = task.createdAt || new Date().toISOString();
  const updated = new Date().toISOString();
  const detailsJson = serializeDetails(task);

  const existing = db.prepare('SELECT id FROM operational_tasks WHERE id = ? AND tenant_id = ?;').get(task.id, tenantId);

  if (existing) {
    db.prepare(`
      UPDATE operational_tasks SET
        category = ?,
        priority = ?,
        status = ?,
        patient_id = ?,
        patient_name = ?,
        patient_age_sex = ?,
        title = ?,
        summary = ?,
        source_event = ?,
        reconciliation_status = ?,
        reconciliation_error = ?,
        fhir_resource_id = ?,
        fhir_resource_type = ?,
        task_details_json = ?,
        updated_at = ?
      WHERE id = ? AND tenant_id = ?;
    `).run(
      task.category,
      task.priority || 'routine',
      task.status || 'requested',
      task.patientId || 'unknown-patient',
      task.patientName || 'Patient',
      task.patientAgeSex || 'Unknown',
      task.title || 'Untitled Task',
      task.summary || '',
      task.sourceEvent || 'System Event',
      task.reconciliationStatus || 'none',
      task.reconciliationError || null,
      task.fhirResourceId || null,
      task.fhirResourceType || null,
      detailsJson,
      updated,
      task.id,
      tenantId
    );
  } else {
    db.prepare(`
      INSERT INTO operational_tasks (
        id, tenant_id, category, priority, status,
        patient_id, patient_name, patient_age_sex,
        title, summary, source_event,
        reconciliation_status, reconciliation_error,
        fhir_resource_id, fhir_resource_type,
        task_details_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `).run(
      task.id,
      tenantId,
      task.category,
      task.priority || 'routine',
      task.status || 'requested',
      task.patientId || 'unknown-patient',
      task.patientName || 'Patient',
      task.patientAgeSex || 'Unknown',
      task.title || 'Untitled Task',
      task.summary || '',
      task.sourceEvent || 'System Event',
      task.reconciliationStatus || 'none',
      task.reconciliationError || null,
      task.fhirResourceId || null,
      task.fhirResourceType || null,
      detailsJson,
      now,
      updated
    );
  }

  return getTaskById(task.id, tenantId);
}

function getTaskById(id, tenantId = 'org-default') {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM operational_tasks WHERE id = ? AND tenant_id = ?;').get(id, tenantId);
  return deserializeTask(row);
}

function listTasks({ tenantId = 'org-default', status, category, patientId } = {}) {
  const db = getDatabase();
  let query = 'SELECT * FROM operational_tasks WHERE tenant_id = ?';
  const params = [tenantId];

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }
  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }
  if (patientId) {
    query += ' AND patient_id = ?';
    params.push(patientId);
  }

  query += ' ORDER BY created_at DESC;';

  const rows = db.prepare(query).all(...params);
  return rows.map(deserializeTask);
}

function updateTaskReconciliation(id, { reconciliationStatus, fhirResourceId, fhirResourceType, reconciliationError }, tenantId = 'org-default') {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE operational_tasks SET
      reconciliation_status = ?,
      fhir_resource_id = coalesce(?, fhir_resource_id),
      fhir_resource_type = coalesce(?, fhir_resource_type),
      reconciliation_error = ?,
      updated_at = ?
    WHERE id = ? AND tenant_id = ?;
  `).run(
    reconciliationStatus,
    fhirResourceId || null,
    fhirResourceType || null,
    reconciliationError || null,
    now,
    id,
    tenantId
  );
  return getTaskById(id, tenantId);
}

function getSummary(tenantId = 'org-default') {
  const db = getDatabase();
  const activeTasks = db.prepare(`
    SELECT category, priority, status FROM operational_tasks
    WHERE tenant_id = ? AND status NOT IN ('completed', 'rejected');
  `).all(tenantId);

  const pendingTriage = activeTasks.filter(t => t.category === 'triage').length;
  const urgentRefills = activeTasks.filter(t => t.category === 'refill').length;
  const careGaps = activeTasks.filter(t => t.category === 'scheduling').length;
  const openReferrals = activeTasks.filter(t => t.category === 'referral').length;
  const emergencyAlerts = activeTasks.filter(t => t.priority === 'emergency').length;

  return {
    pendingTriageCount: pendingTriage,
    urgentRefillCount: urgentRefills,
    schedulingCareGapCount: careGaps,
    openReferralCount: openReferrals,
    emergencyAlertCount: emergencyAlerts,
    totalActiveTasks: activeTasks.length
  };
}

function createTask(task, tenantId = 'org-default') {
  return saveTask(task, tenantId || task.tenantId || 'org-default');
}

function updateTask(id, updates = {}, tenantId = 'org-default') {
  const existing = getTaskById(id, tenantId);
  if (!existing) return null;
  const merged = { ...existing, ...updates };
  return saveTask(merged, tenantId);
}

module.exports = {
  saveTask,
  createTask,
  updateTask,
  getTaskById,
  listTasks,
  updateTaskReconciliation,
  getSummary
};
