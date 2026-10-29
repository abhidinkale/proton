/**
 * Clinical knowledge index — deterministic keyword retrieval.
 *
 * This is not a vector store. There is no embedding model, no pgvector column,
 * and no cosine similarity: scoring is token overlap over a curated, cited
 * knowledge base. That is enough for the one thing the cockpit needs — given a
 * presentation, surface the guideline that mentions it — and it is honest.
 *
 * The previous module was named `pgvectorClinicalMemory`, claimed 768-dim HNSW
 * search, and computed a 64-slot hash as an "embedding". A hash is not an
 * embedding and a bucket count is not a dimension. Semantic retrieval is a
 * later, real feature: an actual model, an actual `vector` column, and an
 * evaluation set. Until then, keyword overlap with citations.
 */

const auditRepository = require('../../storage/auditRepository');

const KNOWLEDGE_BASE = [
  {
    id: 'kb-ada-sglt2-glp1-2026',
    category: 'guideline',
    condition: 'Type 2 Diabetes Mellitus',
    title: 'ADA Standards of Care 2026: Pharmacotherapy for Glycemic & Cardiorenal Protection',
    authority: 'American Diabetes Association (ADA)',
    year: '2026',
    pmid: '38118032',
    doi: '10.2337/dc26-S009',
    keywords: ['diabetes', 'hba1c', 'jardiance', 'empagliflozin', 'sglt2', 'glp1', 'metformin', 'hyperglycemia', 'cardiorenal', 'kidney'],
    excerpt:
      'For adults with Type 2 Diabetes not meeting individualized glycemic targets (HbA1c > 7.0-8.0%) on metformin monotherapy, add an SGLT2 inhibitor or GLP-1 receptor agonist with proven cardiorenal benefit, independent of baseline HbA1c.',
    clinicalAction:
      'Step up therapy to an SGLT2 inhibitor (e.g. empagliflozin 10 mg) and re-evaluate eGFR and HbA1c in 90 days.'
  },
  {
    id: 'kb-empa-reg-landmark',
    category: 'landmark_trial',
    condition: 'Type 2 Diabetes & Cardiovascular Disease',
    title: 'Empagliflozin, Cardiovascular Outcomes, and Mortality in Type 2 Diabetes (EMPA-REG OUTCOME)',
    authority: 'New England Journal of Medicine (NEJM)',
    year: '2015',
    pmid: '26378978',
    doi: '10.1056/NEJMoa1504720',
    keywords: ['empagliflozin', 'jardiance', 'cardiovascular mortality', 'heart failure', 'cvd', 't2d', 'death reduction'],
    excerpt:
      'Patients with Type 2 diabetes and high cardiovascular risk receiving empagliflozin had lower rates of death from cardiovascular causes and hospitalization for heart failure.',
    clinicalAction:
      'Empagliflozin 10 mg or 25 mg daily for patients with T2D and established CVD to reduce heart-failure hospitalization.'
  },
  {
    id: 'kb-aha-hypertension-2024',
    category: 'guideline',
    condition: 'Essential Hypertension',
    title: 'AHA/ACC Guidelines for the Prevention, Detection, and Management of High Blood Pressure',
    authority: 'American Heart Association (AHA)',
    year: '2024',
    pmid: '29146077',
    doi: '10.1161/HYP.0000000000000065',
    keywords: ['hypertension', 'blood pressure', 'lisinopril', 'amlodipine', 'ace inhibitor', 'arb', 'stage 2 hypertension'],
    excerpt:
      'For adults with Stage 2 hypertension (BP >= 140/90 mmHg) and an average BP more than 20/10 mmHg above target, initiation with 2 first-line agents of different classes is recommended.',
    clinicalAction:
      'Initiate dual therapy (e.g. ACE inhibitor/ARB + calcium channel blocker or thiazide diuretic).'
  },
  {
    id: 'kb-idsa-pneumonia-cap',
    category: 'guideline',
    condition: 'Community-Acquired Pneumonia (CAP)',
    title: 'Diagnosis and Treatment of Adults with Community-Acquired Pneumonia: ATS/IDSA Guideline',
    authority: 'Infectious Diseases Society of America (IDSA) / ATS',
    year: '2019',
    pmid: '31573350',
    doi: '10.1164/rccm.201908-1581ST',
    keywords: ['pneumonia', 'cough', 'fever', 'dyspnea', 'augmentin', 'amoxicillin', 'azithromycin', 'respiratory infection'],
    excerpt:
      'In outpatient adults with comorbidities, combination therapy with amoxicillin/clavulanate and a macrolide is recommended.',
    clinicalAction:
      'Amoxicillin-clavulanate 875/125 mg twice daily + azithromycin 500 mg then 250 mg daily for 5-7 days.'
  },
  {
    id: 'kb-kdigo-ckd-2024',
    category: 'guideline',
    condition: 'Chronic Kidney Disease (CKD)',
    title: 'KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of CKD',
    authority: 'Kidney Disease: Improving Global Outcomes (KDIGO)',
    year: '2024',
    pmid: '38490803',
    doi: '10.1016/j.kack.2024.01.001',
    keywords: ['ckd', 'kidney', 'creatinine', 'egfr', 'albuminuria', 'sglt2', 'ace inhibitor', 'proteinuria'],
    excerpt:
      'Treat patients with T2D, CKD, and an eGFR >= 20 ml/min per 1.73 m2 with an SGLT2 inhibitor; SGLT2 inhibitors slow CKD progression.',
    clinicalAction: 'Maintain SGLT2 inhibitor therapy down to an eGFR of 20 mL/min/1.73m2.'
  }
];

