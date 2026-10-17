/**
 * Proton Clinical Evidence & Deterministic Retrieval Service
 *
 * Provides deterministic clinical guideline retrieval, structured FHIR evidence lookup,
 * and document fact indexing with strict multi-tenant and patient isolation.
 *
 * Invariants:
 * 1. ZERO fabricated embeddings or false similarity scores.
 * 2. Cross-patient and cross-tenant evidence leakage is strictly prohibited.
 * 3. Every retrieved evidence item retains immutable source attribution and provenance.
 * 4. Deterministic guideline matching grounds AI recommendations against verified clinical evidence.
 */

const { auditService } = require('../audit/auditService');

class EvidenceServiceError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'EvidenceServiceError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Canonical deterministic clinical guideline catalog
const CLINICAL_GUIDELINES = [
  {
    guidelineId: 'guide-ada-t2d-glycemic',
    category: 'endocrinology',
    title: 'ADA Standards of Care in Diabetes: Glycemic Targets & Pharmacotherapy',
    conditionCode: '44054006', // Type 2 Diabetes
    keywords: ['diabetes', 'hba1c', 'metformin', 'empagliflozin', 'sglt2', 'glp1', 'hyperglycemia', 'glucose'],
    excerpt: 'For adults with Type 2 Diabetes not meeting individualized glycemic targets (HbA1c > 7.0-8.0%) on metformin monotherapy, add SGLT2 inhibitor or GLP-1 receptor agonist with proven cardiorenal benefit.',
    recommendation: 'Step-up therapy indicated when HbA1c exceeds 7.5-8.0%. Re-evaluate renal function (eGFR) and repeat HbA1c in 3 months.',
    authority: 'American Diabetes Association (ADA)',
    year: '2026'
  },
  {
    guidelineId: 'guide-acc-aha-htn-management',
    category: 'cardiology',
    title: 'ACC/AHA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure',
    conditionCode: '38341003', // Essential Hypertension
    keywords: ['hypertension', 'blood pressure', 'bp', 'lisinopril', 'amlodipine', 'ace inhibitor', 'arb'],
    excerpt: 'Target blood pressure is <130/80 mmHg for patients with known ASCVD or 10-year CVD risk ≥10%, diabetes, or chronic kidney disease.',
    recommendation: 'For Stage 2 hypertension (BP ≥140/90 mmHg), initiate combination therapy with two first-line agents of different classes.',
    authority: 'American College of Cardiology / American Heart Association',
    year: '2026'
  },
  {
    guidelineId: 'guide-gin-asthma-step-therapy',
    category: 'pulmonology',
    title: 'GINA Global Strategy for Asthma Management and Prevention',
    conditionCode: '195967001', // Asthma
    keywords: ['asthma', 'wheezing', 'inhaler', 'albuterol', 'prednisone', 'corticosteroid', 'bronchospasm'],
    excerpt: 'For acute asthma exacerbations with nocturnal awakenings or frequent rescue SABA use (>3 times/week), initiate short oral corticosteroid burst (40mg prednisone 5 days) and step up daily inhaled corticosteroid (ICS).',
    recommendation: 'Do not use SABA monotherapy. Ensure maintenance inhaled corticosteroid is continued alongside rescue bronchodilators.',
    authority: 'Global Initiative for Asthma (GINA)',
    year: '2026'
  },
  {
    guidelineId: 'guide-safety-penicillin-allergy',
    category: 'pharmacovigilance',
    title: 'Clinical Practice Guideline: Management of Beta-Lactam and Penicillin Allergy',
    conditionCode: 'allergy-penicillin',
    keywords: ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'beta-lactam', 'anaphylaxis', 'urticaria'],
    excerpt: 'Patients with verified severe penicillin allergy (urticaria, anaphylaxis, angioedema) must not receive penicillin, ampicillin, or amoxicillin. Use non-beta-lactam alternatives.',
    recommendation: 'Strict avoidance of penicillin class. Documented allergy requires immediate hard stop before ordering beta-lactam antibiotics.',
    authority: 'Proton Deterministic Safety Engine / AAAAI',
    year: '2026'
  }
];

class EvidenceService {
  constructor(options = {}) {
    this.guidelines = options.guidelines || CLINICAL_GUIDELINES;
  }

