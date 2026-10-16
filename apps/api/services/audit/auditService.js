/**
 * Proton Audit Service
 * Cryptographic audit logging with tamper-evident SHA-256 chaining.
 */

const auditRepository = require('../../storage/auditRepository');

class AuditService {
  /**
   * Record a stage in the clinical pipeline.
   */
  recordPipelineStage({
    stage,
    patientId,
    actorId = 'system',
    actorRole = 'clinical_pipeline',
    actorName = 'Proton Clinical Engine',
    status = 'SUCCESS',
    summary,
    resultingState = null,
    physicianDirective = null,
    tenantId = 'org-default'
  }) {
    try {
      return auditRepository.recordAuditEvent({
        action: `CLINICAL_PIPELINE_${stage.toUpperCase()}`,
        actorId,
        actorRole,
        actorName,
        patientId,
        summary: summary || `Executed pipeline stage: ${stage} (${status})`,
        resultingState: resultingState || status,
        physicianDirective,
        tenantId
      });
    } catch (err) {
      console.error('[AuditService] Failed to persist audit event:', err.message);
      // Return a non-blocking envelope so pipeline can handle or record error
      return {
        success: false,
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Validates the cryptographic integrity of the audit chain for a tenant.
   * @param {string} tenantId
   * @returns {{ valid: boolean, chainLength: number, brokenAt?: number }}
   */
  verifyChain(tenantId = 'org-default') {
    return auditRepository.verifyAuditChain(tenantId);
  }

  /**
   * Queries audit events for a tenant.
   */
  getEvents(tenantId = 'org-default', limit = 50) {
    return auditRepository.listAuditEvents({ tenantId, limit });
  }

  /**
   * Queries audit events for a patient.
   */
  getEventsForPatient(patientId, tenantId = 'org-default', limit = 50) {
    const events = auditRepository.listAuditEvents({ tenantId, limit: 500 });
    return events.filter(e => e.patientId === patientId).slice(0, limit);
  }
}

const auditService = new AuditService();

module.exports = {
  AuditService,
  auditService
};
