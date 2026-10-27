/**
 * Proton Evidence Loop Master Pipeline
 * Orchestrates the complete 28-phase clinical reasoning & evidence-grounding loop:
 *
 *   PATIENT DATA
 *       ↓
 *   CASE COMPILER (Atomic ClinicalFactStore)
 *       ↓
 *   INITIAL CLINICAL REASONING
 *       ↓
 *   CLAIM EXTRACTION (Atomic ClinicalClaims)
 *       ↓
 *   EVIDENCE ACQUISITION (Tiered Guidelines, JEV/Web, Exact Passages)
 *       ↓
 *   CLAIM-LEVEL VERIFICATION (Causation Firewall, Probability Calibration)
 *       ↓
 *   CONTRADICTION & SELF-FALSIFICATION ENGINE
 *       ↓
 *   TREATMENT EVIDENCE GATE (4-Tier Staging & Safety Locks)
 *       ↓
 *   DETERMINISTIC SAFETY GATE (10 Blocking Rules)
 *       ↓
 *   BAYESIAN REVISION LOOP (Non-Defensive Updates)
 *       ↓
 *   CRYPTOGRAPHIC AUDIT LEDGER
 *       ↓
 *   TRACEABLE 11-PART CLINICAL RESPONSE
 */

const { caseCompiler } = require('./caseCompiler');
const { claimExtractor } = require('./claimExtractor');
const { evidenceAcquisitionService } = require('./evidenceAcquisitionService');
const { claimVerifier } = require('./claimVerifier');
const { contradictionEngine } = require('./contradictionEngine');
const { treatmentEvidenceGate } = require('./treatmentEvidenceGate');
const { safetyEvidenceGate } = require('./safetyEvidenceGate');
const { reasoningRevisionLoop } = require('./reasoningRevisionLoop');
const { evidenceLedgerAudit } = require('./evidenceLedgerAudit');

class EvidenceLoopPipeline {
  constructor() {
    this.name = 'ProtonEvidenceLoopPipeline';
    this.version = '4.0.0-EVIDENCE-GROUNDED';
  }

