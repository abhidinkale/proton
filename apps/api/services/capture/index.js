/**
 * Proton Capture Services Index
 */

const { captureSessionService, CaptureSessionService, CaptureSessionError, VALID_TRANSITIONS } = require('./captureSessionService');
const { tokenManager, TokenManager, PAIRING_TTL_MS, ACTIVE_TTL_MS, UPLOAD_TTL_MS } = require('./tokenManager');
const { sessionStore, SessionStore } = require('./sessionStore');
const { imageQualityValidator, ImageQualityValidator, ImageQualityError } = require('./imageQualityValidator');

module.exports = {
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
  UPLOAD_TTL_MS
};
