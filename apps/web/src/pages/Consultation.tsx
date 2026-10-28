import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DoctorGuidedEncounter from '../components/DoctorGuidedEncounter';
import DoctorDeskEncounter, { type DoctorDeskPatient } from '../components/DoctorDeskEncounter';
import AmbientClinicalCockpit from '../components/AmbientClinicalCockpit';
import LegacyEncounterWorkspace from '../components/LegacyEncounterWorkspace';
import { TODAY_CLINIC_SCHEDULE } from '../data/clinicSchedule';
import { clinicApi } from '../lib/clinicApi';

function toDeskPatient(chart: Awaited<ReturnType<typeof clinicApi.getPatient>>): DoctorDeskPatient {
  const record = chart.patient;
  const vitals = (record.vitals || {}) as Record<string, string>;
  return {
    id: record.id,
    name: String(record.name || 'Patient'),
    age: Number(record.age) || 0,
    gender: String(record.gender || 'unknown'),
    dob: String(record.dob || ''),
    mrn: String(record.mrn || ''),
    time: chart.appointments[0]?.time || 'Today',
    chiefComplaint: String(record.chiefComplaint || 'Clinical evaluation'),
    vitals: {
      bp: vitals.bp || vitals.BP || 'not recorded',
      hr: vitals.hr || vitals.HR || 'not recorded',
      spo2: vitals.spo2 || vitals.SpO2 || 'not recorded',
      temp: vitals.temp || vitals.Temp || 'not recorded',
      bmi: vitals.bmi || vitals.BMI || 'not recorded'
    },
    allergies: (record.allergies || []).map(String),
    conditions: (record.conditions || []).map(String),
    medications: (record.medications || []).map(String),
    recentLabs: ((record.recentLabs || []) as Array<Record<string, unknown>>).map((lab) => ({
      name: String(lab.name || 'Lab result'),
      value: String(lab.value || ''),
      status: ['high', 'low'].includes(String(lab.status || '').toLowerCase())
        ? (String(lab.status).toLowerCase() as 'high' | 'low')
        : 'normal',
      date: String(lab.date || 'Recent'),
      note: lab.note ? String(lab.note) : undefined
    })),
    documents: ((record.documents || []) as Array<Record<string, unknown>>).map((document) => ({
      name: String(document.name || 'Clinical document'),
      date: String(document.date || ''),
      type: String(document.type || 'Document'),
      summary: String(document.summary || '')
    })),
    visitType: String(record.visitType || 'Clinical evaluation'),
    status: chart.summary?.status === 'COMPLETED' ? 'completed' : 'ready',
    preparationState: record.preparationState ? String(record.preparationState) : undefined,
    patientPhone: record.patientPhone ? String(record.patientPhone) : undefined,
    consultationTranscript: record.consultationTranscript ? String(record.consultationTranscript) : undefined
  };
}

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
  const [clinicPatient, setClinicPatient] = useState<DoctorDeskPatient | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [isLoadingChart, setIsLoadingChart] = useState(Boolean(patientId));

  // The durable clinic chart is authoritative. The frozen cohort is only a
  // rendering fallback when no patient id was supplied.
  useEffect(() => {
    if (!patientId) {
      setIsLoadingChart(false);
      return;
    }
    let active = true;
    setIsLoadingChart(true);
    setChartError(null);
    clinicApi
      .getPatient(patientId)
      .then((chart) => {
        if (!active) return;
        setClinicPatient(toDeskPatient(chart));
      })
      .catch((error) => {
        if (!active) return;
        setChartError((error as Error).message || 'This chart could not be loaded.');
      })
      .finally(() => {
        if (active) setIsLoadingChart(false);
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  const requestedPatient = patientId
    ? TODAY_CLINIC_SCHEDULE.find((entry) => entry.id === patientId || entry.id.includes(patientId))
    : undefined;

  const selectedDeskPatient =
    clinicPatient ||
    requestedPatient ||
    TODAY_CLINIC_SCHEDULE.find((entry) => entry.id === 'demo-scenario-d-conflict') ||
    TODAY_CLINIC_SCHEDULE[0];

  if (isLoadingChart && !clinicPatient) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-rule-strong border-t-transparent" />
        <p className="text-xs font-medium text-ink-2">Loading the clinical chart…</p>
      </div>
    );
  }

  if (chartError && !clinicPatient) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-semibold text-ink">Chart unavailable</p>
        <p className="text-xs leading-relaxed text-ink-2">{chartError}</p>
        <button
          type="button"
          onClick={() => navigate('/patients')}
          className="rounded-full bg-solid px-4 py-2 text-xs font-semibold text-white cursor-pointer"
        >
          Back to patients
        </button>
      </div>
    );
  }

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
          <div className="flex items-center gap-2 text-[11px] text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-settled-wash0" />
            <span className="font-semibold text-ink">Power desk</span>
            <span className="hidden sm:inline">· multi-tab encounter</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <button
              onClick={() => setViewMode('cockpit')}
              className="rounded-full px-3 py-1.5 font-medium text-ink-2 transition-colors hover:bg-paper/70 hover:text-ink cursor-pointer"
            >
              Cockpit
            </button>
            <button
              onClick={() => setViewMode('guided')}
              className="rounded-full px-3 py-1.5 font-medium text-ink-2 transition-colors hover:bg-paper/70 hover:text-ink cursor-pointer"
            >
              Guided
            </button>
            <button
              onClick={() => setViewMode('legacy')}
              className="rounded-full px-3 py-1.5 font-medium text-ink-2 transition-colors hover:bg-paper/70 hover:text-ink cursor-pointer"
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
      initialPatientId={clinicPatient?.id || patientId}
      initialPatient={clinicPatient}
      initialAction={searchParams.get('action')}
      onSwitchToPowerDesk={() => setViewMode('desk')}
      onFinishEncounter={() => navigate('/')}
    />
  );
}
