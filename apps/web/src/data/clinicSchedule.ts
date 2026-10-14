import type { DoctorDeskPatient } from '../components/DoctorDeskEncounter';

export const TODAY_CLINIC_SCHEDULE: DoctorDeskPatient[] = [
  {
    id: 'demo-eleanor-vance',
    name: 'Eleanor Vance',
    age: 68,
    gender: 'Female',
    dob: '1956-04-12',
    mrn: 'EV-94021',
    time: '09:00 AM',
    chiefComplaint: 'Type 2 Diabetes Glycemic Review & Afternoon Fatigue',
    vitals: {
      bp: '138/88 mmHg',
      hr: '74 bpm',
      spo2: '98%',
      temp: '98.4°F',
      bmi: '27.4'
    },
    allergies: ['Penicillin (Severe Anaphylaxis)'],
    conditions: ['Type 2 Diabetes Mellitus (E11.9)', 'Essential Hypertension (I10)'],
    medications: ['Metformin 500 mg Oral Twice Daily', 'Lisinopril 10 mg Oral Once Daily'],
    recentLabs: [
      { name: 'Hemoglobin A1c (HbA1c)', value: '8.2 %', status: 'high', date: '5 days ago', note: 'Escalated from 7.1% baseline' },
      { name: 'Fasting Blood Glucose', value: '158 mg/dL', status: 'high', date: '5 days ago' },
      { name: 'Estimated GFR (eGFR)', value: '68 mL/min/1.73m²', status: 'normal', date: '5 days ago', note: 'Mild reduction' },
      { name: 'Serum Creatinine', value: '1.1 mg/dL', status: 'normal', date: '5 days ago' },
      { name: 'Total Cholesterol', value: '215 mg/dL', status: 'high', date: '5 days ago' },
      { name: 'LDL Cholesterol', value: '138 mg/dL', status: 'high', date: '5 days ago' }
    ],
    documents: [
      {
        name: 'Comprehensive Metabolic Panel (CMP_2026.pdf)',
        date: 'Oct 8, 2026',
        type: 'Laboratory Report',
        summary: 'Elevated HbA1c at 8.2%. Renal function stable with eGFR 68. Electrolytes normal.'
      },
      {
        name: 'Renal Ultrasound Report (Renal_US.pdf)',
        date: 'Sep 14, 2026',
        type: 'Diagnostic Imaging',
        summary: 'Normal renal size and echogenicity bilaterally. No hydronephrosis or renal calculi.'
      }
    ]
  },
  {
    id: 'demo-arthur-pendelton',
    name: 'Arthur Pendelton',
    age: 58,
    gender: 'Male',
    dob: '1966-08-23',
    mrn: 'AP-55102',
    time: '09:45 AM',
    chiefComplaint: 'Exertional Chest Tightness on Climbing Stairs (2 Weeks)',
    vitals: {
      bp: '142/90 mmHg',
      hr: '82 bpm',
      spo2: '97%',
      temp: '98.6°F',
      bmi: '29.1'
    },
    allergies: ['Sulfa Drugs (Cutaneous Rash)'],
    conditions: ['Essential Hypertension (I10)', 'Hyperlipidemia (E78.5)'],
    medications: ['Amlodipine 5 mg Oral Once Daily', 'Atorvastatin 20 mg Oral Once Daily'],
    recentLabs: [
      { name: 'Total Cholesterol', value: '224 mg/dL', status: 'high', date: '12 days ago' },
      { name: 'LDL Cholesterol', value: '142 mg/dL', status: 'high', date: '12 days ago' },
      { name: 'Serum Creatinine', value: '1.4 mg/dL', status: 'high', date: '12 days ago', note: 'Borderline elevated' },
      { name: 'Troponin I (High-Sensitivity)', value: '< 6 ng/L', status: 'normal', date: '12 days ago' }
    ],
    documents: [
      {
        name: 'Resting 12-Lead ECG Report',
        date: 'Oct 2, 2026',
        type: 'Diagnostic Cardiology',
        summary: 'Normal sinus rhythm at 80 bpm. No acute ST-elevation or ischemic T-wave inversions.'
      }
    ]
  },
  {
    id: 'demo-clara-hughes',
    name: 'Clara Hughes',
    age: 34,
    gender: 'Female',
    dob: '1990-11-04',
    mrn: 'CH-88234',
    time: '10:30 AM',
    chiefComplaint: 'Seasonal Asthma Flare & Inhaler Refill Authorization',
    vitals: {
      bp: '118/76 mmHg',
      hr: '68 bpm',
      spo2: '99%',
      temp: '98.2°F',
      bmi: '22.8'
    },
    allergies: ['None Known'],
    conditions: ['Mild Intermittent Asthma (J45.20)'],
    medications: ['Albuterol Sulfate HFA Inhaler 2 puffs PRN', 'Fluticasone Propionate Inhaler QD'],
    recentLabs: [
      { name: 'Peak Expiratory Flow (PEF)', value: '420 L/min', status: 'normal', date: '1 month ago' }
    ],
    documents: [
      {
        name: 'Pulmonary Spirometry Panel',
        date: 'Aug 22, 2026',
        type: 'Pulmonary Function',
        summary: 'Mild obstructive pattern demonstrating significant reversibility post-bronchodilator.'
      }
    ]
  },
  {
    id: 'demo-marcus-chen',
    name: 'Marcus Chen',
    age: 62,
    gender: 'Male',
    dob: '1962-09-20',
    mrn: 'MC-31994',
    time: '11:15 AM',
    chiefComplaint: 'Annual Preventive Wellness Exam & Knee Osteoarthritis Check',
    vitals: {
      bp: '126/80 mmHg',
      hr: '70 bpm',
      spo2: '98%',
      temp: '98.4°F',
      bmi: '25.2'
    },
    allergies: ['Codeine (Nausea/Vomiting)'],
    conditions: ['Pre-diabetes (R73.03)', 'Osteoarthritis Right Knee (M17.11)'],
    medications: ['Vitamin D3 2000 IU Daily', 'Meloxicam 7.5 mg Oral PRN joint pain'],
    recentLabs: [
      { name: 'Hemoglobin A1c (HbA1c)', value: '5.9 %', status: 'normal', date: '2 months ago', note: 'Pre-diabetic baseline' },
      { name: 'Estimated GFR (eGFR)', value: '> 90 mL/min', status: 'normal', date: '2 months ago' }
    ],
    documents: [
      {
        name: 'Right Knee Plain Radiograph',
        date: 'Jul 15, 2026',
        type: 'Diagnostic Radiology',
        summary: 'Mild-to-moderate medial compartment joint space narrowing with early osteophyte formation.'
      }
    ]
  }
];
