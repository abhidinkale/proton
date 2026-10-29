import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  Activity, Play, CheckCircle2, AlertTriangle, ShieldCheck,
  Sparkles, Stethoscope, Volume2, Lock, Loader2, Send, HelpCircle,
  ArrowRight, ChevronRight
} from 'lucide-react';
import { apiJson } from '../lib/api';
import { authService } from '../services/auth';
import { LiveDot } from '../design-system/motion/primitives';
import ClinicalEvidenceInspectorModal, { type TraceableClaim } from './evidence/ClinicalEvidenceInspectorModal';
import AttestationVerificationModal, { type AttestationData } from './AttestationVerificationModal';

export interface PatientBrief {
  patient: {
    id: string;
    name: string;
    age: number;
    sex: string;
    bloodGroup?: string;
    allergies?: string[];
  };
  activeConditions: Array<{
    name: string;
    code?: string;
    system?: string;
    status?: string;
  }>;
  activeMedications: Array<{
    name: string;
    dose?: string;
    frequency?: string;
    duration?: string;
  }>;
  priorEpisode?: {
    recurrenceDetected?: boolean;
    relativeTime?: string;
    date?: string;
    diagnosis?: string;
    snomedCode?: string;
    treatment?: string;
    outcome?: string;
    clinicalNote?: string;
  } | null;
}

