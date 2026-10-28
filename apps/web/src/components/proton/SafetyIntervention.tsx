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
      bg: 'bg-critical-wash',
      border: 'border-critical-line',
      titleColor: 'text-critical',
      badgeColor: 'bg-critical text-white',
      icon: ShieldAlert,
      iconColor: 'text-critical'
    },
    CRITICAL: {
      bg: 'bg-critical-wash',
      border: 'border-critical-line',
      titleColor: 'text-critical',
      badgeColor: 'bg-critical-wash text-critical border border-critical-line',
      icon: ShieldAlert,
      iconColor: 'text-critical'
    },
    WARNING: {
      bg: 'bg-caution-wash',
      border: 'border-caution-line',
      titleColor: 'text-caution',
      badgeColor: 'bg-caution-wash text-caution border border-caution-line',
      icon: AlertTriangle,
      iconColor: 'text-caution'
    },
    ATTENTION: {
      bg: 'bg-caution-wash/80',
      border: 'border-caution-line',
      titleColor: 'text-caution',
      badgeColor: 'bg-caution-wash text-caution border border-caution-line',
      icon: AlertCircle,
      iconColor: 'text-caution'
    },
    INFO: {
      bg: 'bg-accent-wash',
      border: 'border-accent-line',
      titleColor: 'text-accent-ink',
      badgeColor: 'bg-accent-wash text-accent-ink border border-accent-line',
      icon: Info,
      iconColor: 'text-accent-ink'
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
        <div className={`p-2.5 rounded-2xl bg-paper shadow-xs shrink-0 ${severityConfig.iconColor}`}>
          <IconComponent size={22} />
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          {/* Header & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${severityConfig.badgeColor}`}>
                {intervention.severity.replace('_', ' ')}
              </span>
              <span className="text-xs font-mono text-ink-3">
                {intervention.ruleId}
              </span>
            </div>
            {isHardStop && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-critical">
                <Lock size={12} />
                <span>Deterministic Safety Lock</span>
              </span>
            )}
          </div>

          <div>
            <h3 className={`text-base font-bold tracking-tight ${severityConfig.titleColor}`}>
              {intervention.title}
            </h3>
            <p className="text-xs text-ink-2 mt-1 leading-relaxed">
              {intervention.description}
            </p>
          </div>

          {/* Structured Conflict Breakdown */}
          {(intervention.patientAllergy || intervention.proposedItem) && (
            <div className="p-3.5 bg-paper/80 rounded-2xl border border-black/5 space-y-2 text-xs">
              {intervention.patientAllergy && (
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-ink-3 w-28 shrink-0">Documented Allergy:</span>
                  <span className="font-bold text-critical">
                    {intervention.patientAllergy.allergen} ({intervention.patientAllergy.reaction})
                  </span>
                </div>
              )}
              {intervention.proposedItem && (
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-ink-3 w-28 shrink-0">Blocked Item:</span>
                  <span className="font-bold text-ink">
                    {intervention.proposedItem.name} — <span className="font-normal text-ink-2">{intervention.proposedItem.conflictReason}</span>
                  </span>
                </div>
              )}
              {intervention.sourceGuideline && (
                <div className="flex items-start gap-2 pt-1 border-t border-black/5 text-[11px] text-ink-3">
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
                className="text-xs font-semibold text-critical hover:underline cursor-pointer py-1"
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
            <div className="p-4 bg-paper rounded-2xl border border-rule space-y-3 mt-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <ShieldAlert size={14} className="text-critical" />
                <span>Physician Direct-Order Attestation</span>
              </div>
              <p className="text-[11px] text-ink-2">
                To override this safety intervention, document clinical justification. This directive is cryptographically hashed to the FHIR audit trail.
              </p>
              <textarea
                value={overrideRationale}
                onChange={e => setOverrideRationale(e.target.value)}
                placeholder="Document clinical rationale (e.g. Desensitization protocol completed in ICU)..."
                rows={2}
                className="w-full text-xs p-3 rounded-xl border border-rule outline-none focus:border-rule-strong bg-canvas"
              />
              {validationError && (
                <p className="text-[11px] text-critical font-semibold">{validationError}</p>
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
                  className="bg-critical hover:bg-critical text-white"
                >
                  Sign & Execute Directive
                </ProtonButton>
              </div>
            </div>
          )}

          {overrideSuccess && (
            <div className="p-3 bg-settled-wash border border-settled-line rounded-xl flex items-center gap-2 text-xs text-settled font-semibold">
              <CheckCircle2 size={14} />
              <span>Override rationale cryptographically registered to encounter record.</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
