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
const { storageService, StorageAdapter, LocalStorageAdapter, S3StorageAdapter } = require('./storage');
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
  VisionReviewError,
  acuteTriageService,
  AcuteTriageService
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
  WhisperProvider,
  patientVoiceAgentService,
  PatientVoiceAgentService,
  OUTREACH_PROTOCOLS
} = require('./voice');
const {
  evidenceService,
  EvidenceService,
  EvidenceServiceError,
  CLINICAL_GUIDELINES
} = require('./evidence');
const {
  billingCodingService,
  BillingCodingService,
  BillingServiceError,
  CPT_BENCHMARKS,
  ICD10_MAPPINGS,
  priorAuthService,
  PriorAuthService
} = require('./billing');
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
const {
  clinicalTrialService,
  ClinicalTrialService,
  CANONICAL_CLINICAL_TRIALS
} = require('./clinical/clinicalTrialService');
const {
  nurseRoomingService,
  NurseRoomingService
} = require('./clinical/nurseRoomingService');
const {
  dischargeSummaryService,
  DischargeSummaryService
} = require('./clinical/dischargeSummaryService');
const {
  openTargetsService,
  OpenTargetsService
} = require('./clinical/openTargetsService');
const {
  jevSafetyGuardrailService,
  JevSafetyGuardrailService
} = require('./clinical/jevSafetyGuardrailService');
const {
  medicationSuggestionAgent,
  MedicationSuggestionAgent
} = require('../agents/medicationSuggestionAgent');
const {
  distributedStateManager,
  DistributedStateManager
} = require('./distributed/distributedStateManager');
const {
  smartAuthService,
  SmartAuthService
} = require('./fhir/smartAuthService');
const {
  jobQueueService,
  JobQueueService
} = require('./jobs/jobQueueService');
const {
  postgresAdapter,
  PostgresAdapter
} = require('../storage/postgresAdapter');

module.exports = {
  // Patient After-Care & Discharge Summary (Epic MyChart / Abridge)
  dischargeSummaryService,
  DischargeSummaryService,
  // Nurse & Rooming Care Team (Abridge Nurse / Epic Art)
  nurseRoomingService,
  NurseRoomingService,
  // Clinical Trials & Precision Medicine (Tempus / OpenEvidence)
  clinicalTrialService,
  ClinicalTrialService,
  CANONICAL_CLINICAL_TRIALS,
  // Billing & RCM
  billingCodingService,
  BillingCodingService,
  BillingServiceError,
  CPT_BENCHMARKS,
  ICD10_MAPPINGS,
  priorAuthService,
  PriorAuthService,

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
  S3StorageAdapter,

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

  // Acute Diagnostic Imaging Triage
  acuteTriageService,
  AcuteTriageService,

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
  patientVoiceAgentService,
  PatientVoiceAgentService,
  OUTREACH_PROTOCOLS,

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
  ClinicianConfirmationError,

  // Distributed State & Pub/Sub
  distributedStateManager,
  DistributedStateManager,

  // Production SMART on FHIR
  smartAuthService,
  SmartAuthService,

  // Background Job Queue
  jobQueueService,
  JobQueueService,

  // Enterprise Relational Persistence
  postgresAdapter,
  PostgresAdapter,

  // Open Targets & Jev Safety Guardrail Medication Intelligence
  openTargetsService,
  OpenTargetsService,
  jevSafetyGuardrailService,
  JevSafetyGuardrailService,
  medicationSuggestionAgent,
  MedicationSuggestionAgent,

  // Milestone 1: Core AI Architecture & Safety Foundations
  modelGateway: require('./ai/modelGateway').modelGateway,
  ModelGateway: require('./ai/modelGateway').ModelGateway,
  ModelGatewayError: require('./ai/modelGateway').ModelGatewayError,
  jevAdapter: require('./ai/jevAdapter').jevAdapter,
  JevAdapter: require('./ai/jevAdapter').JevAdapter,
  JevError: require('./ai/jevAdapter').JevError,
  clinicalContextEngine: require('./clinical/clinicalContextEngine').clinicalContextEngine,
  ClinicalContextEngine: require('./clinical/clinicalContextEngine').ClinicalContextEngine,
  ClinicalContextError: require('./clinical/clinicalContextEngine').ClinicalContextError,
  provenanceSystem: require('./clinical/provenanceSystem').provenanceSystem,
  ProvenanceSystem: require('./clinical/provenanceSystem').ProvenanceSystem,
  ProvenanceError: require('./clinical/provenanceSystem').ProvenanceError,
  safetyGate: require('./safety/safetyGate').safetyGate,
  SafetyGate: require('./safety/safetyGate').SafetyGate,
  SafetyGateError: require('./safety/safetyGate').SafetyGateError,
  specialistAgentRegistry: require('../agents/registry/specialistAgentRegistry').specialistAgentRegistry,
  SpecialistAgentRegistry: require('../agents/registry/specialistAgentRegistry').SpecialistAgentRegistry,
  agentOrchestrator: require('../agents/registry/agentOrchestrator').agentOrchestrator,
  AgentOrchestrator: require('../agents/registry/agentOrchestrator').AgentOrchestrator
};

