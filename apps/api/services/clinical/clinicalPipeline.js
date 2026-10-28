/**
 * Proton Canonical Clinical Pipeline
 *
 * Enforces the canonical 8-stage clinical execution flow with strict physician authority,
 * patient isolation, deterministic safety gates, and tamper-evident audit provenance:
 *
 * 1. INPUT           - Raw patient/encounter data, audio streams, or typed dialogue
 * 2. VALIDATION      - Strict payload validation, format checks, patient ID matching, actor checks
 * 3. CLINICAL CONTEXT- Strictly patient-bound retrieval of FHIR records (Conditions, Meds, Allergies)
 * 4. AI ANALYSIS     - LLM synthesis, schema validation, zero silent mock fallbacks
 * 5. SAFETY CHECK    - Deterministic drug-allergy, DDI, and dosage boundary verification
 * 6. CLINICAL OUTPUT - Canonical structured clinical note (SOAP) and safety-verified draft
 * 7. FHIR TRANSACTION- Atomic Medplum R4 Bundle commit (Encounter, ClinicalImpression, Condition, Meds, Provenance)
 * 8. AUDIT/PROVENANCE- Cryptographic SHA-256 tamper-evident provenance log entry (success & failure)
 */

const { mediaService, TranscriptionInputError } = require('../media/mediaService');
const { aiService } = require('../ai/aiService');
const { safetyService } = require('../safety/safetyService');
const { fhirService } = require('../fhir/fhirService');
const { auditService } = require('../audit/auditService');
const { multimodalContextService } = require('./multimodalContextService');
const { evidenceService } = require('../evidence/evidenceService');
const { clinicalContextEngine } = require('./clinicalContextEngine');
const { safetyGate } = require('../safety/safetyGate');
const { provenanceSystem } = require('./provenanceSystem');

class ClinicalPipelineError extends Error {
  constructor(stage, code, message, details = {}) {
    super(`[Pipeline:${stage}] ${message}`);
    this.name = 'ClinicalPipelineError';
    this.stage = stage;
    this.code = code;
    this.status = details.status || 400;
    this.details = details;
  }
}

/**
 * A HIGH or MEDIUM finding is review-required, not a silent pass. The gate
 * permits a documented physician directive to clear it; without one, the
 * pipeline must not build a signable output.
 */
function assertSafetyClearance(safetyReport) {
  if (safetyReport && safetyReport.cleared === false) {
    throw new ClinicalPipelineError(
      'SAFETY_CHECK',
      'SAFETY_REVIEW_REQUIRED',
      'Safety findings require review before the encounter can proceed.',
      { safetyReport, status: 422 }
    );
  }
}

