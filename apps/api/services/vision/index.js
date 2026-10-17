/**
 * Proton Clinical Vision Intelligence Hub (V2 M2C-1)
 */

const {
  VisionService,
  visionService,
  VisionServiceError,
  ALLOWED_IMAGE_MIMES,
  MIN_IMAGE_SIZE,
  MAX_IMAGE_SIZE,
  MIN_DIMENSION,
  MAX_DIMENSION
} = require('./visionService');

const {
  VisionProvider,
  VisionProviderError,
  DemoVisionProvider,
  GeminiVisionProvider,
  getVisionProvider
} = require('./visionProvider');

const {
  validateVisionOutput,
  VisionValidationError,
  FORBIDDEN_CLINICAL_KEYS
} = require('./visionSchema');

const {
  VisionSafety,
  visionSafety,
  VisionSafetyError
} = require('./visionSafety');

const {
  VisionAudit,
  visionAudit
} = require('./visionAudit');

module.exports = {
  // Service
  VisionService,
  visionService,
  VisionServiceError,

  // Providers
  VisionProvider,
  VisionProviderError,
  DemoVisionProvider,
  GeminiVisionProvider,
  getVisionProvider,

  // Schema & Validation
  validateVisionOutput,
  VisionValidationError,
  FORBIDDEN_CLINICAL_KEYS,

  // Safety
  VisionSafety,
  visionSafety,
  VisionSafetyError,

  // Audit
  VisionAudit,
  visionAudit,

  // Constants
  ALLOWED_IMAGE_MIMES,
  MIN_IMAGE_SIZE,
  MAX_IMAGE_SIZE,
  MIN_DIMENSION,
  MAX_DIMENSION
};
