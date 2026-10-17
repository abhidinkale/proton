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
const {
  visionService,
  VisionService,
  VisionServiceError,
  validateVisionOutput,
  VisionValidationError,
  visionSafety,
  VisionSafety,
  VisionSafetyError,
  visionAudit,
  VisionAudit,
  getVisionProvider,
  DemoVisionProvider,
  GeminiVisionProvider,
  VisionProvider,
  VisionProviderError,
  visionReviewService,
  VisionReviewService,
  VisionReviewError
} = require('./vision');
const {
  streamManager,
  StreamManager,
  createEvent,
  formatSseMessage,
  CONTRACT_VERSION,
  CANONICAL_EVENT_TYPES,
  validateStreamAccess,
  scrubError,
  sanitizePayload,
  StreamSecurityError
} = require('./streaming');
const {
  multimodalContextService,
  MultimodalContextService,
  MultimodalContextError,
  SOURCE_ATTRIBUTIONS
} = require('./clinical/multimodalContextService');
const {
  documentService,
  DocumentService,
  DocumentServiceError,
  ALLOWED_MIME_TYPES,
  MAX_DOCUMENT_SIZE
} = require('./document');
const {
  voiceService,
  VoiceService,
  VoiceServiceError,
  WhisperProvider
} = require('./voice');
const {
  evidenceService,
  EvidenceService,
  EvidenceServiceError,
  CLINICAL_GUIDELINES
} = require('./evidence');
const {
  longitudinalService,
  LongitudinalService,
  LongitudinalServiceError
} = require('./clinical/longitudinalService');
const {
  clinicianConfirmationService,
  ClinicianConfirmationService,
  ClinicianConfirmationError
} = require('./clinical/clinicianConfirmationService');

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
  LocalStorageAdapter,

  // Vision Intelligence (M2C-1)
  visionService,
  VisionService,
  VisionServiceError,
  validateVisionOutput,
  VisionValidationError,
  visionSafety,
  VisionSafety,
  VisionSafetyError,
  visionAudit,
  VisionAudit,
  getVisionProvider,
  DemoVisionProvider,
  GeminiVisionProvider,
  VisionProvider,
  VisionProviderError,

  // Clinician Review (M2C-2)
  visionReviewService,
  VisionReviewService,
  VisionReviewError,

  // Clinical Streaming (M2C-3)
  streamManager,
  StreamManager,
  createEvent,
  formatSseMessage,
  CONTRACT_VERSION,
  CANONICAL_EVENT_TYPES,
  validateStreamAccess,
  scrubError,
  sanitizePayload,
  StreamSecurityError,

  // Multimodal Context & Clinical Intelligence
  multimodalContextService,
  MultimodalContextService,
  MultimodalContextError,
  SOURCE_ATTRIBUTIONS,

  // Document Intelligence
  documentService,
  DocumentService,
  DocumentServiceError,
  ALLOWED_MIME_TYPES,
  MAX_DOCUMENT_SIZE,

  // Voice & Speech
  voiceService,
  VoiceService,
  VoiceServiceError,
  WhisperProvider,

  // Evidence & Guidelines
  evidenceService,
  EvidenceService,
  EvidenceServiceError,
  CLINICAL_GUIDELINES,

  // Longitudinal Intelligence
  longitudinalService,
  LongitudinalService,
  LongitudinalServiceError,

  // Clinician Confirmation
  clinicianConfirmationService,
  ClinicianConfirmationService,
  ClinicianConfirmationError
};
