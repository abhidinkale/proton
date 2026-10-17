import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldAlert, Stethoscope, Sparkles, ArrowUpRight, 
  ChevronRight, Inbox, Clock,
  CheckCircle2, HelpCircle,
  CalendarDays, TrendingUp
} from 'lucide-react';
import Layout from '../components/Layout';
import { operationsService } from '../services/operationsService';
import { OperationsSummaryCard } from '../components/operations/OperationsSummaryCard';
import type { OperationsSummary } from '../types/operations';
import ProvenanceBadge from '../components/ui/ProvenanceBadge';
import ClinicalAlert from '../components/ui/ClinicalAlert';

interface SyntheticPatient {
  id: string;
  fhirId: string;
  name: string;
  ageSex: string;
  dob: string;
  mrn: string;
  visitTime: string;
  acuity: 'HIGH ACUITY' | 'MOD ACUITY' | 'ROUTINE';
  chiefComplaint: string;
  trajectoryHeadline: string;
  trajectoryDelta: string;
  aiHypothesis: string;
  aiEvidence: string[];
  aiUncertainty: string;
  safetyFlag: string | null;
  pendingDecisions: string[];
  confirmedHistory: string[];
  pendingMemoryProposals: number;
}

const SYNTHETIC_ROSTER: SyntheticPatient[] = [
  {
    id: 'eleanor-vance',
    fhirId: '#pt-8841',
    name: 'Eleanor Vance',
    ageSex: '68F',
    dob: '1956-04-12',
    mrn: 'MRN-884192',
    visitTime: '09:00 AM',
    acuity: 'HIGH ACUITY',
    chiefComplaint: 'T2DM Follow-up & Uncontrolled Hypertension with afternoon fatigue',
    trajectoryHeadline: 'HbA1c Escalation + Stage 2 Systolic Drift over 60 days',
    trajectoryDelta: 'HbA1c 7.1% → 8.2% (+1.1%) • BP 146/88 mmHg (prior 132/80) • eGFR 68 mL/min',
    aiHypothesis: 'Glycemic escape on submaximal Metformin monotherapy with mild microvascular cardiorenal progression.',
    aiEvidence: [
      'HbA1c increased from 7.1% to 8.2% in 60-day interval',
      'Fasting glucose averaging 150-160 mg/dL',
      'Metformin 500mg BID monotherapy compliant with food tolerance'
    ],
    aiUncertainty: 'Microalbumin/creatinine ratio pending from today; lifestyle nutrition adherence unquantified.',
    safetyFlag: 'SEVERE PENICILLIN ALLERGY (Beta-Lactam Anaphylaxis History • Strict Contraindication Guard)',
    pendingDecisions: [
      'Titrate Metformin 500mg BID → 1000mg BID',
      'Initiate Empagliflozin 10mg PO QD for cardiorenal risk reduction',
      'Order 3-month comprehensive metabolic panel & HbA1c repeat'
    ],
    confirmedHistory: [
      'Type 2 Diabetes Mellitus (dx 2018)',
      'Essential Hypertension (on Lisinopril 10mg PO QD)',
      'No history of diabetic ketoacidosis'
    ],
    pendingMemoryProposals: 3,
  },
  {
    id: 'arthur-pendelton',
    fhirId: '#pt-9204',
    name: 'Arthur Pendelton',
    ageSex: '74M',
    dob: '1950-11-28',
    mrn: 'MRN-920411',
    visitTime: '09:30 AM',
    acuity: 'MOD ACUITY',
    chiefComplaint: 'Exertional substernal tightness with stair climbing & DOAC review',
    trajectoryHeadline: 'New-onset exertional angina pattern with mild eGFR downward drift',
    trajectoryDelta: 'eGFR 62 → 48 mL/min (-14 mL/min) • HR 84 bpm (Irregular) • Creatinine 1.4 mg/dL',
    aiHypothesis: 'Suspected obstructive coronary ischemia superimposed on non-valvular atrial fibrillation.',
    aiEvidence: [
      'Substernal chest tightness triggered by 2 flights of stairs, relieved in 5 min rest',
      'Elevated total cholesterol 224 mg/dL, LDL 142 mg/dL',
      'Mild renal function decline impacting renally cleared DOAC clearance'
    ],
    aiUncertainty: 'Stress echocardiogram not yet performed; hs-Troponin I baseline currently normal.',
    safetyFlag: 'NSAID HYPERSENSITIVITY + RENAL DOSE CEILING (Avoid all COX-2 inhibitors & monitor DOAC)',
    pendingDecisions: [
      'Order urgent outpatient stress echocardiogram with myocardial perfusion',
      'Initiate Sublingual Nitroglycerin 0.4mg PRN chest discomfort',
      'Titrate Atorvastatin to 40mg PO QD for ASCVD risk reduction'
    ],
    confirmedHistory: [
      'Atrial Fibrillation (Rate controlled, on Apixaban 5mg BID)',
      'Dyslipidemia',
      'Mild CKD Stage 3a'
    ],
    pendingMemoryProposals: 2,
  }
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState<SyntheticPatient>(SYNTHETIC_ROSTER[0]);
  const [acuityFilter, setAcuityFilter] = useState<'ALL' | 'HIGH ACUITY'>('ALL');
  const [operationsSummary, setOperationsSummary] = useState<OperationsSummary>({
    pendingTriageCount: 1,
    urgentRefillCount: 1,
    schedulingCareGapCount: 1,
    openReferralCount: 1,
    emergencyAlertCount: 0,
    totalActiveTasks: 4
  });

  useEffect(() => {
    operationsService.getSummary().then(setOperationsSummary).catch(() => {});
  }, []);

  const filteredRoster = SYNTHETIC_ROSTER.filter(
    (p) => acuityFilter === 'ALL' || p.acuity === acuityFilter
  );

  return (
    <Layout>
      <div className="space-y-6 sm:space-y-8 animate-in fade-in">
        
        {/* ── TOP STATS BAR (4 CARDS) ── */}
        <section aria-label="Clinical command center statistics" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#EAE8E3] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[#6E767E]">
              <span>TODAY'S CLINICAL ROSTER</span>
              <CalendarDays size={14} className="text-[#949CA4]" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111315]">02</span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                1 HIGH ACUITY
              </span>
            </div>
            <p className="text-[11px] text-[#6E767E]">Eleanor Vance, Arthur Pendelton</p>
          </div>

          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#EAE8E3] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[#6E767E]">
              <span>ACTIVE SAFETY RAILS</span>
              <ShieldAlert size={14} className="text-amber-600" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-900">02</span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                ZERO OVERRIDE
              </span>
            </div>
            <p className="text-[11px] text-[#6E767E]">Penicillin & NSAID guards enforced</p>
          </div>

          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#EAE8E3] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[#6E767E]">
              <span>PENDING MEMORY DECISIONS</span>
              <CheckCircle2 size={14} className="text-[#0F766E]" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F766E]">05</span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                PHYSICIAN GATED
              </span>
            </div>
            <p className="text-[11px] text-[#6E767E]">Awaiting clinician commitment to FHIR</p>
          </div>

          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#EAE8E3] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[#6E767E]">
              <span>OPERATIONS OS INBOX</span>
              <Inbox size={14} className="text-sky-600" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111315]">
                {operationsSummary.totalActiveTasks}
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                TRIAGE & REFILLS
              </span>
            </div>
            <p className="text-[11px] text-[#6E767E]">
              <Link to="/operations" className="text-[#0F766E] hover:underline font-medium">
                Open Operations Queue →
              </Link>
            </p>
          </div>
        </section>

        {/* ── OPERATIONS OS SUMMARY STRIP ── */}
        <section aria-label="Operations OS Overview">
          <OperationsSummaryCard 
            summary={operationsSummary} 
            isOffline={operationsService.isOffline()} 
          />
        </section>

        {/* ── MAIN WORKSPACE SPLIT: ATTENTION ROSTER + 10-SEC PRE-CONSULT BRIEF ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT 5 COLUMNS: PATIENT ROSTER */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-[#6E767E] font-medium">
                  TODAY'S CLINICAL ROSTER
                </span>
                <span className="text-xs text-[#949CA4]">({SYNTHETIC_ROSTER.length})</span>
              </div>

              <div className="flex items-center p-0.5 bg-[#EAE8E3] rounded-lg text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setAcuityFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    acuityFilter === 'ALL'
                      ? 'bg-white text-[#111315] font-semibold shadow-2xs'
                      : 'text-[#6E767E] hover:text-[#111315]'
                  }`}
                >
                  ALL
                </button>
                <button
                  type="button"
                  onClick={() => setAcuityFilter('HIGH ACUITY')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    acuityFilter === 'HIGH ACUITY'
                      ? 'bg-red-600 text-white font-semibold shadow-2xs'
                      : 'text-[#6E767E] hover:text-[#111315]'
                  }`}
                >
                  HIGH ACUITY
                </button>
              </div>
            </div>

            {/* Patient Cards */}
            <div className="space-y-3">
              {filteredRoster.map((pt) => {
                const isSelected = selectedPatient.id === pt.id;

                return (
                  <div
                    key={pt.id}
                    onClick={() => setSelectedPatient(pt)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white border-[#111315] shadow-md ring-1 ring-[#111315]'
                        : 'bg-white/80 border-[#EAE8E3] hover:bg-white hover:border-[#D5D2C9] shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-mono text-[#6E767E]">
                          <span className="flex items-center gap-1 font-semibold text-[#111315]">
                            <Clock size={12} /> {pt.visitTime}
                          </span>
                          <span>•</span>
                          <span>{pt.fhirId}</span>
                        </div>
                        <h3 className="text-lg font-bold text-[#111315] tracking-tight mt-1">
                          {pt.name} <span className="font-mono text-xs font-normal text-[#6E767E]">({pt.ageSex})</span>
                        </h3>
                      </div>

                      <span
                        className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                          pt.acuity === 'HIGH ACUITY'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {pt.acuity}
                      </span>
                    </div>

                    <p className="text-xs text-[#50575F] mt-2 font-medium line-clamp-2">
                      {pt.chiefComplaint}
                    </p>

                    <div className="mt-3.5 pt-3 border-t border-[#F2F1EC] flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-[#B91C1C] truncate max-w-[70%] font-medium">
                        {pt.trajectoryDelta}
                      </span>
                      <span className="text-[#0F766E] font-semibold flex items-center gap-0.5 text-xs">
                        Select <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT 7 COLUMNS: 10-SECOND PRE-CONSULTATION SITUATIONAL BRIEF */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-[#EAE8E3] rounded-2xl shadow-sm overflow-hidden">
              
              {/* Brief Top Header */}
              <div className="px-6 py-4 bg-[#111315] text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center">
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-amber-300 font-semibold block">
                      DOCTOR DESK • SITUATIONAL AWARENESS
                    </span>
                    <h2 className="text-sm font-bold tracking-tight text-white leading-none">
                      10-Second Pre-Consultation Brief
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-emerald-400 border border-emerald-400/30 px-2 py-0.5 rounded-md">
                    FHIR R4 SYNTHESIS
                  </span>
                </div>
              </div>

              {/* Brief Body */}
              <div className="p-6 space-y-6">
                
                {/* 1. Who is the patient & why are they here? */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#EAE8E3]">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ProvenanceBadge provenance="PATIENT_FACT" size="xs" />
                      <span className="font-mono text-xs text-[#6E767E]">{selectedPatient.mrn}</span>
                      <span>•</span>
                      <span className="font-mono text-xs text-[#6E767E]">DOB: {selectedPatient.dob}</span>
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight text-[#111315]">
                      {selectedPatient.name}, {selectedPatient.ageSex}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-[#50575F] pt-1">
                      <ProvenanceBadge provenance="PATIENT_REPORTED" size="xs" />
                      <span className="font-medium text-[#111315]">{selectedPatient.chiefComplaint}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/consultation?patient=${selectedPatient.id}`)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111315] hover:bg-[#262A2E] text-white text-xs font-semibold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    <Stethoscope size={15} className="text-emerald-400" />
                    <span>Enter Exam Room</span>
                    <ArrowUpRight size={14} />
                  </button>
                </div>

                {/* 2. What changed? (Temporal Trajectory) */}
                <div className="p-4 bg-[#F8F8F6] rounded-2xl border border-[#EAE8E3] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={15} className="text-[#0F766E]" />
                      <span className="font-mono text-xs font-semibold text-[#111315]">
                        WHAT CHANGED? (TEMPORAL TRAJECTORY)
                      </span>
                    </div>
                    <ProvenanceBadge provenance="CONFIRMED_CLINICAL_DATA" size="xs" />
                  </div>
                  <div className="text-sm font-semibold text-[#111315]">
                    {selectedPatient.trajectoryHeadline}
                  </div>
                  <div className="font-mono text-xs text-[#B91C1C] bg-red-50/80 p-2.5 rounded-xl border border-red-200/80 font-medium">
                    {selectedPatient.trajectoryDelta}
                  </div>
                </div>

                {/* 3. What does AI think? (Explicit Advisory Warning) */}
                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-amber-700" />
                      <span className="font-mono text-xs font-semibold text-amber-950">
                        WHAT DOES THE AI THINK?
                      </span>
                    </div>
                    <ProvenanceBadge provenance="AI_SUGGESTION" size="xs" />
                  </div>
                  
                  <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-medium">
                    {selectedPatient.aiHypothesis}
                  </p>

                  <div className="space-y-1.5 pt-2 border-t border-amber-200/60">
                    <span className="font-mono text-[10px] uppercase text-amber-800 font-semibold block">
                      SUPPORTING EVIDENCE
                    </span>
                    <ul className="space-y-1">
                      {selectedPatient.aiEvidence.map((ev, i) => (
                        <li key={i} className="text-xs text-amber-900 flex items-start gap-1.5">
                          <span className="text-amber-600 mt-1">•</span>
                          <span>{ev}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* What is uncertain? */}
                  <div className="pt-2 border-t border-amber-200/60 flex items-start gap-2 text-xs text-amber-900">
                    <HelpCircle size={14} className="text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-amber-950">Clinical Uncertainty: </span>
                      <span>{selectedPatient.aiUncertainty}</span>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-amber-700/80 pt-1">
                    * AI output is advisory only. Does not replace clinical evaluation or established diagnosis.
                  </div>
                </div>

                {/* 4. Safety Guardrails (Emergency / Warning) */}
                {selectedPatient.safetyFlag && (
                  <ClinicalAlert
                    severity="blocked"
                    title="ACTIVE SAFETY CONTRAINDICATION RAIL"
                    description={selectedPatient.safetyFlag}
                  />
                )}

                {/* 5. What requires clinician decision? & What is already confirmed? */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-white rounded-xl border border-[#EAE8E3] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-[#111315]">
                        REQUIRES CLINICIAN DECISION
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded">
                        PENDING (3)
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-[#50575F]">
                      {selectedPatient.pendingDecisions.map((dec, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                          <span>{dec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-[#EAE8E3] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-[#111315]">
                        CONFIRMED CLINICAL DATA
                      </span>
                      <ProvenanceBadge provenance="CONFIRMED_CLINICAL_DATA" size="xs" />
                    </div>
                    <ul className="space-y-1.5 text-xs text-[#50575F]">
                      {selectedPatient.confirmedHistory.map((hist, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-600 mt-0.5 shrink-0" />
                          <span>{hist}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Brief Footer Quick Links */}
                <div className="pt-4 border-t border-[#EAE8E3] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-[#6E767E]">
                    Longitudinal timeline: <span className="font-semibold text-[#111315]">6 encounters documented</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link
                      to={`/patients/${selectedPatient.id}`}
                      className="text-[#6E767E] hover:text-[#111315] hover:underline font-medium"
                    >
                      View Longitudinal Patient Chart
                    </Link>
                    <button
                      type="button"
                      onClick={() => navigate(`/consultation?patient=${selectedPatient.id}`)}
                      className="text-[#0F766E] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Doctor Desk</span>
                      <ArrowUpRight size={13} />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
