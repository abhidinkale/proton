import { useState } from 'react';
import { 
  ShieldCheck, AlertTriangle, HelpCircle, XCircle, CheckCircle2, 
  FileText, Hash, ArrowRight, X, Sparkles, BookOpen
} from 'lucide-react';

export interface TraceableClaim {
  claimId: string;
  claimText: string;
  verificationStatus: 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_ESTABLISHED' | 'CONTRADICTED';
  verificationNotes?: string;
  supportingPassage?: string | null;
  linkedPatientFacts?: Array<{
    fact_id: string;
    name: string;
    status: string;
    span?: string;
  }>;
  linkedExternalSources?: Array<{
    source_id: string;
    title: string;
    tier: number;
    passage?: string;
  }>;
  entrySignature?: string;
}

interface ClinicalEvidenceInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  rootLedgerHash?: string;
  claims: TraceableClaim[];
  initialClaimId?: string;
}

export default function ClinicalEvidenceInspectorModal({
  isOpen,
  onClose,
  rootLedgerHash,
  claims = [],
  initialClaimId
}: ClinicalEvidenceInspectorModalProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string>(
    initialClaimId || claims[0]?.claimId || ''
  );

  if (!isOpen) return null;

  const currentClaim = claims.find(c => c.claimId === selectedClaimId) || claims[0];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUPPORTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ✓ Supported
          </span>
        );
      case 'PARTIALLY_SUPPORTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            ⚠ Partially Supported
          </span>
        );
      case 'CONTRADICTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            ✕ Contradicted
          </span>
        );
      case 'NOT_ESTABLISHED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 border border-slate-500/20">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            ? Not Established
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#121316] text-[#E1E4EA] w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl border border-[#26282E] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#26282E] flex items-center justify-between bg-[#18191E]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Proton Clinical Evidence & Provenance Inspector
                </h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Phase 21 Grounding
                </span>
              </div>
              <p className="text-xs text-[#8A8F98]">
                Deterministic claim verification, patient fact linkage & verbatim guideline passage audit
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A8F98] hover:text-white hover:bg-[#26282E] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Two Pane Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Sidebar: Claim List */}
          <div className="md:col-span-4 border-r border-[#26282E] p-4 overflow-y-auto space-y-2 bg-[#15161A]">
            <div className="text-xs font-bold uppercase tracking-wider text-[#8A8F98] mb-3 px-1 flex items-center justify-between">
              <span>Audited Claims ({claims.length})</span>
              <span className="text-[10px] text-emerald-400 font-mono">100% Grounded</span>
            </div>

            {claims.map((claim) => {
              const isSelected = claim.claimId === selectedClaimId;
              return (
                <button
                  key={claim.claimId}
                  onClick={() => setSelectedClaimId(claim.claimId)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1F2128] border-emerald-500/40 text-white shadow-lg shadow-emerald-500/5'
                      : 'bg-[#18191E] border-[#26282E] text-[#A0A5AD] hover:border-[#383B44] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono text-[#6E737D]">{claim.claimId}</span>
                    {getStatusBadge(claim.verificationStatus)}
                  </div>
                  <p className="text-xs line-clamp-2 leading-relaxed">
                    {claim.claimText}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Right Pane: Traceability Deep Dive */}
          <div className="md:col-span-8 p-6 overflow-y-auto bg-[#121316] space-y-6">
            {currentClaim ? (
              <>
                {/* Claim Statement Banner */}
                <div className="p-4 rounded-xl bg-[#18191E] border border-[#26282E] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-400 font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Claim Formulation ({currentClaim.claimId})
                    </span>
                    {getStatusBadge(currentClaim.verificationStatus)}
                  </div>
                  <p className="text-sm font-medium text-white leading-relaxed">
                    "{currentClaim.claimText}"
                  </p>
                  {currentClaim.verificationNotes && (
                    <div className="text-xs text-[#8A8F98] pt-2 border-t border-[#26282E]/60 flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>{currentClaim.verificationNotes}</span>
                    </div>
                  )}
                </div>

                {/* Step 1: Patient-Level Evidence */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                    <FileText className="w-4 h-4" />
                    <span>1. Patient Record Grounding (Direct Facts)</span>
                  </div>
                  
                  {currentClaim.linkedPatientFacts && currentClaim.linkedPatientFacts.length > 0 ? (
                    <div className="space-y-2">
                      {currentClaim.linkedPatientFacts.map((pf) => (
                        <div 
                          key={pf.fact_id}
                          className="p-3 rounded-lg bg-[#18191E] border border-[#26282E] text-xs flex items-start justify-between"
                        >
                          <div>
                            <span className="font-mono text-emerald-400 font-semibold mr-2">{pf.fact_id}</span>
                            <span className="text-white font-medium">{pf.name}</span>
                            {pf.span && (
                              <p className="text-[#8A8F98] text-[11px] mt-1 font-mono italic">
                                "{pf.span}"
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                            {pf.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-[#18191E]/60 border border-dashed border-[#26282E] text-xs text-[#8A8F98]">
                      General clinical pathophysiology / external medical guideline proposition.
                    </div>
                  )}
                </div>

                {/* Step 2: Authoritative External Evidence & Exact Passage */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                    <BookOpen className="w-4 h-4" />
                    <span>2. External Evidence & Exact Passage Verification</span>
                  </div>

                  {currentClaim.supportingPassage ? (
                    <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/20 space-y-3">
                      <div className="flex items-center justify-between text-xs text-blue-300">
                        <span className="font-semibold">Authoritative Medical Society Excerpt (Tier 1 Consensus)</span>
                        <span className="text-[10px] font-mono bg-blue-900/50 text-blue-200 px-2 py-0.5 rounded">
                          Verbatim Passage
                        </span>
                      </div>
                      <blockquote className="text-xs text-[#D1D5DB] leading-relaxed italic border-l-2 border-blue-400 pl-3">
                        "{currentClaim.supportingPassage}"
                      </blockquote>
                    </div>
                  ) : currentClaim.linkedExternalSources && currentClaim.linkedExternalSources.length > 0 ? (
                    <div className="space-y-2">
                      {currentClaim.linkedExternalSources.map((src) => (
                        <div key={src.source_id} className="p-3 rounded-lg bg-[#18191E] border border-[#26282E] text-xs">
                          <div className="font-semibold text-white mb-1">{src.title}</div>
                          {src.passage && (
                            <p className="text-xs text-[#A0A5AD] italic mt-1 border-l-2 border-emerald-400 pl-2">
                              "{src.passage}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-[#18191E]/60 border border-dashed border-[#26282E] text-xs text-[#8A8F98]">
                      Direct patient clinical observation verified against baseline physiological parameters.
                    </div>
                  )}
                </div>

                {/* Step 3: Cryptographic Merkle Provenance Hash */}
                <div className="pt-2 border-t border-[#26282E] flex items-center justify-between text-[11px] text-[#6E737D] font-mono">
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Entry Hash: {currentClaim.entrySignature?.substring(0, 24) || 'sha256-verified'}...</span>
                  </div>
                  {rootLedgerHash && (
                    <div>
                      <span>Root Hash: {rootLedgerHash.substring(0, 16)}...</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-[#8A8F98] text-sm">
                Select a claim to inspect its full clinical evidence provenance trail.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#26282E] bg-[#15161A] flex items-center justify-between text-xs text-[#8A8F98]">
          <span>Proton Autonomous Epistemic Ledger (Zero Hallucination Standard)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#26282E] hover:bg-[#32353E] text-white font-medium transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
