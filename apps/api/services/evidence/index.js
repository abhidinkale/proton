/**
 * Proton Evidence Services Export
 */

const {
  EvidenceService,
  evidenceService,
  EvidenceServiceError,
  CLINICAL_GUIDELINES
} = require('./evidenceService');

const loop = require('./loop');

module.exports = {
  EvidenceService,
  evidenceService,
  EvidenceServiceError,
  CLINICAL_GUIDELINES,
  ...loop
};