/** Token-overlap score. Deterministic, explainable, and cheap. */
function score(queryTokens, item) {
  let hits = 0;
  for (const keyword of item.keywords) {
    if (queryTokens.some((token) => token.includes(keyword) || keyword.includes(token))) hits += 1;
  }
  if (queryTokens.some((token) => item.condition.toLowerCase().includes(token))) hits += 2;
  return hits;
}

class ClinicalKnowledgeIndex {
  constructor() {
    this.name = 'ClinicalKnowledgeIndex';
    this.version = '1.0.0';
    this.method = 'deterministic_keyword_overlap';
  }

  /**
   * Retrieve cited references for a presentation.
   * @returns {Promise<{engine: string, method: string, matches: Array}>}
   */
  async search(query = '', { limit = 3, tenantId = 'org-default' } = {}) {
    const startedAt = Date.now();
    const tokens = String(query)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2);

    const matches = KNOWLEDGE_BASE.map((item) => ({ item, hits: score(tokens, item) }))
      .filter((entry) => entry.hits > 0)
      .sort((a, b) => b.hits - a.hits || a.item.id.localeCompare(b.item.id))
      .slice(0, Math.min(Math.max(limit, 1), 10))
      .map(({ item, hits }) => ({ ...item, matched_keywords: hits }));

    try {
      auditRepository.recordAuditEvent({
        action: 'CLINICAL_KNOWLEDGE_SEARCH',
        actorId: 'ClinicalKnowledgeIndex',
        actorRole: 'retrieval',
        actorName: 'Proton clinical knowledge index',
        patientId: null,
        tenantId,
        summary: `Keyword retrieval: "${String(query).slice(0, 40)}" (${matches.length} matches, ${Date.now() - startedAt}ms)`
      });
    } catch {
      // Auditing must not fail a read.
    }

    return {
      engine: this.name,
      version: this.version,
      method: this.method,
      query,
      latency_ms: Date.now() - startedAt,
      total_indexed: KNOWLEDGE_BASE.length,
      matches
    };
  }
}

module.exports = { ClinicalKnowledgeIndex, clinicalKnowledgeIndex: new ClinicalKnowledgeIndex() };
