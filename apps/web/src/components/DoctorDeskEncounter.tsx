import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import {
  ArrowLeft, ArrowUp, Mic, Square, Check, Loader2, AlertCircle, AlertTriangle,
  Pill, FileText, Activity, Plus, CheckCircle2, Copy,
  ClipboardList, RefreshCw, X, Printer, ClipboardCheck, Smartphone, Eye,
  DollarSign, BookOpen, PhoneCall, Pause, Play, ThumbsUp, ThumbsDown, Tag, Sliders, CheckCheck
} from 'lucide-react';
import {
  RealAIService, sendClinicalChat, fetchNoteTemplates, generateConsultationLabel,
  submitEncounterFeedback, type ChatMessage, type NoteTemplateDefinition
} from '../services/ai';
import { RealSpeechService } from '../services/speech';
import { AudioLevelMeter } from './voice/AudioLevelMeter';
import PrescriptionPDFModal from './PrescriptionPDFModal';
import IntakeReview from './intake/IntakeReview';
import { NurseRoomingWorkspace } from './intake/NurseRoomingWorkspace';
import DynamicIntake from './intake/DynamicIntake';
import CaptureSessionPanel from './capture/CaptureSessionPanel';
import ClinicianVisionReview from './vision/ClinicianVisionReview';
import BillingCodingAdvisor from './billing/BillingCodingAdvisor';
import EvidenceGroundingPanel from './evidence/EvidenceGroundingPanel';
import PatientVoiceOutreachModal from './voice/PatientVoiceOutreachModal';
import AfterVisitSummaryModal from './discharge/AfterVisitSummaryModal';
import EncounterEhrSyncModal from './fhir/EncounterEhrSyncModal';
import MedicationSuggestionModal from './medications/MedicationSuggestionModal';
import { streamClinicalPipeline } from '../services/streamService';
import type { PrescriptionItem } from '../types/prescription';
import type { Patient } from '@medplum/fhirtypes';
import ClinicalPerspectivesPanel from './workstation/ClinicalPerspectivesPanel';
import MDSpecialistBoardPanel from './workstation/MDSpecialistBoardPanel';
import StructuredTreatmentPlan, { type StructuredPlanState } from './workstation/StructuredTreatmentPlan';
import SafetyInterventionBanner from './workstation/SafetyInterventionBanner';
import PhysicianSignOffModal from './workstation/PhysicianSignOffModal';
import PatientHandoffView from './workstation/PatientHandoffView';
import EncounterCompletionSummary from './workstation/EncounterCompletionSummary';

export interface DoctorDeskPatient {
  id: string;
  name: string;
  age: number;
  gender: string;
  dob: string;
  mrn: string;
  time: string;
  chiefComplaint: string;
  vitals: {
    bp: string;
    hr: string;
    spo2: string;
    temp: string;
    bmi: string;
  };
  allergies: string[];
  conditions: string[];
  medications: string[];
  recentLabs: Array<{
    name: string;
    value: string;
    status: 'normal' | 'high' | 'low';
    date: string;
    note?: string;
  }>;
  documents: Array<{
    name: string;
    date: string;
    type: string;
    summary: string;
  }>;
  visitType?: string;
  status?: 'ready' | 'waiting' | 'completed';
  preparationState?: string;
  scenarioKey?: string;
  patientPhone?: string;
  contraindicationAlert?: {
    allergen: string;
    offendingDrug: string;
    severity: string;
    risk: string;
  };
  specialistConflict?: {
    specialists: string[];
    differingPerspectives: Array<{ specialist: string; perspective: string }>;
    suggestedQuestions: string[];
    consensus: string[];
  };
  // Milestone 5 Extended Case Schema
  encounterId?: string;
  clinicalHistory?: string[];
  availableObservations?: Record<string, string>;
  missingInformation?: string[];
  consultationTranscript?: string;
  expectedEvidence?: string[];
  knownRiskConditions?: string[];
}

interface DoctorDeskEncounterProps {
  patient: DoctorDeskPatient;
  onCloseMeeting: (summary: { patientId: string; note: any; prescriptions: string[] }) => void;
  onBackToDesk: () => void;
}

