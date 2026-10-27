import { useState } from 'react';
import {
  CheckCircle2, Pill, Activity, FlaskConical,
  Zap, Lock, Unlock, UserCheck, Stethoscope, RefreshCw
} from 'lucide-react';

export interface PreConsultSynthesisPayload {
  patientId: string;
  encounterStatus: 'LOCKED_AWAITING_OTP' | 'UNLOCKED_ACTIVE' | 'DOCTOR_APPROVED';
  encounterId?: string;
  preConsultBrief: {
    provenance: string;
    assignedMdBoard: {
      tier1ClinicalLeads: Array<{ id: string; title: string; confidence: number; canonicalGroup?: string }>;
      tier2ParaClinicalConsultants: Array<{ id: string; title: string; role: string }>;
      tier3PreClinicalAdvisor: { id: string; title: string; mechanismNote: string };
    };
    chiefComplaints: string[];
    patientReportedContext: {
      onset: string;
      suspectedTriggers: string[];
    };
    longitudinalMemoryMatch: {
      matchFound: boolean;
      similarityScore: number;
      pastEncounterDate: string;
      documentedAllergies: string[];
      clinicalSynthesis: string;
    };
    aiDraftedDiagnoses: Array<{ id: string; icd10: string; name: string; confidence: number; selected: boolean }>;
    aiRecommendedRx: Array<{
      id: string;
      medicationName: string;
      rxNorm: string;
      dosage: string;
      scheduleSlots: string[];
      frequencyLabel: string;
      foodInstruction: string;
      durationDays: number;
      patientPurpose: string;
      pharmacologyReviewedBy: string;
      safetyGateVerdict: string;
      selected: boolean;
    }>;
    aiRecommendedTests: Array<{
      id: string;
      loinc: string;
      testName: string;
      recommendedBy: string;
      priority: string;
      selected: boolean;
    }>;
    followUpPlan?: {
      checkInIntervalsHours: number[];
      monitoringFocus: string[];
    };
  };
}

interface MDSpecialistBoardPanelProps {
  initialPayload?: PreConsultSynthesisPayload | null;
  patientId?: string;
  onSignedSuccess?: (signedSummary: any) => void;
}

