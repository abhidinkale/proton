/**
 * Proton Clinical Intake Questionnaire Catalog
 * Defines standard FHIR R4 Questionnaire resources for dynamic clinical intake.
 */

const DERMATOLOGY_INTAKE_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  id: 'questionnaire-derm-intake-v1',
  url: 'https://proton.health/fhir/Questionnaire/dermatology-intake',
  version: '1.0.0',
  name: 'DermatologyClinicalIntake',
  title: 'Dermatology & Skin Complaint Dynamic Clinical Intake',
  status: 'active',
  subjectType: ['Patient'],
  date: '2026-10-17',
  publisher: 'Proton Health Clinical Operations',
  description: 'Structured patient-reported dynamic intake for dermatological presentations, with deterministic conditional branching and emergency escalation rules.',
  item: [
    {
      linkId: 'concern',
      text: 'What is your primary skin concern today?',
      type: 'choice',
      required: true,
      answerOption: [
        { valueCoding: { code: 'rash', display: 'New or spreading rash' } },
        { valueCoding: { code: 'acne', display: 'Acne or facial breakouts' } },
        { valueCoding: { code: 'lesion_mole', display: 'Changing mole, dark spot, or new bump' } },
        { valueCoding: { code: 'hives', display: 'Hives, welts, or allergic reaction' } },
        { valueCoding: { code: 'dry_flaking', display: 'Dry, red, or flaking skin patch (eczema / psoriasis)' } },
        { valueCoding: { code: 'hair_scalp', display: 'Hair thinning or scalp irritation' } },
        { valueCoding: { code: 'other', display: 'Other skin condition' } }
      ]
    },
    {
      linkId: 'onset',
      text: 'When did you first notice this skin issue?',
      type: 'choice',
      required: true,
      answerOption: [
        { valueCoding: { code: 'under_24h', display: 'Within the last 24 hours' } },
        { valueCoding: { code: 'few_days', display: '2 to 7 days ago' } },
        { valueCoding: { code: 'few_weeks', display: '1 to 4 weeks ago' } },
        { valueCoding: { code: 'months_plus', display: 'More than a month ago' } }
      ]
    },
    {
      linkId: 'location',
      text: 'Where on your body is this located?',
      type: 'choice',
      required: true,
      answerOption: [
        { valueCoding: { code: 'face', display: 'Face / Cheeks / Forehead' } },
        { valueCoding: { code: 'neck_chest', display: 'Neck / Upper Chest' } },
        { valueCoding: { code: 'arms_hands', display: 'Arms or Hands' } },
        { valueCoding: { code: 'torso_back', display: 'Back or Torso' } },
        { valueCoding: { code: 'legs_feet', display: 'Legs or Feet' } },
        { valueCoding: { code: 'scalp', display: 'Scalp' } },
        { valueCoding: { code: 'multiple', display: 'Multiple widespread body areas' } }
      ]
    },
    {
      linkId: 'is_itchy',
      text: 'Is the affected area itchy?',
      type: 'boolean',
      required: true
    },
    {
      linkId: 'itch_severity',
      text: 'How severe is the itching?',
      type: 'choice',
      required: true,
      enableWhen: [
        {
          question: 'is_itchy',
          operator: '=',
          answerBoolean: true
        }
      ],
      answerOption: [
        { valueCoding: { code: 'mild', display: 'Mild (noticeable, but doesn’t interrupt daily activities)' } },
        { valueCoding: { code: 'moderate', display: 'Moderate (frequently scratch, distracts during day)' } },
        { valueCoding: { code: 'severe', display: 'Severe (intolerable, constantly scratching, impairs sleep)' } }
      ]
    },
    {
      linkId: 'itch_timing',
      text: 'When is the itching most intense?',
      type: 'choice',
      required: false,
      enableWhen: [
        {
          question: 'is_itchy',
          operator: '=',
          answerBoolean: true
        }
      ],
      answerOption: [
        { valueCoding: { code: 'night', display: 'Worse at night in bed' } },
        { valueCoding: { code: 'after_shower', display: 'After warm showers or sweating' } },
        { valueCoding: { code: 'constant', display: 'Constant throughout the day' } }
      ]
    },
    {
      linkId: 'is_painful',
      text: 'Is the area painful, burning, or tender to touch?',
      type: 'boolean',
      required: true
    },
    {
      linkId: 'pain_severity',
      text: 'On a scale of 1 to 10, how intense is the pain/tenderness?',
      type: 'integer',
      required: true,
      enableWhen: [
        {
          question: 'is_painful',
          operator: '=',
          answerBoolean: true
        }
      ]
    },
    {
      linkId: 'pain_character',
      text: 'How would you describe the sensation?',
      type: 'choice',
      required: false,
      enableWhen: [
        {
          question: 'is_painful',
          operator: '=',
          answerBoolean: true
        }
      ],
      answerOption: [
        { valueCoding: { code: 'burning', display: 'Burning / Stinging' } },
        { valueCoding: { code: 'throbbing', display: 'Deep throbbing / tender' } },
        { valueCoding: { code: 'sharp', display: 'Sharp on contact' } }
      ]
    },
    {
      linkId: 'changed_recently',
      text: 'Has the skin condition changed rapidly in size, color, or shape recently?',
      type: 'boolean',
      required: true
    },
    {
      linkId: 'prior_treatments',
      text: 'Have you used any creams or medications on this area?',
      type: 'choice',
      required: true,
      answerOption: [
        { valueCoding: { code: 'none', display: 'None' } },
        { valueCoding: { code: 'otc_hydrocortisone', display: 'Over-the-counter hydrocortisone' } },
        { valueCoding: { code: 'moisturizer', display: 'Moisturizer / Aquaphor / Vaseline' } },
        { valueCoding: { code: 'antihistamine', display: 'Oral antihistamines (Benadryl, Zyrtec, Claritin)' } },
        { valueCoding: { code: 'prescription', display: 'Prescription steroid or antibiotic cream' } }
      ]
    },
    {
      linkId: 'rapid_spread',
      text: 'Is the redness or rash spreading quickly within hours?',
      type: 'boolean',
      required: true
    },
    {
      linkId: 'systemic_red_flags',
      text: 'Are you having any of: fever, lip or tongue swelling, difficulty swallowing, or trouble breathing?',
      type: 'boolean',
      required: true
    }
  ]
};

