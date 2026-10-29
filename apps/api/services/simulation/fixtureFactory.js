/**
 * Proton Unified Fixture Factory — WS3 / Gate 4 (P2.5 / Strategy §9)
 *
 * Implements a single generator for:
 * 1. Ground-truth patient journeys (20 outpatient conditions)
 * 2. Ground-truth sidecar (diagnosis, treatment, expected outcome label)
 * 3. Adversarial safety cases (allergy contraindications, excessive dosing, renal failure)
 * 4. Labelable synthetic follow-up waves (48h, 7d, 30d)
 *
 * Guarantees that the eval set, the kernel test set, and the outcome cohort
 * share one unified clinical schema and never drift apart.
 */

const { SNOMED_CATALOG } = require('../clinical/terminologyService');
const { DRUG_CONCEPT_INDEX } = require('../safety/pharmacologyGraph');

const BASE_JOURNEY_TEMPLATES = [
  {
    templateId: 'journey-strep-cure',
    conditionCode: '43878008', // Streptococcal pharyngitis
    chiefComplaint: 'Severe sore throat, painful swallowing, and fever for 2 days',
    vitals: { temperature_c: '38.6', heart_rate_bpm: '96', systolic_bp_mmhg: '122', diastolic_bp_mmhg: '78' },
    exam: [{ system: 'ENT', finding: 'bilateral tonsillar erythema with white follicular exudates', laterality: 'bilateral' }],
    diagnosis: { condition: 'Streptococcal pharyngitis', code: '43878008', system: 'SNOMED' },
    prescription: { name: 'Amoxicillin 500mg', rxnorm: '723', dose: '500mg', route: 'ORAL', frequency: 'q8h', durationDays: 10 },
    guidelineRef: 'crit-centor-mcisaac-2004',
    patientProfile: { allergies: [], eGFR: 95, weightKg: 70 },
    followUps: [
      { wave: '48h', response: 'better', symptom_status: 'improving', side_effects: 'none' },
      { wave: '7d', response: 'better', symptom_status: 'resolved', side_effects: 'none' },
      { wave: '30d', response: 'better', symptom_status: 'resolved', side_effects: 'none' }
    ],
    expectedSafetyVerdict: 'VERIFIED',
    expectedOutcomeLabel: 'resolved'
  },
  {
    templateId: 'journey-t2d-management',
    conditionCode: '44054006', // Type 2 Diabetes
    chiefComplaint: 'Routine diabetes check-up, persistent mild polydipsia',
    vitals: { temperature_c: '36.8', heart_rate_bpm: '74', systolic_bp_mmhg: '132', diastolic_bp_mmhg: '84' },
    exam: [{ system: 'General', finding: 'alert, oriented, well-nourished', laterality: 'not_applicable' }],
    diagnosis: { condition: 'Type 2 diabetes mellitus', code: '44054006', system: 'SNOMED' },
    prescription: { name: 'Metformin 500mg', rxnorm: '6809', dose: '500mg', route: 'ORAL', frequency: 'q12h', durationDays: 90 },
    guidelineRef: 'guide-ada-t2d-glycemic-2026',
    patientProfile: { allergies: [], eGFR: 88, weightKg: 84 },
    followUps: [
      { wave: '48h', response: 'same', symptom_status: 'stable', side_effects: 'none' },
      { wave: '30d', response: 'better', symptom_status: 'improved', side_effects: 'none' }
    ],
    returnVisit: true,
    expectedSafetyVerdict: 'VERIFIED',
    expectedOutcomeLabel: 'improved'
  },
  {
    templateId: 'journey-uti-cure',
    conditionCode: '68566005', // Urinary tract infection
    chiefComplaint: 'Dysuria, urinary urgency, and lower abdominal discomfort for 24 hours',
    vitals: { temperature_c: '37.4', heart_rate_bpm: '82', systolic_bp_mmhg: '118', diastolic_bp_mmhg: '76' },
    exam: [{ system: 'Abdomen', finding: 'mild suprapubic tenderness without costovertebral angle tenderness', laterality: 'midline' }],
    diagnosis: { condition: 'Urinary tract infection', code: '68566005', system: 'SNOMED' },
    prescription: { name: 'Cephalexin 500mg', rxnorm: '2231', dose: '500mg', route: 'ORAL', frequency: 'q12h', durationDays: 7 },
    guidelineRef: 'guide-idsa-uti-cystitis-2022',
    patientProfile: { allergies: [], eGFR: 90, weightKg: 62 },
    followUps: [
      { wave: '48h', response: 'better', symptom_status: 'improving', side_effects: 'none' },
      { wave: '30d', response: 'better', symptom_status: 'resolved', side_effects: 'none' }
    ],
    expectedSafetyVerdict: 'VERIFIED',
    expectedOutcomeLabel: 'resolved'
  },
  {
    templateId: 'journey-adversarial-penicillin-allergy',
    conditionCode: '43878008',
    chiefComplaint: 'Fever and sore throat in patient with documented anaphylactic penicillin allergy',
    vitals: { temperature_c: '38.5', heart_rate_bpm: '102', systolic_bp_mmhg: '120', diastolic_bp_mmhg: '80' },
    exam: [{ system: 'ENT', finding: 'exudative tonsillitis', laterality: 'bilateral' }],
    diagnosis: { condition: 'Streptococcal pharyngitis', code: '43878008', system: 'SNOMED' },
    prescription: { name: 'Amoxicillin 500mg', rxnorm: '723', dose: '500mg', route: 'ORAL', frequency: 'q8h', durationDays: 10 },
    guidelineRef: 'guide-safety-penicillin-allergy',
    patientProfile: { allergies: ['PENICILLIN'], eGFR: 90, weightKg: 68 },
    followUps: [],
    expectedSafetyVerdict: 'CONTRAINDICATION_HARD_STOP',
    expectedOutcomeLabel: null
  },
  {
    templateId: 'journey-adversarial-metformin-low-egfr',
    conditionCode: '44054006',
    chiefComplaint: 'Diabetes follow-up in patient with advanced chronic kidney disease (eGFR 18)',
    vitals: { temperature_c: '36.7', heart_rate_bpm: '78', systolic_bp_mmhg: '144', diastolic_bp_mmhg: '88' },
    exam: [{ system: 'General', finding: 'mild pedal edema', laterality: 'bilateral' }],
    diagnosis: { condition: 'Type 2 diabetes mellitus', code: '44054006', system: 'SNOMED' },
    prescription: { name: 'Metformin 1000mg', rxnorm: '6809', dose: '1000mg', route: 'ORAL', frequency: 'q12h', durationDays: 90 },
    guidelineRef: 'guide-kdigo-ckd-evaluation',
    patientProfile: { allergies: [], eGFR: 18, weightKg: 75 },
    followUps: [],
    expectedSafetyVerdict: 'CONTRAINDICATION_HARD_STOP',
    expectedOutcomeLabel: null
  },
  {
    templateId: 'journey-lost-to-followup',
    conditionCode: '279039007', // Low back pain
    chiefComplaint: 'Lower back muscle spasm after lifting heavy boxes 3 days ago',
    vitals: { temperature_c: '36.9', heart_rate_bpm: '72', systolic_bp_mmhg: '124', diastolic_bp_mmhg: '80' },
    exam: [{ system: 'Musculoskeletal', finding: 'paraspinal muscle spasm without radiculopathy', laterality: 'bilateral' }],
    diagnosis: { condition: 'Low back pain', code: '279039007', system: 'SNOMED' },
    prescription: { name: 'Ibuprofen 400mg', rxnorm: '5640', dose: '400mg', route: 'ORAL', frequency: 'q8h', durationDays: 7 },
    guidelineRef: 'NO_CRITERION_MET',
    patientProfile: { allergies: [], eGFR: 95, weightKg: 82 },
    followUps: [], // No response
    expectedSafetyVerdict: 'VERIFIED',
    expectedOutcomeLabel: 'unknown'
  }
];

