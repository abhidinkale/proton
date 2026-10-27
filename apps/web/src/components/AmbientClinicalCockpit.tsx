import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  Activity, Play, CheckCircle2, AlertTriangle, ShieldCheck,
  Sparkles, Stethoscope, Volume2, Lock, Loader2, Send, HelpCircle,
  ArrowRight, ChevronRight
} from 'lucide-react';
import { apiJson } from '../lib/api';
import { clinicApi } from '../lib/clinicApi';
import { authService } from '../services/auth';
import { LiveDot } from '../design-system/motion/primitives';
import ClinicalEvidenceInspectorModal, { type TraceableClaim } from './evidence/ClinicalEvidenceInspectorModal';

interface Utterance {
  id: string;
  speaker: string;
  speakerLabel: string;
  speakerRole: string;
  text: string;
  startMs: number;
  endMs: number;
  audioSnippetId: string;
  confidence: number;
}

interface DifferentialItem {
  rank: number;
  condition: string;
  icd10: string;
  snomed: string;
  probability: string;
  supportingEvidence: string[];
  evidenceCitation: string;
}

interface InvestigationItem {
  orderType: string;
  testName: string;
  loinc: string;
  cpt: string;
  urgency: string;
  clinicalRationale: string;
}

interface MedicationItem {
  name: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  rxnorm: string;
  indication: string;
}

/** Synthetic encounter transcript. Replaced by the live stream when capture is wired. */
const UTTERANCES: Utterance[] = [
  {
    id: 'utt-1',
    speaker: 'DOCTOR',
    speakerLabel: 'Dr. Eleanor Vance',
    speakerRole: 'physician',
    text: 'Good morning, Arthur. How has your breathing and blood sugar been since our last review?',
    startMs: 0,
    endMs: 4200,
    audioSnippetId: 'clip_0s_4s',
    confidence: 0.98
  },
  {
    id: 'utt-2',
    speaker: 'PATIENT',
    speakerLabel: 'Arthur Pendelton',
    speakerRole: 'patient',
    text: 'Doctor, for the past two weeks I have had this persistent dry cough and worsening shortness of breath when I walk up stairs. Also my ankles swell by evening.',
    startMs: 4600,
    endMs: 12800,
    audioSnippetId: 'clip_4s_12s',
    confidence: 0.97
  },
  {
    id: 'utt-3',
    speaker: 'DOCTOR',
    speakerLabel: 'Dr. Eleanor Vance',
    speakerRole: 'physician',
    text: 'I see. Are you experiencing any chest pain or palpitations? Have you checked your blood sugar at home?',
    startMs: 13200,
    endMs: 18500,
    audioSnippetId: 'clip_13s_18s',
    confidence: 0.99
  },
  {
    id: 'utt-4',
    speaker: 'PATIENT',
    speakerLabel: 'Arthur Pendelton',
    speakerRole: 'patient',
    text: 'No crushing chest pain, but some tight discomfort when coughing. Morning sugars have been high, between 185 and 210 despite taking my metformin.',
    startMs: 18900,
    endMs: 27400,
    audioSnippetId: 'clip_18s_27s',
    confidence: 0.96
  }
];

const WAVE_HEIGHTS = [40, 65, 30, 85, 95, 45, 70, 35, 90, 60, 80, 50, 75, 40, 95, 85, 30, 70, 60, 45, 80, 65, 90, 40];



const DEFAULT_TRACEABLE_CLAIMS: TraceableClaim[] = [
  {
    claimId: 'CLAIM-001',
    claimText: 'Type 2 Diabetes Mellitus with Suboptimal Glycemic Control is the primary working hypothesis.',
    verificationStatus: 'SUPPORTED',
    verificationNotes: 'Grounded in documented home fasting glucose 185-210 mg/dL.',
    linkedPatientFacts: [
      { fact_id: 'F-001', name: 'Home Glucose Readings', status: 'OBSERVED', span: 'Fasting glucose 185-210 mg/dL' }
    ],
    supportingPassage: 'For adults with Type 2 Diabetes not meeting individualized glycemic targets (HbA1c > 7.0-8.0%) on metformin monotherapy, add SGLT2 inhibitor or GLP-1 receptor agonist with proven cardiorenal benefit.',
    entrySignature: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d'
  },
  {
    claimId: 'CLAIM-002',
    claimText: 'SGLT2 inhibitor (Empagliflozin 10mg) is indicated for cardiorenal protection and glycemic control.',
    verificationStatus: 'SUPPORTED',
    verificationNotes: 'Directly supported by ADA 2026 Standards of Care (PMID: 38118032) and EMPA-REG OUTCOME trial.',
    supportingPassage: 'Patients with Type 2 diabetes and cardiovascular risk receiving empagliflozin had significantly lower rates of death from cardiovascular causes and heart failure hospitalization.',
    entrySignature: '3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c'
  },
  {
    claimId: 'CLAIM-003',
    claimText: 'High-risk intervention held: Invasive coronary catheterization is not indicated prior to non-invasive stress testing.',
    verificationStatus: 'SUPPORTED',
    verificationNotes: 'Treatment safety gate engaged: ordered 12-lead ECG and functional workup first.',
    entrySignature: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d'
  }
];

