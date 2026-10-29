/**
 * Proton Citation Verifier — WS2 (§6 / Gate 2 / P1.3)
 *
 * Enforces that every differential entry in a clinical note or diagnostic proposal
 * cites a versioned clinical guideline, an executable criteria score, a verified
 * peer-reviewed PMID/DOI, or explicitly declares 'NO_CRITERION_MET'.
 *
 * Produces the moat metric: "0 uncited differentials; citation coverage % published".
 */

const { CLINICAL_GUIDELINES } = require('../evidence/evidenceService');
const { calculateCentorScore, calculateWellsPE, calculateCurb65 } = require('./clinicalCriteria');

class CitationVerificationError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = 'CitationVerificationError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Set of all registered authoritative citation keys
const AUTHORITATIVE_CITATIONS = new Map();

// 1. Index clinical guidelines from evidence service
for (const guide of CLINICAL_GUIDELINES) {
  AUTHORITATIVE_CITATIONS.set(guide.guidelineId.toLowerCase(), {
    id: guide.guidelineId,
    title: guide.title,
    authority: guide.authority,
    pmid: guide.pmid,
    doi: guide.doi
  });
  if (guide.pmid) {
    AUTHORITATIVE_CITATIONS.set(`pmid:${guide.pmid}`.toLowerCase(), guide);
    AUTHORITATIVE_CITATIONS.set(guide.pmid.toLowerCase(), guide);
  }
  if (guide.doi) {
    AUTHORITATIVE_CITATIONS.set(`doi:${guide.doi}`.toLowerCase(), guide);
    AUTHORITATIVE_CITATIONS.set(guide.doi.toLowerCase(), guide);
  }
}

// 2. Index executable criteria
const CRITERIA_REFS = [
  { id: 'crit-centor-mcisaac-2004', pmid: '15069046', doi: '10.1001/jama.291.13.1587', title: 'Centor / McIsaac Strep Criteria' },
  { id: 'crit-wells-pe-2000', pmid: '10744147', doi: '10.1055/s-0037-1613830', title: 'Wells Pulmonary Embolism Criteria' },
  { id: 'crit-curb65-pneumonia-2003', pmid: '12728155', doi: '10.1136/thorax.58.5.377', title: 'CURB-65 Pneumonia Severity Score' }
];

for (const crit of CRITERIA_REFS) {
  AUTHORITATIVE_CITATIONS.set(crit.id.toLowerCase(), crit);
  AUTHORITATIVE_CITATIONS.set(`pmid:${crit.pmid}`.toLowerCase(), crit);
  AUTHORITATIVE_CITATIONS.set(crit.pmid.toLowerCase(), crit);
  AUTHORITATIVE_CITATIONS.set(`doi:${crit.doi}`.toLowerCase(), crit);
  AUTHORITATIVE_CITATIONS.set(crit.doi.toLowerCase(), crit);
}

// Known common criteria aliases
AUTHORITATIVE_CITATIONS.set('centor', { id: 'crit-centor-mcisaac-2004' });
AUTHORITATIVE_CITATIONS.set('centor 3/4', { id: 'crit-centor-mcisaac-2004' });
AUTHORITATIVE_CITATIONS.set('centor 4', { id: 'crit-centor-mcisaac-2004' });
AUTHORITATIVE_CITATIONS.set('centor/mcisaac', { id: 'crit-centor-mcisaac-2004' });
AUTHORITATIVE_CITATIONS.set('wells pe', { id: 'crit-wells-pe-2000' });
AUTHORITATIVE_CITATIONS.set('wells score', { id: 'crit-wells-pe-2000' });
AUTHORITATIVE_CITATIONS.set('curb-65', { id: 'crit-curb65-pneumonia-2003' });
AUTHORITATIVE_CITATIONS.set('curb65', { id: 'crit-curb65-pneumonia-2003' });

/**
 * Resolves a citation reference to a verified authoritative source.
 * @param {string} ref
 * @returns {{ resolved: boolean, explicitNoCriterion: boolean, source?: object }}
 */
function resolveCitation(ref) {
  if (!ref || typeof ref !== 'string') {
    return { resolved: false, explicitNoCriterion: false };
  }
  const clean = ref.trim().toLowerCase();

  if (clean === 'no_criterion_met' || clean === 'none' || clean === 'no criterion met') {
    return { resolved: true, explicitNoCriterion: true, source: { id: 'NO_CRITERION_MET' } };
  }

  if (AUTHORITATIVE_CITATIONS.has(clean)) {
    return { resolved: true, explicitNoCriterion: false, source: AUTHORITATIVE_CITATIONS.get(clean) };
  }

  // Check prefix forms (pmid:12345678, doi:10.xxx)
  const pmidMatch = clean.match(/^(?:pmid:?\s*)?(\d{7,8})$/);
  if (pmidMatch && AUTHORITATIVE_CITATIONS.has(pmidMatch[1])) {
    return { resolved: true, explicitNoCriterion: false, source: AUTHORITATIVE_CITATIONS.get(pmidMatch[1]) };
  }

  return { resolved: false, explicitNoCriterion: false };
}

/**
 * Verifies that all differential entries in an assessment note or diagnostic proposal
 * have resolvable, grounded citations.
 *
 * @param {Array<object>} differentialArray
 * @param {{ strict?: boolean }} options
 * @returns {{ valid: boolean, totalCount: number, verifiedCount: number, uncitedCount: number, coveragePct: number, items: Array<object> }}
 */
function verifyDifferentialCitations(differentialArray, { strict = true } = {}) {
  if (!Array.isArray(differentialArray) || differentialArray.length === 0) {
    return {
      valid: true,
      totalCount: 0,
      verifiedCount: 0,
      uncitedCount: 0,
      coveragePct: 100,
      items: []
    };
  }

  const items = [];
  let verifiedCount = 0;
  let uncitedCount = 0;

  for (let i = 0; i < differentialArray.length; i++) {
    const entry = differentialArray[i];
    const condition = entry.condition || `differential[${i}]`;
    const ref = entry.guideline_ref || entry.citation || null;

    const resolution = resolveCitation(ref);
    if (resolution.resolved) {
      verifiedCount++;
      items.push({
        index: i,
        condition,
        guideline_ref: ref,
        status: resolution.explicitNoCriterion ? 'EXPLICIT_NO_CRITERION' : 'VERIFIED_CITATION',
        source: resolution.source
      });
    } else {
      uncitedCount++;
      const itemDetail = {
        index: i,
        condition,
        guideline_ref: ref,
        status: 'UNCITED_DIFFERENTIAL',
        error: `Differential '${condition}' lacks an authoritative citation or explicit 'NO_CRITERION_MET'.`
      };
      items.push(itemDetail);

      if (strict) {
        throw new CitationVerificationError(
          'UNRESOLVED_CITATION_ERROR',
          `Differential proposal #${i + 1} ('${condition}') has ungrounded citation '${ref || 'null'}'. Every differential must resolve to a valid guideline, PMID, criteria score, or 'NO_CRITERION_MET'.`,
          400,
          { field: `assessment.differential[${i}].guideline_ref`, item: itemDetail }
        );
      }
    }
  }

  const coveragePct = Number(((verifiedCount / differentialArray.length) * 100).toFixed(1));

  return {
    valid: uncitedCount === 0,
    totalCount: differentialArray.length,
    verifiedCount,
    uncitedCount,
    coveragePct,
    items
  };
}

module.exports = {
  CitationVerificationError,
  resolveCitation,
  verifyDifferentialCitations,
  AUTHORITATIVE_CITATIONS
};
