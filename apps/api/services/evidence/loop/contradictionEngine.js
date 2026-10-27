/**
 * Proton Contradiction Engine
 * Phase 11: Rigorous Self-Falsification & Contradiction Analysis
 *
 * For every leading hypothesis, systematically evaluates:
 * 1. Strongest supporting evidence
 * 2. Strongest contradictory / refuting evidence
 * 3. Unexplained findings that do not fit the hypothesis
 * 4. Missing discriminating evidence
 * 5. Strongest competing alternative diagnosis
 * 6. Dual-process requirement (whether a second pathology is needed)
 * 7. Single test that would change Proton's mind
 * 8. Definitive abandonment condition
 */

class ContradictionEngine {
  constructor() {
    this.name = 'ProtonContradictionEngine';
  }

  /**
   * Evaluates contradictions and self-falsification criteria for differentials.
   * @param {Array<Object>} differential - List of differential hypotheses
   * @param {ClinicalFactStore} factStore - Compiled patient facts
   * @returns {Array<Object>} Contradiction formulations for each hypothesis
   */
  evaluate(differential = [], factStore = null) {
    if (!Array.isArray(differential) || differential.length === 0) {
      return [];
    }

    const observedFacts = factStore ? factStore.findObservedFacts() : [];
    const pendingFacts = factStore ? factStore.findPendingFacts() : [];
    const negativeFacts = factStore ? factStore.findNegativeFacts() : [];

    return differential.map((diag, index) => {
      const conditionName = diag.condition || diag.diagnosis || 'Unknown Diagnosis';
      const alternativeDiag = differential.find((d, i) => i !== index)?.condition || 'Undifferentiated systemic illness';

      // 1. Identify facts that support this diagnosis
      const supports = (diag.supportingEvidence || []).map(s => typeof s === 'string' ? s : s.text || JSON.stringify(s));

      // 2. Identify refuting / contradictory findings
      const contradictions = (diag.refutingFactors || diag.contradictoryEvidence || []);
      if (contradictions.length === 0) {
        // Derive potential contradictions from negative or atypical facts
        negativeFacts.slice(0, 2).forEach(f => {
          contradictions.push(`Documented absence of ${f.name} requires qualification`);
        });
      }

      // 3. Unexplained findings (findings observed in patient that are NOT explained by this single disease)
      const unexplained = this._identifyUnexplainedFindings(conditionName, observedFacts, supports);

      // 4. Missing discriminating tests
      const missing = pendingFacts.map(pf => `${pf.name} (Result Pending)`);
      if (missing.length === 0) {
        missing.push('Quantitative definitive biomarker or tissue biopsy');
      }

      // 5. Change My Mind & Abandonment Criteria
      const falsification = this._deriveFalsificationCriteria(conditionName);

      return {
        hypothesis_id: diag.id || `H-${String(index + 1).padStart(3, '0')}`,
        diagnosis: conditionName,
        supports,
        contradictions,
        unexplained,
        missing,
        best_alternative: alternativeDiag,
        requires_dual_process: unexplained.length > 2,
        change_my_mind: falsification.changeMyMind,
        abandon_if: falsification.abandonIf
      };
    });
  }

  _identifyUnexplainedFindings(conditionName, observedFacts, supports) {
    const unexplained = [];
    const lowerCond = conditionName.toLowerCase();
    const supStr = supports.join(' ').toLowerCase();

    // Check if any major observed finding is completely absent from the supporting explanation
    for (const fact of observedFacts) {
      const fName = fact.name.toLowerCase();
      if (!supStr.includes(fName) && !lowerCond.includes(fName) && fact.category !== 'demographic') {
        if (fact.category === 'vital' && (fact.name.includes('Blood Pressure') || fact.name.includes('Heart Rate'))) {
          continue; // Vitals are universal
        }
        unexplained.push(`${fact.name} (${fact.value ?? 'observed'})`);
        if (unexplained.length >= 3) break;
      }
    }

    return unexplained;
  }

  _deriveFalsificationCriteria(conditionName) {
    const lower = conditionName.toLowerCase();

    if (lower.includes('adrenal')) {
      return {
        changeMyMind: ['Normal peak cortisol (>=18 mcg/dL) on 250 mcg cosyntropin stimulation test'],
        abandonIf: ['Adequate baseline cortisol >18 mcg/dL or intact cosyntropin peak cortisol response']
      };
    }
    if (lower.includes('wernicke') || lower.includes('thiamine')) {
      return {
        changeMyMind: ['Lack of clinical neurological response to high-dose IV thiamine within 48-72 hours'],
        abandonIf: ['Normal erythrocyte transketolase activity and normal whole blood thiamine pyrophosphate prior to treatment']
      };
    }
    if (lower.includes('ttp') || lower.includes('purpura')) {
      return {
        changeMyMind: ['ADAMTS13 activity returned >10% (argues against immune TTP; redirects to secondary TMA/pseudo-TMA)'],
        abandonIf: ['ADAMTS13 activity >= 20% with complete resolution upon vitamin replacement']
      };
    }
    if (lower.includes('arsenic') || lower.includes('metal')) {
      return {
        changeMyMind: ['Quantitative 24-hour urine heavy metal excretion within reference range'],
        abandonIf: ['Undetectable urine arsenic / blood lead levels']
      };
    }
    if (lower.includes('appendicitis')) {
      return {
        changeMyMind: ['Normal appendix visualized on ultrasound or non-contrast abdominal CT'],
        abandonIf: ['Normal appendix confirmed without inflammatory changes on contrast-enhanced CT']
      };
    }
    if (lower.includes('amyloid')) {
      return {
        changeMyMind: ['Normal / Grade 0 uptake on 99mTc-PYP scintigraphy, or positive monoclonal protein spike requiring biopsy'],
        abandonIf: ['Negative endomyocardial biopsy for Congo red / apple-green birefringence']
      };
    }

    // Default
    return {
      changeMyMind: [`Definitive gold-standard objective investigation for ${conditionName} returns negative`],
      abandonIf: [`Direct histological, microbiological, or biochemical falsification of ${conditionName}`]
    };
  }
}

module.exports = {
  ContradictionEngine,
  contradictionEngine: new ContradictionEngine()
};