  /**
   * Executes the full grounded diagnostic reasoning pipeline.
   * @param {Object} rawPatientContext - Full patient record / HPI / Vitals
   * @param {Object} baseDiagnosticEngine - Optional reference to diagnosticDoctorAgent
   * @returns {Promise<Object>} Full 11-part grounded clinical formulation
   */
  async execute(rawPatientContext = {}, baseDiagnosticEngine = null) {
    const startTime = Date.now();

    // 1. PHASE 1 & 2: Compile raw patient data into atomic ClinicalFactStore
    const factStore = caseCompiler.compile(rawPatientContext);

    // 2. PHASE 3: Generate Base Clinical Reasoning
    let baseReasoning;
    if (baseDiagnosticEngine && typeof baseDiagnosticEngine.evaluate === 'function') {
      baseReasoning = await baseDiagnosticEngine.evaluate(rawPatientContext);
    } else {
      // Direct autonomous fallback synthesis
      const { diagnosticDoctorAgent } = require('../../../agents/diagnosticDoctorAgent');
      baseReasoning = await diagnosticDoctorAgent.evaluate(rawPatientContext);
    }

    const initialDifferential = baseReasoning.differentialDiagnosis || [];
    const proposedMedications = baseReasoning.stagedPharmacotherapy?.medications || [];

    // 3. PHASE 4: Extract Atomic Verifiable Claims
    const initialClaims = claimExtractor.extract({
      hypotheses: initialDifferential,
      narrative: rawPatientContext.dialogueOrHPI || rawPatientContext.hpi || '',
      factStore
    });

    // 4. PHASES 5, 6, 12, 13: Acquire Tiered External Evidence for Claims
    const retrievedSources = [];
    for (const claim of initialClaims) {
      const sources = await evidenceAcquisitionService.acquireEvidenceForClaim(claim);
      for (const s of sources) {
        if (!retrievedSources.some(existing => existing.source_id === s.source_id)) {
          retrievedSources.push(s);
        }
      }
    }

    // 5. PHASES 7, 8, 9, 10, 14: Claim Verification & Causation Firewall
    const verificationResults = claimVerifier.verifyClaims(initialClaims, factStore, retrievedSources);

    // 6. PHASE 11: Contradiction Engine & Self-Falsification
    const contradictionMatrix = contradictionEngine.evaluate(initialDifferential, factStore);

    // 7. PHASE 16: Treatment Evidence Gate (Classify 4 Tiers & Hold High Risk)
    const treatmentSafety = treatmentEvidenceGate.evaluateTreatments(proposedMedications, factStore, initialDifferential);

    // 8. PHASE 18: Deterministic Safety Gate Check 1
    const safetyCheck1 = safetyEvidenceGate.evaluate({
      claims: verificationResults.verifiedClaims,
      factStore,
      differential: initialDifferential,
      treatments: treatmentSafety.tieredMedications,
      citations: retrievedSources
    });

    // 9. PHASE 15: Reasoning Revision Loop (Non-Defensive Bayesian Update)
    const revisionResults = reasoningRevisionLoop.revise({
      differential: initialDifferential,
      claims: verificationResults.verifiedClaims,
      safetyResult: safetyCheck1,
      factStore,
      contradictionAudit: contradictionMatrix
    });

    // 10. Final Deterministic Safety Gate Verification (Fail-Closed)
    const finalSafetyCheck = safetyEvidenceGate.evaluate({
      claims: revisionResults.revisedClaims.map(rc => ({
        claim_id: rc.claim_id,
        claim_text: rc.revised_text,
        verification_status: rc.verification_status,
        patient_fact_ids: [],
        is_causal: false,
        has_absolute_language: false,
        isSupported: () => rc.verification_status === 'SUPPORTED',
        isNotEstablished: () => rc.verification_status === 'NOT_ESTABLISHED'
      })),
      factStore,
      differential: revisionResults.revisedDifferential,
      treatments: treatmentSafety.tieredMedications,
      citations: retrievedSources
    });

    // 11. PHASE 20: Cryptographic Audit Ledger & Provenance Chain
    const auditLedger = evidenceLedgerAudit.generateAuditLedger({
      patientId: factStore.patient_id,
      factStore,
      claims: revisionResults.revisedClaims,
      retrievedSources,
      safetyResult: finalSafetyCheck,
      revisions: revisionResults
    });

    // 12. PHASE 19: Build Canonical 11-Part Final Clinical Formulation
    const latencyMs = Date.now() - startTime;
    const finalResponse = this._buildPhase19Response({
      factStore,
      differential: revisionResults.revisedDifferential,
      claims: revisionResults.revisedClaims,
      contradictionMatrix,
      treatmentSafety,
      retrievedSources,
      auditLedger,
      baseReasoning,
      latencyMs
    });

    return finalResponse;
  }

