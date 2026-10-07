import type { MedplumClient } from '@medplum/core';
import type { 
  Patient, 
  Encounter, 
  Condition, 
  AllergyIntolerance, 
  MedicationRequest, 
  Observation, 
  DocumentReference, 
  ClinicalImpression,
  Bundle 
} from '@medplum/fhirtypes';

/**
 * Creates a rich, clinically realistic synthetic patient ("Eleanor Vance")
 * with a multi-encounter longitudinal history, documented labs over time,
 * medication dose titration, adherence concerns, and pending items.
 */
export async function createClinicalBrainDemoPatient(medplum: MedplumClient): Promise<Patient> {
  // 1. Create Patient resource
  const patient = await medplum.createResource<Patient>({
    resourceType: 'Patient',
    name: [{ given: ['Eleanor'], family: 'Vance' }],
    gender: 'female',
    birthDate: '1978-04-12',
    telecom: [{ system: 'phone', value: '555-019-2831' }]
  });

  const patientId = patient.id;
  const patientRef = `Patient/${patientId}`;

  const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  // 2. Build multi-resource batch bundle
  const bundle: Bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [
      // Condition 1: Essential Hypertension
      {
        request: { method: 'POST', url: 'Condition' },
        resource: {
          resourceType: 'Condition',
          subject: { reference: patientRef },
          code: {
            text: 'Essential Hypertension',
            coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Essential Hypertension' }]
          },
          clinicalStatus: { coding: [{ code: 'active' }] },
          recordedDate: twoMonthsAgo
        } as Condition
      },
      // Condition 2: Type 2 Diabetes Mellitus
      {
        request: { method: 'POST', url: 'Condition' },
        resource: {
          resourceType: 'Condition',
          subject: { reference: patientRef },
          code: {
            text: 'Type 2 Diabetes Mellitus',
            coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Type 2 Diabetes Mellitus' }]
          },
          clinicalStatus: { coding: [{ code: 'active' }] },
          recordedDate: twoMonthsAgo
        } as Condition
      },
      // Allergy: Penicillin
      {
        request: { method: 'POST', url: 'AllergyIntolerance' },
        resource: {
          resourceType: 'AllergyIntolerance',
          patient: { reference: patientRef },
          code: {
            text: 'Penicillin (Anaphylaxis Risk)',
            coding: [{ system: 'http://snomed.info/sct', code: '91936005', display: 'Allergy to Penicillin' }]
          },
          clinicalStatus: { coding: [{ code: 'active' }] },
          recordedDate: twoMonthsAgo
        } as AllergyIntolerance
      },
      // Lab 1 (Baseline): HbA1c 7.1%
      {
        request: { method: 'POST', url: 'Observation' },
        resource: {
          resourceType: 'Observation',
          status: 'final',
          subject: { reference: patientRef },
          code: {
            text: 'Hemoglobin A1c (HbA1c)',
            coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c' }]
          },
          effectiveDateTime: twoMonthsAgo,
          valueQuantity: { value: 7.1, unit: '%', system: 'http://unitsofmeasure.org', code: '%' },
          note: [{ text: 'Baseline outpatient metabolic laboratory assessment.' }]
        } as Observation
      },
      // Lab 2 (Recent Escalation): HbA1c 8.2% (Abnormal)
      {
        request: { method: 'POST', url: 'Observation' },
        resource: {
          resourceType: 'Observation',
          status: 'final',
          subject: { reference: patientRef },
          code: {
            text: 'Hemoglobin A1c (HbA1c)',
            coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c' }]
          },
          effectiveDateTime: fiveDaysAgo,
          valueQuantity: { value: 8.2, unit: '%', system: 'http://unitsofmeasure.org', code: '%' },
          interpretation: [{ coding: [{ code: 'H', display: 'High' }] }],
          note: [{ text: 'Recent lab panel shows glycemic deterioration above target of 7.0%.' }]
        } as Observation
      },
      // Lab 3: Blood Pressure
      {
        request: { method: 'POST', url: 'Observation' },
        resource: {
          resourceType: 'Observation',
          status: 'final',
          subject: { reference: patientRef },
          code: {
            text: 'Blood Pressure',
            coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood Pressure Panel' }]
          },
          effectiveDateTime: fiveDaysAgo,
          valueString: '142/88 mmHg',
          note: [{ text: 'Clinic vitals measurement. Stage 1 systolic elevation.' }]
        } as Observation
      },
      // Medication 1 (Earlier Order): Metformin 500 mg Once daily
      {
        request: { method: 'POST', url: 'MedicationRequest' },
        resource: {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: patientRef },
          authoredOn: twoMonthsAgo,
          medicationCodeableConcept: {
            text: 'Metformin 500 mg',
            coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', display: 'Metformin 500 mg' }]
          },
          dosageInstruction: [{
            text: '1 tablet Oral Once daily with breakfast for 30 days.'
          }]
        } as MedicationRequest
      },
      // Medication 2 (Dose Escalation): Metformin 500 mg Twice daily
      {
        request: { method: 'POST', url: 'MedicationRequest' },
        resource: {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: patientRef },
          authoredOn: oneMonthAgo,
          medicationCodeableConcept: {
            text: 'Metformin 500 mg',
            coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', display: 'Metformin 500 mg' }]
          },
          dosageInstruction: [{
            text: '1 tablet Oral Twice daily with meals for 60 days.'
          }]
        } as MedicationRequest
      },
      // Encounter 1 (Historical Initial Visit)
      {
        request: { method: 'POST', url: 'Encounter' },
        resource: {
          resourceType: 'Encounter',
          status: 'finished',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
          type: [{ text: 'Comprehensive Ambulatory Intake' }],
          subject: { reference: patientRef },
          period: { start: twoMonthsAgo }
        } as Encounter
      },
      // ClinicalImpression for Encounter 1
      {
        request: { method: 'POST', url: 'ClinicalImpression' },
        resource: {
          resourceType: 'ClinicalImpression',
          status: 'completed',
          subject: { reference: patientRef },
          date: twoMonthsAgo,
          summary: 'CHIEF COMPLAINT: Glycemic review and blood pressure elevation.\nASSESSMENT: Type 2 Diabetes Mellitus, Essential Hypertension.\nPLAN: Initiated Metformin 500 mg daily. Lifestyle modification discussed.'
        } as ClinicalImpression
      },
      // Encounter 2 (Follow-up with adherence note)
      {
        request: { method: 'POST', url: 'Encounter' },
        resource: {
          resourceType: 'Encounter',
          status: 'finished',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
          type: [{ text: 'Diabetes Follow-up & Titration' }],
          subject: { reference: patientRef },
          period: { start: oneMonthAgo }
        } as Encounter
      },
      // ClinicalImpression for Encounter 2
      {
        request: { method: 'POST', url: 'ClinicalImpression' },
        resource: {
          resourceType: 'ClinicalImpression',
          status: 'completed',
          subject: { reference: patientRef },
          date: oneMonthAgo,
          summary: 'CHIEF COMPLAINT: Medication tolerance review.\nSUBJECTIVE: Patient reported missed doses on weekends due to GI upset.\nASSESSMENT: Suboptimal glycemic control with documented adherence concerns.\nPLAN: Increased Metformin to twice daily with meals. Follow-up planned in 4 weeks.'
        } as ClinicalImpression
      },
      // Historical DocumentReference
      {
        request: { method: 'POST', url: 'DocumentReference' },
        resource: {
          resourceType: 'DocumentReference',
          status: 'current',
          description: 'Comprehensive Metabolic & Lipid Diagnostic Panel',
          subject: { reference: patientRef },
          date: fiveDaysAgo,
          content: [{
            attachment: {
              title: 'Metabolic_Panel_2026.pdf',
              contentType: 'application/pdf'
            }
          }]
        } as DocumentReference
      }
    ]
  };

  await medplum.executeBatch(bundle);
  medplum.invalidateAll();

  return patient;
}

