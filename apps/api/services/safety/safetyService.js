/**
 * Proton Safety Service
 * Deterministic clinical safety verification engine.
 * 
 * Verifies:
 * - Patient allergy-drug contraindications (e.g. beta-lactams, sulfa, NSAIDs)
 * - Drug-drug interactions
 * - Absolute daily dose limits (e.g. acetaminophen, ibuprofen)
 * - Prescription structural completeness (dose, frequency, route)
 */

// Cross-reactivity mapping: allergy token -> contra-indicated medication tokens
const ALLERGY_CONTRAINDICATIONS = [
  {
    allergyTokens: ['penicillin', 'penicillins', 'amoxicillin', 'ampicillin'],
    conflictingMedications: [
      { name: 'penicillin', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_PEN_DIRECT' },
      { name: 'amoxicillin', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_PEN_AMOX' },
      { name: 'ampicillin', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_PEN_AMP' },
      { name: 'augmentin', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_PEN_AUG' },
      { name: 'piperacillin', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_PEN_PIP' },
      { name: 'cephalexin', severity: 'HIGH', ruleId: 'RULE_ALLERGY_PEN_CEPH_CROSS' },
      { name: 'cefadroxil', severity: 'HIGH', ruleId: 'RULE_ALLERGY_PEN_CEPH_CROSS' }
    ],
    category: 'Beta-Lactam Antibiotics'
  },
  {
    allergyTokens: ['sulfa', 'sulfonamide', 'sulfamethoxazole', 'bactrim'],
    conflictingMedications: [
      { name: 'bactrim', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_SULFA_BACTRIM' },
      { name: 'sulfamethoxazole', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_SULFA_SMX' },
      { name: 'septra', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_SULFA_SEPTRA' },
      { name: 'sulfasalazine', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_SULFA_SSZ' }
    ],
    category: 'Sulfonamides'
  },
  {
    allergyTokens: ['nsaid', 'ibuprofen', 'naproxen', 'aspirin'],
    conflictingMedications: [
      { name: 'ibuprofen', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_NSAID_IBU' },
      { name: 'advil', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_NSAID_ADVIL' },
      { name: 'motrin', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_NSAID_MOTRIN' },
      { name: 'naproxen', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_NSAID_NAP' },
      { name: 'aleve', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_NSAID_ALEVE' },
      { name: 'ketorolac', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_NSAID_TORADOL' },
      { name: 'meloxicam', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_NSAID_MEL' },
      { name: 'aspirin', severity: 'CRITICAL', ruleId: 'RULE_ALLERGY_NSAID_ASA' }
    ],
    category: 'NSAIDs'
  }
];

// Drug-drug interaction rules
const DRUG_DRUG_INTERACTIONS = [
  {
    drugs: ['warfarin', 'coumadin'],
    interactingWith: ['ibuprofen', 'naproxen', 'aspirin', 'ketorolac', 'meloxicam'],
    severity: 'HIGH',
    ruleId: 'DDI_WARFARIN_NSAID',
    message: 'Concurrent use of warfarin with NSAIDs significantly elevates gastrointestinal bleeding risk.'
  },
  {
    drugs: ['lisinopril', 'enalapril', 'ramipril', 'losartan', 'valsartan'],
    interactingWith: ['spironolactone', 'potassium'],
    severity: 'MEDIUM',
    ruleId: 'DDI_RAAS_POTASSIUM',
    message: 'Co-administration may precipitate hyperkalemia. Serum potassium monitoring recommended.'
  },
  {
    drugs: ['sertraline', 'fluoxetine', 'citalopram', 'escitalopram', 'paroxetine', 'venlafaxine', 'duloxetine'],
    interactingWith: ['tramadol', 'linezolid'],
    severity: 'HIGH',
    ruleId: 'DDI_SEROTONIN_SYNDROME',
    message: 'Potential risk of Serotonin Syndrome when serotonergic agents are combined.'
  }
];

// Single drug dose ceilings (mg/day)
const DAILY_DOSE_LIMITS = {
  acetaminophen: { maxDailyMg: 3000, hardStopMg: 4000, name: 'Acetaminophen / Paracetamol' },
  paracetamol: { maxDailyMg: 3000, hardStopMg: 4000, name: 'Acetaminophen / Paracetamol' },
  tylenol: { maxDailyMg: 3000, hardStopMg: 4000, name: 'Acetaminophen / Paracetamol' },
  ibuprofen: { maxDailyMg: 2400, hardStopMg: 3200, name: 'Ibuprofen' },
  metformin: { maxDailyMg: 2550, hardStopMg: 3000, name: 'Metformin' }
};

class SafetyService {
  /**
   * Run deterministic safety checks across prescriptions, patient allergies, and active meds.
   * @param {Object} params
   * @param {Array<Object>} params.prescriptions - Proposed medication items
   * @param {Array<Object>} params.allergies - Known patient allergies (FHIR AllergyIntolerance or strings)
   * @param {Array<Object>} params.activeMedications - Active medication list (FHIR MedicationStatement or strings)
   * @returns {Object} Deterministic safety verification report
   */
  evaluatePrescriptionSafety({ prescriptions = [], allergies = [], activeMedications = [] }) {
    const contraindications = [];
    const warnings = [];

    // 1. Normalize allergies
    const normalizedAllergies = (allergies || []).map(a => {
      if (typeof a === 'string') return a.toLowerCase();
      const text = a.code?.text || a.code?.coding?.[0]?.display || a.display || '';
      return text.toLowerCase();
    }).filter(Boolean);

    // 2. Normalize active meds
    const normalizedActiveMeds = (activeMedications || []).map(m => {
      if (typeof m === 'string') return m.toLowerCase();
      const text = m.medicationCodeableConcept?.text || 
                   m.medicationCodeableConcept?.coding?.[0]?.display || 
                   m.medicationReference?.display || 
                   m.name || '';
      return text.toLowerCase();
    }).filter(Boolean);

    // Check if allergy history is unrecorded
    if (!allergies || allergies.length === 0) {
      warnings.push({
        severity: 'WARNING',
        type: 'MISSING_ALLERGY_CONTEXT',
        message: 'No allergy records documented in patient chart. Clinician verification of allergies is required before prescribing.',
        ruleId: 'RULE_NO_ALLERGY_HISTORY'
      });
    }

    // 3. Evaluate each proposed prescription
    for (const rx of prescriptions) {
      if (!rx || typeof rx !== 'object') {
        contraindications.push({
          severity: 'CRITICAL',
          type: 'MALFORMED_PRESCRIPTION_INPUT',
          medication: 'Invalid',
          conflictWith: null,
          message: 'Prescription input is not a valid object.',
          ruleId: 'RULE_MALFORMED_PRESCRIPTION'
        });
        continue;
      }

      const rxName = (rx.name || '').trim().toLowerCase();
      if (!rxName) {
        contraindications.push({
          severity: 'CRITICAL',
          type: 'INCOMPLETE_PRESCRIPTION',
          medication: 'Unknown',
          conflictWith: null,
          message: 'Medication name is missing or empty.',
          ruleId: 'RULE_MISSING_MED_NAME'
        });
        continue;
      }

      // Check structural completeness
      if (!rx.dose || !String(rx.dose).trim()) {
        warnings.push({
          severity: 'WARNING',
          type: 'INCOMPLETE_PRESCRIPTION',
          medication: rx.name,
          message: `Dose is missing for ${rx.name}.`
        });
      }
      if (!rx.frequency || !String(rx.frequency).trim()) {
        warnings.push({
          severity: 'WARNING',
          type: 'INCOMPLETE_PRESCRIPTION',
          medication: rx.name,
          message: `Frequency is missing for ${rx.name}.`
        });
      }
      if (!rx.route || !String(rx.route).trim()) {
        warnings.push({
          severity: 'WARNING',
          type: 'INCOMPLETE_PRESCRIPTION',
          medication: rx.name,
          message: `Route of administration is missing for ${rx.name}.`
        });
      }

      // Allergy Contraindication Check
      for (const rule of ALLERGY_CONTRAINDICATIONS) {
        const matchesAllergy = rule.allergyTokens.some(token => 
          normalizedAllergies.some(patientAllergy => patientAllergy.includes(token))
        );

        if (matchesAllergy) {
          for (const conflict of rule.conflictingMedications) {
            if (rxName.includes(conflict.name)) {
              contraindications.push({
                severity: conflict.severity,
                type: 'ALLERGY_CONFLICT',
                medication: rx.name,
                conflictWith: rule.category,
                message: `Patient has documented allergy to ${rule.category}. Prescribing ${rx.name} presents a severe reaction risk.`,
                ruleId: conflict.ruleId
              });
            }
          }
        }
      }

      // Drug-Drug Interaction Check against Active Medications
      for (const ddi of DRUG_DRUG_INTERACTIONS) {
        const rxMatchesDrug = ddi.drugs.some(d => rxName.includes(d));
        const rxMatchesInteracting = ddi.interactingWith.some(d => rxName.includes(d));

        if (rxMatchesDrug) {
          for (const active of normalizedActiveMeds) {
            if (ddi.interactingWith.some(d => active.includes(d))) {
              contraindications.push({
                severity: ddi.severity,
                type: 'DRUG_INTERACTION',
                medication: rx.name,
                conflictWith: active,
                message: ddi.message,
                ruleId: ddi.ruleId
              });
            }
          }
        } else if (rxMatchesInteracting) {
          for (const active of normalizedActiveMeds) {
            if (ddi.drugs.some(d => active.includes(d))) {
              contraindications.push({
                severity: ddi.severity,
                type: 'DRUG_INTERACTION',
                medication: rx.name,
                conflictWith: active,
                message: ddi.message,
                ruleId: ddi.ruleId
              });
            }
          }
        }
      }

      // Daily Dose Ceiling Check
      for (const [key, limit] of Object.entries(DAILY_DOSE_LIMITS)) {
        if (rxName.includes(key)) {
          // Parse numerical strength if possible
          const strengthMatch = (rx.strength || rx.dose || '').match(/(\d+)\s*mg/i);
          if (strengthMatch) {
            const singleDoseMg = parseInt(strengthMatch[1], 10);
            let dailyFrequencyMultiplier = 1;
            const freq = (rx.frequency || '').toLowerCase();
            if (freq.includes('four') || freq.includes('qid') || freq.includes('every 6 hours')) dailyFrequencyMultiplier = 4;
            else if (freq.includes('three') || freq.includes('tid') || freq.includes('every 8 hours')) dailyFrequencyMultiplier = 3;
            else if (freq.includes('twice') || freq.includes('bid') || freq.includes('every 12 hours')) dailyFrequencyMultiplier = 2;

            const totalEstimatedDailyMg = singleDoseMg * dailyFrequencyMultiplier;
            if (totalEstimatedDailyMg > limit.hardStopMg) {
              contraindications.push({
                severity: 'CRITICAL',
                type: 'DOSE_LIMIT_EXCEEDED',
                medication: rx.name,
                conflictWith: `${limit.name} Daily Maximum`,
                message: `Prescribed daily dose (~${totalEstimatedDailyMg}mg) exceeds absolute safe ceiling of ${limit.hardStopMg}mg/day.`,
                ruleId: `RULE_MAX_DOSE_${key.toUpperCase()}`
              });
            } else if (totalEstimatedDailyMg > limit.maxDailyMg) {
              warnings.push({
                severity: 'WARNING',
                type: 'DOSE_LIMIT_WARNING',
                medication: rx.name,
                message: `Estimated daily dose (~${totalEstimatedDailyMg}mg) approaches safe limit (${limit.maxDailyMg}mg/day). Monitor closely.`
              });
            }
          }
        }
      }
    }

    const hasCritical = contraindications.some(c => c.severity === 'CRITICAL');
    const passed = contraindications.length === 0;

    return {
      passed,
      isSafe: passed,
      hardStop: hasCritical,
      totalChecks: prescriptions.length,
      contraindications,
      warnings,
      timestamp: new Date().toISOString()
    };
  }
}

const safetyService = new SafetyService();

module.exports = {
  SafetyService,
  safetyService,
  ALLERGY_CONTRAINDICATIONS,
  DRUG_DRUG_INTERACTIONS,
  DAILY_DOSE_LIMITS
};
