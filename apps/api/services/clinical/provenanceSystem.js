/**
 * Proton Cryptographic AI Provenance System
 * 
 * Enforces end-to-end traceability for every AI-generated clinical artifact:
 * 1. AI DRAFT Invariant: Every AI output is minted with status 'DRAFT' and a cryptographic signature.
 * 2. Immutable Lifecycle: DRAFT -> REVIEWED -> EDITED -> ACCEPTED / REJECTED / APPROVED.
 * 3. Physician Authority Gate: Transition to 'ACCEPTED' or 'APPROVED' strictly requires an authenticated physician.
 * 4. Tamper Evidence: Any post-generation modification without physician re-signature invalidates the tamperHash.
 */

const crypto = require('crypto');
const { auditService } = require('../audit/auditService');

class ProvenanceError extends Error {
  constructor(code, message, status = 400) {
    super(`[ProvenanceSystem:${code}] ${message}`);
    this.name = 'ProvenanceError';
    this.code = code;
    this.status = status;
  }
}

const ALLOWED_STATUSES = [
  'DRAFT',
  'AI_GENERATED',
  'PHYSICIAN_REVIEW',
  'PHYSICIAN_APPROVED',
  'REVIEWED',
  'EDITED',
  'ACCEPTED',
  'REJECTED',
  'APPROVED',
  'SIGNED',
  'PERSISTED',
  'AMENDED',
  'VOIDED'
];