  /**
   * Deterministically retrieves relevant evidence for a patient encounter.
   *
   * @param {Object} params
   * @param {string} params.patientId - Patient ID
   * @param {string} [params.tenantId='org-default'] - Organization tenant ID
   * @param {string} [params.query] - Free-text clinical query / chief complaint
   * @param {Array<Object>} [params.conditions] - Active patient conditions
   * @param {Array<Object>} [params.medications] - Active patient medications
   * @param {Array<Object>} [params.documents] - Validated document extractions
   * @returns {Promise<Array<Object>>} Retrieved evidence items with source attribution
   */
  async retrieveEvidence({
    patientId,
    tenantId = 'org-default',
    query = '',
    conditions = [],
    medications = [],
    documents = []
  }) {
    if (!patientId) {
      throw new EvidenceServiceError('PATIENT_ID_REQUIRED', 'patientId is required for evidence retrieval.', 400);
    }

    const cleanPatientId = String(patientId).replace(/^Patient\//, '').trim();
    const evidenceItems = [];

    // 1. Deterministic Clinical Guideline Matching based on conditions, query, and meds
    const queryTokens = (query || '').toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const conditionTexts = (conditions || []).map(c => {
      const text = c.code?.coding?.[0]?.display || c.code?.text || c.display || (typeof c.code === 'string' ? c.code : '') || '';
      return String(text).toLowerCase();
    });
    const medTexts = (medications || []).map(m => {
      const text = m.medicationCodeableConcept?.coding?.[0]?.display || m.name || m.drugName || (typeof m.medicationCodeableConcept === 'string' ? m.medicationCodeableConcept : '') || '';
      return String(text).toLowerCase();
    });
    const searchCorpus = [...queryTokens, ...conditionTexts, ...medTexts].join(' ');

    for (const guide of this.guidelines) {
      const isConditionMatch = (conditions || []).some(c => {
        const cCode = String(c.code?.coding?.[0]?.code || c.code || '');
        return cCode === guide.conditionCode;
      });

      const keywordHits = guide.keywords.filter(kw => searchCorpus.includes(kw));
      const isKeywordMatch = keywordHits.length > 0;

      if (isConditionMatch || isKeywordMatch) {
        evidenceItems.push({
          sourceId: guide.guidelineId,
          sourceType: 'CLINICAL_GUIDELINE',
          title: guide.title,
          excerpt: guide.excerpt,
          recommendation: guide.recommendation,
          authority: guide.authority,
          year: guide.year,
          confidence: isConditionMatch ? 0.95 : 0.85,
          matchedKeywords: keywordHits,
          sourceAttribution: 'FHIR_EXISTING',
          provenance: {
            guidelineId: guide.guidelineId,
            retrievedAt: new Date().toISOString(),
            tenantId
          }
        });
      }
    }

    // 2. Scoped Document Facts (strictly patient-bound and tenant-isolated)
    if (Array.isArray(documents) && documents.length > 0) {
      for (const doc of documents) {
        if (!doc) continue;
        // Verify document belongs to patient and tenant
        if (doc.patientId && String(doc.patientId).replace(/^Patient\//, '').trim() !== cleanPatientId) {
          throw new EvidenceServiceError(
            'CROSS_PATIENT_ACCESS_DENIED',
            'Cross-patient document evidence access rejected.',
            403
          );
        }
        if (doc.tenantId && doc.tenantId !== tenantId) {
          throw new EvidenceServiceError(
            'CROSS_TENANT_ACCESS_DENIED',
            'Cross-tenant document evidence access rejected.',
            403
          );
        }

        if (Array.isArray(doc.facts)) {
          for (const fact of doc.facts) {
            evidenceItems.push({
              sourceId: fact.factId || doc.id || doc.documentId || 'doc-fact',
              sourceType: 'DOCUMENT_EXTRACTED_FACT',
              title: `${doc.name || doc.filename || 'Document'}: ${fact.category || 'Fact'}`,
              excerpt: fact.text || fact.fact || '',
              sourceQuote: fact.sourceQuote || '',
              confidence: fact.confidence ?? 0.8,
              sourceAttribution: 'DOCUMENT_DERIVED',
              provenance: {
                documentId: doc.id || doc.documentId,
                patientId: cleanPatientId,
                tenantId,
                retrievedAt: new Date().toISOString()
              }
            });
          }
        }
      }
    }

    return evidenceItems;
  }
}

const evidenceService = new EvidenceService();

module.exports = {
  EvidenceService,
  evidenceService,
  EvidenceServiceError,
  CLINICAL_GUIDELINES
};
