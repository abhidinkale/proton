/**
 * Proton Capture Session Storage Adapter
 * 
 * Manages atomic persistence and state retrieval for capture sessions
 * in SQLite / Durable Database.
 */

const { getDatabase } = require('../../storage/db');

class SessionStore {
  /**
   * Inserts a new capture session into the database.
   */
  createSession({
    id,
    tenantId = 'org-default',
    actorId,
    actorRole,
    actorName,
    patientId,
    encounterId = null,
    status = 'PAIRING',
    pairingTokenHash,
    expiresAt,
    createdAt = new Date().toISOString(),
    metadata = {}
  }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO capture_sessions (
        id, tenant_id, actor_id, actor_role, actor_name,
        patient_id, encounter_id, status, pairing_token_hash,
        pairing_token_consumed, created_at, expires_at, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?);
    `);

    stmt.run(
      id,
      tenantId,
      actorId,
      actorRole,
      actorName,
      patientId,
      encounterId,
      status,
      pairingTokenHash,
      createdAt,
      expiresAt,
      JSON.stringify(metadata || {})
    );

    return this.getSessionById(id);
  }

  /**
   * Retrieves a session by ID and automatically enforces TTL expiration.
   */
  getSessionById(id) {
    if (!id || typeof id !== 'string') return null;
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM capture_sessions WHERE id = ?;').get(id);
    if (!row) return null;

    const session = this._formatRow(row);
    return this._checkAndApplyExpiration(session);
  }

  /**
   * Finds a session by its pairing token hash.
   */
  getSessionByPairingTokenHash(tokenHash) {
    if (!tokenHash || typeof tokenHash !== 'string') return null;
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM capture_sessions WHERE pairing_token_hash = ?;').get(tokenHash);
    if (!row) return null;

    const session = this._formatRow(row);
    return this._checkAndApplyExpiration(session);
  }

  /**
   * Atomically transitions session to PAIRED and marks token consumed.
   */
  markSessionPaired(id, { mobileTokenHash = null, newExpiresAt = null } = {}) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE capture_sessions
      SET status = 'PAIRED',
          pairing_token_consumed = 1,
          mobile_token_hash = COALESCE(?, mobile_token_hash),
          paired_at = ?,
          expires_at = COALESCE(?, expires_at)
      WHERE id = ? AND pairing_token_consumed = 0 AND status = 'PAIRING';
    `);

    const result = stmt.run(mobileTokenHash, now, newExpiresAt, id);
    if (result.changes === 0) {
      return null; // Concurrency conflict or already consumed
    }

