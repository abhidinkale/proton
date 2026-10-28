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

const { pharmacologyGraph } = require('./pharmacologyGraph');

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

const KERNEL_VERSION = 'kernel_v2';

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a frequency into doses per day.
 *
 * Explicit daily counts win over intervals. "Every 4 hours (four times daily)"
 * is a common way of writing four doses during waking hours; reading the
 * interval as six doses would flag a correct order. "q4h" on its own is six.
 */
function parseDosesPerDay(frequency) {
  const raw = String(frequency || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!raw) return { parsed: false, reason: 'missing' };

  const prn = /\bprn\b|\bas needed\b/.test(raw);

  const explicit = [
    [/\bqid\b|\bfour times\b|\b4 times\b|\b4x\b/, 4],
    [/\btid\b|\bthree times\b|\b3 times\b|\b3x\b|\bthrice\b/, 3],
    [/\bbid\b|\btwice\b|\btwo times\b|\b2 times\b|\b2x\b/, 2],
    [/\bqhs\b|\bat bedtime\b|\bnightly\b/, 1],
    [/\bqd\b|\bonce daily\b|\bonce a day\b|\bdaily\b|\bevery day\b/, 1],
    [/\bstat\b|\bsingle dose\b|\bone time\b/, 1],
    [/\bevery other day\b|\balternate day\b/, 0.5],
    [/\bweekly\b|\bonce weekly\b|\bper week\b/, 1 / 7]
  ];
  for (const [pattern, value] of explicit) {
    if (pattern.test(raw)) {
      return { parsed: true, dosesPerDay: value, prn };
    }
  }

  // Interval: q4h, q 4 h, every 4 hours, every 4-6 hours. A range uses the
  // shorter interval (the higher exposure) because the ceiling is a safety max.
  const interval =
    raw.match(/\bq\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(?:h|hr|hrs|hours?)\b/) ||
    raw.match(/\bevery\s+(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(?:hours?|hrs?|h)\b/);
  if (interval) {
    const first = Number(interval[1]);
    const second = interval[2] ? Number(interval[2]) : first;
    const hours = Math.min(first, second);
    if (Number.isFinite(hours) && hours > 0) {
      return { parsed: true, dosesPerDay: 24 / hours, prn };
    }
  }

  const count = raw.match(/\b(\d+(?:\.\d+)?)\s*(?:times?|x)\s*(?:a|per)?\s*(?:day|daily)\b/);
  if (count) {
    const n = Number(count[1]);
    if (Number.isFinite(n) && n > 0) return { parsed: true, dosesPerDay: n, prn };
  }

  if (prn) return { parsed: true, dosesPerDay: 1, prn: true };

  return { parsed: false, reason: 'unrecognized' };
}

function parseUnitsPerDose(text) {
  const raw = String(text || '').toLowerCase();
  const solid = '(?:tablets?|tabs?|capsules?|caps?|pills?|puffs?)';
  const range = raw.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)\\s*${solid}\\b`));
  if (range) return Math.max(Number(range[1]), Number(range[2]));
  const single = raw.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${solid}\\b`));
  return single ? Number(single[1]) : null;
}

function parseVolumeMl(text) {
  const raw = String(text || '');
  // Do not mistake the denominator of "500 mg/5 mL" for the administered volume.
  if (/\bmg\s*\/\s*\d+(?:\.\d+)?\s*mL\b/i.test(raw)) return null;
  const m = raw.match(/(\d+(?:\.\d+)?)\s*mL\b/i);
  return m ? Number(m[1]) : null;
}

function parseStrength(text) {
  const raw = String(text || '');
  if (/\b(?:mg|mcg|g)\s*\/\s*kg\b/i.test(raw)) return { weightBased: true };

  const perVolume = raw.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g)\s*\/\s*(\d+(?:\.\d+)?)\s*mL/i);
  if (perVolume) {
    const amount = Number(perVolume[1]) * (perVolume[2].toLowerCase() === 'g' ? 1000 : perVolume[2].toLowerCase() === 'mcg' ? 0.001 : 1);
    const volume = Number(perVolume[3]);
    if (Number.isFinite(amount) && Number.isFinite(volume) && volume > 0) {
      return { perMl: amount / volume };
    }
  }

  const single = raw.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g)\b/i);
  if (!single) return null;
  const n = Number(single[1]);
  if (!Number.isFinite(n)) return null;
  const unit = single[2].toLowerCase();
  return { mg: unit === 'g' ? n * 1000 : unit === 'mcg' ? n / 1000 : n };
}

/**
 * Compute the daily mg exposure for a prescription, or explain why it cannot
 * be computed. Never returns a guessed number for a form it does not parse.
 */