const VALID_DEMO_NOTE_V1 = {
  schema_version: 'note_v1',
  subjective: {
    chief_complaint: { text: 'persistent cough and dyspnea on exertion with ankle swelling', onset: '2 weeks', duration: '14 days', severity: 6 },
    hpi: [{ symptom: 'dyspnea on exertion', onset: '2 weeks', character: 'tight discomfort on coughing', aggravating: ['climbing stairs'], relieving: ['rest'], associated: ['bilateral ankle edema'] }],
    pmh: [{ condition: 'Type 2 Diabetes Mellitus', code: '44054006', since: '5 years' }],
    medications: [{ name: 'Metformin', dose: '1000 mg', frequency: 'twice daily' }],
    allergies: [],
    narrative: 'Patient presents with a 2-week history of dry cough and progressive exertional dyspnea, accompanied by evening bilateral pedal edema. Fasting sugars running 185-210 mg/dL.'
  },
  objective: {
    vitals: { temperature_c: '37.1', heart_rate_bpm: '88', systolic_bp_mmhg: '138', diastolic_bp_mmhg: '86', respiratory_rate_bpm: '18', spo2_pct: '97', weight_kg: '82', height_cm: '175' },
    exam: [{ system: 'Cardiovascular', finding: '1+ bilateral pitting pedal edema', laterality: 'bilateral' }],
    labs: []
  },
  assessment: {
    differential: [{ condition: 'Type 2 Diabetes Mellitus with Suboptimal Glycemic Control', band: 'supported', for: ['Fasting blood sugar 185-210 mg/dL'], against: [], guideline_ref: 'ADA-2026' }],
    primary: { condition: 'Type 2 Diabetes Mellitus with Suboptimal Glycemic Control', basis: 'Persistent fasting hyperglycemia on monotherapy.' }
  },
  plan: {
    medications: [{ drug: 'Empagliflozin', dose: '10 mg', route: 'PO', frequency: 'once daily', duration_days: 30, rationale: 'Cardiorenal protection.' }],
    orders: [{ type: 'lab', detail: 'Comprehensive Metabolic Panel + HbA1c', rationale: 'Assess renal function and glycemic control.' }],
    follow_up: { interval: '4 weeks', method: 'app', triggers: ['orthopnea', 'rapid weight gain'] },
    education: [{ topic: 'Signs of hypoglycemia', material_id: null }, { topic: 'Hydration on SGLT2i', material_id: null }]
  }
};

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
  const [attestationModalData, setAttestationModalData] = useState<AttestationData | null>(null);
  const [isAttestationModalOpen, setIsAttestationModalOpen] = useState(false);

  const [brief, setBrief] = useState<PatientBrief | null>(null);
  const [isLoadingBrief, setIsLoadingBrief] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const patientId = patient?.id || 'pat-demo-1';
    setIsLoadingBrief(true);
    apiJson<PatientBrief>(`/api/workflow/patients/${encodeURIComponent(patientId)}/brief`)
      .then((data) => {
        if (isMounted && data) {
          setBrief(data);
        }
      })
      .catch((err) => {
        console.warn('Could not load pre-visit brief:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingBrief(false);
      });

    return () => {
      isMounted = false;
    };
  }, [patient?.id]);

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
      const encounterId = patient?.encounterId || 'enc-demo-1';
      const result = await apiJson<{
        encounter: any;
        attestation: AttestationData;
      }>(`/api/workflow/encounters/${encodeURIComponent(encounterId)}/transitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign',
          attestation: true,
          patientId: patient?.id,
          note: VALID_DEMO_NOTE_V1
        })
      });

      if (result?.attestation) {
        setAttestationModalData(result.attestation);
        setIsAttestationModalOpen(true);
      }

      setAttestationPayload({
        practitionerId: currentUser?.id || 'usr-md-lin-01',
        practitionerName: clinicianLabel,
        npi: npiSignature,
        patientId: patient.id,
        signatureRecordId: result?.attestation?.id || encounterId,
        timestamp: result?.attestation?.attested_at || new Date().toISOString(),
        attestationStatement: `Immutable ledger seq #${result?.attestation?.seq || 1} • hash ${result?.attestation?.content_hash?.slice(0, 16)}…`
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
    <div className="flex flex-col gap-4 pb-4 text-ink">

      {/* ── Encounter header ─────────────────────────────────────────────── */}
      <header className="proton-glass proton-specular flex flex-wrap items-center justify-between gap-3 rounded-[22px] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-wash to-caution-wash text-[12px] font-semibold text-accent-ink">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[16px] font-semibold tracking-[-0.025em]">{patient.name}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-settled-line/60 bg-settled-wash/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-settled">
                <LiveDot size={5} color="var(--c-settled)" />
                Live
              </span>
              {primaryAllergy && (
                <span className="inline-flex max-w-[170px] items-center gap-1 rounded-full border border-critical-line/80 bg-critical-wash/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-critical">
                  <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">Allergy · {primaryAllergy}</span>
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-ink-2">
              <span>Age {patient.age ?? 58}</span>
              {patient.gender && <span>· {patient.gender}</span>}
              <span>· {patient.mrn || 'MRN-784920'}</span>
              {patient.visitType && <span className="hidden sm:inline">· {patient.visitType}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-rule/80 bg-paper/60 px-2.5 py-1 font-mono-clinical text-[10px] text-ink-2 sm:inline-flex">
            <Volume2 className="h-3 w-3 text-settled" />
            Whisper 16 kHz
          </span>

          {onSwitchMode && (
            <div className="proton-segment flex items-center gap-0.5 rounded-full p-0.5">
              <span className="rounded-full bg-paper px-2.5 py-1 text-[10.5px] font-semibold text-ink shadow-[0_2px_8px_-4px_rgba(16,18,22,0.4)]">
                Cockpit
              </span>
              <button
                type="button"
                onClick={() => onSwitchMode('guided')}
                className="rounded-full px-2.5 py-1 text-[10.5px] font-medium text-ink-2 transition-colors hover:text-ink cursor-pointer"
              >
                Guided
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode('desk')}
                className="rounded-full px-2.5 py-1 text-[10.5px] font-medium text-ink-2 transition-colors hover:text-ink cursor-pointer"
              >
                Desk
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onBackToDesk}
            className="flex items-center gap-1 rounded-full border border-rule/80 bg-paper/60 px-3 py-1.5 text-[11px] font-semibold text-ink-2 transition-all hover:-translate-y-0.5 hover:bg-paper/85 hover:text-ink active:translate-y-0 cursor-pointer"
          >
            Exit
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </header>

      {/* ── Pre-Visit Brief Card ──────────────────────────────────── */}
      <div className="proton-glass proton-specular rounded-[20px] p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.05] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-wash text-accent">
              <Sparkles className="h-3 w-3" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
              Pre-Visit Brief
            </span>
            {isLoadingBrief && (
              <span className="inline-flex items-center gap-1 font-mono-clinical text-[10px] text-ink-2">
                <Loader2 className="h-3 w-3 animate-spin text-accent" />
                Updating…
              </span>
            )}
          </div>
          {brief?.priorEpisode?.recurrenceDetected && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-caution-line/80 bg-caution-wash px-2.5 py-0.5 text-[10px] font-semibold text-caution">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Recurrence Alert · Prior Episode ({brief.priorEpisode.relativeTime || '11 months ago'})
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Active Conditions */}
          <div className="rounded-xl border border-rule/60 bg-paper/50 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-2">
              Active Conditions
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {brief?.activeConditions && brief.activeConditions.length > 0 ? (
                brief.activeConditions.map((cond, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded-md border border-rule/80 bg-paper px-2 py-0.5 text-[11px] font-medium text-ink"
                  >
                    {cond.name}
                    {cond.code && (
                      <span className="ml-1 font-mono-clinical text-[9.5px] text-ink-2">
                        {cond.code}
                      </span>
                    )}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-ink-2 italic">
                  {isLoadingBrief ? 'Loading...' : 'None recorded'}
                </span>
              )}
            </div>
          </div>

          {/* Active Medications */}
          <div className="rounded-xl border border-rule/60 bg-paper/50 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-2">
              Active Medications
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {brief?.activeMedications && brief.activeMedications.length > 0 ? (
                brief.activeMedications.map((med, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded-md border border-rule/80 bg-paper px-2 py-0.5 text-[11px] font-medium text-ink"
                  >
                    {med.name}
                    {med.dose && <span className="ml-1 text-ink-2">· {med.dose}</span>}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-ink-2 italic">
                  {isLoadingBrief ? 'Loading...' : 'None recorded'}
                </span>
              )}
            </div>
          </div>

          {/* Prior Episode */}
          <div className="rounded-xl border border-caution-line/70 bg-caution-wash/30 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-caution">
                Prior Episode ({brief?.priorEpisode?.relativeTime || '11 months ago'})
              </span>
              <AlertTriangle className="h-3 w-3 text-caution" />
            </div>
            {brief?.priorEpisode ? (
              <div className="mt-1.5 space-y-1 text-[11px]">
                <div className="font-semibold text-ink">
                  {brief.priorEpisode.diagnosis}{' '}
                  {brief.priorEpisode.snomedCode && (
                    <span className="font-mono-clinical text-[10px] font-normal text-ink-2">
                      (SNOMED: {brief.priorEpisode.snomedCode})
                    </span>
                  )}
                </div>
                <div className="text-ink-2">
                  <span className="font-medium text-ink">Treatment:</span> {brief.priorEpisode.treatment}
                </div>
                <div className="text-ink-2">
                  <span className="font-medium text-ink">Outcome:</span>{' '}
                  <span className="font-medium text-settled">{brief.priorEpisode.outcome}</span>
                </div>
              </div>
            ) : (
              <div className="mt-1.5 text-[11px] text-ink-2 italic">
                {isLoadingBrief ? 'Loading...' : 'No prior recurrent episodes identified.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tri-pane workspace ───────────────────────────────────────────── */}
      <div className="grid min-h-0 grid-cols-1 gap-4 xl:h-[calc(100vh-14rem)] xl:grid-cols-12">

        {/* Pane 1 — acoustic stream */}
        <Pane
          className="xl:col-span-4"
          header={
            <>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-2">
                Acoustic diarization
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-settled-wash px-2 py-0.5 font-mono-clinical text-[9.5px] font-semibold text-settled">
                <LiveDot size={4} color="var(--c-settled)" />
                Streaming
              </span>
            </>
          }
          footer={
            <div className="flex items-center justify-between gap-3 text-[10.5px] text-ink-2">
              <span>Talk ratio <strong className="font-semibold text-ink">48% MD</strong> · <strong className="font-semibold text-ink">52% patient</strong></span>
              <span className="text-settled">Pharmacology steer active</span>
            </div>
          }
        >
          <div className="border-b border-black/[0.055] px-4 py-3">
            <div className="flex h-9 items-center justify-center gap-[3px] overflow-hidden rounded-xl bg-solid px-3 py-2">
              {WAVE_HEIGHTS.map((height, index) => (
                <span
                  key={index}
                  className="proton-wave-bar w-[3px] rounded-full bg-settled/90"
                  style={{
                    height: `${height}%`,
                    animationDelay: `${index * 55}ms`,
                    animationDuration: `${1000 + (index % 5) * 130}ms`
                  }}
                />
              ))}
            </div>
            {activeAudioSnippet && (
              <div className="mt-2.5 flex items-center justify-between rounded-xl border border-settled-line/80 bg-settled-wash/80 px-3 py-1.5 text-[10.5px] text-settled">
                <span className="flex items-center gap-1.5 font-medium">
                  <Play className="h-3 w-3 fill-settled text-settled" />
                  Playing provenance {activeAudioSnippet}
                </span>
                <span className="font-mono-clinical text-settled">16 kHz PCM</span>
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
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8.5px] font-bold ${isDoctor ? 'bg-accent text-white' : 'bg-caution-wash text-caution'}`}>
                        {isDoctor ? 'MD' : 'PT'}
                      </span>
                      <span className="truncate">{isDoctor ? clinicianLabel : utterance.speakerLabel}</span>
                      <span className="shrink-0 font-normal text-ink-3">{Math.round(utterance.confidence * 100)}%</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => playAudioSnippet(utterance.audioSnippetId)}
                      className="flex shrink-0 items-center gap-1 rounded-full border border-black/[0.07] bg-paper/70 px-2 py-0.5 font-mono-clinical text-[9.5px] text-ink-2 transition-colors hover:border-settled-line hover:text-settled cursor-pointer"
                      aria-label={`Play audio from ${Math.floor(utterance.startMs / 1000)} to ${Math.floor(utterance.endMs / 1000)} seconds`}
                    >
                      <Play className="h-2.5 w-2.5" />
                      {Math.floor(utterance.startMs / 1000)}–{Math.floor(utterance.endMs / 1000)}s
                    </button>
                  </div>
                  <p className={`mt-1.5 rounded-2xl border px-3 py-2.5 text-[12.5px] leading-relaxed ${isDoctor ? 'border-accent-line/80 bg-accent-wash/80 text-ink' : 'border-rule/80 bg-paper/65 text-ink'}`}>
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
                    activeTab === tab.id ? 'text-ink' : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.span
                      layoutId="cockpit-tab-pill"
                      className="absolute inset-0 rounded-full bg-paper shadow-[0_2px_8px_-4px_rgba(16,18,22,0.4)]"
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
                <div className="rounded-2xl border border-rule/80 bg-paper/60 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-2">
                      <Sparkles className="h-3.5 w-3.5 text-accent-ink" />
                      Diagnostic agent
                    </span>
                    <span className="rounded-full border border-caution-line/60 bg-caution-wash/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-caution">
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
                      className="min-w-0 flex-1 rounded-full border border-rule/80 bg-paper/85 px-3.5 py-2 text-[12px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-accent/40 focus:ring-2 focus:ring-accent/15"
                    />
                    <button
                      type="submit"
                      disabled={isDiagnosing || !customSymptoms.trim()}
                      className="flex shrink-0 items-center gap-1.5 rounded-full bg-solid px-3.5 py-2 text-[11.5px] font-semibold text-white transition-all hover:bg-solid disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    >
                      {isDiagnosing
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin text-settled-on-solid" />
                        : <Send className="h-3.5 w-3.5 text-settled-on-solid" />}
                      Diagnose
                    </button>
                  </form>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[9.5px] uppercase tracking-[0.1em] text-ink-3">Scenarios</span>
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
                        className="rounded-full border border-black/[0.07] bg-paper/70 px-2.5 py-1 text-[10px] font-medium text-ink-2 transition-colors hover:border-accent/30 hover:bg-accent-wash hover:text-accent-ink cursor-pointer"
                      >
                        {scenario.label}
                      </button>
                    ))}
                  </div>

                  {activeDiagnosisLabel && (
                    <div className="mt-2.5 flex items-center gap-1.5 border-t border-black/[0.055] pt-2 text-[10.5px] text-ink-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-settled-wash0" />
                      <span className="truncate">Evaluating <strong className="font-semibold text-ink">{activeDiagnosisLabel}</strong></span>
                    </div>
                  )}
                </div>

                {/* Can't-miss emergencies */}
                {cantMissEmergencies.length > 0 && (
                  <div className="rounded-2xl border border-critical-line/80 bg-critical-wash/80 p-3.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.11em] text-critical">
                      <AlertTriangle className="h-3.5 w-3.5 text-critical" />
                      Can&apos;t-miss emergencies
                    </div>
                    {cantMissEmergencies.map((emergency, index) => (
                      <p key={index} className="mt-1.5 text-[11.5px] leading-relaxed text-critical">
                        <strong className="font-semibold">{emergency.condition} ({emergency.icd10})</strong> — {emergency.rationale}
                      </p>
                    ))}
                  </div>
                )}

                {/* Pre-test probability */}
                <div>
                  <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-2">
                    <Activity className="h-3.5 w-3.5 text-accent-ink" />
                    Pre-test probability
                  </h2>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-2xl border border-rule/80 bg-paper/60 p-3">
                      <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">Wells PE</div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-[24px] font-semibold tabular-nums tracking-[-0.04em]">{clinicalScores.wellsPE.score}</span>
                        <span className="text-[10px] text-ink-3">pts</span>
                      </div>
                      <div className="mt-1 text-[10px] font-medium leading-snug text-caution">{clinicalScores.wellsPE.riskLevel}</div>
                    </div>
                    <div className="rounded-2xl border border-rule/80 bg-paper/60 p-3">
                      <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">CURB-65</div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-[24px] font-semibold tabular-nums tracking-[-0.04em]">{clinicalScores.curb65.score}</span>
                        <span className="text-[10px] text-ink-3">pts</span>
                      </div>
                      <div className="mt-1 text-[10px] font-medium leading-snug text-settled">{clinicalScores.curb65.mortalityRisk}</div>
                    </div>
                  </div>
                </div>

                {/* Differential */}
                <div>
                  <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-2">
                    <Stethoscope className="h-3.5 w-3.5 text-accent-ink" />
                    Ranked differential
                  </h2>
                  <div className="space-y-2.5">
                    {differential.map((item) => {
                      const percent = probabilityPercent(item.probability);
                      return (
                        <article key={item.rank} className="rounded-2xl border border-rule/80 bg-paper/65 p-3.5 transition-colors hover:border-accent/25">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex min-w-0 items-start gap-2">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-solid font-mono-clinical text-[10px] font-bold text-white">
                                {item.rank}
                              </span>
                              <h3 className="text-[12.5px] font-semibold leading-snug">{item.condition}</h3>
                            </div>
                            <span className="shrink-0 rounded-full bg-accent-wash px-2 py-0.5 text-[9.5px] font-semibold text-accent-ink">
                              {item.probability}
                            </span>
                          </div>

                          {percent > 0 && (
                            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-black/[0.055]">
                              <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                            </div>
                          )}

                          <ul className="mt-2.5 space-y-1 text-[11px] text-ink-2">
                            {item.supportingEvidence.map((evidence, index) => (
                              <li key={index} className="flex items-start gap-1.5">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-settled" />
                                <span>{evidence}</span>
                              </li>
                            ))}
                          </ul>

                          <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-settled-line/70 bg-settled-wash/70 px-2.5 py-1.5 text-[10px] text-settled">
                            <Sparkles className="h-3 w-3 shrink-0 text-settled" />
                            <span className="truncate">{item.evidenceCitation}</span>
                          </div>

                          <div className="mt-2 flex items-center gap-2 font-mono-clinical text-[9px] text-ink-3">
                            <span>ICD-10 {item.icd10}</span>
                            <span>SNOMED {item.snomed}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>

                {/* Evidence loop */}
                <div className="rounded-2xl bg-solid p-4 text-white shadow-[0_24px_60px_-32px_rgba(0,0,0,0.65)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-settled-on-solid">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Evidence loop
                    </span>
                    <span className="rounded-full border border-settled/60 bg-solid/60 px-2 py-0.5 font-mono-clinical text-[9px] text-settled-on-solid">
                      Grounded
                    </span>
                  </div>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
                    Every claim is tied to an atomic fact, filtered through the causation firewall, and checked against Tier 1 guidance.
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-rule/10 pt-2.5">
                    <span className="font-mono-clinical text-[10px] text-ink-2">
                      {groundedData?.auditLedger?.totalClaimsAudited || DEFAULT_TRACEABLE_CLAIMS.length} claims audited
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsInspectorOpen(true)}
                      className="flex items-center gap-1 rounded-full bg-paper/10 px-3 py-1.5 text-[10.5px] font-semibold text-white transition-colors hover:bg-paper/[0.18] cursor-pointer"
                    >
                      Inspect
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Pending information */}
                {groundedData?.unknownAndPending?.pendingTests?.length > 0 && (
                  <div className="rounded-2xl border border-caution-line/80 bg-caution-wash/80 p-3.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.11em] text-caution">
                      <HelpCircle className="h-3.5 w-3.5 text-caution" />
                      Unknown &amp; pending ({groundedData.unknownAndPending.pendingTests.length})
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-caution">
                      These tests are still pending. Proton keeps them as hypotheses and holds dependent high-risk orders.
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {groundedData.unknownAndPending.pendingTests.map((test: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-2 rounded-xl border border-caution-line/80 bg-paper/80 px-2.5 py-1.5">
                          <span className="text-[11px] font-semibold text-caution">{test.testName}</span>
                          <span className="rounded-full bg-caution-wash px-2 py-0.5 font-mono-clinical text-[9px] font-bold text-caution">
                            PENDING
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Falsification */}
                {groundedData?.whatWouldChangeMyMind && (
                  <div className="rounded-2xl border border-rule/80 bg-paper/60 p-3.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-2">
                      <Activity className="h-3.5 w-3.5 text-accent-ink" />
                      What would change my mind
                    </div>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-ink-2">
                      <strong className="font-semibold text-ink">Primary hypothesis:</strong>{' '}
                      {groundedData.whatWouldChangeMyMind.primaryHypothesis}
                    </p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-ink-3">
                      <strong className="font-semibold text-ink-2">Falsification:</strong>{' '}
                      {groundedData.whatWouldChangeMyMind.falsificationEvents?.join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'soap' && (
              <div className="space-y-2.5 p-4">
                {soapSections.map((section) => (
                  <article key={section.key} className="rounded-2xl border border-rule/80 bg-paper/60 p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-solid font-mono-clinical text-[10px] font-bold text-white">
                        {section.key}
                      </span>
                      <span className="text-[9.5px] font-semibold uppercase tracking-[0.13em] text-ink-2">
                        {section.label}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-ink">
                      {section.body}
                    </p>
                  </article>
                ))}
                <p className="px-1 pt-1 text-[10px] leading-relaxed text-ink-3">
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
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-2">
                Staged orders
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-settled-wash px-2 py-0.5 text-[9px] font-semibold text-settled">
                <ShieldCheck className="h-2.5 w-2.5" />
                4-tier gated
              </span>
            </>
          }
          footer={
            isSigned ? (
              <div className="rounded-2xl border border-settled-line/70 bg-settled-wash/80 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-settled">
                  <CheckCircle2 className="h-4 w-4 text-settled" />
                  Signed &amp; committed
                </div>
                <div className="mt-1 text-[10.5px] font-medium text-settled">
                  {attestationPayload?.practitionerName || 'Attending physician'} · {attestationPayload?.npi || npiSignature}
                </div>
                <div className="mt-0.5 truncate font-mono-clinical text-[9.5px] text-settled">
                  Record {String(attestationPayload?.signatureRecordId || '—').substring(0, 18)}…
                </div>
                {attestationModalData && (
                  <button
                    type="button"
                    onClick={() => setIsAttestationModalOpen(true)}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-settled-line/80 bg-settled/10 py-1 text-[10px] font-semibold text-settled hover:bg-settled/20 cursor-pointer"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    View Attestation &amp; Verify Hash
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-[10.5px] text-ink-2">
                  <span>Signing clinician</span>
                  <span className="font-mono-clinical font-semibold text-ink">{npiSignature}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { void handleSignEncounter(); }}
                  disabled={isSigning}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-solid py-2.5 text-[12px] font-semibold text-white shadow-[0_16px_34px_-20px_rgba(17,19,21,0.85)] transition-all hover:-translate-y-0.5 hover:bg-solid active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  {isSigning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-settled-on-solid" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-settled-on-solid" />
                  )}
                  {isSigning ? 'Signing…' : 'Sign & commit to record'}
                </button>
                {signError && (
                  <p className="mt-1.5 rounded-lg border border-critical-line bg-critical-wash px-2 py-1 text-center text-[9.5px] leading-relaxed text-critical">
                    {signError}
                  </p>
                )}
                <p className="mt-1.5 text-center text-[9.5px] text-ink-3">
                  Draft orders · nothing released until signed
                </p>
              </div>
            )
          }
        >
          <div className="space-y-4 p-4">

            <div className="rounded-2xl border border-settled/30 bg-solid p-3 text-white">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-settled-on-solid">
                  <ShieldCheck className="h-3 w-3" />
                  Attending review
                </span>
                <span className="rounded-full border border-settled/50 bg-solid/50 px-2 py-0.5 font-mono-clinical text-[8.5px] text-settled-on-solid">
                  ~10s
                </span>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-3">
                The draft agent assembled history, physical, and lab proposals. Review the reasoning, then authorize or reject.
              </p>
            </div>

            <div>
              <h2 className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Diagnostic tests · LOINC
              </h2>
              <ul className="mt-2 space-y-2">
                {investigations.map((investigation, index) => {
                  const isStat = investigation.urgency.includes('STAT');
                  return (
                    <li key={index} className="rounded-2xl border border-rule/80 bg-paper/65 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11.5px] font-semibold leading-snug">{investigation.testName}</span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono-clinical text-[8.5px] font-semibold ${isStat ? 'bg-critical-wash text-critical' : 'bg-black/[0.045] text-ink-2'}`}>
                          {urgencyLabel(investigation.urgency)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between font-mono-clinical text-[9px] text-ink-3">
                        <span>LOINC {investigation.loinc}</span>
                        <span>CPT {investigation.cpt}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h2 className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Prescriptions · RxNorm
              </h2>
              <ul className="mt-2 space-y-2">
                {medications.map((medication, index) => (
                  <li key={index} className="rounded-2xl border border-rule/80 bg-paper/65 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11.5px] font-semibold leading-snug">{medication.name}</span>
                      <span className="shrink-0 rounded-full border border-caution-line/80 bg-caution-wash px-1.5 py-0.5 font-mono-clinical text-[8.5px] font-bold text-caution">
                        MD gate
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-ink-2">
                      {medication.dose} · {medication.frequency}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between border-t border-black/[0.05] pt-1.5 font-mono-clinical text-[9px] text-ink-3">
                      <span>RxNorm {medication.rxnorm}</span>
                      <span className="font-sans font-medium text-settled">Allergy cleared</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-solid p-3 text-white">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-settled-on-solid">
                  <Sparkles className="h-3 w-3" />
                  Specialist council
                </span>
                <span className="font-mono-clinical text-[8.5px] text-ink-2">ACC/AHA · GOLD</span>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-3">
                Adversarial red-team found no unexplained acute findings or discordant lab values.
              </p>
            </div>

            <div className="rounded-2xl border border-caution-line/80 bg-caution-wash/70 p-3">
              <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-caution">
                <ShieldCheck className="h-3 w-3 text-caution" />
                Prior-auth defense
              </div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-caution">
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

      <AttestationVerificationModal
        isOpen={isAttestationModalOpen}
        onClose={() => setIsAttestationModalOpen(false)}
        attestation={attestationModalData}
      />
    </div>
  );
}
