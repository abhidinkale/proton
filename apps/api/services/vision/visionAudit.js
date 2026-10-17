/**
 * Proton Clinical Vision Audit Service (V2 M2C-1)
 * 
 * Cryptographic, tamper-evident audit logging for clinical vision AI.
 * 
 * Guarantees:
 * - Immutable SHA-256 chain tracking
 * - Explicit patient/encounter/media provenance
 * - ZERO LEAKAGE: Never logs raw image bytes, binary base64 buffers,
 *   API keys, or authorization tokens.
 */

const { auditService } = require('../audit/auditService');

class VisionAudit {
  /**
   * Records initiation of an image intelligence evaluation.
   */
  recordAnalysisStarted({
    mediaId,
    patientId,
    encounterId = null,
    tenantId = 'org-default',
    actor,
    provider = 'unknown',
    model = 'unknown'
  }) {
    return auditService.recordPipelineStage({
      stage: 'VISION_ANALYSIS_STARTED',
      patientId,
      actorId: actor?.actorId || 'system',
      actorRole: actor?.actorRole || actor?.role || 'physician',
      actorName: actor?.actorName || 'Clinician',
      status: 'IN_PROGRESS',
      summary: `Clinical image analysis started for media ${mediaId} via [${provider}/${model}] (Encounter: ${encounterId || 'none'})`,
      resultingState: 'PENDING_ANALYSIS',
      tenantId
    });
  }

  /**
   * Records successful completion and safety clearance of an image intelligence evaluation.
   */
  recordAnalysisSuccess({
    mediaId,
    patientId,
    encounterId = null,
    tenantId = 'org-default',
    actor,
    provider,
    model,
    observationId,
    findingsCount = 0,
    differentialCount = 0,
    confidence = null,
    latencyMs = 0
  }) {
    const confStr = confidence !== null && confidence !== undefined ? ` (Confidence: ${(confidence * 100).toFixed(1)}%)` : '';
    return auditService.recordPipelineStage({
      stage: 'VISION_ANALYSIS_COMPLETED',
      patientId,
      actorId: actor?.actorId || 'system',
      actorRole: actor?.actorRole || actor?.role || 'physician',
      actorName: actor?.actorName || 'Clinician',
      status: 'SUCCESS',
      summary: `Image analysis succeeded for media ${mediaId} via [${provider}/${model}] -> Generated preliminary Observation ${observationId} with ${findingsCount} findings, ${differentialCount} differentials${confStr} in ${latencyMs}ms. Decision support only.`,
      resultingState: 'PRELIMINARY_DECISION_SUPPORT',
      tenantId
    });
  }

  /**
   * Records failure or rejection of an image intelligence evaluation.
   */
  recordAnalysisFailure({
    mediaId,
    patientId = 'unknown',
    encounterId = null,
    tenantId = 'org-default',
    actor,
    provider = 'unknown',
    model = 'unknown',
    stage = 'VALIDATION',
    errorCode = 'VISION_ERROR',
    errorMessage = 'Vision analysis failed'
  }) {
    return auditService.recordPipelineStage({
      stage: `VISION_ANALYSIS_FAILED_${stage.toUpperCase()}`,
      patientId,
      actorId: actor?.actorId || 'system',
      actorRole: actor?.actorRole || actor?.role || 'physician',
      actorName: actor?.actorName || 'Clinician',
      status: 'FAILED',
      summary: `Vision analysis rejected for media ${mediaId} during ${stage} [${errorCode}]: ${errorMessage.substring(0, 200)} [${provider}/${model}]`,
      resultingState: 'REJECTED',
      tenantId
    });
  }
}

const visionAudit = new VisionAudit();

module.exports = {
  VisionAudit,
  visionAudit
};
