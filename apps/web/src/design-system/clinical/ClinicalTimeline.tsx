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
      <div ref={ref} className="text-center py-8 text-xs text-[#88909A]">
        No clinical timeline entries recorded.
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative pl-8 space-y-6 ${className}`}>
      {/* Vertical Spine */}
      <div className="absolute left-3.5 top-2 bottom-2 w-px bg-[#E8E5DC]" aria-hidden="true" />

      {entries.map((entry) => {
        const IconComponent = categoryIcons[entry.category] || FileText;
        const isAiDraft = entry.provenance === 'AI_DRAFT';

        return (
          <div key={entry.id} className="relative group">
            {/* Timeline Dot */}
            <div className={`absolute -left-8 top-1.5 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${
              isAiDraft
                ? 'bg-[#FCE7F3] text-[#9D174D]'
                : entry.provenance === 'PHYSICIAN_APPROVED'
                ? 'bg-[#ECFDF5] text-[#065F46]'
                : 'bg-[#FAF9F6] text-[#575D65]'
            }`}>
              <IconComponent size={13} />
            </div>

            {/* Event Box */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isAiDraft
                ? 'bg-[#FDF2F8] border-[#FBCFE8]'
                : 'bg-white border-[#E8E5DC] hover:border-[#D5D2C9]'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-[#151719]">{entry.title}</h4>
                    {entry.badge}
                    {isAiDraft && (
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-mono font-bold bg-[#FCE7F3] text-[#9D174D] border border-[#FBCFE8]">
                        AI Draft
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] font-mono text-[#88909A] mt-0.5">
                    {entry.date} {entry.time ? `• ${entry.time}` : ''}
                  </p>

                  {entry.description && (
                    <p className="text-xs text-[#575D65] mt-1.5 leading-relaxed">
                      {entry.description}
                    </p>
                  )}
                </div>

                {entry.action && (
                  <button
                    type="button"
                    onClick={entry.action.onClick}
                    className="text-xs font-semibold text-[#151719] hover:underline cursor-pointer shrink-0"
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