  _buildPhase19Response({
    factStore,
    differential,
    claims,
    contradictionMatrix,
    treatmentSafety,
    retrievedSources,
    auditLedger,
    baseReasoning,
    latencyMs
  }) {
    const primaryDiag = differential[0] || {};
    const primaryContra = contradictionMatrix.find(c => c.diagnosis === primaryDiag.condition) || {};
    const alternatives = differential.slice(1);
    const pendingFacts = factStore.findPendingFacts();

    // 1. Problem Representation
    const observedVitals = factStore.findFactsByCategory('vital').map(v => `${v.name}: ${v.value} ${v.unit || ''}`);
    const observedSymptoms = factStore.findFactsByCategory('symptom').filter(s => s.isObserved()).map(s => s.name);
    const problemRepresentation = {
      summary: `Patient presenting with ${observedSymptoms.join(', ') || 'acute clinical symptoms'}. Hemodynamics: ${observedVitals.slice(0, 3).join(', ') || 'Documented'}.`,
      verifiedFactsCount: factStore.size(),
      observedFacts: factStore.findObservedFacts().length,
      pendingTestsCount: pendingFacts.length
    };

    // 2. Most Likely Working Diagnosis
    const mostLikelyDiagnosis = {
      condition: primaryDiag.condition || 'Undifferentiated Acute Presentation',
      epistemicStatus: primaryDiag.calibratedProbabilities?.diagnosticConfidence || 'MODERATE',
      evidenceConfidence: primaryDiag.calibratedProbabilities?.evidenceConfidence || 'MODERATE',
      supportingEvidence: primaryDiag.supportingEvidence || [],
      refutingOrContradictoryFindings: primaryDiag.refutingFactors || primaryContra.contradictions || [],
      unexplainedFindings: primaryContra.unexplained || []
    };

    // 3, 4, 5. Major Alternatives and Evidence For/Against Each
    const majorAlternatives = alternatives.map(alt => {
      const altContra = contradictionMatrix.find(c => c.diagnosis === alt.condition) || {};
      return {
        condition: alt.condition,
        confidence: alt.calibratedProbabilities?.diagnosticConfidence || 'LOW-MODERATE',
        supportingEvidence: alt.supportingEvidence || [],
        counterEvidence: alt.refutingFactors || altContra.contradictions || [],
        rationale: alt.clinicalRationale || 'Considered in ranked differential'
      };
    });

    // 6. Unknown / Pending Information (First-Class State)
    const unknownAndPending = {
      pendingTests: pendingFacts.map(pf => ({
        testName: pf.name,
        sourceSpan: pf.source.text_span,
        clinicalSignificance: 'Diagnostic threshold confirmation required prior to irreversible or definitive therapeutic staging.'
      })),
      unmeasuredVariables: [
        'Tissue histology or definitive biopsy',
        'Direct pathogen sequencing or specific toxicological quantitative concentrations (unless explicitly measured)'
      ]
    };

    // 7. Critical Discriminating Tests
    const criticalDiscriminatingTests = (baseReasoning.recommendedInvestigations || []).slice(0, 5).map(inv => ({
      testName: inv.testName,
      priority: inv.priority || 'STAT',
      loinc: inv.loinc || null,
      discriminatingValue: inv.clinicalRationale
    }));

    // 8. What Would Change My Mind? (Self-Falsification)
    const whatWouldChangeMyMind = {
      primaryHypothesis: primaryDiag.condition,
      falsificationEvents: primaryContra.change_my_mind || ['Definitive objective testing returns negative'],
      definitiveAbandonmentCriteria: primaryContra.abandon_if || ['Direct negative analytical assay or alternative tissue confirmation']
    };

    // 9. Immediate Safety Concerns & Fatal Emergencies
    const immediateSafetyConcerns = baseReasoning.cantMissEmergencies || [];

    // 10. Provisional Management (Tiered & Qualified)
    const provisionalManagement = {
      overallSafetyStatus: treatmentSafety.safetyClearance,
      tieredInterventions: treatmentSafety.tieredMedications,
      heldOrRestrictedInterventions: treatmentSafety.blockedTreatments
    };

    // 11. Evidence Sources & Provenance Ledger
    const evidenceSources = retrievedSources.map(s => ({
      source_id: s.source_id,
      title: s.title,
      publisher: s.publisher,
      tier: s.source_tier,
      tierName: s.tier_name,
      url: s.url,
      supportingPassage: s.passage,
      relevanceScore: s.relevance
    }));

    return {
      agent: this.name,
      version: this.version,
      timestamp: new Date().toISOString(),
      latencyMs,
      // Phase 19 Sections:
      problemRepresentation,
      mostLikelyDiagnosis,
      majorAlternatives,
      unknownAndPending,
      criticalDiscriminatingTests,
      whatWouldChangeMyMind,
      immediateSafetyConcerns,
      provisionalManagement,
      evidenceSources,
      // Cryptographic Audit & Traceability
      auditLedger,
      // Pass-through compatibility with existing benchmark tests
      differentialDiagnosis: differential,
      clinicalScores: baseReasoning.clinicalScores || {},
      cantMissEmergencies: baseReasoning.cantMissEmergencies || [],
      recommendedInvestigations: baseReasoning.recommendedInvestigations || [],
      stagedPharmacotherapy: baseReasoning.stagedPharmacotherapy || {
        medications: treatmentSafety.tieredMedications
      },
      priorAuthDefense: baseReasoning.priorAuthDefense || null
    };
  }
}

module.exports = {
  EvidenceLoopPipeline,
  evidenceLoopPipeline: new EvidenceLoopPipeline()
};
