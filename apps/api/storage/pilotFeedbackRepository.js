/**
 * Proton Healthcare Operations OS — Physician Pilot Feedback Repository
 * 
 * Provides durable storage and structured metrics aggregation for physician pilot encounters:
 * - Time per encounter (minutes)
 * - AI draft acceptance rate (accepted_unchanged, minor_edit, major_edit, rewritten)
 * - Memory proposal approval rate
 * - Follow-up task acceptance rate
 * - Physician subjective rating (1-5 stars)
 * - Correction reason taxonomy (dosage, phrasing, omitted_finding, hallucination, allergy_conflict, other)
 */

const crypto = require('crypto');
const { getDatabase } = require('./db');

function initPilotFeedbackSchema() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS physician_pilot_feedback (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'org-default',
      encounter_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      clinician_id TEXT NOT NULL,
      encounter_duration_minutes REAL NOT NULL,
      note_word_count INTEGER NOT NULL,
      note_draft_status TEXT NOT NULL CHECK(note_draft_status IN ('accepted_unchanged', 'minor_edit', 'major_edit', 'rewritten')),
      memory_proposals_approved INTEGER NOT NULL DEFAULT 0,
      memory_proposals_total INTEGER NOT NULL DEFAULT 0,
      follow_up_tasks_accepted INTEGER NOT NULL DEFAULT 0,
      follow_up_tasks_total INTEGER NOT NULL DEFAULT 0,
      overall_rating INTEGER NOT NULL CHECK(overall_rating BETWEEN 1 AND 5),
      corrections_json TEXT NOT NULL DEFAULT '[]',
      comments TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pilot_tenant ON physician_pilot_feedback(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_pilot_clinician ON physician_pilot_feedback(clinician_id);
  `);
}

function recordPilotFeedback({
  id = null,
  tenantId = 'org-default',
  encounterId,
  patientId,
  clinicianId,
  encounterDurationMinutes,
  noteWordCount = 0,
  noteDraftStatus = 'minor_edit',
  memoryProposalsApproved = 0,
  memoryProposalsTotal = 0,
  followUpTasksAccepted = 0,
  followUpTasksTotal = 0,
  overallRating = 5,
  corrections = [],
  comments = null
}) {
  initPilotFeedbackSchema();
  const db = getDatabase();
  const feedbackId = id || `fbk-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
  const correctionsJson = JSON.stringify(corrections || []);

  db.prepare(`
    INSERT INTO physician_pilot_feedback (
      id, tenant_id, encounter_id, patient_id, clinician_id,
      encounter_duration_minutes, note_word_count, note_draft_status,
      memory_proposals_approved, memory_proposals_total,
      follow_up_tasks_accepted, follow_up_tasks_total,
      overall_rating, corrections_json, comments, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    feedbackId,
    tenantId,
    encounterId,
    patientId,
    clinicianId,
    encounterDurationMinutes,
    noteWordCount,
    noteDraftStatus,
    memoryProposalsApproved,
    memoryProposalsTotal,
    followUpTasksAccepted,
    followUpTasksTotal,
    overallRating,
    correctionsJson,
    comments || null,
    now
  );

  return getPilotFeedbackById(feedbackId, tenantId);
}

function getPilotFeedbackById(id, tenantId = 'org-default') {
  initPilotFeedbackSchema();
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM physician_pilot_feedback WHERE id = ? AND tenant_id = ?').get(id, tenantId);
  if (!row) return null;
  return deserializeFeedback(row);
}

function deserializeFeedback(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    encounterId: row.encounter_id,
    patientId: row.patient_id,
    clinicianId: row.clinician_id,
    encounterDurationMinutes: row.encounter_duration_minutes,
    noteWordCount: row.note_word_count,
    noteDraftStatus: row.note_draft_status,
    memoryProposalsApproved: row.memory_proposals_approved,
    memoryProposalsTotal: row.memory_proposals_total,
    followUpTasksAccepted: row.follow_up_tasks_accepted,
    followUpTasksTotal: row.follow_up_tasks_total,
    overallRating: row.overall_rating,
    corrections: JSON.parse(row.corrections_json || '[]'),
    comments: row.comments,
    createdAt: row.created_at
  };
}

function listPilotFeedback({ tenantId = 'org-default', clinicianId = null, limit = 100 } = {}) {
  initPilotFeedbackSchema();
  const db = getDatabase();
  let query = 'SELECT * FROM physician_pilot_feedback WHERE tenant_id = ?';
  const params = [tenantId];

  if (clinicianId) {
    query += ' AND clinician_id = ?';
    params.push(clinicianId);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(query).all(...params);
  return rows.map(deserializeFeedback);
}

function getPilotSummary(tenantId = 'org-default') {
  initPilotFeedbackSchema();
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM physician_pilot_feedback WHERE tenant_id = ?').all(tenantId);
  const items = rows.map(deserializeFeedback);

  if (items.length === 0) {
    return {
      totalEncounters: 0,
      avgDurationMinutes: 0,
      avgRating: 0,
      draftStatusBreakdown: { accepted_unchanged: 0, minor_edit: 0, major_edit: 0, rewritten: 0 },
      draftAcceptanceRate: 0,
      memoryProposalApprovalRate: 0,
      followUpTaskAcceptanceRate: 0,
      correctionsTaxonomy: {}
    };
  }

  const totalEncounters = items.length;
  const avgDurationMinutes = Math.round((items.reduce((s, i) => s + i.encounterDurationMinutes, 0) / totalEncounters) * 10) / 10;
  const avgRating = Math.round((items.reduce((s, i) => s + i.overallRating, 0) / totalEncounters) * 10) / 10;

  const draftStatusBreakdown = { accepted_unchanged: 0, minor_edit: 0, major_edit: 0, rewritten: 0 };
  items.forEach(i => {
    if (draftStatusBreakdown[i.noteDraftStatus] !== undefined) {
      draftStatusBreakdown[i.noteDraftStatus]++;
    }
  });

  const acceptedOrMinor = draftStatusBreakdown.accepted_unchanged + draftStatusBreakdown.minor_edit;
  const draftAcceptanceRate = Math.round((acceptedOrMinor / totalEncounters) * 100);

  const totalMemProposals = items.reduce((s, i) => s + i.memoryProposalsTotal, 0);
  const approvedMemProposals = items.reduce((s, i) => s + i.memoryProposalsApproved, 0);
  const memoryProposalApprovalRate = totalMemProposals > 0 ? Math.round((approvedMemProposals / totalMemProposals) * 100) : 100;

  const totalFollowUp = items.reduce((s, i) => s + i.followUpTasksTotal, 0);
  const acceptedFollowUp = items.reduce((s, i) => s + i.followUpTasksAccepted, 0);
  const followUpTaskAcceptanceRate = totalFollowUp > 0 ? Math.round((acceptedFollowUp / totalFollowUp) * 100) : 100;

  const correctionsTaxonomy = {};
  items.forEach(i => {
    (i.corrections || []).forEach(c => {
      correctionsTaxonomy[c] = (correctionsTaxonomy[c] || 0) + 1;
    });
  });

  return {
    totalEncounters,
    avgDurationMinutes,
    avgRating,
    draftStatusBreakdown,
    draftAcceptanceRate,
    memoryProposalApprovalRate,
    followUpTaskAcceptanceRate,
    correctionsTaxonomy
  };
}

module.exports = {
  recordPilotFeedback,
  getPilotFeedbackById,
  listPilotFeedback,
  getPilotSummary
};
