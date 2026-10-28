import { 
  X, 
  Database, 
  Activity, 
  Pill, 
  FileText, 
  AlertCircle
} from 'lucide-react';
import type { RelevantContext, ClinicalEvidence } from '../types/clinicalBrain';

interface DuringConsultIntelligenceProps {
  contexts: RelevantContext[];
  onDismissContext: (id: string) => void;
  onSelectEvidence: (evidence: ClinicalEvidence) => void;
  isRecording?: boolean;
}

export default function DuringConsultIntelligence({
  contexts,
  onDismissContext,
  onSelectEvidence,
  isRecording = false
}: DuringConsultIntelligenceProps) {
  if (contexts.length === 0) {
    if (!isRecording) return null;
    return (
      <div className="bg-paper-2 border border-rule rounded-xl p-3 text-xs text-on-solid0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-brand-500" />
          <span className="font-medium text-ink-2">Clinical Context Stream Active</span>
          <span className="text-ink-3">&bull; Historical context surfaces when relevant concepts are discussed</span>
        </div>
        <span className="text-[10px] uppercase font-bold text-ink-3 bg-paper border border-rule px-2 py-0.5 rounded">
          Passive
        </span>
      </div>
    );
  }

  const getCategoryIcon = (category: RelevantContext['category']) => {
    switch (category) {
      case 'medication':
        return <Pill size={13} className="text-settled" />;
      case 'observation':
        return <Activity size={13} className="text-brand-600" />;
      case 'allergy':
        return <AlertCircle size={13} className="text-critical" />;
      case 'note':
      case 'encounter':
      default:
        return <FileText size={13} className="text-accent-ink" />;
    }
  };

  return (
    <div className="proton-during-consult-context bg-gradient-to-r from-brand-50/70 via-paper-2 to-brand-50/40 border border-brand-200 rounded-xl p-4 shadow-xs space-y-3 animate-in fade-in duration-150">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center">
            <FileText size={14} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2">
              Relevant History &bull; Clinical Context
              <span className="text-[10px] font-semibold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-full lowercase normal-case">
                {contexts.length} match{contexts.length > 1 ? 'es' : ''}
              </span>
            </h3>
          </div>
        </div>
        <span className="text-[10px] font-medium text-on-solid0 hidden sm:inline">
          Doctor in control &bull; Non-intrusive background match
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {contexts.map((ctx) => (
          <div 
            key={ctx.id} 
            className="bg-paper border border-rule rounded-lg p-3 shadow-xs hover:border-brand-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {getCategoryIcon(ctx.category)}
                  <span className="font-bold text-xs text-ink truncate">
                    {ctx.title}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase bg-paper-2 text-ink-2 border border-rule">
                    {ctx.provenance}
                  </span>
                  <button
                    onClick={() => onDismissContext(ctx.id)}
                    className="p-1 text-ink-3 hover:text-ink-2 rounded hover:bg-paper-2 cursor-pointer transition-colors"
                    title="Dismiss suggestion"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-ink-2 leading-relaxed font-medium">
                {ctx.statement}
              </p>
            </div>

            <div className="mt-2.5 pt-2 border-t border-rule flex items-center justify-between text-[10px]">
              <span className="text-ink-3 truncate max-w-[140px]">
                {ctx.sourceDate ? `${ctx.sourceDate} &bull; ` : ''}{ctx.source}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectEvidence(ctx.evidence)}
                  className="text-brand-600 hover:text-brand-800 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Database size={10} /> View evidence
                </button>
                <button
                  type="button"
                  onClick={() => onDismissContext(ctx.id)}
                  className="text-ink-3 hover:text-ink-2 font-medium cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