class ClinicalPipeline {
  /**
   * Executes the canonical clinical pipeline.
   * @param {Object} input
   * @param {string} input.patientId - Required patient reference (e.g. 'Patient/123' or '123')
   * @param {string} [input.practitionerId] - Responsible clinician reference
   * @param {Object} [input.actor] - Authenticated actor context { actorId, actorRole, actorName, tenantId }
   * @param {string} [input.transcript] - Clinical dialogue text
   * @param {Buffer} [input.audioBuffer] - Raw consultation audio
   * @param {string} [input.audioMimeType] - Audio MIME type
   * @param {string} [input.template] - Consultation note template ('SOAP' | 'General Consultation')
   * @param {Array<Object>} [input.prescriptions] - Proposed medications to safety verify
   * @param {Array<Object>} [input.confirmedPrescriptions] - Explicit clinician-signed prescriptions for FHIR commit
   * @param {Array<Object|string>} [input.confirmedConditions] - Explicit clinician-confirmed diagnoses for FHIR commit
   * @param {boolean} [input.commitToFhir] - Whether to atomically commit the encounter to FHIR
   * @param {string} [input.physicianDirective] - Clinician directive / override rationale
   * @param {string} [input.tenantId] - Multi-tenant ID
   * @param {Object} [options]
   * @param {Function} [options.onEvent] - Callback for streaming events: (type, payload) => void
   * @returns {Promise<Object>} Complete pipeline result with provenance
   */
  async execute(input, options = {}) {
    const pipelineRunId = `pipe-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();
    const stagesExecuted = [];
    let currentStage = 'INPUT';
    let validated = null;

    const emit = (type, payload = {}) => {
      if (typeof options.onEvent === 'function') {
        try {
          options.onEvent(type, payload);
        } catch (evtErr) {
          console.error(`[ClinicalPipeline] Error in onEvent handler for ${type}:`, evtErr.message);
        }
      }
    };

    try {
      // Stage 1 & 2: INPUT & VALIDATION
      emit('INPUT_RECEIVED', {
        patientId: input?.patientId || null,
        hasAudio: Boolean(input?.audioBuffer),
        hasTranscript: Boolean(input?.transcript),
        template: input?.template || 'General Consultation'
      });

      currentStage = 'VALIDATION';
      stagesExecuted.push('INPUT');
      stagesExecuted.push('VALIDATION');
      validated = this.validateInput(input);

      emit('VALIDATION_COMPLETE', {
        patientId: validated.patientId,
        practitionerId: validated.practitionerId,
        commitToFhir: validated.commitToFhir,
        hasIntake: Boolean(validated.intakeContext)
      });

      // Stage 3: CLINICAL CONTEXT (Strict patient binding & tenant isolation)
      currentStage = 'CLINICAL_CONTEXT';
      stagesExecuted.push('CLINICAL_CONTEXT');

      emit('MULTIMODAL_CONTEXT_STARTED', {
        patientId: validated.patientId,
        hasAudio: Boolean(validated.audioBuffer),
        hasTranscript: Boolean(validated.transcript),
        hasIntake: Boolean(validated.intakeContext),
        hasDocuments: Boolean(validated.documents?.length),
        hasVision: Boolean(validated.visionFindings?.length)
      });

      const clinicalContext = await this.retrieveClinicalContext(validated.patientId, validated.tenantId, {
        template: validated.template,
        transcript: validated.transcript,
        encounterId: validated.encounterId
      });

      emit('FHIR_CONTEXT_READY', {
        conditionsCount: clinicalContext.conditions?.length || 0,
        medicationsCount: clinicalContext.medications?.length || 0,
        allergiesCount: clinicalContext.allergies?.length || 0
      });

      if (validated.intakeContext) {
        emit('INTAKE_CONTEXT_READY', {
          questionnaireId: validated.intakeContext.questionnaireId || 'dynamic-intake'
        });
      }

      if (validated.documents?.length > 0) {
        emit('DOCUMENT_CONTEXT_READY', {
          count: validated.documents.length
        });
      }

      if (validated.visionFindings?.length > 0) {
        emit('VISION_CONTEXT_READY', {
          count: validated.visionFindings.length
        });
      }

      if (validated.transcript) {
        emit('TRANSCRIPT_CONTEXT_READY', {
          length: validated.transcript.length
        });
      }

      // Evidence Retrieval
      emit('EVIDENCE_RETRIEVAL_STARTED', {
        patientId: validated.patientId
      });

      const evidence = await evidenceService.retrieveEvidence({
        patientId: validated.patientId,
        tenantId: validated.tenantId,
        query: validated.transcript || '',
        conditions: clinicalContext.conditions,
        medications: clinicalContext.medications,
        documents: validated.documents
      });

      emit('EVIDENCE_RETRIEVAL_COMPLETE', {
        count: evidence.length,
        items: evidence.map(e => ({ sourceId: e.sourceId, title: e.title, sourceType: e.sourceType }))
      });

      // Assemble normalized multimodal context
      const multimodalContext = await multimodalContextService.assembleContext({
        patientId: validated.patientId,
        tenantId: validated.tenantId,
        encounterId: validated.encounterId,
        actor: validated.actor,
        transcript: validated.transcript,
        intakeContext: validated.intakeContext,
        documents: validated.documents,
        visionFindings: validated.visionFindings,
        evidence
      });

      emit('CLINICAL_CONTEXT_READY', {
        conditionsCount: clinicalContext.conditions?.length || 0,
        medicationsCount: clinicalContext.medications?.length || 0,
        allergiesCount: clinicalContext.allergies?.length || 0,
        documentsCount: validated.documents?.length || 0,
        visionCount: validated.visionFindings?.length || 0,
        evidenceCount: evidence.length
      });

      // Stage 3.5: Pre-AI Intake Red-Flag & Escalation Check
      if (validated.intakeContext?.escalation?.requiresEscalation) {
        stagesExecuted.push('INTAKE_ESCALATION');
        emit('EMERGENCY_DETECTED', {
          source: 'INTAKE_RED_FLAG',
          escalationLevel: validated.intakeContext.escalation.escalationLevel,
          triageCategory: validated.intakeContext.escalation.triageCategory,
          clinicalAction: validated.intakeContext.escalation.clinicalAction
        });

        auditService.recordPipelineStage({
          stage: 'INTAKE_RED_FLAG_ESCALATION',
          patientId: validated.patientId,
          actorId: validated.actor?.actorId || validated.practitionerId,
          status: 'ESCALATION_TRIGGERED',
          summary: `Clinical intake red-flag detected (${validated.intakeContext.escalation.escalationLevel}): ${validated.intakeContext.escalation.clinicalAction}`,
          resultingState: 'ESCALATION_TRIGGERED',
          tenantId: validated.tenantId
        });
      }

      // Stage 4: AI ANALYSIS (Speech & Clinical Note Synthesis with Schema Validation)
      currentStage = 'AI_ANALYSIS';
      stagesExecuted.push('AI_ANALYSIS');
      emit('AI_ANALYSIS_STARTED', {
        model: 'gemini-1.5-flash',
        hasAudio: Boolean(validated.audioBuffer)
      });

      const aiAnalysisResult = await this.runAiAnalysis({
        transcript: validated.transcript,
        audioBuffer: validated.audioBuffer,
        audioMimeType: validated.audioMimeType,
        template: validated.template,
        clinicalContext,
        intakeContext: validated.intakeContext,
        multimodalContext
      });

      emit('AI_ANALYSIS_COMPLETE', {
        model: aiAnalysisResult.model,
        usage: aiAnalysisResult.usage
      });

      // Proposed prescriptions (either from request or extracted from consultation)
      const proposedPrescriptions = validated.prescriptions || [];

      // Stage 5: SAFETY CHECK (Deterministic verification BEFORE persistence)
      currentStage = 'SAFETY_CHECK';
      stagesExecuted.push('SAFETY_CHECK');
      emit('SAFETY_CHECK_STARTED', {
        prescriptionCount: proposedPrescriptions.length
      });

      const safetyReport = this.runSafetyCheck({
        prescriptions: proposedPrescriptions,
        clinicalContext,
        actor: validated.actor,
        physicianDirective: validated.physicianDirective
      });

      // Annotate safety report with deterministic intake escalation / triage findings
      if (validated.intakeContext?.escalation) {
        safetyReport.triageLevel = validated.intakeContext.escalation.triageCategory || validated.intakeContext.escalation.escalationLevel;
        safetyReport.requiresImmediateReview = Boolean(validated.intakeContext.escalation.requiresEscalation);
        safetyReport.intakeEscalation = validated.intakeContext.escalation;
      }

      if ((safetyReport.warnings && safetyReport.warnings.length > 0) || (safetyReport.contraindications && safetyReport.contraindications.length > 0)) {
        emit('SAFETY_WARNING', {
          contraindications: safetyReport.contraindications || [],
          warnings: safetyReport.warnings || [],
          hardStop: Boolean(safetyReport.hardStop)
        });
      }

      // Hard Stop on Critical Safety Failures
      if (safetyReport.hardStop) {
        emit('EMERGENCY_DETECTED', {
          source: 'CONTRAINDICATION_HARD_STOP',
          contraindications: safetyReport.contraindications
        });

        // Enforce physician authority: only verified clinician can provide directive override
        if (!validated.physicianDirective) {
          emit('SAFETY_LOCKED', {
            reason: 'Prescription violates critical safety contraindications. Clinician directive required to override.',
            contraindications: safetyReport.contraindications
          });
          throw new ClinicalPipelineError(
            'SAFETY_CHECK',
            'CONTRAINDICATION_HARD_STOP',
            'Prescription violates critical safety contraindications. Clinician directive required to override.',
            { safetyReport, status: 422 }
          );
        }

        // Validate that directive was issued by an authorized physician
        if (!validated.actor || !['physician', 'practitioner'].includes(validated.actor.actorRole)) {
          emit('SAFETY_LOCKED', {
            reason: 'Safety override rejected: only an authenticated physician/practitioner may issue clinical overrides.',
            contraindications: safetyReport.contraindications
          });
          throw new ClinicalPipelineError(
            'SAFETY_CHECK',
            'UNAUTHORIZED_PHYSICIAN_OVERRIDE',
            'Safety override rejected: only an authenticated physician/practitioner may issue clinical overrides.',
            { safetyReport, status: 403 }
          );
        }
      }

      // A HIGH or MEDIUM finding is REVIEW_REQUIRED, not a silent pass. The
      // gate has already allowed a documented physician directive to clear it;
      // without one, the pipeline must not build a signable output.
      if (safetyReport.cleared === false) {
        emit('SAFETY_REVIEW_REQUIRED', {
          reason: 'Safety findings require review before the encounter can proceed.',
          contraindications: safetyReport.contraindications || [],
          warnings: safetyReport.warnings || []
        });
      }
      assertSafetyClearance(safetyReport);

      // Stage 6: STRUCTURED CLINICAL OUTPUT
      currentStage = 'STRUCTURED_OUTPUT';
      stagesExecuted.push('STRUCTURED_OUTPUT');
      const structuredOutput = this.buildStructuredOutput({
        aiAnalysisResult,
        safetyReport,
        prescriptions: proposedPrescriptions,
        intakeContext: validated.intakeContext,
        multimodalContext
      });

      const aiProvenance = provenanceSystem.createEnvelope({
        agentId: 'proton-clinical-pipeline',
        specialty: validated.template || 'General',
        modelId: aiAnalysisResult.model || 'gemini-1.5-flash',
        inputContext: {
          patientId: validated.patientId,
          transcript: validated.transcript,
          template: validated.template
        },
        sources: clinicalContext.sources || [],
        draftPayload: structuredOutput,
        tenantId: validated.tenantId
      });
      structuredOutput.aiProvenance = aiProvenance;

      emit('CLINICAL_OUTPUT_READY', {
        suggestedDiagnosesCount: structuredOutput.suggestedDiagnoses?.length || 0,
        prescriptionCount: structuredOutput.prescriptions?.length || 0
      });

      // Stage 7: FHIR TRANSACTION (Atomic Bundle Persistence)
      let fhirResult = null;
      if (validated.commitToFhir) {
        currentStage = 'FHIR_TRANSACTION';
        stagesExecuted.push('FHIR_TRANSACTION');

        emit('FHIR_COMMIT_STARTED', {
          patientId: validated.patientId,
          encounterId: validated.encounterId
        });

        // INVARIANT: Unconfirmed AI suggestions cannot create active FHIR resources.
        // Only explicitly confirmed conditions and signed prescriptions are committed.
        const actorRole = validated.actor?.actorRole || validated.actor?.role;
        if (actorRole && !['physician', 'practitioner', 'system'].includes(actorRole)) {
          throw new ClinicalPipelineError(
            'FHIR_TRANSACTION',
            'CLINICIAN_AUTHORIZATION_REQUIRED',
            `Actor with role '${actorRole}' is not authorized to commit clinical resources to FHIR. Attending physician authorization required.`,
            { status: 403 }
          );
        }

        fhirResult = await this.commitFhirTransaction({
          patientId: validated.patientId,
          practitionerId: validated.practitionerId,
          encounterId: validated.encounterId,
          noteText: aiAnalysisResult.rawText,
          confirmedConditions: validated.confirmedConditions,
          confirmedPrescriptions: validated.confirmedPrescriptions,
          tenantId: validated.tenantId
        });

        emit('FHIR_COMMIT_COMPLETE', {
          committed: true,
          encounterId: validated.encounterId
        });
      }

      // Stage 8: AUDIT/PROVENANCE (Cryptographic Hash Chaining)
      currentStage = 'AUDIT_PROVENANCE';
      stagesExecuted.push('AUDIT_PROVENANCE');
      const auditRecord = auditService.recordPipelineStage({
        stage: 'COMPLETE',
        patientId: validated.patientId,
        actorId: validated.actor?.actorId || validated.practitionerId,
        actorRole: validated.actor?.actorRole || 'practitioner',
        actorName: validated.actor?.actorName || 'Proton Practitioner',
        status: 'SUCCESS',
        summary: `Completed canonical clinical pipeline with ${stagesExecuted.length} stages. Committed to FHIR: ${Boolean(validated.commitToFhir)}. Override: ${Boolean(validated.physicianDirective)}`,
        physicianDirective: validated.physicianDirective,
        resultingState: 'ENCOUNTER_FINALIZED',
        tenantId: validated.tenantId
      });

      emit('AUDIT_COMPLETE', {
        auditId: auditRecord.eventId || auditRecord.id,
        currentHash: auditRecord.currentHash
      });

      emit('STREAM_COMPLETE', {
        pipelineRunId,
        durationMs: Date.now() - startTime
      });

      return {
        success: true,
        pipelineRunId,
        durationMs: Date.now() - startTime,
        stagesExecuted,
        patientId: validated.patientId,
        practitionerId: validated.practitionerId,
        actor: validated.actor,
        multimodalContext,
        aiAnalysis: aiAnalysisResult,
        safety: safetyReport,
        output: structuredOutput,
        fhirTransaction: fhirResult,
        provenance: {
          auditId: auditRecord.eventId || auditRecord.id,
          currentHash: auditRecord.currentHash,
          aiProvenance,
          timestamp: new Date().toISOString()
        }
      };
    } catch (err) {
      // Ensure failed operations are immutably recorded in the audit trail
      const failureStage = err.stage || currentStage;
      const effectivePatientId = validated?.patientId || input?.patientId || 'unknown-patient';
      const effectiveActorId = validated?.actor?.actorId || input?.actor?.actorId || 'unknown-actor';
      const effectiveTenantId = validated?.tenantId || input?.tenantId || 'org-default';

      try {
        auditService.recordPipelineStage({
          stage: failureStage,
          patientId: effectivePatientId,
          actorId: effectiveActorId,
          actorRole: validated?.actor?.actorRole || 'unknown',
          status: 'FAILED',
          summary: `Pipeline halted at ${failureStage}: ${err.message}`,
          resultingState: 'PIPELINE_ERROR',
          tenantId: effectiveTenantId
        });
      } catch (auditErr) {
        console.error('[ClinicalPipeline] Emergency audit failure logging failed:', auditErr.message);
      }

      emit('STREAM_ERROR', {
        stage: failureStage,
        code: err.code || 'PIPELINE_ERROR',
        message: err.message,
        status: err.status || 500
      });

      throw err;
    }
  }

  // --- Pipeline Stage Implementations ---

  validateInput(input) {
    if (!input || typeof input !== 'object') {
      throw new ClinicalPipelineError('VALIDATION', 'INPUT_REQUIRED', 'Missing pipeline input payload.');
    }

    if (!input.patientId) {
      throw new ClinicalPipelineError('VALIDATION', 'PATIENT_ID_REQUIRED', 'Encounter must be bound to a valid patientId.');
    }

    const cleanPatientId = String(input.patientId).replace(/^Patient\//, '').trim();
    if (!cleanPatientId) {
      throw new ClinicalPipelineError('VALIDATION', 'PATIENT_ID_INVALID', 'Invalid patientId provided.');
    }

    // Patient Context Isolation: Child item patient mismatch check
    if (Array.isArray(input.prescriptions)) {
      for (const rx of input.prescriptions) {
        if (rx.patientId && String(rx.patientId).replace(/^Patient\//, '').trim() !== cleanPatientId) {
          throw new ClinicalPipelineError(
            'VALIDATION',
            'PATIENT_ID_MISMATCH',
            `Prescription item specifies patient '${rx.patientId}', but encounter is bound to '${cleanPatientId}'.`,
            { status: 400 }
          );
        }
      }
    }

    if (Array.isArray(input.confirmedConditions)) {
      for (const cond of input.confirmedConditions) {
        if (typeof cond === 'object' && cond.patientId && String(cond.patientId).replace(/^Patient\//, '').trim() !== cleanPatientId) {
          throw new ClinicalPipelineError(
            'VALIDATION',
            'PATIENT_ID_MISMATCH',
            `Condition item specifies patient '${cond.patientId}', but encounter is bound to '${cleanPatientId}'.`,
            { status: 400 }
          );
        }
      }
    }

    // Patient & Tenant Context Isolation: Intake context mismatch check
    if (input.intakeContext) {
      if (typeof input.intakeContext !== 'object') {
        throw new ClinicalPipelineError('VALIDATION', 'INVALID_INTAKE_CONTEXT', 'intakeContext must be an object.', { status: 400 });
      }
      if (input.intakeContext.patientId) {
        const intakePatientId = String(input.intakeContext.patientId).replace(/^Patient\//, '').trim();
        if (intakePatientId && intakePatientId !== cleanPatientId) {
          throw new ClinicalPipelineError(
            'VALIDATION',
            'PATIENT_ID_MISMATCH',
            `Intake context is bound to patient '${intakePatientId}', but encounter is bound to '${cleanPatientId}'.`,
            { status: 400 }
          );
        }
      }
      const effectiveTenant = input.actor?.tenantId || input.tenantId || 'org-default';
      if (input.intakeContext.tenantId && input.intakeContext.tenantId !== effectiveTenant) {
        throw new ClinicalPipelineError(
          'VALIDATION',
          'CROSS_TENANT_ACCESS_DENIED',
          `Intake context belongs to tenant '${input.intakeContext.tenantId}', but encounter belongs to '${effectiveTenant}'.`,
          { status: 403 }
        );
      }
    }

    // Patient & Tenant Context Isolation: Document validation
    const effectiveTenant = input.actor?.tenantId || input.tenantId || 'org-default';
    if (Array.isArray(input.documents)) {
      for (const doc of input.documents) {
        if (!doc) continue;
        if (doc.patientId && String(doc.patientId).replace(/^Patient\//, '').trim() !== cleanPatientId) {
          throw new ClinicalPipelineError(
            'VALIDATION',
            'CROSS_PATIENT_ACCESS_DENIED',
            `Document '${doc.id || doc.name || 'unnamed'}' targets a different patient.`,
            { status: 403 }
          );
        }
        if (doc.tenantId && doc.tenantId !== effectiveTenant) {
          throw new ClinicalPipelineError(
            'VALIDATION',
            'CROSS_TENANT_ACCESS_DENIED',
            `Document '${doc.id || doc.name || 'unnamed'}' belongs to a different tenant.`,
            { status: 403 }
          );
        }
      }
    }

    // Patient & Tenant Context Isolation: Vision findings validation
    if (Array.isArray(input.visionFindings)) {
      for (const vf of input.visionFindings) {
        if (!vf) continue;
        if (vf.patientId && String(vf.patientId).replace(/^Patient\//, '').trim() !== cleanPatientId) {
          throw new ClinicalPipelineError(
            'VALIDATION',
            'CROSS_PATIENT_ACCESS_DENIED',
            `Vision finding targets a different patient.`,
            { status: 403 }
          );
        }
        if (vf.tenantId && vf.tenantId !== effectiveTenant) {
          throw new ClinicalPipelineError(
            'VALIDATION',
            'CROSS_TENANT_ACCESS_DENIED',
            `Vision finding belongs to a different tenant.`,
            { status: 403 }
          );
        }
      }
    }

    // Input Audio / Text / Multimodal validation
    const hasDocuments = Array.isArray(input.documents) && input.documents.length > 0;
    const hasVision = Array.isArray(input.visionFindings) && input.visionFindings.length > 0;
    if (!input.transcript && !input.audioBuffer && !hasDocuments && !hasVision) {
      throw new ClinicalPipelineError(
        'VALIDATION',
        'NO_CLINICAL_INPUT',
        'Either audioBuffer, text transcript, documents, or vision findings must be provided to initiate the clinical encounter.'
      );
    }

    if (input.audioBuffer) {
      mediaService.validateAudioInput(input.audioBuffer, input.audioMimeType);
    }

    // Actor context
    const actor = input.actor || null;
    const practitionerId = actor?.actorId
      ? `Practitioner/${actor.actorId}`
      : (input.practitionerId || 'Practitioner/practitioner-default');

    // Physician Directive & Override Validation
    let physicianDirective = null;
    if (input.physicianDirective) {
      const directiveText = String(input.physicianDirective).trim();
      if (directiveText.length < 10) {
        throw new ClinicalPipelineError(
          'VALIDATION',
          'DIRECTIVE_TOO_SHORT',
          'Physician directive must provide substantive clinical rationale (minimum 10 characters).',
          { status: 400 }
        );
      }

      // Check role authorization: Only physician or practitioner can provide a directive override
      if (actor && !['physician', 'practitioner'].includes(actor.actorRole)) {
        throw new ClinicalPipelineError(
          'VALIDATION',
          'UNAUTHORIZED_PHYSICIAN_OVERRIDE',
          `Actor with role '${actor.actorRole}' is not authorized to issue physician directives. Required role: physician.`,
          { status: 403 }
        );
      }

      physicianDirective = directiveText;
    }

    return {
      patientId: cleanPatientId,
      practitionerId,
      actor,
      encounterId: input.encounterId,
      transcript: input.transcript ? String(input.transcript).trim() : null,
      audioBuffer: input.audioBuffer || null,
      audioMimeType: input.audioMimeType || 'audio/webm',
      template: input.template || 'General Consultation',
      prescriptions: Array.isArray(input.prescriptions) ? input.prescriptions : [],
      confirmedPrescriptions: Array.isArray(input.confirmedPrescriptions) ? input.confirmedPrescriptions : [],
      confirmedConditions: Array.isArray(input.confirmedConditions) ? input.confirmedConditions : [],
      documents: Array.isArray(input.documents) ? input.documents : [],
      visionFindings: Array.isArray(input.visionFindings) ? input.visionFindings : [],
      commitToFhir: Boolean(input.commitToFhir),
      physicianDirective,
      intakeContext: input.intakeContext || null,
      tenantId: actor?.tenantId || input.tenantId || 'org-default'
    };
  }

  async retrieveClinicalContext(patientId, tenantId, options = {}) {
    try {
      return await clinicalContextEngine.buildContext({
        patientId,
        tenantId,
        specialty: options.template,
        clinicalQuery: options.transcript,
        encounterId: options.encounterId
      });
    } catch (err) {
      throw new ClinicalPipelineError(
        'CLINICAL_CONTEXT',
        err.code || 'CONTEXT_FETCH_FAILED',
        `Failed to retrieve patient clinical context for ${patientId}: ${err.message}`,
        { status: err.status || 500 }
      );
    }
  }

  async runAiAnalysis({ transcript, audioBuffer, audioMimeType, template, clinicalContext, intakeContext = null, multimodalContext = null }) {
    let effectiveTranscript = transcript;

    // 1. Transcribe audio if provided
    if (audioBuffer && !effectiveTranscript) {
      const transcriptionResult = await aiService.transcribeAudio(audioBuffer, audioMimeType);
      effectiveTranscript = transcriptionResult.text;
    }

    if (!effectiveTranscript && multimodalContext?.dialogueContext?.transcript) {
      effectiveTranscript = multimodalContext.dialogueContext.transcript;
    }

    if (!effectiveTranscript && multimodalContext?.unifiedNarrative) {
      effectiveTranscript = multimodalContext.unifiedNarrative;
    }

    if (!effectiveTranscript || !effectiveTranscript.trim()) {
      throw new TranscriptionInputError("No speech could be recognized from the consultation input.");
    }

    // 2. Format clinical context strictly bound to patient
    let contextString = '';
    if (multimodalContext?.unifiedNarrative) {
      contextString = multimodalContext.unifiedNarrative;
    } else {
      const patientName = clinicalContext.patient?.name?.[0]?.given?.join(' ') + ' ' + (clinicalContext.patient?.name?.[0]?.family || '');
      const contextItems = [
        `Patient: ${patientName || clinicalContext.patientId}`,
        `DOB: ${clinicalContext.patient?.birthDate || 'Unknown'}`,
        `Active Diagnoses: ${clinicalContext.conditions.map(c => c.code?.text || c.code?.coding?.[0]?.display || 'Unknown').join(', ') || 'None'}`,
        `Active Medications: ${clinicalContext.medications.map(m => m.medicationCodeableConcept?.text || m.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown').join(', ') || 'None'}`,
        `Known Allergies: ${clinicalContext.allergies.map(a => a.code?.text || a.code?.coding?.[0]?.display || 'Unknown').join(', ') || 'None'}`
      ];

      if (intakeContext && intakeContext.clinicalNarrative) {
        contextItems.push(`\n${intakeContext.clinicalNarrative}`);
      }
      contextString = contextItems.join('\n');
    }

    // 3. Generate structured note
    const aiNoteResult = await aiService.generateClinicalNote(effectiveTranscript, contextString, template);

    // 4. Strict runtime schema validation of AI output
    const note = aiNoteResult.note;
    if (!note || typeof note !== 'object') {
      throw new ClinicalPipelineError(
        'AI_ANALYSIS',
        'AI_SCHEMA_VALIDATION_FAILED',
        'AI note generator returned invalid non-object output.',
        { status: 502 }
      );
    }

    return {
      transcript: effectiveTranscript,
      note: aiNoteResult.note,
      rawText: aiNoteResult.rawText,
      model: aiNoteResult.model,
      usage: aiNoteResult.usage
    };
  }

