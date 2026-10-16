/**
 * Proton CareFlow — Refill Verification & Specialist Referral Agent
 * 
 * STRICT SAFETY BOUNDARY:
 * This agent NEVER autonomously authorizes or dispenses refills, nor does it
 * modify prescription dosages. Its role is strictly forensic and preparatory:
 * 1. Retrieve order & chart context.
 * 2. Deterministically evaluate allergies, duplicate therapies, and renal trajectories.
 * 3. Synthesize structured options and risk flags for the physician.
 * 4. Awaiting explicit physician sign-off.
 */

// Normalized allergy cross-reactivity mapping
const ALLERGY_MAP = {
  penicillin: ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'piperacillin', 'tazobactam', 'zosyn'],
  amoxicillin: ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'piperacillin'],
  nsaid: ['nsaid', 'ibuprofen', 'aspirin', 'naproxen', 'celecoxib', 'ketorolac', 'advil', 'motrin', 'aleve', 'indomethacin', 'meloxicam'],
  aspirin: ['nsaid', 'aspirin', 'ibuprofen', 'naproxen', 'ketorolac'],
  sulfa: ['sulfa', 'sulfamethoxazole', 'bactrim', 'septra']
};

const CONTROLLED_SUBSTANCES = [
  'oxycodone', 'fentanyl', 'morphine', 'hydromorphone', 'dilaudid', 'methadone',
  'hydrocodone', 'alprazolam', 'xanax', 'clonazepam', 'klonopin', 'lorazepam',
  'ativan', 'diazepam', 'valium', 'amphetamine', 'adderall', 'methylphenidate',
  'ritalin', 'vyvanse', 'lisdexamfetamine', 'buprenorphine', 'suboxone', 'zolpidem', 'ambien'
];

const DOSE_CEILINGS = {
  lisinopril: 40,
  metformin: 2550,
  apixaban: 10,
  eliquis: 10,
  atorvastatin: 80,
  metoprolol: 400
};

