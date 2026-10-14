import { X, ShieldCheck, Database, Calendar, ExternalLink, FileText, UserCheck } from 'lucide-react';
import type { ClinicalEvidence } from '../types/clinicalBrain';

interface EvidenceModalProps {
  evidence: ClinicalEvidence | null;
  isOpen: boolean;
  onClose: () => void;
  onFocusTimeline?: (sourceId: string) => void;
}

export default function EvidenceModal({
  evidence,
  isOpen,
  onClose,
  onFocusTimeline
}: EvidenceModalProps) {
  if (!isOpen || !evidence) return null;

  const provenanceBadge = () => {
    switch (evidence.provenance) {
      case 'FACT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Database size={12} className="text-emerald-600" /> Confirmed Fact
          </span>
        );
      case 'PHYSICIAN ENTERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-sky-50 text-sky-800 border border-sky-200">
            <UserCheck size={12} className="text-sky-600" /> Physician Entered
          </span>
        );
      case 'AI SYNTHESIS':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-violet-50 text-violet-800 border border-violet-200">
            <FileText size={12} className="text-violet-600" /> AI-generated &bull; Review Required
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-surface-overlay)] backdrop-blur-xs flex items-center justify-end p-0 sm:p-4 proton-animate-in">
      <div 
        className="bg-white h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl w-full max-w-lg border-l sm:border border-slate-200 overflow-hidden flex flex-col proton-animate-slide-right"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-drawer-title"
      >
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center border border-brand-200/60 shadow-2xs">
              <ShieldCheck size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="evidence-drawer-title" className="font-bold text-slate-900 text-sm tracking-tight">
                  Clinical Evidence Panel
                </h3>
                <span className="proton-micro-label bg-brand-50 text-brand-700 border border-brand-200 px-1.5 py-0.2 rounded">
                  Provenance
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-[280px]">
                {evidence.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Close Drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="flex items-start justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
            <div>
              <span className="proton-micro-label text-slate-400 block mb-1">
                Clinical Item / Claim
              </span>
              <h4 className="text-base font-bold text-slate-900">
                {evidence.title}
              </h4>
            </div>
            <div>{provenanceBadge()}</div>
          </div>

          {/* Structured Attributes Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div>
              <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Resource Type</span>
              <span className="font-mono font-bold text-slate-800 text-[13px] mt-0.5 block">{evidence.resourceType}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Source Date</span>
              <span className="font-bold text-slate-800 text-[13px] mt-0.5 flex items-center gap-1.5">
                <Calendar size={13} className="text-brand-600" /> {evidence.date}
              </span>
            </div>
          </div>

          {/* Source Excerpt Block */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="proton-micro-label text-slate-500">
                Verbatim Source Excerpt / Value
              </span>
              <span className="text-[10px] text-brand-700 font-medium">Source Grounded</span>
            </div>
            <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 text-xs text-slate-800 leading-relaxed font-sans border-l-4 border-l-brand-600 shadow-2xs">
              <p className="font-medium italic">"{evidence.excerpt}"</p>
            </div>
          </div>

          {/* Grounding & Audit Philosophy Notice */}
          <div className="text-[11px] text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-brand-600" /> Grounded Clinical Intelligence
            </div>
            <p>
              Every clinical insight, change flag, and suggestion in Proton traces back to documented FHIR records. Proton never hallucinates ungrounded facts into the patient's record.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div>
            {onFocusTimeline && (
              <button
                onClick={() => {
                  onFocusTimeline(evidence.sourceId);
                  onClose();
                }}
                className="text-xs font-semibold text-brand-700 hover:text-brand-900 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-brand-50 transition-colors cursor-pointer"
              >
                <ExternalLink size={13} /> Focus in Timeline
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="proton-btn proton-btn-primary text-xs py-2 px-5"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
}
