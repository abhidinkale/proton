import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldAlert, Stethoscope, Sparkles, ArrowUpRight, 
  Users, FileText, ChevronRight, Inbox
} from 'lucide-react';
import { operationsService } from '../services/operationsService';
import { OperationsSummaryCard } from '../components/operations/OperationsSummaryCard';
import type { OperationsSummary } from '../types/operations';

interface SyntheticPatient {
  id: string;
  fhirId: string;
  name: string;
  ageSex: string;
  visitTime: string;
  acuity: 'HIGH ACUITY' | 'MOD ACUITY' | 'ROUTINE';
  chiefComplaint: string;
  trajectoryHeadline: string;
  trajectoryDelta: string;
  safetyFlag: string | null;
  pendingMemoryProposals: number;
}

const SYNTHETIC_ROSTER: SyntheticPatient[] = [
  {
    id: 'eleanor-vance',
    fhirId: '#pt-8841',
    name: 'Eleanor Vance',
    ageSex: '68F',
    visitTime: '09:00 AM',
    acuity: 'HIGH ACUITY',
    chiefComplaint: 'T2DM Follow-up & Uncontrolled Hypertension',
    trajectoryHeadline: 'HbA1c Escalation + Stage 2 Systolic Drift',
    trajectoryDelta: 'HbA1c 7.1% → 8.2% (+1.1%) • BP 146/88 mmHg',
    safetyFlag: 'SEVERE PENICILLIN ALLERGY (Beta-Lactam Cross-Reactivity Active)',
    pendingMemoryProposals: 3,
  },
  {
    id: 'arthur-pendelton',
    fhirId: '#pt-9204',
    name: 'Arthur Pendelton',
    ageSex: '74M',
    visitTime: '09:30 AM',
    acuity: 'MOD ACUITY',
    chiefComplaint: 'Atrial Fibrillation Rate Control & Renal Function Review',
    trajectoryHeadline: 'eGFR Downward Drift on Current DOAC Regimen',
    trajectoryDelta: 'eGFR 62 → 48 mL/min • HR 84 bpm (Irregular)',
    safetyFlag: 'NSAID CLASS HYPERSENSITIVITY + RENAL DOSE ADJUSTMENT GUARD',
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
    <div className="min-h-screen bg-[#F7F6F2] text-[#111315]">
      
      {/* Top Clinical Command Bar */}
      <div className="bg-white border-b border-[#E4E2DD] px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono-clinical text-xs text-[#5A6065]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>ATTENDING DESK // DR. ARIS THORNE, MD (SUPERVISING: DR. ALEX MORGAN)</span>
            <span>•</span>
            <span className="text-[#0F4C81]">SYNTHETIC COHORT ACTIVE</span>
          </div>
          <h1 className="font-editorial text-3xl sm:text-4xl text-[#111315] mt-0.5">
            Doctor Command Center
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            to="/operations"
            className="px-3.5 py-2 bg-white border border-[#0F4C81]/30 rounded text-xs font-mono-clinical font-medium hover:bg-[#EAE8E1] transition flex items-center gap-1.5 text-[#0F4C81]"
          >
            <Inbox className="w-3.5 h-3.5 text-[#0F4C81]" />
            <span>Operations OS</span>
            {operationsSummary.totalActiveTasks > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
            )}
          </Link>
          <Link
            to="/patients"
            className="px-3.5 py-2 bg-white border border-[#D5D2C9] rounded text-xs font-mono-clinical font-medium hover:bg-[#EAE8E1] transition flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-[#5A6065]" />
            <span>Patients</span>
          </Link>
          <Link
            to="/document-review"
            className="px-3.5 py-2 bg-[#F7F6F2] border border-[#D5D2C9] rounded text-xs font-mono-clinical font-medium hover:bg-[#EAE8E1] transition flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-[#5A6065]" />
            <span>Document Review</span>
          </Link>
          <button
            onClick={() => navigate('/consultation')}
            className="px-4 py-2 bg-[#111315] text-white rounded text-xs font-mono-clinical font-medium hover:bg-[#272B30] transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Start Ambient Encounter</span>
          </button>
        </div>
      </div>

      {/* Practice Telemetry Strip (Hairline Architectural Grid) */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-[#D5D2C9] rounded-md divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DD]">
          <div className="p-4">
            <div className="font-mono-clinical text-[11px] text-[#5A6065]">
              CLINICAL & WORKFLOW ATTENTION CENTER
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono-clinical text-2xl font-semibold">02</span>
              <span className="font-mono-clinical text-xs text-[#B91C1C] bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                1 HIGH ACUITY
              </span>
            </div>
          </div>

          <div className="p-4">
            <div className="font-mono-clinical text-[11px] text-[#5A6065]">
              PATIENT PANEL & CONSULTATIONS
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono-clinical text-2xl font-semibold text-[#0F4C81]">100%</span>
              <span className="font-mono-clinical text-xs text-[#5A6065]">AVG 0.8s COMPUTE</span>
            </div>
          </div>

          <div className="p-4">
            <div className="font-mono-clinical text-[11px] text-[#5A6065]">
              ACTIVE SAFETY INTERCEPTS & PRESCRIPTIONS
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono-clinical text-2xl font-semibold text-amber-700">02</span>
              <span className="font-mono-clinical text-xs text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                ALLERGY / RENAL
              </span>
            </div>
          </div>

          <div className="p-4">
            <div className="font-mono-clinical text-[11px] text-[#5A6065]">
              PENDING FHIR MEMORY GATES
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono-clinical text-2xl font-semibold text-[#047857]">05</span>
              <span className="font-mono-clinical text-xs text-[#047857]">AWAITING SIGN-OFF</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operations OS Attention Strip */}
      <div className="max-w-7xl mx-auto px-6 pt-4">
        <OperationsSummaryCard 
          summary={operationsSummary} 
          isOffline={operationsService.isOffline()} 
        />
      </div>

      {/* Main Split Workspace: Left Attention Roster (5 Cols) + Right 10-Second Pre-Consult Brief (7 Cols) */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT 5 COLS: Acuity-Sorted Patient Roster */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono-clinical text-xs font-semibold uppercase tracking-wider text-[#5A6065]">
              // TODAY'S ATTENTION ROSTER
            </span>
            <div className="flex gap-1 font-mono-clinical text-[11px]">
              <button
                onClick={() => setAcuityFilter('ALL')}
                className={`px-2.5 py-1 rounded border cursor-pointer ${
                  acuityFilter === 'ALL' ? 'bg-[#111315] text-white border-[#111315]' : 'bg-white text-[#5A6065] border-[#D5D2C9]'
                }`}
              >
                ALL (2)
              </button>
              <button
                onClick={() => setAcuityFilter('HIGH ACUITY')}
                className={`px-2.5 py-1 rounded border cursor-pointer ${
                  acuityFilter === 'HIGH ACUITY' ? 'bg-[#B91C1C] text-white border-[#B91C1C]' : 'bg-white text-[#5A6065] border-[#D5D2C9]'
                }`}
              >
                HIGH ACUITY
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredRoster.map((pt) => {
              const isSelected = selectedPatient.id === pt.id;
              return (
                <div
                  key={pt.id}
                  onClick={() => setSelectedPatient(pt)}
                  className={`p-5 rounded-md border transition cursor-pointer ${
                    isSelected 
                      ? 'bg-white border-[#111315] shadow-xs ring-1 ring-[#111315]' 
                      : 'bg-white/70 border-[#D5D2C9] hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-clinical text-xs text-[#5A6065]">{pt.visitTime}</span>
                        <span className="font-mono-clinical text-xs text-[#5A6065]">{pt.fhirId}</span>
                      </div>
                      <h3 className="font-editorial text-2xl text-[#111315] mt-0.5">
                        {pt.name} <span className="font-mono-clinical text-sm text-[#5A6065]">({pt.ageSex})</span>
                      </h3>
                    </div>

                    <span className={`font-mono-clinical text-[10px] px-2 py-0.5 rounded border font-semibold ${
                      pt.acuity === 'HIGH ACUITY'
                        ? 'bg-red-50 text-[#B91C1C] border-red-300'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}>
                      {pt.acuity}
                    </span>
                  </div>

                  <p className="text-xs text-[#5A6065] mt-2 font-medium">
                    {pt.chiefComplaint}
                  </p>

                  <div className="mt-3 pt-3 border-t border-[#E4E2DD] flex items-center justify-between text-xs font-mono-clinical">
                    <span className="text-[#B91C1C] truncate max-w-[75%]">{pt.trajectoryDelta}</span>
                    <span className="text-[#0F4C81] font-semibold flex items-center gap-0.5">
                      Brief <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT 7 COLS: Instant 10-Second Pre-Consultation Situational Brief */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-[#D5D2C9] rounded-md overflow-hidden shadow-2xs">
            
            {/* Brief Top Header */}
            <div className="bg-[#111315] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="font-mono-clinical text-xs tracking-wider uppercase">
                  10-SECOND PRE-CONSULTATION SITUATIONAL BRIEF
                </span>
              </div>
              <span className="font-mono-clinical text-xs text-emerald-400">
                FHIR R4 CONFIRMED MEMORY
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* Patient Identity & Primary Launch */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E2DD] pb-5">
                <div>
                  <div className="font-mono-clinical text-xs text-[#5A6065]">
                    SELECTED PATIENT // {selectedPatient.fhirId}
                  </div>
                  <h2 className="font-editorial text-4xl text-[#111315] mt-0.5">
                    {selectedPatient.name}, {selectedPatient.ageSex}
                  </h2>
                  <p className="text-sm text-[#5A6065] mt-1">{selectedPatient.chiefComplaint}</p>
                </div>

                <button
                  onClick={() => navigate('/consultation')}
                  className="px-5 py-3 bg-[#0F4C81] text-white rounded text-xs font-mono-clinical font-semibold hover:bg-[#0B3B66] transition flex items-center gap-2 shrink-0 cursor-pointer shadow-xs"
                >
                  <span>Enter Exam Room Desk</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>

              {/* Deterministic Temporal Trajectory Box */}
              <div className="p-4 bg-[#F7F6F2] border border-[#E4E2DD] rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono-clinical text-xs font-semibold text-[#0F4C81]">
                    TEMPORAL TRAJECTORY ESCALATION
                  </span>
                  <span className="font-mono-clinical text-[11px] px-2 py-0.5 bg-white border border-[#D5D2C9] rounded">
                    DETERMINISTIC DELTA
                  </span>
                </div>
                <div className="font-semibold text-base text-[#111315]">
                  {selectedPatient.trajectoryHeadline}
                </div>
                <div className="font-mono-clinical text-sm text-[#B91C1C] font-medium">
                  {selectedPatient.trajectoryDelta}
                </div>
              </div>

              {/* Active Pharmacology & Allergy Guardrail Box */}
              {selectedPatient.safetyFlag && (
                <div className="p-4 bg-[#FEF2F2] border border-[#EF4444] rounded flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-[#B91C1C] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-mono-clinical text-xs font-semibold text-[#B91C1C]">
                      ACTIVE DETERMINISTIC SAFETY RAIL
                    </div>
                    <p className="text-xs text-[#7F1D1D] mt-1 font-mono-clinical">
                      {selectedPatient.safetyFlag}
                    </p>
                  </div>
                </div>
              )}

              {/* Quick Actions Footer */}
              <div className="pt-4 border-t border-[#E4E2DD] flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-mono-clinical text-[#5A6065]">
                  Pending FHIR Memory Proposals: <span className="font-semibold text-[#111315]">{selectedPatient.pendingMemoryProposals} items</span>
                </div>
                <div className="flex items-center gap-4">
                  <Link
                    to="/patients"
                    className="text-xs font-mono-clinical text-[#5A6065] hover:text-[#111315] underline"
                  >
                    View Longitudinal Timeline
                  </Link>
                  <button
                    onClick={() => navigate('/consultation')}
                    className="text-xs font-mono-clinical text-[#0F4C81] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open SOAP & Rx Verifier</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
