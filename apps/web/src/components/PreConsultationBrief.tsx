import { useState } from 'react';
import { 
  Sparkles, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Mic, 
  ArrowRight
} from 'lucide-react';
import type { PatientIntelligence } from '../types/clinicalBrain';

interface PreConsultationBriefProps {
  intelligence: PatientIntelligence | null;
  patientName: string;
  onProceedToConsultation: () => void;
}

export default function PreConsultationBrief({
  intelligence,
  patientName,
  onProceedToConsultation
}: PreConsultationBriefProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!intelligence) return null;

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
                PRE-CONSULTATION PATIENT BRIEF
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-500/30 text-brand-200 border border-brand-400/30">
                10-Second Scan
              </span>
            </div>
            <p className="text-xs text-brand-200/80 mt-0.5">
              Clinical summary for {patientName} before you begin dialogue
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
        <div className="p-6 space-y-5 text-xs">
          {/* Top Grid: Key Trajectory & What Changed */}
          <div>
            <h3 className="font-bold text-brand-200 uppercase tracking-wider text-[11px] mb-2.5 flex items-center gap-1.5">
              <Clock size={13} className="text-brand-400" />
              What changed since last visit
            </h3>

            {intelligence.changes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {intelligence.changes.slice(0, 3).map(ch => (
                  <div key={ch.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
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
                    <span className="text-[10px] text-brand-300/70 block mt-1">
                      Source: {ch.evidence?.title}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic">No significant clinical changes detected since previous encounter.</p>
            )}
          </div>

          {/* Middle 4-column quick check */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-white/10">
            {/* Active Problems */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">
                Active Problems ({intelligence.activeConcerns.length})
              </span>
              {intelligence.activeConcerns.length > 0 ? (
                <ul className="space-y-1 text-slate-200">
                  {intelligence.activeConcerns.slice(0, 2).map((c, i) => (
                    <li key={i} className="truncate">• {c.name}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">None documented</span>
              )}
            </div>

            {/* Current Meds */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">
                Current Meds ({intelligence.currentMedications.length})
              </span>
              {intelligence.currentMedications.length > 0 ? (
                <ul className="space-y-1 text-slate-200">
                  {intelligence.currentMedications.slice(0, 2).map((m, i) => (
                    <li key={i} className="truncate">• {m.name}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">None documented</span>
              )}
            </div>

            {/* Allergies */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">
                Allergies & Alerts ({intelligence.allergies.length})
              </span>
              {intelligence.allergies.length > 0 ? (
                <ul className="space-y-1 text-amber-200 font-medium">
                  {intelligence.allergies.slice(0, 2).map((a, i) => (
                    <li key={i} className="truncate">• {a.allergen}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">No allergies</span>
              )}
            </div>

            {/* Outstanding Items */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">
                Attention Items ({intelligence.outstandingItems.length})
              </span>
              {intelligence.outstandingItems.length > 0 ? (
                <ul className="space-y-1 text-amber-300">
                  {intelligence.outstandingItems.slice(0, 2).map((o, i) => (
                    <li key={i} className="truncate">• {o.title}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">None outstanding</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
