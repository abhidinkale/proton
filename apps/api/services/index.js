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
const { IntakeService, intakeService, IntakeValidationError, branchingEngine, escalationEngine, contextMapper } = require('./intake');
const { captureSessionService, CaptureSessionService, CaptureSessionError, VALID_TRANSITIONS, tokenManager, TokenManager, sessionStore, SessionStore, imageQualityValidator, ImageQualityValidator, ImageQualityError, PAIRING_TTL_MS, ACTIVE_TTL_MS, UPLOAD_TTL_MS } = require('./capture');
const { storageService, StorageAdapter, LocalStorageAdapter } = require('./storage');

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
  ClinicalPipelineError,

  // Clinical Intake
  IntakeService,
  intakeService,
  IntakeValidationError,
  branchingEngine,
  escalationEngine,
  contextMapper,

  // Capture Sessions (M2B-1 & M2B-2)
  captureSessionService,
  CaptureSessionService,
  CaptureSessionError,
  VALID_TRANSITIONS,
  tokenManager,
  TokenManager,
  sessionStore,
  SessionStore,
  imageQualityValidator,
  ImageQualityValidator,
  ImageQualityError,
  PAIRING_TTL_MS,
  ACTIVE_TTL_MS,
  UPLOAD_TTL_MS,

  // Storage
  storageService,
  StorageAdapter,
  LocalStorageAdapter
};
