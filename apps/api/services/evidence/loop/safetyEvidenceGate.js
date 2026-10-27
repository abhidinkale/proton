/**
 * Proton Safety Evidence Gate
 * Phase 18: Deterministic Safety & Evidence Gate
 *
 * Implements the 10 Mandatory Deterministic Blocking Rules:
 * 1. Patient fact has no source.
 * 2. Pending test is treated as positive or confirmed.
 * 3. Hypothesis is presented as confirmed without sufficient evidence.
 * 4. Causal statement lacks causal evidence.
 * 5. Exact probability has no basis.
 * 6. Citation does not support the claim.
 * 7. High-risk treatment lacks verification.
 * 8. Contradictory case evidence is ignored.
 * 9. Unknown information is silently filled.
 * 10. Model claims a test is definitive without appropriate basis.
 */

class SafetyEvidenceGate {
  constructor() {
    this.name = 'ProtonSafetyEvidenceGate';
  }

  /**
   * Evaluates the entire reasoning output against the 10 deterministic safety rules.
   * @param {Object} payload - { claims, factStore, differential, treatments, citations }
   * @returns {Object} { passed: boolean, infractions: Array, score: number }
   */
  evaluate(payload = {}) {
    const {
      claims = [],
      factStore = null,
      differential = [],
      treatments = [],
      citations = []
    } = payload;

    const infractions = [];
    const pendingFacts = factStore ? factStore.findPendingFacts() : [];
    const observedFacts = factStore ? factStore.findObservedFacts() : [];

    // --- RULE 1: Patient Fact Without Source ---
    for (const claim of claims) {
      if (claim.type === 'OBSERVATION' && claim.patient_fact_ids.length === 0) {
        infractions.push({
          ruleNumber: 1,
          ruleName: 'NO_SOURCE_NO_FACT',
          severity: 'BLOCKING',
          claimId: claim.claim_id,
          message: `Claim "${claim.claim_text}" asserts patient observation without a verified source pointer.`
        });
      }
    }

    // --- RULE 2: Pending Test Treated as Positive / Confirmed ---
    for (const pf of pendingFacts) {
      const pfNameTokens = pf.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length > 3);
      for (const claim of claims) {
        const cLower = claim.claim_text.toLowerCase();
        const matchesTest = pfNameTokens.some(t => cLower.includes(t));
        if (matchesTest) {
          const affirmsPositive = /\b(?:positive|abnormal|elevated|deficient|diagnostic|confirms?|indicates? toxicity|caused)\b/i.test(cLower);
          const acknowledgesPending = /\b(?:pending|awaiting|ordered|unconfirmed|hypothesis|not yet returned)\b/i.test(cLower);
          if (affirmsPositive && !acknowledgesPending) {
            infractions.push({
              ruleNumber: 2,
              ruleName: 'PENDING_TEST_HALLUCINATION',
              severity: 'BLOCKING',
              claimId: claim.claim_id,
              message: `Pending test "${pf.name}" is asserted as positive or diagnostic in: "${claim.claim_text}".`
            });
          }
        }
      }
    }

    // --- RULE 3: Hypothesis Presented as Confirmed Without Gold Standard ---
    for (const diag of differential) {
      const cond = diag.condition || diag.diagnosis || '';
      const prob = String(diag.probability || diag.confidence || '');
      if (/\b(?:confirmed|definitive|100%|established fact)\b/i.test(prob)) {
        infractions.push({
          ruleNumber: 3,
          ruleName: 'UNPROVEN_HYPOTHESIS_CONFIRMATION',
          severity: 'BLOCKING',
          diagnosis: cond,
          message: `Diagnosis "${cond}" is labeled as confirmed/definitive without histological or gold-standard proof.`
        });
      }
    }

    // --- RULE 4: Causal Statement Lacks Patient Causal Evidence ---
    for (const claim of claims) {
      if (claim.is_causal && !claim.isSupported()) {
        infractions.push({
          ruleNumber: 4,
          ruleName: 'UNSUPPORTED_CAUSAL_LEAP',
          severity: 'BLOCKING',
          claimId: claim.claim_id,
          message: `Causal assertion in "${claim.claim_text}" is not supported by verified patient-level physiological evidence.`
        });
      }
    }

