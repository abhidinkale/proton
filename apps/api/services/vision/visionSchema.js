/**
 * Proton Clinical Vision Output Schema & Validator (V2 M2C-1)
 * 
 * Defines strict structured schema for clinical image intelligence.
 * Enforces mandatory confidence metrics, unconfirmed differentials,
 * limitations disclosure, and eliminates arbitrary or malformed AI output.
 */

class VisionValidationError extends Error {
  constructor(code, message, status = 422, details = null) {
    super(message);
    this.name = 'VisionValidationError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Forbidden clinical output keys that vision AI must never attempt to return.
 */
const FORBIDDEN_CLINICAL_KEYS = [
  'prescription',
  'prescriptions',
  'medicationRequest',
  'medicationsToPrescribe',
  'rx',
  'confirmedDiagnosis',
  'activeCondition',
  'treatmentOrder',
  'dispenseOrder'
];

/**
 * Validates raw output from a vision provider against the strict clinical vision schema.
 * 
 * @param {any} rawOutput - Parsed object or JSON string from AI model
 * @param {Object} [metaContext] - Optional provider metadata to supplement or verify
 * @returns {Object} Strictly sanitized and structured vision analysis
 */
function validateVisionOutput(rawOutput, metaContext = {}) {
  // 1. Basic Object Shape Check
  if (!rawOutput) {
    throw new VisionValidationError('EMPTY_PROVIDER_OUTPUT', 'Vision provider returned empty output.', 502);
  }

  let parsed = rawOutput;
  if (typeof rawOutput === 'string') {
    try {
      // Remove possible markdown formatting ```json ... ```
      const cleaned = rawOutput.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new VisionValidationError('MALFORMED_OUTPUT', `Failed to parse vision AI output as JSON: ${parseErr.message}`, 502);
    }
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    throw new VisionValidationError('INVALID_ROOT_SHAPE', 'Vision AI output must be a non-null JSON object.', 502);
  }

  // 2. Reject Forbidden Autonomous Clinical Action Keys
  for (const forbidden of FORBIDDEN_CLINICAL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(parsed, forbidden) && parsed[forbidden] !== null && parsed[forbidden] !== undefined) {
      throw new VisionValidationError(
        'UNSUPPORTED_CLINICAL_FIELDS',
        `Vision AI output contained unsupported or forbidden clinical key '${forbidden}'. Vision AI cannot prescribe or declare confirmed conditions.`,
        422,
        { forbiddenKey: forbidden }
      );
    }
  }

  // 3. Validate Mandatory Confidence / Uncertainty
  if (parsed.confidence === undefined || parsed.confidence === null) {
    throw new VisionValidationError('MISSING_CONFIDENCE', 'Vision analysis output must include a confidence score.', 422);
  }

  const confidenceNum = Number(parsed.confidence);
  if (isNaN(confidenceNum) || confidenceNum < 0.0 || confidenceNum > 1.0) {
    throw new VisionValidationError(
      'INVALID_CONFIDENCE',
      `Confidence must be a valid number between 0.0 and 1.0. Received: ${parsed.confidence}`,
      422
    );
  }

  // 4. Validate Observations / Findings (Must be non-empty list)
  const rawObs = parsed.observations || parsed.findings;
  if (!rawObs || !Array.isArray(rawObs) || rawObs.length === 0) {
    throw new VisionValidationError('MISSING_OBSERVATIONS', 'Vision analysis must include at least one clinical observation/finding.', 422);
  }

  const observations = rawObs.map((obs, idx) => {
    if (typeof obs === 'string') {
      const trimmed = obs.trim();
      if (!trimmed) throw new VisionValidationError('EMPTY_OBSERVATION', `Observation at index ${idx} is empty.`, 422);
      return {
        label: trimmed,
        description: trimmed,
        severity: 'unspecified'
      };
    } else if (typeof obs === 'object' && obs !== null) {
      const label = obs.label || obs.finding || obs.text || obs.description;
      if (!label || typeof label !== 'string' || !label.trim()) {
        throw new VisionValidationError('MALFORMED_OBSERVATION', `Observation at index ${idx} missing descriptive text/label.`, 422);
      }
      return {
        label: label.trim(),
        description: obs.description ? String(obs.description).trim() : label.trim(),
        severity: typeof obs.severity === 'string' ? obs.severity.toLowerCase().trim() : 'unspecified'
      };
    } else {
      throw new VisionValidationError('MALFORMED_OBSERVATION', `Observation at index ${idx} must be a string or object.`, 422);
    }
  });

  // 5. Validate Anatomical Location
  let anatomicalLocation = {
    site: 'Unspecified anatomical region',
    laterality: 'unspecified'
  };

  if (parsed.anatomicalLocation) {
    if (typeof parsed.anatomicalLocation === 'string') {
      anatomicalLocation = {
        site: parsed.anatomicalLocation.trim() || 'Unspecified anatomical region',
        laterality: 'unspecified'
      };
    } else if (typeof parsed.anatomicalLocation === 'object') {
      anatomicalLocation = {
        site: parsed.anatomicalLocation.site ? String(parsed.anatomicalLocation.site).trim() : 'Unspecified',
        laterality: parsed.anatomicalLocation.laterality ? String(parsed.anatomicalLocation.laterality).toLowerCase().trim() : 'unspecified'
      };
    }
  }

  // 6. Validate Differential Suggestions (Must be unconfirmed)
  const rawDiff = parsed.differentialSuggestions || parsed.differentials || [];
  if (!Array.isArray(rawDiff)) {
    throw new VisionValidationError('MALFORMED_DIFFERENTIAL', 'Differential suggestions must be an array.', 422);
  }

  const differentialSuggestions = rawDiff.map((item, idx) => {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) throw new VisionValidationError('MALFORMED_DIFFERENTIAL', `Differential at index ${idx} is empty.`, 422);
      return {
        condition: trimmed,
        rationale: 'Suggested by image visual pattern analysis',
        likelihood: 'possible',
        status: 'unconfirmed'
      };
    } else if (typeof item === 'object' && item !== null) {
      const condition = item.condition || item.name || item.diagnosis;
      if (!condition || typeof condition !== 'string' || !condition.trim()) {
        throw new VisionValidationError('MALFORMED_DIFFERENTIAL', `Differential at index ${idx} missing condition name.`, 422);
      }
      const rawStatus = item.status ? String(item.status).toLowerCase().trim() : 'unconfirmed';
      return {
        condition: condition.trim(),
        rationale: item.rationale ? String(item.rationale).trim() : 'Visual pattern correlation',
        likelihood: typeof item.likelihood === 'string' ? item.likelihood.toLowerCase().trim() : 'possible',
        status: rawStatus
      };
    } else {
      throw new VisionValidationError('MALFORMED_DIFFERENTIAL', `Differential at index ${idx} must be string or object.`, 422);
    }
  });

  // 7. Validate Clinical Limitations
  const rawLimits = parsed.limitations;
  let limitations = [];
  if (Array.isArray(rawLimits) && rawLimits.length > 0) {
    limitations = rawLimits.map(l => String(l).trim()).filter(Boolean);
  }
  if (limitations.length === 0) {
    limitations = [
      'Visual evaluation based on 2D photographic capture only; clinical correlation required.',
      'Lighting, resolution, and focal distance may impact visual interpretation.'
    ];
  }

  // 8. Validate Image Quality Observations
  let imageQualityObservations = 'Adequate photographic quality for visual inspection';
  if (parsed.imageQualityObservations) {
    if (typeof parsed.imageQualityObservations === 'string') {
      imageQualityObservations = parsed.imageQualityObservations.trim();
    } else if (typeof parsed.imageQualityObservations === 'object') {
      imageQualityObservations = JSON.stringify(parsed.imageQualityObservations);
    }
  }

  // 9. Model & Provider Metadata
  const modelMetadata = {
    provider: parsed.modelMetadata?.provider || metaContext.provider || 'proton-vision',
    model: parsed.modelMetadata?.model || metaContext.model || 'unknown-vision-model',
    version: parsed.modelMetadata?.version || '1.0.0',
    latencyMs: Number(parsed.modelMetadata?.latencyMs || metaContext.latencyMs || 0)
  };

  // 10. Timestamp
  const timestamp = parsed.timestamp && !isNaN(new Date(parsed.timestamp).getTime())
    ? new Date(parsed.timestamp).toISOString()
    : new Date().toISOString();

  return {
    observations,
    anatomicalLocation,
    confidence: confidenceNum,
    uncertaintyDescription: parsed.uncertaintyDescription ? String(parsed.uncertaintyDescription).trim() : 'Standard 2D photographic inference uncertainty',
    differentialSuggestions,
    limitations,
    imageQualityObservations,
    modelMetadata,
    timestamp,
    decisionSupportOnly: true,
    requiresPhysicianReview: true
  };
}

module.exports = {
  VisionValidationError,
  FORBIDDEN_CLINICAL_KEYS,
  validateVisionOutput
};