/**
 * Creates a synthetic patient ("Arthur Pendelton") specifically designed to test:
 * - Conflicting historical information (Encounter 1 denies dyspnea vs Encounter 2 documents wheeze)
 * - Incomplete / ambiguous medication details (unspecified inhaler)
 * - Borderline lab monitoring (Serum Creatinine 1.4 mg/dL)
 * - Sulfa allergy conflict testing
 */
export async function createConflictingHistoryDemoPatient(medplum: MedplumClient): Promise<Patient> {
  const patient = await medplum.createResource<Patient>({
    resourceType: 'Patient',
    name: [{ given: ['Arthur'], family: 'Pendelton' }],
    gender: 'male',
    birthDate: '1964-08-22',
    telecom: [{ system: 'phone', value: '555-018-9923' }]
  });

  const patientId = patient.id;
  const patientRef = `Patient/${patientId}`;

  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const bundle: Bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [
      // Condition 1
      {
        request: { method: 'POST', url: 'Condition' },
        resource: {
          resourceType: 'Condition',
          subject: { reference: patientRef },
          code: {
            text: 'Exertional Fatigue (Cardiac vs Pulmonary etiology)',
            coding: [{ system: 'http://snomed.info/sct', code: '84229001', display: 'Fatigue' }]
          },
          clinicalStatus: { coding: [{ code: 'active' }] },
          recordedDate: threeMonthsAgo,
          note: [{ text: 'Initial intake: Patient specifically denied shortness of breath or orthopnea.' }]
        } as Condition
      },
      // Condition 2 (Conflicting with Condition 1 note)
      {
        request: { method: 'POST', url: 'Condition' },
        resource: {
          resourceType: 'Condition',
          subject: { reference: patientRef },
          code: {
            text: 'Mild Asthma Query vs Reactive Airway Disease',
            coding: [{ system: 'http://snomed.info/sct', code: '195967001', display: 'Asthma' }]
          },
          clinicalStatus: { coding: [{ code: 'active' }] },
          recordedDate: threeWeeksAgo,
          note: [{ text: 'Urgent Care visit: Patient reported 6-month history of episodic wheeze, conflicting with initial intake denial.' }]
        } as Condition
      },
      // Allergy: Sulfa
      {
        request: { method: 'POST', url: 'AllergyIntolerance' },
        resource: {
          resourceType: 'AllergyIntolerance',
          patient: { reference: patientRef },
          code: {
            text: 'Sulfa / Sulfamethoxazole (Urticaria Rash)',
            coding: [{ system: 'http://snomed.info/sct', code: '91937001', display: 'Allergy to sulfonamide' }]
          },
          clinicalStatus: { coding: [{ code: 'active' }] },
          recordedDate: threeMonthsAgo
        } as AllergyIntolerance
      },
      // Lab: Serum Creatinine 1.4 mg/dL (Abnormal / High)
      {
        request: { method: 'POST', url: 'Observation' },
        resource: {
          resourceType: 'Observation',
          status: 'final',
          subject: { reference: patientRef },
          code: {
            text: 'Serum Creatinine',
            coding: [{ system: 'http://loinc.org', code: '2160-0', display: 'Creatinine [Mass/volume] in Serum or Plasma' }]
          },
          effectiveDateTime: threeDaysAgo,
          valueQuantity: { value: 1.4, unit: 'mg/dL', system: 'http://unitsofmeasure.org', code: 'mg/dL' },
          interpretation: [{ coding: [{ code: 'H', display: 'High' }] }],
          note: [{ text: 'Baseline renal function mildly diminished; caution with nephrotoxic agents.' }]
        } as Observation
      },
      // Medication: Ambiguous Inhaler
      {
        request: { method: 'POST', url: 'MedicationRequest' },
        resource: {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: patientRef },
          authoredOn: threeWeeksAgo,
          medicationCodeableConcept: {
            text: 'Albuterol Inhaler (Dose unspecified by patient)',
            coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', display: 'Albuterol' }]
          },
          dosageInstruction: [{
            text: '1-2 puffs Inhalation Every 4-6 hours PRN wheezing. Exact strength and canister type unverified.'
          }]
        } as MedicationRequest
      },
      // Encounter 1 (Historical)
      {
        request: { method: 'POST', url: 'Encounter' },
        resource: {
          resourceType: 'Encounter',
          status: 'finished',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
          type: [{ text: 'Routine Ambulatory Evaluation' }],
          subject: { reference: patientRef },
          period: { start: threeMonthsAgo }
        } as Encounter
      },
      // Encounter 2 (Urgent Care - Conflicting)
      {
        request: { method: 'POST', url: 'Encounter' },
        resource: {
          resourceType: 'Encounter',
          status: 'finished',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
          type: [{ text: 'Urgent Care Evaluation for Wheeze' }],
          subject: { reference: patientRef },
          period: { start: threeWeeksAgo }
        } as Encounter
      },
      // ClinicalImpression for Encounter 2
      {
        request: { method: 'POST', url: 'ClinicalImpression' },
        resource: {
          resourceType: 'ClinicalImpression',
          status: 'completed',
          subject: { reference: patientRef },
          date: threeWeeksAgo,
          summary: 'CHIEF COMPLAINT: Episodic shortness of breath and wheezing.\nSUBJECTIVE: Patient states symptoms have occurred for months, directly conflicting with prior notes denying dyspnea.\nASSESSMENT: Reactive airway disease vs early heart failure.\nPLAN: Prescribed PRN albuterol. Pending formal spirometry/PFT and renal panel.'
        } as ClinicalImpression
      },
      // Historical DocumentReference
      {
        request: { method: 'POST', url: 'DocumentReference' },
        resource: {
          resourceType: 'DocumentReference',
          status: 'current',
          description: 'Outpatient Cardiopulmonary Summary 2025',
          subject: { reference: patientRef },
          date: threeMonthsAgo,
          content: [{
            attachment: {
              title: 'Cardiopulmonary_Summary_2025.pdf',
              contentType: 'application/pdf'
            }
          }]
        } as DocumentReference
      }
    ]
  };

  await medplum.executeBatch(bundle);
  medplum.invalidateAll();

  return patient;
}
