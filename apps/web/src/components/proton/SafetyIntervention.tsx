import { useState } from 'react';
import type { SafetyIntervention as SafetyInterventionType } from '../../domain/safety/types';
import { ShieldAlert, AlertTriangle, AlertCircle, Info, Lock, CheckCircle2 } from 'lucide-react';
import ProtonButton from './ProtonButton';
import { safetyService } from '../../services/safetyService';

interface SafetyInterventionProps {
  intervention: SafetyInterventionType;
  onOverrideSubmit?: (rationale: string) => void;
  onSelectAlternative?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function SafetyIntervention({
  intervention,
  onOverrideSubmit,
  onSelectAlternative,
  onDismiss,
  className = ''
}: SafetyInterventionProps) {
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [overrideRationale, setOverrideRationale] = useState('');
  const [validationError, setValidationError] = useState('');
  const [overrideSuccess, setOverrideSuccess] = useState(false);

  const isHardStop = intervention.severity === 'HARD_STOP';

  const handleApplyOverride = () => {
    const check = safetyService.validateOverrideRationale(overrideRationale);
    if (!check.valid) {
      setValidationError(check.message);
      return;
    }
    setValidationError('');
    setOverrideSuccess(true);
    onOverrideSubmit?.(overrideRationale);
  };

  const severityConfig = {
    HARD_STOP: {
      bg: 'bg-[#FEF2F2]',
      border: 'border-[#FECACA]',
      titleColor: 'text-[#991B1B]',
      badgeColor: 'bg-[#991B1B] text-white',
      icon: ShieldAlert,
      iconColor: 'text-[#EF4444]'
    },
    CRITICAL: {
      bg: 'bg-[#FEF2F2]',
      border: 'border-[#FECACA]',
      titleColor: 'text-[#991B1B]',
      badgeColor: 'bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]',
      icon: ShieldAlert,
      iconColor: 'text-[#DC2626]'
    },
    WARNING: {
      bg: 'bg-[#FFEDD5]',
      border: 'border-[#FED7AA]',
      titleColor: 'text-[#9A3412]',
      badgeColor: 'bg-[#FFEDD5] text-[#9A3412] border border-[#FED7AA]',
      icon: AlertTriangle,
      iconColor: 'text-[#EA580C]'
    },
    ATTENTION: {
      bg: 'bg-[#FEF08A]/80',
      border: 'border-[#FDE047]',
      titleColor: 'text-[#854D0E]',
      badgeColor: 'bg-[#FEF9C3] text-[#854D0E] border border-[#FDE047]',
      icon: AlertCircle,
      iconColor: 'text-[#CA8A04]'
    },
    INFO: {
      bg: 'bg-[#EFF6FF]',
      border: 'border-[#BFDBFE]',
      titleColor: 'text-[#1E40AF]',
      badgeColor: 'bg-[#DBEAFE] text-[#1E40AF] border border-[#BFDBFE]',
      icon: Info,
      iconColor: 'text-[#2563EB]'
    }
  }[intervention.severity];

  const IconComponent = severityConfig.icon;

  return (
    <aside
      className={`rounded-3xl p-5 sm:p-6 border transition-all ${severityConfig.bg} ${severityConfig.border} ${className}`}
      role="alert"
      aria-live={isHardStop ? 'assertive' : 'polite'}
    >
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-2xl bg-white shadow-xs shrink-0 ${severityConfig.iconColor}`}>
          <IconComponent size={22} />
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          {/* Header & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${severityConfig.badgeColor}`}>
                {intervention.severity.replace('_', ' ')}
              </span>
              <span className="text-xs font-mono text-[#88909A]">
                {intervention.ruleId}
              </span>
            </div>
            {isHardStop && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#991B1B]">
                <Lock size={12} />
                <span>Deterministic Safety Lock</span>
              </span>
            )}
          </div>

