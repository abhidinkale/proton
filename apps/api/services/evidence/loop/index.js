/**
 * Proton Clinical Evidence Loop & Grounding Engine
 * Public Package Exports
 */

const { ClinicalFact, ClinicalFactStore, FACT_CATEGORIES, FACT_STATUSES } = require('./clinicalFact');
const { EvidenceGraph } = require('./evidenceGraph');
const { CaseCompiler, caseCompiler } = require('./caseCompiler');
const { ClinicalClaim, CLAIM_TYPES, CLAIM_VERIFICATION_STATUSES } = require('./claimModel');
const { ClaimExtractor, claimExtractor } = require('./claimExtractor');
const { EvidenceAcquisitionService, evidenceAcquisitionService, SOURCE_TIERS } = require('./evidenceAcquisitionService');
const { ClaimVerifier, claimVerifier } = require('./claimVerifier');
const { ContradictionEngine, contradictionEngine } = require('./contradictionEngine');
const { TreatmentEvidenceGate, treatmentEvidenceGate } = require('./treatmentEvidenceGate');
const { SafetyEvidenceGate, safetyEvidenceGate } = require('./safetyEvidenceGate');
const { ReasoningRevisionLoop, reasoningRevisionLoop } = require('./reasoningRevisionLoop');
const { EvidenceLedgerAudit, evidenceLedgerAudit } = require('./evidenceLedgerAudit');
const { EvidenceLoopPipeline, evidenceLoopPipeline } = require('./evidenceLoopPipeline');

module.exports = {
  // Fact Layer
  ClinicalFact,
  ClinicalFactStore,
  FACT_CATEGORIES,
  FACT_STATUSES,
  caseCompiler,
  // Graph & Claim Layer
  EvidenceGraph,
  ClinicalClaim,
  CLAIM_TYPES,
  CLAIM_VERIFICATION_STATUSES,
  claimExtractor,
  // Evidence Acquisition Layer
  EvidenceAcquisitionService,
  evidenceAcquisitionService,
  SOURCE_TIERS,
  // Verification & Gate Layer
  claimVerifier,
  contradictionEngine,
  treatmentEvidenceGate,
  safetyEvidenceGate,
  // Revision & Audit Layer
  reasoningRevisionLoop,
  evidenceLedgerAudit,
  // Master Orchestrator Pipeline
  EvidenceLoopPipeline,
  evidenceLoopPipeline
};
