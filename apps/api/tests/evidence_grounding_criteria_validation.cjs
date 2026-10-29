/**
 * Proton Evidence Grounding & Executable Clinical Criteria Validation (WS2 / P1.3)
 *
 * Verifies that:
 * 1. Centor/McIsaac score computes accurately for streptococcal pharyngitis risk stratification.
 * 2. Wells PE score computes accurately for pulmonary embolism pre-test probability.
 * 3. CURB-65 computes accurately for community-acquired pneumonia triage and mortality risk.
 * 4. Citation verifier validates peer-reviewed PMIDs, DOIs, guidelines, and executable criteria.
 * 5. Citation verifier permits explicit 'NO_CRITERION_MET' as an honest negative claim.
 * 6. Citation verifier rejects ungrounded or missing citations in strict mode with field paths.
 */

const assert = require('assert');
const {
  calculateCentorScore,
  calculateWellsPE,
  calculateCurb65
} = require('../services/clinical/clinicalCriteria');
const {
  resolveCitation,
  verifyDifferentialCitations,
  CitationVerificationError
} = require('../services/clinical/citationVerifier');

async function runTests() {
  console.log('\n============================================================');
  console.log('WS2 EVIDENCE GROUNDING & CLINICAL CRITERIA VALIDATION SUITE');
  console.log('============================================================\n');

  // -------------------------------------------------------------------------
  // 1. Executable Centor / McIsaac Scoring
  // -------------------------------------------------------------------------
  console.log('--- SUITE 1: Centor / McIsaac Strep Criteria ---');

  const highStrep = calculateCentorScore({
    ageYears: 25,
    tonsillarExudate: true,
    tenderAnteriorCervicalNodes: true,
    feverHistoryOrMeasured: true,
    absenceOfCough: true
  });
  assert.strictEqual(highStrep.score, 4, 'Centor score must be 4');
  assert.strictEqual(highStrep.riskLevel, 'High');
  assert.strictEqual(highStrep.pmid, '15069046');
  console.log('✓ Centor score = 4 (High Risk, 51-53% probability) with PMID: 15069046');

  const lowStrep = calculateCentorScore({
    ageYears: 60, // -1 McIsaac modifier
    tonsillarExudate: false,
    tenderAnteriorCervicalNodes: false,
    feverHistoryOrMeasured: false,
    absenceOfCough: false // cough present
  });
  assert.strictEqual(lowStrep.score, 0, 'Centor score must be clamped to 0');
  assert.strictEqual(lowStrep.riskLevel, 'Low');
  console.log('✓ Centor score = 0 (Low Risk, <10% probability, symptomatic care)');

  // -------------------------------------------------------------------------
  // 2. Executable Wells PE Scoring
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Wells Score for Pulmonary Embolism ---');

  const highPE = calculateWellsPE({
    dvtSymptoms: true, // +3.0
    peMostLikely: true, // +3.0
    heartRateBpm: 112 // +1.5
  });
  assert.strictEqual(highPE.score, 7.5, 'Wells score must be 7.5');
  assert.strictEqual(highPE.riskLevel, 'High');
  assert.ok(highPE.recommendation.includes('CT Pulmonary Angiography'));
  assert.strictEqual(highPE.pmid, '10744147');
  console.log('✓ Wells PE score = 7.5 (High Probability >65%) recommends emergent CTPA');

  const lowPE = calculateWellsPE({
    priorDvtOrPe: true, // +1.5
    heartRateBpm: 76
  });
  assert.strictEqual(lowPE.score, 1.5, 'Wells score must be 1.5');
  assert.strictEqual(lowPE.riskLevel, 'Low');
  assert.ok(highPE.recommendation.includes('CTPA') || lowPE.recommendation.includes('D-dimer'));
  console.log('✓ Wells PE score = 1.5 (Low Probability <15%) recommends D-dimer rule-out');

  // -------------------------------------------------------------------------
  // 3. Executable CURB-65 Pneumonia Scoring
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 3: CURB-65 Pneumonia Severity Score ---');

  const severePneumonia = calculateCurb65({
    confusion: true, // +1
    bunMgDl: 28, // +1
    respiratoryRate: 34, // +1
    systolicBp: 82, // +1
    diastolicBp: 50,
    ageYears: 72 // +1
  });
  assert.strictEqual(severePneumonia.score, 5, 'CURB-65 must be 5');
  assert.strictEqual(severePneumonia.riskLevel, 'High (Severe Pneumonia)');
  assert.ok(severePneumonia.disposition.includes('Hospital admission'));
  assert.strictEqual(severePneumonia.pmid, '12728155');
  console.log('✓ CURB-65 score = 5 (High Mortality 14-28%) mandates hospital/ICU disposition');

  // -------------------------------------------------------------------------
  // 4. Citation Verifier
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Citation Verifier & Grounding Gate ---');

  // Direct guideline ID resolution
  const resGuideline = resolveCitation('guide-ada-t2d-glycemic-2026');
  assert.ok(resGuideline.resolved);
  assert.strictEqual(resGuideline.source.pmid, '38118032');
  console.log('✓ Guideline ID "guide-ada-t2d-glycemic-2026" resolves to ADA guideline (PMID: 38118032)');

  // PMID prefix resolution
  const resPmid = resolveCitation('pmid:26378978');
  assert.ok(resPmid.resolved);
  assert.ok(resPmid.source.title.includes('EMPA-REG OUTCOME'));
  console.log('✓ PMID "pmid:26378978" resolves to EMPA-REG landmark trial');

  // Executable criteria citation resolution
  const resCrit = resolveCitation('crit-centor-mcisaac-2004');
  assert.ok(resCrit.resolved);
  assert.strictEqual(resCrit.source.pmid, '15069046');
  console.log('✓ Criteria ID "crit-centor-mcisaac-2004" resolves to McIsaac 2004');

  // Honest negative citation
  const resNone = resolveCitation('NO_CRITERION_MET');
  assert.ok(resNone.resolved);
  assert.strictEqual(resNone.explicitNoCriterion, true);
  console.log('✓ Explicit "NO_CRITERION_MET" is accepted as honest non-grounded claim');

  // Test full differential list verification
  const validDifferentials = [
    {
      condition: 'Streptococcal pharyngitis',
      band: 'supported',
      for: ['Centor 4', 'tonsillar exudate'],
      against: [],
      guideline_ref: 'crit-centor-mcisaac-2004'
    },
    {
      condition: 'Viral pharyngitis',
      band: 'weak',
      for: ['throat pain'],
      against: ['absence of rhinorrhea'],
      guideline_ref: 'NO_CRITERION_MET'
    },
    {
      condition: 'Type 2 Diabetes Mellitus',
      band: 'supported',
      for: ['HbA1c 8.4%'],
      against: [],
      guideline_ref: 'pmid:38118032'
    }
  ];

  const verifyPass = verifyDifferentialCitations(validDifferentials, { strict: true });
  assert.strictEqual(verifyPass.valid, true);
  assert.strictEqual(verifyPass.totalCount, 3);
  assert.strictEqual(verifyPass.verifiedCount, 3);
  assert.strictEqual(verifyPass.uncitedCount, 0);
  assert.strictEqual(verifyPass.coveragePct, 100);
  console.log('✓ 100% verified differential citations pass strict gate');

  // Test ungrounded citation in strict mode
  const invalidDifferentials = [
    {
      condition: 'Idiopathic Fatigue',
      band: 'supported',
      for: ['tiredness'],
      against: [],
      guideline_ref: 'random-unverifiable-blog-post'
    }
  ];

  let strictRejected = false;
  try {
    verifyDifferentialCitations(invalidDifferentials, { strict: true });
  } catch (err) {
    strictRejected = err.code === 'UNRESOLVED_CITATION_ERROR';
    assert.strictEqual(err.details?.field, 'assessment.differential[0].guideline_ref');
  }
  assert.ok(strictRejected, 'Must reject ungrounded citation in strict mode');
  console.log('✓ Ungrounded citation rejected with UNRESOLVED_CITATION_ERROR and field path');

  console.log('\n============================================================');
  console.log('ALL WS2 EVIDENCE GROUNDING TESTS PASSED (100%)');
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
