import { useState } from 'react';
import { 
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
      <div className="proton-patient-intelligence bg-paper border border-rule rounded-2xl shadow-xs overflow-hidden">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-solid text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-paper/10 text-brand-200 flex items-center justify-center border border-rule/10">
              <BookOpen size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-white text-base tracking-tight">
                  PATIENT INTELLIGENCE
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-700/60 text-brand-100 border border-brand-500/30">
                  Patient context
                </span>
              </div>
              <p className="text-xs text-brand-200/90 mt-0.5">
                Before you see this patient &bull; Synthesized from confirmed clinical memory
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-paper/10 text-white font-medium border border-rule/10">
              {intelligence.changes.length} Clinical Change{intelligence.changes.length === 1 ? '' : 's'} Detected
            </span>
          </div>
        </div>

        {/* ================================================== */}
        {/* WHAT MATTERS TODAY (HIGH-LEVEL CLINICAL BLOCK)    */}
        {/* ================================================== */}
        {intelligence.whatMattersToday && intelligence.whatMattersToday.length > 0 && (
          <div className="p-6 bg-brand-50/40 border-b border-brand-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-brand-900 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen size={14} className="text-brand-600" />
                What Matters Today ({intelligence.whatMattersToday.length} key priorities)
              </h3>
              <span className="text-[11px] font-medium text-brand-700/80">
                Ranked by clinical urgency &bull; Evidence-backed
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {intelligence.whatMattersToday.map((item) => (
                <div key={item.id} className="bg-paper border border-brand-200/80 rounded-xl p-3 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-xs text-ink truncate">{item.title}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-brand-100 text-brand-800">
                        {item.provenance}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-2 leading-relaxed">
                      {item.statement}
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-rule flex items-center justify-between text-[10px]">
                    <span className="text-ink-3 truncate max-w-[120px]">
                      {item.sourceDate ? `${item.sourceDate} &bull; ` : ''}{item.source}
                    </span>
                    {item.evidence && (
                      <button
                        onClick={() => handleOpenEvidence(item.evidence)}
                        className="text-brand-600 hover:text-brand-800 font-semibold hover:underline cursor-pointer"
                      >
                        [View evidence]
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Change Detection Alert Cards */}
        <div className="p-6 bg-paper-2/50 border-b border-rule">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-ink-2 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-brand-600" />
              What changed since last consultation
            </h3>
            <span className="text-[11px] font-medium text-ink-3">
              Deterministic temporal comparison
            </span>
          </div>

          {intelligence.changes.length === 0 ? (
            <div className="p-4 bg-paper border border-rule rounded-xl text-center text-xs text-on-solid0">
              No significant clinical trajectory changes detected since baseline encounter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {intelligence.changes.map((change) => {
                const isCritical = change.severity === 'critical';
                const isWarning = change.severity === 'warning';
                
                const dotColor = isCritical 
                  ? 'bg-critical-wash0' 
                  : isWarning 
                    ? 'bg-caution-wash0' 
                    : change.category === 'RESOLVED' 
                      ? 'bg-settled-wash0' 
                      : change.category === 'PERSISTENT'
                        ? 'bg-accent-wash0'
                        : change.category === 'UNRESOLVED'
                          ? 'bg-caution-wash0'
                          : 'bg-brand-500';

                const borderAccent = isCritical
                  ? 'border-critical-line bg-critical-wash/30'
                  : isWarning
                    ? 'border-caution-line bg-caution-wash/20'
                    : 'border-rule bg-paper';

                return (
                  <div 
                    key={change.id}
                    className={`p-4 rounded-xl border ${borderAccent} shadow-2xs flex flex-col justify-between transition-all hover:shadow-xs`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${dotColor} shrink-0`} />
                          <span className="text-xs font-bold text-ink tracking-tight">
                            {change.title}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          change.category === 'NEW' ? 'bg-accent-wash text-accent-ink' :
                          change.category === 'CHANGED' ? 'bg-caution-wash text-caution' :
                          change.category === 'RESOLVED' ? 'bg-settled-wash text-settled' :
                          change.category === 'PERSISTENT' ? 'bg-accent-wash text-accent-ink' :
                          change.category === 'UNRESOLVED' ? 'bg-caution-wash text-caution' :
                          change.category === 'POSSIBLE DISCREPANCY' ? 'bg-accent-wash text-accent-ink' :
                          'bg-paper-2 text-ink'
                        }`}>
                          {change.category}
                        </span>
                      </div>

                      <p className="text-xs text-ink font-medium leading-relaxed">
                        {change.statement}
                      </p>

                      {change.detail && (
                        <p className="text-[11px] text-on-solid0 mt-1 leading-normal">
                          {change.detail}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 mt-2 border-t border-rule flex items-center justify-between text-[11px]">
                      <span className="text-ink-3 font-medium truncate max-w-[170px]" title={change.evidence?.title}>
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
          <h3 className="text-xs font-bold text-ink-3 uppercase tracking-wider mb-4">
            Current Clinical State
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Key Concerns */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-2">Key Concerns</span>
                <span className="text-xs font-semibold text-on-solid0">{intelligence.activeConcerns.length}</span>
              </div>
              <div className="bg-paper-2 border border-rule rounded-xl p-3.5 min-h-[105px]">
                {intelligence.activeConcerns.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-ink">
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
                  <div className="text-xs text-ink-3 italic">No active diagnoses recorded</div>
                )}
              </div>
            </div>

            {/* Current Medications */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-accent-ink">Current Medications</span>
                <span className="text-xs font-semibold text-accent-ink">{intelligence.currentMedications.length}</span>
              </div>
              <div className="bg-paper-2 border border-rule rounded-xl p-3.5 min-h-[105px]">
                {intelligence.currentMedications.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-ink">
                    {intelligence.currentMedications.map((m, i) => (
                      <li key={i} className="flex items-start justify-between gap-1 font-medium">
                        <span className="truncate text-accent-ink">• {m.name}</span>
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
                  <div className="text-xs text-ink-3 italic">No active medications</div>
                )}
              </div>
            </div>

            {/* Allergies */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-caution">Allergies & Alerts</span>
                <span className="text-xs font-semibold text-caution">{intelligence.allergies.length}</span>
              </div>
              <div className={`rounded-xl p-3.5 min-h-[105px] border ${
                intelligence.allergies.length > 0 ? 'bg-caution-wash/50 border-caution-line' : 'bg-paper-2 border-rule'
              }`}>
                {intelligence.allergies.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-caution font-medium">
                    {intelligence.allergies.map((a, i) => (
                      <li key={i} className="flex items-start justify-between gap-1">
                        <span className="truncate">• {a.allergen}</span>
                        {a.evidence && (
                          <button
                            onClick={() => handleOpenEvidence(a.evidence)}
                            className="text-[10px] text-caution hover:underline shrink-0 font-normal cursor-pointer"
                          >
                            [src]
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-ink-3 italic">No allergies documented</div>
                )}
              </div>
            </div>

            {/* Recent Findings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-settled">Recent Findings</span>
                <span className="text-xs font-semibold text-settled">{intelligence.recentFindings.length}</span>
              </div>
              <div className="bg-paper-2 border border-rule rounded-xl p-3.5 min-h-[105px]">
                {intelligence.recentFindings.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-ink">
                    {intelligence.recentFindings.slice(0, 3).map((f, i) => (
                      <li key={i} className="flex items-center justify-between gap-1 text-xs">
                        <span className="truncate font-medium">{f.test}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            f.isAbnormal ? 'bg-critical-wash text-critical' : 'bg-rule text-ink-2'
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
                  <div className="text-xs text-ink-3 italic">No recent labs on record</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Outstanding Attention Items */}
        {intelligence.outstandingItems.length > 0 && (
          <div className="px-6 pb-6">
            <div className="p-4 bg-caution-wash/70 border border-caution-line/90 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-caution shrink-0" />
                <h4 className="text-xs font-bold text-caution uppercase tracking-wider">
                  Outstanding Items Requiring Attention ({intelligence.outstandingItems.length})
                </h4>
              </div>

              <div className="divide-y divide-caution-line/60">
                {intelligence.outstandingItems.map(item => (
                  <div key={item.id} className="py-2.5 first:pt-1 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-caution">
                        {item.title}
                      </p>
                      <p className="text-xs text-caution mt-0.5">
                        {item.statement} {item.detail && <span className="text-caution/80 font-normal">: {item.detail}</span>}
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
      <div className="bg-paper border border-rule rounded-2xl shadow-xs overflow-hidden">
        <div className="bg-paper-2 px-6 py-4 border-b border-rule flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-brand-600" />
            <h3 className="font-bold text-ink text-sm tracking-wide uppercase">
              Clinical Story & Longitudinal Narrative
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-ink bg-accent-wash border border-accent-line px-2 py-0.5 rounded">
              AI-GENERATED CLINICAL SUMMARY
            </span>
            <span className="text-[11px] font-semibold text-on-solid0 bg-paper border border-rule px-2 py-0.5 rounded shadow-2xs">
              Physician verification required &bull; Generated purely from approved FHIR history
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {intelligence.clinicalStory.paragraphs.map((p, idx) => (
            <div key={idx} className="bg-paper-2/50 p-4 rounded-xl border border-rule/80 leading-relaxed text-ink text-sm">
              <p>{p.text}</p>
              {p.evidenceIds.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-rule/60 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-ink-3 uppercase tracking-wider">
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
