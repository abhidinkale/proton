/**
 * Proton Clinical Reasoning & Evidence Grounding Engine
 * Phase 1: Canonical Atomic Clinical Fact Intermediate Representation (IR)
 *
 * Design Rule:
 * Every patient-specific factual statement must originate from an immutable ClinicalFact.
 * The reasoning LLM is NEVER the source of truth for patient facts.
 */

const crypto = require('crypto');

const FACT_CATEGORIES = [
  'laboratory',
  'vital',
  'symptom',
  'sign',
  'imaging',
  'exposure',
  'medication',
  'history',
  'demographic',
  'pathology'
];

const FACT_STATUSES = [
  'OBSERVED',
  'NEGATIVE',
  'PENDING',
  'UNKNOWN',
  'NOT_AVAILABLE',
  'CONTRADICTED',
  'HISTORICAL'
];

class ClinicalFact {
  constructor({
    fact_id,
    patient_id = 'P-UNKNOWN',
    category,
    name,
    value = null,
    unit = null,
    reference_range = null,
    timestamp = new Date().toISOString(),
    status = 'OBSERVED',
    source = {},
    metadata = {}
  }) {
    if (!fact_id) {
      throw new Error('ClinicalFact requires a unique fact_id (e.g. F-001).');
    }
    if (!category || !FACT_CATEGORIES.includes(category)) {
      throw new Error(`Invalid ClinicalFact category: "${category}". Must be one of: ${FACT_CATEGORIES.join(', ')}`);
    }
    if (!name || typeof name !== 'string') {
      throw new Error('ClinicalFact requires a valid name string.');
    }
    if (!status || !FACT_STATUSES.includes(status)) {
      throw new Error(`Invalid ClinicalFact status: "${status}". Must be one of: ${FACT_STATUSES.join(', ')}`);
    }

    this.fact_id = fact_id;
    this.patient_id = patient_id;
    this.category = category;
    this.name = name.trim();
    this.value = value;
    this.unit = unit;
    this.reference_range = reference_range;
    this.timestamp = timestamp;
    this.status = status;
    this.source = {
      document_id: source.document_id || 'PATIENT_RECORD',
      page: source.page ?? 1,
      section: source.section || 'General',
      text_span: source.text_span || `${name}: ${value !== null ? value : status}`
    };
    this.metadata = metadata;
    
    // Compute cryptographic integrity hash
    this.contentHash = this._calculateHash();
    Object.freeze(this.source);
    Object.freeze(this);
  }

  _calculateHash() {
    const raw = `${this.fact_id}|${this.patient_id}|${this.category}|${this.name}|${JSON.stringify(this.value)}|${this.status}|${this.source.text_span}`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
  }

  isPending() {
    return this.status === 'PENDING';
  }

  isObserved() {
    return this.status === 'OBSERVED';
  }

  isNegative() {
    return this.status === 'NEGATIVE';
  }

  isContradicted() {
    return this.status === 'CONTRADICTED';
  }

  isUnknownOrUnavailable() {
    return this.status === 'UNKNOWN' || this.status === 'NOT_AVAILABLE';
  }

  toJSON() {
    return {
      fact_id: this.fact_id,
      patient_id: this.patient_id,
      category: this.category,
      name: this.name,
      value: this.value,
      unit: this.unit,
      reference_range: this.reference_range,
      timestamp: this.timestamp,
      status: this.status,
      source: this.source,
      metadata: this.metadata,
      contentHash: this.contentHash
    };
  }
}

class ClinicalFactStore {
  constructor(patient_id = 'P-DEFAULT') {
    this.patient_id = patient_id;
    this.facts = new Map();
    this._nextId = 1;
  }

  addFact(factParams) {
    const factId = factParams.fact_id || `F-${String(this._nextId++).padStart(3, '0')}`;
    const fact = new ClinicalFact({
      ...factParams,
      fact_id: factId,
      patient_id: this.patient_id
    });
    this.facts.set(fact.fact_id, fact);
    return fact;
  }

  getFact(fact_id) {
    return this.facts.get(fact_id) || null;
  }

  hasFact(fact_id) {
    return this.facts.has(fact_id);
  }

  findFactsByName(nameQuery) {
    const q = nameQuery.toLowerCase().trim();
    return Array.from(this.facts.values()).filter(f => f.name.toLowerCase().includes(q));
  }

  findFactsByCategory(category) {
    return Array.from(this.facts.values()).filter(f => f.category === category);
  }

  findPendingFacts() {
    return Array.from(this.facts.values()).filter(f => f.isPending());
  }

  findObservedFacts() {
    return Array.from(this.facts.values()).filter(f => f.isObserved());
  }

  findNegativeFacts() {
    return Array.from(this.facts.values()).filter(f => f.isNegative());
  }

  getAllFacts() {
    return Array.from(this.facts.values());
  }

  size() {
    return this.facts.size;
  }

  toJSON() {
    return {
      patient_id: this.patient_id,
      count: this.facts.size,
      facts: Array.from(this.facts.values()).map(f => f.toJSON())
    };
  }
}

module.exports = {
  FACT_CATEGORIES,
  FACT_STATUSES,
  ClinicalFact,
  ClinicalFactStore
};
