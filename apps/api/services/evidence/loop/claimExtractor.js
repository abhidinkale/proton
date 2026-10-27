/**
 * Proton Claim Extractor
 * Phase 4: Atomic Claim Extraction
 *
 * Decomposes unstructured reasoning text and structured hypotheses into
 * verifiable, atomic clinical claims.
 * Identifies causation, absolute language, and references to pending tests.
 */

const { ClinicalClaim } = require('./claimModel');

const CAUSATION_PATTERNS = [
  /\bcauses?\b/i,
  /\bcaused by\b/i,
  /\bdue to\b/i,
  /\bresulted in\b/i,
  /\bresults in\b/i,
  /\bled to\b/i,
  /\betiology of\b/i,
  /\bpathogenesis of\b/i,
  /\bproves?\b/i,
  /\binduced\b/i
];

const ABSOLUTE_PATTERNS = [
  /\bpathognomonic\b/i,
  /\bdefinitively\b/i,
  /\bdefinitive\b/i,
  /\bconfirms?\b/i,
  /\bconfirmed\b/i,
  /\b100%\b/i,
  /\bruled? out completely\b/i,
  /\bdiagnostic of\b/i,
  /\bindisputable\b/i,
  /\bwithout question\b/i
];

class ClaimExtractor {
  constructor() {
    this.name = 'ProtonClaimExtractor';
  }

  /**
   * Decomposes clinical reasoning objects and text into atomic claims.
   * @param {Object} params - { hypotheses, narrative, factStore }
   * @returns {Array<ClinicalClaim>}
   */
  extract({ hypotheses = [], narrative = '', factStore = null }) {
    const claims = [];
    let claimCounter = 1;

    const pendingFacts = factStore ? factStore.findPendingFacts() : [];
    const observedFacts = factStore ? factStore.findObservedFacts() : [];

    // 1. Extract claims from structured hypotheses
    for (const [idx, hyp] of hypotheses.entries()) {
      const hypId = hyp.id || hyp.hypothesis_id || `H-${String(idx + 1).padStart(3, '0')}`;
      const conditionName = hyp.condition || hyp.diagnosis || 'Unknown Diagnosis';

      // Claim A: Primary Diagnostic Proposition
      const diagClaimText = `${conditionName} is considered as a working hypothesis for the patient's presentation.`;
      const isDiagCausal = this._hasCausation(hyp.clinicalRationale || '');
      const hasAbsolute = this._hasAbsoluteLanguage(hyp.clinicalRationale || '') || this._hasAbsoluteLanguage(conditionName);

      claims.push(new ClinicalClaim({
        claim_id: `CLAIM-${String(claimCounter++).padStart(3, '0')}`,
        hypothesis_id: hypId,
        type: 'DIAGNOSTIC_CRITERION',
        claim_text: diagClaimText,
        subject: conditionName,
        predicate: 'hypothesized_for_presentation',
        patient_fact_ids: hyp.supporting_fact_ids || [],
        is_causal: isDiagCausal,
        has_absolute_language: hasAbsolute,
        is_pending_test_asserted: this._referencesPendingFact(conditionName, pendingFacts)
      }));

      // Claim B: Supporting Evidence Linkages
      if (Array.isArray(hyp.supportingEvidence)) {
        for (const sup of hyp.supportingEvidence) {
          const supText = typeof sup === 'string' ? sup : sup.text || JSON.stringify(sup);
          const causal = this._hasCausation(supText);
          const absolute = this._hasAbsoluteLanguage(supText);
          const pendingAsserted = this._referencesPendingFact(supText, pendingFacts);

          // Find matching patient fact IDs
          const matchedFactIds = this._matchPatientFacts(supText, observedFacts);

          claims.push(new ClinicalClaim({
            claim_id: `CLAIM-${String(claimCounter++).padStart(3, '0')}`,
            hypothesis_id: hypId,
            type: causal ? 'PATIENT_CAUSATION' : 'MEDICAL_ASSOCIATION',
            claim_text: supText,
            subject: conditionName,
            predicate: causal ? 'caused_by' : 'associated_with',
            patient_fact_ids: matchedFactIds,
            is_causal: causal,
            has_absolute_language: absolute,
            is_pending_test_asserted: pendingAsserted
          }));
        }
      }
    }

    // 2. Extract claims from free-form narrative / clinical formulation
    if (narrative && typeof narrative === 'string') {
      const sentences = narrative.split(/(?<=[.!?\n])\s+/);
      for (const sent of sentences) {
        const trimmed = sent.trim();
        if (trimmed.length < 15) continue;

        const causal = this._hasCausation(trimmed);
        const absolute = this._hasAbsoluteLanguage(trimmed);
        const pendingAsserted = this._referencesPendingFact(trimmed, pendingFacts);

        // Only promote clinically meaningful sentences as claims
        if (causal || absolute || pendingAsserted || /\b(?:diagnos|suggest|indicat|treat|prescrib|risk|etiolog)\b/i.test(trimmed)) {
          const matchedFactIds = this._matchPatientFacts(trimmed, observedFacts);

          claims.push(new ClinicalClaim({
            claim_id: `CLAIM-${String(claimCounter++).padStart(3, '0')}`,
            type: causal ? 'PATIENT_CAUSATION' : 'MEDICAL_ASSOCIATION',
            claim_text: trimmed,
            subject: 'Clinical Formulation',
            predicate: causal ? 'asserts_causation' : 'asserts_association',
            patient_fact_ids: matchedFactIds,
            is_causal: causal,
            has_absolute_language: absolute,
            is_pending_test_asserted: pendingAsserted
          }));
        }
      }
    }

    return claims;
  }

  _hasCausation(text) {
    return CAUSATION_PATTERNS.some(pat => pat.test(text));
  }

  _hasAbsoluteLanguage(text) {
    return ABSOLUTE_PATTERNS.some(pat => pat.test(text));
  }

  _referencesPendingFact(text, pendingFacts) {
    if (!pendingFacts || pendingFacts.length === 0) return false;
    const lower = text.toLowerCase();
    for (const pf of pendingFacts) {
      const nameTokens = pf.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length > 3);
      if (nameTokens.length > 0 && nameTokens.some(t => lower.includes(t))) {
        return true;
      }
    }
    return false;
  }

  _matchPatientFacts(text, observedFacts) {
    if (!observedFacts || observedFacts.length === 0) return [];
    const lower = text.toLowerCase();
    const matched = [];
    for (const fact of observedFacts) {
      const tokens = fact.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length > 3);
      if (tokens.length > 0 && tokens.some(t => lower.includes(t))) {
        matched.push(fact.fact_id);
      }
    }
    return Array.from(new Set(matched));
  }
}

module.exports = {
  ClaimExtractor,
  claimExtractor: new ClaimExtractor()
};