function computeExposure(rx) {
  const doseText = String(rx.dose || rx.dosage || '');
  const strengthText = String(rx.strength || rx.dose || rx.dosage || '');
  const frequency = String(rx.frequency || '');

  const freq = parseDosesPerDay(frequency);
  const units = parseUnitsPerDose(doseText) ?? parseUnitsPerDose(frequency) ?? 1;
  const strength = parseStrength(strengthText);

  if (!strength) return { parsed: false, reason: 'strength' };
  if (strength.weightBased) return { parsed: false, reason: 'weight_based' };
  if (!freq.parsed) return { parsed: false, reason: freq.reason };

  let mgPerDose;
  if (strength.perMl) {
    const volume = parseVolumeMl(doseText);
    if (!volume) return { parsed: false, reason: 'volume' };
    mgPerDose = strength.perMl * volume;
  } else {
    mgPerDose = strength.mg * units;
  }

  return {
    parsed: true,
    mgPerDose,
    unitsPerDose: units,
    dosesPerDay: freq.dosesPerDay,
    dailyMg: mgPerDose * freq.dosesPerDay,
    prn: Boolean(freq.prn)
  };
}

function exposureReason(reason) {
  switch (reason) {
    case 'weight_based':
      return 'the dose is weight-based (mg/kg); supply the weight so the daily total can be computed';
    case 'unrecognized':
      return 'the frequency is not in a form the kernel can convert to doses per day';
    case 'strength':
      return 'the strength is not in mg/mcg/g, so a daily total cannot be computed';
    case 'volume':
      return 'the liquid volume per dose is missing, so a daily total cannot be computed';
    default:
      return `the daily total cannot be computed (${reason})`;
  }
}