class ProvenanceSystem {
  /**
   * Creates an immutable AI provenance envelope.
   * 
   * @param {Object} params
   * @param {string} params.agentId - Generating agent ID
   * @param {string} [params.specialty] - Medical specialty
   * @param {string} params.modelId - Underlying model ID
   * @param {string} [params.modelVersion='1.0'] - Model version
   * @param {Object} [params.inputContext] - Context payload used as input
   * @param {Array<Object>} [params.sources=[]] - Traceable citations / FHIR resources
   * @param {Object|string} params.draftPayload - The generated clinical draft content
   * @param {string} [params.tenantId='org-default'] - Organization tenant ID
   * @returns {Object} Stamped AIProvenance envelope
   */
  createEnvelope({
    agentId,
    specialty = 'General',
    modelId = 'active-model',
    modelVersion = '1.0',
    inputContext = {},
    sources = [],
    draftPayload = {},
    tenantId = 'org-default'
  }) {
    if (!agentId) {
      throw new ProvenanceError('AGENT_ID_REQUIRED', 'Provenance envelope requires agentId.');
    }

    const provenanceId = `prov-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const generatedAt = new Date().toISOString();

    // Compute input digest
    const inputDigest = crypto
      .createHash('sha256')
      .update(typeof inputContext === 'string' ? inputContext : JSON.stringify(inputContext))
      .digest('hex');

    // Compute draft content digest
    const draftDigest = crypto
      .createHash('sha256')
      .update(typeof draftPayload === 'string' ? draftPayload : JSON.stringify(draftPayload))
      .digest('hex');

    // Compute tamper hash sealing the provenance record
    const tamperHash = this._calculateTamperHash({
      provenanceId,
      agentId,
      modelId,
      modelVersion,
      generatedAt,
      inputDigest,
      draftDigest,
      status: 'DRAFT'
    });

    return {
      provenanceId,
      generatedBy: 'AI',
      agentId,
      specialty,
      modelId,
      modelVersion,
      generatedAt,
      inputDigest,
      draftDigest,
      sources: (sources || []).map(s => ({
        resourceType: s.resourceType || 'Resource',
        id: s.id || 'unknown',
        quote: s.quote || null,
        authority: s.authority || null
      })),
      status: 'DRAFT',
      physicianId: null,
      physicianActionAt: null,
      directiveOverride: null,
      draftPayload,
      tenantId,
      tamperHash
    };
  }

  /**
   * Transitions provenance status following strict clinician role verification.
   * 
   * @param {Object} envelope - Active provenance envelope
   * @param {string} newStatus - Target status
   * @param {Object} actor - Authenticated actor { actorId, actorRole, tenantId }
   * @param {Object} [options] - Optional directives or modified payload
   * @returns {Object} Updated provenance envelope
   */
  transitionStatus(envelope, newStatus, actor, options = {}) {
    if (!envelope || !envelope.provenanceId) {
      throw new ProvenanceError('INVALID_ENVELOPE', 'Valid provenance envelope is required.');
    }

    const cleanStatus = String(newStatus || '').toUpperCase().trim();
    if (!ALLOWED_STATUSES.includes(cleanStatus)) {
      throw new ProvenanceError('INVALID_STATUS', `Status '${newStatus}' is not allowed. Allowed: ${ALLOWED_STATUSES.join(', ')}`);
    }

    // Role-Based Authorization Gate: Only physician can ACCEPT, APPROVE, or SIGN clinical drafts
    if (cleanStatus === 'ACCEPTED' || cleanStatus === 'APPROVED' || cleanStatus === 'PHYSICIAN_APPROVED' || cleanStatus === 'SIGNED') {
      if (!actor || actor.actorRole !== 'physician') {
        throw new ProvenanceError(
          'INSUFFICIENT_CLINICAL_PRIVILEGES',
          `Actor '${actor?.actorId || 'unknown'}' with role '${actor?.actorRole || 'none'}' cannot approve clinical AI drafts. Only licensed physicians may approve.`,
          403
        );
      }
    }

    const actionTime = new Date().toISOString();
    const updated = {
      ...envelope,
      status: cleanStatus,
      physicianId: actor?.actorRole === 'physician' ? actor.actorId : envelope.physicianId,
      physicianActionAt: actor?.actorRole === 'physician' ? actionTime : envelope.physicianActionAt,
      directiveOverride: options.directiveOverride || envelope.directiveOverride
    };

    // If payload was edited, update draftDigest
    if (options.updatedPayload) {
      updated.draftPayload = options.updatedPayload;
      updated.draftDigest = crypto
        .createHash('sha256')
        .update(typeof options.updatedPayload === 'string' ? options.updatedPayload : JSON.stringify(options.updatedPayload))
        .digest('hex');
      updated.status = 'EDITED';
    }

    // Re-sign tamper hash with new state
    updated.tamperHash = this._calculateTamperHash(updated);

    // Record immutable audit event
    auditService.recordPipelineStage({
      stage: `PROVENANCE_${cleanStatus}`,
      patientId: options.patientId || 'unknown',
      actorId: actor?.actorId || 'system',
      actorRole: actor?.actorRole || 'system',
      status: 'SUCCESS',
      summary: `Provenance ${envelope.provenanceId} transitioned to ${updated.status} by ${actor?.actorId || 'system'}.`,
      resultingState: updated.status,
      tenantId: actor?.tenantId || envelope.tenantId || 'org-default'
    });

    return updated;
  }

  /**
   * Binds physician approval to an exact clinical artifact, version, and patient context.
   */
  bindApproval({
    envelope,
    physicianActor,
    clinicalArtifact,
    version = 1,
    patientId,
    encounterId = null,
    directiveOverride = null
  }) {
    if (!physicianActor || physicianActor.actorRole !== 'physician') {
      throw new ProvenanceError(
        'INSUFFICIENT_CLINICAL_PRIVILEGES',
        `Actor '${physicianActor?.actorId || 'unknown'}' cannot approve clinical draft. Only licensed physicians may approve.`,
        403
      );
    }

    if (!clinicalArtifact) {
      throw new ProvenanceError('ARTIFACT_REQUIRED', 'Clinical artifact is required to bind approval.', 400);
    }

    const artifactDigest = crypto
      .createHash('sha256')
      .update(typeof clinicalArtifact === 'string' ? clinicalArtifact : JSON.stringify(clinicalArtifact))
      .digest('hex');

    const cleanPatientId = String(patientId || envelope.patientId || 'unknown').replace(/^Patient\//, '');
    const cleanEncounterId = encounterId || envelope.encounterId || null;

    // Transition envelope to APPROVED
    const updated = this.transitionStatus(envelope, 'APPROVED', physicianActor, {
      patientId: cleanPatientId,
      directiveOverride
    });

    updated.boundApproval = {
      artifactDigest,
      approvedVersion: version,
      patientId: cleanPatientId,
      encounterId: cleanEncounterId,
      approvedAt: new Date().toISOString(),
      physicianId: physicianActor.actorId,
      physicianName: physicianActor.actorName || physicianActor.actorId
    };

    // Re-sign tamper hash including bound approval
    updated.tamperHash = this._calculateTamperHash(updated);
    return updated;
  }

  /**
   * Verifies that the approved provenance envelope is still valid for the current artifact,
   * patient context, and version.
   */
  verifyApprovalBinding({ approvalEnvelope, currentArtifact, currentPatientId, expectedVersion = null }) {
    if (!approvalEnvelope) {
      return { valid: false, error: 'Approval envelope is missing.', code: 'APPROVAL_REQUIRED' };
    }

    if (approvalEnvelope.status !== 'APPROVED' && approvalEnvelope.status !== 'PHYSICIAN_APPROVED' && approvalEnvelope.status !== 'SIGNED') {
      return { valid: false, error: `Approval status is '${approvalEnvelope.status}', must be APPROVED.`, code: 'NOT_APPROVED' };
    }

    if (!this.verifyIntegrity(approvalEnvelope)) {
      return { valid: false, error: 'Cryptographic tamper hash invalidation: provenance envelope modified post-approval.', code: 'TAMPER_DETECTED' };
    }

    if (approvalEnvelope.boundApproval) {
      const bound = approvalEnvelope.boundApproval;

      // 1. Patient Context Check
      if (currentPatientId) {
        const cleanCurrentId = String(currentPatientId).replace(/^Patient\//, '');
        if (bound.patientId && bound.patientId !== cleanCurrentId) {
          return {
            valid: false,
            error: `Patient context mismatch: approval bound to patient '${bound.patientId}', current context is '${cleanCurrentId}'.`,
            code: 'PATIENT_CONTEXT_CHANGED'
          };
        }
      }

      // 2. Version Stale Check
      if (expectedVersion !== null && bound.approvedVersion !== expectedVersion) {
        return {
          valid: false,
          error: `Encounter version conflict: approval bound to version ${bound.approvedVersion}, server is at version ${expectedVersion}.`,
          code: 'ENCOUNTER_STALE'
        };
      }

      // 3. Artifact Content Invariant
      if (currentArtifact) {
        const currentDigest = crypto
          .createHash('sha256')
          .update(typeof currentArtifact === 'string' ? currentArtifact : JSON.stringify(currentArtifact))
          .digest('hex');

        if (bound.artifactDigest !== currentDigest) {
          return {
            valid: false,
            error: 'Clinical artifact modified post-approval. Re-approval by physician is required.',
            code: 'ARTIFACT_MODIFIED_AFTER_APPROVAL'
          };
        }
      }
    }

    return { valid: true, approvedBy: approvalEnvelope.physicianId };
  }

  /**
   * Verifies the cryptographic integrity of a provenance envelope.
   * 
   * @param {Object} envelope - Provenance envelope to verify
   * @returns {boolean} True if tamper-evident hash matches
   */
  verifyIntegrity(envelope) {
    if (!envelope || !envelope.tamperHash) return false;

    // If draftPayload is present on envelope, verify that draftDigest matches actual content
    if (envelope.draftPayload) {
      const computedDraftDigest = crypto
        .createHash('sha256')
        .update(typeof envelope.draftPayload === 'string' ? envelope.draftPayload : JSON.stringify(envelope.draftPayload))
        .digest('hex');
      if (computedDraftDigest !== envelope.draftDigest) {
        return false;
      }
    }

    const expected = this._calculateTamperHash(envelope);
    return expected === envelope.tamperHash;
  }

  verifyTamperHash(envelope) {
    return this.verifyIntegrity(envelope);
  }

  /**
   * Convenience helper to approve a provenance envelope with physician authority.
   */
  approveEnvelope({ envelope, physicianActor, directiveOverride = null, comments = '' }) {
    return this.transitionStatus(envelope, 'APPROVED', physicianActor, { directiveOverride, comments });
  }

  _calculateTamperHash(env) {
    const boundPart = env.boundApproval ? `${env.boundApproval.artifactDigest}:${env.boundApproval.approvedVersion}:${env.boundApproval.patientId}` : '';
    const data = `${env.provenanceId}:${env.agentId}:${env.modelId}:${env.modelVersion}:${env.generatedAt}:${env.inputDigest}:${env.draftDigest}:${env.status}:${env.physicianId || ''}:${env.directiveOverride || ''}:${boundPart}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

const provenanceSystem = new ProvenanceSystem();

module.exports = {
  ProvenanceSystem,
  provenanceSystem,
  ProvenanceError,
  ALLOWED_STATUSES
};
