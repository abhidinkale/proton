/**
 * Proton Clinical Reasoning & Evidence Grounding Engine
 * Phase 3 & 4: Atomic Claim Model
 *
 * Defines the atomic verifiable claim structure.
 * Never verifies an entire clinical paragraph as a single unit.
 */

const crypto = require('crypto');

const CLAIM_TYPES = [
  'MEDICAL_ASSOCIATION',
  'PATIENT_CAUSATION',
  'DIAGNOSTIC_CRITERION',
  'TREATMENT_INDICATION',
  'PROGNOSTIC',
  'OBSERVATION'
];

const CLAIM_VERIFICATION_STATUSES = [
  'SUPPORTED',
  'PARTIALLY_SUPPORTED',
  'CONTRADICTED',
  'NOT_FOUND',
  'OUT_OF_SCOPE',
  'NOT_ESTABLISHED'
];

class ClinicalClaim {
  constructor({
    claim_id,
    hypothesis_id = null,
    type = 'MEDICAL_ASSOCIATION',
    claim_text,
    subject = '',
    predicate = '',
    patient_fact_ids = [],
    external_source_ids = [],
    verification_status = 'NOT_ESTABLISHED',
    verification_notes = '',
    is_causal = false,
    has_absolute_language = false,
    is_pending_test_asserted = false,
    supporting_passage = null
  }) {
    if (!claim_id) {
      throw new Error('ClinicalClaim requires a unique claim_id (e.g. CLAIM-001).');
    }
    if (!claim_text || typeof claim_text !== 'string') {
      throw new Error('ClinicalClaim requires a valid claim_text.');
    }
    if (!CLAIM_TYPES.includes(type)) {
      throw new Error(`Invalid claim type: "${type}". Must be one of: ${CLAIM_TYPES.join(', ')}`);
    }

    this.claim_id = claim_id;
    this.hypothesis_id = hypothesis_id;
    this.type = type;
    this.claim_text = claim_text.trim();
    this.subject = subject.trim();
    this.predicate = predicate.trim();
    this.patient_fact_ids = Array.isArray(patient_fact_ids) ? [...patient_fact_ids] : [];
    this.external_source_ids = Array.isArray(external_source_ids) ? [...external_source_ids] : [];
    this.verification_status = verification_status;
    this.verification_notes = verification_notes;
    this.is_causal = Boolean(is_causal);
    this.has_absolute_language = Boolean(has_absolute_language);
    this.is_pending_test_asserted = Boolean(is_pending_test_asserted);
    this.supporting_passage = supporting_passage;
    this.created_at = new Date().toISOString();
  }

  isSupported() {
    return this.verification_status === 'SUPPORTED';
  }

  isPartiallySupported() {
    return this.verification_status === 'PARTIALLY_SUPPORTED';
  }

  isContradicted() {
    return this.verification_status === 'CONTRADICTED';
  }

  isNotEstablished() {
    return this.verification_status === 'NOT_ESTABLISHED' || this.verification_status === 'NOT_FOUND';
  }

  setVerification(status, notes = '', passage = null, sourceIds = []) {
    if (!CLAIM_VERIFICATION_STATUSES.includes(status)) {
      throw new Error(`Invalid verification status: ${status}`);
    }
    this.verification_status = status;
    this.verification_notes = notes;
    if (passage) this.supporting_passage = passage;
    if (sourceIds.length > 0) {
      this.external_source_ids = Array.from(new Set([...this.external_source_ids, ...sourceIds]));
    }
  }

  toJSON() {
    return {
      claim_id: this.claim_id,
      hypothesis_id: this.hypothesis_id,
      type: this.type,
      claim_text: this.claim_text,
      subject: this.subject,
      predicate: this.predicate,
      patient_fact_ids: this.patient_fact_ids,
      external_source_ids: this.external_source_ids,
      verification_status: this.verification_status,
      verification_notes: this.verification_notes,
      is_causal: this.is_causal,
      has_absolute_language: this.has_absolute_language,
      is_pending_test_asserted: this.is_pending_test_asserted,
      supporting_passage: this.supporting_passage,
      created_at: this.created_at
    };
  }
}

module.exports = {
  CLAIM_TYPES,
  CLAIM_VERIFICATION_STATUSES,
  ClinicalClaim
};
