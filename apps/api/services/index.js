/**
 * Proton Services Hub
 * Central export boundary for core clinical, safety, fhir, media, and audit services.
 */

const { MediaService, mediaService, TranscriptionInputError, MediaValidationError } = require('./media/mediaService');
const { SafetyService, safetyService } = require('./safety/safetyService');
const { FhirService, fhirService } = require('./fhir/fhirService');
const { AuditService, auditService } = require('./audit/auditService');
const { AIService, aiService } = require('./ai/aiService');
const { ClinicalPipeline, clinicalPipeline, ClinicalPipelineError } = require('./clinical/clinicalPipeline');

module.exports = {
  // Media
  MediaService,
  mediaService,
  TranscriptionInputError,
  MediaValidationError,

  // Safety
  SafetyService,
  safetyService,

  // FHIR
  FhirService,
  fhirService,

  // Audit
  AuditService,
  auditService,

  // AI
  AIService,
  aiService,

  // Clinical Pipeline
  ClinicalPipeline,
  clinicalPipeline,
  ClinicalPipelineError
};