function Pane({
  header,
  footer,
  className = '',
  children
}: {
  header: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`proton-glass proton-specular flex min-h-0 flex-col overflow-hidden rounded-[24px] ${className}`}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.055] px-4 py-2.5">
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && (
        <div className="shrink-0 border-t border-black/[0.055] px-4 py-2.5">{footer}</div>
      )}
    </section>
  );
}

function probabilityPercent(value: string): number {
  const match = value.match(/(\d+)%/);
  return match ? Number(match[1]) : 0;
}

function urgencyLabel(value: string): string {
  if (value.includes('STAT')) return 'STAT';
  if (value.includes('SAMEDAY')) return 'Same day';
  return value.replaceAll('_', ' ').toLowerCase();
}

export default function AmbientClinicalCockpit({
  patient = { id: 'synthetic-001', name: 'Arthur Pendelton', age: 58, mrn: 'MRN-784920' },
  onBackToDesk,
  onSwitchMode
}: {
  patient?: any;
  onCloseMeeting?: () => void;
  onBackToDesk?: () => void;
  onSwitchMode?: (mode: 'guided' | 'desk') => void;
}) {
  const [activeAudioSnippet, setActiveAudioSnippet] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'agent' | 'soap'>('agent');
  const [isSigned, setIsSigned] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [attestationPayload, setAttestationPayload] = useState<any>(null);

  // Dynamically resolve clinician identity from authenticated session
  const currentUser = authService.getCurrentUser();
  const npiSignature = currentUser?.practitionerReference
    ? `NPI-${currentUser.practitionerReference.replace(/\D/g, '').padEnd(10, '0').slice(0, 10)}`
    : (currentUser?.id ? `NPI-${currentUser.id.replace(/\D/g, '').padEnd(10, '0').slice(0, 10)}` : 'NPI-1942058194');

  const [clinicalScores, setClinicalScores] = useState<any>({
    wellsPE: { score: 1.5, riskLevel: 'LOW-MODERATE (D-Dimer Indicated)' },
    curb65: { score: 1, mortalityRisk: 'LOW (Outpatient Management Appropriate)' }
  });

  const [cantMissEmergencies, setCantMissEmergencies] = useState<any[]>([
    {
      condition: 'Acute Coronary Syndrome / Atypical Angina',
      icd10: 'I21.9',
      rationale: 'Exertional dyspnea in diabetic adult with tight chest discomfort warrants 12-lead ECG and High-Sensitivity Troponin.'
    }
  ]);

  const [differential, setDifferential] = useState<DifferentialItem[]>([
    {
      rank: 1,
      condition: 'Type 2 Diabetes Mellitus with Suboptimal Glycemic Control',
      icd10: 'E11.65',
      snomed: '44054006',
      probability: 'HIGH (84%)',
      supportingEvidence: ['Home glucose readings 185-210 mg/dL', 'Reported polyuria & exertional fatigue'],
      evidenceCitation: 'ADA Standards of Care in Diabetes 2026 (PMID: 38118032)'
    },
    {
      rank: 2,
      condition: 'Early Decompensated Heart Failure (HFpEF) vs Lower Respiratory Infection',
      icd10: 'I50.9',
      snomed: '84114007',
      probability: 'MODERATE (38%)',
      supportingEvidence: ['Exertional dyspnea (NYHA Class II)', 'Bilateral evening ankle edema', 'Persistent cough'],
      evidenceCitation: '2024 AHA/ACC Guidelines for the Management of Heart Failure'
    }
  ]);

  const [investigations, setInvestigations] = useState<InvestigationItem[]>([
    {
      orderType: 'LABORATORY',
      testName: 'Hemoglobin A1c (HbA1c)',
      loinc: '4544-3',
      cpt: '83036',
      urgency: 'ROUTINE_SAMEDAY',
      clinicalRationale: 'Assess 90-day glycemic control to guide pharmacotherapy step-up.'
    },
    {
      orderType: 'LABORATORY',
      testName: 'Comprehensive Metabolic Panel (CMP)',
      loinc: '24357-6',
      cpt: '80053',
      urgency: 'ROUTINE_SAMEDAY',
      clinicalRationale: 'Evaluate renal function (eGFR & Creatinine) and electrolytes before SGLT2i initiation.'
    },
    {
      orderType: 'DIAGNOSTIC',
      testName: '12-Lead Electrocardiogram (ECG)',
      loinc: '11524-6',
      cpt: '93000',
      urgency: 'STAT_IN_OFFICE',
      clinicalRationale: 'Rule out silent diabetic myocardial ischemia or left ventricular strain.'
    }
  ]);

  const [medications, setMedications] = useState<MedicationItem[]>([
    {
      name: 'Empagliflozin (Jardiance)',
      dose: '10 mg',
      route: 'Oral',
      frequency: 'Once daily in the morning',
      duration: '90 days',
      rxnorm: '1545653',
      indication: 'SGLT2 inhibitor for cardiorenal protection and glycemic control'
    },
    {
      name: 'Metformin Hydrochloride',
      dose: '1000 mg',
      route: 'Oral',
      frequency: 'Twice daily with meals (titrated from 500 mg)',
      duration: '90 days',
      rxnorm: '860975',
      indication: 'Foundational biguanide insulin sensitizer'
    }
  ]);

  const [customSymptoms, setCustomSymptoms] = useState('');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [activeDiagnosisLabel, setActiveDiagnosisLabel] = useState('Type 2 Diabetes & Cardiorenal (Current Consultation)');
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [groundedData, setGroundedData] = useState<any>(null);

  const allergies: string[] = Array.isArray(patient.allergies)
    ? patient.allergies.filter((a: string) => a && !a.toLowerCase().includes('no known'))
    : [];

  // Chart strings arrive as coded labels (e.g. "SULFA DRUGS (CUTANEOUS EXANTHEM)").
  // The banner only needs the substance; the reaction belongs in the chart.
  const primaryAllergy = allergies[0]?.replace(/\s*\(.*\)\s*/g, '').trim();
  const clinicianLabel = currentUser?.displayName || 'Attending physician';

  /**
   * The note is generated from the patient actually in the room, not a bundled
   * sample. Whatever is signed here is exactly what is persisted.
   */
  const soapNote = useMemo(() => {
    const transcript = typeof patient.consultationTranscript === 'string' ? patient.consultationTranscript : '';
    const subjective = [patient.chiefComplaint, transcript].filter(Boolean).join('\n\n') || 'No subjective history captured.';

    const vitals = (patient.vitals || {}) as Record<string, string>;
    const objective = Object.entries(vitals)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => `${key.toUpperCase()}: ${value}`)
      .join(' · ') || 'Vitals not recorded.';

    const assessment = differential.length
      ? differential
          .map((entry, index) => `${index + 1}. ${entry.condition}${entry.probability ? ` (${entry.probability})` : ''}`)
          .join('\n')
      : 'No differential generated for this encounter.';

    const plan = [
      investigations.length ? `Investigations: ${investigations.map((entry) => entry.testName).join(', ')}.` : '',
      medications.length
        ? `Medications: ${medications.map((entry) => `${entry.name} ${entry.dose} ${entry.frequency}`).join('; ')}.`
        : '',
      patient.visitType ? `Visit type: ${patient.visitType}.` : ''
    ].filter(Boolean).join('\n') || 'No orders staged.';

    return { subjective, objective, assessment, plan };
  }, [patient, differential, investigations, medications]);

  const soapSections = [
    { key: 'S', label: 'Subjective', body: soapNote.subjective },
    { key: 'O', label: 'Objective', body: soapNote.objective },
    { key: 'A', label: 'Assessment', body: soapNote.assessment },
    { key: 'P', label: 'Plan', body: soapNote.plan }
  ];

  const runLiveDiagnosis = async (symptomQuery?: string) => {
    const query = (symptomQuery || customSymptoms).trim();
    if (!query) return;
    setIsDiagnosing(true);
    setActiveDiagnosisLabel(query);
    try {
      const data = await apiJson<any>('/api/clinical/diagnose?grounded=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: { id: patient.id || 'pat-live', age: patient.age || 45, allergies: patient.allergies || [] },
          chiefComplaints: [query],
          dialogueOrHPI: query,
          vitals: { heartRate: 88, systolicBp: 124, diastolicBp: 78 }
        })
      });
      setGroundedData(data);
      if (data.differentialDiagnosis) setDifferential(data.differentialDiagnosis);
      if (data.cantMissEmergencies) setCantMissEmergencies(data.cantMissEmergencies);
      if (data.clinicalScores) setClinicalScores(data.clinicalScores);
      if (data.recommendedInvestigations) setInvestigations(data.recommendedInvestigations);
      if (data.stagedPharmacotherapy?.medications) setMedications(data.stagedPharmacotherapy.medications);
    } catch (error) {
      console.error('Live diagnostic evaluation failed', error);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const playAudioSnippet = (snippetId: string) => {
    setActiveAudioSnippet(snippetId);
    setTimeout(() => setActiveAudioSnippet(null), 3500);
  };

  const handleSignEncounter = async () => {
    if (isSigning || isSigned) return;
    setIsSigning(true);
    setSignError(null);
    try {
      const { note } = await clinicApi.signNote({
        patientId: String(patient.id),
        patientName: String(patient.name || 'Patient'),
        title: `${patient.visitType || 'Clinical encounter'} — ${new Date().toLocaleDateString('en-US')}`,
        note: soapNote,
        diagnoses: differential.map((entry) => entry.condition),
        prescriptions: medications.map((entry) => ({
          name: entry.name,
          dose: entry.dose,
          route: entry.route,
          frequency: entry.frequency,
          duration: entry.duration,
          rxnorm: entry.rxnorm,
          indication: entry.indication
        })),
        attestation:
          'I hereby attest that I have personally reviewed, calibrated, and confirmed the clinical formulation, differential diagnoses, and staged orders for this patient encounter.'
      });

      setAttestationPayload({
        practitionerId: note.signature?.actorId || currentUser?.id || 'unknown',
        practitionerName: note.signature?.actorName || clinicianLabel,
        npi: note.signature?.npi || npiSignature,
        patientId: patient.id,
        merkleRoot: note.id,
        timestamp: note.signedAt || new Date().toISOString(),
        attestationStatement: note.signature?.attestation
      });
      setIsSigned(true);
    } catch (error) {
      setSignError((error as Error).message || 'The signature could not be committed.');
    } finally {
      setIsSigning(false);
    }
  };

  const initials = String(patient.name || 'Patient')
    .split(' ')
    .slice(0, 2)
    .map((part: string) => part[0])
    .join('');

  return (
    <div className="flex flex-col gap-4 pb-4 text-[#111315]">

      {/* ── Encounter header ─────────────────────────────────────────────── */}
      <header className="proton-glass proton-specular flex flex-wrap items-center justify-between gap-3 rounded-[22px] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E3EDF8] to-[#F6E6CC] text-[12px] font-semibold text-[#0F4C81]">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[16px] font-semibold tracking-[-0.025em]">{patient.name}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-100/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-800">
                <LiveDot size={5} color="#0F9D67" />
                Live
              </span>
              {primaryAllergy && (
                <span className="inline-flex max-w-[170px] items-center gap-1 rounded-full border border-red-200/80 bg-red-50/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-red-700">
                  <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">Allergy · {primaryAllergy}</span>
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[#7A8188]">
              <span>Age {patient.age ?? 58}</span>
              {patient.gender && <span>· {patient.gender}</span>}
              <span>· {patient.mrn || 'MRN-784920'}</span>
              {patient.visitType && <span className="hidden sm:inline">· {patient.visitType}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-white/80 bg-white/60 px-2.5 py-1 font-mono-clinical text-[10px] text-[#5A6065] sm:inline-flex">
            <Volume2 className="h-3 w-3 text-emerald-600" />
            Whisper 16 kHz
          </span>

          {onSwitchMode && (
            <div className="proton-segment flex items-center gap-0.5 rounded-full p-0.5">
              <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#111315] shadow-[0_2px_8px_-4px_rgba(16,18,22,0.4)]">
                Cockpit
              </span>
              <button
                type="button"
                onClick={() => onSwitchMode('guided')}
                className="rounded-full px-2.5 py-1 text-[10.5px] font-medium text-[#6E757C] transition-colors hover:text-[#111315] cursor-pointer"
              >
                Guided
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode('desk')}
                className="rounded-full px-2.5 py-1 text-[10.5px] font-medium text-[#6E757C] transition-colors hover:text-[#111315] cursor-pointer"
              >
                Desk
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onBackToDesk}
            className="flex items-center gap-1 rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-[#4C535A] transition-all hover:-translate-y-0.5 hover:bg-white/85 hover:text-[#111315] active:translate-y-0 cursor-pointer"
          >
            Exit
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </header>

      {/* ── Tri-pane workspace ───────────────────────────────────────────── */}
      <div className="grid min-h-0 grid-cols-1 gap-4 xl:h-[calc(100vh-14rem)] xl:grid-cols-12">

        {/* Pane 1 — acoustic stream */}
        <Pane
          className="xl:col-span-4"
          header={
            <>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A8188]">
                Acoustic diarization
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 font-mono-clinical text-[9.5px] font-semibold text-emerald-700">
                <LiveDot size={4} color="#0F9D67" />
                Streaming
              </span>
            </>
          }
          footer={
            <div className="flex items-center justify-between gap-3 text-[10.5px] text-[#7A8188]">
              <span>Talk ratio <strong className="font-semibold text-[#3F464D]">48% MD</strong> · <strong className="font-semibold text-[#3F464D]">52% patient</strong></span>
              <span className="text-emerald-700">Pharmacology steer active</span>
            </div>
          }
        >
          <div className="border-b border-black/[0.055] px-4 py-3">
            <div className="flex h-9 items-center justify-center gap-[3px] overflow-hidden rounded-xl bg-[#111315] px-3 py-2">
              {WAVE_HEIGHTS.map((height, index) => (
                <span
                  key={index}
                  className="proton-wave-bar w-[3px] rounded-full bg-emerald-400/90"
                  style={{
                    height: `${height}%`,
                    animationDelay: `${index * 55}ms`,
                    animationDuration: `${1000 + (index % 5) * 130}ms`
                  }}
                />
              ))}
            </div>
            {activeAudioSnippet && (
              <div className="mt-2.5 flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-[10.5px] text-emerald-800">
                <span className="flex items-center gap-1.5 font-medium">
                  <Play className="h-3 w-3 fill-emerald-600 text-emerald-600" />
                  Playing provenance {activeAudioSnippet}
                </span>
                <span className="font-mono-clinical text-emerald-700">16 kHz PCM</span>
              </div>
            )}
          </div>

          <ol className="space-y-3.5 p-4">
            {UTTERANCES.map((utterance) => {
              const isDoctor = utterance.speaker === 'DOCTOR';
              return (
                <li key={utterance.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8.5px] font-bold ${isDoctor ? 'bg-[#0F4C81] text-white' : 'bg-[#F3E3D3] text-[#8A5A2B]'}`}>
                        {isDoctor ? 'MD' : 'PT'}
                      </span>
                      <span className="truncate">{isDoctor ? clinicianLabel : utterance.speakerLabel}</span>
                      <span className="shrink-0 font-normal text-[#A0A6AD]">{Math.round(utterance.confidence * 100)}%</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => playAudioSnippet(utterance.audioSnippetId)}
                      className="flex shrink-0 items-center gap-1 rounded-full border border-black/[0.07] bg-white/70 px-2 py-0.5 font-mono-clinical text-[9.5px] text-[#6E757C] transition-colors hover:border-emerald-300 hover:text-emerald-700 cursor-pointer"
                      aria-label={`Play audio from ${Math.floor(utterance.startMs / 1000)} to ${Math.floor(utterance.endMs / 1000)} seconds`}
                    >
                      <Play className="h-2.5 w-2.5" />
                      {Math.floor(utterance.startMs / 1000)}–{Math.floor(utterance.endMs / 1000)}s
                    </button>
                  </div>
                  <p className={`mt-1.5 rounded-2xl border px-3 py-2.5 text-[12.5px] leading-relaxed ${isDoctor ? 'border-[#DCE8F4]/80 bg-[#F3F8FC]/80 text-[#243746]' : 'border-white/80 bg-white/65 text-[#3F464D]'}`}>
                    {utterance.text}
                  </p>
                </li>
              );
            })}
          </ol>
        </Pane>

        {/* Pane 2 — diagnostic reasoning */}
        <section className="proton-glass proton-specular flex min-h-0 flex-col overflow-hidden rounded-[24px] xl:col-span-5">
          <div className="flex shrink-0 items-center gap-2 border-b border-black/[0.055] p-2">
            <div role="tablist" aria-label="Reasoning views" className="proton-segment flex flex-1 items-center gap-0.5 rounded-full p-0.5">
              {([
                { id: 'agent', label: 'Diagnostic reasoning' },
                { id: 'soap', label: 'SOAP note' }
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                    activeTab === tab.id ? 'text-[#111315]' : 'text-[#6E757C] hover:text-[#111315]'
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.span
                      layoutId="cockpit-tab-pill"
                      className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_-4px_rgba(16,18,22,0.4)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === 'agent' && (
              <div className="space-y-4 p-4">

                {/* Draft agent input */}
                <div className="rounded-2xl border border-white/80 bg-white/60 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A8188]">
                      <Sparkles className="h-3.5 w-3.5 text-[#0F4C81]" />
                      Diagnostic agent
                    </span>
                    <span className="rounded-full border border-amber-300/60 bg-amber-100/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-800">
                      Draft · unsigned
                    </span>
                  </div>

                  <form
                    className="mt-2.5 flex items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runLiveDiagnosis();
                    }}
                  >
                    <input
                      type="text"
                      value={customSymptoms}
                      onChange={(event) => setCustomSymptoms(event.target.value)}
                      placeholder="Describe symptoms — e.g. acute RLQ pain, migraine, dysuria…"
                      aria-label="Symptoms to evaluate"
                      className="min-w-0 flex-1 rounded-full border border-white/80 bg-white/85 px-3.5 py-2 text-[12px] text-[#111315] outline-none transition-colors placeholder:text-[#9AA0A6] focus:border-[#0F4C81]/40 focus:ring-2 focus:ring-[#0F4C81]/15"
                    />
                    <button
                      type="submit"
                      disabled={isDiagnosing || !customSymptoms.trim()}
                      className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#111315] px-3.5 py-2 text-[11.5px] font-semibold text-white transition-all hover:bg-[#24272C] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      {isDiagnosing
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                        : <Send className="h-3.5 w-3.5 text-emerald-400" />}
                      Diagnose
                    </button>
                  </form>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[9.5px] uppercase tracking-[0.1em] text-[#9AA0A6]">Scenarios</span>
                    {[
                      { label: 'Appendicitis', query: 'Acute right lower quadrant abdominal pain, anorexia, fever, nausea, McBurney point tenderness' },
                      { label: 'Migraine', query: 'Unilateral throbbing headache with photophobia and nausea for 6 hours' },
                      { label: 'UTI', query: 'Severe dysuria, increased urinary frequency, and suprapubic pain' },
                      { label: 'Asthma', query: 'Expiratory wheezing, chest tightness, and shortness of breath' },
                      { label: 'Diabetes', query: 'Home glucose readings 200 mg/dL, polyuria, polydipsia, and fatigue' },
                      { label: 'Pulmonary embolism', query: 'Sudden onset shortness of breath, pleuritic chest pain, and unilateral leg swelling' }
                    ].map((scenario) => (
                      <button
                        key={scenario.label}
                        type="button"
                        onClick={() => {
                          setCustomSymptoms(scenario.query);
                          void runLiveDiagnosis(scenario.query);
                        }}
                        className="rounded-full border border-black/[0.07] bg-white/70 px-2.5 py-1 text-[10px] font-medium text-[#525763] transition-colors hover:border-[#0F4C81]/30 hover:bg-[#EDF3F9] hover:text-[#0F4C81] cursor-pointer"
                      >
                        {scenario.label}
                      </button>
                    ))}
                  </div>

                  {activeDiagnosisLabel && (
                    <div className="mt-2.5 flex items-center gap-1.5 border-t border-black/[0.055] pt-2 text-[10.5px] text-[#6E757C]">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="truncate">Evaluating <strong className="font-semibold text-[#3F464D]">{activeDiagnosisLabel}</strong></span>
                    </div>
                  )}
                </div>

                {/* Can't-miss emergencies */}
                {cantMissEmergencies.length > 0 && (
                  <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 p-3.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.11em] text-rose-800">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                      Can&apos;t-miss emergencies
                    </div>
                    {cantMissEmergencies.map((emergency, index) => (
                      <p key={index} className="mt-1.5 text-[11.5px] leading-relaxed text-rose-900">
                        <strong className="font-semibold">{emergency.condition} ({emergency.icd10})</strong> — {emergency.rationale}
                      </p>
                    ))}
                  </div>
                )}

                {/* Pre-test probability */}
                <div>
                  <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A8188]">
                    <Activity className="h-3.5 w-3.5 text-[#0F4C81]" />
                    Pre-test probability
                  </h2>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-2xl border border-white/80 bg-white/60 p-3">
                      <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#8A9199]">Wells PE</div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-[24px] font-semibold tabular-nums tracking-[-0.04em]">{clinicalScores.wellsPE.score}</span>
                        <span className="text-[10px] text-[#9AA0A6]">pts</span>
                      </div>
                      <div className="mt-1 text-[10px] font-medium leading-snug text-amber-700">{clinicalScores.wellsPE.riskLevel}</div>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/60 p-3">
                      <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#8A9199]">CURB-65</div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-[24px] font-semibold tabular-nums tracking-[-0.04em]">{clinicalScores.curb65.score}</span>
                        <span className="text-[10px] text-[#9AA0A6]">pts</span>
                      </div>
                      <div className="mt-1 text-[10px] font-medium leading-snug text-emerald-700">{clinicalScores.curb65.mortalityRisk}</div>
                    </div>
                  </div>
                </div>

                {/* Differential */}
                <div>
                  <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A8188]">
                    <Stethoscope className="h-3.5 w-3.5 text-[#0F4C81]" />
                    Ranked differential
                  </h2>
                  <div className="space-y-2.5">
                    {differential.map((item) => {
                      const percent = probabilityPercent(item.probability);
                      return (
                        <article key={item.rank} className="rounded-2xl border border-white/80 bg-white/65 p-3.5 transition-colors hover:border-[#0F4C81]/25">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex min-w-0 items-start gap-2">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#111315] font-mono-clinical text-[10px] font-bold text-white">
                                {item.rank}
                              </span>
                              <h3 className="text-[12.5px] font-semibold leading-snug">{item.condition}</h3>
                            </div>
                            <span className="shrink-0 rounded-full bg-[#EDF3F9] px-2 py-0.5 text-[9.5px] font-semibold text-[#0F4C81]">
                              {item.probability}
                            </span>
                          </div>

                          {percent > 0 && (
                            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-black/[0.055]">
                              <div className="h-full rounded-full bg-[#0F4C81]" style={{ width: `${percent}%` }} />
                            </div>
                          )}

                          <ul className="mt-2.5 space-y-1 text-[11px] text-[#525763]">
                            {item.supportingEvidence.map((evidence, index) => (
                              <li key={index} className="flex items-start gap-1.5">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-600" />
                                <span>{evidence}</span>
                              </li>
                            ))}
                          </ul>

                          <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-2.5 py-1.5 text-[10px] text-emerald-800">
                            <Sparkles className="h-3 w-3 shrink-0 text-emerald-600" />
                            <span className="truncate">{item.evidenceCitation}</span>
                          </div>

                          <div className="mt-2 flex items-center gap-2 font-mono-clinical text-[9px] text-[#9AA0A6]">
                            <span>ICD-10 {item.icd10}</span>
                            <span>SNOMED {item.snomed}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>

                {/* Evidence loop */}
                <div className="rounded-2xl bg-[#111315] p-4 text-white shadow-[0_24px_60px_-32px_rgba(0,0,0,0.65)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Evidence loop
                    </span>
                    <span className="rounded-full border border-emerald-800/60 bg-emerald-950/60 px-2 py-0.5 font-mono-clinical text-[9px] text-emerald-300">
                      Grounded
                    </span>
                  </div>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-[#A0A6AD]">
                    Every claim is tied to an atomic fact, filtered through the causation firewall, and checked against Tier 1 guidance.
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                    <span className="font-mono-clinical text-[10px] text-[#7A8188]">
                      {groundedData?.auditLedger?.totalClaimsAudited || DEFAULT_TRACEABLE_CLAIMS.length} claims audited
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsInspectorOpen(true)}
                      className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[10.5px] font-semibold text-white transition-colors hover:bg-white/[0.18] cursor-pointer"
                    >
                      Inspect
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Pending information */}
                {groundedData?.unknownAndPending?.pendingTests?.length > 0 && (
                  <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.11em] text-amber-900">
                      <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
                      Unknown &amp; pending ({groundedData.unknownAndPending.pendingTests.length})
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800">
                      These tests are still pending. Proton keeps them as hypotheses and holds dependent high-risk orders.
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {groundedData.unknownAndPending.pendingTests.map((test: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-white/80 px-2.5 py-1.5">
                          <span className="text-[11px] font-semibold text-amber-950">{test.testName}</span>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono-clinical text-[9px] font-bold text-amber-900">
                            PENDING
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Falsification */}
                {groundedData?.whatWouldChangeMyMind && (
                  <div className="rounded-2xl border border-white/80 bg-white/60 p-3.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7A8188]">
                      <Activity className="h-3.5 w-3.5 text-[#0F4C81]" />
                      What would change my mind
                    </div>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-[#525763]">
                      <strong className="font-semibold text-[#111315]">Primary hypothesis:</strong>{' '}
                      {groundedData.whatWouldChangeMyMind.primaryHypothesis}
                    </p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-[#8A9199]">
                      <strong className="font-semibold text-[#6E757C]">Falsification:</strong>{' '}
                      {groundedData.whatWouldChangeMyMind.falsificationEvents?.join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'soap' && (
              <div className="space-y-2.5 p-4">
                {soapSections.map((section) => (
                  <article key={section.key} className="rounded-2xl border border-white/80 bg-white/60 p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#111315] font-mono-clinical text-[10px] font-bold text-white">
                        {section.key}
                      </span>
                      <span className="text-[9.5px] font-semibold uppercase tracking-[0.13em] text-[#7A8188]">
                        {section.label}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-[#3F464D]">
                      {section.body}
                    </p>
                  </article>
                ))}
                <p className="px-1 pt-1 text-[10px] leading-relaxed text-[#9AA0A6]">
                  Draft note generated from the encounter. Nothing enters the record until the attending signs.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Pane 3 — staged orders + signature */}
        <Pane
          className="xl:col-span-3"
          header={
            <>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A8188]">
                Staged orders
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                <ShieldCheck className="h-2.5 w-2.5" />
                4-tier gated
              </span>
            </>
          }
          footer={
            isSigned ? (
              <div className="rounded-2xl border border-emerald-300/70 bg-emerald-50/80 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Signed &amp; committed
                </div>
                <div className="mt-1 text-[10.5px] font-medium text-emerald-800">
                  {attestationPayload?.practitionerName || 'Attending physician'} · {attestationPayload?.npi || npiSignature}
                </div>
                <div className="mt-0.5 truncate font-mono-clinical text-[9.5px] text-emerald-700">
                  Note {String(attestationPayload?.merkleRoot || '—').substring(0, 18)}…
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-[10.5px] text-[#7A8188]">
                  <span>Signing clinician</span>
                  <span className="font-mono-clinical font-semibold text-[#111315]">{npiSignature}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { void handleSignEncounter(); }}
                  disabled={isSigning}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#111315] py-2.5 text-[12px] font-semibold text-white shadow-[0_16px_34px_-20px_rgba(17,19,21,0.85)] transition-all hover:-translate-y-0.5 hover:bg-[#24272C] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  {isSigning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  {isSigning ? 'Signing…' : 'Sign & commit to record'}
                </button>
                {signError && (
                  <p className="mt-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-center text-[9.5px] leading-relaxed text-rose-800">
                    {signError}
                  </p>
                )}
                <p className="mt-1.5 text-center text-[9.5px] text-[#9AA0A6]">
                  Draft orders · nothing released until signed
                </p>
              </div>
            )
          }
        >
          <div className="space-y-4 p-4">

            <div className="rounded-2xl border border-emerald-800/30 bg-[#111315] p-3 text-white">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-emerald-300">
                  <ShieldCheck className="h-3 w-3" />
                  Attending review
                </span>
                <span className="rounded-full border border-emerald-700/50 bg-emerald-900/50 px-2 py-0.5 font-mono-clinical text-[8.5px] text-emerald-300">
                  ~10s
                </span>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#A8B2C1]">
                The draft agent assembled history, physical, and lab proposals. Review the reasoning, then authorize or reject.
              </p>
            </div>

            <div>
              <h2 className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#8A9199]">
                Diagnostic tests · LOINC
              </h2>
              <ul className="mt-2 space-y-2">
                {investigations.map((investigation, index) => {
                  const isStat = investigation.urgency.includes('STAT');
                  return (
                    <li key={index} className="rounded-2xl border border-white/80 bg-white/65 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11.5px] font-semibold leading-snug">{investigation.testName}</span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono-clinical text-[8.5px] font-semibold ${isStat ? 'bg-rose-50 text-rose-700' : 'bg-black/[0.045] text-[#6E757C]'}`}>
                          {urgencyLabel(investigation.urgency)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between font-mono-clinical text-[9px] text-[#9AA0A6]">
                        <span>LOINC {investigation.loinc}</span>
                        <span>CPT {investigation.cpt}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h2 className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#8A9199]">
                Prescriptions · RxNorm
              </h2>
              <ul className="mt-2 space-y-2">
                {medications.map((medication, index) => (
                  <li key={index} className="rounded-2xl border border-white/80 bg-white/65 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11.5px] font-semibold leading-snug">{medication.name}</span>
                      <span className="shrink-0 rounded-full border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 font-mono-clinical text-[8.5px] font-bold text-amber-800">
                        MD gate
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-[#525763]">
                      {medication.dose} · {medication.frequency}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between border-t border-black/[0.05] pt-1.5 font-mono-clinical text-[9px] text-[#9AA0A6]">
                      <span>RxNorm {medication.rxnorm}</span>
                      <span className="font-sans font-medium text-emerald-700">Allergy cleared</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-[#111315] p-3 text-white">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  Specialist council
                </span>
                <span className="font-mono-clinical text-[8.5px] text-[#7A8188]">ACC/AHA · GOLD</span>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#A8B2C1]">
                Adversarial red-team found no unexplained acute findings or discordant lab values.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3">
              <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-amber-900">
                <ShieldCheck className="h-3 w-3 text-amber-700" />
                Prior-auth defense
              </div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-amber-800">
                Letter of medical necessity pre-compiled citing ADA 2026 Grade A guidance and metformin monotherapy failure.
              </p>
            </div>
          </div>
        </Pane>
      </div>

      <ClinicalEvidenceInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        rootLedgerHash={groundedData?.auditLedger?.rootLedgerHash}
        claims={groundedData?.auditLedger?.ledgerEntries || DEFAULT_TRACEABLE_CLAIMS}
      />
    </div>
  );
}
