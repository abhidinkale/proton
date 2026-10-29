/**
 * Proton Executable Clinical Criteria Engine — WS2 (§6 / Gate 2 / P1.3)
 *
 * Implements deterministic clinical criteria calculators for outpatient decision support:
 * 1. Centor / McIsaac Score (Streptococcal Pharyngitis)
 * 2. Wells Score for Pulmonary Embolism (PE)
 * 3. CURB-65 Score for Pneumonia Severity
 *
 * Every output includes:
 * - score (number)
 * - riskLevel (string)
 * - probabilityRange (string)
 * - recommendation (string)
 * - citation (PMID / landmark validation)
 */

/**
 * Calculates Centor / McIsaac Score for Strep Pharyngitis.
 * Reference: McIsaac WJ et al. JAMA. 2004;291(13):1587-1595. PMID: 15069046.
 */
function calculateCentorScore({
  ageYears,
  tonsillarExudate = false,
  tenderAnteriorCervicalNodes = false,
  feverHistoryOrMeasured = false,
  absenceOfCough = false
}) {
  let score = 0;
  const criteriaMet = [];

  if (tonsillarExudate) {
    score += 1;
    criteriaMet.push('Tonsillar exudate (+1)');
  }
  if (tenderAnteriorCervicalNodes) {
    score += 1;
    criteriaMet.push('Tender anterior cervical adenopathy (+1)');
  }
  if (feverHistoryOrMeasured) {
    score += 1;
    criteriaMet.push('Fever > 38.0°C / 100.4°F (+1)');
  }
  if (absenceOfCough) {
    score += 1;
    criteriaMet.push('Absence of cough (+1)');
  }

  // McIsaac age modifier
  if (typeof ageYears === 'number') {
    if (ageYears >= 3 && ageYears <= 14) {
      score += 1;
      criteriaMet.push('Age 3–14 years (+1)');
    } else if (ageYears >= 15 && ageYears <= 44) {
      // 0 modifier
      criteriaMet.push('Age 15–44 years (0)');
    } else if (ageYears >= 45) {
      score -= 1;
      criteriaMet.push('Age ≥ 45 years (-1)');
    }
  }

  let riskLevel = 'Low';
  let probabilityRange = '<10%';
  let recommendation = 'No antibiotic or throat culture indicated; symptomatic care.';

  if (score >= 4) {
    riskLevel = 'High';
    probabilityRange = '51–53%';
    recommendation = 'Rapid Antigen Detection Test (RADT) and/or empiric antibiotic therapy indicated.';
  } else if (score === 3) {
    riskLevel = 'Intermediate-High';
    probabilityRange = '28–35%';
    recommendation = 'Perform RADT or throat culture; treat if positive.';
  } else if (score === 2) {
    riskLevel = 'Intermediate';
    probabilityRange = '11–17%';
    recommendation = 'Throat culture or RADT recommended; treat only if positive.';
  } else if (score === 1) {
    riskLevel = 'Low';
    probabilityRange = '5–10%';
    recommendation = 'Symptomatic treatment; testing rarely required.';
  }

  return {
    criterionId: 'crit-centor-mcisaac-2004',
    name: 'Centor / McIsaac Score',
    score: Math.max(0, score),
    rawScore: score,
    riskLevel,
    probabilityRange,
    criteriaMet,
    recommendation,
    version: '2004.1',
    pmid: '15069046',
    doi: '10.1001/jama.291.13.1587'
  };
}

/**
 * Calculates Wells Score for Pulmonary Embolism (PE).
 * Reference: Wells PS et al. Thromb Haemost. 2000;83(3):416-420. PMID: 10744147.
 */
