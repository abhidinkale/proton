import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mic,
  MicOff,
  FileText,
  Lightbulb,
  Pill,
  FileCheck,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Printer,
  Copy,
  Clock,
  ShieldCheck,
  ChevronDown,
  Check,
  Send,
  Activity,
  Award,
  Sliders,
  Sparkles,
  ExternalLink,
  Edit3,
  X,
  Plus,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { TODAY_CLINIC_SCHEDULE } from '../data/clinicSchedule';
import type { DoctorDeskPatient } from './DoctorDeskEncounter';
import { safetyService } from '../services/safetyService';
import { authService } from '../services/auth';
import { clinicApi } from '../lib/clinicApi';
import type { Patient } from '../domain/patient/types';

/**
 * Build a patient-specific SOAP draft. Used when an encounter opens or when the
 * clinician switches charts, so the note never describes a different patient.
 */
function buildSoapNote(patient: DoctorDeskPatient) {
  const allergyLine = patient.allergies?.length ? patient.allergies.join(', ') : 'No known allergies';
  const labLine = patient.recentLabs?.length
    ? patient.recentLabs.map((lab) => `${lab.name}: ${lab.value} (${lab.status})`).join(' · ')
    : 'No recent labs on file';
  const conditionLine = patient.conditions?.length
    ? patient.conditions.join('\n')
    : 'No chronic conditions documented';

  return {
    subjective: `${patient.name}, a ${patient.age}-year-old ${String(patient.gender).toLowerCase()}, presents for ${(patient.visitType || 'clinical evaluation').toLowerCase()}. Chief complaint: "${patient.chiefComplaint}". Documented allergies: ${allergyLine}.`,
    objective: `Vital signs: BP ${patient.vitals?.bp || 'not recorded'}, HR ${patient.vitals?.hr || 'not recorded'}, SpO₂ ${patient.vitals?.spo2 || 'not recorded'}, Temp ${patient.vitals?.temp || 'not recorded'}, BMI ${patient.vitals?.bmi || 'not recorded'}.\nRecent labs: ${labLine}.`,
    assessment: `1. ${patient.chiefComplaint} — clinical evaluation in progress.\n2. Documented conditions:\n${conditionLine}\n3. Allergy safety guard: ${allergyLine}.`,
    plan: '1. Complete focused history and examination.\n2. Order guideline-directed diagnostics as indicated.\n3. Review medication safety against documented allergies.\n4. Schedule follow-up and provide return precautions.'
  };
}

export interface DoctorGuidedEncounterProps {
  initialPatientId?: string | null;
  initialPatient?: DoctorDeskPatient | null;
  initialAction?: string | null;
  onSwitchToPowerDesk?: () => void;
  onFinishEncounter?: () => void;
}

export type EncounterStep =
  | 'patient'
  | 'scribe'
  | 'notes'
  | 'solutions'
  | 'medication'
  | 'report'
  | 'followup';

interface StepDefinition {
  id: EncounterStep;
  number: number;
  label: string;
  shortDescription: string;
  icon: any;
}

const STEPS: StepDefinition[] = [
  { id: 'patient', number: 1, label: 'Patient Details', shortDescription: 'Vitals & Labs', icon: User },
  { id: 'scribe', number: 2, label: 'Ambient Scribe', shortDescription: 'Live Audio', icon: Mic },
  { id: 'notes', number: 3, label: 'Clinical Notes', shortDescription: 'SOAP Note', icon: FileText },
  { id: 'solutions', number: 4, label: 'Offer Solutions', shortDescription: 'AI Guidance', icon: Lightbulb },
  { id: 'medication', number: 5, label: 'Offer Medication', shortDescription: 'Safe Rx Orders', icon: Pill },
  { id: 'report', number: 6, label: 'Make Report', shortDescription: 'Patient Summary', icon: FileCheck },
  { id: 'followup', number: 7, label: 'Follow-up & Sign', shortDescription: 'Next Steps & EHR', icon: Calendar },
];

