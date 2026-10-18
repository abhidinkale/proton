import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DoctorDeskEncounter from '../components/DoctorDeskEncounter';
import LegacyEncounterWorkspace from '../components/LegacyEncounterWorkspace';
import { TODAY_CLINIC_SCHEDULE } from '../data/clinicSchedule';

/**
 * Consultation Route Container
 * 
 * Canonical modern implementation:
 * - DoctorDeskEncounter serves as the authoritative modern physician encounter workspace.
 * - LegacyEncounterWorkspace is preserved to retain all prior clinical verification,
 *   intelligence diffing, and PDF generation functionality without visual regression.
 */
export default function Consultation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient');
  const [viewMode, setViewMode] = useState<'desk' | 'legacy'>('desk');

  const selectedDeskPatient = TODAY_CLINIC_SCHEDULE.find(
    p => p.id === patientId || p.id.includes(patientId || '')
  ) || TODAY_CLINIC_SCHEDULE[0];

  if (viewMode === 'legacy') {
    return (
      <LegacyEncounterWorkspace
        patientId={patientId}
        onSwitchToDesk={() => setViewMode('desk')}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F9F8F5]">
      <div className="bg-[#151619] border-b border-[#23252B] px-6 py-2.5 flex items-center justify-between text-xs text-[#A0A5AD]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Encounter Mode: <strong className="text-white">Physician Workspace & Ambient Scribe</strong></span>
        </div>
        <button
          onClick={() => setViewMode('legacy')}
          className="text-[#88909A] hover:text-white underline cursor-pointer text-[11px]"
        >
          Switch to Legacy Verification View →
        </button>
      </div>
      <DoctorDeskEncounter
        patient={selectedDeskPatient}
        onCloseMeeting={() => navigate('/')}
        onBackToDesk={() => navigate('/')}
      />
    </div>
  );
}
