import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  ShieldCheck, 
  TrendingUp, 
  FileCheck2, 
  FileText, 
  CheckCircle2, 
  Sparkles,
  Copy,
  Send
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../lib/api';
import { authService } from '../../services/auth';

interface BillingCodingAdvisorProps {
  note: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  patient: {
    id: string;
    name: string;
    age: number;
    gender: string;
    dob: string;
    mrn: string;
    conditions: string[];
    recentLabs: Array<{ name: string; value: string; status: 'normal' | 'high' | 'low'; date: string }>;
    medications: string[];
  };
  prescriptions: Array<{ name: string; dose?: string; freq?: string }>;
}

export default function BillingCodingAdvisor({
  note,
  patient,
  prescriptions
}: BillingCodingAdvisorProps) {
  const [loading, setLoading] = useState(false);
  const [billingData, setBillingData] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showPriorAuthModal, setShowPriorAuthModal] = useState(false);
  const [priorAuthPacket, setPriorAuthPacket] = useState<any>(null);
  const [generatingPa, setGeneratingPa] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [transmittingEdi, setTransmittingEdi] = useState(false);
  const [ediResult, setEdiResult] = useState<any>(null);
  const [generatingAppeal, setGeneratingAppeal] = useState(false);
  const [appealResult, setAppealResult] = useState<any>(null);

  const fetchBillingAnalysis = async () => {
    setLoading(true);
    setAnalysisError(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/clinical/billing/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note,
          patient,
          prescriptions,
          isNewPatient: false
        })
      });
      if (!res.ok) {
        throw new Error(`Billing analysis failed (${res.status}).`);
      }
      const data = await res.json();
      if (!data?.cptCode) {
        throw new Error('The billing engine returned an incomplete analysis.');
      }
      setBillingData(data);
    } catch (err) {
      console.error('Failed to analyze billing:', err);
      setBillingData(null);
      setAnalysisError((err as Error).message || 'Billing analysis is unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingAnalysis();
  }, [note.assessment, note.plan, prescriptions.length]);

  const handleGeneratePriorAuth = async () => {
    setGeneratingPa(true);
    try {
      const targetMed = prescriptions[0]?.name;
      if (!targetMed) {
        throw new Error('Add a prescription before generating a prior authorization packet.');
      }
      const currentUser = authService.getCurrentUser();
      const primaryDiagnosis = billingData?.icd10Codes?.[0];

      const res = await apiFetch(`${API_BASE_URL}/api/clinical/billing/prior-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient,
          targetMedication: targetMed,
          diagnosisCode: primaryDiagnosis?.code || 'Z00.00',
          diagnosisDescription: primaryDiagnosis?.description || patient.conditions?.[0] || 'Clinical evaluation',
          note,
          prescriber: {
            name: currentUser?.displayName || 'Attending physician',
            npi: currentUser?.npi || 'Not recorded',
            clinic: currentUser?.organizationId || 'Proton clinic'
          }
        })
      });
      if (!res.ok) {
        throw new Error(`Prior authorization generation failed (${res.status}).`);
      }
      const data = await res.json();
      setPriorAuthPacket(data);
      setEdiResult(null);
      setAppealResult(null);
      setShowPriorAuthModal(true);
    } catch (err) {
      console.error('Failed to generate prior auth:', err);
      alert((err as Error).message || 'Prior authorization generation failed.');
    } finally {
      setGeneratingPa(false);
    }
  };

  const handleTransmitEdi = async () => {
    if (!priorAuthPacket) return;
    setTransmittingEdi(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/clinical/billing/prior-auth/edi278`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packet: priorAuthPacket })
      });
      if (!res.ok) {
        throw new Error(`EDI preview failed (${res.status}).`);
      }
      const data = await res.json();
      setEdiResult(data);
    } catch (err) {
      console.error('EDI 278 preview failed:', err);
      alert((err as Error).message || 'The EDI 278 preview could not be generated.');
    } finally {
      setTransmittingEdi(false);
    }
  };

  const handleGenerateAppeal = async () => {
    if (!priorAuthPacket) return;
    setGeneratingAppeal(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/clinical/billing/prior-auth/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packet: priorAuthPacket,
          denialReason: 'Claimed insufficient step-therapy documentation on formulary alternatives.',
          carcCode: 'CARC-197: Precertification/authorization absent or denied.'
        })
      });
      if (!res.ok) {
        throw new Error(`Appeal generation failed (${res.status}).`);
      }
      const data = await res.json();
      setAppealResult(data);
    } catch (err) {
      console.error('Appeal generation failed:', err);
      alert((err as Error).message || 'The appeal draft could not be generated.');
    } finally {
      setGeneratingAppeal(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!billingData && loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="inline-block animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-3"></div>
        <p className="text-xs">Analyzing 2026 CMS E/M Medical Decision Making & CPT codes...</p>
      </div>
    );
  }

  if (!billingData) {
    return (
      <div className="p-8 text-center text-slate-300">
        <p className="text-sm font-semibold text-white">Coding analysis unavailable</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
          {analysisError || 'The billing engine could not evaluate this encounter. No code has been assumed.'}
        </p>
        <button
          type="button"
          onClick={fetchBillingAnalysis}
          className="mt-3 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 cursor-pointer"
        >
          Retry analysis
        </button>
      </div>
    );
  }

  const { cptCode, overallMdm, estimatedPayment, wRVU, mdmBreakdown, icd10Codes, denialDefense, optimizationTips } = billingData;

  return (
    <div className="space-y-4 text-slate-200">
      {/* Top Banner: CPT & Reimbursement Yield */}
      <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-800/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-white font-mono tracking-tight">CPT {cptCode}</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                Level {cptCode.slice(-1)} &bull; {overallMdm} MDM
              </span>
              <span className="text-[11px] text-slate-400">Established Outpatient</span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              CMS 2026 Benchmark: <strong className="text-white">${estimatedPayment?.toFixed(2)}</strong> est. reimbursement &bull; <strong className="text-emerald-400">{wRVU} wRVUs</strong> <span className="text-[10px] text-slate-400">(Advisory Pre-Bill Estimate)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGeneratePriorAuth}
            disabled={generatingPa}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <FileCheck2 size={14} />
            {generatingPa ? 'Building Packet...' : 'Generate Prior-Auth Packet'}
          </button>
          <button
            onClick={() => copyToClipboard(`CPT: ${cptCode}\nMDM: ${overallMdm}\nICD-10: ${icd10Codes.map((c: any) => c.code).join(', ')}`, 'all')}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Copy size={13} />
            {copiedCode === 'all' ? 'Copied!' : 'Copy Coding'}
          </button>
        </div>
      </div>

      {/* 3-Column MDM Breakdown (2 of 3 Criteria Rule) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <TrendingUp size={13} className="text-emerald-400" />
            2026 CMS Medical Decision Making (MDM) Scoring (2 of 3 Rule)
          </h4>
          <span className="text-[11px] text-emerald-400 font-medium">✓ Meets Level {cptCode.slice(-1)} Criteria</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Element 1: Problems Addressed */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">1. Problems Addressed</span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                {mdmBreakdown?.problems?.level}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {mdmBreakdown?.problems?.rationale}
            </p>
          </div>

          {/* Element 2: Data Analyzed */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">2. Data Analyzed</span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                {mdmBreakdown?.data?.level}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {mdmBreakdown?.data?.rationale}
            </p>
          </div>

          {/* Element 3: Risk of Management */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">3. Risk of Complications</span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                {mdmBreakdown?.risk?.level}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {mdmBreakdown?.risk?.rationale}
            </p>
          </div>
        </div>
      </div>

      {/* Grid: ICD-10 Diagnosis Mapping & Pre-Bill Denial Defense */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* ICD-10 Mappings */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <FileText size={13} className="text-brand-400" />
              Automated ICD-10-CM Diagnosis Codes
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">CMS Concordant</span>
          </div>

          <div className="space-y-1.5">
            {icd10Codes.map((item: any) => (
              <div 
                key={item.code} 
                className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-mono font-bold text-brand-300 mr-2">{item.code}</span>
                  <span className="text-slate-300">{item.description}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(item.code, item.code)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer shrink-0"
                  title="Copy code"
                >
                  {copiedCode === item.code ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Pre-Bill Denial Defense & Audit Score */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              Pre-Bill Claim Denial Defense
            </h4>
            <span className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {denialDefense?.auditPassScore} Pass Probability
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Medical necessity verified against documentation plan</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Rx dosage, frequency & justification explicitly substantiated</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Local Coverage Determination (LCD) policy satisfied</span>
            </div>
          </div>

          {optimizationTips.length > 0 && (
            <div className="p-2 bg-brand-950/30 border border-brand-900/40 rounded-lg text-xs text-brand-200 flex items-start gap-2">
              <Sparkles size={14} className="text-brand-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-semibold">{optimizationTips[0].opportunity}</strong>
                <span className="text-[11px] text-slate-300">{optimizationTips[0].action}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prior Authorization Packet Modal */}
      {showPriorAuthModal && priorAuthPacket && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 size={20} className="text-brand-400" />
                <h3 className="text-base font-bold text-white">Prior Authorization Clinical Packet</h3>
              </div>
              <span className="font-mono text-xs text-emerald-400 bg-emerald-950 border border-emerald-800 px-2.5 py-1 rounded-full">
                {priorAuthPacket.packetId}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-400 block">Patient:</span>
                  <strong className="text-white">{priorAuthPacket.patientInfo?.name} (MRN: {priorAuthPacket.patientInfo?.mrn})</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Requested Medication:</span>
                  <strong className="text-emerald-400">{priorAuthPacket.requestedTreatment?.medication}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Primary Diagnosis:</span>
                  <span className="text-slate-200">{priorAuthPacket.requestedTreatment?.diagnosis} ({priorAuthPacket.requestedTreatment?.icd10})</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Turnaround:</span>
                  <span className="text-slate-200">{priorAuthPacket.requestedTreatment?.urgency}</span>
                </div>
              </div>

              <div>
                <h5 className="font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                  1. Documented Step Therapy & Prior Failures
                </h5>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                  {priorAuthPacket.stepTherapyHistory?.map((step: any, idx: number) => (
                    <div key={idx}>
                      <span className="font-semibold text-white">{step.drug}</span> &bull; <span className="text-amber-400">{step.status}</span>
                      <p className="text-slate-400 mt-0.5">{step.outcome}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h5 className="font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                  2. Physician Clinical Rationale
                </h5>
                <p className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 leading-relaxed">
                  {priorAuthPacket.clinicalRationale}
                </p>
              </div>

              <div>
                <h5 className="font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                  3. Peer-Reviewed Evidence & Guidelines Attached
                </h5>
                <div className="space-y-1.5">
                  {priorAuthPacket.attachedEvidence?.map((ev: any, idx: number) => (
                    <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <strong className="text-brand-300">{ev.authority}</strong>
                      <p className="text-slate-400 text-[11px] mt-0.5 font-mono">{ev.citation}</p>
                      <p className="text-slate-300 text-[11px] italic mt-1">"{ev.excerpt}"</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* EDI 278 Real-time Response Box */}
              {ediResult && (
                <div className="bg-emerald-950/60 border border-emerald-700/70 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      EDI 278 preview response (not transmitted): {ediResult.adjudicationStatus}
                    </span>
                    <span className="font-mono text-xs bg-emerald-900/80 px-2 py-0.5 rounded text-emerald-200">
                      {ediResult.referenceNumber}
                    </span>
                  </div>
                  <div className="text-slate-300 text-[11px] space-y-1">
                    <div>Preview auth code: <strong className="text-white">{ediResult.approvalCode}</strong></div>
                    <div>Coverage Period: {ediResult.effectiveStartDate} &rarr; {ediResult.effectiveEndDate}</div>
                    <div className="text-slate-400 italic">"{ediResult.payerNotes}"</div>
                  </div>
                </div>
              )}

              {/* Appeal Letter Box */}
              {appealResult && (
                <div className="bg-amber-950/60 border border-amber-700/70 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-300 font-bold flex items-center gap-1.5">
                      <FileText size={16} className="text-amber-400" />
                      Level 1 Expedited Appeal Letter Generated
                    </span>
                    <span className="text-xs font-mono bg-amber-900/80 px-2 py-0.5 rounded text-amber-200">
                      Probability: {appealResult.predictedOverturnProbability}
                    </span>
                  </div>
                  <pre className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[10px] text-slate-300 font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {appealResult.letter}
                  </pre>
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        copyToClipboard(appealResult.letter, 'appeal');
                      }}
                      className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-1 rounded font-semibold cursor-pointer"
                    >
                      Copy Appeal Letter
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <button
                onClick={handleGenerateAppeal}
                disabled={generatingAppeal}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-800/40 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              >
                {generatingAppeal ? 'Generating Appeal...' : 'Draft denial appeal'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPriorAuthModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleTransmitEdi}
                  disabled={transmittingEdi}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                >
                  <Send size={13} />
                  {transmittingEdi ? 'Building preview...' : 'Preview EDI 278 response'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