          <div>
            <h3 className={`text-base font-bold tracking-tight ${severityConfig.titleColor}`}>
              {intervention.title}
            </h3>
            <p className="text-xs text-[#575D65] mt-1 leading-relaxed">
              {intervention.description}
            </p>
          </div>

          {/* Structured Conflict Breakdown */}
          {(intervention.patientAllergy || intervention.proposedItem) && (
            <div className="p-3.5 bg-white/80 rounded-2xl border border-black/5 space-y-2 text-xs">
              {intervention.patientAllergy && (
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-[#88909A] w-28 shrink-0">Documented Allergy:</span>
                  <span className="font-bold text-[#991B1B]">
                    {intervention.patientAllergy.allergen} ({intervention.patientAllergy.reaction})
                  </span>
                </div>
              )}
              {intervention.proposedItem && (
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-[#88909A] w-28 shrink-0">Blocked Item:</span>
                  <span className="font-bold text-[#151719]">
                    {intervention.proposedItem.name} — <span className="font-normal text-[#575D65]">{intervention.proposedItem.conflictReason}</span>
                  </span>
                </div>
              )}
              {intervention.sourceGuideline && (
                <div className="flex items-start gap-2 pt-1 border-t border-black/5 text-[11px] text-[#88909A]">
                  <span className="font-semibold w-28 shrink-0">Clinical Basis:</span>
                  <span className="italic">{intervention.sourceGuideline}</span>
                </div>
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {onSelectAlternative && (
              <ProtonButton
                variant="primary"
                size="sm"
                onClick={onSelectAlternative}
                className="font-bold cursor-pointer"
              >
                Choose Clinical Alternative
              </ProtonButton>
            )}

            {intervention.overrideAllowed && !overrideSuccess && (
              <button
                type="button"
                onClick={() => setIsOverrideOpen(prev => !prev)}
                className="text-xs font-semibold text-[#991B1B] hover:underline cursor-pointer py-1"
              >
                {isOverrideOpen ? 'Cancel Documented Override' : 'Document Physician Clinical Directive →'}
              </button>
            )}

            {onDismiss && !isHardStop && (
              <ProtonButton
                variant="secondary"
                size="sm"
                onClick={onDismiss}
                className="cursor-pointer"
              >
                Acknowledge & Continue
              </ProtonButton>
            )}
          </div>

          {/* Physician Override Drawer */}
          {isOverrideOpen && !overrideSuccess && (
            <div className="p-4 bg-white rounded-2xl border border-[#E8E5DC] space-y-3 mt-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-[#151719]">
                <ShieldAlert size={14} className="text-[#991B1B]" />
                <span>Physician Direct-Order Attestation</span>
              </div>
              <p className="text-[11px] text-[#575D65]">
                To override this safety intervention, document clinical justification. This directive is cryptographically hashed to the FHIR audit trail.
              </p>
              <textarea
                value={overrideRationale}
                onChange={e => setOverrideRationale(e.target.value)}
                placeholder="Document clinical rationale (e.g. Desensitization protocol completed in ICU)..."
                rows={2}
                className="w-full text-xs p-3 rounded-xl border border-[#E8E5DC] outline-none focus:border-[#151619] bg-[#FAF9F6]"
              />
              {validationError && (
                <p className="text-[11px] text-[#991B1B] font-semibold">{validationError}</p>
              )}
              <div className="flex justify-end gap-2">
                <ProtonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsOverrideOpen(false)}
                >
                  Cancel
                </ProtonButton>
                <ProtonButton
                  variant="primary"
                  size="sm"
                  onClick={handleApplyOverride}
                  className="bg-[#991B1B] hover:bg-[#7F1D1D] text-white"
                >
                  Sign & Execute Directive
                </ProtonButton>
              </div>
            </div>
          )}

          {overrideSuccess && (
            <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl flex items-center gap-2 text-xs text-[#065F46] font-semibold">
              <CheckCircle2 size={14} />
              <span>Override rationale cryptographically registered to encounter record.</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
