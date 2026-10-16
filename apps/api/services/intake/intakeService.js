/**
 * Proton Clinical Intake Service Hub
 * Orchestrates questionnaire retrieval, dynamic branching, response validation,
 * deterministic escalation, context mapping, FHIR persistence, and audit logging.
 */

const { getQuestionnaire, listQuestionnaires } = require('./questionnaireCatalog');
const { branchingEngine } = require('./branchingEngine');
const { responseValidator, IntakeValidationError } = require('./responseValidator');
const { escalationEngine } = require('./escalationEngine');
const { contextMapper } = require('./contextMapper');
const { fhirService } = require('../fhir/fhirService');
const { auditService } = require('../audit/auditService');

class IntakeService {
  /**
   * Lists all available clinical intake questionnaires.
   */
  listQuestionnaires() {
    return listQuestionnaires();
  }

  /**
   * Retrieves a specific questionnaire by ID.
   */
  getQuestionnaire(id) {
    const q = getQuestionnaire(id);
    if (!q) {
      const err = new Error(`Questionnaire not found: ${id}`);
      err.code = 'QUESTIONNAIRE_NOT_FOUND';
      err.status = 404;
      throw err;
    }
    return q;
  }

  /**
   * Evaluates dynamic branching for a questionnaire given current answers.
   */
  evaluateBranching(questionnaireId, answers = {}) {
    const q = this.getQuestionnaire(questionnaireId);
    const activeQuestions = branchingEngine.getActiveQuestions(q, answers);
    return {
      questionnaireId: q.id,
      totalQuestions: q.item.length,
      activeQuestionCount: activeQuestions.length,
      activeQuestions
    };
  }

  /**
   * Alias/convenience method for processing an intake submission.
   */
  async processSubmission({ questionnaireId, patientId, items, answers, actor = null, tenantId = 'org-default', patientContext = null }) {
    return this.submitResponse({
      questionnaireId,
      submission: {
        patientId,
        items,
        answers,
        patientContext
      },
      actor,
      tenantId
    });
  }

