import { useState } from 'react';
import { 
  Sparkles, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  BookOpen
} from 'lucide-react';
import type { PatientIntelligence, ClinicalEvidence } from '../types/clinicalBrain';
import EvidenceModal from './EvidenceModal';

interface PatientIntelligenceSectionProps {
  intelligence: PatientIntelligence;
  onFocusTimeline?: (sourceId: string) => void;
}

export default function PatientIntelligenceSection({
  intelligence,
  onFocusTimeline
}: PatientIntelligenceSectionProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<ClinicalEvidence | null>(null);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);

  const handleOpenEvidence = (ev?: ClinicalEvidence) => {
    if (!ev) return;
    setSelectedEvidence(ev);
    setIsEvidenceModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Evidence Modal */}
      <EvidenceModal
        evidence={selectedEvidence}
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        onFocusTimeline={onFocusTimeline}
      />

      {/* ================================================== */}
      {/* 1. PATIENT INTELLIGENCE BRIEF                      */}
      {/* ================================================== */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-white/10 text-brand-200 flex items-center justify-center border border-white/10">
              <Sparkles size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-white text-base tracking-tight">
                  PATIENT INTELLIGENCE
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-700/60 text-brand-100 border border-brand-500/30">
                  Clinical Brain
                </span>
              </div>
              <p className="text-xs text-brand-200/90 mt-0.5">
                Before you see this patient &bull; Synthesized from confirmed clinical memory
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-white/10 text-white font-medium border border-white/10">
              {intelligence.changes.length} Clinical Change{intelligence.changes.length === 1 ? '' : 's'} Detected
            </span>
          </div>
        </div>

        {/* Change Detection Alert Cards */}
        <div className="p-6 bg-slate-50/50 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-brand-600" />
              What changed since last consultation
            </h3>
            <span className="text-[11px] font-medium text-slate-400">
              Deterministic temporal comparison
            </span>
          </div>

          {intelligence.changes.length === 0 ? (
            <div className="p-4 bg-white border border-slate-200 rounded-xl text-center text-xs text-slate-500">
              No significant clinical trajectory changes detected since baseline encounter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {intelligence.changes.map((change) => {
                const isCritical = change.severity === 'critical';
                const isWarning = change.severity === 'warning';
                
                const dotColor = isCritical 
                  ? 'bg-red-500' 
                  : isWarning 
                    ? 'bg-amber-500' 
                    : change.category === 'RESOLVED' 
                      ? 'bg-emerald-500' 
                      : 'bg-brand-500';

                const borderAccent = isCritical
                  ? 'border-red-200 bg-red-50/30'
                  : isWarning
                    ? 'border-amber-200 bg-amber-50/20'
                    : 'border-slate-200 bg-white';

                return (
                  <div 
                    key={change.id}
                    className={`p-4 rounded-xl border ${borderAccent} shadow-2xs flex flex-col justify-between transition-all hover:shadow-xs`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${dotColor} shrink-0`} />
                          <span className="text-xs font-bold text-slate-900 tracking-tight">
                            {change.title}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          change.category === 'NEW' ? 'bg-blue-100 text-blue-800' :
                          change.category === 'CHANGED' ? 'bg-amber-100 text-amber-900' :
                          change.category === 'RESOLVED' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {change.category}
                        </span>
                      </div>

                      <p className="text-xs text-slate-800 font-medium leading-relaxed">
                        {change.statement}
                      </p>

                      {change.detail && (
                        <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                          {change.detail}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium truncate max-w-[170px]" title={change.evidence?.title}>
                        Source: {change.evidence?.title} ({change.evidence?.date})
                      </span>
                      <button
                        onClick={() => handleOpenEvidence(change.evidence)}
                        className="text-brand-600 hover:text-brand-800 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        [View source]
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Current Clinical State Grid */}
        <div className="p-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Current Clinical State
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Key Concerns */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Key Concerns</span>
                <span className="text-xs font-semibold text-slate-500">{intelligence.activeConcerns.length}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 min-h-[105px]">
                {intelligence.activeConcerns.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-800">
                    {intelligence.activeConcerns.map((c, i) => (
                      <li key={i} className="flex items-start justify-between gap-1 font-medium">
                        <span className="truncate">• {c.name}</span>
                        {c.evidence && (
                          <button
                            onClick={() => handleOpenEvidence(c.evidence)}
                            className="text-[10px] text-brand-600 hover:underline shrink-0 font-normal cursor-pointer"
                          >
                            [src]
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-400 italic">No active diagnoses recorded</div>
                )}
              </div>
            </div>

            {/* Current Medications */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-800">Current Medications</span>
                <span className="text-xs font-semibold text-purple-700">{intelligence.currentMedications.length}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 min-h-[105px]">
                {intelligence.currentMedications.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-800">
                    {intelligence.currentMedications.map((m, i) => (
                      <li key={i} className="flex items-start justify-between gap-1 font-medium">
                        <span className="truncate text-purple-950">• {m.name}</span>
                        {m.evidence && (
                          <button
                            onClick={() => handleOpenEvidence(m.evidence)}
                            className="text-[10px] text-brand-600 hover:underline shrink-0 font-normal cursor-pointer"
                          >
                            [src]
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-400 italic">No active medications</div>
                )}
              </div>
            </div>

            {/* Allergies */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800">Allergies & Alerts</span>
                <span className="text-xs font-semibold text-amber-700">{intelligence.allergies.length}</span>
              </div>
              <div className={`rounded-xl p-3.5 min-h-[105px] border ${
                intelligence.allergies.length > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200'
              }`}>
                {intelligence.allergies.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-amber-950 font-medium">
                    {intelligence.allergies.map((a, i) => (
                      <li key={i} className="flex items-start justify-between gap-1">
                        <span className="truncate">• {a.allergen}</span>
                        {a.evidence && (
                          <button
                            onClick={() => handleOpenEvidence(a.evidence)}
                            className="text-[10px] text-amber-800 hover:underline shrink-0 font-normal cursor-pointer"
                          >
                            [src]
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-400 italic">No allergies documented</div>
                )}
              </div>
            </div>

            {/* Recent Findings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">Recent Findings</span>
                <span className="text-xs font-semibold text-emerald-700">{intelligence.recentFindings.length}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 min-h-[105px]">
                {intelligence.recentFindings.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-800">
                    {intelligence.recentFindings.slice(0, 3).map((f, i) => (
                      <li key={i} className="flex items-center justify-between gap-1 text-xs">
                        <span className="truncate font-medium">{f.test}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            f.isAbnormal ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {f.value}
                          </span>
                          {f.evidence && (
                            <button
                              onClick={() => handleOpenEvidence(f.evidence)}
                              className="text-[10px] text-brand-600 hover:underline cursor-pointer"
                            >
                              [src]
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-400 italic">No recent labs on record</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Outstanding Attention Items */}
        {intelligence.outstandingItems.length > 0 && (
          <div className="px-6 pb-6">
            <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-700 shrink-0" />
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Outstanding Items Requiring Attention ({intelligence.outstandingItems.length})
                </h4>
              </div>

              <div className="divide-y divide-amber-200/60">
                {intelligence.outstandingItems.map(item => (
                  <div key={item.id} className="py-2.5 first:pt-1 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-amber-950">
                        {item.title}
                      </p>
                      <p className="text-xs text-amber-900 mt-0.5">
                        {item.statement} {item.detail && <span className="text-amber-800/80 font-normal">— {item.detail}</span>}
                      </p>
                    </div>
                    {item.evidence && (
                      <button
                        onClick={() => handleOpenEvidence(item.evidence)}
                        className="text-[11px] font-semibold text-brand-700 hover:underline shrink-0 cursor-pointer self-start sm:self-center"
                      >
                        [View source]
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* 2. CLINICAL STORY (LONGITUDINAL NARRATIVE)         */}
      {/* ================================================== */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-brand-600" />
            <h3 className="font-bold text-slate-900 text-sm tracking-wide uppercase">
              Clinical Story & Longitudinal Narrative
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
            Generated purely from approved FHIR history
          </span>
        </div>

        <div className="p-6 space-y-4">
          {intelligence.clinicalStory.paragraphs.map((p, idx) => (
            <div key={idx} className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/80 leading-relaxed text-slate-800 text-sm">
              <p>{p.text}</p>
              {p.evidenceIds.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Evidence Citations:
                  </span>
                  {p.evidenceIds.map(evId => {
                    const ev = intelligence.evidenceStore[evId];
                    if (!ev) return null;
                    return (
                      <button
                        key={evId}
                        onClick={() => handleOpenEvidence(ev)}
                        className="text-[11px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2 py-0.5 rounded inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <ExternalLink size={10} /> {ev.title} ({ev.date})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
