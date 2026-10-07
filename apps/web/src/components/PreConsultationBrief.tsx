import { useState } from 'react';
import { 
  Sparkles, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Mic, 
  ArrowRight, 
  ShieldAlert, 
  AlertTriangle, 
  Activity, 
  Pill, 
  FileSpreadsheet,
  Database,
  BookmarkCheck,
  HelpCircle,
  History
} from 'lucide-react';
import type { 
  PatientIntelligence, 
  ClinicalEvidence, 
  FactClaimProvenance 
} from '../types/clinicalBrain';

interface PreConsultationBriefProps {
  intelligence: PatientIntelligence | null;
  patientName: string;
  onProceedToConsultation: () => void;
  onSelectEvidence?: (evidence: ClinicalEvidence) => void;
}

export default function PreConsultationBrief({
  intelligence,
  patientName,
  onProceedToConsultation,
  onSelectEvidence
}: PreConsultationBriefProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!intelligence) return null;

  // Render standardized claim provenance badge
  const renderProvenanceBadge = (prov: FactClaimProvenance | string) => {
    switch (prov) {
      case 'CONFIRMED FACT':
      case 'Confirmed':
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 inline-flex items-center gap-1">
            <BookmarkCheck size={10} /> Confirmed Fact
          </span>
        );
      case 'REPORTED BY PATIENT':
      case 'Reported':
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-blue-500/25 text-blue-200 border border-blue-500/40 inline-flex items-center gap-1">
            Reported by Patient
          </span>
        );
      case 'POSSIBLE DISCREPANCY':
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-500/30 text-amber-200 border border-amber-500/50 inline-flex items-center gap-1">
            <AlertTriangle size={10} /> Discrepancy
          </span>
        );
      case 'NEEDS PHYSICIAN REVIEW':
      case 'Needs review':
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-yellow-500/25 text-yellow-200 border border-yellow-500/40 inline-flex items-center gap-1">
            <HelpCircle size={10} /> Needs Review
          </span>
        );
      case 'AI-INFERRED':
      default:
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-purple-500/30 text-purple-200 border border-purple-500/40 inline-flex items-center gap-1">
            <Sparkles size={10} /> AI-Inferred
          </span>
        );
    }
  };

  // 1. Identify Urgent / Safety Items
  const urgentSafetyAlerts = [
    ...intelligence.allergies.map(a => ({
      type: 'ALLERGY',
      title: `Allergy: ${a.allergen}`,
      detail: a.criticality ? `Risk Level: ${a.criticality} (Severe Anaphylaxis Alert)` : 'Active contraindication in confirmed FHIR memory',
      source: a.evidence?.title || 'AllergyIntolerance Record',
      sourceDate: a.evidence?.date,
      provenance: 'CONFIRMED FACT' as FactClaimProvenance,
      evidence: a.evidence
    })),
    ...intelligence.changes
      .filter(c => c.severity === 'critical')
      .map(c => ({
        type: 'CRITICAL_CHANGE',
        title: c.title,
        detail: c.statement,
        source: c.evidence?.title || 'Clinical Observation',
        sourceDate: c.evidence?.date,
        provenance: 'CONFIRMED FACT' as FactClaimProvenance,
        evidence: c.evidence
      })),
    ...intelligence.outstandingItems
      .filter(o => o.priority === 'high')
      .map(o => ({
        type: 'ATTENTION',
        title: o.title,
        detail: o.statement,
        source: o.evidence?.title || 'Care Plan',
        sourceDate: o.evidence?.date,
        provenance: 'NEEDS PHYSICIAN REVIEW' as FactClaimProvenance,
        evidence: o.evidence
      }))
  ];

  const whatMattersItems = intelligence.whatMattersToday || [];

  return (
    <div className="bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 text-white rounded-2xl shadow-lg border border-brand-800/40 overflow-hidden mb-6">
      {/* Header Bar */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-400/30 flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white text-base tracking-tight">
                PROTON'S CLINICAL BRIEF
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-500/30 text-brand-200 border border-brand-400/30">
                Pre-Consultation Patient Brief &bull; 10-Second Scan
              </span>
            </div>
            <p className="text-xs text-brand-200/80 mt-0.5">
              Rapid physician briefing for {patientName} before you begin dialogue
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-brand-200 transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span className="hidden sm:inline">{isExpanded ? 'Collapse' : 'Expand'}</span>
          </button>
          <button
            onClick={onProceedToConsultation}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Mic size={14} /> Start Consultation <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Expanded Brief Body */}
      {isExpanded && (
        <div className="p-6 space-y-6 text-xs">
          
          {/* HIGH-LEVEL BLOCK: WHAT MATTERS TODAY (Phase 5) */}
          {whatMattersItems.length > 0 && (
            <div className="p-4 rounded-xl bg-brand-900/40 border border-brand-500/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-brand-300 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Sparkles size={14} className="text-brand-400" />
                  What Matters Today ({whatMattersItems.length} key priorities)
                </span>
                <span className="text-[10px] text-brand-300/70">
                  Ranked by clinical urgency &bull; Evidence-backed
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {whatMattersItems.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg bg-black/40 border border-brand-400/20 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="font-bold text-white truncate text-[11px]">{item.title}</span>
                        {renderProvenanceBadge(item.provenance)}
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        {item.statement}
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 truncate max-w-[120px]">
                        {item.sourceDate ? `${item.sourceDate} &bull; ` : ''}{item.source}
                      </span>
                      {onSelectEvidence && item.evidence && (
                        <button
                          type="button"
                          onClick={() => onSelectEvidence(item.evidence)}
                          className="text-brand-300 hover:text-white font-semibold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <Database size={10} /> View evidence
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HIERARCHY 1: URGENT / SAFETY */}
          {urgentSafetyAlerts.length > 0 && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-red-300 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-red-400" />
                  Urgent / Clinical Safety ({urgentSafetyAlerts.length})
                </span>
                <span className="text-[10px] font-semibold text-red-200/80 uppercase tracking-wider bg-red-500/20 px-2 py-0.5 rounded">
                  Priority Gate
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {urgentSafetyAlerts.map((alert, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-black/30 border border-red-500/20 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-0.5 gap-1">
                        <span className="font-semibold text-red-200 truncate">{alert.title}</span>
                        {renderProvenanceBadge(alert.provenance)}
                      </div>
                      <p className="text-slate-300 text-[11px] leading-tight mt-1">{alert.detail}</p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-red-500/20 flex items-center justify-between text-[10px]">
                      <span className="text-red-300/60 truncate">
                        {alert.sourceDate ? `${alert.sourceDate} &bull; ` : ''}{alert.source}
                      </span>
                      {onSelectEvidence && alert.evidence && (
                        <button
                          type="button"
                          onClick={() => onSelectEvidence(alert.evidence!)}
                          className="text-red-300 hover:text-white font-semibold hover:underline cursor-pointer"
                        >
                          View evidence
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HIERARCHY 2: WHAT CHANGED */}
          <div>
            <h3 className="font-bold text-brand-200 uppercase tracking-wider text-[11px] mb-2.5 flex items-center gap-1.5">
              <Clock size={13} className="text-brand-400" />
              What changed since last visit
            </h3>

            {intelligence.changes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {intelligence.changes.slice(0, 3).map(ch => (
                  <div key={ch.id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white truncate">{ch.title}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          ch.severity === 'critical' ? 'bg-red-500/30 text-red-200' :
                          ch.severity === 'warning' ? 'bg-amber-500/30 text-amber-200' : 'bg-brand-500/30 text-brand-200'
                        }`}>
                          {ch.category}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        {ch.statement}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/10 text-[10px]">
                      <span className="text-brand-300/70 truncate max-w-[140px]">
                        {ch.evidence?.date ? `${ch.evidence.date} &bull; ` : ''}{ch.evidence?.title}
                      </span>
                      {onSelectEvidence && ch.evidence ? (
                        <button
                          type="button"
                          onClick={() => onSelectEvidence(ch.evidence)}
                          className="text-brand-300 hover:text-white font-semibold hover:underline cursor-pointer"
                        >
                          View evidence
                        </button>
                      ) : (
                        renderProvenanceBadge(ch.evidence?.provenance === 'FACT' ? 'CONFIRMED FACT' : 'AI-INFERRED')
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic">No significant clinical changes detected since previous encounter.</p>
            )}
          </div>

          {/* HIERARCHY 3, 4, 5, 6: ACTIVE PROBLEMS, MEDICATIONS, RECENT FINDINGS, UNRESOLVED */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-white/10">
            {/* HIERARCHY 3: Active Problems */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Activity size={12} className="text-brand-400" />
                  Active Problems ({intelligence.activeConcerns.length})
                </span>
                {renderProvenanceBadge('CONFIRMED FACT')}
              </div>
              {intelligence.activeConcerns.length > 0 ? (
                <ul className="space-y-1.5 text-slate-200">
                  {intelligence.activeConcerns.slice(0, 3).map((c, i) => (
                    <li key={i} className="text-[11px] flex items-center justify-between gap-1">
                      <span className="truncate flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0"></span>
                        <span className="truncate">{c.name}</span>
                      </span>
                      {onSelectEvidence && c.evidence && (
                        <button
                          type="button"
                          onClick={() => onSelectEvidence(c.evidence!)}
                          className="text-[9px] text-brand-300 hover:text-white shrink-0 hover:underline cursor-pointer"
                        >
                          Evidence
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">None documented</span>
              )}
            </div>

            {/* HIERARCHY 4: Medication Changes / Current Meds */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Pill size={12} className="text-brand-400" />
                  Current Meds ({intelligence.currentMedications.length})
                </span>
                {renderProvenanceBadge('CONFIRMED FACT')}
              </div>
              {intelligence.currentMedications.length > 0 ? (
                <ul className="space-y-1.5 text-slate-200">
                  {intelligence.currentMedications.slice(0, 3).map((m, i) => (
                    <li key={i} className="text-[11px] flex items-center justify-between gap-1">
                      <span className="truncate flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                        <span className="truncate">{m.name}</span>
                      </span>
                      {onSelectEvidence && m.evidence && (
                        <button
                          type="button"
                          onClick={() => onSelectEvidence(m.evidence!)}
                          className="text-[9px] text-brand-300 hover:text-white shrink-0 hover:underline cursor-pointer"
                        >
                          Evidence
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">None documented</span>
              )}
            </div>

            {/* HIERARCHY 5: Recent Important Findings / Labs */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <FileSpreadsheet size={12} className="text-brand-400" />
                  Recent Findings ({intelligence.recentFindings.length})
                </span>
                {renderProvenanceBadge('CONFIRMED FACT')}
              </div>
              {intelligence.recentFindings.length > 0 ? (
                <ul className="space-y-1.5 text-slate-200">
                  {intelligence.recentFindings.slice(0, 3).map((f, i) => (
                    <li key={i} className="text-[11px] flex items-center justify-between gap-1">
                      <span className="truncate">{f.test}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span className={`text-[10px] font-bold font-mono px-1 rounded ${f.isAbnormal ? 'text-amber-300 bg-amber-500/20' : 'text-slate-300'}`}>
                          {f.value}
                        </span>
                        {onSelectEvidence && f.evidence && (
                          <button
                            type="button"
                            onClick={() => onSelectEvidence(f.evidence!)}
                            className="text-[9px] text-brand-300 hover:text-white hover:underline cursor-pointer"
                          >
                            &bull;
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">No recent labs</span>
              )}
            </div>

            {/* HIERARCHY 6: Unresolved / Follow-up Items */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle size={12} className="text-amber-400" />
                  Attention Items ({intelligence.outstandingItems.length})
                </span>
                {renderProvenanceBadge('NEEDS PHYSICIAN REVIEW')}
              </div>
              {intelligence.outstandingItems.length > 0 ? (
                <ul className="space-y-1.5 text-amber-200">
                  {intelligence.outstandingItems.slice(0, 3).map((o, i) => (
                    <li key={i} className="text-[11px] flex items-center justify-between gap-1">
                      <span className="truncate flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0"></span>
                        <span className="truncate">{o.title}</span>
                      </span>
                      {onSelectEvidence && o.evidence && (
                        <button
                          type="button"
                          onClick={() => onSelectEvidence(o.evidence!)}
                          className="text-[9px] text-amber-300 hover:text-white shrink-0 hover:underline cursor-pointer"
                        >
                          Review
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">None outstanding</span>
              )}
            </div>
          </div>

          {/* HIERARCHY 7: RELEVANT HISTORY (Narrative Brief) */}
          {intelligence.clinicalStory && intelligence.clinicalStory.paragraphs.length > 0 && (
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <History size={13} className="text-brand-400" />
                  Relevant Longitudinal History
                </span>
                <span className="text-[9px] font-mono text-slate-400 bg-white/10 px-2 py-0.5 rounded">
                  AI-Generated Clinical Summary &bull; Source Backed
                </span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed italic">
                "{intelligence.clinicalStory.paragraphs[0]?.text}"
              </p>
              {onSelectEvidence && intelligence.clinicalStory.paragraphs[0]?.evidenceIds[0] && (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const evId = intelligence.clinicalStory.paragraphs[0]?.evidenceIds[0];
                      if (evId && intelligence.evidenceStore[evId]) {
                        onSelectEvidence(intelligence.evidenceStore[evId]);
                      }
                    }}
                    className="text-[10px] text-brand-300 hover:text-white font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Database size={10} /> View Source Evidence
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
