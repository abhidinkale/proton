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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-settled-wash text-settled border border-settled-line">
            <Database size={12} className="text-settled" /> Confirmed Fact
          </span>
        );
      case 'PHYSICIAN ENTERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-accent-wash text-accent-ink border border-accent-line">
            <UserCheck size={12} className="text-accent-ink" /> Physician Entered
          </span>
        );
      case 'AI SYNTHESIS':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-accent-wash text-accent-ink border border-accent-line">
            <FileText size={12} className="text-accent-ink" /> AI-generated &bull; Review Required
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-surface-overlay)] backdrop-blur-xs flex items-center justify-end p-0 sm:p-4 proton-animate-in">
      <div 
        className="bg-paper h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl w-full max-w-lg border-l sm:border border-rule overflow-hidden flex flex-col proton-animate-slide-right"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-drawer-title"
      >
        {/* Header */}
        <div className="bg-paper-2 border-b border-rule px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center border border-brand-200/60 shadow-2xs">
              <ShieldCheck size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="evidence-drawer-title" className="font-bold text-ink text-sm tracking-tight">
                  Clinical Evidence Panel
                </h3>
                <span className="proton-micro-label bg-brand-50 text-brand-700 border border-brand-200 px-1.5 py-0.2 rounded">
                  Provenance
                </span>
              </div>
              <p className="text-[11px] text-ink-3 font-mono mt-0.5 truncate max-w-[280px]">
                {evidence.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink-2 p-1.5 rounded-lg hover:bg-rule/60 transition-colors cursor-pointer"
            title="Close Drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="flex items-start justify-between flex-wrap gap-2 pb-2 border-b border-rule">
            <div>
              <span className="proton-micro-label text-ink-3 block mb-1">
                Clinical Item / Claim
              </span>
              <h4 className="text-base font-bold text-ink">
                {evidence.title}
              </h4>
            </div>
            <div>{provenanceBadge()}</div>
          </div>

          {/* Structured Attributes Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-paper-2 p-3.5 rounded-xl border border-rule/80">
            <div>
              <span className="text-ink-3 block font-semibold uppercase tracking-wider text-[10px]">Resource Type</span>
              <span className="font-mono font-bold text-ink text-[13px] mt-0.5 block">{evidence.resourceType}</span>
            </div>
            <div>
              <span className="text-ink-3 block font-semibold uppercase tracking-wider text-[10px]">Source Date</span>
              <span className="font-bold text-ink text-[13px] mt-0.5 flex items-center gap-1.5">
                <Calendar size={13} className="text-brand-600" /> {evidence.date}
              </span>
            </div>
          </div>

          {/* Source Excerpt Block */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="proton-micro-label text-on-solid0">
                Verbatim Source Excerpt / Value
              </span>
              <span className="text-[10px] text-brand-700 font-medium">Source Grounded</span>
            </div>
            <div className="bg-caution-wash/50 border border-caution-line rounded-xl p-4 text-xs text-ink leading-relaxed font-sans border-l-4 border-l-brand-600 shadow-2xs">
              <p className="font-medium italic">"{evidence.excerpt}"</p>
            </div>
          </div>

          {/* Grounding & Audit Philosophy Notice */}
          <div className="text-[11px] text-ink-2 bg-paper-2 p-3.5 rounded-xl border border-rule leading-relaxed space-y-1">
            <div className="font-semibold text-ink flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-brand-600" /> Grounded Clinical Intelligence
            </div>
            <p>
              Every clinical insight, change flag, and suggestion in Proton traces back to documented FHIR records. Proton never hallucinates ungrounded facts into the patient's record.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-paper-2 px-6 py-4 border-t border-rule flex items-center justify-between gap-3 shrink-0">
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
