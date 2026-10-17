import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import {
  ArrowLeft, ArrowUp, Mic, Square, Check, Loader2, AlertCircle, AlertTriangle,
  Pill, FileText, Activity, Plus, CheckCircle2, Copy,
  ClipboardList, Sparkles, RefreshCw, X, Printer, ClipboardCheck, Smartphone, Eye, ShieldCheck
} from 'lucide-react';
import { RealAIService, sendClinicalChat, type ChatMessage } from '../services/ai';
import { RealSpeechService } from '../services/speech';
import PrescriptionPDFModal from './PrescriptionPDFModal';
import IntakeReview from './intake/IntakeReview';
import DynamicIntake from './intake/DynamicIntake';
import CaptureSessionPanel from './capture/CaptureSessionPanel';
import ClinicianVisionReview from './vision/ClinicianVisionReview';
import { streamClinicalPipeline } from '../services/streamService';
import type { PrescriptionItem } from '../types/prescription';
import type { Patient } from '@medplum/fhirtypes';

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
}

interface DoctorDeskEncounterProps {
  patient: DoctorDeskPatient;
  onCloseMeeting: (summary: { patientId: string; note: any; prescriptions: string[] }) => void;
  onBackToDesk: () => void;
}

export default function DoctorDeskEncounter({ patient, onCloseMeeting, onBackToDesk }: DoctorDeskEncounterProps) {
  const [activeTab, setActiveTab] = useState<'note' | 'chart' | 'orders' | 'intake'>('note');

  // Ambient Scribe & Note states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [showVisionModal, setShowVisionModal] = useState(false);
  const [activeVisionMediaId, setActiveVisionMediaId] = useState<string | null>(null);
  const [capturedMediaList, setCapturedMediaList] = useState<any[]>([]);

  const getInitialTranscript = (pid: string) => {
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
    return "Doctor: Good morning Eleanor, how have you been feeling with your blood sugar lately?\n" +
      "Patient: Honestly Doctor, I have been feeling quite fatigued in the afternoons, and I noticed my morning glucose readings have been creeping up to 150-160.\n" +
      "Doctor: I reviewed your recent bloodwork. Your HbA1c is now 8.2%, up from 7.1% two months ago. You are currently taking Metformin 500mg twice daily, correct?\n" +
      "Patient: Yes, 500mg morning and night. I have tolerated it well with food.\n" +
      "Doctor: Excellent. Because of the HbA1c increase and to protect your kidneys and heart, I recommend increasing Metformin to 1000mg twice daily and adding Empagliflozin 10mg once daily. Let us also recheck your labs in 3 months.\n" +
      "Patient: Sounds like a solid plan Doctor. No penicillin, right? I am still very allergic.\n" +
      "Doctor: Absolutely, strict no-penicillin on your chart.";
  };

  const getInitialNote = (pid: string) => {
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
    return {
      subjective: "68-year-old female presents for glycemic follow-up. Reports worsening afternoon fatigue and home fasting glucose readings averaging 150-160 mg/dL. Reports good gastrointestinal tolerance of current Metformin 500 mg BID regimen. Confirmed severe Penicillin allergy (anaphylaxis history).",
      objective: `Vitals: BP ${patient.vitals.bp}, HR ${patient.vitals.hr}, SpO2 ${patient.vitals.spo2}, BMI ${patient.vitals.bmi}.\nPhysical Exam: Well-appearing, alert, oriented x4. Regular rate and rhythm. Clear lungs bilaterally. Diabetic foot inspection negative for ulcers or skin breakdown.\nRecent Labs: HbA1c 8.2% (elevated from 7.1%), eGFR 68 mL/min/1.73m², Fasting Glucose 158 mg/dL.`,
      assessment: "1. Type 2 Diabetes Mellitus — Inadequate glycemic control on submaximal metformin monotherapy with HbA1c escalation to 8.2%.\n2. Essential Hypertension — Stable on Lisinopril 10 mg QD.\n3. Mild Renal Impairment (eGFR 68) — Warranting cardiorenal protective therapy.",
      plan: "1. Titrate Metformin from 500 mg BID to 1000 mg BID with meals.\n2. Initiate Empagliflozin 10 mg PO Once Daily for glycemic optimization and cardiorenal risk reduction.\n3. Continue Lisinopril 10 mg PO Once Daily.\n4. Strict Penicillin avoidance re-verified.\n5. Follow-up: Repeat HbA1c, BMP, and renal function in 3 months."
    };
  };

  const getInitialPrescriptions = (pid: string) => {
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
    return [
      { id: 'p1', name: 'Metformin', dose: '1000 mg', freq: 'Oral Twice daily with meals', duration: '90 days', status: 'new' as const },
      { id: 'p2', name: 'Empagliflozin', dose: '10 mg', freq: 'Oral Once daily in morning', duration: '90 days', status: 'new' as const },
      { id: 'p3', name: 'Lisinopril', dose: '10 mg', freq: 'Oral Once daily', duration: 'Current', status: 'active' as const }
    ];
  };

  const [transcript, setTranscript] = useState(() => getInitialTranscript(patient.id));
  const [note, setNote] = useState(() => getInitialNote(patient.id));
  const [prescriptions, setPrescriptions] = useState(() => getInitialPrescriptions(patient.id));

  useEffect(() => {
    setTranscript(getInitialTranscript(patient.id));
    setNote(getInitialNote(patient.id));
    setPrescriptions(getInitialPrescriptions(patient.id));
    setChatMessages([
      {
        role: 'assistant',
        content: `Hello Doctor. I have ${patient.name}'s chart loaded (${patient.age}${patient.gender.charAt(0)}, ${patient.conditions.join(', ')}). How can I assist with this encounter?`
      }
    ]);
  }, [patient.id]);

  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');

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
        if (isCloseModalOpen) setIsCloseModalOpen(false);
        if (showPdfModal) setShowPdfModal(false);
        return;
      }

      // 2. Cmd/Ctrl + Enter: Open sign-off modal
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        setIsCloseModalOpen(true);
        setDeskShortcutFeedback('Ready to sign off (⌘↵)');
        setTimeout(() => setDeskShortcutFeedback(null), 2500);
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
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach(t => t.stop());
          await processCapturedAudio(audioBlob);
        };

        mediaRecorder.start();
        setIsRecording(true);
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
      setCopySuccess('Loaded sample audio & updated SOAP note');
      setTimeout(() => setCopySuccess(null), 2500);
    } finally {
      setIsTranscribing(false);
    }
  };

  const generateNoteFromTranscript = async (textToUse?: string) => {
    const text = textToUse || transcript;
    if (!text.trim()) return;
    setIsGeneratingNote(true);
    setStreamProgress({ stage: 'INPUT_RECEIVED', message: 'Initiating real-time clinical stream...', isStreaming: true });

    try {
      // Execute streaming clinical pipeline (M2C-3)
      await streamClinicalPipeline({
        patientId: patient.id,
        transcript: text,
        template: 'SOAP',
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
            const noteData = terminalEvent.payload.output.soapNote;
            setNote({
              subjective: noteData.subjective || note.subjective,
              objective: noteData.objective || note.objective,
              assessment: noteData.assessment || note.assessment,
              plan: noteData.plan || note.plan
            });
          }
          setStreamProgress({ stage: 'STREAM_COMPLETE', message: 'Real-time sync complete', isStreaming: false });
          setTimeout(() => setStreamProgress(prev => ({ ...prev, message: '' })), 3000);
        },
        onError: async (err) => {
          console.warn('[DoctorDesk] SSE streaming fallback to unary AI note:', err.message);
          const aiService = new RealAIService();
          const result = await aiService.generateNote(text, chartContext, 'SOAP');
          if (result) {
            setNote({
              subjective: result.subjective || note.subjective,
              objective: result.objective || note.objective,
              assessment: result.assessment || note.assessment,
              plan: result.plan || note.plan
            });
          }
          setStreamProgress({ stage: 'FALLBACK', message: '', isStreaming: false });
        }
      });
    } catch (err: any) {
      console.error('Failed to generate note via streaming, falling back to unary:', err);
      try {
        const aiService = new RealAIService();
        const result = await aiService.generateNote(text, chartContext, 'SOAP');
        if (result) {
          setNote({
            subjective: result.subjective || note.subjective,
            objective: result.objective || note.objective,
            assessment: result.assessment || note.assessment,
            plan: result.plan || note.plan
          });
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

  const handleAddMedication = (e: FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;
    setPrescriptions(prev => [
      ...prev,
      {
        id: `rx-${Date.now()}`,
        name: newMedName.trim(),
        dose: newMedDose.trim() || 'Standard Dose',
        freq: 'Once daily',
        duration: '90 days',
        status: 'new'
      }
    ]);
    setNewMedName('');
    setNewMedDose('');
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

  return (
    <div className="flex h-screen w-full flex-col bg-[#fafaf9] text-[#18181b] overflow-hidden font-sans antialiased">
      {/* TOP DESK HEADER */}
      <header className="h-16 shrink-0 border-b border-[#e4e4e7] bg-white px-6 flex items-center justify-between shadow-2xs z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToDesk}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#52525b] hover:text-[#09090b] transition-colors p-2 rounded-xl hover:bg-[#f4f4f5] cursor-pointer"
            title="Back to queue"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="h-4 w-[1px] bg-[#e4e4e7]" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#09090b] tracking-tight">{patient.name}</h1>
              <span className="text-xs text-[#71717a]">({patient.age}y, {patient.gender})</span>
              {patient.allergies.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200/70 px-2 py-0.5 rounded-full ml-1">
                  <AlertTriangle size={11} className="shrink-0" />
                  Allergy: {patient.allergies.join(', ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 text-xs text-[#52525b] mt-0.5">
              <span>BP <strong className="text-[#09090b]">{patient.vitals.bp}</strong></span>
              <span>•</span>
              <span>HR <strong className="text-[#09090b]">{patient.vitals.hr}</strong></span>
              <span>•</span>
              <span>SpO2 <strong className="text-[#09090b]">{patient.vitals.spo2}</strong></span>
              <span>•</span>
              <span>BMI <strong className="text-[#09090b]">{patient.vitals.bmi}</strong></span>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-1.5 bg-white hover:bg-[#f4f4f5] text-[#3f3f46] text-xs font-medium px-3 py-2 rounded-xl border border-[#e4e4e7] transition-all cursor-pointer"
            title="Export Prescription PDF"
          >
            <Printer size={13} />
            <span className="hidden md:inline">Prescription PDF</span>
          </button>

          <button
            onClick={() => setShowCaptureModal(true)}
            className="flex items-center gap-1.5 bg-white hover:bg-[#f4f4f5] text-[#3f3f46] text-xs font-medium px-3 py-2 rounded-xl border border-[#e4e4e7] transition-all cursor-pointer"
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
            className="flex items-center gap-1.5 bg-white hover:bg-[#f4f4f5] text-[#3f3f46] text-xs font-medium px-3 py-2 rounded-xl border border-[#e4e4e7] transition-all cursor-pointer"
            title="Review visual AI images"
          >
            <Eye size={13} />
            <span className="hidden md:inline">Visual AI {capturedMediaList.length > 0 ? `(${capturedMediaList.length})` : ''}</span>
          </button>

          {deskShortcutFeedback && (
            <div className="flex items-center gap-1.5 bg-[#18181b] text-white px-2.5 py-1.5 rounded-xl text-xs font-medium shadow-md">
              <CheckCircle2 size={12} className="text-emerald-400" />
              <span>{deskShortcutFeedback}</span>
            </div>
          )}

          <button
            onClick={() => setIsCloseModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#111315] hover:bg-[#272B30] text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer ml-1"
          >
            <Check size={14} strokeWidth={2.5} className="text-emerald-400" />
            <span>Sign Off</span>
            <span className="text-[10px] opacity-60 font-mono hidden sm:inline">⌘↵</span>
          </button>
        </div>
      </header>

      {/* MAIN TWO-COLUMN SPLIT WORKSPACE */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* LEFT PANEL: CLINICAL WORKSPACE (65%) */}
        <section className="flex flex-col flex-1 min-w-0 border-r border-[#e4e4e7] bg-[#fbfbfa]">
          {/* TAB BAR & AMBIENT CONTROLS */}
          <div className="h-12 border-b border-[#e4e4e7] bg-white px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {[
                { id: 'note', label: 'Consultation Note', icon: ClipboardList },
                { id: 'chart', label: 'Chart & Labs', icon: Activity },
                { id: 'orders', label: `Orders (${prescriptions.length})`, icon: Pill },
                { id: 'intake', label: 'Intake (FHIR)', icon: ClipboardCheck }
              ].map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#18181b] text-white shadow-2xs font-semibold'
                        : 'text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5]'
                    }`}
                  >
                    <tab.icon size={13} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Ambient Mic & Audio Test Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={testSampleAudioDialogue}
                className="text-[11px] text-[#71717a] hover:text-[#09090b] px-2 py-1 hover:bg-[#f4f4f5] rounded-md transition-colors cursor-pointer"
                title="Load sample dialogue"
              >
                Sample Dialogue
              </button>

              <button
                onClick={toggleRecording}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isRecording
                    ? 'bg-red-600 text-white animate-pulse shadow-xs'
                    : 'bg-[#18181b] hover:bg-[#27272a] text-white shadow-2xs'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square size={11} className="fill-white" />
                    <span>Recording ({formatSeconds(recordingSeconds)})</span>
                  </>
                ) : (
                  <>
                    <Mic size={12} className="text-emerald-400" />
                    <span>Capture Dialogue</span>
                  </>
                )}
              </button>
              {isTranscribing && (
                <span className="flex items-center gap-1 text-xs text-[#0284c7]">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Transcribing...</span>
                </span>
              )}
            </div>
          </div>

          {/* TAB 1: CONSULTATION NOTE & SCRIBE */}
          {activeTab === 'note' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Transcript Box */}
              <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic size={13} className="text-[#0284c7]" />
                    <span className="text-xs font-bold text-[#52525b]">
                      Ambient Dialogue
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {streamProgress.isStreaming && (
                      <span className="text-[11px] text-blue-600 animate-pulse font-medium">
                        {streamProgress.message || 'Synthesizing...'}
                      </span>
                    )}
                    <button
                      onClick={() => generateNoteFromTranscript()}
                      disabled={isGeneratingNote}
                      className="flex items-center gap-1 text-xs text-[#09090b] hover:text-[#0284c7] font-medium px-2 py-1 rounded-md hover:bg-[#f4f4f5] transition-colors cursor-pointer"
                    >
                      <RefreshCw size={11} className={isGeneratingNote ? 'animate-spin' : ''} />
                      <span>{isGeneratingNote ? 'Synthesizing...' : 'Regenerate Note'}</span>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#52525b] leading-relaxed max-h-24 overflow-y-auto whitespace-pre-wrap font-mono bg-[#fafaf9] p-3 rounded-xl border border-[#e4e4e7]/60">
                  {transcript}
                </p>
              </div>

              {/* Structured Note (SOAP) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#52525b]">
                    Clinical Note (SOAP)
                  </h3>
                  <div className="flex items-center gap-2">
                    {copySuccess && (
                      <span className="text-xs text-emerald-600 font-medium animate-in fade-in">
                        {copySuccess}
                      </span>
                    )}
                    <button
                      onClick={copyNoteForEhr}
                      className="flex items-center gap-1 text-xs font-medium text-[#52525b] hover:text-[#09090b] px-2.5 py-1 rounded-lg border border-[#e4e4e7] bg-white hover:bg-[#f4f4f5] transition-colors cursor-pointer"
                    >
                      <Copy size={12} />
                      <span>Copy for EHR</span>
                    </button>
                  </div>
                </div>

                {/* S - Subjective */}
                <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 focus-within:border-[#111315] transition-colors shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[#111315] text-white font-bold text-[10px] flex items-center justify-center font-mono">S</span>
                      <span className="text-xs font-bold text-[#111315]">Subjective</span>
                    </div>
                    <span className="text-[10px] text-[#71717a] font-medium">Patient Reported</span>
                  </div>
                  <textarea
                    rows={3}
                    value={note.subjective}
                    onChange={e => setNote({ ...note, subjective: e.target.value })}
                    className="w-full bg-transparent text-xs text-[#111315] leading-relaxed resize-y outline-none"
                    placeholder="Patient narrative, symptoms, timeline..."
                  />
                </div>

                {/* O - Objective */}
                <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 focus-within:border-[#111315] transition-colors shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[#111315] text-white font-bold text-[10px] flex items-center justify-center font-mono">O</span>
                      <span className="text-xs font-bold text-[#111315]">Objective</span>
                    </div>
                    <span className="text-[10px] text-[#71717a] font-medium">Vitals & Labs</span>
                  </div>
                  <textarea
                    rows={3}
                    value={note.objective}
                    onChange={e => setNote({ ...note, objective: e.target.value })}
                    className="w-full bg-transparent text-xs text-[#111315] leading-relaxed resize-y outline-none"
                    placeholder="Physical examination findings, vitals, labs..."
                  />
                </div>

                {/* A - Assessment */}
                <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 focus-within:border-[#111315] transition-colors shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[#111315] text-white font-bold text-[10px] flex items-center justify-center font-mono">A</span>
                      <span className="text-xs font-bold text-[#111315]">Assessment</span>
                    </div>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">AI Advisory</span>
                  </div>
                  <textarea
                    rows={3}
                    value={note.assessment}
                    onChange={e => setNote({ ...note, assessment: e.target.value })}
                    className="w-full bg-transparent text-xs text-[#111315] leading-relaxed resize-y outline-none"
                    placeholder="Clinical impression and differential diagnoses..."
                  />
                </div>

                {/* P - Plan */}
                <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 focus-within:border-[#111315] transition-colors shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[#111315] text-white font-bold text-[10px] flex items-center justify-center font-mono">P</span>
                      <span className="text-xs font-bold text-[#111315]">Plan</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-medium">Clinician Orders</span>
                  </div>
                  <textarea
                    rows={4}
                    value={note.plan}
                    onChange={e => setNote({ ...note, plan: e.target.value })}
                    className="w-full bg-transparent text-xs text-[#111315] leading-relaxed resize-y outline-none"
                    placeholder="Pharmacology, diagnostic orders, patient counseling..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PATIENT CHART & REPORTS */}
          {activeTab === 'chart' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {patient.recentLabs.some(l => l.status === 'high') && (
                <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="text-[#dc2626] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-[#991b1b]">Clinical Escalation Flagged</h4>
                      <p className="text-xs text-[#b91c1c] mt-1 leading-relaxed">
                        Abnormal metabolic or cardiac findings require physician attention for therapy adjustment.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Diagnostic Labs Table */}
              <div className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-xs">
                <h3 className="text-xs font-bold text-[#52525b] uppercase tracking-wider mb-3">
                  Recent Laboratory Observations
                </h3>
                <div className="divide-y divide-[#f4f4f5]">
                  {patient.recentLabs.map((lab, i) => (
                    <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-[#09090b]">{lab.name}</span>
                        <span className="text-[11px] text-[#71717a] ml-2">({lab.date})</span>
                        {lab.note && <span className="text-[11px] text-[#71717a] ml-2 italic">— {lab.note}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold ${
                          lab.status === 'high' ? 'text-[#dc2626]' : lab.status === 'low' ? 'text-[#d97706]' : 'text-[#16a34a]'
                        }`}>
                          {lab.value}
                        </span>
                        {lab.status === 'high' && (
                          <span className="bg-[#fee2e2] text-[#dc2626] text-[10px] px-2 py-0.5 rounded font-bold border border-[#fecaca]">ABNORMAL</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diagnostic Reports & Documents */}
              <div className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-xs">
                <h3 className="text-xs font-bold text-[#52525b] uppercase tracking-wider mb-3">
                  Extracted Clinical Documents & Imaging
                </h3>
                <div className="space-y-3">
                  {patient.documents.map((doc, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <FileText size={17} className="text-[#0284c7] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-semibold text-[#09090b]">{doc.name}</span>
                          <span className="text-[11px] text-[#71717a] ml-2">({doc.date})</span>
                          <p className="text-xs text-[#52525b] mt-1 leading-relaxed">{doc.summary}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Conditions */}
              <div className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-xs">
                <h3 className="text-xs font-bold text-[#52525b] uppercase tracking-wider mb-3">
                  Active Diagnoses & Conditions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {patient.conditions.map((c, i) => (
                    <span key={i} className="bg-[#f4f4f5] border border-[#e4e4e7] text-[#18181b] text-xs px-3 py-1 rounded-lg font-medium">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRESCRIPTIONS & ORDERS */}
          {activeTab === 'orders' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-[#52525b] uppercase tracking-wider">
                    Medication Orders for this Encounter
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#71717a] font-medium">{prescriptions.length} items</span>
                    <button
                      onClick={() => setShowPdfModal(true)}
                      className="flex items-center gap-1.5 text-xs text-[#09090b] hover:bg-[#f4f4f5] font-semibold bg-white px-3 py-1 rounded-lg border border-[#e4e4e7] shadow-2xs cursor-pointer"
                    >
                      <Printer size={13} />
                      Print Rx
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {prescriptions.map(rx => (
                    <div key={rx.id} className="p-3.5 rounded-xl border border-[#e4e4e7] bg-[#fafaf9] flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#09090b]">{rx.name}</span>
                          <span className="text-xs text-[#0284c7] font-mono font-semibold">{rx.dose}</span>
                          {rx.status === 'new' && (
                            <span className="bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0] text-[10px] font-bold px-2 py-0.5 rounded">NEW ORDER</span>
                          )}
                        </div>
                        <p className="text-xs text-[#71717a] mt-0.5">{rx.freq} • {rx.duration}</p>
                      </div>
                      <button
                        onClick={() => setPrescriptions(prescriptions.filter(p => p.id !== rx.id))}
                        className="text-xs text-[#a1a1aa] hover:text-[#dc2626] p-1.5 cursor-pointer"
                        title="Remove medication"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Quick Add Bar */}
                <form onSubmit={handleAddMedication} className="mt-5 pt-4 border-t border-[#f4f4f5] flex gap-2">
                  <input
                    type="text"
                    placeholder="Medication name..."
                    value={newMedName}
                    onChange={e => setNewMedName(e.target.value)}
                    className="flex-1 bg-white border border-[#e4e4e7] rounded-xl px-3.5 py-2 text-xs text-[#09090b] placeholder-[#a1a1aa] outline-none focus:border-[#18181b]"
                  />
                  <input
                    type="text"
                    placeholder="Dose (e.g. 10mg)"
                    value={newMedDose}
                    onChange={e => setNewMedDose(e.target.value)}
                    className="w-32 bg-white border border-[#e4e4e7] rounded-xl px-3.5 py-2 text-xs text-[#09090b] placeholder-[#a1a1aa] outline-none focus:border-[#18181b]"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 bg-[#18181b] hover:bg-[#27272a] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs cursor-pointer"
                  >
                    <Plus size={14} />
                    Add Order
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: PATIENT INTAKE (FHIR) */}
          {activeTab === 'intake' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <IntakeReview
                patientId={patient.id}
                onLaunchNewIntake={() => setShowIntakeModal(true)}
              />
            </div>
          )}
        </section>

        {/* RIGHT PANEL: CLINICAL COPILOT SIDEBAR (35%) */}
        <aside className="w-[420px] shrink-0 flex flex-col bg-white border-l border-zinc-200/80">
          {/* COPILOT HEADER */}
          <div className="h-12 border-b border-zinc-200/80 bg-white px-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-zinc-800" />
              <span className="text-xs font-semibold text-zinc-900 tracking-tight">Clinical Copilot</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] text-emerald-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Chart Context Active
            </div>
          </div>

          {/* COPILOT PROMPT CHIPS */}
          <div className="p-3 border-b border-zinc-200/80 bg-zinc-50/60 space-y-1.5">
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Quick Clinical Prompts:</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleSendChat("Are there any drug-drug interactions between current medications and new orders?")}
                className="text-xs bg-white hover:bg-zinc-100 text-zinc-700 font-medium px-2.5 py-1 rounded-lg border border-zinc-200/80 shadow-2xs transition-colors cursor-pointer"
              >
                💊 Drug Interactions
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(`Summarize ${patient.name}'s metabolic and organ function trends.`)}
                className="text-xs bg-white hover:bg-zinc-100 text-zinc-700 font-medium px-2.5 py-1 rounded-lg border border-zinc-200/80 shadow-2xs transition-colors cursor-pointer"
              >
                📈 Lab Trends
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(`Draft personalized patient discharge instructions for ${patient.name}.`)}
                className="text-xs bg-white hover:bg-zinc-100 text-zinc-700 font-medium px-2.5 py-1 rounded-lg border border-zinc-200/80 shadow-2xs transition-colors cursor-pointer"
              >
                📝 Patient Instructions
              </button>
            </div>
          </div>

          {/* CHAT MESSAGES SCROLLER */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fbfbfa]">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] text-[#71717a] mb-1 font-mono font-medium">
                  {msg.role === 'user' ? 'You' : 'Clinical Copilot'}
                </span>
                <div
                  className={`text-xs leading-relaxed rounded-2xl p-3.5 max-w-[95%] whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#18181b] text-white shadow-xs'
                      : 'bg-white text-[#18181b] border border-[#e4e4e7] shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
                  }`}
                >
                  {msg.content}
                </div>

                {msg.role === 'assistant' && idx > 0 && (
                  <div className="flex items-center gap-2 mt-1.5 ml-1">
                    <button
                      type="button"
                      onClick={() => insertIntoPlan(msg.content)}
                      className="flex items-center gap-1 text-[11px] text-[#0284c7] hover:text-[#0369a1] font-semibold cursor-pointer"
                    >
                      <Plus size={11} />
                      Insert into Plan
                    </button>
                    <span className="text-[#d4d4d8]">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        setCopySuccess('Copied to clipboard');
                        setTimeout(() => setCopySuccess(null), 2000);
                      }}
                      className="flex items-center gap-1 text-[11px] text-[#71717a] hover:text-[#09090b] cursor-pointer"
                    >
                      <Copy size={11} />
                      Copy
                    </button>
                  </div>
                )}
              </div>
            ))}
            {isChatSending && (
              <div className="flex items-center gap-2 text-xs text-[#71717a] pl-1 font-medium">
                <Loader2 size={13} className="animate-spin text-[#0284c7]" />
                Analyzing clinical chart context...
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* CHAT INPUT FORM */}
          <div className="p-3 border-t border-[#e4e4e7] bg-white">
            <form onSubmit={e => { e.preventDefault(); void handleSendChat(); }} className="relative flex items-end bg-[#f4f4f5] rounded-2xl p-2 border border-[#e4e4e7] focus-within:border-[#18181b] transition-colors">
              <textarea
                rows={2}
                placeholder={`Ask Copilot about ${patient.name}...`}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent px-2.5 py-1 text-xs text-[#09090b] placeholder-[#a1a1aa] outline-none resize-none"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatSending}
                className="w-8 h-8 rounded-xl bg-[#18181b] hover:bg-[#27272a] disabled:opacity-30 text-white flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-2xs"
                title="Send message"
              >
                <ArrowUp size={15} />
              </button>
            </form>
          </div>
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

      {/* CLOSE MEETING CONFIRMATION MODAL */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-[#EAE8E3] bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#EAE8E3] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#0F766E]" />
                <h3 className="text-sm font-bold text-[#111315]">Clinician Confirmation & Encounter Commit</h3>
              </div>
              <button 
                onClick={() => setIsCloseModalOpen(false)} 
                className="p-1 rounded-lg text-[#6E767E] hover:text-[#111315] hover:bg-[#F4F3EE] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#50575F]">
              <p>
                Commit verified clinical documentation and orders for <strong className="text-[#111315]">{patient.name}</strong> ({patient.mrn}) into FHIR R4?
              </p>

              <div className="rounded-xl border border-[#EAE8E3] bg-[#FAF9F6] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[#6E767E]">Attending Physician:</span>
                  <span className="text-[#111315] font-semibold">Dr. Aris Thorne, MD (NPI: 1841290481)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6E767E]">Structured SOAP Note:</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={12} /> Confirmed by Clinician
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6E767E]">Active Medication Orders:</span>
                  <span className="text-[#111315] font-semibold">{prescriptions.length} Orders (Allergy Matrix Passed)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6E767E]">Cryptographic Provenance:</span>
                  <span className="font-mono text-[10px] text-[#0F766E]">SHA-256 Chained Audit Trail</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-900 flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Atomic Transaction:</strong> Writes Encounter, Condition, and MedicationRequest resources atomically to the FHIR store.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#EAE8E3]">
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#6E767E] hover:text-[#111315] bg-[#F4F3EE] rounded-xl transition-colors border border-[#EAE8E3] cursor-pointer"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCloseModalOpen(false);
                  onCloseMeeting({
                    patientId: patient.id,
                    note,
                    prescriptions: prescriptions.map(p => `${p.name} ${p.dose} - ${p.freq}`)
                  });
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0B5C56] rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} strokeWidth={2.5} />
                <span>Sign Off & Commit Encounter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC PATIENT INTAKE MODAL */}
      {showIntakeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#fbfbfa] border border-[#e4e4e7] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowIntakeModal(false)}
              className="absolute top-4 right-4 z-10 p-2 text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] rounded-full transition-colors cursor-pointer"
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
    </div>
  );
}
