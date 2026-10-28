import { useEffect } from 'react';
import { 
  X, Stethoscope, AlertTriangle, ShieldCheck, Activity, 
  Pill, ArrowRight, TrendingUp, User
} from 'lucide-react';
import type { DoctorDeskPatient } from '../DoctorDeskEncounter';

interface PatientBriefModalProps {
  patient: DoctorDeskPatient | null;
  isOpen: boolean;
  onClose: () => void;
  onBeginConsultation: (patient: DoctorDeskPatient) => void;
}

export default function PatientBriefModal({
  patient,
  isOpen,
  onClose,
  onBeginConsultation
}: PatientBriefModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !patient) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-paper border border-rule rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-sans"
        role="dialog"
        aria-modal="true"
        aria-labelledby="brief-title"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-rule bg-canvas flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-solid text-white flex items-center justify-center shrink-0">
              <User size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="brief-title" className="text-base font-bold text-ink tracking-tight">
                  {patient.name}
                </h2>
                <span className="text-xs text-ink-2 font-medium">
                  ({patient.age}y &bull; {patient.gender})
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-paper-2 text-ink-2 border border-rule">
                  {patient.mrn}
                </span>
              </div>
              <p className="text-xs text-ink-2 mt-0.5 flex items-center gap-2">
                <span>DOB: {patient.dob}</span>
                <span>&bull;</span>
                <span>Visit: <strong className="text-ink">{patient.visitType || 'Standard Consultation'}</strong> ({patient.time})</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-ink-2 hover:text-ink hover:bg-paper-2 rounded-full transition-colors cursor-pointer"
            aria-label="Close patient brief"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Chief Complaint / Visit Reason */}
          <div className="p-4 rounded-2xl bg-caution-wash/60 border border-caution-line/80 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-caution">
              Chief Complaint & Reason for Visit
            </div>
            <p className="text-sm font-semibold text-caution">
              {patient.chiefComplaint}
            </p>
          </div>

          {/* High-Signal Safety Guard (Penicillin/Allergy Alert) */}
          {patient.allergies && patient.allergies.length > 0 && (
            <div className="p-4 rounded-2xl bg-critical-wash border border-critical-line space-y-2">
              <div className="flex items-center gap-2 text-critical">
                <AlertTriangle size={15} className="shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Documented Allergy & Contraindication Guard
                </span>
              </div>
              <div className="text-xs text-critical font-medium">
                {patient.allergies.join(' • ')}
              </div>
              {patient.contraindicationAlert && (
                <p className="text-[11px] text-critical bg-paper/70 p-2 rounded-xl border border-critical-line/70">
                  <strong>Strict Precaution:</strong> {patient.contraindicationAlert.risk}
                </p>
              )}
            </div>
          )}

          {/* Context Intelligence: Two-Column Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Active Conditions */}
            <div className="p-4 rounded-2xl bg-canvas border border-rule space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink-2 uppercase tracking-wider">
                <Activity size={13} className="text-accent-ink" />
                <span>Active Conditions</span>
              </div>
              <ul className="space-y-1 text-xs text-ink">
                {patient.conditions.map((cond, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-ink-2">&bull;</span>
                    <span className="font-medium">{cond}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Current Medications */}
            <div className="p-4 rounded-2xl bg-canvas border border-rule space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink-2 uppercase tracking-wider">
                <Pill size={13} className="text-settled" />
                <span>Active Medications</span>
              </div>
              <ul className="space-y-1 text-xs text-ink">
                {patient.medications.map((med, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-ink-2">&bull;</span>
                    <span className="font-medium">{med}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Vitals & Recent Labs */}
          <div className="p-4 rounded-2xl bg-canvas border border-rule space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink-2 uppercase tracking-wider">
                <TrendingUp size={13} className="text-accent-ink" />
                <span>Current Vitals & Key Biomarkers</span>
              </div>
              <span className="text-[10px] text-ink-2 font-mono">
                BP {patient.vitals.bp} &bull; HR {patient.vitals.hr} &bull; SpO2 {patient.vitals.spo2}
              </span>
            </div>

            {patient.recentLabs && patient.recentLabs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {patient.recentLabs.slice(0, 4).map((lab, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-paper border border-rule flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-ink">{lab.name}</div>
                      <div className="text-[10px] text-ink-2">{lab.date} {lab.note ? `• ${lab.note}` : ''}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                      lab.status === 'high' ? 'bg-critical-wash text-critical border border-critical-line' :
                      lab.status === 'low' ? 'bg-accent-wash text-accent-ink border border-accent-line' :
                      'bg-settled-wash text-settled border border-settled-line'
                    }`}>
                      {lab.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-2 italic">No prior labs recorded in chart.</p>
            )}
          </div>

          {/* Preparation State Note */}
          {patient.preparationState && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-accent-wash/70 border border-accent-line text-xs text-accent-ink font-medium">
              <ShieldCheck size={14} className="text-accent-ink shrink-0" />
              <span>Context Engine: {patient.preparationState}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-rule bg-canvas flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-ink-2 hover:text-ink transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onBeginConsultation(patient);
              onClose();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-solid hover:bg-solid text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Stethoscope size={14} className="text-settled-on-solid" />
            <span>Begin Consultation</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