  runSafetyCheck({ prescriptions, clinicalContext, actor = null, physicianDirective = null }) {
    return safetyGate.verifyMedicationGate({
      prescriptions,
      patientProfile: {
        allergies: clinicalContext.allergies || clinicalContext.rawAllergies || [],
        medications: clinicalContext.medications || clinicalContext.rawMedications || clinicalContext.activeMedications || [],
        age: clinicalContext.age ?? 45,
        eGFR: clinicalContext.eGFR ?? clinicalContext.egfr ?? null,
        weightKg: clinicalContext.weightKg ?? clinicalContext.weight_kg ?? null
      },
      actor,
      physicianDirective
    });
  }

  buildStructuredOutput({ aiAnalysisResult, safetyReport, prescriptions, intakeContext = null, multimodalContext = null }) {
    const rawNote = aiAnalysisResult.note || {};

    // Extract assessment / diagnoses as AI suggestions ONLY (marked unconfirmed)
    let suggestedDiagnoses = [];
    if (rawNote.assessment) {
      suggestedDiagnoses = Array.isArray(rawNote.assessment)
        ? rawNote.assessment
        : String(rawNote.assessment).split('\n').map(s => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean);
    }

    let subjective = rawNote.subjective || rawNote.historyOfPresentIllness || '';
    if (intakeContext?.clinicalNarrative && !subjective.includes('PATIENT-REPORTED INTAKE')) {
      subjective = `${subjective ? subjective + '\n\n' : ''}${intakeContext.clinicalNarrative}`;
    }

    // Differentials: Unconfirmed AI suggestions (including image intelligence differentials)
    const differential = [
      ...suggestedDiagnoses.map(d => ({
        condition: typeof d === 'string' ? d : (d.name || d.condition || 'Diagnosis'),
        status: 'unconfirmed',
        sourceAttribution: 'AI_INFERRED'
      })),
      ...(multimodalContext?.visionContext?.findings?.flatMap(f => f.differential || []) || [])
    ];

    return {
      soapNote: {
        subjective,
        objective: rawNote.objective || rawNote.examinationFindings || '',
        assessment: rawNote.assessment || '',
        plan: rawNote.plan || ''
      },
      rawNote,
      // Invariant: Mark suggested diagnoses as unconfirmed AI drafts
      suggestedDiagnoses: suggestedDiagnoses.map(d => ({
        name: typeof d === 'string' ? d : (d.name || 'Diagnosis'),
        status: 'PROPOSED_BY_AI',
        clinicianConfirmed: false
      })),
      differential,
      prescriptions: prescriptions.map(rx => ({
        ...rx,
        safetyStatus: safetyReport.contraindications.some(c => c.medication.toLowerCase() === (rx.name || '').toLowerCase())
          ? 'CONTRAINDICATED'
          : 'VERIFIED'
      })),
      evidenceReferences: multimodalContext?.evidenceContext?.items || [],
      multimodalContext
    };
  }

  async commitFhirTransaction({ patientId, practitionerId, encounterId, noteText, confirmedConditions, confirmedPrescriptions, tenantId }) {
    const bundle = fhirService.buildEncounterBundle({
      patientId,
      practitionerId,
      encounterId,
      noteText,
      confirmedConditions,
      confirmedPrescriptions
    });

    try {
      return await fhirService.executeTransaction(bundle);
    } catch (err) {
      throw new ClinicalPipelineError(
        'FHIR_TRANSACTION',
        'ATOMIC_TRANSACTION_FAILED',
        `Failed to commit atomic FHIR bundle: ${err.message}`,
        { status: 500 }
      );
    }
  }
}

const clinicalPipeline = new ClinicalPipeline();

module.exports = {
  ClinicalPipeline,
  clinicalPipeline,
  ClinicalPipelineError,
  assertSafetyClearance
};
