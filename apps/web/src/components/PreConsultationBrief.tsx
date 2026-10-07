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
  FileSpreadsheet
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

  // 1. Identify Urgent / Safety Items
  const urgentSafetyAlerts = [
    ...intelligence.allergies.map(a => ({
      type: 'ALLERGY',
      title: `Allergy: ${a.allergen}`,
      detail: a.criticality ? `Risk Level: ${a.criticality}` : 'Active contraindication in FHIR memory',
      source: a.evidence?.title || 'AllergyIntolerance Record',
      provenance: 'Confirmed'
    })),
    ...intelligence.changes
      .filter(c => c.severity === 'critical')
      .map(c => ({
        type: 'CRITICAL_CHANGE',
        title: c.title,
        detail: c.statement,
        source: c.evidence?.title || 'Clinical Observation',
        provenance: 'Confirmed'
      })),
    ...intelligence.outstandingItems
      .filter(o => o.priority === 'high')
      .map(o => ({
        type: 'ATTENTION',
        title: o.title,
        detail: o.statement,
        source: o.evidence?.title || 'Care Plan',
        provenance: 'Needs review'
      }))
  ];

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
        <div className="p-6 space-y-6 text-xs">
          
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
                  <div key={idx} className="p-2.5 rounded-lg bg-black/30 border border-red-500/20">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-red-200 truncate">{alert.title}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase bg-red-500/30 text-red-100">
                        {alert.provenance}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-tight mt-1">{alert.detail}</p>
                    <span className="text-[10px] text-red-300/60 block mt-1">Source: {alert.source}</span>
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
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="text-brand-300/70 truncate">
                        Source: {ch.evidence?.title}
                      </span>
                      <span className="text-slate-400 font-mono text-[9px] uppercase">
                        {ch.evidence?.provenance === 'FACT' ? 'Confirmed' : 'AI-generated suggestion'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic">No significant clinical changes detected since previous encounter.</p>
            )}
          </div>

          {/* HIERARCHY 3, 4, 5, 6: ACTIVE PROBLEMS, MEDICATIONS, RECENT FINDINGS, HISTORICAL CONTEXT */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-white/10">
            {/* HIERARCHY 3: Active Problems */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Activity size={12} className="text-brand-400" />
                  Active Problems ({intelligence.activeConcerns.length})
                </span>
                <span className="text-[9px] font-mono text-brand-300 bg-brand-500/20 px-1 rounded">Confirmed</span>
              </div>
              {intelligence.activeConcerns.length > 0 ? (
                <ul className="space-y-1.5 text-slate-200">
                  {intelligence.activeConcerns.slice(0, 3).map((c, i) => (
                    <li key={i} className="truncate text-[11px] flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0"></span>
                      <span className="truncate">{c.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">None documented</span>
              )}
            </div>

            {/* HIERARCHY 4: Current Medications */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Pill size={12} className="text-brand-400" />
                  Current Meds ({intelligence.currentMedications.length})
                </span>
                <span className="text-[9px] font-mono text-brand-300 bg-brand-500/20 px-1 rounded">Confirmed</span>
              </div>
              {intelligence.currentMedications.length > 0 ? (
                <ul className="space-y-1.5 text-slate-200">
                  {intelligence.currentMedications.slice(0, 3).map((m, i) => (
                    <li key={i} className="truncate text-[11px] flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                      <span className="truncate">{m.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">None documented</span>
              )}
            </div>

            {/* HIERARCHY 5: Recent Findings / Labs */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <FileSpreadsheet size={12} className="text-brand-400" />
                  Recent Findings ({intelligence.recentFindings.length})
                </span>
                <span className="text-[9px] font-mono text-brand-300 bg-brand-500/20 px-1 rounded">Confirmed</span>
              </div>
              {intelligence.recentFindings.length > 0 ? (
                <ul className="space-y-1.5 text-slate-200">
                  {intelligence.recentFindings.slice(0, 3).map((f, i) => (
                    <li key={i} className="truncate text-[11px] flex items-center justify-between gap-1">
                      <span className="truncate">{f.test}</span>
                      <span className={`text-[10px] font-bold font-mono px-1 rounded ${f.isAbnormal ? 'text-amber-300 bg-amber-500/20' : 'text-slate-300'}`}>
                        {f.value}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-500 italic">No recent labs</span>
              )}
            </div>

            {/* HIERARCHY 6: Attention / Unresolved */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle size={12} className="text-amber-400" />
                  Attention Items ({intelligence.outstandingItems.length})
                </span>
                <span className="text-[9px] font-mono text-amber-300 bg-amber-500/20 px-1 rounded">Needs review</span>
              </div>
              {intelligence.outstandingItems.length > 0 ? (
                <ul className="space-y-1.5 text-amber-200">
                  {intelligence.outstandingItems.slice(0, 3).map((o, i) => (
                    <li key={i} className="truncate text-[11px] flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0"></span>
                      <span className="truncate">{o.title}</span>
                    </li>
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
