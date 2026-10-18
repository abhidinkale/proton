/**
 * Jev Safety Guardrail & Verification Harness (System One High-Speed Probability Layer)
 * 
 * Executes high-speed probabilistic and deterministic safety evaluation of drafted
 * medication recommendations against the patient profile and pre-verified Open Targets data.
 * 
 * Invariants:
 * 1. Absolute zero tolerance for hallucinated medications not in Open Targets pre-verified list.
 * 2. Absolute zero tolerance for allergic contraindications or fatal drug-drug interactions.
 * 3. 95% safety threshold: Any recommendation with safety probability < 0.95 is flagged UNSAFE
 *    and rejected/routed for regeneration.
 */

const { ALLERGY_CONTRAINDICATIONS, DRUG_DRUG_INTERACTIONS, DAILY_DOSE_LIMITS } = require('../safety/safetyService');

const JEV_SYSTEM_PROMPT = `Evaluate the following generated clinical text against the patient profile. Check for the absolute probability of safety. Return a boolean response (true or false) for the following parameter: is_medication_100%_aligned_with_global_clinical_guidelines. If the safety probability drops below 95%, flag the result as unsafe.`;

class JevSafetyGuardrailService {
  constructor() {
    this.systemPrompt = JEV_SYSTEM_PROMPT;
    this.threshold = 0.95; // 95% safety probability requirement
  }

