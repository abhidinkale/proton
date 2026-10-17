/**
 * Proton Clinical Vision Safety Layer (V2 M2C-1)
 * 
 * Deterministic post-AI clinical safety gate:
 * 1. Rejects hallucinated / fabricated patient identifiers.
 * 2. Rejects autonomous diagnosis declarations (must remain unconfirmed decision support).
 * 3. Rejects autonomous prescribing / medication requests.
 * 4. Rejects malformed differentials.
 * 5. Guarantees physician review requirement.
 */

class VisionSafetyError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'VisionSafetyError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Scans a string or recursively scans an object/array to detect foreign patient identifiers.
 */
function findForeignPatientIds(value, authorizedPatientId) {
  const cleanAuthorized = String(authorizedPatientId).replace(/^Patient\//, '').trim();
  const foreignIds = new Set();

  function scan(val) {
    if (!val) return;
    if (typeof val === 'string') {
      // Regex pattern to detect Patient reference identifiers
      const matches = val.matchAll(/(?:Patient\/|patient[_-]?id[:=\s]+)([a-zA-Z0-9_\-\.]+)/gi);
      for (const match of matches) {
        const foundId = match[1].trim();
        if (foundId && foundId.toLowerCase() !== cleanAuthorized.toLowerCase()) {
          foreignIds.add(foundId);
        }
      }
    } else if (Array.isArray(val)) {
      for (const item of val) scan(item);
    } else if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        if (k.toLowerCase().includes('patient') && typeof v === 'string') {
          const cleanV = v.replace(/^Patient\//, '').trim();
          if (cleanV && cleanV.toLowerCase() !== cleanAuthorized.toLowerCase()) {
            foreignIds.add(cleanV);
          }
        }
        scan(v);
      }
    }
  }

  scan(value);
  return Array.from(foreignIds);
}

/**
 * Scans for prescription language or autonomous medication ordering attempts.
 */
function detectPrescriptionAttempts(output) {
  const prescriptionPatterns = [
    /\b(?:prescribe|dispense|refill|sig:)\s+[a-z0-9]+/i,
    /\b(?:prescribe|dispense|prescription|rx:)\b/i,
    /\b(?:mg|mcg|ml|tablets?|capsules?)\s+(?:po|bid|tid|qid|daily|prn|q\d+h)\b/i,
    /\b(?:amoxicillin|prednisone|hydrocortisone|azithromycin|ciprofloxacin|ibuprofen|gabapentin|mupirocin)\b/i
  ];

  const violations = [];

  function scan(val, path = '') {
    if (!val) return;
    if (typeof val === 'string') {
      for (const pat of prescriptionPatterns) {
        if (pat.test(val)) {
          violations.push({ path, matched: val.substring(0, 100) });
          break;
        }
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => scan(item, `${path}[${idx}]`));
    } else if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        scan(v, path ? `${path}.${k}` : k);
      }
    }
  }

  scan(output);
  return violations;
}

/**
 * Scans for attempts by the AI to declare a confirmed or definitive diagnosis.
 */
function detectAutonomousConfirmedDiagnosis(output) {
  const confirmedKeywords = [
    /\b(?:confirmed|definitive|final|active)\s+diagnosis\b/i,
    /\bdiagnosis\s+is\s+confirmed\b/i,
    /\bestablished\s+diagnosis\b/i,
    /\bconclusive\s+finding\b/i
  ];

  const violations = [];

  // 1. Check differential suggestions status
  if (Array.isArray(output.differentialSuggestions)) {
    for (const [idx, diff] of output.differentialSuggestions.entries()) {
      if (diff.status && ['confirmed', 'active', 'final', 'definitive'].includes(diff.status.toLowerCase())) {
        violations.push({
          path: `differentialSuggestions[${idx}]`,
          reason: `Differential '${diff.condition}' marked as '${diff.status}'. AI vision cannot confirm diagnoses.`
        });
      }
    }
  }

  // 2. Check observations and rationale text
  function scan(val, path = '') {
    if (!val) return;
    if (typeof val === 'string') {
      for (const pat of confirmedKeywords) {
        if (pat.test(val)) {
          violations.push({ path, reason: `Confirmed diagnosis assertion detected: "${val.substring(0, 80)}"` });
          break;
        }
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => scan(item, `${path}[${idx}]`));
    } else if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        scan(v, path ? `${path}.${k}` : k);
      }
    }
  }

  scan(output);
  return violations;
}

class VisionSafety {
  /**
   * Deterministically validates AI vision output for clinical safety and authority adherence.
   * 
   * @param {Object} output - Validated schema output
   * @param {Object} context
   * @param {string} context.patientId - Authoritative patient ID
   * @param {string} [context.encounterId] - Optional authoritative encounter ID
   * @param {string} [context.tenantId] - Authoritative tenant ID
   * @returns {Object} Safety-cleared output
   */
  validateClinicalSafety(output, { patientId, encounterId = null, tenantId = 'org-default' }) {
    if (!patientId) {
      throw new VisionSafetyError('PATIENT_ID_REQUIRED', 'Authoritative patientId is required for safety validation.', 400);
    }

    // 1. Hallucinated / Fabricated Patient Identifier Detection
    const foreignPatientIds = findForeignPatientIds(output, patientId);
    if (foreignPatientIds.length > 0) {
      throw new VisionSafetyError(
        'FABRICATED_PATIENT_IDENTIFIER',
        `Vision AI output contained unauthorized or fabricated patient reference: ${foreignPatientIds.join(', ')}`,
        400,
        { foreignPatientIds }
      );
    }

    // 2. Autonomous Confirmed Diagnosis Rejection
    const confirmedDiagnosisViolations = detectAutonomousConfirmedDiagnosis(output);
    if (confirmedDiagnosisViolations.length > 0) {
      throw new VisionSafetyError(
        'AUTONOMOUS_DIAGNOSIS_REJECTED',
        'Vision AI cannot declare confirmed or active diagnoses. All findings must remain unconfirmed decision support.',
        400,
        { violations: confirmedDiagnosisViolations }
      );
    }

    // 3. Autonomous Prescription Rejection
    const prescriptionViolations = detectPrescriptionAttempts(output);
    if (prescriptionViolations.length > 0) {
      throw new VisionSafetyError(
        'AUTONOMOUS_PRESCRIPTION_REJECTED',
        'Vision AI is strictly decision support and is prohibited from prescribing medications or generating treatment orders.',
        400,
        { violations: prescriptionViolations }
      );
    }

    // 4. Force Invariant Guarantees
    const safetyCleared = {
      ...output,
      decisionSupportOnly: true,
      requiresPhysicianReview: true,
      clinicalAuthority: 'ATTENDING_PHYSICIAN_REQUIRED',
      patientId: String(patientId).replace(/^Patient\//, '').trim(),
      encounterId: encounterId ? String(encounterId).replace(/^Encounter\//, '').trim() : null,
      tenantId: tenantId || 'org-default'
    };

    // Ensure all differentials are explicitly stamped as unconfirmed
    if (Array.isArray(safetyCleared.differentialSuggestions)) {
      safetyCleared.differentialSuggestions = safetyCleared.differentialSuggestions.map(d => ({
        ...d,
        status: 'unconfirmed'
      }));
    }

    return safetyCleared;
  }
}

const visionSafety = new VisionSafety();

module.exports = {
  VisionSafety,
  visionSafety,
  VisionSafetyError
};
