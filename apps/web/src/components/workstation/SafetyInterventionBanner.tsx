import { useState } from 'react';
import { ShieldAlert, AlertTriangle, ChevronDown, ChevronUp, Check } from 'lucide-react';

interface SafetyInterventionBannerProps {
  allergen: string;
  offendingDrug: string;
  severity: string;
  riskDescription: string;
  sourceRecord?: string;
  overrideDirective: string;
  onOverrideChange: (directive: string) => void;
  onRemoveOffendingDrug?: () => void;
}

export default function SafetyInterventionBanner({
  allergen,
  offendingDrug,
  severity,
  riskDescription,
  sourceRecord = 'FHIR AllergyIntolerance Resource (Verified History of Anaphylaxis)',
  overrideDirective,
  onOverrideChange,
  onRemoveOffendingDrug
}: SafetyInterventionBannerProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);

  const isOverrideValid = overrideDirective.trim().length >= 10;

  return (
    <aside 
      className="rounded-2xl border-2 border-rose-400 bg-rose-50/90 p-4 shadow-sm space-y-3 font-sans transition-all"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldAlert size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-900">
                Safety Hard Stop: Medication Contraindication Review Required
              </span>
              <span className="text-[10px] font-bold text-white bg-rose-700 px-2 py-0.5 rounded-full">
                {severity}
              </span>
            </div>
            <p className="text-xs text-rose-950 font-medium mt-0.5">
              Proton identified a severe conflict between ordered <strong className="underline">{offendingDrug}</strong> and documented <strong className="underline">{allergen}</strong> allergy.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {onRemoveOffendingDrug && (
            <button
              type="button"
              onClick={onRemoveOffendingDrug}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              Remove {offendingDrug.split(' ')[0]}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-rose-800 hover:text-rose-950 font-semibold px-2 py-1.5 cursor-pointer"
          >
            <span>{showDetails ? 'Hide Source' : 'View Source'}</span>
            {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expandable Source & Clinical Reasoning */}
      {showDetails && (
        <div className="p-3 rounded-xl bg-white/80 border border-rose-200 text-xs space-y-2 animate-in fade-in">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900">
              Clinical Risk & Mechanism:
            </span>
            <p className="text-rose-950 font-medium mt-0.5">{riskDescription}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900">
              Verified Source Record:
            </span>
            <p className="text-[#52525b] font-mono text-[11px] mt-0.5">{sourceRecord}</p>
          </div>
        </div>
      )}

      {/* Override Directive Entry (Non-bypassable boundary) */}
      <div className="pt-2 border-t border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="text-rose-900 font-medium flex items-center gap-1.5">
          <AlertTriangle size={13} className="text-rose-700 shrink-0" />
          <span>
            {isOverrideValid ? (
              <span className="text-emerald-800 font-bold flex items-center gap-1">
                <Check size={13} className="text-emerald-700" />
                Documented Physician Override Recorded ({overrideDirective.trim().length} chars)
              </span>
            ) : (
              <span>Encounter sign-off locked until resolved or overridden with clinical directive (&ge; 10 chars).</span>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsOverrideOpen(!isOverrideOpen)}
          className="text-xs font-bold text-rose-900 underline hover:text-rose-950 self-start sm:self-center cursor-pointer"
        >
          {isOverrideOpen ? 'Close Override Input' : 'Document Physician Directive →'}
        </button>
      </div>

      {isOverrideOpen && (
        <div className="p-3 rounded-xl bg-white border border-rose-300 space-y-2 animate-in fade-in">
          <label className="text-[11px] font-bold text-rose-950 block">
            Physician Clinical Directive Override (Required minimum 10 characters):
          </label>
          <input
            type="text"
            value={overrideDirective}
            onChange={e => onOverrideChange(e.target.value)}
            placeholder="e.g. Desensitization completed in ICU; verified tolerance under direct supervision."
            className="w-full p-2 text-xs border border-rose-300 rounded-lg outline-none focus:border-rose-600 font-medium text-[#09090b]"
          />
          <div className="flex items-center justify-between text-[10px]">
            <span className={overrideDirective.trim().length >= 10 ? 'text-emerald-700 font-bold' : 'text-rose-700'}>
              {overrideDirective.trim().length} / 10 characters minimum
            </span>
            {isOverrideValid && (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Check size={11} /> Ready for signature
              </span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