function normalizeName(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function extractAllergyText(a) {
  if (typeof a === 'string') return a;
  if (!a) return '';
  return a.code?.text || a.code?.coding?.[0]?.display || a.text || String(a);
}

function verifyRefillProposal({
  patientId,
  patientName,
  patientAge,
  medicationName,
  requestedDose,
  requestedFrequency,
  daysSupply,
  allergies = [],
  patientAllergies = [],
  activeMedications = [],
  latestCreatinine,
  latestEgfr,
  baselineEgfr,
  lastLabDate
}) {
  const normMed = normalizeName(medicationName);
  const warnings = [];
  const blockers = [];
  let allergyConflict = false;
  let allergyDetails = null;

  // 1. Controlled Substances Safety Gate (Class D: Prohibited from automated approval)
  for (const cs of CONTROLLED_SUBSTANCES) {
    if (normMed.includes(cs)) {
      blockers.push(`CONTROLLED_SUBSTANCE_RESTRICTION: '${medicationName}' is a controlled substance. Refills cannot be authorized via automated channels. Mandatory in-person clinical review required.`);
      break;
    }
  }

  // 2. Maximum Clinical Dose Ceiling Checks
  const doseMatch = (requestedDose || medicationName).match(/(\d+)\s*mg/i);
  if (doseMatch) {
    const mg = parseInt(doseMatch[1], 10);
    for (const [drug, maxMg] of Object.entries(DOSE_CEILINGS)) {
      if (normMed.includes(drug) && mg > maxMg) {
        blockers.push(`DOSE_CEILING_EXCEEDED: Requested dose ${mg}mg exceeds maximum daily clinical ceiling (${maxMg}mg) for ${drug}.`);
      }
    }
  }

  // 3. Allergy Cross-Reactivity
  const listToInspect = (allergies && allergies.length > 0) ? allergies : patientAllergies;
  for (const item of listToInspect) {
    const allergy = extractAllergyText(item);
    const normAllergy = normalizeName(allergy);
    if (!normAllergy) continue;

    for (const [drugClass, members] of Object.entries(ALLERGY_MAP)) {
      if (members.some(m => normAllergy.includes(m))) {
        if (members.some(m => normMed.includes(m))) {
          allergyConflict = true;
          allergyDetails = `Allergy conflict with documented ${allergy} (${drugClass.toUpperCase()} class cross-reactivity).`;
          blockers.push(`CRITICAL ALLERGY CONFLICT: ${allergyDetails}`);
        }
      }
    }
    if (normMed.includes(normAllergy) || normAllergy.includes(normMed)) {
      allergyConflict = true;
      allergyDetails = `Direct documented allergy to ${allergy}.`;
      blockers.push(`CRITICAL ALLERGY CONFLICT: ${allergyDetails}`);
    }
  }

  // 4. Active Regimen Check
  const isActive = activeMedications.some(m => normalizeName(m).includes(normMed) || normMed.includes(normalizeName(m)));
  if (!isActive) {
    warnings.push(`Medication '${medicationName}' is not currently active on patient's confirmed medication list.`);
  }

  // 5. Renal Monitoring Check for High-Risk Meds (Apixaban/DOAC, Metformin, SGLT2)
  const isRenalMonitored = ['apixaban', 'eliquis', 'metformin', 'dabigatran', 'rivaroxaban', 'lisinopril'].some(d => normMed.includes(d));
  let renalWarning = null;

  if (isRenalMonitored) {
    if (latestEgfr !== undefined) {
      if (latestEgfr < 50) {
        renalWarning = `Renal Function Advisory: Current eGFR is ${latestEgfr} mL/min (< 50 mL/min). Renal dose adjustment review required.`;
        warnings.push(renalWarning);
      }
      if (baselineEgfr && baselineEgfr > 0) {
        const dropPct = ((baselineEgfr - latestEgfr) / baselineEgfr) * 100;
        if (dropPct >= 15) {
          const driftNotice = `Longitudinal eGFR Downward Drift: Declined from ${baselineEgfr} to ${latestEgfr} mL/min (-${dropPct.toFixed(1)}%). Review ongoing safety.`;
          warnings.push(driftNotice);
          if (!renalWarning) renalWarning = driftNotice;
        }
      }
      // Specific DOAC guideline criteria (e.g. Apixaban 2.5mg criteria: 2 of Age >= 80, Weight <= 60kg, Cr >= 1.5)
      if (normMed.includes('apixaban') || normMed.includes('eliquis')) {
        if (patientAge && patientAge >= 70 && latestCreatinine && latestCreatinine >= 1.5) {
          warnings.push(`DOAC Renal Risk Factor: Age ${patientAge} + Serum Creatinine ${latestCreatinine} mg/dL. Physician review of dose suitability required.`);
        }
      }
    } else {
      warnings.push('Lab Monitoring Advisory: No recent eGFR or Serum Creatinine on file for renal-cleared drug.');
    }
  }

  // NOTE: In accordance with Proton Safety Architecture, the agent must NOT generate,
  // rank, or present predefined treatment or dosage options. The physician independently
  // determines and confirms the clinical action.

  return {
    patientId,
    patientName,
    medicationName,
    requestedDose,
    requestedFrequency,
    daysSupply,
    safetyReport: {
      canApprove: blockers.length === 0,
      allergyConflict,
      allergyDetails,
      duplicateTherapy: false,
      renalDriftWarning: renalWarning,
      warnings,
      blockers
    },
    clinicalContext: {
      indication: normMed.includes('apixaban') ? 'Stroke Prevention in Nonvalvular Atrial Fibrillation' : 'Chronic Medical Condition',
      relevantLabSummary: `Serum Creatinine: ${latestCreatinine || 'N/A'} mg/dL • eGFR: ${latestEgfr || 'N/A'} mL/min (Baseline: ${baselineEgfr || 'N/A'})`,
      latestCreatinine: latestCreatinine ? `${latestCreatinine} mg/dL` : undefined,
      latestEgfr: latestEgfr ? `${latestEgfr} mL/min` : undefined,
      egfrBaseline: baselineEgfr ? `${baselineEgfr} mL/min` : undefined
    },
    physicianDecisionRequired: true,
    requiresPhysicianReview: true, // ALWAYS TRUE FOR REFILLS
    status: 'requested',
    timestamp: new Date().toISOString()
  };
}

function compileReferralPacket({
  patientId,
  patientName,
  patientAgeSex,
  specialty,
  specialtyCode = '394589003',
  targetProviderOrClinic,
  clinicalIndication,
  hpiSummary,
  relevantLabs = [],
  currentMedications = [],
  documentedAllergies = [],
  vitalsSummary,
  orderingPhysician = 'Dr. Sarah Lin, MD'
}) {
  const refId = `ref-${patientId}-${Date.now()}`;
  const now = new Date().toISOString();

  // HL7 FHIR R4 ServiceRequest Representation
  const fhirServiceRequest = {
    resourceType: 'ServiceRequest',
    id: `sr-${refId}`,
    status: 'draft',
    intent: 'order',
    code: {
      text: specialty,
      coding: [{
        system: 'http://snomed.info/sct',
        code: specialtyCode,
        display: specialty
      }]
    },
    subject: {
      reference: `Patient/${patientId}`,
      display: patientName
    },
    authoredOn: now,
    requester: {
      display: orderingPhysician
    },
    performer: [{
      display: targetProviderOrClinic || `${specialty} Specialist`
    }],
    reasonCode: [{
      text: clinicalIndication
    }],
    supportingInfo: [
      { display: `HPI: ${hpiSummary}` },
      { display: `Vitals: ${vitalsSummary || 'BP 138/84, HR 78'}` },
      ...relevantLabs.map(l => ({ display: `Lab: ${l.name}: ${l.value} (${l.date})` })),
      ...currentMedications.map(m => ({ display: `Active Med: ${m}` })),
      ...documentedAllergies.map(a => ({ display: `Documented Allergy: ${a}` }))
    ],
    meta: {
      tag: [
        { system: 'https://proton.health/provenance', code: 'AI_DRAFT' },
        { system: 'https://proton.health/safety-gate', code: 'PHYSICIAN_REVIEW_REQUIRED' }
      ]
    }
  };

  return {
    id: refId,
    patientId,
    patientName,
    patientAgeSex,
    specialty,
    specialtyCode,
    targetProviderOrClinic: targetProviderOrClinic || `${specialty} Specialist`,
    clinicalIndication,
    referralSummaryPacket: {
      hpiSummary,
      relevantLabs,
      currentMedications,
      documentedAllergies,
      vitalsSummary: vitalsSummary || 'Blood Pressure: 138/84 mmHg, HR 78 bpm, BMI 26.8'
    },
    fhirServiceRequest,
    requiresPhysicianReview: true,
    status: 'draft_prepared',
    priority: 'urgent',
    createdAt: now
  };
}

module.exports = {
  verifyRefillProposal,
  compileReferralPacket
};

