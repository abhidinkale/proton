/**
 * One valid `note_v1` fixture, shared by the tests that need to sign a note.
 *
 * Deliberately includes decimals as strings, a supported diagnosis, and a
 * first-line prescription: those are the three fields most likely to drift
 * between a test fixture and the schema.
 */

const NOTE_V1 = {
  schema_version: 'note_v1',
  subjective: {
    chief_complaint: { text: 'sore throat and fever', onset: 'gradual', duration: '3 days', severity: 6 },
    hpi: [],
    pmh: [],
    medications: [],
    allergies: [],
    narrative: 'Sore throat and fever for three days, no cough.'
  },
  objective: {
    vitals: {
      temperature_c: '38.4',
      heart_rate_bpm: '98',
      systolic_bp_mmhg: '128',
      diastolic_bp_mmhg: '82',
      respiratory_rate_bpm: '18',
      spo2_pct: '98',
      weight_kg: '64',
      height_cm: '165'
    },
    exam: [{ system: 'ENT', finding: 'tonsillar exudate', laterality: 'bilateral' }],
    labs: []
  },
  assessment: {
    differential: [
      {
        condition: 'Streptococcal pharyngitis',
        band: 'supported',
        for: ['Centor 4', 'tonsillar exudate'],
        against: [],
        guideline_ref: 'IDSA-2012'
      }
    ],
    primary: { condition: 'Streptococcal pharyngitis', basis: 'Centor score 4 with exudate and fever.' }
  },
  plan: {
    medications: [
      {
        drug: 'Amoxicillin',
        dose: '500 mg',
        route: 'PO',
        frequency: 'three times daily',
        duration_days: 7,
        rationale: 'First-line therapy for group A streptococcal pharyngitis.'
      }
    ],
    orders: [],
    follow_up: { interval: '48 hours', method: 'app', triggers: ['worse', 'fever persists'] },
    education: []
  }
};

module.exports = { NOTE_V1 };
