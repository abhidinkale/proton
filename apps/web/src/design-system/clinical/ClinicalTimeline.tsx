import { type ReactNode, forwardRef } from 'react';
import { Stethoscope, FileText, Pill, Activity, Sparkles } from 'lucide-react';

export interface TimelineEntry {
  id: string;
  date: string;
  time?: string;
  title: string;
  description?: string;
  category: 'consultation' | 'prescription' | 'observation' | 'document' | 'ai_synthesis';
  provenance: 'PHYSICIAN_APPROVED' | 'AI_DRAFT' | 'PATIENT_REPORTED';
  badge?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ClinicalTimelineProps {
  entries: TimelineEntry[];
  className?: string;
}

const categoryIcons = {
  consultation: Stethoscope,
  prescription: Pill,
  observation: Activity,
  document: FileText,
  ai_synthesis: Sparkles
};

export const ClinicalTimeline = forwardRef<HTMLDivElement, ClinicalTimelineProps>(function ClinicalTimeline(
  {
    entries,
    className = ''
  },
  ref
) {
  if (!entries || entries.length === 0) {
    return (
      <div ref={ref} className="text-center py-8 text-xs text-ink-3">
        No clinical timeline entries recorded.
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative pl-8 space-y-6 ${className}`}>
      {/* Vertical Spine */}
      <div className="absolute left-3.5 top-2 bottom-2 w-px bg-paper-2" aria-hidden="true" />

      {entries.map((entry) => {
        const IconComponent = categoryIcons[entry.category] || FileText;
        const isAiDraft = entry.provenance === 'AI_DRAFT';

        return (
          <div key={entry.id} className="relative group">
            {/* Timeline Dot */}
            <div className={`absolute -left-8 top-1.5 w-7 h-7 rounded-full border-2 border-rule flex items-center justify-center shadow-xs ${
              isAiDraft
                ? 'bg-accent-wash text-accent-ink'
                : entry.provenance === 'PHYSICIAN_APPROVED'
                ? 'bg-settled-wash text-settled'
                : 'bg-canvas text-ink-2'
            }`}>
              <IconComponent size={13} />
            </div>

            {/* Event Box */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isAiDraft
                ? 'bg-accent-wash border-accent-line'
                : 'bg-paper border-rule hover:border-rule-strong'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-ink">{entry.title}</h4>
                    {entry.badge}
                    {isAiDraft && (
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-mono font-bold bg-accent-wash text-accent-ink border border-accent-line">
                        AI Draft
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] font-mono text-ink-3 mt-0.5">
                    {entry.date} {entry.time ? `• ${entry.time}` : ''}
                  </p>

                  {entry.description && (
                    <p className="text-xs text-ink-2 mt-1.5 leading-relaxed">
                      {entry.description}
                    </p>
                  )}
                </div>

                {entry.action && (
                  <button
                    type="button"
                    onClick={entry.action.onClick}
                    className="text-xs font-semibold text-ink hover:underline cursor-pointer shrink-0"
                  >
                    {entry.action.label} →
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default ClinicalTimeline;
