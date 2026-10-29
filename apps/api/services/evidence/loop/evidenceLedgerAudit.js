/**
 * Proton Evidence Ledger & Cryptographic Audit Trail
 * Phase 20: Full Provenance Tracking
 *
 * Implements tamper-evident audit ledger:
 * Every claim is cryptographically linked to:
 * - Patient Fact IDs
 * - Authoritative External Source IDs
 * - Exact Supporting Passages
 * - Verification Verdict & Rule Checkpoints
 * - SHA-256 Signature
 */

const crypto = require('crypto');

class EvidenceLedgerAudit {
  constructor() {
    this.name = 'ProtonEvidenceLedgerAudit';
  }

  /**
   * Generates a tamper-evident cryptographic audit ledger for the diagnostic run.
   * @param {Object} params - { patientId, factStore, claims, retrievedSources, safetyResult, revisions }
   * @returns {Object} Complete cryptographic audit envelope
   */
  generateAuditLedger({
    patientId = 'P-UNKNOWN',
    factStore = null,
    claims = [],
    retrievedSources = [],
    safetyResult = {},
    revisions = {}
  }) {
    const timestamp = new Date().toISOString();
    const ledgerEntries = [];

    for (const claim of claims) {
      const claimId = claim.claim_id || claim.claimId;
      const claimText = claim.revised_text || claim.claim_text;
      const status = claim.verification_status || 'NOT_ESTABLISHED';

      // Find linked patient facts
      const linkedFacts = (claim.patient_fact_ids || []).map(fId => {
        const fact = factStore ? factStore.getFact(fId) : null;
        return fact ? { fact_id: fact.fact_id, name: fact.name, status: fact.status, span: fact.source.text_span } : { fact_id: fId };
      });

      // Find linked external sources
      const linkedSources = (claim.external_source_ids || []).map(sId => {
        const src = retrievedSources.find(s => s.source_id === sId);
        return src ? { source_id: src.source_id, title: src.title, tier: src.source_tier, passage: src.passage } : { source_id: sId };
      });

      // Compute cryptographic entry hash
      const entryRaw = `${claimId}|${claimText}|${status}|${JSON.stringify(linkedFacts)}|${JSON.stringify(linkedSources)}|${timestamp}`;
      const signature = crypto.createHash('sha256').update(entryRaw).digest('hex');

      ledgerEntries.push({
        claimId,
        claimText,
        verificationStatus: status,
        verificationNotes: claim.verification_notes || '',
        supportingPassage: claim.supporting_passage || null,
        linkedPatientFacts: linkedFacts,
        linkedExternalSources: linkedSources,
        entrySignature: signature
      });
    }

    // A single hash over the ordered entry signatures. This is not a Merkle
    // tree and has no inclusion proofs; call it what it is, a ledger root hash.
    const combinedSignatures = ledgerEntries.map(e => e.entrySignature).join(':');
    const rootLedgerHash = crypto.createHash('sha256').update(`${patientId}|${timestamp}|${combinedSignatures}`).digest('hex');

    return {
      auditStandard: 'PROTON_EVIDENCE_LOOP_PROVENANCE_V1',
      patientId,
      timestamp,
      totalClaimsAudited: ledgerEntries.length,
      safetyGateVerdict: safetyResult.gateStatus || 'EVALUATED',
      revisionsEnforced: revisions.totalRevisions || 0,
      rootLedgerHash,
      ledgerEntries
    };
  }
}

module.exports = {
  EvidenceLedgerAudit,
  evidenceLedgerAudit: new EvidenceLedgerAudit()
};
