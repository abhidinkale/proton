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
        className="w-full max-w-2xl bg-white border border-[#e4e4e7] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-sans"
        role="dialog"
        aria-modal="true"
        aria-labelledby="brief-title"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#e4e4e7] bg-[#fafaf9] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#111315] text-white flex items-center justify-center shrink-0">
              <User size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="brief-title" className="text-base font-bold text-[#09090b] tracking-tight">
                  {patient.name}
                </h2>
                <span className="text-xs text-[#71717a] font-medium">
                  ({patient.age}y &bull; {patient.gender})
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#f4f4f5] text-[#52525b] border border-[#e4e4e7]">
                  {patient.mrn}
                </span>
              </div>
              <p className="text-xs text-[#52525b] mt-0.5 flex items-center gap-2">
                <span>DOB: {patient.dob}</span>
                <span>&bull;</span>
                <span>Visit: <strong className="text-[#09090b]">{patient.visitType || 'Standard Consultation'}</strong> ({patient.time})</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] rounded-full transition-colors cursor-pointer"
            aria-label="Close patient brief"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Chief Complaint / Visit Reason */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Chief Complaint & Reason for Visit
            </div>
            <p className="text-sm font-semibold text-amber-950">
              {patient.chiefComplaint}
            </p>
          </div>

          {/* High-Signal Safety Guard (Penicillin/Allergy Alert) */}
          {patient.allergies && patient.allergies.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
              <div className="flex items-center gap-2 text-rose-800">
                <AlertTriangle size={15} className="shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Documented Allergy & Contraindication Guard
                </span>
              </div>
              <div className="text-xs text-rose-950 font-medium">
                {patient.allergies.join(' • ')}
              </div>
              {patient.contraindicationAlert && (
                <p className="text-[11px] text-rose-800 bg-white/70 p-2 rounded-xl border border-rose-200/70">
                  <strong>Strict Precaution:</strong> {patient.contraindicationAlert.risk}
                </p>
              )}
            </div>
          )}

          {/* Context Intelligence: Two-Column Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Active Conditions */}
            <div className="p-4 rounded-2xl bg-[#fafaf9] border border-[#e4e4e7] space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#52525b] uppercase tracking-wider">
                <Activity size={13} className="text-[#0284c7]" />
                <span>Active Conditions</span>
              </div>
              <ul className="space-y-1 text-xs text-[#09090b]">
                {patient.conditions.map((cond, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-[#71717a]">&bull;</span>
                    <span className="font-medium">{cond}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Current Medications */}
            <div className="p-4 rounded-2xl bg-[#fafaf9] border border-[#e4e4e7] space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#52525b] uppercase tracking-wider">
                <Pill size={13} className="text-emerald-600" />
                <span>Active Medications</span>
              </div>
              <ul className="space-y-1 text-xs text-[#09090b]">
                {patient.medications.map((med, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-[#71717a]">&bull;</span>
                    <span className="font-medium">{med}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Vitals & Recent Labs */}
          <div className="p-4 rounded-2xl bg-[#fafaf9] border border-[#e4e4e7] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#52525b] uppercase tracking-wider">
                <TrendingUp size={13} className="text-[#0f766e]" />
                <span>Current Vitals & Key Biomarkers</span>
              </div>
              <span className="text-[10px] text-[#71717a] font-mono">
                BP {patient.vitals.bp} &bull; HR {patient.vitals.hr} &bull; SpO2 {patient.vitals.spo2}
              </span>
            </div>

            {patient.recentLabs && patient.recentLabs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {patient.recentLabs.slice(0, 4).map((lab, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-white border border-[#e4e4e7] flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-[#09090b]">{lab.name}</div>
                      <div className="text-[10px] text-[#71717a]">{lab.date} {lab.note ? `• ${lab.note}` : ''}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                      lab.status === 'high' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      lab.status === 'low' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {lab.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#71717a] italic">No prior labs recorded in chart.</p>
            )}
          </div>

          {/* Preparation State Note */}
          {patient.preparationState && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 font-medium">
              <ShieldCheck size={14} className="text-blue-700 shrink-0" />
              <span>Context Engine: {patient.preparationState}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#e4e4e7] bg-[#fafaf9] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#52525b] hover:text-[#09090b] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onBeginConsultation(patient);
              onClose();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#111315] hover:bg-[#262a2e] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Stethoscope size={14} className="text-emerald-400" />
            <span>Begin Consultation</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