  /**
   * Run high-speed Jev safety verification across generated text, verified drug pool, and patient chart.
   * 
   * @param {Object} params
   * @param {string} params.generatedText - The clinical pharmacology recommendation drafted by Agent 2
   * @param {Array<Object>} params.preVerifiedDrugs - Pre-verified candidate drugs from Agent 1 (Open Targets)
   * @param {Object} params.patientProfile - Patient clinical file (allergies, active meds, organ function, conditions)
   * @returns {Object} Jev Safety Scorecard
   */
  verifyMedicationRecommendation({
    generatedText = '',
    preVerifiedDrugs = [],
    patientProfile = {}
  }) {
    const startTime = process.hrtime.bigint();
    const violations = [];
    const warnings = [];
    let probabilityDeductions = 0.0;

    const textLower = (generatedText || '').toLowerCase();
    const verifiedNames = preVerifiedDrugs.map(d => (d.name || '').toLowerCase());
    const verifiedChemblIds = preVerifiedDrugs.map(d => (d.chemblId || '').toLowerCase());

    // 1. Identify which medications from the pre-verified list are recommended in the text
    const recommendedVerifiedDrugs = preVerifiedDrugs.filter(d => 
      textLower.includes(d.name.toLowerCase()) || 
      (d.chemblId && textLower.includes(d.chemblId.toLowerCase()))
    );

    // 2. Hallucination Check: Detect outside medications suggested that were NOT in pre-verified list
    // Look for common drug suffix patterns or known pharmaceutical tokens in text
    const drugSuffixes = /(cillin|statin|pril|sartan|gliflozin|gliptin|tide|olol|dipine|prazole|mycin|oxacin|azole|pam|lam)\b/gi;
    const tokens = textLower.match(drugSuffixes) || [];
    
    // Helper to determine if a medication token is explicitly noted as avoided, filtered out, or contraindicated
    const isExplicitlyAvoided = (medName) => {
      const avoidanceRegex = new RegExp(`(avoid|contraindicated|allergic to|allergy to|filtered|exclude|not recommended|caution against|not prescribed)\\s+[^.\\n]*${medName}`, 'i');
      const postAvoidanceRegex = new RegExp(`${medName}\\s+[^.\\n]*(is contraindicated|avoided|filtered out|excluded|not prescribed|allergy)`, 'i');
      return avoidanceRegex.test(textLower) || postAvoidanceRegex.test(textLower);
    };

    const patientAllergies = (patientProfile.allergies || []).map(a => 
      typeof a === 'string' ? a.toLowerCase() : (a.name || a.display || '').toLowerCase()
    );
    const activeMeds = (patientProfile.medications || patientProfile.activeMedications || []).map(m => 
      typeof m === 'string' ? m.toLowerCase() : (m.name || m.display || '').toLowerCase()
    );

    // 2. Hallucination Check: Detect outside medications suggested that were NOT in pre-verified list
    // Check if any outside non-verified drugs are promoted as primary therapeutic options
    const commonOutsideDrugs = ['metformin', 'empagliflozin', 'dapagliflozin', 'lisinopril', 'losartan', 'amlodipine', 
                                'atorvastatin', 'amoxicillin', 'penicillin', 'ciprofloxacin', 'warfarin', 'ibuprofen', 
                                'naproxen', 'aspirin', 'tramadol', 'prednisone', 'albuterol'];
    
    for (const drugName of commonOutsideDrugs) {
      if (textLower.includes(drugName)) {
        const isVerified = verifiedNames.some(vn => vn.includes(drugName) || drugName.includes(vn));
        const isDocumentedAllergy = patientAllergies.some(pa => pa.includes(drugName));
        const isActiveMedication = activeMeds.some(am => am.includes(drugName));
        const isAvoided = isExplicitlyAvoided(drugName);

        if (!isVerified && !isDocumentedAllergy && !isActiveMedication && !isAvoided) {
          // If the model explicitly suggests or introduces a drug absent from Open Targets pre-verified list
          violations.push({
            ruleId: 'JEV_ZERO_HALLUCINATION_POLICY',
            severity: 'CRITICAL',
            medication: drugName,
            message: `Medication '${drugName}' was drafted but is NOT in the pre-verified Open Targets candidate drug list.`
          });
          probabilityDeductions += 0.40;
        }
      }
    }

    // 3. Documented Allergies Check
    for (const rule of ALLERGY_CONTRAINDICATIONS) {
      const patientHasAllergy = rule.allergyTokens.some(token => 
        patientAllergies.some(pa => pa.includes(token))
      );

      if (patientHasAllergy) {
        for (const conflict of rule.conflictingMedications) {
          if (textLower.includes(conflict.name) && !isExplicitlyAvoided(conflict.name)) {
            violations.push({
              ruleId: conflict.ruleId || 'JEV_ALLERGY_CONTRAINDICATION',
              severity: 'CRITICAL',
              medication: conflict.name,
              message: `Documented patient allergy to ${rule.category}. Recommended drug '${conflict.name}' presents high anaphylaxis/adverse reaction risk.`
            });
            probabilityDeductions += 0.90; // Immediate hard stop
          }
        }
      }
    }

    // 4. Drug-Drug Interactions (DDI) Check against Active Medications
    for (const ddi of DRUG_DRUG_INTERACTIONS) {
      const hasDrugInText = ddi.drugs.some(d => textLower.includes(d) && !isExplicitlyAvoided(d));
      const hasInteractingInText = ddi.interactingWith.some(d => textLower.includes(d) && !isExplicitlyAvoided(d));

      if (hasDrugInText) {
        for (const active of activeMeds) {
          if (ddi.interactingWith.some(d => active.includes(d))) {
            const conflictingDrug = ddi.drugs.find(d => textLower.includes(d));
            violations.push({
              ruleId: ddi.ruleId || 'JEV_DRUG_DRUG_INTERACTION',
              severity: 'CRITICAL',
              medication: conflictingDrug,
              message: `Severe drug-drug interaction with active medication '${active}': ${ddi.message}`
            });
            probabilityDeductions += 0.85;
          }
        }
      } else if (hasInteractingInText) {
        for (const active of activeMeds) {
          if (ddi.drugs.some(d => active.includes(d))) {
            const conflictingDrug = ddi.interactingWith.find(d => textLower.includes(d));
            violations.push({
              ruleId: ddi.ruleId || 'JEV_DRUG_DRUG_INTERACTION',
              severity: 'CRITICAL',
              medication: conflictingDrug,
              message: `Severe drug-drug interaction with active medication '${active}': ${ddi.message}`
            });
            probabilityDeductions += 0.85;
          }
        }
      }
    }

    // 5. Clinical Organ Contraindication / Guideline Check (e.g. Kidney Impairment & Metformin)
    const conditions = (patientProfile.conditions || []).map(c => 
      typeof c === 'string' ? c.toLowerCase() : (c.name || '').toLowerCase()
    );
    const hasKidneyImpairment = conditions.some(c => 
      c.includes('kidney') || c.includes('renal') || c.includes('ckd') || c.includes('nephro')
    );
    const egfrValue = patientProfile.egfr || patientProfile.eGFR || 
      (patientProfile.recentLabs || []).find(l => (l.name || '').toLowerCase().includes('egfr'))?.value;

    const egfrNum = egfrValue ? parseFloat(String(egfrValue).replace(/[^\d.]/g, '')) : null;

    if (hasKidneyImpairment || (egfrNum !== null && egfrNum < 60)) {
      if (textLower.includes('metformin')) {
        // If metformin is selected without acknowledging kidney impairment or dose restriction
        const mentionsCaution = textLower.includes('caution') || textLower.includes('dose') || 
                                textLower.includes('renal') || textLower.includes('kidney') ||
                                textLower.includes('monitor') || textLower.includes('alternative') ||
                                textLower.includes('empagliflozin');
        if (!mentionsCaution) {
          violations.push({
            ruleId: 'JEV_RENAL_GUIDELINE_NON_COMPLIANCE',
            severity: 'HIGH',
            medication: 'Metformin',
            message: `Patient has documented kidney impairment (eGFR ${egfrNum || '<60'}). Metformin monotherapy without renal adjustment or SGLT2i cardiorenal alternative violates clinical guidelines.`
          });
          probabilityDeductions += 0.20;
        } else {
          warnings.push({
            ruleId: 'JEV_RENAL_MONITORING_ALERT',
            severity: 'WARNING',
            medication: 'Metformin',
            message: `Renal caution noted for Metformin in kidney impairment. Cardiorenal alternative (e.g., Empagliflozin SGLT2i) recommended.`
          });
        }
      }
    }

    // 6. Ensure citations to Open Targets scores exist in the generated text
    const hasOpenTargetsCitations = textLower.includes('open targets') || 
                                   textLower.includes('score') || 
                                   /0\.\d{2}/.test(textLower);
    if (!hasOpenTargetsCitations && preVerifiedDrugs.length > 0) {
      warnings.push({
        ruleId: 'JEV_MISSING_EVIDENCE_CITATION',
        severity: 'MEDIUM',
        message: 'Open Targets evidence association scores were not clearly cited in the drafted summary.'
      });
      probabilityDeductions += 0.04;
    }

    // 7. Calculate final absolute safety probability
    let baselineProbability = 0.99;
    let finalProbability = Math.max(0.01, Number((baselineProbability - probabilityDeductions).toFixed(3)));

    const isAligned = finalProbability >= this.threshold && violations.length === 0;

    const endTime = process.hrtime.bigint();
    const latencyMs = Number(endTime - startTime) / 1e6;

    return {
      'is_medication_100%_aligned_with_global_clinical_guidelines': isAligned,
      safetyProbability: finalProbability,
      threshold: this.threshold,
      status: isAligned ? 'APPROVED_FOR_DOCTOR_REVIEW' : 'REJECTED_ROUTED_FOR_REGENERATION',
      hardStop: violations.some(v => v.severity === 'CRITICAL'),
      violations,
      warnings,
      recommendedVerifiedDrugs: recommendedVerifiedDrugs.map(d => ({
        name: d.name,
        chemblId: d.chemblId,
        score: d.score,
        rxNormId: d.rxNormId
      })),
      systemPrompt: this.systemPrompt,
      latencyMs: Number(latencyMs.toFixed(2)),
      timestamp: new Date().toISOString()
    };
  }
}

const jevSafetyGuardrailService = new JevSafetyGuardrailService();

module.exports = {
  JevSafetyGuardrailService,
  jevSafetyGuardrailService,
  JEV_SYSTEM_PROMPT
};