    return this.getSessionById(id);
  }

  /**
   * Updates session status (e.g. CANCELLED, ACTIVE, COMPLETED, REVOKED).
   */
  updateStatus(id, newStatus, extra = {}) {
    const db = getDatabase();
    const now = new Date().toISOString();

    let extraClause = '';
    const params = [newStatus];

    if (newStatus === 'CANCELLED') {
      extraClause += ', cancelled_at = ?';
      params.push(now);
    } else if (newStatus === 'COMPLETED') {
      extraClause += ', completed_at = ?';
      params.push(now);
    } else if (newStatus === 'REVOKED') {
      extraClause += ', revoked_at = ?';
      params.push(now);
    }

    params.push(id);

    const stmt = db.prepare(`
      UPDATE capture_sessions
      SET status = ? ${extraClause}
      WHERE id = ?;
    `);

    stmt.run(...params);
    return this.getSessionById(id);
  }

  /**
   * Checks whether a session has expired based on current server time.
   * If expired, transitions state in DB to EXPIRED.
   * @private
   */
  _checkAndApplyExpiration(session) {
    if (!session) return null;

    const activeStates = ['CREATED', 'PAIRING', 'PAIRED', 'ACTIVE'];
    if (activeStates.includes(session.status)) {
      const expiresTime = new Date(session.expiresAt).getTime();
      if (Date.now() > expiresTime) {
        const db = getDatabase();
        db.prepare(`
          UPDATE capture_sessions
          SET status = 'EXPIRED'
          WHERE id = ?;
        `).run(session.id);
        session.status = 'EXPIRED';
      }
    }

    return session;
  }

  /**
   * Registers a single-use upload capability for a paired session.
   */
  createUploadCapability({ sessionId, tenantId, tokenHash, expiresAt }) {
    const db = getDatabase();
    const crypto = require('crypto');
    const id = `cap-upl-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO capture_upload_capabilities (
        id, tenant_id, session_id, token_hash, consumed, created_at, expires_at
      ) VALUES (?, ?, ?, ?, 0, ?, ?);
    `).run(id, tenantId, sessionId, tokenHash, now, expiresAt);

    return { id, sessionId, tenantId, tokenHash, expiresAt };
  }

  /**
   * Retrieves an upload capability by session ID and token hash, validating single-use and expiry.
   */
  getUploadCapability(sessionId, tokenHash) {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM capture_upload_capabilities
      WHERE session_id = ? AND token_hash = ?;
    `).get(sessionId, tokenHash);

    if (!row) return null;

    const isExpired = new Date(row.expires_at).getTime() < Date.now();
    return {
      id: row.id,
      sessionId: row.session_id,
      tenantId: row.tenant_id,
      tokenHash: row.token_hash,
      consumed: Boolean(row.consumed),
      isExpired,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    };
  }

  /**
   * Atomically consumes an upload capability to guarantee single-use.
   */
  consumeUploadCapability(id) {
    const db = getDatabase();
    const result = db.prepare(`
      UPDATE capture_upload_capabilities
      SET consumed = 1
      WHERE id = ? AND consumed = 0;
    `).run(id);

    return result.changes > 0;
  }

  /**
   * Records captured media asset metadata.
   */
  recordMedia({
    id,
    tenantId,
    sessionId,
    patientId,
    encounterId = null,
    storageKey,
    mimeType,
    fileSize,
    sha256,
    width = null,
    height = null,
    fhirMediaId = null,
    fhirProvenanceId = null,
    capturedAt = new Date().toISOString()
  }) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO capture_media (
        id, tenant_id, session_id, patient_id, encounter_id,
        storage_key, mime_type, file_size, sha256, width, height,
        fhir_media_id, fhir_provenance_id, captured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `).run(
      id, tenantId, sessionId, patientId, encounterId,
      storageKey, mimeType, fileSize, sha256, width, height,
      fhirMediaId, fhirProvenanceId, capturedAt
    );

    return this.getMediaById(id, tenantId);
  }

  getMediaById(mediaId, tenantId = null) {
    const db = getDatabase();
    if (tenantId) {
      const row = db.prepare(`
        SELECT * FROM capture_media
        WHERE (id = ? OR fhir_media_id = ?) AND tenant_id = ?;
      `).get(mediaId, mediaId, tenantId);

      if (!row) return null;
      return this._formatMediaRow(row);
    }

    const row = db.prepare(`
      SELECT * FROM capture_media
      WHERE id = ? OR fhir_media_id = ?;
    `).get(mediaId, mediaId);

    if (!row) return null;
    return this._formatMediaRow(row);
  }

  recordVisionAnalysis({
    id,
    tenantId = 'org-default',
    mediaId,
    sessionId = null,
    patientId,
    encounterId = null,
    provider,
    model,
    status = 'COMPLETED',
    confidence = null,
    findings,
    fhirObservationId = null,
    fhirProvenanceId = null,
    createdAt = new Date().toISOString(),
    completedAt = null,
    errorCode = null,
    errorMessage = null
  }) {
    const db = getDatabase();
    const findingsJson = typeof findings === 'string' ? findings : JSON.stringify(findings || {});

    const stmt = db.prepare(`
      INSERT INTO vision_analyses (
        id, tenant_id, media_id, session_id, patient_id, encounter_id,
        provider, model, status, confidence, findings_json,
        fhir_observation_id, fhir_provenance_id, created_at, completed_at,
        error_code, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    stmt.run(
      id, tenantId, mediaId, sessionId, patientId, encounterId,
      provider, model, status, confidence, findingsJson,
      fhirObservationId, fhirProvenanceId, createdAt, completedAt,
      errorCode, errorMessage
    );

    return this.getVisionAnalysis(id, tenantId);
  }

  getVisionAnalysis(id, tenantId = null) {
    const db = getDatabase();
    if (tenantId) {
      const row = db.prepare(`
        SELECT * FROM vision_analyses
        WHERE id = ? AND tenant_id = ?;
      `).get(id, tenantId);
      if (!row) return null;
      return this._formatVisionRow(row);
    }
    const row = db.prepare(`
      SELECT * FROM vision_analyses
      WHERE id = ?;
    `).get(id);
    if (!row) return null;
    return this._formatVisionRow(row);
  }

  getVisionAnalysesForMedia(mediaId, tenantId) {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM vision_analyses
      WHERE media_id = ? AND tenant_id = ?
      ORDER BY created_at DESC;
    `).all(mediaId, tenantId);
    return rows.map(r => this._formatVisionRow(r));
  }

  _formatVisionRow(row) {
    let findings = {};
    try {
      findings = JSON.parse(row.findings_json || '{}');
    } catch {}

    return {
      id: row.id,
      tenantId: row.tenant_id,
      mediaId: row.media_id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      encounterId: row.encounter_id,
      provider: row.provider,
      model: row.model,
      status: row.status,
      confidence: row.confidence,
      findings,
      fhirObservationId: row.fhir_observation_id,
      fhirProvenanceId: row.fhir_provenance_id,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      errorCode: row.error_code,
      errorMessage: row.error_message
    };
  }

  recordVisionReview({
    id,
    tenantId = 'org-default',
    analysisId,
    mediaId,
    patientId,
    encounterId = null,
    actorId,
    actorRole,
    actorName,
    action,
    findingIndex,
    originalFinding,
    clinicianModification = null,
    clinicianNotes = null,
    fhirConditionId = null,
    fhirObservationId = null,
    fhirProvenanceId = null,
    reviewedAt = new Date().toISOString()
  }) {
    const db = getDatabase();
    const origJson = typeof originalFinding === 'string' ? originalFinding : JSON.stringify(originalFinding || {});
    const modJson = clinicianModification ? (typeof clinicianModification === 'string' ? clinicianModification : JSON.stringify(clinicianModification)) : null;

    const stmt = db.prepare(`
      INSERT INTO clinical_vision_reviews (
        id, tenant_id, analysis_id, media_id, patient_id, encounter_id,
        actor_id, actor_role, actor_name, action, finding_index,
        original_finding_json, clinician_modification_json, clinician_notes,
        fhir_condition_id, fhir_observation_id, fhir_provenance_id, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(analysis_id, finding_index) DO UPDATE SET
        action = excluded.action,
        clinician_modification_json = excluded.clinician_modification_json,
        clinician_notes = excluded.clinician_notes,
        fhir_condition_id = COALESCE(excluded.fhir_condition_id, clinical_vision_reviews.fhir_condition_id),
        fhir_observation_id = COALESCE(excluded.fhir_observation_id, clinical_vision_reviews.fhir_observation_id),
        fhir_provenance_id = COALESCE(excluded.fhir_provenance_id, clinical_vision_reviews.fhir_provenance_id),
        reviewed_at = excluded.reviewed_at;
    `);

    stmt.run(
      id, tenantId, analysisId, mediaId, patientId, encounterId,
      actorId, actorRole, actorName, action, findingIndex,
      origJson, modJson, clinicianNotes,
      fhirConditionId, fhirObservationId, fhirProvenanceId, reviewedAt
    );

    return this.getVisionReviewForFinding(analysisId, findingIndex, tenantId);
  }

  getVisionReviewById(id, tenantId = null) {
    const db = getDatabase();
    if (tenantId) {
      const row = db.prepare(`
        SELECT * FROM clinical_vision_reviews
        WHERE id = ? AND tenant_id = ?;
      `).get(id, tenantId);
      if (!row) return null;
      return this._formatReviewRow(row);
    }
    const row = db.prepare(`
      SELECT * FROM clinical_vision_reviews
      WHERE id = ?;
    `).get(id);
    if (!row) return null;
    return this._formatReviewRow(row);
  }

  getVisionReviewForFinding(analysisId, findingIndex, tenantId = null) {
    const db = getDatabase();
    if (tenantId) {
      const row = db.prepare(`
        SELECT * FROM clinical_vision_reviews
        WHERE analysis_id = ? AND finding_index = ? AND tenant_id = ?;
      `).get(analysisId, findingIndex, tenantId);
      if (!row) return null;
      return this._formatReviewRow(row);
    }
    const row = db.prepare(`
      SELECT * FROM clinical_vision_reviews
      WHERE analysis_id = ? AND finding_index = ?;
    `).get(analysisId, findingIndex);
    if (!row) return null;
    return this._formatReviewRow(row);
  }

  getVisionReviewsForAnalysis(analysisId, tenantId) {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM clinical_vision_reviews
      WHERE analysis_id = ? AND tenant_id = ?
      ORDER BY reviewed_at ASC;
    `).all(analysisId, tenantId);
    return rows.map(r => this._formatReviewRow(r));
  }

  _formatReviewRow(row) {
    let originalFinding = {};
    try { originalFinding = JSON.parse(row.original_finding_json || '{}'); } catch {}

    let clinicianModification = null;
    if (row.clinician_modification_json) {
      try { clinicianModification = JSON.parse(row.clinician_modification_json); } catch {}
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      analysisId: row.analysis_id,
      mediaId: row.media_id,
      patientId: row.patient_id,
      encounterId: row.encounter_id,
      actorId: row.actor_id,
      actorRole: row.actor_role,
      actorName: row.actor_name,
      action: row.action,
      findingIndex: row.finding_index,
      originalFinding,
      clinicianModification,
      clinicianNotes: row.clinician_notes,
      fhirConditionId: row.fhir_condition_id,
      fhirObservationId: row.fhir_observation_id,
      fhirProvenanceId: row.fhir_provenance_id,
      reviewedAt: row.reviewed_at
    };
  }

  getMediaForSession(sessionId, tenantId) {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM capture_media
      WHERE session_id = ? AND tenant_id = ?
      ORDER BY captured_at ASC;
    `).all(sessionId, tenantId);

    return rows.map(r => this._formatMediaRow(r));
  }

  _formatMediaRow(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      encounterId: row.encounter_id,
      storageKey: row.storage_key,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      sha256: row.sha256,
      width: row.width,
      height: row.height,
      fhirMediaId: row.fhir_media_id,
      fhirProvenanceId: row.fhir_provenance_id,
      capturedAt: row.captured_at
    };
  }

  /**
   * Formats a raw database row into a structured session object.
   * @private
   */
  _formatRow(row) {
    let metadata = {};
    try {
      metadata = JSON.parse(row.metadata_json || '{}');
    } catch {}

    return {
      id: row.id,
      sessionId: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      actorRole: row.actor_role,
      actorName: row.actor_name,
      patientId: row.patient_id,
      encounterId: row.encounter_id,
      status: row.status,
      pairingTokenHash: row.pairing_token_hash,
      pairingTokenConsumed: Boolean(row.pairing_token_consumed),
      mobileTokenHash: row.mobile_token_hash,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      pairedAt: row.paired_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      revokedAt: row.revoked_at,
      metadata
    };
  }
}

const sessionStore = new SessionStore();

module.exports = {
  SessionStore,
  sessionStore
};
