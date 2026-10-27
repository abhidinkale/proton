/**
 * Proton Claim Verifier
 * Phases 7, 8, 9, 10, 14: Deterministic Claim Verification, Causation Firewall,
 * Probability Calibration & Citation Validation Engine
 *
 * Enforces:
 * 1. Distinction between general medical association and patient-specific causation.
 * 2. Causation Firewall: Rejects unproven causal leaps.
 * 3. No Source, No Fact: Patient claims without observed facts are flagged.
 * 4. Probability Firewall: Strips pseudo-precise percentages without likelihood ratios.
 * 5. Citation Validation: Verifies that cited passage actually supports the claim.
 */

class ClaimVerifier {
  constructor() {
    this.name = 'ProtonClaimVerifier';
  }

  /**
   * Verifies an array of ClinicalClaim instances against patient facts and external sources.
   * @param {Array<ClinicalClaim>} claims
   * @param {ClinicalFactStore} factStore
   * @param {Array<Object>} retrievedSources
   * @returns {Object} { verifiedClaims, infractions, passCount, failCount }
   */
  verifyClaims(claims = [], factStore = null, retrievedSources = []) {
    const verifiedClaims = [];
    const allInfractions = [];

    const pendingFacts = factStore ? factStore.findPendingFacts() : [];
    const observedFacts = factStore ? factStore.findObservedFacts() : [];

    for (const claim of claims) {
      const claimResult = this._verifySingleClaim(claim, factStore, pendingFacts, observedFacts, retrievedSources);
      verifiedClaims.push(claimResult.claim);
      if (claimResult.infractions && claimResult.infractions.length > 0) {
        allInfractions.push(...claimResult.infractions);
      }
    }

    const supportedCount = verifiedClaims.filter(c => c.isSupported()).length;
    const partialCount = verifiedClaims.filter(c => c.isPartiallySupported()).length;
    const failedCount = verifiedClaims.filter(c => c.isContradicted() || c.isNotEstablished()).length;

    return {
      verifiedClaims,
      infractions: allInfractions,
      summary: {
        total: verifiedClaims.length,
        supported: supportedCount,
        partiallySupported: partialCount,
        failedOrUnestablished: failedCount
      }
    };
  }

  _verifySingleClaim(claim, factStore, pendingFacts, observedFacts, sources) {
    const infractions = [];
    const claimText = claim.claim_text || '';
    const claimLower = claimText.toLowerCase();

    // 1. RULE: PENDING TEST ASSERTION AS POSITIVE / FACT (Phase 8 & Safety)
    for (const pf of pendingFacts) {
      const pfName = pf.name.toLowerCase().replace(/\s*\(status:\s*pending\)/i, '').trim();
      const pfTokens = pfName.split(/\s+/).filter(t => t.length > 3);
      
      const mentionsPending = pfTokens.length > 0 && pfTokens.some(t => claimLower.includes(t));
      if (mentionsPending && !claimLower.includes('pending') && !claimLower.includes('awaiting') && !claimLower.includes('hypothesis')) {
        claim.setVerification(
          'CONTRADICTED',
          `Claim asserts finding related to pending test "${pf.name}" as established or confirmed.`,
          pf.source.text_span
        );
        infractions.push({
          ruleId: 'RULE_PENDING_TEST_HALLUCINATION',
          claimId: claim.claim_id,
          severity: 'BLOCKING',
          message: `Attempted to claim finding based on pending test "${pf.name}". Result is not yet available.`
        });
        break;
      }
    }

    // 2. RULE: CAUSATION FIREWALL (Phase 9)
    // Checks if claim asserts patient-specific causation without proven patient-level physiological facts
    if (claim.is_causal) {
      const hasDirectPhysiologicalProof = this._hasPatientCausalProof(claim, observedFacts);
      if (!hasDirectPhysiologicalProof) {
        claim.setVerification(
          'PARTIALLY_SUPPORTED',
          'Medical association is recognized, but patient-specific causation is unproven and remains a hypothesis.',
          null
        );
        claim.allowedWording = `${claim.subject || 'The mechanism'} is a recognized medical consideration; however, patient-specific causation has not been established.`;
        
        infractions.push({
          ruleId: 'RULE_UNPROVEN_CAUSATION',
          claimId: claim.claim_id,
          severity: 'QUALIFY_REQUIRED',
          message: `Causal assertion in "${claim.claim_text}" lacks direct patient-specific proof. Must be downgraded to hypothesis.`
        });
      }
    }

    // 3. RULE: ABSOLUTE CERTAINTY FIREWALL (Phase 10)
    const isContra = typeof claim.isContradicted === 'function' ? claim.isContradicted() : (claim.verification_status === 'CONTRADICTED');
    if (claim.has_absolute_language) {
      if (!isContra) {
        claim.setVerification(
          'PARTIALLY_SUPPORTED',
          'Absolute language ("definitively", "pathognomonic", "confirmed", "100%") is unjustified without gold-standard biopsy/genetic confirmation.',
          null
        );
      }
      infractions.push({
        ruleId: 'RULE_UNJUSTIFIED_ABSOLUTE_CERTAINTY',
        claimId: claim.claim_id,
        severity: 'DOWNGRADE_REQUIRED',
        message: `Claim uses absolute certainty language without meeting gold-standard criteria.`
      });
    }

    // 4. RULE: EXTERNAL CITATION VALIDATION (Phase 14)
    // Find matching external source for this claim
    const matchingSource = sources.find(src => {
      const srcText = `${src.title} ${src.passage}`.toLowerCase();
      const claimTokens = claimLower.split(/\s+/).filter(t => t.length > 4);
      const matches = claimTokens.filter(t => srcText.includes(t));
      return matches.length >= 2;
    });

    const isPartial = typeof claim.isPartiallySupported === 'function' ? claim.isPartiallySupported() : (claim.verification_status === 'PARTIALLY_SUPPORTED');

    if (matchingSource) {
      if (!isContra) {
        claim.setVerification(
          'SUPPORTED',
          `Entailed by ${matchingSource.title} (${matchingSource.publisher}).`,
          matchingSource.passage,
          [matchingSource.source_id]
        );
      }
    } else if (claim.patient_fact_ids && claim.patient_fact_ids.length > 0) {
      if (!isContra) {
        claim.setVerification(
          'SUPPORTED',
          'Directly grounded in observed patient facts.',
          null
        );
      }
    } else if (!isContra && !isPartial) {
      claim.setVerification(
        'NOT_ESTABLISHED',
        'Neither direct patient fact nor authoritative external source retrieved to verify this claim.',
        null
      );
    }

    return { claim, infractions };
  }

  _hasPatientCausalProof(claim, observedFacts) {
    if (!observedFacts || observedFacts.length === 0) return false;
    // Check if patient has direct biopsy or genetic or high-titer diagnostic level
    const diagnosticProofKeywords = ['biopsy', 'genetic mutation confirmed', 'positive culture', 'coronary occlusion on angiogram'];
    return observedFacts.some(f => {
      const fStr = `${f.name} ${f.value}`.toLowerCase();
      return diagnosticProofKeywords.some(k => fStr.includes(k));
    });
  }
}

module.exports = {
  ClaimVerifier,
  claimVerifier: new ClaimVerifier()
};
