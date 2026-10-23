import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DoctorGuidedEncounter from '../components/DoctorGuidedEncounter';
import DoctorDeskEncounter from '../components/DoctorDeskEncounter';
import AmbientClinicalCockpit from '../components/AmbientClinicalCockpit';
import LegacyEncounterWorkspace from '../components/LegacyEncounterWorkspace';
import { TODAY_CLINIC_SCHEDULE } from '../data/clinicSchedule';

/**
 * Consultation Route Container
 * 
 * Clinical Ergonomics:
 * - Default: Ambient Clinical Cockpit (World-Class Tri-Pane Ambient Scribe & Autonomous DDx Engine)
 * - Guided Mode (Simple linear 7-step doctor journey)
 * - Multi-Tab Power Workstation (DoctorDeskEncounter)
 * - Legacy Verification View
 */
export default function Consultation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient');
  const initialMode = (searchParams.get('mode') as any) || 'cockpit';
  const [viewMode, setViewMode] = useState<'cockpit' | 'guided' | 'desk' | 'legacy'>(initialMode);

  // Only match when a patient was actually requested: `id.includes('')` is always
  // true and would silently lock every encounter to the first chart in the list.
  const requestedPatient = patientId
    ? TODAY_CLINIC_SCHEDULE.find(p => p.id === patientId || p.id.includes(patientId))
    : undefined;

  // The cockpit's synthetic capture is Arthur Pendelton's cardiometabolic case.
  // Default to that chart so the header, transcript, and orders describe one patient.
  const selectedDeskPatient = requestedPatient
    || TODAY_CLINIC_SCHEDULE.find(p => p.id === 'demo-scenario-d-conflict')
    || TODAY_CLINIC_SCHEDULE[0];

  if (viewMode === 'cockpit') {
    return (
      <AmbientClinicalCockpit
        patient={selectedDeskPatient}
        onBackToDesk={() => navigate('/')}
        onSwitchMode={(mode) => setViewMode(mode)}
      />
    );
  }

  if (viewMode === 'legacy') {
    return (
      <LegacyEncounterWorkspace
        patientId={patientId}
        onSwitchToDesk={() => setViewMode('cockpit')}
      />
    );
  }

  if (viewMode === 'desk') {
    return (
      <div className="flex flex-col gap-4">
        <div className="proton-glass proton-specular flex flex-wrap items-center justify-between gap-3 rounded-full px-4 py-2">
          <div className="flex items-center gap-2 text-[11px] text-[#6E757C]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-[#111315]">Power desk</span>
            <span className="hidden sm:inline">· multi-tab encounter</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <button
              onClick={() => setViewMode('cockpit')}
              className="rounded-full px-3 py-1.5 font-medium text-[#6E757C] transition-colors hover:bg-white/70 hover:text-[#111315] cursor-pointer"
            >
              Cockpit
            </button>
            <button
              onClick={() => setViewMode('guided')}
              className="rounded-full px-3 py-1.5 font-medium text-[#6E757C] transition-colors hover:bg-white/70 hover:text-[#111315] cursor-pointer"
            >
              Guided
            </button>
            <button
              onClick={() => setViewMode('legacy')}
              className="rounded-full px-3 py-1.5 font-medium text-[#6E757C] transition-colors hover:bg-white/70 hover:text-[#111315] cursor-pointer"
            >
              Legacy
            </button>
          </div>
        </div>
        <DoctorDeskEncounter
          patient={selectedDeskPatient}
          onCloseMeeting={() => navigate('/')}
          onBackToDesk={() => navigate('/')}
        />
      </div>
    );
  }

  return (
    <DoctorGuidedEncounter
      initialPatientId={patientId}
      initialAction={searchParams.get('action')}
      onSwitchToPowerDesk={() => setViewMode('desk')}
      onFinishEncounter={() => navigate('/')}
    />
  );
}