export default function MDSpecialistBoardPanel({
  initialPayload,
  patientId = 'PAT-007',
  onSignedSuccess
}: MDSpecialistBoardPanelProps) {
  const [payload, setPayload] = useState<PreConsultSynthesisPayload | null>(initialPayload || null);
  const [otpInput, setOtpInput] = useState('');
  const [simulationOtp, setSimulationOtp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signedState, setSignedState] = useState<any | null>(null);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<Record<string, boolean>>({ 'dx-1': true, 'dx-2': true });
  const [selectedRx, setSelectedRx] = useState<Record<string, boolean>>({ 'rx-1': true, 'rx-2': true });
  const [selectedTests, setSelectedTests] = useState<Record<string, boolean>>({ 'lab-1': false, 'lab-2': false });

  // Phase 3 Handshake: Request OTP
  const handleRequestAccess = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/encounter/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId })
      });
      const data = await res.json();
      if (data.simulationOtp) {
        setSimulationOtp(data.simulationOtp);
        setOtpInput(data.simulationOtp);
      }
    } catch (err) {
      console.error('Request access error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Phase 3 Handshake: Verify OTP & Unlock
  const handleVerifyOtp = async () => {
    if (!otpInput) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/encounter/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, otp: otpInput })
      });
      const data = await res.json();
      if (data.success) {
        setPayload(data);
      }
    } catch (err) {
      console.error('Verify OTP error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Phase 4: Doctor 1-Click Approve & Sign Encounter
  const handleApproveAndSign = async () => {
    if (!payload) return;
    setIsSigning(true);
    try {
      const activeDiagnoses = payload.preConsultBrief.aiDraftedDiagnoses.filter(d => selectedDiagnoses[d.id]);
      const activeRx = payload.preConsultBrief.aiRecommendedRx.filter(r => selectedRx[r.id]);
      const activeTests = payload.preConsultBrief.aiRecommendedTests.filter(t => selectedTests[t.id]);

      const res = await fetch('/api/encounter/approve-and-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterId: payload.encounterId || `enc-${patientId}-${Date.now()}`,
          patientId,
          physicianDirective: 'Attending Physician reviewed and confirmed 68-MD board synthesis. Prescriptions and advice approved.',
          approvedDiagnoses: activeDiagnoses,
          approvedMedications: activeRx,
          approvedTests: activeTests
        })
      });

      const result = await res.json();
      if (result.success) {
        setSignedState(result);
        if (onSignedSuccess) onSignedSuccess(result);
      }
    } catch (err) {
      console.error('Sign error:', err);
    } finally {
      setIsSigning(false);
    }
  };

  const isUnlocked = payload && payload.encounterStatus === 'UNLOCKED_ACTIVE';
  const brief = payload?.preConsultBrief;

  return (
    <div className="bg-white border border-[#D5D2C9] rounded-xl shadow-xs overflow-hidden mb-8 font-sans">
      {/* 68-MD Specialist Board Header */}
      <div className="bg-[#111315] text-white p-5 border-b border-[#222831]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-sm shadow-inner">
              68-MD
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-editorial text-xl sm:text-2xl text-white font-semibold">
                  NMC MD Specialist Board Synthesis
                </h3>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#1D232C] text-emerald-400 border border-[#2E3643]">
                  AI Resident &bull; Doctor Attending
                </span>
                <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${
                  signedState ? 'bg-emerald-950 text-emerald-300 border-emerald-700' :
                  isUnlocked ? 'bg-blue-950 text-blue-300 border-blue-700' :
                  'bg-amber-950 text-amber-300 border-amber-700'
                }`}>
                  {signedState ? '✓ DOCTOR_APPROVED' : isUnlocked ? 'UNLOCKED_ACTIVE' : 'LOCKED_AWAITING_OTP'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-specialty consensus from 68 NMC MD personas. Physician holds 100% final clinical authority.
              </p>
            </div>
          </div>

          {/* Consent Lock / Unlock Controls */}
          {!isUnlocked && !signedState && (
            <div className="flex items-center gap-2 bg-[#1A1F26] p-2 rounded-lg border border-[#2B3542]">
              <input
                type="text"
                placeholder="Enter 4-Digit OTP"
                maxLength={4}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                className="w-32 bg-[#111315] text-white text-xs px-2.5 py-1.5 rounded border border-[#3A4556] focus:outline-none focus:border-brand-500 font-mono tracking-widest text-center"
              />
              <button
                onClick={handleVerifyOtp}
                disabled={isLoading || !otpInput}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Unlock size={13} /> Unlock
              </button>
              <button
                onClick={handleRequestAccess}
                disabled={isLoading}
                title="Generate OTP (Patient Mobile Companion Simulator)"
                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-[#252C38] transition-colors cursor-pointer"
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
        </div>

        {/* Assigned Board Roles */}
        {brief && (
          <div className="mt-4 pt-4 border-t border-[#222831] grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Tier 1 */}
            <div className="bg-[#171B21] p-2.5 rounded border border-[#27303D]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Tier-1 Clinical Leads (Diagnosis)
              </span>
              <div className="space-y-1">
                {brief.assignedMdBoard.tier1ClinicalLeads.map((lead, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-200 font-medium">
                    <span>{lead.title}</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{(lead.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier 2 */}
            <div className="bg-[#171B21] p-2.5 rounded border border-[#27303D]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Tier-2 Para-Clinical (Rx & Labs)
              </span>
              <div className="space-y-1">
                {brief.assignedMdBoard.tier2ParaClinicalConsultants.map((para, idx) => (
                  <div key={idx} className="text-slate-200">
                    <span className="font-semibold text-slate-100">{para.title}:</span>{' '}
                    <span className="text-slate-400 text-[11px]">{para.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier 3 */}
            <div className="bg-[#171B21] p-2.5 rounded border border-[#27303D]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Tier-3 Pre-Clinical (Mechanism)
              </span>
              <p className="text-[11px] text-amber-200/90 leading-relaxed italic">
                "{brief.assignedMdBoard.tier3PreClinicalAdvisor.mechanismNote}"
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isUnlocked && brief ? (
        <div className="p-6 space-y-6">
          {/* 5-Second Story & Longitudinal Memory Match */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Today's Presentation */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Activity size={14} className="text-brand-600" /> Today's Clinical Presentation & Triggers
              </span>
              <ul className="text-xs text-slate-800 space-y-1 mb-3">
                {brief.chiefComplaints.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500"></span>
                    <span className="font-semibold">{c}</span>
                  </li>
                ))}
              </ul>
              <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-800">Patient-Reported Context (Onset {brief.patientReportedContext.onset}):</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {brief.patientReportedContext.suspectedTriggers.map((t, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* pgvector Longitudinal Match */}
            <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={14} className="text-emerald-600" /> Longitudinal Memory Match ({brief.longitudinalMemoryMatch.pastEncounterDate})
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                  {(brief.longitudinalMemoryMatch.similarityScore * 100).toFixed(0)}% Similarity
                </span>
              </div>
              <div className="mb-2">
                <span className="text-[11px] font-semibold text-slate-700">Documented Allergies: </span>
                {brief.longitudinalMemoryMatch.documentedAllergies.map((a, i) => (
                  <span key={i} className="text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200 mr-1">
                    ⚠️ {a} Allergy
                  </span>
                ))}
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed font-medium bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                {brief.longitudinalMemoryMatch.clinicalSynthesis}
              </p>
            </div>
          </div>

          {/* Interactive Supervision Checklist */}
          <div className="space-y-4">
            {/* Diagnoses */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Stethoscope size={14} className="text-blue-600" /> Drafted Diagnoses (ICD-10)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {brief.aiDraftedDiagnoses.map((dx) => (
                  <label
                    key={dx.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedDiagnoses[dx.id] ? 'bg-blue-50/50 border-blue-300' : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={!!selectedDiagnoses[dx.id]}
                        onChange={(e) => setSelectedDiagnoses({ ...selectedDiagnoses, [dx.id]: e.target.checked })}
                        className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{dx.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">ICD-10: {dx.icd10}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {(dx.confidence * 100).toFixed(0)}% Conf
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Medications with Timings & Food Instructions */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Pill size={14} className="text-emerald-600" /> Staged Pharmacotherapy (RxNorm & Dosage Schedule)
              </h4>
              <div className="space-y-2">
                {brief.aiRecommendedRx.map((rx) => (
                  <div
                    key={rx.id}
                    className={`p-3.5 rounded-lg border transition-colors ${
                      selectedRx[rx.id] ? 'bg-emerald-50/30 border-emerald-300' : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={!!selectedRx[rx.id]}
                          onChange={(e) => setSelectedRx({ ...selectedRx, [rx.id]: e.target.checked })}
                          className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{rx.medicationName}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold border border-emerald-200">
                              ✓ Safety Gate: {rx.safetyGateVerdict}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">RxCUI: {rx.rxNorm}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span><strong>Dose:</strong> {rx.dosage}</span> &bull;
                            <span><strong>Schedule:</strong> {rx.frequencyLabel} (Slots: {rx.scheduleSlots.join(', ')})</span> &bull;
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 font-bold rounded text-[10px]">
                              {rx.foodInstruction}
                            </span> &bull;
                            <span><strong>Duration:</strong> {rx.durationDays} Days</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 italic self-end sm:self-auto">
                        Reviewed by {rx.pharmacologyReviewedBy}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Targeted Lab Orders */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FlaskConical size={14} className="text-purple-600" /> Confirmatory Workup (LOINC)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {brief.aiRecommendedTests.map((lab) => (
                  <label
                    key={lab.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors cursor-pointer ${
                      selectedTests[lab.id] ? 'bg-purple-50 border-purple-300' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!selectedTests[lab.id]}
                        onChange={(e) => setSelectedTests({ ...selectedTests, [lab.id]: e.target.checked })}
                        className="rounded text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                      />
                      <span className="text-xs text-slate-800 font-medium">{lab.testName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">LOINC {lab.loinc}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 1-Click Approve & Sign CTA */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {signedState ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={16} /> Signed by {signedState.signedBy} at {new Date(signedState.signedAt).toLocaleTimeString()} &bull; Synced to Patient Mobile App
                </span>
              ) : (
                <span>
                  Clicking Approve commits an atomic Medplum FHIR transaction and shifts provenance to <strong>DOCTOR_APPROVED</strong>.
                </span>
              )}
            </div>

            {!signedState && (
              <button
                onClick={handleApproveAndSign}
                disabled={isSigning}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSigning ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Committing FHIR Batch...
                  </>
                ) : (
                  <>
                    <UserCheck size={15} /> 1-Click Approve & Sign Encounter
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Locked Consent State */
        <div className="p-8 text-center bg-slate-50/50">
          <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3">
            <Lock size={20} />
          </div>
          <h4 className="font-editorial text-lg text-slate-900 font-semibold">
            Encounter Locked Awaiting Patient Consent
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Proton's 68-MD Specialist Board has pre-compiled the case synthesis. Enter the 4-digit OTP from the patient's companion app or scan their QR code to unlock.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleRequestAccess}
              disabled={isLoading}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Request Access / Generate OTP
            </button>
            {simulationOtp && (
              <span className="text-xs font-mono font-bold bg-amber-100 text-amber-900 px-3 py-2 rounded-lg border border-amber-300">
                Patient App OTP: {simulationOtp}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
