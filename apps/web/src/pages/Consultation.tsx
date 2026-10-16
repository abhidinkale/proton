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
    <div className="relative">
      <div className="bg-[#121824] border-b border-[#1c2433] px-6 py-2 flex items-center justify-between text-xs text-[#8ea3b7]">
        <span>Encounter Mode: <strong className="text-white">Physician Workspace & Scribe</strong></span>
        <button
          onClick={() => setViewMode('legacy')}
          className="text-[#64748b] hover:text-[#8ea3b7] underline cursor-pointer"
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