export default function DoctorDeskEncounter({ patient, onCloseMeeting, onBackToDesk }: DoctorDeskEncounterProps) {
  const [activeTab, setActiveTab] = useState<'note' | 'billing' | 'evidence' | 'chart' | 'orders' | 'intake'>('note');
  const [intakeSubTab, setIntakeSubTab] = useState<'rooming' | 'questionnaire'>('rooming');

  // Ambient Scribe & Note states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('SOAP');
  const [availableTemplates, setAvailableTemplates] = useState<NoteTemplateDefinition[]>([]);
  const [triageLabel, setTriageLabel] = useState<string>('');
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showMedSuggestionModal, setShowMedSuggestionModal] = useState(false);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [showVisionModal, setShowVisionModal] = useState(false);
  const [activeVisionMediaId, setActiveVisionMediaId] = useState<string | null>(null);
  const [capturedMediaList, setCapturedMediaList] = useState<any[]>([]);
  const [showVoiceOutreachModal, setShowVoiceOutreachModal] = useState(false);
  const [showAvsModal, setShowAvsModal] = useState(false);

  const getPatientId = (ptOrId: DoctorDeskPatient | string): string => {
    return typeof ptOrId === 'string' ? ptOrId : ptOrId.id;
  };

  const getInitialTranscript = (ptOrId: DoctorDeskPatient | string) => {
    if (typeof ptOrId !== 'string' && ptOrId.consultationTranscript) return ptOrId.consultationTranscript;
    const pid = getPatientId(ptOrId).toLowerCase();
    if (pid.includes('arthur')) {
      return "Doctor: Hello Arthur, what brings you into clinic today?\n" +
        "Patient: I have had this tight, squeezing sensation in my chest whenever I walk up two flights of stairs for the past two weeks. It goes away after resting for 5 minutes.\n" +
        "Doctor: Any radiating pain to your jaw, back, or left arm? Any lightheadedness?\n" +
        "Patient: No radiation, just right in the center of the chest. No dizziness.\n" +
        "Doctor: Given your history of high blood pressure and cholesterol, we need to evaluate this as potential angina. Let's get an outpatient stress echocardiogram, start nitroglycerin for emergencies, and titrate your atorvastatin.\n" +
        "Patient: Sounds like a plan Doctor. And remember I am allergic to sulfa medications.";
    }
    if (pid.includes('clara')) {
      return "Doctor: Hi Clara, how has your breathing been?\n" +
        "Patient: Over the last week my seasonal asthma has flared up badly from pollen. I wake up wheezing around 3 AM and my albuterol inhaler only lasts 2 hours.\n" +
        "Doctor: Let's step up your therapy. We will add a 5-day oral prednisone burst and increase your daily maintenance inhaled corticosteroid.\n" +
        "Patient: Thank you Doctor, that has helped in past seasons.";
    }
    if (pid.includes('marcus')) {
      return "Doctor: Good morning Marcus, glad to see you for your annual health review.\n" +
        "Patient: Everything has been good overall Doctor. My right knee acts up on rainy mornings for about 10 minutes, but meloxicam helps.\n" +
        "Doctor: Your vitals look great today. We'll check your annual fasting metabolic panel and review exercises for your knee.";
    }
    if (pid.includes('primary') || pid.includes('sarah')) {
      return "Doctor: Good morning Sarah, glad to see you for your annual preventive review.\n" +
        "Patient: Good morning Doctor. I feel great overall, exercising three times a week. Just here to review my annual bloodwork and ensure my cholesterol is stable.\n" +
        "Doctor: Your vitals look excellent today. BP 120/78, BMI 24.2. Your lipid panel is mostly stable with LDL at 128. We will continue lifestyle management and schedule routine surveillance.\n" +
        "Patient: Perfect, that is very reassuring. Thank you Doctor.";
    }
    if (pid.includes('endo') || pid.includes('harold')) {
      return "Doctor: Good morning Harold, what symptoms have you noticed recently?\n" +
        "Patient: Doctor, I have been dealing with persistent cold intolerance, sluggishness, and dry skin for the last three months despite taking my thyroid pill every morning on an empty stomach.\n" +
        "Doctor: Your recent lab panel shows your TSH is elevated at 7.8 mIU/L with a low-normal Free T4 of 0.8 ng/dL. This indicates your current Levothyroxine 50mcg dose is insufficient. I recommend titrating to 75mcg daily and re-checking thyroid labs in 6 weeks.\n" +
        "Patient: Thank you, I was hoping we could adjust the dose.";
    }
    if (pid.includes('conflict') || pid.includes('beatrice')) {
      return "Doctor: Hello Beatrice, how has your breathing and ankle swelling been?\n" +
        "Patient: My ankles are clear this week Doctor, but I get short of breath when walking up the driveway. I brought records from my previous cardiologist who said my heart pump was at 35%, but the scan I had here last month said it was 55%.\n" +
        "Doctor: That is a critical discrepancy between your historical record and recent echocardiogram. The outside note classified this as heart failure with reduced ejection fraction (HFrEF at 35%), but your latest echo demonstrates heart failure with preserved ejection fraction (HFpEF at 55%). This changes our guideline-directed medical therapy. We will reconcile both reports with repeat imaging and review your SGLT2 inhibitor indication.";
    }
    return "Doctor: Good morning Eleanor, how have you been feeling with your blood sugar lately?\n" +
      "Patient: Honestly Doctor, I have been feeling quite fatigued in the afternoons, and I noticed my morning glucose readings have been creeping up to 150-160.\n" +
      "Doctor: I reviewed your recent bloodwork. Your HbA1c is now 8.2%, up from 7.1% two months ago. You are currently taking Metformin 500mg twice daily, correct?\n" +
      "Patient: Yes, 500mg morning and night. I have tolerated it well with food.\n" +
      "Doctor: Excellent. Because of the HbA1c increase and to protect your kidneys and heart, I recommend increasing Metformin to 1000mg twice daily and adding Empagliflozin 10mg once daily. Let us also recheck your labs in 3 months.\n" +
      "Patient: Sounds like a solid plan Doctor. No penicillin, right? I am still very allergic.\n" +
      "Doctor: Absolutely, strict no-penicillin on your chart.";
  };

  const getInitialNote = (ptOrId: DoctorDeskPatient | string) => {
    const pid = getPatientId(ptOrId).toLowerCase();
    if (pid.includes('arthur')) {
      return {
        subjective: "58-year-old male presents with 2-week history of exertional sub-sternal chest tightness triggered by stair climbing, relieved within 5 minutes of rest. Denies radiation, syncope, or rest dyspnea. Family history of premature CAD (father MI at 65). Allergy: Sulfa drugs.",
        objective: `Vitals: BP ${patient.vitals.bp}, HR ${patient.vitals.hr}, SpO2 ${patient.vitals.spo2}, BMI ${patient.vitals.bmi}.\nExam: Well-nourished male in no acute distress. Heart: S1/S2 normal, no murmurs or gallops. Lungs clear.\nRecent Labs: Total Cholesterol 224 mg/dL, LDL 142 mg/dL, Creatinine 1.4 mg/dL (borderline elevated), hs-Troponin I normal.`,
        assessment: "1. Exertional Angina Pectoris — High clinical suspicion for obstructive coronary artery disease given symptoms and risk profile.\n2. Essential Hypertension — Suboptimal BP control (142/90).\n3. Hyperlipidemia — Elevated LDL.\n4. Borderline Renal Function (Creatinine 1.4 mg/dL).",
        plan: "1. Urgent outpatient stress echocardiogram with myocardial perfusion imaging.\n2. Sublingual Nitroglycerin 0.4 mg PRN chest pain (max 3 doses q5min; call 911 if unresolved).\n3. Increase Atorvastatin to 40 mg PO QD for aggressive ASCVD lipid lowering.\n4. Continue Amlodipine 5 mg PO QD.\n5. Follow-up in 2 weeks or sooner if symptoms escalate."
      };
    }
    if (pid.includes('clara')) {
      return {
        subjective: "34-year-old female presents with acute seasonal asthma exacerbation over past 5 days. Reports nocturnal awakening with wheezing and frequent albuterol rescue use (4-5 times/day). No fever or purulent sputum.",
        objective: `Vitals: BP ${patient.vitals.bp}, HR ${patient.vitals.hr}, SpO2 ${patient.vitals.spo2}, BMI ${patient.vitals.bmi}.\nExam: End-expiratory wheezes throughout bilateral lung fields. No accessory muscle use.\nPeak Expiratory Flow: 420 L/min.`,
        assessment: "1. Acute Exacerbation of Mild Intermittent Asthma triggered by seasonal allergens.",
        plan: "1. Oral Prednisone 40 mg PO Once Daily x 5 days (burst therapy).\n2. Step up maintenance: Fluticasone Propionate 220 mcg 2 puffs BID.\n3. Albuterol Sulfate HFA 2 puffs q4-6h PRN bronchospasm.\n4. Avoid known allergen exposure; follow-up in 10 days if symptoms persist."
      };
    }
    if (pid.includes('marcus')) {
      return {
        subjective: "62-year-old male presents for annual preventive wellness evaluation. Mild right knee stiffness in mornings lasting <15 minutes. Good medication compliance.",
        objective: `Vitals: BP ${patient.vitals.bp}, HR ${patient.vitals.hr}, SpO2 ${patient.vitals.spo2}, BMI ${patient.vitals.bmi}.\nExam: Right knee mild crepitus on passive flexion, no joint effusion or erythema. Gait normal.\nRecent Labs: HbA1c 5.9% (pre-diabetes range), eGFR >90.`,
        assessment: "1. Annual Wellness Examination.\n2. Primary Osteoarthritis of Right Knee — Stable, functional.\n3. Pre-diabetes Mellitus.",
        plan: "1. Intensive lifestyle guidance and medical nutrition therapy for pre-diabetes.\n2. Continue Meloxicam 7.5 mg PO PRN for knee discomfort.\n3. Physical therapy referral for quadriceps strengthening.\n4. Annual influenza vaccine administered."
      };
    }
    if (pid.includes('primary') || pid.includes('sarah')) {
      return {
        subjective: "48-year-old female presents for annual wellness examination. Reports excellent functional status, regular aerobic exercise, no chest pain, dyspnea, or palpitations.",
        objective: `Vitals: BP ${patient.vitals.bp}, HR ${patient.vitals.hr}, SpO2 ${patient.vitals.spo2}, BMI ${patient.vitals.bmi}.\nPhysical Exam: Well-nourished, well-developed female in no acute distress. Heart: Regular rate and rhythm, normal S1/S2. Lungs: Clear to auscultation bilaterally. Abdomen soft, non-tender.\nRecent Labs: Total Cholesterol 210 mg/dL, HDL 58 mg/dL, LDL 128 mg/dL (borderline).`,
        assessment: "1. Annual Preventive Wellness Examination (Z00.00).\n2. Borderline Hyperlipidemia — Well managed on diet and lifestyle.",
        plan: "1. Continue regular aerobic exercise (150 min/week) and Mediterranean dietary pattern.\n2. Repeat fasting lipid profile in 12 months.\n3. Routine preventive health maintenance up to date."
      };
    }
    if (pid.includes('endo') || pid.includes('harold')) {
      return {
        subjective: "54-year-old male presents with 3-month history of worsening fatigue, cold intolerance, and sluggishness. Complies with morning fasting Levothyroxine 50 mcg regimen.",
        objective: `Vitals: BP ${patient.vitals.bp}, HR ${patient.vitals.hr}, SpO2 ${patient.vitals.spo2}, BMI ${patient.vitals.bmi}.\nPhysical Exam: Heart: Mild bradycardia at 60 bpm, regular rhythm. Thyroid: Diffuse mild enlargement without discrete nodularity. Skin: Mild xerosis.\nRecent Labs: TSH 7.8 mIU/L (elevated), Free T4 0.8 ng/dL (borderline low).`,
        assessment: "1. Under-replaced Primary Hypothyroidism (E03.9) — Elevated TSH indicates subtherapeutic levothyroxine dosage.\n2. Metabolic Syndrome (E88.81).",
        plan: "1. Titrate Levothyroxine from 50 mcg to 75 mcg PO Once Daily in morning on empty stomach with water.\n2. Recheck TSH and Free T4 in 6 weeks for dosage optimization.\n3. Lifestyle and nutritional counseling for metabolic syndrome."
      };
    }
    if (pid.includes('conflict') || pid.includes('beatrice')) {
      return {
        subjective: "71-year-old female presents for heart failure follow-up. Reports mild exertional dyspnea when walking uphill; denies orthopnea or PND. Notes historical records stated EF 35% while recent echo showed EF 55%.",
        objective: `Vitals: BP ${patient.vitals.bp}, HR ${patient.vitals.hr}, SpO2 ${patient.vitals.spo2}, BMI ${patient.vitals.bmi}.\nExam: JVP 7 cm H2O. Lungs clear bilaterally. Trace bilateral pedal edema.\nRecent Labs: NT-proBNP 480 pg/mL (mildly elevated), K+ 4.4 mEq/L, Creatinine 1.0 mg/dL.\nEcho Discrepancy: Outside note (2025) diagnosed HFrEF (EF 35%); Recent in-house echo (2026) demonstrates preserved systolic function with EF 55% and Grade II diastolic dysfunction (HFpEF).`,
        assessment: "1. Heart Failure with Preserved Ejection Fraction (HFpEF, I50.30) — Phenotypic discrepancy noted against outside chart; recent objective echo confirms preserved EF with diastolic impairment.\n2. Essential Hypertension — Controlled.\n3. Type 2 Diabetes Mellitus.",
        plan: "1. Maintain Furosemide 20 mg PO QD for volume management.\n2. Continue Lisinopril 10 mg QD and Metoprolol Succinate 25 mg QD.\n3. Order repeat surveillance echocardiogram in 6 months to establish longitudinal stability.\n4. Re-check BMP and renal panel in 3 months."
      };
    }
    if (pid.includes('allergy') || pid.includes('hayes')) {
      return {
        subjective: "52-year-old male presents with 10 days of severe facial pressure, purulent yellow-green nasal discharge, and frontal headache unresponsive to OTC analgesics. Confirmed severe Penicillin anaphylaxis history requiring epinephrine.",
        objective: `Vitals: BP ${patient.vitals.bp}, HR ${patient.vitals.hr}, SpO2 ${patient.vitals.spo2}, Temp ${patient.vitals.temp}, BMI ${patient.vitals.bmi}.\nExam: Moderate bilateral maxillary sinus tenderness to percussion. Purulent drainage visible in middle meatus. Oropharynx clear.\nRecent Labs: WBC 11.2 K/uL (mild leukocytosis).`,
        assessment: "1. Acute Bacterial Maxillary Sinusitis (J01.00) — Clinical criteria met (>10 days of purulent discharge and facial pain).\n2. Documented Severe Penicillin Anaphylaxis — Beta-lactam contraindicated (Hard Stop).",
        plan: "1. Doxycycline 100 mg PO Twice Daily x 7 days (non-beta-lactam first-line alternative).\n2. Saline nasal irrigation BID.\n3. Fluticasone nasal spray 1 spray each nostril daily.\n4. Avoid all beta-lactam antibiotics; return if high fever or visual changes develop."
      };
    }
    return {
      subjective: "68-year-old female presents for glycemic follow-up. Reports worsening afternoon fatigue and home fasting glucose readings averaging 150-160 mg/dL. Reports good gastrointestinal tolerance of current Metformin 500 mg BID regimen. Confirmed severe Penicillin allergy (anaphylaxis history).",
      objective: `Vitals: BP ${patient.vitals.bp}, HR ${patient.vitals.hr}, SpO2 ${patient.vitals.spo2}, BMI ${patient.vitals.bmi}.\nPhysical Exam: Well-appearing, alert, oriented x4. Regular rate and rhythm. Clear lungs bilaterally. Diabetic foot inspection negative for ulcers or skin breakdown.\nRecent Labs: HbA1c 8.2% (elevated from 7.1%), eGFR 68 mL/min/1.73m², Fasting Glucose 158 mg/dL.`,
      assessment: "1. Type 2 Diabetes Mellitus — Inadequate glycemic control on submaximal metformin monotherapy with HbA1c escalation to 8.2%.\n2. Essential Hypertension — Stable on Lisinopril 10 mg QD.\n3. Mild Renal Impairment (eGFR 68) — Warranting cardiorenal protective therapy.",
      plan: "1. Titrate Metformin from 500 mg BID to 1000 mg BID with meals.\n2. Initiate Empagliflozin 10 mg PO Once Daily for glycemic optimization and cardiorenal risk reduction.\n3. Continue Lisinopril 10 mg PO Once Daily.\n4. Strict Penicillin avoidance re-verified.\n5. Follow-up: Repeat HbA1c, BMP, and renal function in 3 months."
    };
  };

  const getInitialPrescriptions = (ptOrId: DoctorDeskPatient | string) => {
    const pid = getPatientId(ptOrId).toLowerCase();
    if (pid.includes('arthur')) {
      return [
        { id: 'p-a1', name: 'Amlodipine', dose: '5 mg', freq: 'Oral Once daily', duration: 'Current', status: 'active' as const },
        { id: 'p-a2', name: 'Atorvastatin', dose: '40 mg', freq: 'Oral Once daily at bedtime', duration: '90 days', status: 'new' as const },
        { id: 'p-a3', name: 'Nitroglycerin Sublingual', dose: '0.4 mg', freq: 'Sublingual PRN chest pain', duration: '30 days', status: 'new' as const }
      ];
    }
    if (pid.includes('clara')) {
      return [
        { id: 'p-c1', name: 'Prednisone', dose: '40 mg', freq: 'Oral Once daily in morning', duration: '5 days', status: 'new' as const },
        { id: 'p-c2', name: 'Fluticasone Propionate', dose: '220 mcg', freq: 'Inhalation 2 puffs Twice daily', duration: '60 days', status: 'new' as const },
        { id: 'p-c3', name: 'Albuterol Sulfate HFA', dose: '90 mcg/actuation', freq: 'Inhalation 2 puffs q4-6h PRN', duration: '30 days', status: 'active' as const }
      ];
    }
    if (pid.includes('marcus')) {
      return [
        { id: 'p-m1', name: 'Meloxicam', dose: '7.5 mg', freq: 'Oral Once daily PRN with food', duration: 'Current', status: 'active' as const },
        { id: 'p-m2', name: 'Vitamin D3 (Cholecalciferol)', dose: '2000 IU', freq: 'Oral Once daily', duration: 'Current', status: 'active' as const }
      ];
    }
    if (pid.includes('allergy') || pid.includes('hayes')) {
      return [
        { id: 'p-allergy-1', name: 'Amoxicillin-Clavulanate (Augmentin)', dose: '875/125 mg', freq: 'Oral Twice daily with food', duration: '10 days', status: 'new' as const },
        { id: 'p-allergy-2', name: 'Fluticasone Propionate Nasal Spray', dose: '50 mcg/actuation', freq: '1-2 sprays daily', duration: '30 days', status: 'active' as const }
      ];
    }
    if (pid.includes('primary') || pid.includes('sarah')) {
      return [
        { id: 'p-s1', name: 'Multivitamin Formula', dose: '1 tablet', freq: 'Oral Once daily', duration: 'Current', status: 'active' as const }
      ];
    }
    if (pid.includes('endo') || pid.includes('harold')) {
      return [
        { id: 'p-h1', name: 'Levothyroxine', dose: '75 mcg', freq: 'Oral Once daily in morning', duration: '90 days', status: 'new' as const }
      ];
    }
    if (pid.includes('conflict') || pid.includes('beatrice')) {
      return [
        { id: 'p-b1', name: 'Furosemide', dose: '20 mg', freq: 'Oral Once daily in morning', duration: 'Current', status: 'active' as const },
        { id: 'p-b2', name: 'Lisinopril', dose: '10 mg', freq: 'Oral Once daily', duration: 'Current', status: 'active' as const },
        { id: 'p-b3', name: 'Metoprolol Succinate', dose: '25 mg', freq: 'Oral Once daily', duration: 'Current', status: 'active' as const }
      ];
    }
    return [
      { id: 'p1', name: 'Metformin', dose: '1000 mg', freq: 'Oral Twice daily with meals', duration: '90 days', status: 'new' as const },
      { id: 'p2', name: 'Empagliflozin', dose: '10 mg', freq: 'Oral Once daily in morning', duration: '90 days', status: 'new' as const },
      { id: 'p3', name: 'Lisinopril', dose: '10 mg', freq: 'Oral Once daily', duration: 'Current', status: 'active' as const }
    ];
  };

  const getInitialStructuredPlan = (ptOrId: DoctorDeskPatient | string, meds: any[]): StructuredPlanState => {
    const pid = getPatientId(ptOrId).toLowerCase();
    return {
      medications: meds.map(m => ({
        id: m.id,
        name: m.name,
        dose: m.dose,
        route: 'Oral',
        frequency: m.freq,
        duration: m.duration,
        indication: 'Clinical indication',
        status: m.status === 'active' ? 'approved' : 'draft',
        isEdited: false
      })),
      investigations: pid.includes('arthur') ? [
        { id: 'inv-1', testName: 'Outpatient Stress Echocardiogram with Myocardial Perfusion', category: 'Diagnostic Imaging', urgency: 'Routine', indication: 'Exertional angina rule-out', status: 'draft' }
      ] : pid.includes('eleanor') ? [
        { id: 'inv-2', testName: 'Comprehensive Metabolic Panel & HbA1c (Repeat at 3 Months)', category: 'Laboratory', urgency: 'Routine', indication: 'T2DM & CKD surveillance', status: 'draft' },
        { id: 'inv-3', testName: 'Spot Urinary Microalbumin/Creatinine Ratio', category: 'Laboratory', urgency: 'Routine', indication: 'Diabetic nephropathy baseline', status: 'draft' }
      ] : pid.includes('endo') || pid.includes('harold') ? [
        { id: 'inv-h1', testName: 'Repeat TSH & Free T4 Panel (in 6 Weeks)', category: 'Laboratory', urgency: 'Routine', indication: 'Levothyroxine dose titration surveillance', status: 'draft' }
      ] : pid.includes('conflict') || pid.includes('beatrice') ? [
        { id: 'inv-b1', testName: 'Surveillance Transthoracic Echocardiogram (in 6 Months)', category: 'Diagnostic Imaging', urgency: 'Routine', indication: 'Longitudinal EF reconciliation & diastolic staging', status: 'draft' }
      ] : [],
      followUp: {
        timeframe: pid.includes('arthur') ? '2 weeks for stress echo review' : pid.includes('endo') ? '6 weeks for repeat thyroid labs' : pid.includes('conflict') ? '1 month for clinical stability review' : '3 months for routine follow-up',
        specialty: 'Internal Medicine Outpatient Clinic',
        instructions: 'Return earlier if acute chest pain, lightheadedness, or shortness of breath occurs.',
        status: 'draft'
      },
      patientInstructions: {
        text: pid.includes('eleanor') 
          ? '1. Take Metformin 1000 mg twice daily with morning and evening meals.\n2. Take Empagliflozin 10 mg once daily every morning with water.\n3. Monitor home fasting blood glucose and keep a written log.\n4. Strict Penicillin avoidance confirmed.\n5. Call clinic immediately if experiencing fever, severe fatigue, or nausea.'
          : pid.includes('endo')
          ? '1. Take Levothyroxine 75 mcg every morning on an empty stomach with a full glass of water.\n2. Wait at least 30 to 60 minutes before breakfast or coffee for proper absorption.\n3. Repeat blood test in 6 weeks.'
          : '1. Take all prescribed medications as scheduled.\n2. Keep your follow-up appointment in clinic.\n3. Call 911 immediately if you experience severe chest pain, shortness of breath, or syncope.',
        status: 'draft'
      }
    };
  };

  const [transcript, setTranscript] = useState(() => getInitialTranscript(patient));
  const [note, setNote] = useState(() => getInitialNote(patient));
  const [prescriptions, setPrescriptions] = useState(() => getInitialPrescriptions(patient));
  const [structuredPlan, setStructuredPlan] = useState<StructuredPlanState>(() => getInitialStructuredPlan(patient, getInitialPrescriptions(patient)));
  const [encounterPhase, setEncounterPhase] = useState<'consultation' | 'completed' | 'handoff'>('consultation');
  const [rightPanelMode, setRightPanelMode] = useState<'68md' | 'perspectives' | 'copilot'>('68md');
  const [isTranscriptCollapsed, setIsTranscriptCollapsed] = useState(true);
  const [overrideDirective, setOverrideDirective] = useState('');
  const [isSignOffModalOpen, setIsSignOffModalOpen] = useState(false);
  const [completedSummaryData, setCompletedSummaryData] = useState<any>(null);
  const encounterStartTimeRef = useRef(Date.now());

  const hasContraindication = Boolean(
    patient.contraindicationAlert ||
    (
      patient.allergies?.some(a => a.toLowerCase().includes('penicillin')) &&
      structuredPlan.medications.some(m => {
        const lower = m.name.toLowerCase();
        return lower.includes('amox') || lower.includes('augmentin') || lower.includes('penicillin') || lower.includes('ampicillin');
      })
    )
  );

  useEffect(() => {
    void fetchNoteTemplates().then(templates => {
      if (templates && templates.length > 0) {
        setAvailableTemplates(templates);
      }
    });
  }, []);

  useEffect(() => {
    const initialTranscript = getInitialTranscript(patient.id);
    const initialMeds = getInitialPrescriptions(patient.id);
    setTranscript(initialTranscript);
    setNote(getInitialNote(patient.id));
    setPrescriptions(initialMeds);
    setStructuredPlan(getInitialStructuredPlan(patient.id, initialMeds));
    setEncounterPhase('consultation');
    setRightPanelMode('perspectives');
    setOverrideDirective('');
    setFeedbackRating(null);
    setFeedbackSubmitted(false);
    encounterStartTimeRef.current = Date.now();
    void generateConsultationLabel(initialTranscript, patient.name).then(lbl => {
      if (lbl) setTriageLabel(lbl);
    });
    setChatMessages([
      {
        role: 'assistant',
        content: `Hello Doctor. I have ${patient.name}'s chart loaded (${patient.age}${patient.gender.charAt(0)}, ${patient.conditions.join(', ')}). How can I assist with this encounter?`
      }
    ]);
  }, [patient.id]);

  // Copilot Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hello Doctor. I have ${patient.name}'s chart loaded (${patient.age}${patient.gender.charAt(0)}, ${patient.conditions.join(', ')}). How can I assist with this encounter?`
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Close Meeting Modal State
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [deskShortcutFeedback, setDeskShortcutFeedback] = useState<string | null>(null);

  // SSE Stream Progress State (M2C-3)
  const [streamProgress, setStreamProgress] = useState<{
    stage: string;
    message: string;
    isStreaming: boolean;
  }>({ stage: '', message: '', isStreaming: false });

  // Audio Recording references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Global Physician Keyboard Shortcuts for Doctor's Desk
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      // 1. Esc to close open modals
      if (e.key === 'Escape') {
        if (isSignOffModalOpen) setIsSignOffModalOpen(false);
        if (isCloseModalOpen) setIsCloseModalOpen(false);
        if (showPdfModal) setShowPdfModal(false);
        return;
      }

      // 2. Cmd/Ctrl + Enter: Open sign-off modal
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        setIsSignOffModalOpen(true);
        setDeskShortcutFeedback('Ready to sign off (⌘↵)');
        setTimeout(() => setDeskShortcutFeedback(null), 2500);
        return;
      }

      // Cmd/Ctrl + T: Toggle ambient transcript drawer
      if ((e.metaKey || e.ctrlKey) && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        setIsTranscriptCollapsed(prev => !prev);
        setDeskShortcutFeedback(isTranscriptCollapsed ? 'Transcript opened (⌘T)' : 'Transcript hidden (⌘T)');
        setTimeout(() => setDeskShortcutFeedback(null), 2000);
        return;
      }

      // 3. Cmd/Ctrl + S: Save draft to session storage
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        try {
          sessionStorage.setItem(`proton_desk_draft_${patient.id}`, JSON.stringify({
            transcript,
            note,
            prescriptions,
            updatedAt: new Date().toISOString()
          }));
          setDeskShortcutFeedback('Encounter draft saved (⌘S)');
          setTimeout(() => setDeskShortcutFeedback(null), 2500);
        } catch {}
        return;
      }

      // 4. Cmd/Ctrl + 1/2/3 to switch tabs
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        setActiveTab('note');
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault();
        setActiveTab('chart');
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '3') {
        e.preventDefault();
        setActiveTab('orders');
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '4') {
        e.preventDefault();
        setActiveTab('intake');
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '5') {
        e.preventDefault();
        setActiveTab('billing');
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '6') {
        e.preventDefault();
        setActiveTab('evidence');
        return;
      }

      // 5. Cmd/Ctrl + Shift + C: Copy formatted note
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        const fullText = `SUBJECTIVE:\n${note.subjective}\n\nOBJECTIVE:\n${note.objective}\n\nASSESSMENT:\n${note.assessment}\n\nPLAN:\n${note.plan}`;
        navigator.clipboard.writeText(fullText);
        setDeskShortcutFeedback('SOAP note copied to clipboard');
        setTimeout(() => setDeskShortcutFeedback(null), 2000);
        return;
      }

      // 6. Alt + Space: Toggle recording
      if (e.altKey && e.code === 'Space') {
        e.preventDefault();
        void toggleRecording();
        setDeskShortcutFeedback(isRecording ? 'Recording paused' : 'Recording started');
        setTimeout(() => setDeskShortcutFeedback(null), 2000);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isCloseModalOpen, showPdfModal, patient.id, transcript, note, prescriptions, isRecording]);

  const chartContext = `
Patient: ${patient.name}, ${patient.age}${patient.gender.charAt(0).toUpperCase()}, DOB: ${patient.dob}, MRN: ${patient.mrn}
Chief Complaint: ${patient.chiefComplaint}
Vitals: BP ${patient.vitals.bp}, HR ${patient.vitals.hr}, SpO2 ${patient.vitals.spo2}, BMI ${patient.vitals.bmi}
Allergies: ${patient.allergies.join(', ') || 'No known allergies'}
Active Conditions: ${patient.conditions.join(', ')}
Current Medications: ${patient.medications.join(', ')}
Recent Labs: ${patient.recentLabs.map(l => `${l.name}: ${l.value} (${l.status})`).join('; ')}
Active Note Assessment: ${note.assessment}
Active Note Plan: ${note.plan}
`.trim();

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      clearInterval(timerIntervalRef.current);
      setIsRecording(false);
      setIsPaused(false);
      if (audioStream) {
        audioStream.getTracks().forEach(t => t.stop());
        setAudioStream(null);
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioStream(stream);
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach(t => t.stop());
          setAudioStream(null);
          await processCapturedAudio(audioBlob);
        };

        mediaRecorder.start(250);
        setIsRecording(true);
        setIsPaused(false);
        setRecordingSeconds(0);
        timerIntervalRef.current = setInterval(() => {
          setRecordingSeconds(s => s + 1);
        }, 1000);
      } catch (err) {
        console.error('Microphone access failed:', err);
        alert('Could not access microphone. Please ensure microphone permissions are granted in your browser.');
      }
    }
  };

  const togglePauseRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(timerIntervalRef.current);
    }
  };

  const handleFeedback = async (rating: number, status: string) => {
    setFeedbackRating(rating);
    setFeedbackSubmitted(true);
    await submitEncounterFeedback({
      encounterId: `enc-${patient.id}`,
      patientId: patient.id,
      overallRating: rating,
      noteDraftStatus: status,
      encounterDurationMinutes: Math.max(1, Math.round(recordingSeconds / 60))
    });
    setTimeout(() => {
      setFeedbackSubmitted(false);
    }, 4000);
  };

  const processCapturedAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const speechService = new RealSpeechService();
      const transcribed = await speechService.transcribe(blob);
      if (transcribed && transcribed.trim()) {
        const updatedTranscript = transcript ? `${transcript}\n\n${transcribed}` : transcribed;
        setTranscript(updatedTranscript);
        await generateNoteFromTranscript(updatedTranscript);
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      setCopySuccess(err.message || 'No valid audio was transcribed. Please check microphone or type directly.');
      setTimeout(() => setCopySuccess(null), 4000);
    } finally {
      setIsTranscribing(false);
    }
  };

  const testSampleAudioDialogue = async () => {
    setIsTranscribing(true);
    try {
      const sample = getInitialTranscript(patient.id);
      setTranscript(sample);
      await generateNoteFromTranscript(sample);
      setCopySuccess('Loaded sample audio & updated clinical note');
      setTimeout(() => setCopySuccess(null), 2500);
    } finally {
      setIsTranscribing(false);
    }
  };

  const applyTemplateOutputToNote = (result: any, template: string) => {
    if (!result) return;
    if (template === 'SOAP') {
      setNote({
        subjective: result.subjective || note.subjective,
        objective: result.objective || note.objective,
        assessment: result.assessment || note.assessment,
        plan: result.plan || note.plan
      });
    } else if (template === 'HANDOVER') {
      setNote({
        subjective: `SITUATION: ${result.situation || 'Patient under review'}`,
        objective: `BACKGROUND: ${result.background || 'History available in chart'}`,
        assessment: `ASSESSMENT: ${result.assessment || 'Stable'}`,
        plan: `RECOMMENDATION / CONTINGENCY: ${result.recommendation || 'Standard care'}`
      });
    } else if (template === 'PSYCH') {
      setNote({
        subjective: `PRESENTING ILLNESS:\n${result.historyOfPresentingIllness || 'None reported'}\n\nPAST PSYCH HX:\n${result.pastMedicalHistory || 'Non-contributory'}`,
        objective: `MENTAL STATUS EXAM (MSE):\n${result.mentalStatusExam || 'Normal examination'}\n\nCURRENT MEDICATIONS:\n${result.medications || 'None'}`,
        assessment: `DIAGNOSTIC IMPRESSION:\n${result.impressionAndPlan || 'Under evaluation'}`,
        plan: `SAFETY ASSESSMENT & PLAN:\n${result.impressionAndPlan || 'Safety precautions confirmed'}`
      });
    } else {
      setNote({
        subjective: `CHIEF COMPLAINT: ${result.chiefComplaint || 'None'}\n\nHPI: ${result.historyOfPresentIllness || 'None'}`,
        objective: `EXAM: ${result.examinationFindings || 'None'}\n\nINVESTIGATIONS: ${(result.investigations || []).join(', ')}`,
        assessment: result.assessment || note.assessment,
        plan: `${result.plan || ''}\n\nFOLLOW UP: ${result.followUp || ''}`
      });
    }
  };

  const generateNoteFromTranscript = async (textToUse?: string, templateOverride?: string) => {
    const text = textToUse || transcript;
    const templateToUse = templateOverride || selectedTemplate;
    if (!text.trim()) return;
    setIsGeneratingNote(true);
    setStreamProgress({ stage: 'INPUT_RECEIVED', message: 'Initiating real-time clinical stream...', isStreaming: true });

    void generateConsultationLabel(text, patient.name).then(lbl => {
      if (lbl) setTriageLabel(lbl);
    });

    try {
      // Execute streaming clinical pipeline (M2C-3)
      await streamClinicalPipeline({
        patientId: patient.id,
        transcript: text,
        template: templateToUse,
        prescriptions: prescriptions.map(p => ({
          name: p.name,
          dosage: p.dose,
          route: 'oral',
          frequency: p.freq
        }))
      }, {
        onEvent: (event) => {
          if (event.type === 'MULTIMODAL_CONTEXT_STARTED') {
            setStreamProgress({ stage: event.type, message: 'Assembling multimodal clinical context...', isStreaming: true });
          } else if (event.type === 'FHIR_CONTEXT_READY') {
            setStreamProgress({ stage: event.type, message: 'FHIR longitudinal history synchronized', isStreaming: true });
          } else if (event.type === 'INTAKE_CONTEXT_READY') {
            setStreamProgress({ stage: event.type, message: 'Patient intake responses loaded', isStreaming: true });
          } else if (event.type === 'DOCUMENT_CONTEXT_READY') {
            setStreamProgress({ stage: event.type, message: 'Clinical document facts loaded', isStreaming: true });
          } else if (event.type === 'VISION_CONTEXT_READY') {
            setStreamProgress({ stage: event.type, message: 'Clinical image findings synchronized', isStreaming: true });
          } else if (event.type === 'EVIDENCE_RETRIEVAL_STARTED') {
            setStreamProgress({ stage: event.type, message: 'Retrieving evidence & clinical guidelines...', isStreaming: true });
          } else if (event.type === 'EVIDENCE_RETRIEVAL_COMPLETE') {
            setStreamProgress({ stage: event.type, message: 'Clinical evidence matched', isStreaming: true });
          } else if (event.type === 'CLINICAL_CONTEXT_READY') {
            setStreamProgress({ stage: event.type, message: 'Multimodal clinical context ready', isStreaming: true });
          } else if (event.type === 'AI_ANALYSIS_STARTED') {
            setStreamProgress({ stage: event.type, message: 'AI clinical reasoning & note synthesis...', isStreaming: true });
          } else if (event.type === 'AI_ANALYSIS_COMPLETE') {
            setStreamProgress({ stage: event.type, message: 'AI note draft synthesized', isStreaming: true });
          } else if (event.type === 'SAFETY_CHECK_STARTED') {
            setStreamProgress({ stage: event.type, message: 'Deterministic safety check...', isStreaming: true });
          } else if (event.type === 'SAFETY_WARNING') {
            setStreamProgress({ stage: event.type, message: 'Safety review warnings detected', isStreaming: true });
          } else if (event.type === 'EMERGENCY_DETECTED') {
            setStreamProgress({ stage: event.type, message: 'Emergency triage red-flag detected', isStreaming: true });
          } else if (event.type === 'SAFETY_LOCKED') {
            setStreamProgress({ stage: event.type, message: 'Safety locked: contraindication detected', isStreaming: false });
          } else if (event.type === 'CLINICAL_OUTPUT_READY') {
            setStreamProgress({ stage: event.type, message: 'Clinical output ready', isStreaming: true });
          }
        },
        onComplete: (terminalEvent) => {
          if (terminalEvent.payload?.output?.soapNote) {
            applyTemplateOutputToNote(terminalEvent.payload.output.soapNote, templateToUse);
          }
          setStreamProgress({ stage: 'STREAM_COMPLETE', message: 'Real-time sync complete', isStreaming: false });
          setTimeout(() => setStreamProgress(prev => ({ ...prev, message: '' })), 3000);
        },
        onError: async (err) => {
          console.warn('[DoctorDesk] SSE streaming fallback to unary AI note:', err.message);
          const aiService = new RealAIService();
          const result = await aiService.generateNote(text, chartContext, templateToUse);
          if (result) {
            applyTemplateOutputToNote(result, templateToUse);
          }
          setStreamProgress({ stage: 'FALLBACK', message: '', isStreaming: false });
        }
      });
    } catch (err: any) {
      console.error('Failed to generate note via streaming, falling back to unary:', err);
      try {
        const aiService = new RealAIService();
        const result = await aiService.generateNote(text, chartContext, templateToUse);
        if (result) {
          applyTemplateOutputToNote(result, templateToUse);
        }
      } catch (unaryErr) {
        console.error('Unary note fallback also failed:', unaryErr);
      }
      setStreamProgress({ stage: '', message: '', isStreaming: false });
    } finally {
      setIsGeneratingNote(false);
    }
  };

  const handleSendChat = async (promptText?: string) => {
    const text = (promptText || chatInput).trim();
    if (!text || isChatSending) return;

    const newMsgs: ChatMessage[] = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(newMsgs);
    setChatInput('');
    setIsChatSending(true);

    try {
      const reply = await sendClinicalChat(newMsgs.slice(-10), chartContext);
      setChatMessages([...newMsgs, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setChatMessages([
        ...newMsgs,
        { role: 'assistant', content: `Error: ${err?.message || 'Unable to reach clinical copilot.'}` }
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendChat();
    }
  };

  const insertIntoPlan = (text: string) => {
    setNote(prev => ({
      ...prev,
      plan: `${prev.plan}\n\n[Copilot Suggestion]:\n${text}`
    }));
    setActiveTab('note');
    setCopySuccess('Inserted into Plan');
    setTimeout(() => setCopySuccess(null), 2500);
  };

  const copyNoteForEhr = () => {
    const fullText = `PATIENT: ${patient.name} (MRN: ${patient.mrn})
DATE OF ENCOUNTER: ${new Date().toLocaleDateString()}

SUBJECTIVE:
${note.subjective}

OBJECTIVE:
${note.objective}

ASSESSMENT:
${note.assessment}

PLAN:
${note.plan}

SIGNED: Dr. Physician, Attending Physician`.trim();

    navigator.clipboard.writeText(fullText);
    setCopySuccess('SOAP Note copied for EHR!');
    setTimeout(() => setCopySuccess(null), 2500);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formattedPdfMeds: PrescriptionItem[] = prescriptions.map(p => ({
    id: p.id,
    name: p.name,
    strength: p.dose,
    dose: '1 unit',
    route: 'Oral',
    frequency: p.freq,
    duration: p.duration,
    instructions: 'Take as directed with water.'
  }));

  const fhirPatient: Patient = {
    resourceType: 'Patient',
    id: patient.id,
    name: [{ given: [patient.name.split(' ')[0]], family: patient.name.split(' ').slice(1).join(' ') }],
    birthDate: patient.dob,
    gender: patient.gender.toLowerCase() as any
  };

  if (encounterPhase === 'completed') {
    const elapsedSeconds = Math.round((Date.now() - encounterStartTimeRef.current) / 1000);
    return (
      <div className="min-h-screen bg-canvas p-6 lg:p-12 flex items-center justify-center font-sans">
        <EncounterCompletionSummary
          patient={patient}
          durationSeconds={completedSummaryData?.durationSeconds || elapsedSeconds}
          timeSavedMinutes={completedSummaryData?.timeSavedMinutes || 11}
          onViewPatientHandoff={() => setEncounterPhase('handoff')}
          onReturnToSchedule={onBackToDesk}
        />
      </div>
    );
  }

  if (encounterPhase === 'handoff') {
    return (
      <div className="min-h-screen bg-canvas p-6 lg:p-12 flex items-center justify-center font-sans">
        <PatientHandoffView
          patient={patient}
          plan={structuredPlan}
          onFinish={onBackToDesk}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-canvas text-ink overflow-hidden font-sans antialiased">
      {/* TOP DESK HEADER */}
      <header className="h-16 shrink-0 border-b border-rule bg-paper px-6 flex items-center justify-between shadow-2xs z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToDesk}
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-ink transition-colors p-2 rounded-xl hover:bg-paper-2 cursor-pointer"
            title="Back to queue"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="h-4 w-[1px] bg-paper-2" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-ink tracking-tight">{patient.name}</h1>
              <span className="text-xs text-ink-2">({patient.age}y, {patient.gender})</span>
              {patient.allergies.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-critical bg-critical-wash border border-critical-line/70 px-2 py-0.5 rounded-full ml-1">
                  <AlertTriangle size={11} className="shrink-0" />
                  Allergy: {patient.allergies.join(', ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 text-xs text-ink-2 mt-0.5">
              <span>BP <strong className="text-ink">{patient.vitals.bp}</strong></span>
              <span>•</span>
              <span>HR <strong className="text-ink">{patient.vitals.hr}</strong></span>
              <span>•</span>
              <span>SpO2 <strong className="text-ink">{patient.vitals.spo2}</strong></span>
              <span>•</span>
              <span>BMI <strong className="text-ink">{patient.vitals.bmi}</strong></span>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-1.5 bg-paper hover:bg-paper-2 text-ink text-xs font-medium px-3 py-2 rounded-xl border border-rule transition-all cursor-pointer"
            title="Export Prescription PDF"
          >
            <Printer size={13} />
            <span className="hidden md:inline">Prescription PDF</span>
          </button>

          <button
            onClick={() => setShowCaptureModal(true)}
            className="flex items-center gap-1.5 bg-paper hover:bg-paper-2 text-ink text-xs font-medium px-3 py-2 rounded-xl border border-rule transition-all cursor-pointer"
            title="Mobile QR capture"
          >
            <Smartphone size={13} />
            <span className="hidden md:inline">Mobile QR</span>
          </button>

          <button
            onClick={() => {
              if (capturedMediaList.length > 0) {
                setActiveVisionMediaId(capturedMediaList[0].id || capturedMediaList[0].mediaId);
              }
              setShowVisionModal(true);
            }}
            className="flex items-center gap-1.5 bg-paper hover:bg-paper-2 text-ink text-xs font-medium px-3 py-2 rounded-xl border border-rule transition-all cursor-pointer"
            title="Review visual AI images"
          >
            <Eye size={13} />
            <span className="hidden md:inline">Visual AI {capturedMediaList.length > 0 ? `(${capturedMediaList.length})` : ''}</span>
          </button>

          <button
            onClick={() => setShowVoiceOutreachModal(true)}
            className="flex items-center gap-1.5 bg-accent-wash hover:bg-accent-wash text-accent-ink text-xs font-semibold px-3 py-2 rounded-xl border border-accent-line transition-all cursor-pointer"
            title="Launch Autonomous Patient Voice Outreach"
          >
            <PhoneCall size={13} className="text-accent-ink" />
            <span className="hidden md:inline">Voice Outreach</span>
          </button>

          <button
            onClick={() => setShowAvsModal(true)}
            className="flex items-center gap-1.5 bg-settled-wash hover:bg-settled-wash text-settled text-xs font-semibold px-3 py-2 rounded-xl border border-settled-line transition-all cursor-pointer"
            title="Patient After-Visit Summary & Discharge Instructions"
          >
            <FileText size={13} className="text-settled" />
            <span className="hidden md:inline">After-Care AVS</span>
          </button>

          {deskShortcutFeedback && (
            <div className="flex items-center gap-1.5 bg-solid text-white px-2.5 py-1.5 rounded-xl text-xs font-medium shadow-md">
              <CheckCircle2 size={12} className="text-settled-on-solid" />
              <span>{deskShortcutFeedback}</span>
            </div>
          )}

          <button
            onClick={() => setIsSignOffModalOpen(true)}
            className="flex items-center gap-1.5 bg-solid hover:bg-solid text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer ml-1"
          >
            <Check size={14} strokeWidth={2.5} className="text-settled-on-solid" />
            <span>Sign Off</span>
            <span className="text-[10px] opacity-60 font-mono hidden sm:inline">⌘↵</span>
          </button>
        </div>
      </header>

      {/* MAIN TWO-COLUMN SPLIT WORKSPACE */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* LEFT PANEL: CLINICAL WORKSPACE (65%) */}
        <section className="flex flex-col flex-1 min-w-0 border-r border-rule bg-paper-2">
          {/* TAB BAR & AMBIENT CONTROLS */}
          <div className="h-12 border-b border-rule bg-paper px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'note', label: 'Consultation Note', icon: ClipboardList },
                { id: 'billing', label: 'Billing & RCM (4.0× ROI)', icon: DollarSign, badge: '4.0× ROI' },
                { id: 'evidence', label: 'Evidence (PubMed RAG)', icon: BookOpen },
                { id: 'chart', label: 'Chart & Labs', icon: Activity },
                { id: 'orders', label: `Orders (${prescriptions.length})`, icon: Pill },
                { id: 'intake', label: 'Rooming & Intake', icon: ClipboardCheck }
              ].map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0 ${
                      active
                        ? 'bg-solid text-white shadow-2xs font-semibold'
                        : tab.id === 'billing'
                        ? 'text-settled bg-settled-wash hover:bg-settled-wash hover:text-settled'
                        : 'text-ink-2 hover:text-ink hover:bg-paper-2'
                    }`}
                  >
                    <tab.icon size={13} className={tab.id === 'billing' && !active ? 'text-settled' : ''} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Ambient Mic & Audio Test Controls */}
            <div className="flex items-center gap-2">
              {isRecording && (
                <AudioLevelMeter
                  stream={audioStream}
                  isRecording={isRecording}
                  isPaused={isPaused}
                />
              )}
              {/* Scribe State Indicator (Section 20: LISTENING, PAUSED, PROCESSING, READY, ERROR, OFFLINE) */}
              {(() => {
                const isOffline = patient.scenarioKey === 'scenario-f';
                let scribeState: string = 'READY';
                if (isOffline) {
                  scribeState = 'OFFLINE';
                } else if (isTranscribing || isGeneratingNote) {
                  scribeState = 'PROCESSING';
                } else if (isRecording) {
                  scribeState = isPaused ? 'PAUSED' : 'LISTENING';
                }

                return (
                  <div 
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                      scribeState === 'LISTENING'
                        ? 'bg-settled-wash border-settled-line text-settled'
                        : scribeState === 'PAUSED'
                        ? 'bg-caution-wash border-caution-line text-caution'
                        : scribeState === 'PROCESSING'
                        ? 'bg-accent-wash border-accent-line text-accent-ink'
                        : scribeState === 'OFFLINE'
                        ? 'bg-paper-2 border-rule text-ink-2'
                        : scribeState === 'ERROR'
                        ? 'bg-critical-wash border-critical-line text-critical'
                        : 'bg-canvas border-rule text-ink-2'
                    }`}
                    role="status"
                    aria-label={`Ambient Scribe Status: ${scribeState}`}
                  >
                    {scribeState === 'LISTENING' && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-settled-wash0 animate-pulse" />
                        <span>LISTENING ({formatSeconds(recordingSeconds)})</span>
                      </>
                    )}
                    {scribeState === 'PAUSED' && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-caution-wash0" />
                        <span>PAUSED ({formatSeconds(recordingSeconds)})</span>
                      </>
                    )}
                    {scribeState === 'PROCESSING' && (
                      <>
                        <Loader2 size={11} className="animate-spin text-accent-ink" />
                        <span>PROCESSING</span>
                      </>
                    )}
                    {scribeState === 'READY' && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-settled" />
                        <span>READY (⌥Space)</span>
                      </>
                    )}
                    {scribeState === 'OFFLINE' && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-ink-3" />
                        <span>OFFLINE</span>
                      </>
                    )}
                    {scribeState === 'ERROR' && (
                      <>
                        <span className="w-2 h-2 rounded-full bg-critical-wash0" />
                        <span>ERROR</span>
                      </>
                    )}
                  </div>
                );
              })()}

              <button
                onClick={testSampleAudioDialogue}
                className="text-[11px] text-ink-2 hover:text-ink px-2 py-1 hover:bg-paper-2 rounded-md transition-colors cursor-pointer"
                title="Load sample dialogue"
              >
                Sample Dialogue
              </button>

              {isRecording && (
                <button
                  onClick={togglePauseRecording}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-rule dark:border-rule-strong hover:bg-paper-2 dark:hover:bg-solid transition-colors cursor-pointer"
                  title={isPaused ? "Resume recording" : "Pause recording"}
                >
                  {isPaused ? (
                    <>
                      <Play size={11} className="fill-settled text-settled" />
                      <span className="text-settled dark:text-settled-on-solid font-semibold">Resume</span>
                    </>
                  ) : (
                    <>
                      <Pause size={11} className="fill-caution text-caution" />
                      <span className="text-caution dark:text-caution-on-solid font-semibold">Pause</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={toggleRecording}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isRecording
                    ? isPaused
                      ? 'bg-caution text-white shadow-xs'
                      : 'bg-critical text-white animate-pulse shadow-xs'
                    : 'bg-solid hover:bg-solid text-white shadow-2xs'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square size={11} className="fill-white" />
                    <span>{isPaused ? `Paused (${formatSeconds(recordingSeconds)})` : `Stop (${formatSeconds(recordingSeconds)})`}</span>
                  </>
                ) : (
                  <>
                    <Mic size={12} className="text-settled-on-solid" />
                    <span>Capture Dialogue</span>
                  </>
                )}
              </button>
              {isTranscribing && (
                <span className="flex items-center gap-1 text-xs text-accent-ink">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Transcribing...</span>
                </span>
              )}
            </div>
          </div>

          {/* TAB 1: CONSULTATION NOTE & SCRIBE */}
          {activeTab === 'note' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* SAFETY INTERVENTION HARD STOP BANNER (Section 21) */}
              {hasContraindication && (
                <SafetyInterventionBanner
                  allergen={patient.contraindicationAlert?.allergen || patient.allergies[0] || 'Penicillin'}
                  offendingDrug={patient.contraindicationAlert?.offendingDrug || structuredPlan.medications.find(m => m.name.toLowerCase().includes('amox') || m.name.toLowerCase().includes('augmentin'))?.name || 'Amoxicillin-Clavulanate (Augmentin)'}
                  severity={patient.contraindicationAlert?.severity || 'Anaphylaxis (Hard Stop)'}
                  riskDescription={patient.contraindicationAlert?.risk || 'Cross-reactive beta-lactam hypersensitivity shock risk. Use non-beta-lactam alternative.'}
                  overrideDirective={overrideDirective}
                  onOverrideChange={setOverrideDirective}
                  onRemoveOffendingDrug={() => {
                    const filtered = structuredPlan.medications.filter(m => !m.name.toLowerCase().includes('amox') && !m.name.toLowerCase().includes('augmentin'));
                    setStructuredPlan({ ...structuredPlan, medications: filtered });
                    setPrescriptions(filtered.map(m => ({ id: m.id, name: m.name, dose: m.dose, freq: m.frequency, duration: m.duration, status: 'new' as const })));
                    setDeskShortcutFeedback('Contraindicated medication removed');
                    setTimeout(() => setDeskShortcutFeedback(null), 2000);
                  }}
                />
              )}

              {/* OFFLINE / DEGRADED MODE ALERT BANNER (Section 30 & 31) */}
              {patient.scenarioKey === 'scenario-f' && (
                <div className="p-3.5 rounded-2xl bg-caution-wash border border-caution-line text-caution text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={15} className="text-caution shrink-0" />
                    <span>
                      <strong>Degraded Mode Active:</strong> Primary AI reasoning service unavailable. Manual clinician documentation enabled without interruption.
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-caution bg-caution-wash px-2 py-0.5 rounded-full">
                    MANUAL OVERRIDE
                  </span>
                </div>
              )}

              {/* Collapsible Transcript Drawer (Section 12) */}
              <div className="rounded-2xl border border-rule bg-paper p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic size={13} className="text-accent-ink" />
                    <span className="text-xs font-bold text-ink-2">
                      Ambient Dialogue & Transcription
                    </span>
                    {triageLabel && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-wash border border-accent-line text-accent-ink text-[10px] font-semibold">
                        <Tag size={10} className="text-accent-ink0" />
                        <span>{triageLabel}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsTranscriptCollapsed(!isTranscriptCollapsed)}
                      className="text-xs font-semibold text-ink-2 hover:text-ink px-2 py-1 rounded hover:bg-paper-2 transition-colors cursor-pointer"
                    >
                      {isTranscriptCollapsed ? 'Show Full Transcript (⌘T)' : 'Collapse (⌘T)'}
                    </button>
                    {streamProgress.isStreaming && (
                      <span className="text-[11px] text-accent-ink animate-pulse font-medium">
                        {streamProgress.message || 'Synthesizing...'}
                      </span>
                    )}
                    <button
                      onClick={() => generateNoteFromTranscript()}
                      disabled={isGeneratingNote}
                      className="flex items-center gap-1 text-xs text-ink hover:text-accent-ink font-medium px-2 py-1 rounded-md hover:bg-paper-2 transition-colors cursor-pointer"
                    >
                      <RefreshCw size={11} className={isGeneratingNote ? 'animate-spin' : ''} />
                      <span>{isGeneratingNote ? 'Synthesizing...' : 'Regenerate Note'}</span>
                    </button>
                  </div>
                </div>
                {!isTranscriptCollapsed ? (
                  <p className="text-xs text-ink-2 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap font-mono bg-canvas p-3 rounded-xl border border-rule/60">
                    {transcript}
                  </p>
                ) : (
                  <p className="text-[11px] text-ink-2 truncate font-mono bg-canvas px-3 py-1.5 rounded-lg border border-rule/60">
                    {transcript.slice(0, 140)}...
                  </p>
                )}
              </div>

              {/* Structured Note with Dynamic Clinical Template */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders size={13} className="text-ink-2" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-2">
                      Clinical Note Format:
                    </h3>
                    <select
                      value={selectedTemplate}
                      onChange={e => {
                        const t = e.target.value;
                        setSelectedTemplate(t);
                        void generateNoteFromTranscript(undefined, t);
                      }}
                      className="text-xs font-semibold bg-paper border border-rule rounded-lg px-2.5 py-1 text-ink outline-none cursor-pointer hover:border-rule-strong shadow-2xs"
                    >
                      {availableTemplates.length > 0 ? (
                        availableTemplates.map(tmpl => (
                          <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                        ))
                      ) : (
                        <>
                          <option value="SOAP">SOAP Note (Standard)</option>
                          <option value="GENERAL">Comprehensive Consultation</option>
                          <option value="HANDOVER">Emergency / Shift Handover (SBAR)</option>
                          <option value="PSYCH">Psychiatric Evaluation (MSE)</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    {copySuccess && (
                      <span className="text-xs text-settled font-medium animate-in fade-in">
                        {copySuccess}
                      </span>
                    )}
                    <button
                      onClick={copyNoteForEhr}
                      className="flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink px-2.5 py-1 rounded-lg border border-rule bg-paper hover:bg-paper-2 transition-colors cursor-pointer"
                    >
                      <Copy size={12} />
                      <span>Copy for EHR</span>
                    </button>
                  </div>
                </div>

                {/* S - Subjective */}
                <div className="rounded-2xl border border-rule bg-paper p-4 focus-within:border-solid transition-colors shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-solid text-white font-bold text-[10px] flex items-center justify-center font-mono">S</span>
                      <span className="text-xs font-bold text-ink">Subjective</span>
                    </div>
                    <span className="text-[10px] text-ink-2 font-medium">Patient Reported</span>
                  </div>
                  <textarea
                    rows={3}
                    value={note.subjective}
                    onChange={e => setNote({ ...note, subjective: e.target.value })}
                    className="w-full bg-transparent text-xs text-ink leading-relaxed resize-y outline-none"
                    placeholder="Patient narrative, symptoms, timeline..."
                  />
                </div>

                {/* O - Objective */}
                <div className="rounded-2xl border border-rule bg-paper p-4 focus-within:border-solid transition-colors shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-solid text-white font-bold text-[10px] flex items-center justify-center font-mono">O</span>
                      <span className="text-xs font-bold text-ink">Objective</span>
                    </div>
                    <span className="text-[10px] text-ink-2 font-medium">Vitals & Labs</span>
                  </div>
                  <textarea
                    rows={3}
                    value={note.objective}
                    onChange={e => setNote({ ...note, objective: e.target.value })}
                    className="w-full bg-transparent text-xs text-ink leading-relaxed resize-y outline-none"
                    placeholder="Physical examination findings, vitals, labs..."
                  />
                </div>

                {/* A - Assessment */}
                <div className="rounded-2xl border border-rule bg-paper p-4 focus-within:border-solid transition-colors shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-solid text-white font-bold text-[10px] flex items-center justify-center font-mono">A</span>
                      <span className="text-xs font-bold text-ink">Assessment</span>
                    </div>
                    <span className="text-[10px] text-caution bg-caution-wash px-2 py-0.5 rounded-full font-medium">AI Advisory</span>
                  </div>
                  <textarea
                    rows={3}
                    value={note.assessment}
                    onChange={e => setNote({ ...note, assessment: e.target.value })}
                    className="w-full bg-transparent text-xs text-ink leading-relaxed resize-y outline-none"
                    placeholder="Clinical impression and differential diagnoses..."
                  />
                </div>

                {/* P - Plan */}
                <div className="rounded-2xl border border-rule bg-paper p-4 focus-within:border-solid transition-colors shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-solid text-white font-bold text-[10px] flex items-center justify-center font-mono">P</span>
                      <span className="text-xs font-bold text-ink">Plan</span>
                    </div>
                    <span className="text-[10px] text-settled font-medium">Clinician Orders</span>
                  </div>
                  <textarea
                    rows={4}
                    value={note.plan}
                    onChange={e => setNote({ ...note, plan: e.target.value })}
                    className="w-full bg-transparent text-xs text-ink leading-relaxed resize-y outline-none"
                    placeholder="Pharmacology, diagnostic orders, patient counseling..."
                  />
                </div>

                {/* Physician Pilot Feedback Bar (Berta AI Quality Feedback) */}
                <div className="rounded-xl border border-rule dark:border-rule-strong bg-paper-2/90 dark:bg-solid/60 p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-center gap-2 text-ink-2 dark:text-ink-3">
                    <span className="font-semibold text-ink dark:text-on-solid">AI Note Quality:</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleFeedback(star, 'minor_edit')}
                          className={`px-1 text-sm transition-colors cursor-pointer ${
                            feedbackRating !== null && feedbackRating >= star
                              ? 'text-caution-on-solid0 font-bold'
                              : 'text-ink-3 dark:text-ink-2 hover:text-caution-on-solid'
                          }`}
                          title={`Rate ${star} star`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleFeedback(5, 'accepted_unchanged')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-settled-wash dark:bg-solid/40 hover:bg-settled-wash border border-settled-line dark:border-settled text-settled dark:text-settled-on-solid font-medium transition-colors cursor-pointer"
                    >
                      <ThumbsUp size={12} />
                      <span>Accurate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(2, 'major_edit')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-critical-wash dark:bg-solid/40 hover:bg-critical-wash border border-critical-line dark:border-critical text-critical dark:text-critical-on-solid font-medium transition-colors cursor-pointer"
                    >
                      <ThumbsDown size={12} />
                      <span>Needs Revision</span>
                    </button>
                    {feedbackSubmitted && (
                      <span className="text-settled dark:text-settled-on-solid text-xs font-semibold flex items-center gap-1 animate-in fade-in">
                        <CheckCheck size={13} />
                        <span>Logged to Audit</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PATIENT CHART & REPORTS */}
          {activeTab === 'chart' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {patient.recentLabs.some(l => l.status === 'high') && (
                <div className="rounded-2xl border border-critical-line bg-critical-wash p-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="text-critical shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-critical">Clinical Escalation Flagged</h4>
                      <p className="text-xs text-critical mt-1 leading-relaxed">
                        Abnormal metabolic or cardiac findings require physician attention for therapy adjustment.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Diagnostic Labs Table */}
              <div className="rounded-2xl border border-rule bg-paper p-5 shadow-xs">
                <h3 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-3">
                  Recent Laboratory Observations
                </h3>
                <div className="divide-y divide-rule">
                  {patient.recentLabs.map((lab, i) => (
                    <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-ink">{lab.name}</span>
                        <span className="text-[11px] text-ink-2 ml-2">({lab.date})</span>
                        {lab.note && <span className="text-[11px] text-ink-2 ml-2 italic">— {lab.note}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold ${
                          lab.status === 'high' ? 'text-critical' : lab.status === 'low' ? 'text-caution' : 'text-settled'
                        }`}>
                          {lab.value}
                        </span>
                        {lab.status === 'high' && (
                          <span className="bg-critical-wash text-critical text-[10px] px-2 py-0.5 rounded font-bold border border-critical-line">ABNORMAL</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diagnostic Reports & Documents */}
              <div className="rounded-2xl border border-rule bg-paper p-5 shadow-xs">
                <h3 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-3">
                  Extracted Clinical Documents & Imaging
                </h3>
                <div className="space-y-3">
                  {patient.documents.map((doc, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-rule bg-canvas flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <FileText size={17} className="text-accent-ink shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-semibold text-ink">{doc.name}</span>
                          <span className="text-[11px] text-ink-2 ml-2">({doc.date})</span>
                          <p className="text-xs text-ink-2 mt-1 leading-relaxed">{doc.summary}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Conditions */}
              <div className="rounded-2xl border border-rule bg-paper p-5 shadow-xs">
                <h3 className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-3">
                  Active Diagnoses & Conditions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {patient.conditions.map((c, i) => (
                    <span key={i} className="bg-paper-2 border border-rule text-ink text-xs px-3 py-1 rounded-lg font-medium">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STRUCTURED TREATMENT PLAN & ORDERS (Sections 20 & 23) */}
          {activeTab === 'orders' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* SAFETY INTERVENTION HARD STOP BANNER IF ALLERGY CONFLICT */}
              {hasContraindication && (
                <SafetyInterventionBanner
                  allergen={patient.contraindicationAlert?.allergen || patient.allergies[0] || 'Penicillin'}
                  offendingDrug={patient.contraindicationAlert?.offendingDrug || structuredPlan.medications.find(m => m.name.toLowerCase().includes('amox') || m.name.toLowerCase().includes('augmentin'))?.name || 'Amoxicillin-Clavulanate'}
                  severity={patient.contraindicationAlert?.severity || 'Anaphylaxis (Hard Stop)'}
                  riskDescription={patient.contraindicationAlert?.risk || 'Cross-reactive beta-lactam hypersensitivity shock risk. Use non-beta-lactam alternative.'}
                  overrideDirective={overrideDirective}
                  onOverrideChange={setOverrideDirective}
                  onRemoveOffendingDrug={() => {
                    const filtered = structuredPlan.medications.filter(m => !m.name.toLowerCase().includes('amox') && !m.name.toLowerCase().includes('augmentin'));
                    setStructuredPlan({ ...structuredPlan, medications: filtered });
                    setPrescriptions(filtered.map(m => ({ id: m.id, name: m.name, dose: m.dose, freq: m.frequency, duration: m.duration, status: 'new' as const })));
                    setDeskShortcutFeedback('Contraindicated medication removed');
                    setTimeout(() => setDeskShortcutFeedback(null), 2000);
                  }}
                />
              )}

              <StructuredTreatmentPlan
                plan={structuredPlan}
                onChange={(updated) => {
                  setStructuredPlan(updated);
                  setPrescriptions(updated.medications.map(m => ({
                    id: m.id,
                    name: m.name,
                    dose: m.dose,
                    freq: m.frequency,
                    duration: m.duration,
                    status: m.status === 'approved' ? 'active' : 'new'
                  })));
                }}
                onProvenanceInvalidated={() => {
                  setDeskShortcutFeedback('Draft updated (Requires New Provenance)');
                  setTimeout(() => setDeskShortcutFeedback(null), 2000);
                }}
              />
            </div>
          )}

          {/* TAB 4: NURSE ROOMING & PATIENT INTAKE */}
          {activeTab === 'intake' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="bg-solid border-b border-rule-strong px-6 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIntakeSubTab('rooming')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      intakeSubTab === 'rooming'
                        ? 'bg-settled text-white'
                        : 'text-ink-3 hover:text-on-solid hover:bg-solid'
                    }`}
                  >
                    Nurse Rooming & Vitals (MA/RN)
                  </button>
                  <button
                    onClick={() => setIntakeSubTab('questionnaire')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      intakeSubTab === 'questionnaire'
                        ? 'bg-settled text-white'
                        : 'text-ink-3 hover:text-on-solid hover:bg-solid'
                    }`}
                  >
                    FHIR Digital Questionnaire
                  </button>
                </div>
                <span className="text-[11px] text-ink-3 font-mono">
                  Rooming Handoff Protocol &bull; Standardized Protocol
                </span>
              </div>

              {intakeSubTab === 'rooming' ? (
                <NurseRoomingWorkspace
                  patient={patient}
                  onInsertNoteSnippet={(snippet) => {
                    setNote(prev => ({
                      ...prev,
                      subjective: prev.subjective ? `${snippet}\n\n${prev.subjective}` : snippet
                    }));
                    setDeskShortcutFeedback('Rooming summary inserted into Subjective note');
                    setTimeout(() => setDeskShortcutFeedback(null), 3500);
                  }}
                />
              ) : (
                <IntakeReview
                  patientId={patient.id}
                  onLaunchNewIntake={() => setShowIntakeModal(true)}
                />
              )}
            </div>
          )}

          {/* TAB 5: BILLING & REVENUE INTEGRITY (4.0X ROI) */}
          {activeTab === 'billing' && (
            <div className="flex-1 overflow-y-auto p-6 bg-solid">
              <BillingCodingAdvisor
                note={note}
                patient={patient}
                prescriptions={prescriptions}
              />
            </div>
          )}

          {/* TAB 6: EVIDENCE GROUNDING & PUBMED RAG */}
          {activeTab === 'evidence' && (
            <div className="flex-1 overflow-y-auto p-6 bg-solid">
              <EvidenceGroundingPanel
                conditions={patient.conditions}
                medications={patient.medications}
                activeQuery={patient.chiefComplaint}
                onInsertIntoPlan={(citationText) => {
                  setNote(prev => ({
                    ...prev,
                    plan: `${prev.plan}${citationText}`
                  }));
                  setDeskShortcutFeedback('Citation inserted into Treatment Plan');
                  setTimeout(() => setDeskShortcutFeedback(null), 2500);
                }}
              />
            </div>
          )}
        </section>

        {/* RIGHT PANEL: CLINICAL PERSPECTIVES & COPILOT SIDEBAR (35%) */}
        <aside className="w-[430px] shrink-0 flex flex-col bg-paper border-l border-rule/80">
          {/* PERSPECTIVES vs CHAT MODE TOGGLE (Section 15 & 18) */}
          <div className="h-12 border-b border-rule/80 bg-paper px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1 bg-paper-2 p-0.5 rounded-lg border border-rule">
              <button
                type="button"
                onClick={() => setRightPanelMode('68md')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  rightPanelMode === '68md'
                    ? 'bg-paper text-ink shadow-2xs'
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                68-MD Board
              </button>
              <button
                type="button"
                onClick={() => setRightPanelMode('perspectives')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  rightPanelMode === 'perspectives'
                    ? 'bg-paper text-ink shadow-2xs'
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                Specialist Perspectives
              </button>
              <button
                type="button"
                onClick={() => setRightPanelMode('copilot')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  rightPanelMode === 'copilot'
                    ? 'bg-paper text-ink shadow-2xs'
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                Copilot Chat
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-settled-wash border border-settled-line px-2 py-0.5 rounded-full text-[10px] text-settled font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-settled-wash0 animate-pulse" />
              68 Specialists Active
            </div>
          </div>

          {rightPanelMode === '68md' ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-paper-2">
              <MDSpecialistBoardPanel
                patientId={patient.id || 'PAT-007'}
                onSignedSuccess={(_summary) => {
                  setDeskShortcutFeedback('Encounter Signed by Attending Physician');
                  setTimeout(() => setDeskShortcutFeedback(null), 3000);
                }}
              />
            </div>
          ) : rightPanelMode === 'perspectives' ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <ClinicalPerspectivesPanel
                patient={patient}
                transcript={transcript}
                onInsertIntoAssessment={(text) => {
                  setNote(prev => ({
                    ...prev,
                    assessment: `${prev.assessment}\n• ${text}`
                  }));
                  setDeskShortcutFeedback('Inserted into Assessment');
                  setTimeout(() => setDeskShortcutFeedback(null), 2000);
                }}
                onInsertIntoPlan={(text) => {
                  insertIntoPlan(text);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
              {/* COPILOT PROMPT CHIPS */}
              <div className="p-3 border-b border-rule/80 bg-paper-2/60 space-y-1.5">
                <div className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">Quick Clinical Prompts:</div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSendChat("Are there any drug-drug interactions between current medications and new orders?")}
                    className="text-xs bg-paper hover:bg-paper-2 text-ink-2 font-medium px-2.5 py-1 rounded-lg border border-rule/80 shadow-2xs transition-colors cursor-pointer"
                  >
                    💊 Drug Interactions
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendChat(`Summarize ${patient.name}'s metabolic and organ function trends.`)}
                    className="text-xs bg-paper hover:bg-paper-2 text-ink-2 font-medium px-2.5 py-1 rounded-lg border border-rule/80 shadow-2xs transition-colors cursor-pointer"
                  >
                    📈 Lab Trends
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendChat(`Draft personalized patient discharge instructions for ${patient.name}.`)}
                    className="text-xs bg-paper hover:bg-paper-2 text-ink-2 font-medium px-2.5 py-1 rounded-lg border border-rule/80 shadow-2xs transition-colors cursor-pointer"
                  >
                    📝 Patient Instructions
                  </button>
                </div>
              </div>

              {/* CHAT MESSAGES SCROLLER */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-paper-2">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[10px] text-ink-2 mb-1 font-mono font-medium">
                      {msg.role === 'user' ? 'You' : 'Clinical Copilot'}
                    </span>
                    <div
                      className={`text-xs leading-relaxed rounded-2xl p-3.5 max-w-[95%] whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-solid text-white shadow-xs'
                          : 'bg-paper text-ink border border-rule shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
                      }`}
                    >
                      {msg.content}
                    </div>

                    {msg.role === 'assistant' && idx > 0 && (
                      <div className="flex items-center gap-2 mt-1.5 ml-1">
                        <button
                          type="button"
                          onClick={() => insertIntoPlan(msg.content)}
                          className="flex items-center gap-1 text-[11px] text-accent-ink hover:text-accent-ink font-semibold cursor-pointer"
                        >
                          <Plus size={11} />
                          Insert into Plan
                        </button>
                        <span className="text-ink-3">•</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            setCopySuccess('Copied to clipboard');
                            setTimeout(() => setCopySuccess(null), 2000);
                          }}
                          className="flex items-center gap-1 text-[11px] text-ink-2 hover:text-ink cursor-pointer"
                        >
                          <Copy size={11} />
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {isChatSending && (
                  <div className="flex items-center gap-2 text-xs text-ink-2 pl-1 font-medium">
                    <Loader2 size={13} className="animate-spin text-accent-ink" />
                    Analyzing clinical chart context...
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* CHAT INPUT FORM */}
              <div className="p-3 border-t border-rule bg-paper">
                <form onSubmit={e => { e.preventDefault(); void handleSendChat(); }} className="relative flex items-end bg-paper-2 rounded-2xl p-2 border border-rule focus-within:border-rule-strong transition-colors">
                  <textarea
                    rows={2}
                    placeholder={`Ask Copilot about ${patient.name}...`}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent px-2.5 py-1 text-xs text-ink placeholder-ink-3 outline-none resize-none"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatSending}
                    className="w-8 h-8 rounded-xl bg-solid hover:bg-solid disabled:opacity-30 text-white flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-2xs"
                    title="Send message"
                  >
                    <ArrowUp size={15} />
                  </button>
                </form>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* PRESCRIPTION PDF MODAL */}
      <PrescriptionPDFModal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        patient={fhirPatient}
        doctorName="Dr. Physician, Attending Internist"
        medications={formattedPdfMeds}
      />

      {/* CLINICIAN CONFIRMATION & FHIR R4 EHR SYNCHRONIZATION MODAL */}
      {isCloseModalOpen && (
        <EncounterEhrSyncModal
          patient={patient}
          note={note}
          prescriptions={prescriptions}
          onClose={() => setIsCloseModalOpen(false)}
          onCommitSuccess={(encounterData) => {
            onCloseMeeting(encounterData);
          }}
        />
      )}

      {/* PHYSICIAN REVIEW & CRYPTOGRAPHIC PROVENANCE SIGN-OFF MODAL (Section 22 & 23) */}
      <PhysicianSignOffModal
        isOpen={isSignOffModalOpen}
        onClose={() => setIsSignOffModalOpen(false)}
        patient={patient}
        note={note}
        plan={structuredPlan}
        hasContraindication={hasContraindication}
        overrideDirective={overrideDirective}
        encounterDurationSeconds={Math.round((Date.now() - encounterStartTimeRef.current) / 1000)}
        onSignOffSuccess={(summary) => {
          setCompletedSummaryData(summary);
          setEncounterPhase('completed');
          onCloseMeeting({
            patientId: patient.id,
            note,
            prescriptions: structuredPlan.medications.map(m => `${m.name} ${m.dose} - ${m.frequency}`)
          });
        }}
      />

      {/* DYNAMIC PATIENT INTAKE MODAL */}
      {showIntakeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-paper-2 border border-rule rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowIntakeModal(false)}
              className="absolute top-4 right-4 z-10 p-2 text-ink-2 hover:text-ink hover:bg-paper-2 rounded-full transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <DynamicIntake
                patientId={patient.id}
                onComplete={(result) => {
                  try {
                    localStorage.setItem(`proton_intake_response_${patient.id}`, JSON.stringify(result.questionnaireResponse));
                  } catch {}
                  setShowIntakeModal(false);
                }}
                onCancel={() => setShowIntakeModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* MOBILE CAPTURE SESSION MODAL (M2B-1) */}
      {showCaptureModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <CaptureSessionPanel
            patientId={patient.id}
            encounterId="enc-active"
            onClose={() => setShowCaptureModal(false)}
            onMediaCaptured={(media) => {
              setCapturedMediaList(media);
              if (media && media.length > 0) {
                setActiveVisionMediaId(media[0].id);
              }
            }}
          />
        </div>
      )}

      {/* CLINICIAN VISION REVIEW MODAL (M2C-2) */}
      {showVisionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <ClinicianVisionReview
            mediaId={activeVisionMediaId || (capturedMediaList[0]?.id) || 'med-sample-capture'}
            patientId={patient.id}
            encounterId="enc-active"
            onClose={() => setShowVisionModal(false)}
            onConditionConfirmed={(conditionText) => {
              setNote(prev => ({
                ...prev,
                assessment: `${prev.assessment}\n• Confirmed Visual Finding: ${conditionText}`
              }));
            }}
          />
        </div>
      )}

      {/* PATIENT VOICE OUTREACH MODAL (HIPPOCRATIC AI COMPETITOR) */}
      {showVoiceOutreachModal && (
        <PatientVoiceOutreachModal
          patient={patient}
          onClose={() => setShowVoiceOutreachModal(false)}
        />
      )}

      {/* PATIENT AFTER-CARE DISCHARGE SUMMARY MODAL (EPIC / ABRIDGE PARITY) */}
      {showAvsModal && (
        <AfterVisitSummaryModal
          patient={patient}
          note={note}
          prescriptions={prescriptions}
          onClose={() => setShowAvsModal(false)}
        />
      )}

      {/* AUTONOMOUS MEDICATION SUGGESTION AGENT (OPEN TARGETS GENTROPY + JEV HARNESS) */}
      {showMedSuggestionModal && (
        <MedicationSuggestionModal
          patient={patient}
          currentDiagnosis={patient.conditions[0] || 'Type 2 Diabetes Mellitus'}
          onClose={() => setShowMedSuggestionModal(false)}
          onAdoptMedication={(newRx) => {
            setPrescriptions(prev => [
              ...prev,
              {
                id: `rx-${Date.now()}`,
                name: newRx.name,
                dose: newRx.dose,
                freq: newRx.freq,
                duration: newRx.duration,
                status: 'new' as const
              }
            ]);
            setShowMedSuggestionModal(false);
          }}
        />
      )}
    </div>
  );
}
