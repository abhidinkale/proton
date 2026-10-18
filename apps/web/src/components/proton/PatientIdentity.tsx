import type { Patient, PatientSummary } from '../../domain/patient/types';
import { AlertTriangle, Activity, User } from 'lucide-react';
import ProtonButton from './ProtonButton';

interface PatientIdentityProps {
  patient: Patient | PatientSummary;
  sticky?: boolean;
  showVitals?: boolean;
  activeEncounterTitle?: string;
  onStartEncounter?: () => void;
  className?: string;
}

export default function PatientIdentity({
  patient,
  sticky = true,
  showVitals = true,
  activeEncounterTitle,
  onStartEncounter,
  className = ''
}: PatientIdentityProps) {
  const isFullPatient = 'vitals' in patient;
  const criticalAllergies = isFullPatient
    ? (patient as Patient).allergies.filter(a => a.isCritical || a.severity === 'anaphylaxis').map(a => a.allergen)
    : (patient as PatientSummary).criticalAllergies;

  return (
    <header
      className={`w-full bg-white border-b border-[#E8E5DC] px-4 sm:px-6 py-3 transition-all z-20 ${
        sticky ? 'sticky top-0 shadow-2xs' : ''
      } ${className}`}
      aria-label={`Patient Identity Context: ${patient.name}`}
    >
      <div className="max-w-[1560px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Patient Primary Identification */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#151619] text-white flex items-center justify-center font-bold text-sm shrink-0">
            <User size={18} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[#151719] tracking-tight truncate">
                {patient.name}
              </h1>
              <span className="text-xs text-[#575D65] font-medium">
                {patient.age}y • {patient.gender.charAt(0).toUpperCase()}
              </span>
              <span className="text-[11px] font-mono text-[#88909A] px-2 py-0.5 rounded-md bg-[#F4F3EE] border border-[#E8E5DC]">
                MRN: {patient.mrn}
              </span>

              {/* Active Encounter State */}
              {activeEncounterTitle && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{activeEncounterTitle}</span>
                </span>
              )}
            </div>

            {/* Critical Allergy Invariant Callout */}
            {criticalAllergies.length > 0 && (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] animate-pulse">
                  <AlertTriangle size={12} className="shrink-0 text-[#EF4444]" />
                  <span>CRITICAL ALLERGY: {criticalAllergies.join(', ')}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Vitals Strip & Quick Action */}
        <div className="flex items-center gap-3 shrink-0">
          {showVitals && isFullPatient && (
            <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#FAF9F6] border border-[#E8E5DC] text-xs font-mono text-[#575D65]">
              <Activity size={13} className="text-emerald-600" />
              <span>BP <strong className="text-[#151719]">{(patient as Patient).vitals.bp}</strong></span>
              <span>•</span>
              <span>HR <strong className="text-[#151719]">{(patient as Patient).vitals.hr}</strong></span>
              <span>•</span>
              <span>SpO2 <strong className="text-[#151719]">{(patient as Patient).vitals.spo2}</strong></span>
              <span>•</span>
              <span>BMI <strong className="text-[#151719]">{(patient as Patient).vitals.bmi}</strong></span>
            </div>
          )}

          {onStartEncounter && (
            <ProtonButton
              variant="rose"
              size="sm"
              onClick={onStartEncounter}
              className="font-bold cursor-pointer"
            >
              Start Consultation
            </ProtonButton>
          )}
        </div>
      </div>
    </header>
  );
}