    // --- RULE 5: Exact Pseudo-Probability Lacks Likelihood Ratio Basis ---
    for (const diag of differential) {
      const probStr = String(diag.probability || '');
      // Match arbitrary exact percentages like 98%, 99%, 43%
      const match = probStr.match(/\b(\d{1,3})%/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > 95) {
          infractions.push({
            ruleNumber: 5,
            ruleName: 'FALSE_PRECISION_OVERCONFIDENCE',
            severity: 'BLOCKING',
            diagnosis: diag.condition,
            message: `Pseudo-precise probability ${val}% assigned to "${diag.condition}" exceeds empirical calibration limit without validated LR.`
          });
        }
      }
    }

    // --- RULE 6: Citation Does Not Support Claim ---
    for (const claim of claims) {
      if (claim.verification_status === 'CONTRADICTED') {
        infractions.push({
          ruleNumber: 6,
          ruleName: 'CITATION_CONTRADICTS_CLAIM',
          severity: 'BLOCKING',
          claimId: claim.claim_id,
          message: `Claim "${claim.claim_text}" is contradicted by authoritative medical evidence.`
        });
      }
    }

    // --- RULE 7: High-Risk Treatment Lacks Verification ---
    for (const t of treatments) {
      if (t.tier === 'HIGH_RISK_SPECIALIST_ONLY' && t.clearanceStatus !== 'CLEARED' && t.clearanceStatus !== 'HELD_PENDING_CONFIRMATION') {
        infractions.push({
          ruleNumber: 7,
          ruleName: 'UNVERIFIED_HIGH_RISK_TREATMENT',
          severity: 'BLOCKING',
          drug: t.drugName,
          message: `High-risk intervention "${t.drugName}" was authorized without prerequisite diagnostic verification.`
        });
      }
    }

    // --- RULE 8: Contradictory Case Evidence Ignored ---
    const negFacts = factStore ? factStore.findNegativeFacts() : [];
    if (negFacts.length > 0 && differential.length > 0) {
      const topDiag = differential[0];
      const hasContradictionSection = topDiag.refutingFactors && topDiag.refutingFactors.length > 0;
      if (!hasContradictionSection) {
        infractions.push({
          ruleNumber: 8,
          ruleName: 'IGNORED_CONTRADICTION',
          severity: 'WARNING',
          diagnosis: topDiag.condition,
          message: `Primary diagnosis "${topDiag.condition}" fails to address documented negative/contradictory findings.`
        });
      }
    }

    // --- RULE 9: Unknown Information Silently Assumed ---
    for (const claim of claims) {
      if (claim.isNotEstablished() && !claim.allowedWording) {
        infractions.push({
          ruleNumber: 9,
          ruleName: 'SILENT_ASSUMPTION_OF_UNKNOWN',
          severity: 'WARNING',
          claimId: claim.claim_id,
          message: `Claim "${claim.claim_text}" lacks evidence and must explicitly declare UNKNOWN / NOT_ESTABLISHED.`
        });
      }
    }

    // --- RULE 10: Model Claims Test is Definitive Without Basis ---
    for (const claim of claims) {
      if (claim.has_absolute_language && claim.isNotEstablished()) {
        infractions.push({
          ruleNumber: 10,
          ruleName: 'FALSE_DEFINITIVE_TEST_CLAIM',
          severity: 'BLOCKING',
          claimId: claim.claim_id,
          message: `Claim "${claim.claim_text}" asserts a test is definitive without requisite gold-standard criteria.`
        });
      }
    }

    const blockingCount = infractions.filter(inf => inf.severity === 'BLOCKING').length;
    const passed = blockingCount === 0;

    return {
      passed,
      blockingCount,
      warningCount: infractions.length - blockingCount,
      infractions,
      gateStatus: passed ? 'PASSED_DETERMINISTIC_EVIDENCE_GATE' : 'BLOCKED_BY_EVIDENCE_GATE'
    };
  }
}

module.exports = {
  SafetyEvidenceGate,
  safetyEvidenceGate: new SafetyEvidenceGate()
};