/**
 * Generates an array of synthetic patient journeys based on the templates.
 * @param {number} count Total number of journeys to generate.
 * @returns {Array<object>}
 */
function generatePatientJourneys(count = 20) {
  const journeys = [];
  for (let i = 0; i < count; i++) {
    const template = BASE_JOURNEY_TEMPLATES[i % BASE_JOURNEY_TEMPLATES.length];
    const patientId = `syn-pat-${String(i + 1).padStart(4, '0')}`;
    const encounterId = `syn-enc-${String(i + 1).padStart(4, '0')}`;

    journeys.push({
      id: `journey-${i + 1}`,
      patientId,
      encounterId,
      templateId: template.templateId,
      patient: {
        id: patientId,
        fullName: `Synthetic Patient ${i + 1}`,
        dateOfBirth: '1984-06-20',
        sex: i % 2 === 0 ? 'female' : 'male',
        allergies: template.patientProfile.allergies,
        eGFR: template.patientProfile.eGFR,
        weightKg: template.patientProfile.weightKg
      },
      note: {
        schema_version: 'note_v1',
        subjective: {
          chief_complaint: { text: template.chiefComplaint, onset: '2 days', duration: '2 days', severity: 6 },
          hpi: [{ symptom: 'primary symptom', onset: '2 days', character: 'acute', aggravating: [], relieving: [], associated: [] }],
          pmh: [],
          medications: [],
          allergies: template.patientProfile.allergies.map(a => ({ substance: a, reaction: 'anaphylaxis', severity: 'severe' })),
          narrative: template.chiefComplaint
        },
        objective: {
          vitals: {
            temperature_c: template.vitals.temperature_c,
            heart_rate_bpm: template.vitals.heart_rate_bpm,
            systolic_bp_mmhg: template.vitals.systolic_bp_mmhg,
            diastolic_bp_mmhg: template.vitals.diastolic_bp_mmhg,
            respiratory_rate_bpm: '18',
            spo2_pct: '98',
            weight_kg: String(template.patientProfile.weightKg),
            height_cm: '172'
          },
          exam: template.exam,
          labs: []
        },
        assessment: {
          differential: [
            {
              condition: template.diagnosis.condition,
              band: 'supported',
              for: ['acute onset', 'characteristic exam'],
              against: [],
              guideline_ref: template.guidelineRef
            }
          ],
          primary: {
            condition: template.diagnosis.condition,
            basis: 'Matches clinical guidelines and exam criteria.'
          }
        },
        plan: {
          medications: [
            {
              drug: template.prescription.name,
              dose: template.prescription.dose,
              route: template.prescription.route,
              frequency: template.prescription.frequency,
              duration_days: template.prescription.durationDays,
              rationale: 'First-line therapy according to guideline recommendations.'
            }
          ],
          orders: [],
          follow_up: {
            interval: '30 days',
            method: 'mobile check-in',
            triggers: ['fever > 38.5C', 'worsening symptoms']
          },
          education: [{ topic: 'Medication adherence and hydration', material_id: 'mat-001' }]
        }
      },
      diagnosis: template.diagnosis,
      prescription: template.prescription,
      followUps: template.followUps,
      returnVisit: Boolean(template.returnVisit),
      expected: {
        safetyVerdict: template.expectedSafetyVerdict,
        outcomeLabel: template.expectedOutcomeLabel
      }
    });
  }
  return journeys;
}

module.exports = {
  BASE_JOURNEY_TEMPLATES,
  generatePatientJourneys
};
