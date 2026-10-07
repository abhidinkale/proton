import { X, ShieldCheck, Database, Calendar, ExternalLink, Sparkles, UserCheck } from 'lucide-react';
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Database size={12} /> Confirmed Clinical Fact
          </span>
        );
      case 'PHYSICIAN ENTERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <UserCheck size={12} /> Physician Entered
          </span>
        );
      case 'AI SYNTHESIS':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Sparkles size={12} /> AI Synthesized &bull; Physician Review
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-modal-title"
      >
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-200">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 id="evidence-modal-title" className="font-bold text-slate-900 text-sm">
                Clinical Evidence & Provenance
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Source Reference: {evidence.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Evidence Record
              </span>
              <h4 className="text-base font-bold text-slate-900 mt-0.5">
                {evidence.title}
              </h4>
            </div>
            <div>{provenanceBadge()}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-400 block font-medium">Resource Type</span>
              <span className="font-semibold text-slate-800 font-mono">{evidence.resourceType}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Record Date</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1">
                <Calendar size={12} className="text-slate-400" /> {evidence.date}
              </span>
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Verified Clinical Excerpt / Value
            </span>
            <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-3.5 text-xs text-slate-800 leading-relaxed font-sans border-l-4 border-l-brand-500">
              "{evidence.excerpt}"
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-normal">
            <strong>Audit & Trust:</strong> Every clinical claim in Proton Intelligence originates directly from approved FHIR resources. Proton does not synthesize ungrounded medical conclusions.
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-3">
          {onFocusTimeline && (
            <button
              onClick={() => {
                onFocusTimeline(evidence.sourceId);
                onClose();
              }}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors cursor-pointer"
            >
              <ExternalLink size={13} /> View in Timeline
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