const RESPIRATORY_INTAKE_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  id: 'questionnaire-resp-intake-v1',
  url: 'https://proton.health/fhir/Questionnaire/respiratory-intake',
  version: '1.0.0',
  name: 'RespiratoryClinicalIntake',
  title: 'Respiratory & Cough Dynamic Clinical Intake',
  status: 'active',
  subjectType: ['Patient'],
  date: '2026-10-17',
  publisher: 'Proton Health Clinical Operations',
  description: 'Structured patient-reported dynamic intake for acute and chronic respiratory complaints.',
  item: [
    {
      linkId: 'primary_symptom',
      text: 'What is your primary respiratory symptom?',
      type: 'choice',
      required: true,
      answerOption: [
        { valueCoding: { code: 'cough', display: 'Cough' } },
        { valueCoding: { code: 'shortness_of_breath', display: 'Shortness of breath' } },
        { valueCoding: { code: 'sore_throat', display: 'Sore throat' } },
        { valueCoding: { code: 'congestion', display: 'Sinus pressure or nasal congestion' } }
      ]
    },
    {
      linkId: 'cough_productive',
      text: 'Are you coughing up phlegm or mucus?',
      type: 'boolean',
      required: true,
      enableWhen: [
        { question: 'primary_symptom', operator: '=', answerCoding: { code: 'cough' } }
      ]
    },
    {
      linkId: 'fever_present',
      text: 'Do you currently have a fever (temperature above 100.4°F / 38°C)?',
      type: 'boolean',
      required: true
    },
    {
      linkId: 'respiratory_red_flags',
      text: 'Are you having chest pain, blue lips/fingers, or severe shortness of breath at rest?',
      type: 'boolean',
      required: true
    }
  ]
};

const GENERAL_INTAKE_QUESTIONNAIRE = {
  resourceType: 'Questionnaire',
  id: 'questionnaire-general-v1',
  url: 'https://proton.health/fhir/Questionnaire/general-consultation',
  version: '1.0.0',
  name: 'GeneralClinicalIntake',
  title: 'General Consultation Dynamic Clinical Intake',
  status: 'active',
  subjectType: ['Patient'],
  date: '2026-10-17',
  publisher: 'Proton Health Clinical Operations',
  description: 'General comprehensive health intake questionnaire.',
  item: [
    {
      linkId: 'reason_for_visit',
      text: 'Please describe the main reason for your consultation today:',
      type: 'text',
      required: true
    },
    {
      linkId: 'duration',
      text: 'How long have you had this issue?',
      type: 'string',
      required: true
    },
    {
      linkId: 'emergency_symptoms',
      text: 'Are you experiencing chest pain, severe shortness of breath, sudden weakness, or loss of consciousness?',
      type: 'boolean',
      required: true
    }
  ]
};

const CATALOG = new Map([
  [DERMATOLOGY_INTAKE_QUESTIONNAIRE.id, DERMATOLOGY_INTAKE_QUESTIONNAIRE],
  [RESPIRATORY_INTAKE_QUESTIONNAIRE.id, RESPIRATORY_INTAKE_QUESTIONNAIRE],
  [GENERAL_INTAKE_QUESTIONNAIRE.id, GENERAL_INTAKE_QUESTIONNAIRE]
]);

function getQuestionnaire(id) {
  if (!id) return null;
  const cleanId = String(id).replace(/^Questionnaire\//, '').trim();
  return CATALOG.get(cleanId) || null;
}

function listQuestionnaires() {
  return Array.from(CATALOG.values());
}

module.exports = {
  DERMATOLOGY_INTAKE_QUESTIONNAIRE,
  RESPIRATORY_INTAKE_QUESTIONNAIRE,
  GENERAL_INTAKE_QUESTIONNAIRE,
  getQuestionnaire,
  listQuestionnaires
};