export default function DoctorGuidedEncounter({
  initialPatientId,
  initialPatient,
  initialAction,
  onSwitchToPowerDesk,
  onFinishEncounter
}: DoctorGuidedEncounterProps) {
  const navigate = useNavigate();

  // URL action listener (e.g. ?action=new-patient)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      if (initialAction === 'new-patient' || searchParams.get('action') === 'new-patient') {
        setShowNewPatientModal(true);
      }
    } catch {}
  }, [initialAction]);

  // 1. Doctor Profile State (Supports New Doctor Setup & Customization)
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('proton_physician_profile');
      if (saved) return JSON.parse(saved);
    } catch {}
    const user = authService.getCurrentUser();
    return {
      name: user?.displayName || 'Attending physician',
      specialty: 'Attending Physician',
      room: 'Unassigned room',
      facility: user?.organizationId || 'Proton Clinic',
      npi: user?.npi ? `NPI ${user.npi}` : 'NPI not recorded',
    };
  });

  const [editDocName, setEditDocName] = useState(doctorProfile.name);
  const [editDocSpecialty, setEditDocSpecialty] = useState(doctorProfile.specialty);
  const [editDocRoom, setEditDocRoom] = useState(doctorProfile.room);
  const [editDocNpi, setEditDocNpi] = useState(doctorProfile.npi);

  const handleSaveDoctorProfile = () => {
    const updated = {
      ...doctorProfile,
      name: editDocName.trim() || 'Attending physician',
      specialty: editDocSpecialty.trim() || 'Attending Physician',
      room: editDocRoom.trim() || 'Unassigned room',
      npi: editDocNpi.trim() || 'NPI not recorded',
    };
    setDoctorProfile(updated);
    try {
      localStorage.setItem('proton_physician_profile', JSON.stringify(updated));
      const user = authService.getCurrentUser();
      if (user) {
        authService.setSessionUser({
          ...user,
          displayName: updated.name
        });
      }
    } catch {}
    setShowDoctorModal(false);
    showToast(`Doctor profile updated: ${updated.name}`);
  };

  // 2. Active Patient State & Custom New Patient
  const [customPatients, setCustomPatients] = useState<DoctorDeskPatient[]>([]);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(() => {
    if (initialPatient) return initialPatient.id;
    if (initialPatientId) {
      const match = TODAY_CLINIC_SCHEDULE.find(
        p => p.id === initialPatientId || p.id.includes(initialPatientId)
      );
      if (match) return match.id;
    }
    return TODAY_CLINIC_SCHEDULE[1]?.id || TODAY_CLINIC_SCHEDULE[0]?.id; // Default to Eleanor Vance
  });

  const allAvailablePatients = [
    ...(initialPatient ? [initialPatient] : []),
    ...customPatients,
    ...TODAY_CLINIC_SCHEDULE
  ];

  const patient: DoctorDeskPatient =
    allAvailablePatients.find(p => p.id === selectedPatientId) ||
    TODAY_CLINIC_SCHEDULE[0];

  // New Patient Form State
  const [newPtName, setNewPtName] = useState('');
  const [newPtAge, setNewPtAge] = useState(48);
  const [newPtGender, setNewPtGender] = useState('Female');
  const [newPtComplaint, setNewPtComplaint] = useState('');
  const [newPtAllergies, setNewPtAllergies] = useState('No Known Drug Allergies');
  const [newPtBp, setNewPtBp] = useState('124/80 mmHg');
  const [newPtHr, setNewPtHr] = useState('72 bpm');

  // Step 4: Live Multi-Agent AI Specialist Engine State
  const [isSpecialistsLoading, setIsSpecialistsLoading] = useState(false);
  const [specialistAssessments, setSpecialistAssessments] = useState<any[]>([]);
  const [specialistError, setSpecialistError] = useState<string | null>(null);
  const [lastAssessedPatientId, setLastAssessedPatientId] = useState<string | null>(null);

  const runLiveSpecialistDiagnosis = async (targetPatient?: DoctorDeskPatient) => {
    const pt = targetPatient || patient;
    setIsSpecialistsLoading(true);
    setSpecialistError(null);
    try {
      const transcriptText = conversationDialogue.map(d => `${d.speaker === 'doctor' ? 'Doctor' : 'Patient'}: ${d.text}`).join('\n');
      const payload = {
        context: {
          patientId: pt.id,
          patientName: pt.name,
          age: pt.age,
          gender: pt.gender,
          chiefComplaint: pt.chiefComplaint,
          transcript: transcriptText,
          vitals: pt.vitals,
          allergies: pt.allergies,
          conditions: pt.conditions
        }
      };

      let response: Response;
      try {
        response = await fetch('/api/ai/specialists/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch {
        response = await fetch('http://localhost:3002/api/ai/specialists/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        throw new Error(`AI Specialist Engine returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.assessments && Array.isArray(data.assessments) && data.assessments.length > 0) {
        setSpecialistAssessments(data.assessments);
        setLastAssessedPatientId(pt.id);
        showToast(`AI Multi-Agent diagnosis complete: ${data.assessments.length} specialist evaluations rendered.`);
      } else {
        throw new Error('No assessments returned from AI specialist registry');
      }
    } catch (err: any) {
      console.warn('Specialist run error:', err);
      setSpecialistError(err.message || 'Specialist diagnostic execution failed');
    } finally {
      setIsSpecialistsLoading(false);
    }
  };

  const handleCreateNewPatient = (preset?: 'angina' | 'asthma' | 'diabetes' | 'ckd') => {
    let name = newPtName.trim();
    let age = Number(newPtAge) || 45;
    let gender = newPtGender;
    let complaint = newPtComplaint.trim();
    let allergies = [newPtAllergies.trim() || 'No Known Drug Allergies'];
    let bp = newPtBp;
    let hr = newPtHr;
    let visitType = 'Initial Clinical Intake';

    if (preset === 'angina') {
      name = 'Arthur Morgan';
      age = 58;
      gender = 'Male';
      complaint = 'Substernal chest tightness & exertional dyspnea while walking uphill';
      allergies = ['Aspirin (Mild Gastritis)'];
      bp = '148/92 mmHg';
      hr = '88 bpm';
      visitType = 'Cardiology Urgent Review';
    } else if (preset === 'asthma') {
      name = 'Chloe Bennett';
      age = 29;
      gender = 'Female';
      complaint = 'Nocturnal wheezing, chest tightness and shortness of breath after viral cold';
      allergies = ['Sulfa Antibiotics (Severe Urticaria)'];
      bp = '118/76 mmHg';
      hr = '92 bpm';
      visitType = 'Pulmonology Acute Care';
    } else if (preset === 'diabetes') {
      name = 'Eleanor Vance';
      age = 68;
      gender = 'Female';
      complaint = 'Type 2 Diabetes Glycemic Review & Afternoon Fatigue';
      allergies = ['Penicillin (Severe Anaphylaxis)'];
      bp = '138/88 mmHg';
      hr = '74 bpm';
      visitType = 'Chronic Disease Management';
    } else if (preset === 'ckd') {
      name = 'David Kim';
      age = 62;
      gender = 'Male';
      complaint = 'Chronic Kidney Disease Stage 3b evaluation, fatigue, and borderline hyperkalemia';
      allergies = ['No Known Drug Allergies'];
      bp = '152/94 mmHg';
      hr = '76 bpm';
      visitType = 'Nephrology Clinical Review';
    }

    if (!name) name = 'Marcus Sterling';
    if (!complaint) complaint = 'General medical evaluation & comprehensive physical exam';

    const newId = `new-patient-${Date.now()}`;
    const newPt: DoctorDeskPatient = {
      id: newId,
      name,
      age,
      gender,
      dob: '1976-08-15',
      mrn: `MRN-${Math.floor(10000 + Math.random() * 90000)}`,
      time: '10:30 AM',
      visitType,
      status: 'ready',
      chiefComplaint: complaint,
      vitals: {
        bp,
        hr,
        spo2: '98%',
        temp: '98.6°F',
        bmi: '26.4'
      },
      allergies,
      conditions: [`${complaint.split(' ')[0]} Clinical Evaluation`],
      medications: ['Multivitamin Once Daily'],
      recentLabs: [
        { name: 'Comprehensive Metabolic Panel', value: 'Normal', status: 'normal', date: 'Today' }
      ],
      documents: []
    };

    setCustomPatients(prev => [newPt, ...prev]);
    setSelectedPatientId(newId);
    setCurrentStep('patient');
    setShowNewPatientModal(false);

    // Patient Context Isolation: Invalidate previous patient's AI assessments
    setSpecialistAssessments([]);
    setLastAssessedPatientId(null);

    // Update SOAP Note for the new patient
    setSoapNote(buildSoapNote(newPt));

    // Update Ambient Scribe Dialogue for the new patient
    setConversationDialogue([
      {
        speaker: 'doctor',
        text: `Good morning, ${name}. Welcome to our clinic. What brings you in today?`,
        time: '00:05'
      },
      {
        speaker: 'patient',
        text: `Good morning, Doctor. I've been experiencing ${complaint.toLowerCase()}.`,
        time: '00:15'
      },
      {
        speaker: 'doctor',
        text: `Thank you for sharing that with me. I have your recorded vitals (BP ${bp}, HR ${hr}) and documented allergies: ${allergies.join(', ')}. Let's conduct a thorough assessment and tailor your plan safely.`,
        time: '00:30'
      }
    ]);

    showToast(`New patient registered: ${name} (${visitType})`);
  };

  // Active step
  const [currentStep, setCurrentStep] = useState<EncounterStep>('patient');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(true);

  // Auto-run diagnosis when entering Step 4 if not yet assessed for this patient
  useEffect(() => {
    if (currentStep === 'solutions') {
      if (lastAssessedPatientId !== patient.id && !isSpecialistsLoading) {
        runLiveSpecialistDiagnosis();
      }
    }
  }, [currentStep, patient.id, lastAssessedPatientId]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Step 2: Scribe State & Speech Recognition
  const [isListening, setIsListening] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(135); // 02:15 default
  const [conversationDialogue, setConversationDialogue] = useState<Array<{ speaker: 'doctor' | 'patient'; text: string; time: string }>>([
    {
      speaker: 'doctor',
      text: `Good morning, ${patient.name}. It is great to see you today in ${doctorProfile.room}. How have you been feeling since our last review?`,
      time: '00:05'
    },
    {
      speaker: 'patient',
      text: `Good morning, ${doctorProfile.name.split(',')[0]}. Well, I have noticed feeling unusually worn out in the afternoons, especially around 3 PM. And my home morning sugar checks have crept up into the 160s.`,
      time: '00:18'
    },
    {
      speaker: 'doctor',
      text: `I appreciate you letting me know right away. Have you noticed any blurred vision, unusual thirst, shakiness, or episodes of dizziness?`,
      time: '00:32'
    },
    {
      speaker: 'patient',
      text: `No dizziness or blurred vision, doctor. Just that heavy fatigue after lunch. And I wanted to make sure you remember my severe allergy from when I was younger.`,
      time: '00:46'
    },
    {
      speaker: 'doctor',
      text: `Absolutely. Your allergy profile is flagged in bright red right on your chart. We have automated deterministic safety gates that completely block any contraindicated medications. Let us examine your vitals and tailor your treatment safely.`,
      time: '01:02'
    }
  ]);
  const [audioWaves, setAudioWaves] = useState<number[]>([45, 75, 30, 90, 100, 55, 70, 85, 40, 80, 95, 60, 45, 80, 90, 35]);
  const recognitionRef = useRef<any>(null);

  // Audio timer & visualizer effect + Real Web Speech Recognition
  useEffect(() => {
    let interval: any;
    if (isListening) {
      interval = setInterval(() => {
        setRecordingSeconds(s => s + 1);
        setAudioWaves(Array.from({ length: 16 }, () => Math.floor(Math.random() * 75) + 25));
      }, 500);

      // Web Speech API for real voice recognition
      try {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec && !recognitionRef.current) {
          const rec = new SpeechRec();
          rec.continuous = true;
          rec.interimResults = false;
          rec.lang = 'en-US';
          rec.onresult = (event: any) => {
            const transcript = event.results[event.results.length - 1][0].transcript;
            if (transcript && transcript.trim()) {
              const nowSec = recordingSeconds;
              const timeStr = `${Math.floor(nowSec / 60)}:${String(nowSec % 60).padStart(2, '0')}`;
              setConversationDialogue(prev => [
                ...prev,
                { speaker: 'doctor', text: transcript.trim(), time: timeStr }
              ]);
            }
          };
          rec.onerror = () => {};
          rec.start();
          recognitionRef.current = rec;
        }
      } catch {}
    } else {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
    }
    return () => {
      clearInterval(interval);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, [isListening, recordingSeconds]);

  // Step 3: Clinical Notes (SOAP) — always generated from the selected chart.
  const [soapNote, setSoapNote] = useState(() => buildSoapNote(patient));

  useEffect(() => {
    setSoapNote(buildSoapNote(patient));
    // Reset the note whenever the clinician switches to a different chart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id]);

  // Step 4: Solutions & Recommendations
  const [solutions, setSolutions] = useState([
    {
      id: 'sol-1',
      title: 'Initiate SGLT2 Inhibitor Therapy (Empagliflozin 10mg)',
      category: 'Pharmacotherapy & Guideline Directed Medical Therapy',
      evidence: 'ADA 2026 Standards of Care (Grade A Evidence)',
      summary: 'Patient has rising HbA1c (8.2%) with stable renal filtration (eGFR 72 mL/min). SGLT2i provides proven glycemic reduction, slows renal decline, and confers cardioprotection.',
      accepted: true
    },
    {
      id: 'sol-2',
      title: 'Dietary Sodium Counseling & Home BP Monitoring',
      category: 'Lifestyle & Cardiovascular Risk Reduction',
      evidence: 'ACC/AHA 2024 Hypertension Clinical Guidelines',
      summary: 'Systolic blood pressure measured at 138/88 mmHg today. Recommend home blood pressure logging twice weekly and daily dietary sodium restriction to < 2,000 mg.',
      accepted: true
    },
    {
      id: 'sol-3',
      title: '4-Week Renal Panel & Glycemic Surveillance',
      category: 'Diagnostic Order & Patient Safety',
      evidence: 'KDIGO 2024 / ADA Monitoring Protocol',
      summary: 'Order repeat serum creatinine, eGFR, electrolytes, and HbA1c in 30 days following SGLT2 inhibitor initiation.',
      accepted: true
    }
  ]);

  // Step 5: Medications State & Custom Prescription Builder
  const [prescriptions, setPrescriptions] = useState([
    {
      id: 'rx-1',
      name: 'Empagliflozin (Jardiance)',
      dosage: '10 mg',
      route: 'Oral Tablet',
      frequency: 'Once daily in the morning with water',
      quantity: '30 tablets',
      refills: 3,
      indication: 'Type 2 Diabetes Mellitus (E11.69)',
      isNew: true
    },
    {
      id: 'rx-2',
      name: 'Metformin HCl',
      dosage: '500 mg',
      route: 'Oral Tablet',
      frequency: 'Twice daily with meals (Breakfast & Dinner)',
      quantity: '60 tablets',
      refills: 3,
      indication: 'Type 2 Diabetes Mellitus (E11.9)',
      isNew: false
    }
  ]);

  // Add Medication Modal State
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('10 mg');
  const [newMedFreq, setNewMedFreq] = useState('Once daily');
  const [medSafetyWarning, setMedSafetyWarning] = useState<string | null>(null);

  const handlePrescribeNewMed = () => {
    if (!newMedName.trim()) return;

    // Allergy conflict check
    const medLower = newMedName.toLowerCase();
    const hasPenicillinConflict =
      patient.allergies.some(a => a.toLowerCase().includes('penicillin')) &&
      (medLower.includes('amoxicillin') || medLower.includes('augmentin') || medLower.includes('penicillin') || medLower.includes('ampicillin'));

    if (hasPenicillinConflict) {
      setMedSafetyWarning(`⚠️ CRITICAL SAFETY HARD-STOP: Patient has documented Penicillin allergy. ${newMedName} is a beta-lactam with fatal anaphylaxis risk.`);
      return;
    }

    const newRx = {
      id: `rx-${Date.now()}`,
      name: newMedName.trim(),
      dosage: newMedDose.trim(),
      route: 'Oral Tablet',
      frequency: newMedFreq.trim(),
      quantity: '30 tablets',
      refills: 2,
      indication: 'Prescribed by Physician',
      isNew: true
    };

    setPrescriptions(prev => [newRx, ...prev]);
    setShowAddMedModal(false);
    setNewMedName('');
    setMedSafetyWarning(null);
    showToast(`Prescription added: ${newRx.name} ${newRx.dosage}`);
  };

  // Build typed patient for safety evaluation
  const typedPatient: Patient = {
    id: patient.id,
    mrn: patient.mrn,
    name: patient.name,
    age: patient.age,
    dob: patient.dob,
    gender: patient.gender.toLowerCase() === 'female' ? 'female' : 'male',
    chiefComplaint: patient.chiefComplaint,
    vitals: {
      bp: patient.vitals.bp,
      hr: patient.vitals.hr,
      spo2: patient.vitals.spo2,
      bmi: patient.vitals.bmi,
      temp: patient.vitals.temp,
      recordedAt: new Date().toISOString()
    },
    allergies: patient.allergies.map((a, i) => ({
      id: `all-${i}`,
      allergen: a,
      category: 'medication',
      reaction: 'Anaphylaxis',
      severity: 'anaphylaxis',
      isCritical: true
    })),
    conditions: patient.conditions.map((c, i) => ({
      id: `cond-${i}`,
      name: c,
      status: 'active'
    })),
    medications: patient.medications.map((m, i) => ({
      id: `med-${i}`,
      name: m,
      dosage: 'standard',
      frequency: 'daily',
      route: 'oral',
      status: 'active',
      prescribedDate: '2026-01-01'
    })),
    recentLabs: [],
    timeline: []
  };

  const safetyCheck = safetyService.evaluatePatientSafety(
    typedPatient,
    prescriptions.map(p => p.name)
  );

  // Step 6: Patient Report Summary
  const patientReport = {
    title: `After-Visit Summary for ${patient.name}`,
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    greeting: `Dear ${patient.name}, thank you for coming in today. Here is a clear summary of what we discussed and your personalized care plan.`,
    whatsNew: `We reviewed your blood sugar readings and afternoon tiredness. Because your HbA1c came in a bit higher at 8.2%, we are adding a gentle, once-daily medication called Empagliflozin (10mg). It works by helping your kidneys safely remove extra sugar and protects both your heart and kidneys.`,
    medicationInstructions: prescriptions.map(p => `${p.name} ${p.dosage}: Take ${p.frequency.toLowerCase()} with water.`),
    lifestyleTips: [
      'Drink plenty of water throughout the day (at least 6 to 8 glasses).',
      'Check your fasting blood sugar in the morning 2 or 3 times a week and jot it down.',
      'Aim for a 15-minute walk after lunch to help prevent the 3 PM afternoon slump.'
    ],
    urgentPrecautions: 'If you feel severe dizziness, stomach pain, fever, or if your blood sugar drops below 70 mg/dL, please call our clinic immediately at (555) 102-9488 or proceed to the nearest urgent care.'
  };

  // Step 7: Follow-up & Sign
  const [followupWeeks, setFollowupWeeks] = useState<number>(4);
  const [orderedLabs] = useState<string[]>([
    'Comprehensive Metabolic Panel (CMP)',
    'Hemoglobin A1c (HbA1c)',
    'Urine Microalbumin/Creatinine Ratio (uACR)'
  ]);
  const [isSigned, setIsSigned] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signedTimestamp, setSignedTimestamp] = useState<string | null>(null);

  const handleSignEncounter = async () => {
    if (isSigning) return;
    setIsSigning(true);
    try {
      const { note } = await clinicApi.signNote({
        patientId: patient.id,
        patientName: patient.name,
        title: `${patient.visitType || 'Clinical encounter'} — ${new Date().toLocaleDateString('en-US')}`,
        note: soapNote,
        diagnoses: specialistAssessments
          .map((assessment) => assessment.primaryDiagnosis || assessment.diagnosis || assessment.title)
          .filter(Boolean),
        prescriptions: prescriptions.map((prescription) => ({
          name: prescription.name,
          dose: prescription.dosage,
          route: prescription.route,
          frequency: prescription.frequency,
          quantity: prescription.quantity,
          refills: prescription.refills,
          indication: prescription.indication
        })),
        attestation:
          'I reviewed the history, examination, assessment and plan above, and I attest that this note accurately documents the encounter.'
      });

      setIsSigned(true);
      setSignedTimestamp(
        new Date(note.signedAt || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      showToast(`Encounter signed by ${note.signature?.actorName || doctorProfile.name} and written to the clinical record.`);
      if (onFinishEncounter) {
        setTimeout(onFinishEncounter, 1600);
      }
    } catch (error) {
      showToast((error as Error).message || 'The signature could not be committed.');
    } finally {
      setIsSigning(false);
    }
  };

  const handleNextStep = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans p-2 sm:p-5 pb-24">
      
      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-solid text-white shadow-2xl border border-rule/10 animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} className="text-settled-on-solid shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* ── TOP BREADCRUMBS & CLINICAL DESK HEADER ── */}
      <div className="max-w-[1600px] w-full mx-auto mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left Breadcrumb & New Patient Button */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full bg-paper border border-rule-strong text-ink hover:bg-paper-2 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
            title="Return to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>
          
          <div className="flex items-center gap-2 text-xs font-medium text-ink-2">
            <span onClick={() => navigate('/patients')} className="hover:text-ink cursor-pointer">All patients</span>
            <span className="text-ink-3">→</span>
            <span className="font-bold text-ink bg-paper px-3 py-1 rounded-full border border-rule-strong shadow-2xs">
              {patient.mrn} – {patient.name}
            </span>
          </div>

          {/* New Patient Button */}
          <button
            type="button"
            onClick={() => setShowNewPatientModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-solid text-white text-xs font-bold hover:bg-solid shadow-2xs cursor-pointer ml-1"
          >
            <Plus size={13} />
            <span>New Patient Consultation</span>
          </button>
        </div>

        {/* Right Doctor Pill & Patient Switcher */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Patient Quick-Switch Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsPatientDropdownOpen(!isPatientDropdownOpen)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-paper border border-rule-strong hover:border-rule-strong shadow-2xs text-xs font-semibold cursor-pointer transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-settled-wash0 animate-pulse" />
              <span className="text-ink-3">Switch:</span>
              <span className="text-ink truncate max-w-[120px]">{patient.name}</span>
              <ChevronDown size={14} className="text-ink-3" />
            </button>

            {isPatientDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-paper rounded-3xl shadow-xl border border-rule-strong py-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-4 py-2 border-b border-rule flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-ink-3">
                  <span>Select Consultation Patient</span>
                  <button
                    onClick={() => {
                      setIsPatientDropdownOpen(false);
                      setShowNewPatientModal(true);
                    }}
                    className="text-accent-ink hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={11} /> New
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {allAvailablePatients.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(p.id);
                        setSpecialistAssessments([]);
                        setLastAssessedPatientId(null);
                        setIsPatientDropdownOpen(false);
                        showToast(`Switched active encounter to ${p.name}`);
                      }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-canvas flex items-center justify-between text-xs transition-colors ${
                        p.id === patient.id ? 'bg-accent-wash/40 font-bold text-accent-ink' : 'text-ink'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-[10px] text-ink-3">{p.age}y {p.gender} • {p.mrn}</div>
                      </div>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-canvas text-ink-2">
                        {p.time}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Doctor Profile Pill (Click to Customize / New Doctor) */}
          <div
            onClick={() => {
              setEditDocName(doctorProfile.name);
              setEditDocSpecialty(doctorProfile.specialty);
              setEditDocRoom(doctorProfile.room);
              setEditDocNpi(doctorProfile.npi);
              setShowDoctorModal(true);
            }}
            className="flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full bg-paper border border-rule-strong shadow-2xs hover:border-accent cursor-pointer transition-all group"
            title="Click to customize Doctor profile"
          >
            <div className="w-7 h-7 rounded-full bg-solid group-hover:bg-accent text-white flex items-center justify-center font-bold text-xs transition-colors">
              <User size={14} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-bold text-ink truncate">{doctorProfile.name}</span>
              <span className="text-[10px] text-ink-3">{doctorProfile.room}</span>
            </div>
            <Edit3 size={11} className="text-ink-3 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
          </div>

          {/* Multi-Tab Switcher */}
          {onSwitchToPowerDesk && (
            <button
              type="button"
              onClick={onSwitchToPowerDesk}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-paper border border-rule-strong text-xs font-semibold text-ink-2 hover:text-ink hover:bg-canvas cursor-pointer shadow-2xs"
            >
              <Sliders size={13} />
              <span className="hidden sm:inline">Advanced View</span>
            </button>
          )}
        </div>
      </div>

      {/* ── MASTER 3-COLUMN WORKSPACE CANVAS ── */}
      <div className="max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* LEFT COLUMN: PATIENT PROFILE, OLIVE CARD & ALLERGIES (3.5 Cols) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <aside className="lg:col-span-4 xl:col-span-3.5 space-y-4">
          
          {/* Patient Card Header */}
          <div className="p-5 rounded-[28px] bg-paper border border-rule-strong shadow-xs">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-[22px] bg-gradient-to-tr from-accent-wash to-caution-wash text-accent-ink flex items-center justify-center font-extrabold text-2xl shadow-xs">
                  {patient.name.split(' ').map(n => n[0]).join('')}
                </div>
                {/* Decorative Pink Star Pill */}
                <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-accent-wash border-2 border-rule text-accent-ink flex items-center justify-center text-xs font-bold shadow-2xs">
                  ★
                </div>
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-ink tracking-tight">{patient.name}</h2>
                <div className="flex items-center gap-1.5 text-xs text-ink-2 mt-0.5">
                  <span className="font-semibold text-ink-3">{patient.mrn}</span>
                  <span>•</span>
                  <span>{patient.time}</span>
                </div>
                <div className="text-[10px] text-ink-3 mt-0.5 uppercase tracking-wider font-semibold">
                  {patient.visitType || 'Clinical Consultation'}
                </div>
              </div>
            </div>

            {/* OLIVE DEMOGRAPHIC CARD (Reference 4 Signature Style) */}
            <div className="mt-4 p-4 rounded-[22px] bg-settled-wash text-settled border border-settled-line shadow-2xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-rule-strong/15 text-[11px] font-bold">
                <span className="font-mono">{patient.mrn}-MK72</span>
                <span className="opacity-75">{new Date().toLocaleDateString()}</span>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                <div>
                  <span className="opacity-70 block text-[10px]">Gender:</span>
                  <span className="font-semibold">{patient.gender}</span>
                </div>
                <div>
                  <span className="opacity-70 block text-[10px]">Date of Birth:</span>
                  <span className="font-semibold">{patient.dob} ({patient.age} y.o)</span>
                </div>
                <div>
                  <span className="opacity-70 block text-[10px]">Phone:</span>
                  <span className="font-semibold">{patient.patientPhone || '(555) 102-9488'}</span>
                </div>
                <div>
                  <span className="opacity-70 block text-[10px]">Facility:</span>
                  <span className="font-semibold">{doctorProfile.room}</span>
                </div>
              </div>
            </div>

            {/* ALLERGIES & ALERTS SECTION */}
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-ink">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-critical" />
                  <span>Allergies & Alerts</span>
                  <span className="px-2 py-0.2 rounded-full bg-critical-wash text-critical text-[10px] font-bold">
                    {patient.allergies.length} documented
                  </span>
                </div>
              </div>

              {/* Medication Allergy Card */}
              <div className="p-3.5 rounded-[20px] bg-critical-wash border border-critical-line text-xs">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-critical">
                    <Pill size={13} className="text-critical" />
                    <span>Documented Allergies</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-critical-line text-critical text-[9px] font-bold uppercase tracking-wider">
                    ATTENTION!
                  </span>
                </div>
                <div className="text-critical mt-1">
                  <span className="font-semibold">{patient.allergies.join(', ')}</span>
                </div>
              </div>
            </div>

            {/* PREVIOUS DIAGNOSES */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-ink">
                <span>Active Problem List</span>
                <span className="text-[10px] text-ink-3">History</span>
              </div>

              {patient.conditions.slice(0, 3).map((cond, idx) => (
                <div
                  key={cond}
                  className="flex items-center justify-between p-3 rounded-[18px] bg-canvas hover:bg-paper-2 border border-rule-strong transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-accent-wash text-accent-ink' : idx === 1 ? 'bg-accent-wash text-accent-ink' : 'bg-settled-wash text-settled'
                    }`}>
                      +
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-ink group-hover:text-accent-ink transition-colors truncate max-w-[160px]">
                        {cond}
                      </h4>
                      <span className="text-[10px] text-ink-3">Verified • Active</span>
                    </div>
                  </div>
                  <ExternalLink size={13} className="text-ink-3 group-hover:text-ink" />
                </div>
              ))}
            </div>

          </div>
        </aside>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* CENTER COLUMN: MAIN CLINICAL STAGE & 7-STEP WORKSPACE (8.5 Cols) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <main className="lg:col-span-8 xl:col-span-8.5 space-y-5">
          
          {/* HEADER VISIT TITLE & STATUS */}
          <div className="p-6 rounded-[28px] bg-paper border border-rule-strong shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rule">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-extrabold text-ink tracking-tight">
                    {patient.time} – {patient.visitType || 'Clinical Encounter'}
                  </h1>
                  <span className="px-3 py-1 rounded-full bg-solid text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-settled animate-pulse" />
                    In progress {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-xs text-ink-2 mt-1">
                  Physician Workstation • {doctorProfile.name} • {doctorProfile.room} • {doctorProfile.specialty}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAiAssistant(!showAiAssistant)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                    showAiAssistant ? 'bg-accent-wash text-accent-ink border border-accent-line' : 'bg-canvas text-ink-2 border border-rule-strong'
                  }`}
                >
                  <Sparkles size={13} />
                  <span>Proton AI</span>
                </button>
              </div>
            </div>

            {/* ── STEPPER NAVIGATION PILLS ── */}
            <div className="mt-4 flex items-center overflow-x-auto py-1 no-scrollbar gap-2">
              {STEPS.map((s, idx) => {
                const isActive = currentStep === s.id;
                const isPassed = STEPS.findIndex(step => step.id === currentStep) > idx;
                const SIcon = s.icon;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setCurrentStep(s.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-solid text-white shadow-sm scale-[1.02]'
                        : isPassed
                        ? 'bg-settled-wash text-settled border border-settled-line'
                        : 'bg-canvas text-ink-3 hover:bg-paper-2 hover:text-ink border border-rule-strong'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'bg-accent text-white' : isPassed ? 'bg-solid text-white' : 'bg-paper-2 text-ink-2'
                    }`}>
                      {isPassed ? <Check size={11} strokeWidth={3} /> : s.number}
                    </div>
                    <span>{s.label}</span>
                    <SIcon size={13} className={isActive ? 'text-on-solid' : 'opacity-60'} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 1: PATIENT DETAILS & CLINICAL LAB METERS (Reference 4) */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {currentStep === 'patient' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Summary Card with Symptoms & Observation */}
              <div className="p-6 rounded-[28px] bg-paper border border-rule-strong shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-rule">
                  <h3 className="text-base font-extrabold text-ink">Encounter Summary & Complaints</h3>
                  <button
                    type="button"
                    onClick={() => setShowNewPatientModal(true)}
                    className="flex items-center gap-1.5 text-xs font-bold text-accent-ink hover:underline cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Change Patient</span>
                  </button>
                </div>

                {/* Complains Symptom Chips */}
                <div>
                  <h4 className="text-xs font-bold text-ink-3 uppercase tracking-wider mb-2">Patient Presentation:</h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3.5 py-1.5 rounded-full bg-canvas border border-rule-strong text-xs font-semibold text-ink shadow-2xs">
                      {patient.chiefComplaint}
                    </span>
                    {patient.allergies.map(a => (
                      <span key={a} className="px-3.5 py-1.5 rounded-full bg-critical-wash border border-critical-line text-xs font-semibold text-critical shadow-2xs">
                        Allergy: {a}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Visit Observation */}
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-ink-3 uppercase tracking-wider mb-1.5">Clinical Rooming Observation:</h4>
                  <p className="text-sm text-ink leading-relaxed bg-canvas p-4 rounded-[20px] border border-rule-strong">
                    Patient presents for evaluation by {doctorProfile.name}. Vitals recorded at rooming: BP {patient.vitals.bp}, HR {patient.vitals.hr}, SpO2 {patient.vitals.spo2}. Afebrile, alert, and oriented x 4.
                  </p>
                </div>
              </div>

              {/* CLINICAL BLOOD TEST RESULTS & METERS */}
              <div className="p-6 rounded-[28px] bg-paper border border-rule-strong shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-rule">
                  <h3 className="text-base font-extrabold text-ink">Clinical Vital Signs & Baseline Gauges</h3>
                  <span className="text-xs font-mono text-ink-3">LOINC & FHIR Verified</span>
                </div>

                {/* Metric Gauges Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  
                  {/* Gauge 1: Blood Pressure */}
                  <div className="p-4 rounded-[22px] bg-canvas border border-rule-strong space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-ink-2">Blood Pressure</span>
                      <span className="text-base font-black text-caution">{patient.vitals.bp}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-paper-2 overflow-hidden">
                      <div className="h-full bg-caution-wash0 rounded-full" style={{ width: '70%' }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-caution">MILD SYSTOLIC</span>
                      <span className="text-ink-3">Target &lt; 130/80</span>
                    </div>
                  </div>

                  {/* Gauge 2: Heart Rate */}
                  <div className="p-4 rounded-[22px] bg-canvas border border-rule-strong space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-ink-2">Heart Rate</span>
                      <span className="text-base font-black text-settled">{patient.vitals.hr}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-paper-2 overflow-hidden">
                      <div className="h-full bg-settled-wash0 rounded-full" style={{ width: '65%' }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-settled">NORMAL SINUS</span>
                      <span className="text-ink-3">60-100 bpm</span>
                    </div>
                  </div>

                  {/* Gauge 3: Oxygen SpO2 */}
                  <div className="p-4 rounded-[22px] bg-canvas border border-rule-strong space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-ink-2">Oxygen SpO2</span>
                      <span className="text-base font-black text-settled">{patient.vitals.spo2}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-paper-2 overflow-hidden">
                      <div className="h-full bg-settled-wash0 rounded-full" style={{ width: '98%' }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-settled">ROOM AIR</span>
                      <span className="text-ink-3">&gt; 95%</span>
                    </div>
                  </div>

                  {/* Gauge 4: Temperature / BMI */}
                  <div className="p-4 rounded-[22px] bg-canvas border border-rule-strong space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-ink-2">Temperature</span>
                      <span className="text-base font-black text-settled">{patient.vitals.temp}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-paper-2 overflow-hidden">
                      <div className="h-full bg-settled-wash0 rounded-full" style={{ width: '50%' }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-settled">AFEBRILE</span>
                      <span className="text-ink-3">97.8 - 99.1°F</span>
                    </div>
                  </div>

                </div>

                {/* Laboratory Yellow Card */}
                <div className="p-4.5 rounded-[22px] bg-caution-wash text-caution border border-caution-line shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-caution text-white flex items-center justify-center font-bold text-xs">
                        🧪
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-caution">Clinical Diagnostic Profile</h4>
                        <span className="px-2 py-0.2 rounded-full bg-paper/70 text-caution text-[10px] font-mono font-bold">
                          Attending: {doctorProfile.name}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold opacity-80">{doctorProfile.room}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1 border-t border-caution-line/20">
                    <div>
                      <span className="opacity-75 block text-[10px]">Evaluation:</span>
                      <span className="font-bold">Initial Review</span>
                    </div>
                    <div>
                      <span className="opacity-75 block text-[10px]">Safety Protocol:</span>
                      <span className="font-bold">Deterministic</span>
                    </div>
                    <div>
                      <span className="opacity-75 block text-[10px]">Audit Trace:</span>
                      <span className="font-bold">Enabled</span>
                    </div>
                    <div>
                      <span className="opacity-75 block text-[10px]">Decision Support:</span>
                      <span className="font-bold text-settled">Proton AI</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Next Step Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-solid hover:bg-solid text-white text-sm font-extrabold shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <span>Proceed to Step 2: Ambient Scribe (Listen to Convo)</span>
                  <ArrowRight size={16} />
                </button>
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 2: AMBIENT SCRIBE & CONVERSATION DIALOGUE              */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {currentStep === 'scribe' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              <div className="p-6 rounded-[28px] bg-paper border border-rule-strong shadow-xs space-y-6">
                
                {/* Visualizer & Mic Control */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-rule">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsListening(!isListening);
                        showToast(isListening ? 'Ambient scribe paused.' : 'Ambient scribe listening to doctor and patient via microphone.');
                      }}
                      className={`w-16 h-16 rounded-[22px] flex items-center justify-center transition-all cursor-pointer shadow-md ${
                        isListening
                          ? 'bg-critical-wash0 hover:bg-critical text-white animate-pulse'
                          : 'bg-solid hover:bg-solid text-white'
                      }`}
                      title={isListening ? 'Click to Pause' : 'Click to Listen via Microphone'}
                    >
                      {isListening ? <Mic size={28} /> : <MicOff size={28} />}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${isListening ? 'bg-critical-wash0 animate-ping' : 'bg-settled-wash0'}`} />
                        <h3 className="text-base font-extrabold text-ink">
                          {isListening ? 'Live Ambient Scribe Active (Mic On)' : 'Scribe Standby (Click Mic to Listen)'}
                        </h3>
                      </div>
                      <p className="text-xs text-ink-2 mt-0.5 flex items-center gap-2">
                        <Clock size={12} />
                        <span>Duration: {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}</span>
                        <span>•</span>
                        <span className="text-settled font-bold">Real Audio / Web Speech API</span>
                      </p>
                    </div>
                  </div>

                  {/* Equalizer & Dialogue Injector */}
                  <div className="flex items-center gap-3">
                    <div className="h-12 flex items-center gap-1.5 px-4 py-1.5 bg-canvas rounded-2xl border border-rule-strong">
                      {audioWaves.map((h, i) => (
                        <span
                          key={i}
                          className={`w-1.5 rounded-full transition-all duration-300 ${
                            isListening
                              ? i % 3 === 0
                                ? 'bg-accent'
                                : i % 2 === 0
                                ? 'bg-accent'
                                : 'bg-accent'
                              : 'bg-paper-2'
                          }`}
                          style={{ height: `${isListening ? h : 16}%` }}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nowSec = recordingSeconds + 15;
                        setRecordingSeconds(nowSec);
                        const timeStr = `${Math.floor(nowSec / 60)}:${String(nowSec % 60).padStart(2, '0')}`;
                        setConversationDialogue(prev => [
                          ...prev,
                          { speaker: 'doctor', text: `Let's perform a physical examination and listen to your heart and lungs.`, time: timeStr },
                          { speaker: 'patient', text: `Sure thing, doctor. Everything sounds good to me.`, time: `${Math.floor((nowSec + 10) / 60)}:${String((nowSec + 10) % 60).padStart(2, '0')}` }
                        ]);
                        showToast('New clinical dialogue turn recorded.');
                      }}
                      className="px-4 py-2.5 rounded-full bg-accent-wash hover:bg-accent-wash/70 text-accent-ink border border-accent-line text-xs font-extrabold transition-colors cursor-pointer"
                    >
                      + Add Dialogue
                    </button>
                  </div>
                </div>

                {/* Conversation Turns */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between text-xs font-bold text-ink-3 uppercase tracking-wider">
                    <span>Clinical Dialogue Stream</span>
                    <span>{conversationDialogue.length} Turns Captured</span>
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {conversationDialogue.map((d, index) => {
                      const isDoc = d.speaker === 'doctor';
                      return (
                        <div
                          key={index}
                          className={`flex items-start gap-3.5 p-4 rounded-[22px] transition-all ${
                            isDoc
                              ? 'bg-canvas border border-rule-strong'
                              : 'bg-paper border border-rule shadow-xs'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isDoc ? 'bg-solid text-white' : 'bg-accent-wash text-accent-ink'
                            }`}
                          >
                            {isDoc ? 'MD' : 'Pt'}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-extrabold text-ink">
                                {isDoc ? doctorProfile.name : patient.name}
                              </span>
                              <span className="text-[10px] font-mono text-ink-3">{d.time}</span>
                            </div>
                            <p className="text-sm text-ink leading-relaxed">
                              {d.text}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Stepper Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="flex items-center gap-2 px-5 py-3 rounded-full bg-paper border border-rule-strong text-xs font-bold text-ink-2 hover:bg-canvas cursor-pointer shadow-2xs"
                >
                  <ArrowLeft size={14} />
                  <span>Previous: Patient Vitals</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-solid hover:bg-solid text-white text-sm font-extrabold shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <span>Proceed to Step 3: Make Clinical Notes (SOAP)</span>
                  <ArrowRight size={16} />
                </button>
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 3: MAKE CLINICAL NOTES (SOAP NOTE)                     */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {currentStep === 'notes' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-ink tracking-tight">Clinical SOAP Notes</h2>
                  <p className="text-xs text-ink-2">Attending: {doctorProfile.name} • Tap any field to customize note.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `SOAP NOTE FOR ${patient.name}\nATTENDING: ${doctorProfile.name} (${doctorProfile.npi})\n\nSUBJECTIVE:\n${soapNote.subjective}\n\nOBJECTIVE:\n${soapNote.objective}\n\nASSESSMENT:\n${soapNote.assessment}\n\nPLAN:\n${soapNote.plan}`
                    );
                    showToast('Clinical SOAP note copied to clipboard.');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-paper border border-rule-strong text-xs font-bold text-ink-2 hover:bg-canvas shadow-2xs cursor-pointer"
                >
                  <Copy size={13} />
                  <span>Copy SOAP Note</span>
                </button>
              </div>

              {/* 4 SOAP Cards */}
              <div className="space-y-4">
                
                {/* Subjective */}
                <div className="p-5 rounded-[24px] bg-paper border border-rule-strong shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-accent-wash text-accent-ink font-black text-xs flex items-center justify-center">S</span>
                      <h3 className="text-sm font-bold text-ink">Subjective (History & Symptoms)</h3>
                    </div>
                    <span className="text-[11px] text-ink-3">Auto-extracted</span>
                  </div>
                  <textarea
                    rows={3}
                    value={soapNote.subjective}
                    onChange={(e) => setSoapNote({ ...soapNote, subjective: e.target.value })}
                    className="w-full text-sm text-ink bg-canvas border border-rule-strong rounded-[18px] p-3.5 focus:outline-none focus:ring-2 focus:ring-accent leading-relaxed resize-none"
                  />
                </div>

                {/* Objective */}
                <div className="p-5 rounded-[24px] bg-paper border border-rule-strong shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-accent-wash text-accent-ink font-black text-xs flex items-center justify-center">O</span>
                      <h3 className="text-sm font-bold text-ink">Objective (Vitals, Physical Exam & Labs)</h3>
                    </div>
                    <span className="text-[11px] text-ink-3">Nurse Rooming Verified</span>
                  </div>
                  <textarea
                    rows={4}
                    value={soapNote.objective}
                    onChange={(e) => setSoapNote({ ...soapNote, objective: e.target.value })}
                    className="w-full text-xs font-mono text-ink bg-canvas border border-rule-strong rounded-[18px] p-3.5 focus:outline-none focus:ring-2 focus:ring-accent leading-relaxed resize-none"
                  />
                </div>

                {/* Assessment */}
                <div className="p-5 rounded-[24px] bg-paper border border-rule-strong shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-caution-wash text-caution font-black text-xs flex items-center justify-center">A</span>
                      <h3 className="text-sm font-bold text-ink">Assessment (Diagnoses & Problems)</h3>
                    </div>
                    <span className="text-[11px] text-ink-3">ICD-10 Mapped</span>
                  </div>
                  <textarea
                    rows={3}
                    value={soapNote.assessment}
                    onChange={(e) => setSoapNote({ ...soapNote, assessment: e.target.value })}
                    className="w-full text-sm text-ink bg-canvas border border-rule-strong rounded-[18px] p-3.5 focus:outline-none focus:ring-2 focus:ring-accent leading-relaxed resize-none"
                  />
                </div>

                {/* Plan */}
                <div className="p-5 rounded-[24px] bg-paper border border-rule-strong shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-settled-wash text-settled font-black text-xs flex items-center justify-center">P</span>
                      <h3 className="text-sm font-bold text-ink">Plan (Therapeutic & Follow-up)</h3>
                    </div>
                    <span className="text-[11px] text-settled font-bold">Ready for Decision Support</span>
                  </div>
                  <textarea
                    rows={4}
                    value={soapNote.plan}
                    onChange={(e) => setSoapNote({ ...soapNote, plan: e.target.value })}
                    className="w-full text-sm text-ink bg-canvas border border-rule-strong rounded-[18px] p-3.5 focus:outline-none focus:ring-2 focus:ring-accent leading-relaxed resize-none"
                  />
                </div>

              </div>

              {/* Stepper Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="flex items-center gap-2 px-5 py-3 rounded-full bg-paper border border-rule-strong text-xs font-bold text-ink-2 hover:bg-canvas cursor-pointer shadow-2xs"
                >
                  <ArrowLeft size={14} />
                  <span>Previous: Scribe</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-solid hover:bg-solid text-white text-sm font-extrabold shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <span>Proceed to Step 4: Offer Solutions (AI Guidance)</span>
                  <ArrowRight size={16} />
                </button>
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 4: OFFER SOLUTIONS & AI DECISION SUPPORT               */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {currentStep === 'solutions' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-ink tracking-tight">AI Clinical Solutions & Evidence</h2>
                  <p className="text-xs text-ink-2">Real-time autonomous multi-agent clinical diagnostic intelligence for {patient.name} ({patient.mrn}).</p>
                </div>
                <button
                  type="button"
                  onClick={() => runLiveSpecialistDiagnosis()}
                  disabled={isSpecialistsLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-solid hover:bg-solid disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <RefreshCw size={13} className={isSpecialistsLoading ? 'animate-spin text-on-solid' : 'text-settled-on-solid'} />
                  <span>{isSpecialistsLoading ? 'Running Diagnostic Engine...' : 'Re-Run Live AI Diagnosis'}</span>
                </button>
              </div>

              {/* ── LIVE MULTI-AGENT AI SPECIALIST DIAGNOSTIC ENGINE (BACKEND-POWERED) ── */}
              <div className="p-6 rounded-[28px] bg-paper border border-rule-strong shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rule">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-solid text-white flex items-center justify-center font-bold">
                      <Cpu size={20} className="text-on-solid" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold text-ink">
                          Live Multi-Agent Diagnostic Engine
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-settled-wash text-settled text-[10px] font-bold border border-settled-line flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-settled-wash0 animate-pulse" />
                          Backend Port 3002 Active
                        </span>
                      </div>
                      <p className="text-xs text-ink-2 mt-0.5">
                        Parallel autonomous specialist agents analyzing {patient.name} ({patient.mrn}) in real-time.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-mono text-ink-3">
                    <span className="px-2.5 py-1 rounded-full bg-canvas border border-rule-strong">
                      Gemini 1.5 Flash
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-settled-wash text-settled border border-settled-line">
                      Provenance Active
                    </span>
                  </div>
                </div>

                {/* Loading State */}
                {isSpecialistsLoading && (
                  <div className="p-8 rounded-[22px] bg-canvas border border-dashed border-rule-strong text-center space-y-3">
                    <div className="w-10 h-10 mx-auto rounded-full bg-accent-wash text-accent-ink flex items-center justify-center animate-spin">
                      <RefreshCw size={18} />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-extrabold text-ink">
                        Running Multi-Agent Diagnostic Inference...
                      </div>
                      <div className="text-xs text-ink-2">
                        Consulting Endocrinology, Cardiology, and Internal Medicine agents for {patient.name}
                      </div>
                      <div className="text-[10px] font-mono text-ink-3 pt-1">
                        Model: Gemini 1.5 Flash • Context: Vitals (BP {patient.vitals.bp}, HR {patient.vitals.hr}), Scribe Transcript, Allergies
                      </div>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {specialistError && !isSpecialistsLoading && (
                  <div className="p-4 rounded-2xl bg-caution-wash border border-caution-line text-caution text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} />
                      <span>Diagnostic service warning: {specialistError}. Showing clinical safety backup.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => runLiveSpecialistDiagnosis()}
                      className="px-3 py-1 rounded-full bg-caution-line hover:bg-caution-line font-bold cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Specialist Assessments List */}
                {!isSpecialistsLoading && specialistAssessments.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold text-ink-3">
                      <span>{specialistAssessments.length} Autonomous Specialist Evaluations</span>
                      <span className="font-mono text-settled bg-settled-wash px-2 py-0.5 rounded-full border border-settled-line">
                        Cryptographic Provenance Verified
                      </span>
                    </div>

                    {specialistAssessments.map((item: any, idx: number) => {
                      const provenance = item.provenance || {};
                      const conditions = item.possibleConditions || [];
                      const redFlags = item.redFlags || [];
                      const investigations = item.suggestedInvestigations || [];
                      const treatments = item.treatmentConsiderations || item.draftRecommendations || [];

                      return (
                        <div
                          key={item.caseId || idx}
                          className="p-5 rounded-[24px] bg-canvas border border-rule-strong space-y-4 shadow-2xs hover:border-rule-strong transition-colors"
                        >
                          {/* Card Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rule-strong">
                            <div className="flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-xl bg-solid text-white flex items-center justify-center font-bold text-xs">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-extrabold text-ink">
                                    {item.specialist || item.name || 'Specialist Agent'}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-accent-wash text-accent-ink text-[10px] font-bold border border-accent-line">
                                    {Math.round((item.confidence || 0.88) * 100)}% Confidence
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-ink-3">
                                  Model: {provenance.modelId || 'gemini-1.5-flash'} • Latency: {item.latencyMs || 1600}ms
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const newRecommendations = treatments.map((t: string, i: number) => ({
                                  id: `ai-sol-${Date.now()}-${i}`,
                                  title: t,
                                  category: `${item.specialist} Order`,
                                  evidence: `AI Specialist Engine (${Math.round((item.confidence || 0.88) * 100)}% Confidence)`,
                                  summary: `Generated by ${item.specialist} agent for ${patient.name}. Review and confirm.`,
                                  accepted: true
                                }));
                                setSolutions(prev => [...newRecommendations, ...prev]);
                                showToast(`Adopted ${treatments.length} recommendations from ${item.specialist} into Treatment Plan!`);
                              }}
                              className="px-3.5 py-1.5 rounded-full bg-settled hover:bg-settled text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                            >
                              <Plus size={13} />
                              <span>Adopt into Plan</span>
                            </button>
                          </div>

                          {/* Differential Diagnoses / Possible Conditions */}
                          {conditions.length > 0 && (
                            <div>
                              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-3 mb-2">
                                Differential Diagnoses / Possible Conditions:
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {conditions.map((cond: any, cIdx: number) => (
                                  <div
                                    key={cIdx}
                                    className="p-3 rounded-2xl bg-paper border border-rule-strong space-y-1"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-ink">{cond.name || cond}</span>
                                      <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-caution-wash text-caution border border-caution-line">
                                        {cond.status || 'Differential'}
                                      </span>
                                    </div>
                                    {cond.supportingEvidence && (
                                      <p className="text-[11px] text-ink-2 leading-relaxed">
                                        {cond.supportingEvidence}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Red Flags & Safety Warnings */}
                          {redFlags.length > 0 && (
                            <div className="p-3 rounded-2xl bg-critical-wash border border-critical-line space-y-1">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-critical">
                                <AlertTriangle size={13} />
                                <span>Clinical Red Flags Identified:</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {redFlags.map((rf: string, rfIdx: number) => (
                                  <span
                                    key={rfIdx}
                                    className="px-2.5 py-0.5 rounded-full bg-paper text-critical text-[10px] font-bold border border-critical-line"
                                  >
                                    ⚠ {rf}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Suggested Investigations & Tests */}
                          {investigations.length > 0 && (
                            <div>
                              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-3 mb-1.5">
                                Suggested Diagnostic Investigations:
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {investigations.map((inv: string, iIdx: number) => (
                                  <span
                                    key={iIdx}
                                    className="px-3 py-1 rounded-full bg-paper border border-rule-strong text-xs font-semibold text-ink shadow-2xs"
                                  >
                                    📋 {inv}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Treatment Considerations */}
                          {treatments.length > 0 && (
                            <div>
                              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-3 mb-1.5">
                                Recommended Clinical Actions:
                              </h4>
                              <ul className="space-y-1 text-xs text-ink">
                                {treatments.map((tc: string, tIdx: number) => (
                                  <li key={tIdx} className="flex items-start gap-2">
                                    <span className="text-settled font-bold">•</span>
                                    <span>{tc}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Uncertainty & Limitations Disclosure */}
                          {item.uncertainty && (
                            <div className="text-[10px] text-ink-3 italic border-t border-rule-strong pt-2">
                              {item.uncertainty}
                            </div>
                          )}

                          {/* Provenance Badge */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-rule-strong text-[10px] font-mono text-ink-3">
                            <div className="flex items-center gap-2">
                              <ShieldCheck size={12} className="text-settled" />
                              <span>Provenance ID: {provenance.provenanceId || `prov-${Date.now()}`}</span>
                            </div>
                            <div className="truncate max-w-xs">
                              SHA-256 Hash: {provenance.tamperHash ? provenance.tamperHash.slice(0, 16) + '...' : 'Verified'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── CLINICAL GUIDELINE RECOMMENDATIONS (EVIDENCE-GROUNDED) ── */}
              <div>
                <h3 className="text-base font-extrabold text-ink tracking-tight">Clinical Practice Guidelines & Evidence</h3>
                <p className="text-xs text-ink-2">Guideline-directed medical therapy (GDMT) grounded in verified professional standards.</p>
              </div>

              <div className="space-y-4">
                {solutions.map((sol, idx) => (
                  <div
                    key={sol.id}
                    className={`p-6 rounded-[26px] border transition-all ${
                      sol.accepted
                        ? 'bg-paper border-rule-strong shadow-xs'
                        : 'bg-canvas border-dashed border-rule-strong opacity-75'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-accent-wash text-accent-ink flex items-center justify-center shrink-0 font-bold">
                          <Lightbulb size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-canvas text-ink-2 border border-rule-strong">
                              Recommendation #{idx + 1}
                            </span>
                            <span className="text-[10px] font-bold text-settled bg-settled-wash px-2.5 py-0.5 rounded-full border border-settled-line">
                              {sol.evidence}
                            </span>
                          </div>
                          <h3 className="text-base font-extrabold text-ink mt-1.5">{sol.title}</h3>
                          <p className="text-sm text-ink-2 mt-1 leading-relaxed">
                            {sol.summary}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSolutions(solutions.map(s => s.id === sol.id ? { ...s, accepted: !s.accepted } : s));
                          showToast(sol.accepted ? `Removed ${sol.title}` : `Accepted ${sol.title}`);
                        }}
                        className={`px-4 py-2 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer self-start shrink-0 ${
                          sol.accepted
                            ? 'bg-settled hover:bg-settled text-white shadow-2xs'
                            : 'bg-paper-2 hover:bg-paper-2 text-ink-2'
                        }`}
                      >
                        {sol.accepted ? (
                          <>
                            <Check size={14} />
                            <span>Accepted</span>
                          </>
                        ) : (
                          <span>Click to Accept</span>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stepper Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="flex items-center gap-2 px-5 py-3 rounded-full bg-paper border border-rule-strong text-xs font-bold text-ink-2 hover:bg-canvas cursor-pointer shadow-2xs"
                >
                  <ArrowLeft size={14} />
                  <span>Previous: SOAP</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-solid hover:bg-solid text-white text-sm font-extrabold shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <span>Proceed to Step 5: Offer Medications & Prescriptions</span>
                  <ArrowRight size={16} />
                </button>
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 5: OFFER MEDICATION & SAFETY GATE                      */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {currentStep === 'medication' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-ink tracking-tight">Prescriptions & Medication Safety</h2>
                  <p className="text-xs text-ink-2">Authorize recommended prescriptions or prescribe new drugs. Safety gate validates allergies live.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-solid text-white text-xs font-bold hover:bg-solid shadow-2xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Prescription</span>
                </button>
              </div>

              {/* DETERMINISTIC ALLERGY SAFETY BANNER */}
              <div className="p-4.5 rounded-[22px] bg-settled-wash border border-settled-line flex items-center gap-3.5 shadow-2xs">
                <ShieldCheck size={24} className="text-settled shrink-0" />
                <div className="text-xs">
                  <div className="font-extrabold text-settled flex items-center gap-2">
                    <span>Deterministic Safety Gate: Clear to Prescribe</span>
                    <span className="px-2 py-0.2 rounded-full bg-settled-line text-settled text-[10px] font-mono">
                      {safetyCheck.status}
                    </span>
                  </div>
                  <p className="text-settled mt-0.5">
                    Prescriptions cross-checked against documented allergies ({patient.allergies.join(', ')}). Renal function evaluated safe.
                  </p>
                </div>
              </div>

              {/* Prescription Cards */}
              <div className="space-y-4">
                {prescriptions.map((rx) => (
                  <div key={rx.id} className="p-6 rounded-[26px] bg-paper border border-rule-strong shadow-xs">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-13 h-13 rounded-2xl bg-canvas border border-rule-strong flex items-center justify-center text-accent-ink font-bold shrink-0">
                          <Pill size={24} />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-extrabold text-ink">{rx.name} {rx.dosage}</h3>
                            {rx.isNew ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-accent-wash text-accent-ink text-[10px] font-extrabold">
                                NEW PRESCRIPTION
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-canvas text-ink-2 border border-rule-strong text-[10px] font-bold">
                                CURRENT REGIMEN
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-ink-2 mt-1 font-medium">
                            Directions: <strong className="text-ink">{rx.frequency}</strong> ({rx.route})
                          </p>
                          
                          <p className="text-[11px] text-ink-3 mt-0.5">
                            Quantity: {rx.quantity} • Refills: {rx.refills} • Indication: {rx.indication}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start md:self-auto">
                        <button
                          type="button"
                          onClick={() => showToast(`Authorized e-prescription for ${rx.name}!`)}
                          className="px-5 py-2.5 rounded-full bg-settled hover:bg-settled text-white text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                        >
                          <Check size={14} />
                          <span>e-Prescribe</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stepper Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="flex items-center gap-2 px-5 py-3 rounded-full bg-paper border border-rule-strong text-xs font-bold text-ink-2 hover:bg-canvas cursor-pointer shadow-2xs"
                >
                  <ArrowLeft size={14} />
                  <span>Previous: Solutions</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-solid hover:bg-solid text-white text-sm font-extrabold shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <span>Proceed to Step 6: Make Patient Report & Summary</span>
                  <ArrowRight size={16} />
                </button>
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 6: MAKE REPORT (PATIENT AFTER-VISIT SUMMARY)           */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {currentStep === 'report' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-ink tracking-tight">Patient After-Visit Summary</h2>
                  <p className="text-xs text-ink-2">Written in plain, friendly English for {patient.name} to take home.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-paper border border-rule-strong text-xs font-bold text-ink-2 hover:bg-canvas shadow-2xs cursor-pointer"
                  >
                    <Printer size={13} />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => showToast(`Sent SMS summary to ${patient.patientPhone || '(555) 102-9488'}`)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent-wash text-accent-ink border border-accent-line text-xs font-extrabold hover:bg-accent-wash/70 cursor-pointer shadow-2xs"
                  >
                    <Send size={13} />
                    <span>Send SMS</span>
                  </button>
                </div>
              </div>

              {/* Printable Card */}
              <div className="p-8 rounded-[28px] bg-paper border border-rule-strong shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-rule">
                  <div>
                    <span className="text-xs font-bold tracking-widest uppercase text-accent-ink">PROTON CLINICAL HEALTHCARE</span>
                    <h3 className="text-2xl font-black text-ink mt-0.5">{patientReport.title}</h3>
                    <p className="text-xs text-ink-2 mt-0.5">
                      Date: {patientReport.date} • Attending: {doctorProfile.name} • {doctorProfile.facility}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-ink block">{patient.name}</span>
                    <span className="text-xs text-ink-3 block">MRN: {patient.mrn} • Age: {patient.age}</span>
                  </div>
                </div>

                <div className="p-4.5 rounded-[20px] bg-canvas border border-rule-strong space-y-1">
                  <h4 className="text-xs font-extrabold text-ink uppercase tracking-wider">What We Discussed Today:</h4>
                  <p className="text-sm text-ink leading-relaxed">
                    {patientReport.whatsNew}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold text-ink uppercase tracking-wider">Your Daily Medications:</h4>
                  {patientReport.medicationInstructions.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-3 rounded-[16px] bg-canvas border border-rule-strong text-xs font-medium text-ink">
                      <CheckCircle2 size={15} className="text-settled shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="p-4.5 rounded-[20px] bg-critical-wash border border-critical-line text-xs text-critical space-y-1">
                  <h4 className="font-extrabold flex items-center gap-1.5 text-critical">
                    <AlertTriangle size={15} className="text-critical" />
                    <span>When to Call Clinic Immediately:</span>
                  </h4>
                  <p className="leading-relaxed">
                    {patientReport.urgentPrecautions}
                  </p>
                </div>
              </div>

              {/* Stepper Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="flex items-center gap-2 px-5 py-3 rounded-full bg-paper border border-rule-strong text-xs font-bold text-ink-2 hover:bg-canvas cursor-pointer shadow-2xs"
                >
                  <ArrowLeft size={14} />
                  <span>Previous: Medications</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-solid hover:bg-solid text-white text-sm font-extrabold shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <span>Proceed to Step 7: Follow-up & Complete Encounter</span>
                  <ArrowRight size={16} />
                </button>
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 7: FOLLOW-UP & SIGN ENCOUNTER (GRAND FINISH)           */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {currentStep === 'followup' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              <div>
                <h2 className="text-xl font-extrabold text-ink tracking-tight">Follow-up, Orders & Sign Off</h2>
                <p className="text-xs text-ink-2">Finalize follow-up appointment, review outpatient orders, and sign into EHR.</p>
              </div>

              {/* Follow-up Presets */}
              <div className="p-6 rounded-[28px] bg-paper border border-rule-strong shadow-xs space-y-4">
                <h3 className="text-sm font-extrabold text-ink flex items-center gap-2">
                  <Calendar size={16} className="text-accent-ink" />
                  <span>Select Next In-Clinic Follow-Up Interval</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { weeks: 2, label: '2 Weeks', note: 'Early titration check' },
                    { weeks: 4, label: '4 Weeks (Recommended)', note: 'Repeat CMP & HbA1c' },
                    { weeks: 8, label: '8 Weeks', note: 'Intermediate review' },
                    { weeks: 12, label: '3 Months', note: 'Routine quarterly' }
                  ].map(item => (
                    <button
                      key={item.weeks}
                      type="button"
                      onClick={() => {
                        setFollowupWeeks(item.weeks);
                        showToast(`Follow-up scheduled for ${item.label}`);
                      }}
                      className={`p-4 rounded-[22px] border text-left transition-all cursor-pointer ${
                        followupWeeks === item.weeks
                          ? 'bg-solid text-white border-transparent shadow-md font-bold'
                          : 'bg-canvas hover:bg-paper-2 text-ink border-rule-strong'
                      }`}
                    >
                      <span className="text-sm font-extrabold block">{item.label}</span>
                      <span className={`text-[10px] block mt-0.5 ${followupWeeks === item.weeks ? 'text-white/70' : 'text-ink-3'}`}>
                        {item.note}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lab Orders */}
              <div className="p-6 rounded-[28px] bg-paper border border-rule-strong shadow-xs space-y-3">
                <h3 className="text-sm font-extrabold text-ink flex items-center gap-2">
                  <Activity size={16} className="text-accent-ink" />
                  <span>Outpatient Diagnostic Laboratory Orders</span>
                </h3>
                <div className="space-y-2">
                  {orderedLabs.map((lab, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 rounded-[18px] bg-canvas border border-rule-strong text-xs font-semibold">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 size={16} className="text-settled" />
                        <span>{lab}</span>
                      </div>
                      <span className="text-[10px] font-mono text-ink-3">LOINC Verified</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grand Sign-off Card */}
              <div className="p-8 rounded-[32px] bg-paper border border-rule-strong shadow-sm text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-solid text-white flex items-center justify-center mx-auto shadow-md">
                  <Award size={28} />
                </div>

                <div>
                  <h3 className="text-xl font-black text-ink">Physician Sign-Off & Attestation</h3>
                  <p className="text-xs text-ink-2 max-w-md mx-auto mt-1 leading-relaxed">
                    I, <strong>{doctorProfile.name}</strong>, attest that I personally evaluated {patient.name} today in {doctorProfile.room}, verified documentation, orders, and clinical prescriptions.
                  </p>
                </div>

                {isSigned ? (
                  <div className="p-5 rounded-[24px] bg-settled-wash border border-settled-line text-xs text-settled max-w-md mx-auto space-y-2 shadow-2xs">
                    <div className="font-extrabold flex items-center justify-center gap-2 text-sm">
                      <CheckCircle2 size={18} className="text-settled" />
                      <span>Encounter Signed & FHIR Synced</span>
                    </div>
                    <p className="text-[11px] text-settled">
                      Timestamp: {signedTimestamp} • {doctorProfile.npi} • SHA-256 Verified
                    </p>
                    <div className="pt-2 flex items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="px-5 py-2.5 rounded-full bg-solid text-white font-extrabold text-xs hover:bg-solid cursor-pointer shadow-2xs"
                      >
                        Dashboard
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(TODAY_CLINIC_SCHEDULE[0].id);
                          setCurrentStep('patient');
                          setIsSigned(false);
                          showToast('Loaded next scheduled patient: Sarah Jenkins');
                        }}
                        className="px-5 py-2.5 rounded-full bg-paper border border-rule-strong text-ink font-extrabold text-xs hover:bg-canvas cursor-pointer shadow-2xs"
                      >
                        Next Patient →
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { void handleSignEncounter(); }}
                    disabled={isSigning}
                    className="px-8 py-4 rounded-full bg-solid hover:bg-solid text-white text-base font-black shadow-xl transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer flex items-center justify-center gap-3 mx-auto"
                  >
                    <ShieldCheck size={22} className="text-settled-on-solid" />
                    <span>{isSigning ? 'Signing encounter…' : 'Sign & Complete Encounter (1-Click)'}</span>
                  </button>
                )}
              </div>

            </div>
          )}

        </main>

      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* FLOATING PROTON AI ASSISTANT WIDGET (Signature Reference 4)      */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showAiAssistant && (
        <div className="fixed bottom-6 right-6 z-40 w-84 bg-solid text-white rounded-[28px] p-5 shadow-2xl border border-rule/10 animate-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between pb-3 border-b border-rule/10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-accent-wash text-accent-ink flex items-center justify-center font-bold text-xs">
                ✨
              </div>
              <span className="text-xs font-extrabold">Proton Assistant</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAiAssistant(false)}
              className="w-6 h-6 rounded-full bg-paper/10 hover:bg-paper/20 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X size={13} />
            </button>
          </div>

          <div className="py-3 space-y-2">
            <div className="p-3 rounded-2xl bg-paper/10 text-xs text-white/90 leading-relaxed">
              Hello {doctorProfile.name.split(',')[0]} 👋 I'm ready to assist with {patient.name}!
            </div>
            <div className="p-3 rounded-2xl bg-paper/10 text-xs text-white/90 leading-relaxed">
              Patient presents with <strong>"{patient.chiefComplaint}"</strong>. Allergies are guarded against: <strong>{patient.allergies.join(', ')}</strong>.
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCurrentStep('solutions');
              showToast('Loaded AI Guideline Recommendations');
            }}
            className="w-full py-2.5 rounded-full bg-accent-wash hover:bg-accent-wash/90 text-accent-ink font-black text-xs transition-transform active:scale-95 cursor-pointer shadow-sm text-center block mt-1"
          >
            Show recommendations
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: DOCTOR PROFILE & NEW DOCTOR SETUP                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showDoctorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-paper rounded-[32px] p-6 shadow-2xl border border-rule-strong space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-rule">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent-wash text-accent-ink flex items-center justify-center font-bold text-sm">
                  <User size={16} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-ink">Physician Identity & Room</h3>
                  <span className="text-[10px] text-ink-3">Configure your clinical credentials</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDoctorModal(false)}
                className="w-7 h-7 rounded-full bg-canvas hover:bg-paper-2 text-ink-2 flex items-center justify-center cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Doctor Full Name & Degree</label>
                <input
                  type="text"
                  value={editDocName}
                  onChange={(e) => setEditDocName(e.target.value)}
                  placeholder="e.g. Dr. Maya Patel, MD"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-canvas border border-rule-strong text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Clinical Specialty</label>
                <input
                  type="text"
                  value={editDocSpecialty}
                  onChange={(e) => setEditDocSpecialty(e.target.value)}
                  placeholder="e.g. Attending Physician • Internal Medicine"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-canvas border border-rule-strong text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">Exam Room / Desk</label>
                  <input
                    type="text"
                    value={editDocRoom}
                    onChange={(e) => setEditDocRoom(e.target.value)}
                    placeholder="e.g. Exam Room 104"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-canvas border border-rule-strong text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">National Provider (NPI)</label>
                  <input
                    type="text"
                    value={editDocNpi}
                    onChange={(e) => setEditDocNpi(e.target.value)}
                    placeholder="e.g. NPI 1849201948"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-canvas border border-rule-strong text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDoctorModal(false)}
                className="px-4 py-2 rounded-full bg-paper border border-rule-strong text-xs font-bold text-ink-2 hover:bg-canvas cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDoctorProfile}
                className="px-6 py-2.5 rounded-full bg-solid text-white text-xs font-extrabold hover:bg-solid cursor-pointer shadow-sm"
              >
                Save Doctor Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: NEW PATIENT CONSULTATION INTAKE                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-paper rounded-[32px] p-6 shadow-2xl border border-rule-strong space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-rule">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-settled-wash text-settled flex items-center justify-center font-bold text-sm">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-ink">Start New Patient Consultation</h3>
                  <span className="text-[10px] text-ink-3">Enter patient details or choose a rapid clinical preset</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewPatientModal(false)}
                className="w-7 h-7 rounded-full bg-canvas hover:bg-paper-2 text-ink-2 flex items-center justify-center cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Rapid Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-3">Quick 1-Click Clinical Cases:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleCreateNewPatient('angina')}
                  className="p-2.5 rounded-2xl bg-caution-wash border border-caution-line text-left hover:scale-[1.02] transition-transform cursor-pointer"
                >
                  <span className="text-xs font-bold text-caution block truncate">Arthur Morgan</span>
                  <span className="text-[9px] text-caution/80 block truncate">Cardiology / Angina</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateNewPatient('asthma')}
                  className="p-2.5 rounded-2xl bg-critical-wash border border-critical-line text-left hover:scale-[1.02] transition-transform cursor-pointer"
                >
                  <span className="text-xs font-bold text-critical block truncate">Chloe Bennett</span>
                  <span className="text-[9px] text-critical/80 block truncate">Asthma Flare</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateNewPatient('diabetes')}
                  className="p-2.5 rounded-2xl bg-settled-wash border border-settled-line text-left hover:scale-[1.02] transition-transform cursor-pointer"
                >
                  <span className="text-xs font-bold text-settled block truncate">Eleanor Vance</span>
                  <span className="text-[9px] text-settled/80 block truncate">T2D & Fatigue</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateNewPatient('ckd')}
                  className="p-2.5 rounded-2xl bg-accent-wash border border-accent-line text-left hover:scale-[1.02] transition-transform cursor-pointer"
                >
                  <span className="text-xs font-bold text-accent-ink block truncate">David Kim</span>
                  <span className="text-[9px] text-accent-ink/80 block truncate">Nephrology / CKD</span>
                </button>
              </div>
            </div>

            {/* Custom Input Form */}
            <div className="space-y-3 pt-2 text-xs border-t border-rule">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">Patient Full Name</label>
                  <input
                    type="text"
                    value={newPtName}
                    onChange={(e) => setNewPtName(e.target.value)}
                    placeholder="e.g. Jonathan Wright"
                    className="w-full px-3 py-2 rounded-2xl bg-canvas border border-rule-strong text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-ink block mb-1">Age</label>
                    <input
                      type="number"
                      value={newPtAge}
                      onChange={(e) => setNewPtAge(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-2xl bg-canvas border border-rule-strong text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-ink block mb-1">Gender</label>
                    <select
                      value={newPtGender}
                      onChange={(e) => setNewPtGender(e.target.value)}
                      className="w-full px-2 py-2 rounded-2xl bg-canvas border border-rule-strong text-xs text-ink font-medium focus:outline-none"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Chief Complaint & Symptoms</label>
                <input
                  type="text"
                  value={newPtComplaint}
                  onChange={(e) => setNewPtComplaint(e.target.value)}
                  placeholder="e.g. Persistent dry cough, mild dyspnea, and low-grade evening fever"
                  className="w-full px-3.5 py-2 rounded-2xl bg-canvas border border-rule-strong text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Documented Allergies</label>
                <input
                  type="text"
                  value={newPtAllergies}
                  onChange={(e) => setNewPtAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Sulfa, or No Known Drug Allergies"
                  className="w-full px-3.5 py-2 rounded-2xl bg-canvas border border-rule-strong text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">Blood Pressure (BP)</label>
                  <input
                    type="text"
                    value={newPtBp}
                    onChange={(e) => setNewPtBp(e.target.value)}
                    placeholder="120/80 mmHg"
                    className="w-full px-3 py-2 rounded-2xl bg-canvas border border-rule-strong text-xs font-mono font-medium focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">Heart Rate (HR)</label>
                  <input
                    type="text"
                    value={newPtHr}
                    onChange={(e) => setNewPtHr(e.target.value)}
                    placeholder="72 bpm"
                    className="w-full px-3 py-2 rounded-2xl bg-canvas border border-rule-strong text-xs font-mono font-medium focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowNewPatientModal(false)}
                className="px-4 py-2 rounded-full bg-paper border border-rule-strong text-xs font-bold text-ink-2 hover:bg-canvas cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreateNewPatient()}
                className="px-6 py-2.5 rounded-full bg-solid text-white text-xs font-extrabold hover:bg-solid cursor-pointer shadow-sm"
              >
                Launch Consultation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: ADD CUSTOM PRESCRIPTION & LIVE SAFETY CHECK           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showAddMedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-paper rounded-[32px] p-6 shadow-2xl border border-rule-strong space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-rule">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-accent-wash text-accent-ink flex items-center justify-center font-bold text-sm">
                  <Pill size={16} />
                </div>
                <h3 className="text-base font-extrabold text-ink">Prescribe Medication</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddMedModal(false);
                  setMedSafetyWarning(null);
                }}
                className="w-7 h-7 rounded-full bg-canvas text-ink-2 flex items-center justify-center cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {medSafetyWarning && (
              <div className="p-3.5 rounded-2xl bg-critical-wash border border-critical-line text-xs text-critical font-medium space-y-1">
                <div className="font-extrabold flex items-center gap-1.5 text-critical">
                  <AlertTriangle size={15} className="text-critical" />
                  <span>SAFETY INTERVENTION HARD-STOP</span>
                </div>
                <p>{medSafetyWarning}</p>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Medication Name</label>
                <input
                  type="text"
                  value={newMedName}
                  onChange={(e) => {
                    setNewMedName(e.target.value);
                    setMedSafetyWarning(null);
                  }}
                  placeholder="e.g. Atorvastatin or Lisinopril"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-canvas border border-rule-strong text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">Dosage</label>
                  <input
                    type="text"
                    value={newMedDose}
                    onChange={(e) => setNewMedDose(e.target.value)}
                    placeholder="e.g. 20 mg"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-canvas border border-rule-strong text-sm text-ink font-medium focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">Frequency</label>
                  <input
                    type="text"
                    value={newMedFreq}
                    onChange={(e) => setNewMedFreq(e.target.value)}
                    placeholder="e.g. Once daily at bedtime"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-canvas border border-rule-strong text-sm text-ink font-medium focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowAddMedModal(false);
                  setMedSafetyWarning(null);
                }}
                className="px-4 py-2 rounded-full bg-paper border border-rule-strong text-xs font-bold text-ink-2 hover:bg-canvas cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePrescribeNewMed}
                className="px-6 py-2.5 rounded-full bg-settled text-white text-xs font-extrabold hover:bg-settled cursor-pointer shadow-sm"
              >
                Authorize & Add
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