  /**
   * Validates, processes, escalates, and persists an intake response.
   * @param {Object} params
   * @param {string} params.questionnaireId - Target Questionnaire ID
   * @param {Object} params.submission - Raw patient submission payload
   * @param {Object} [params.actor] - Authenticated actor context
   * @param {string} [params.tenantId] - Organization tenant
   * @returns {Promise<Object>}
   */
  async submitResponse({ questionnaireId, submission, actor = null, tenantId = 'org-default' }) {
    const q = this.getQuestionnaire(questionnaireId);

    // Merge actor and tenant into submission
    const mergedSubmission = {
      ...submission,
      actor: actor || submission.actor,
      tenantId: actor?.tenantId || tenantId || submission.tenantId || 'org-default'
    };

    // 1. Strict schema & patient validation
    const validationResult = responseValidator.validateSubmission(q, mergedSubmission);
    const qr = validationResult.questionnaireResponse;
    const patientId = validationResult.patientId;
    const effectiveTenant = validationResult.tenantId;

    // 2. Deterministic red flag / escalation check (pre-AI reasoning)
    const escalationReport = escalationEngine.evaluateEscalation(
      q.id,
      validationResult.sanitizedAnswersMap
    );

    // 3. Map to structured patient-reported clinical context and FHIR Provenance
    const mappedContext = contextMapper.mapToClinicalContext(
      q,
      qr,
      escalationReport
    );

    // 4. Atomic FHIR Persistence: Persist QuestionnaireResponse, Survey Observation, and Provenance
    const bundle = fhirService.createTransactionBundle([
      { resource: qr, method: 'PUT', url: `QuestionnaireResponse/${qr.id}` },
      { resource: mappedContext.surveyObservation, method: 'POST', url: 'Observation' },
      { resource: mappedContext.provenance, method: 'POST', url: 'Provenance' }
    ]);

    let fhirPersistResult = null;
    try {
      fhirPersistResult = await fhirService.executeTransaction(bundle);
    } catch (persistErr) {
      // Record failure audit
      auditService.recordPipelineStage({
        stage: 'INTAKE_FHIR_PERSIST_FAILED',
        patientId,
        actorId: actor?.actorId || `Patient/${patientId}`,
        actorRole: actor?.actorRole || 'patient',
        status: 'FAILED',
        summary: `Failed to persist QuestionnaireResponse ${qr.id}: ${persistErr.message}`,
        resultingState: 'PERSISTENCE_ERROR',
        tenantId: effectiveTenant
      });

      const err = new Error(`Failed to commit QuestionnaireResponse to FHIR: ${persistErr.message}`);
      err.code = 'FHIR_INTAKE_COMMIT_FAILED';
      err.status = 500;
      throw err;
    }

    // 5. Immutable Cryptographic Audit Log
    const auditRecord = auditService.recordPipelineStage({
      stage: 'INTAKE_SUBMISSION_COMPLETED',
      patientId,
      actorId: actor?.actorId || `Patient/${patientId}`,
      actorRole: actor?.actorRole || 'patient',
      status: 'SUCCESS',
      summary: `Completed intake for ${q.title} (${qr.id}). Escalation level: ${escalationReport.escalationLevel}`,
      resultingState: escalationReport.requiresEscalation ? 'ESCALATION_TRIGGERED' : 'INTAKE_RECORDED',
      tenantId: effectiveTenant
    });

    return {
      success: true,
      questionnaireResponseId: qr.id,
      patientId,
      questionnaireId: q.id,
      questionnaireTitle: q.title,
      questionnaireResponse: qr,
      observation: mappedContext.surveyObservation,
      provenance: mappedContext.provenance,
      intakeContext: mappedContext,
      clinicalContext: mappedContext,
      escalation: escalationReport,
      auditRecord,
      auditProvenance: {
        auditId: auditRecord.eventId || auditRecord.id,
        currentHash: auditRecord.currentHash,
        fhirProvenanceId: mappedContext.provenance.id,
        timestamp: new Date().toISOString()
      },
      fhirTransaction: fhirPersistResult
    };
  }

  /**
   * Retrieves a QuestionnaireResponse by ID from the FHIR persistence adapter.
   */
  async getResponse(responseId, tenantId = 'org-default', actor = null) {
    const cleanId = String(responseId).replace(/^QuestionnaireResponse\//, '').trim();
    const qr = await fhirService.adapter.getResource('QuestionnaireResponse', cleanId);
    if (!qr) {
      const err = new Error(`QuestionnaireResponse not found: ${cleanId}`);
      err.code = 'RESPONSE_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    // 1. Cross-Tenant Isolation
    if (tenantId && qr.meta?.tag) {
      const qrTenant = qr.meta.tag.find(t => t.system === 'https://proton.health/tenant')?.code;
      if (qrTenant && qrTenant !== tenantId) {
        const err = new Error(`Access Denied: Response belongs to organization '${qrTenant}', cannot access from '${tenantId}'.`);
        err.code = 'CROSS_TENANT_ACCESS_DENIED';
        err.status = 403;
        throw err;
      }
    }

    // 2. Patient Identity Isolation: Patient actors can only access their own responses
    if (actor) {
      const actorRole = actor.actorRole || actor.role;
      if (actorRole === 'patient') {
        const actorPatientId = String(actor.actorId || actor.patientId || '').replace(/^Patient\//, '').trim();
        const qrPatientId = String(qr.subject?.reference || '').replace(/^Patient\//, '').trim();
        if (actorPatientId && qrPatientId && actorPatientId !== qrPatientId) {
          const err = new Error(`Access Denied: Patient '${actorPatientId}' is not authorized to access intake response for '${qrPatientId}'.`);
          err.code = 'CROSS_PATIENT_ACCESS_DENIED';
          err.status = 403;
          throw err;
        }
      }
    }

    return qr;
  }
}

const intakeService = new IntakeService();

module.exports = {
  IntakeService,
  intakeService,
  IntakeValidationError
};