class SafetyService {
  /**
   * Run deterministic safety checks across prescriptions, patient allergies, and active meds.
   * @param {Object} params
   * @param {Array<Object>} params.prescriptions - Proposed medication items
   * @param {Array<Object>} params.allergies - Known patient allergies (FHIR AllergyIntolerance or strings)
   * @param {Array<Object>} params.activeMedications - Active medication list (FHIR MedicationStatement or strings)
   * @returns {Object} Deterministic safety verification report
   */
  evaluatePrescriptionSafety({
    prescriptions = [],
    allergies = [],
    activeMedications = [],
    eGFR = null,
    weightKg = null,
    age = null
  } = {}) {
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

    if (!allergies || allergies.length === 0) {
      warnings.push({
        severity: 'WARNING',
        type: 'MISSING_ALLERGY_CONTEXT',
        message: 'No allergy records documented in patient chart. Clinician verification of allergies is required before prescribing.',
        ruleId: 'RULE_NO_ALLERGY_HISTORY'
      });
    }

    const renal = toFiniteNumber(eGFR);
    const weight = toFiniteNumber(weightKg);
    const patientAge = toFiniteNumber(age);
    const seenIngredients = new Map();

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

      // Structural completeness
      if ((!rx.dose && !rx.dosage) || !String(rx.dose || rx.dosage).trim()) {
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

      const resolvedConcept = pharmacologyGraph.resolveDrugConcept(rxName);
      const ingredientKey = resolvedConcept
        ? resolvedConcept.name.split('/')[0].trim().toLowerCase()
        : rxName;

      // DUPLICATE ORDER — the same ingredient twice in one proposal. This is
      // checked before the dose ceiling so the clinician sees the order error,
      // not a dose arithmetic consequence of it.
      if (seenIngredients.has(ingredientKey)) {
        contraindications.push({
          severity: 'CRITICAL',
          type: 'DUPLICATE_ORDER',
          medication: rx.name,
          conflictWith: seenIngredients.get(ingredientKey),
          message: `Duplicate order: ${rx.name} contains the same active ingredient as ${seenIngredients.get(ingredientKey)} already in this proposal.`,
          ruleId: 'RULE_DUPLICATE_INGREDIENT'
        });
      } else {
        seenIngredients.set(ingredientKey, rx.name);
      }

      // Allergy contraindication: rule table first, then the pharmacology graph.
      let allergyMatched = false;
      for (const rule of ALLERGY_CONTRAINDICATIONS) {
        const matchesAllergy = rule.allergyTokens.some(token =>
          normalizedAllergies.some(patientAllergy => patientAllergy.includes(token))
        );

        if (matchesAllergy) {
          for (const conflict of rule.conflictingMedications) {
            if (rxName.includes(conflict.name)) {
              allergyMatched = true;
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

      if (!allergyMatched && resolvedConcept) {
        const graphConflict = pharmacologyGraph.evaluateAllergyConflict(resolvedConcept, normalizedAllergies);
        if (graphConflict) {
          contraindications.push({
            severity: graphConflict.severity,
            type: 'ALLERGY_CONFLICT',
            medication: rx.name,
            conflictWith: graphConflict.allergyClass,
            message: graphConflict.message,
            ruleId: `GRAPH_${graphConflict.conflictType}_${resolvedConcept.name.toUpperCase().replace(/\s+/g, '_')}`
          });
        }
      }

      // Drug-drug interaction against active medications.
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

      // Daily dose ceiling. The graph's concept limits are the source where it
      // has them; the small DAILY_DOSE_LIMITS table is the fallback. An
      // unparseable form is a review-required finding, not a default of 1.
      const graphLimit = resolvedConcept && resolvedConcept.defaultMaxDailyMg && resolvedConcept.hardStopDailyMg
        ? {
            maxDailyMg: resolvedConcept.defaultMaxDailyMg,
            hardStopMg: resolvedConcept.hardStopDailyMg,
            name: resolvedConcept.name
          }
        : null;
      const fallbackEntry = Object.entries(DAILY_DOSE_LIMITS).find(([key]) => rxName.includes(key));
      const limit = graphLimit || (fallbackEntry ? fallbackEntry[1] : null);

      if (limit) {
        const exposure = computeExposure(rx);

        if (!exposure.parsed) {
          if (exposure.reason === 'weight_based') {
            if (weight === null) {
              contraindications.push({
                severity: 'HIGH',
                type: 'WEIGHT_REQUIRED',
                medication: rx.name,
                conflictWith: 'weight-based dose',
                message: `${rx.name} is dosed by weight (mg/kg), but no weight was supplied. The daily total cannot be verified.`,
                ruleId: 'RULE_WEIGHT_REQUIRED'
              });
            } else {
              const perKg = String(rx.dose || rx.dosage || '').match(/(\d+(?:\.\d+)?)\s*mg\s*\/\s*kg(?:\s*\/\s*(day|dose))?/i);
              const frequency = parseDosesPerDay(rx.frequency);
              let dailyMg = null;
              if (perKg) {
                const perKgMg = Number(perKg[1]);
                const basis = (perKg[2] || 'dose').toLowerCase();
                if (basis === 'day') dailyMg = perKgMg * weight;
                else if (frequency.parsed) dailyMg = perKgMg * weight * frequency.dosesPerDay;
              }
              if (dailyMg !== null && dailyMg > limit.hardStopMg) {
                contraindications.push({
                  severity: 'CRITICAL',
                  type: 'DOSE_LIMIT_EXCEEDED',
                  medication: rx.name,
                  conflictWith: `${limit.name} Daily Maximum`,
                  message: `Weight-based daily dose (~${Math.round(dailyMg)}mg at ${weight}kg) exceeds absolute safe ceiling of ${limit.hardStopMg}mg/day.`,
                  ruleId: 'RULE_MAX_DOSE_WEIGHT_BASED'
                });
              } else if (dailyMg === null) {
                contraindications.push({
                  severity: 'HIGH',
                  type: 'DOSE_CEILING_UNVERIFIABLE',
                  medication: rx.name,
                  conflictWith: 'weight-based dose',
                  message: `${rx.name}: weight is present but the mg/kg basis (day vs dose) is not stated; the daily total cannot be verified.`,
                  ruleId: 'RULE_WEIGHT_BASIS_UNVERIFIABLE'
                });
              }
            }
          } else if (exposure.reason !== 'missing') {
            contraindications.push({
              severity: 'HIGH',
              type: 'DOSE_CEILING_UNVERIFIABLE',
              medication: rx.name,
              conflictWith: `${limit.name} Daily Maximum`,
              message: `${rx.name}: ${exposureReason(exposure.reason)}. The daily ceiling cannot be verified.`,
              ruleId: 'RULE_DOSE_CEILING_UNVERIFIABLE'
            });
          } else {
            warnings.push({
              severity: 'WARNING',
              type: 'DOSE_CEILING_UNVERIFIABLE',
              medication: rx.name,
              message: `${rx.name}: frequency is missing; the daily ceiling cannot be verified.`
            });
          }
        } else {
          const dailyMg = exposure.dailyMg;
          if (dailyMg > limit.hardStopMg) {
            contraindications.push({
              severity: 'CRITICAL',
              type: 'DOSE_LIMIT_EXCEEDED',
              medication: rx.name,
              conflictWith: `${limit.name} Daily Maximum`,
              message: `Prescribed daily dose (~${Math.round(dailyMg)}mg = ${exposure.unitsPerDose} unit(s) x ${Math.round(exposure.mgPerDose)}mg x ${exposure.dosesPerDay} doses/day) exceeds absolute safe ceiling of ${limit.hardStopMg}mg/day.`,
              ruleId: 'RULE_MAX_DOSE_EXCEEDED'
            });
          } else if (dailyMg > limit.maxDailyMg) {
            contraindications.push({
              severity: 'HIGH',
              type: 'DOSE_LIMIT_WARNING',
              medication: rx.name,
              conflictWith: `${limit.name} Daily Maximum`,
              message: `Prescribed daily dose (~${Math.round(dailyMg)}mg/day) is above the usual maximum of ${limit.maxDailyMg}mg/day but below the absolute ceiling. Review the order.`,
              ruleId: 'RULE_DOSE_ABOVE_USUAL_MAX'
            });
          } else if (exposure.prn) {
            warnings.push({
              severity: 'WARNING',
              type: 'PRN_DOSE_UNBOUNDED',
              medication: rx.name,
              message: `${rx.name} is PRN; the daily ceiling assumes one dose. Confirm the maximum doses per day with the patient.`,
              ruleId: 'RULE_PRN_DOSE'
            });
          }
        }
      }

      // Renal context. Metformin is the first hard rule; NSAIDs are the first
      // review rule. Missing eGFR is a warning for metformin, because a refill
      // may carry a lab elsewhere; a documented low eGFR is a hard stop.
      const isMetformin = rxName.includes('metformin') || /metformin/i.test(resolvedConcept?.name || '');
      if (isMetformin) {
        if (renal === null) {
          warnings.push({
            severity: 'WARNING',
            type: 'MISSING_RENAL_CONTEXT',
            medication: rx.name,
            message: 'No eGFR is available for metformin. Confirm renal function before continuing.',
            ruleId: 'RULE_MISSING_EGFR'
          });
        } else if (renal < 30) {
          contraindications.push({
            severity: 'CRITICAL',
            type: 'RENAL_CONTRAINDICATION',
            medication: rx.name,
            conflictWith: `eGFR ${renal} mL/min/1.73m2`,
            message: `Metformin is contraindicated at eGFR < 30 (documented eGFR ${renal}).`,
            ruleId: 'RULE_METFORMIN_EGFR_LT30'
          });
        } else if (renal < 45) {
          contraindications.push({
            severity: 'HIGH',
            type: 'RENAL_DOSE_REVIEW',
            medication: rx.name,
            conflictWith: `eGFR ${renal} mL/min/1.73m2`,
            message: `Metformin at eGFR ${renal} requires dose review; do not initiate at this level without a plan to reassess.`,
            ruleId: 'RULE_METFORMIN_EGFR_30_44'
          });
        }
      }

      const isNsaid = resolvedConcept?.classes?.includes('NSAID') ||
        /ibuprofen|naproxen|ketorolac|meloxicam|diclofenac|celecoxib/.test(rxName);
      if (isNsaid && renal !== null) {
        if (renal < 30) {
          contraindications.push({
            severity: 'HIGH',
            type: 'RENAL_CONTRAINDICATION',
            medication: rx.name,
            conflictWith: `eGFR ${renal} mL/min/1.73m2`,
            message: `NSAIDs should be avoided at eGFR < 30 (documented eGFR ${renal}).`,
            ruleId: 'RULE_NSAID_EGFR_LT30'
          });
        } else if (renal < 60) {
          warnings.push({
            severity: 'WARNING',
            type: 'RENAL_CAUTION',
            medication: rx.name,
            message: `NSAID at eGFR ${renal}; use the lowest dose for the shortest time and monitor renal function.`,
            ruleId: 'RULE_NSAID_EGFR_30_59'
          });
        }
      }

      // Paediatric weight check: a mg/kg order without a weight cannot be
      // checked at all. This is a review-required finding, not a guess.
      if (patientAge !== null && patientAge < 18 && weight === null && /mg\s*\/\s*kg/i.test(String(rx.dose || rx.dosage || ''))) {
        contraindications.push({
          severity: 'HIGH',
          type: 'WEIGHT_REQUIRED',
          medication: rx.name,
          conflictWith: 'paediatric weight-based dose',
          message: `${rx.name} is weight-based for a patient under 18, but no weight was supplied.`,
          ruleId: 'RULE_PAEDIATRIC_WEIGHT_REQUIRED'
        });
      }
    }

    const hasCritical = contraindications.some(c => c.severity === 'CRITICAL');
    const passed = contraindications.length === 0;

    return {
      passed,
      isSafe: passed,
      hardStop: hasCritical,
      requiresReview: !hasCritical && contraindications.length > 0,
      kernelVersion: KERNEL_VERSION,
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
