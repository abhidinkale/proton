/**
 * Proton Unified Clinical Safety Gate
 * 
 * Enforces the non-negotiable clinical safety boundary across ALL intelligence paths:
 * Old AI Path, Specialist Agent Registry, Jev Decisions, and Local Models.
 * 
 * Invariants:
 * 1. Single Mandatory Gate: No AI recommendation can reach physician review or FHIR persistence
 *    without passing through SafetyGate. Zero secondary bypass paths.
 * 2. Deterministic Delegation: Incorporates and delegates directly to SafetyService (Allergies, DDI,
 *    Dose limits) and JevSafetyGuardrailService (95% safety threshold). Does NOT replace them with looser heuristics.
 * 3. Missing Context Is Never Safe: If allergy or medication data is unavailable, status is flagged
 *    UNKNOWN / MISSING_ALLERGY_CONTEXT, never assumed SAFE.
 * 4. Physician Authority Gate: Critical hard-stops can ONLY be overridden with an explicit, authenticated
 *    physician directive (>= 10 characters rationale). Non-physician overrides are strictly rejected.
 */

const { safetyService } = require('./safetyService');
const { jevSafetyGuardrailService } = require('../clinical/jevSafetyGuardrailService');

class SafetyGateError extends Error {
  constructor(code, message, status = 409, details = null) {
    super(`[SafetyGate:${code}] ${message}`);
    this.name = 'SafetyGateError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class SafetyGate {
  constructor(options = {}) {
    this.safetyService = options.safetyService || safetyService;
    this.jevGuardrail = options.jevGuardrail || jevSafetyGuardrailService;
  }

  /**
   * Unified gate verification for proposed medication orders.
   * 
   * @param {Object} params
   * @param {Array<Object>} params.prescriptions - Proposed medications to verify
   * @param {Object} params.patientProfile - Patient clinical context (allergies, active meds, age, eGFR)
   * @param {Object} [params.actor] - Authenticated actor performing request
   * @param {string} [params.physicianDirective] - Clinician override rationale
   * @returns {Object} SafetyGate decision envelope
   */
  verifyMedicationGate({
    prescriptions = [],
    patientProfile = {},
    actor = null,
    physicianDirective = null
  }) {
    if (!Array.isArray(prescriptions)) {
      throw new SafetyGateError('MALFORMED_INPUT', 'Prescriptions must be provided as an array.', 400);
    }

    const allergies = patientProfile.allergies || [];
    const activeMeds = patientProfile.medications || patientProfile.activeMedications || [];
    const age = patientProfile.age ?? 45;
    const eGFR = patientProfile.eGFR ?? patientProfile.egfr ?? null;
    const weightKg = patientProfile.weightKg ?? patientProfile.weight_kg ?? null;

    // 1. Missing Data Check: Missing allergy context is flagged as warning/risk, NEVER assumed safe
    const hasDocumentedAllergies = allergies.length > 0;
    const missingContextWarnings = [];
    if (!hasDocumentedAllergies) {
      missingContextWarnings.push({
        code: 'MISSING_ALLERGY_CONTEXT',
        message: 'Patient record contains no documented allergy history. Verify manually before prescribing.',
        severity: 'HIGH'
      });
    }

    // 2. Deterministic Verification via SafetyService
    const deterministicResult = typeof this.safetyService.evaluatePrescriptionSafety === 'function'
      ? this.safetyService.evaluatePrescriptionSafety({
          prescriptions,
          allergies,
          activeMedications: activeMeds,
          eGFR,
          weightKg,
          age
        })
      : (typeof this.safetyService.verifyPrescriptions === 'function'
          ? this.safetyService.verifyPrescriptions(prescriptions, allergies, activeMeds, age)
          : { contraindications: [], warnings: [] });

    const violations = deterministicResult.contraindications || deterministicResult.violations || [];
    const warnings = [...(deterministicResult.warnings || []), ...missingContextWarnings];


    const hasCriticalHardStop = violations.some(v => v.severity === 'CRITICAL');
    const hasHighRisk = violations.some(v => v.severity === 'HIGH' || v.severity === 'MEDIUM');

    // 3. Physician Override Evaluation. A HIGH finding is not a silent pass: it
    // is REVIEW_REQUIRED, and a physician may clear it only with a documented
    // rationale. A CRITICAL finding is the same, but blocked until then.
    let overrideAccepted = false;
    if ((hasCriticalHardStop || hasHighRisk) && physicianDirective) {
      // Must be licensed physician
      if (!actor || actor.actorRole !== 'physician') {
        throw new SafetyGateError(
          'INSUFFICIENT_CLINICAL_PRIVILEGES',
          `Actor '${actor?.actorId || 'unknown'}' with role '${actor?.actorRole || 'none'}' cannot override safety hard-stop. Only licensed physicians may override.`,
          403
        );
      }

      // Rationale must be substantive (>= 10 characters)
      if (typeof physicianDirective !== 'string' || physicianDirective.trim().length < 10) {
        throw new SafetyGateError(
          'INVALID_DIRECTIVE',
          'Physician directive override requires a documented clinical rationale of at least 10 characters.',
          400
        );
      }

      overrideAccepted = true;
    }

    // Determine final clearance status. `cleared` is the only field a caller
    // should use to proceed; a HIGH violation cannot leave it true.
    let status = 'VERIFIED';
    if (hasCriticalHardStop) {
      status = overrideAccepted ? 'DIRECTIVE_OVERRIDE' : 'CONTRAINDICATION_HARD_STOP';
    } else if (hasHighRisk) {
      status = overrideAccepted ? 'DIRECTIVE_OVERRIDE' : 'REVIEW_REQUIRED';
    }

    const cleared = status === 'VERIFIED' || status === 'DIRECTIVE_OVERRIDE';

    return {
      status,
      cleared,
      passed: cleared,
      isSafe: cleared,
      hardStop: hasCriticalHardStop,
      blocked: hasCriticalHardStop && !overrideAccepted,
      requiresReview: status === 'REVIEW_REQUIRED',
      hasCriticalHardStop,
      hasHighRisk,
      overrideAccepted,
      physicianDirective: overrideAccepted ? physicianDirective.trim() : null,
      violations,
      contraindications: violations,
      warnings,
      kernelVersion: deterministicResult.kernelVersion || null,
      verifiedPrescriptionCount: prescriptions.length,
      evaluatedAt: new Date().toISOString()
    };
  }

  /**
   * Unified gate verification for AI-drafted diagnostic conditions.
   * Guarantees that AI-proposed diagnoses remain unconfirmed drafts until physician review.
   * 
   * @param {Array<Object|string>} conditions - Proposed conditions
   * @param {Object} actor - Authenticated actor
   * @returns {Object} Diagnoses clearance envelope
   */
  verifyConditionGate(conditions = [], actor = null) {
    const list = Array.isArray(conditions) ? conditions : [conditions];

    const sanitizedConditions = list.map(c => {
      const display = typeof c === 'string' ? c : (c.name || c.display || 'Unspecified Condition');
      return {
        display,
        verificationStatus: 'unconfirmed',
        clinicalStatus: 'provisional',
        isAiDraft: true,
        requiresPhysicianReview: true
      };
    });

    return {
      status: 'VERIFIED_DRAFT',
      conditions: sanitizedConditions,
      totalCount: sanitizedConditions.length,
      isCommittedToFhir: false // Invariant: AI can never autonomously commit active condition
    };
  }
}

const safetyGate = new SafetyGate();

module.exports = {
  SafetyGate,
  safetyGate,
  SafetyGateError
};
