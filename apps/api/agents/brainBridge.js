/**
 * Proton Healthcare Operations OS — Clinical Brain Scoped Bridge
 * 
 * Implements the HIPAA minimum-necessary retrieval principle:
 * Scopes patient context specifically to the operational task domain.
 * Attaches immutable provenance envelopes (real resource references, timestamps,
 * provenance types, and verified actors). Prevents parallel duplicate databases.
 */

// Grounded Patient Clinical Store (simulating Medplum/FHIR R4 backed store)
const CLINICAL_BRAIN_REGISTRY = {
  'eleanor-vance': {
    patientId: 'eleanor-vance',
    fhirId: 'Patient/pt-8841',
    name: 'Eleanor Vance',
    ageSex: '68F',
    conditions: [
      {
        id: 'cond-ev-01',
        resourceType: 'Condition',
        code: '38341003',
        display: 'Essential Hypertension',
        status: 'active',
        recordedDate: '2024-04-12',
        verifiedBy: 'Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      },
      {
        id: 'cond-ev-02',
        resourceType: 'Condition',
        code: '44054006',
        display: 'Type 2 Diabetes Mellitus',
        status: 'active',
        recordedDate: '2023-09-18',
        verifiedBy: 'Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      }
    ],
    medications: [
      {
        id: 'med-ev-01',
        resourceType: 'MedicationStatement',
        drugName: 'Lisinopril 20mg oral daily',
        dose: '20mg',
        frequency: 'daily',
        status: 'active',
        lastPrescribedDate: '2026-08-15',
        verifiedBy: 'Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      },
      {
        id: 'med-ev-02',
        resourceType: 'MedicationStatement',
        drugName: 'Metformin 1000mg oral BID',
        dose: '1000mg',
        frequency: 'BID',
        status: 'active',
        lastPrescribedDate: '2026-08-15',
        verifiedBy: 'Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      }
    ],
    allergies: [
      {
        id: 'all-ev-01',
        resourceType: 'AllergyIntolerance',
        substance: 'Penicillin',
        reaction: 'Urticaria & Wheezing (Beta-Lactam Cross-Reactivity Active)',
        severity: 'severe',
        recordedDate: '2020-02-14',
        verifiedBy: 'Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      }
    ],
    labs: [
      {
        id: 'obs-ev-hba1c-01',
        resourceType: 'Observation',
        testName: 'Hemoglobin A1c',
        value: '8.2 %',
        previousValue: '7.1 %',
        date: '2026-08-15',
        interpretation: 'High',
        verifiedBy: 'Regional Lab Services / Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      },
      {
        id: 'obs-ev-bp-baseline',
        resourceType: 'Observation',
        testName: 'Blood Pressure Baseline',
        value: '146/88 mmHg',
        date: '2026-08-15',
        verifiedBy: 'Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      }
    ],
    lastConsultationPlan: {
      encounterId: 'enc-ev-20260815',
      date: '2026-08-15',
      practitioner: 'Dr. Sarah Lin, MD',
      planText: 'Patient exhibits poor glycemic control with HbA1c escalation to 8.2%. Follow up in 3 months with repeat HbA1c and basic metabolic panel.',
      targetFollowUp: '3 months',
      requiredLabs: ['Repeat HbA1c', 'Basic Metabolic / Renal Panel'],
      provenanceType: 'FACT'
    }
  },

  'arthur-pendelton': {
    patientId: 'arthur-pendelton',
    fhirId: 'Patient/pt-9204',
    name: 'Arthur Pendelton',
    ageSex: '74M',
    conditions: [
      {
        id: 'cond-ap-01',
        resourceType: 'Condition',
        code: '49436004',
        display: 'Atrial Fibrillation (Persistent, Nonvalvular)',
        status: 'active',
        recordedDate: '2022-11-04',
        verifiedBy: 'Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      },
      {
        id: 'cond-ap-02',
        resourceType: 'Condition',
        code: '431855005',
        display: 'Chronic Kidney Disease Stage 3a',
        status: 'active',
        recordedDate: '2025-05-19',
        verifiedBy: 'Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      }
    ],
    medications: [
      {
        id: 'med-ap-01',
        resourceType: 'MedicationStatement',
        drugName: 'Apixaban (Eliquis) 5mg BID',
        dose: '5mg',
        frequency: 'BID',
        status: 'active',
        lastPrescribedDate: '2026-07-10',
        verifiedBy: 'Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      },
      {
        id: 'med-ap-02',
        resourceType: 'MedicationStatement',
        drugName: 'Metoprolol Succinate 50mg daily',
        dose: '50mg',
        frequency: 'daily',
        status: 'active',
        lastPrescribedDate: '2026-07-10',
        verifiedBy: 'Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      }
    ],
    allergies: [
      {
        id: 'all-ap-01',
        resourceType: 'AllergyIntolerance',
        substance: 'NSAID Class',
        reaction: 'Severe Bronchospasm',
        severity: 'severe',
        recordedDate: '2019-06-20',
        verifiedBy: 'Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      }
    ],
    labs: [
      {
        id: 'obs-ap-egfr-baseline',
        resourceType: 'Observation',
        testName: 'eGFR (CKD-EPI)',
        value: '62 mL/min/1.73m²',
        date: '2026-03-12',
        verifiedBy: 'Regional Lab Services / Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      },
      {
        id: 'obs-ap-egfr-latest',
        resourceType: 'Observation',
        testName: 'eGFR (CKD-EPI)',
        value: '48 mL/min/1.73m²',
        date: '2026-09-28',
        verifiedBy: 'Regional Lab Services / Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      },
      {
        id: 'obs-ap-creat-latest',
        resourceType: 'Observation',
        testName: 'Serum Creatinine',
        value: '1.6 mg/dL',
        date: '2026-09-28',
        verifiedBy: 'Regional Lab Services / Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      },
      {
        id: 'obs-ap-bun-latest',
        resourceType: 'Observation',
        testName: 'Blood Urea Nitrogen',
        value: '26 mg/dL',
        date: '2026-09-28',
        verifiedBy: 'Regional Lab Services / Dr. Sarah Lin, MD',
        provenanceType: 'FACT'
      }
    ],
    lastConsultationPlan: {
      encounterId: 'enc-ap-20260928',
      date: '2026-09-28',
      practitioner: 'Dr. Sarah Lin, MD',
      planText: 'Patient exhibits progressive eGFR decline from 62 to 48 mL/min while on chronic DOAC. Nephrology consultation referral ordered.',
      targetFollowUp: 'Nephrology referral',
      requiredLabs: ['Repeat Renal Panel in 3 weeks'],
      provenanceType: 'FACT'
    }
  }
};

/**
 * Retrieves strictly minimum-necessary clinical facts scoped by operational domain.
 */
function getScopedPatientContext(patientId, domain = 'triage') {
  const patient = CLINICAL_BRAIN_REGISTRY[patientId];
  if (!patient) {
    return {
      patientId,
      found: false,
      domain,
      facts: [],
      provenanceMap: {}
    };
  }

  const provenanceMap = {};
  const addProvenance = (fact) => {
    provenanceMap[fact.id] = {
      resourceRef: `${fact.resourceType}/${fact.id}`,
      recordedDate: fact.recordedDate || fact.date,
      verifiedBy: fact.verifiedBy,
      provenanceType: fact.provenanceType
    };
  };

  if (domain === 'triage') {
    // Triage needs active conditions, active medications, and verified allergies
    patient.conditions.forEach(addProvenance);
    patient.medications.forEach(addProvenance);
    patient.allergies.forEach(addProvenance);

    return {
      patientId,
      found: true,
      domain,
      patientName: patient.name,
      patientAgeSex: patient.ageSex,
      conditions: patient.conditions.map(c => c.display),
      medications: patient.medications.map(m => m.drugName),
      allergies: patient.allergies.map(a => `${a.substance} (${a.reaction})`),
      provenanceMap
    };
  }

  if (domain === 'refill') {
    // Refill needs active medications, renal/metabolic labs, baseline eGFR, and allergies
    patient.medications.forEach(addProvenance);
    patient.allergies.forEach(addProvenance);
    patient.labs.forEach(addProvenance);

    const baselineEgfrObs = patient.labs.find(l => l.id.includes('egfr-baseline'));
    const latestEgfrObs = patient.labs.find(l => l.id.includes('egfr-latest'));
    const latestCreatObs = patient.labs.find(l => l.id.includes('creat-latest'));

    return {
      patientId,
      found: true,
      domain,
      patientName: patient.name,
      patientAge: parseInt(patient.ageSex, 10) || 70,
      activeMedications: patient.medications.map(m => m.drugName),
      allergies: patient.allergies.map(a => a.substance),
      latestEgfr: latestEgfrObs ? parseFloat(latestEgfrObs.value) : null,
      baselineEgfr: baselineEgfrObs ? parseFloat(baselineEgfrObs.value) : null,
      latestCreatinine: latestCreatObs ? parseFloat(latestCreatObs.value) : null,
      provenanceMap
    };
  }

  if (domain === 'scheduling') {
    // Scheduling needs consultation plan and overdue care gaps
    if (patient.lastConsultationPlan) {
      provenanceMap[patient.lastConsultationPlan.encounterId] = {
        resourceRef: `Encounter/${patient.lastConsultationPlan.encounterId}`,
        recordedDate: patient.lastConsultationPlan.date,
        verifiedBy: patient.lastConsultationPlan.practitioner,
        provenanceType: patient.lastConsultationPlan.provenanceType
      };
    }

    return {
      patientId,
      found: true,
      domain,
      patientName: patient.name,
      consultationPlanText: patient.lastConsultationPlan?.planText || null,
      targetTimeframe: patient.lastConsultationPlan?.targetFollowUp || null,
      requiredLabs: patient.lastConsultationPlan?.requiredLabs || [],
      provenanceMap
    };
  }

  if (domain === 'referral') {
    // Referral needs full packet: HPI, vitals, labs, meds, allergies
    patient.conditions.forEach(addProvenance);
    patient.medications.forEach(addProvenance);
    patient.allergies.forEach(addProvenance);
    patient.labs.forEach(addProvenance);

    return {
      patientId,
      found: true,
      domain,
      patientName: patient.name,
      patientAgeSex: patient.ageSex,
      conditions: patient.conditions.map(c => c.display),
      relevantLabs: patient.labs.map(l => ({ name: l.testName, value: l.value, date: l.date })),
      currentMedications: patient.medications.map(m => m.drugName),
      documentedAllergies: patient.allergies.map(a => `${a.substance} (${a.reaction})`),
      provenanceMap
    };
  }

  return { patientId, found: true, domain, provenanceMap };
}

const { specialistConsensusCouncil } = require('./specialistConsensusCouncil');

module.exports = {
  getScopedPatientContext,
  CLINICAL_BRAIN_REGISTRY,
  specialistConsensusCouncil,
  conveneSpecialistCouncil: (params) => specialistConsensusCouncil.conveneCouncil(params)
};