function calculateWellsPE({
  dvtSymptoms = false,
  peMostLikely = false,
  heartRateBpm = null,
  recentImmobilizationOrSurgery = false,
  priorDvtOrPe = false,
  hemoptysis = false,
  activeMalignancy = false
}) {
  let score = 0.0;
  const criteriaMet = [];

  if (dvtSymptoms) {
    score += 3.0;
    criteriaMet.push('Clinical signs and symptoms of DVT (+3.0)');
  }
  if (peMostLikely) {
    score += 3.0;
    criteriaMet.push('PE is #1 diagnosis or equally likely (+3.0)');
  }
  if (typeof heartRateBpm === 'number' && heartRateBpm > 100) {
    score += 1.5;
    criteriaMet.push(`Tachycardia HR ${heartRateBpm} > 100 bpm (+1.5)`);
  }
  if (recentImmobilizationOrSurgery) {
    score += 1.5;
    criteriaMet.push('Immobilization ≥ 3 days or surgery in past 4 weeks (+1.5)');
  }
  if (priorDvtOrPe) {
    score += 1.5;
    criteriaMet.push('Previous objective DVT or PE (+1.5)');
  }
  if (hemoptysis) {
    score += 1.0;
    criteriaMet.push('Hemoptysis (+1.0)');
  }
  if (activeMalignancy) {
    score += 1.0;
    criteriaMet.push('Active malignancy or treatment within 6 months (+1.0)');
  }

  let riskLevel = 'Low';
  let probabilityRange = '<15%';
  let recommendation = 'Low probability: Order high-sensitivity D-dimer. If negative, PE excluded.';

  if (score > 6.0) {
    riskLevel = 'High';
    probabilityRange = '>65%';
    recommendation = 'High probability: Emergent CT Pulmonary Angiography (CTPA) indicated. Consider empiric anticoagulation.';
  } else if (score >= 2.0) {
    riskLevel = 'Moderate';
    probabilityRange = '30–40%';
    recommendation = 'Moderate probability: Order high-sensitivity D-dimer or proceed to CTPA based on clinical stability.';
  }

  return {
    criterionId: 'crit-wells-pe-2000',
    name: 'Wells Score for Pulmonary Embolism',
    score,
    riskLevel,
    probabilityRange,
    criteriaMet,
    recommendation,
    version: '2000.1',
    pmid: '10744147',
    doi: '10.1055/s-0037-1613830'
  };
}

/**
 * Calculates CURB-65 Score for Pneumonia Severity.
 * Reference: Lim WS et al. Thorax. 2003;58(5):377-382. PMID: 12728155.
 */
function calculateCurb65({
  confusion = false,
  bunMgDl = null,
  respiratoryRate = null,
  systolicBp = null,
  diastolicBp = null,
  ageYears = null
}) {
  let score = 0;
  const criteriaMet = [];

  if (confusion) {
    score += 1;
    criteriaMet.push('Confusion (abbreviated mental test score ≤ 8 or disorientation) (+1)');
  }
  if (typeof bunMgDl === 'number' && bunMgDl > 19) {
    score += 1;
    criteriaMet.push(`Urea: BUN ${bunMgDl} > 19 mg/dL (>7 mmol/L) (+1)`);
  }
  if (typeof respiratoryRate === 'number' && respiratoryRate >= 30) {
    score += 1;
    criteriaMet.push(`Respiratory rate ${respiratoryRate} ≥ 30 breaths/min (+1)`);
  }
  if (
    (typeof systolicBp === 'number' && systolicBp < 90) ||
    (typeof diastolicBp === 'number' && diastolicBp <= 60)
  ) {
    score += 1;
    criteriaMet.push('Blood pressure: SBP < 90 mmHg or DBP ≤ 60 mmHg (+1)');
  }
  if (typeof ageYears === 'number' && ageYears >= 65) {
    score += 1;
    criteriaMet.push(`Age ${ageYears} ≥ 65 years (+1)`);
  }

  let riskLevel = 'Low';
  let mortality30d = '0.6–2.7%';
  let disposition = 'Outpatient treatment feasible.';

  if (score >= 3) {
    riskLevel = 'High (Severe Pneumonia)';
    mortality30d = '14.0–27.8%';
    disposition = 'Hospital admission required. Urgent evaluation for ICU admission (score 4–5).';
  } else if (score === 2) {
    riskLevel = 'Moderate';
    mortality30d = '6.8–9.2%';
    disposition = 'Short inpatient stay or closely supervised outpatient management.';
  }

  return {
    criterionId: 'crit-curb65-pneumonia-2003',
    name: 'CURB-65 Pneumonia Severity Score',
    score,
    riskLevel,
    mortality30d,
    disposition,
    criteriaMet,
    version: '2003.1',
    pmid: '12728155',
    doi: '10.1136/thorax.58.5.377'
  };
}

module.exports = {
  calculateCentorScore,
  calculateWellsPE,
  calculateCurb65
};
