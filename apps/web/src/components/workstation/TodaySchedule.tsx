import { useState, useEffect } from 'react';
import { 
  Clock, Search, Stethoscope, AlertTriangle, ArrowUpRight, ShieldCheck 
} from 'lucide-react';
import type { DoctorDeskPatient } from '../DoctorDeskEncounter';
import PatientBriefModal from './PatientBriefModal';
import CommandPalette from './CommandPalette';

interface TodayScheduleProps {
  patients: DoctorDeskPatient[];
  completedPatientIds: string[];
  onSelectPatient: (patient: DoctorDeskPatient) => void;
  onBeginConsultation: (patient: DoctorDeskPatient) => void;
  doctorName?: string;
  specialty?: string;
}

export default function TodaySchedule({
  patients,
  completedPatientIds,
  onSelectPatient,
  onBeginConsultation,
  doctorName = 'Dr. Marcus Thorne',
  specialty = 'Internal Medicine & Diagnostic Intelligence'
}: TodayScheduleProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'waiting' | 'completed'>('all');
  const [selectedBriefPatient, setSelectedBriefPatient] = useState<DoctorDeskPatient | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut for Cmd+K command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getPatientStatus = (pt: DoctorDeskPatient): 'ready' | 'waiting' | 'completed' => {
    if (completedPatientIds.includes(pt.id)) return 'completed';
    return pt.status || 'ready';
  };

  const filteredPatients = patients.filter(pt => {
    const status = getPatientStatus(pt);
    if (statusFilter !== 'all' && status !== statusFilter) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      pt.name.toLowerCase().includes(q) ||
      pt.mrn.toLowerCase().includes(q) ||
      pt.chiefComplaint.toLowerCase().includes(q) ||
      (pt.visitType && pt.visitType.toLowerCase().includes(q)) ||
      (pt.scenarioKey && pt.scenarioKey.toLowerCase().includes(q))
    );
  });

  const readyCount = patients.filter(p => getPatientStatus(p) === 'ready').length;
  const waitingCount = patients.filter(p => getPatientStatus(p) === 'waiting').length;
  const completedCount = completedPatientIds.length;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="w-full min-h-screen bg-[#fafaf9] text-[#18181b] font-sans antialiased flex flex-col">
      {/* Top Serene Header Bar */}
      <header className="h-16 border-b border-[#e4e4e7] bg-white px-6 lg:px-12 flex items-center justify-between shrink-0 shadow-2xs z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-lg font-bold tracking-tight text-[#09090b]">proton</span>
          </div>
          <div className="h-4 w-[1px] bg-[#e4e4e7]" />
          <div className="text-xs text-[#52525b]">
            <span className="font-semibold text-[#09090b]">{doctorName}</span>
            <span className="hidden sm:inline text-[#a1a1aa]"> &bull; {specialty}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] hover:bg-[#e4e4e7] text-xs text-[#71717a] transition-all cursor-pointer"
            title="Open Command Palette (⌘K)"
          >
            <Search size={13} />
            <span className="hidden md:inline">Quick Search...</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] font-mono bg-white rounded border border-[#e4e4e7] shadow-2xs">
              ⌘K
            </kbd>
          </button>
          <div className="text-xs font-mono text-[#52525b] font-semibold bg-[#fafaf9] px-2.5 py-1 rounded-lg border border-[#e4e4e7]">
            {currentTime || '09:00 AM'}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 lg:p-10 space-y-8">
        {/* Serene Greeting & Overview */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e4e4e7] pb-6">
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#71717a]">
              Clinical Workstation &bull; Schedule for Today
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#09090b]">
              {getGreeting()}, {doctorName.split(' ')[1] || 'Doctor'}
            </h1>
            <p className="text-xs text-[#52525b]">
              You have <strong className="text-[#09090b]">{patients.length} scheduled encounters</strong> today.
              {readyCount > 0 && <span> &bull; <span className="text-emerald-700 font-semibold">{readyCount} ready for consultation</span></span>}
              {waitingCount > 0 && <span> &bull; <span className="text-amber-700 font-semibold">{waitingCount} waiting for intake</span></span>}
              {completedCount > 0 && <span> &bull; <span className="text-slate-600 font-semibold">{completedCount} signed off</span></span>}
            </p>
          </div>

          {/* Quick Scenario Pills (Scenarios A through H) */}
          <div className="flex flex-col items-start md:items-end gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
              Synthetic Clinical Cases (Milestone 5):
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
              {[
                { key: 'case-1', label: '1: Primary Care', id: 'demo-case-1-primary' },
                { key: 'case-2', label: '2: Chronic Care', id: 'demo-scenario-b-eleanor' },
                { key: 'case-3', label: '3: Respiratory', id: 'demo-scenario-a-clara' },
                { key: 'case-4', label: '4: Cardiology', id: 'demo-scenario-d-conflict' },
                { key: 'case-5', label: '5: Neurology', id: 'demo-scenario-g-wrongpt' },
                { key: 'case-6', label: '6: Endocrine', id: 'demo-case-6-endocrine' },
                { key: 'case-7', label: '7: Med Safety', id: 'demo-scenario-c-allergy' },
                { key: 'case-8', label: '8: Missing Data', id: 'demo-scenario-e-missing' },
                { key: 'case-9', label: '9: Conflict', id: 'demo-case-9-conflict' },
                { key: 'case-10', label: '10: Security', id: 'demo-scenario-h-injection' },
                { key: 'case-f', label: 'Degraded', id: 'demo-scenario-f-failure' }
              ].map(sc => (
                <button
                  key={sc.key}
                  onClick={() => {
                    const match = patients.find(p => p.id === sc.id);
                    if (match) setSelectedBriefPatient(match);
                  }}
                  className="px-2 py-1 text-[11px] font-semibold bg-white hover:bg-[#f4f4f5] text-[#52525b] hover:text-[#09090b] border border-[#e4e4e7] rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-[#f4f4f5] p-1 rounded-xl border border-[#e4e4e7]">
            {(['all', 'ready', 'waiting', 'completed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  statusFilter === f
                    ? 'bg-white text-[#09090b] shadow-2xs border border-[#e4e4e7]'
                    : 'text-[#71717a] hover:text-[#09090b]'
                }`}
              >
                {f} {f === 'ready' && `(${readyCount})`} {f === 'waiting' && `(${waitingCount})`} {f === 'completed' && `(${completedCount})`}
              </button>
            ))}
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search patients, MRN, complaint..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#e4e4e7] rounded-xl outline-none focus:border-[#111315] shadow-2xs"
            />
          </div>
        </div>

        {/* Appointment Roster List */}
        <div className="space-y-3">
          {filteredPatients.map(pt => {
            const status = getPatientStatus(pt);
            const isCompleted = status === 'completed';
            const isReady = status === 'ready';

            return (
              <div
                key={pt.id}
                className={`p-5 rounded-2xl border transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isCompleted
                    ? 'bg-white/60 border-[#e4e4e7] opacity-75'
                    : 'bg-white border-[#e4e4e7] hover:border-[#111315]/40 hover:shadow-xs'
                }`}
              >
                {/* Left: Time + Patient Details */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className="flex flex-col items-center justify-center w-16 py-1.5 px-1 rounded-xl bg-[#fafaf9] border border-[#e4e4e7] text-center shrink-0">
                    <span className="font-mono text-xs font-bold text-[#09090b]">{pt.time}</span>
                    <span className="text-[10px] text-[#71717a] uppercase font-medium">TODAY</span>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full ${
                        isCompleted ? 'bg-slate-400' :
                        isReady ? 'bg-emerald-500' : 'bg-amber-500'
                      }`} />
                      <h3 className="text-sm font-bold text-[#09090b] tracking-tight">
                        {pt.name}
                      </h3>
                      <span className="text-xs text-[#71717a]">
                        ({pt.age}y, {pt.gender})
                      </span>
                      <span className="text-[10px] font-mono text-[#71717a] bg-[#f4f4f5] px-1.5 py-0.5 rounded border border-[#e4e4e7]">
                        {pt.mrn}
                      </span>
                      <span className="text-[10px] font-semibold text-[#52525b] bg-[#f4f4f5] px-2 py-0.5 rounded-full border border-[#e4e4e7]">
                        {pt.visitType || 'Follow-up'}
                      </span>
                      {pt.allergies && pt.allergies.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={10} />
                          Allergy: {pt.allergies[0].split(' ')[0]}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#52525b] font-medium truncate max-w-xl">
                      {pt.chiefComplaint}
                    </p>

                    {/* Preparation state & context pills */}
                    <div className="flex items-center gap-2 text-[11px] text-[#71717a] pt-1 flex-wrap">
                      {pt.preparationState && (
                        <span className="flex items-center gap-1 text-[#0284c7] font-medium bg-blue-50/70 border border-blue-200/60 px-2 py-0.5 rounded-md">
                          <ShieldCheck size={11} />
                          {pt.preparationState}
                        </span>
                      )}
                      <span>&bull;</span>
                      <span>BP <strong className="text-[#09090b]">{pt.vitals.bp}</strong></span>
                      <span>&bull;</span>
                      <span>HR <strong className="text-[#09090b]">{pt.vitals.hr}</strong></span>
                      {pt.recentLabs && pt.recentLabs.length > 0 && (
                        <>
                          <span>&bull;</span>
                          <span className={pt.recentLabs[0].status === 'high' ? 'text-rose-700 font-semibold' : ''}>
                            {pt.recentLabs[0].name.split(' ')[0]}: {pt.recentLabs[0].value}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => {
                      setSelectedBriefPatient(pt);
                      onSelectPatient(pt);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-[#52525b] hover:text-[#09090b] bg-white hover:bg-[#f4f4f5] border border-[#e4e4e7] rounded-xl transition-all cursor-pointer"
                  >
                    Review Brief
                  </button>

                  <button
                    onClick={() => onBeginConsultation(pt)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                      isCompleted
                        ? 'bg-[#f4f4f5] text-[#52525b] hover:bg-[#e4e4e7]'
                        : 'bg-[#111315] hover:bg-[#262a2e] text-white'
                    }`}
                  >
                    <Stethoscope size={13} className={isCompleted ? 'text-[#71717a]' : 'text-emerald-400'} />
                    <span>{isCompleted ? 'Reopen Encounter' : 'Begin Consultation'}</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredPatients.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-[#e4e4e7] text-xs text-[#71717a] space-y-2">
              <Clock size={24} className="mx-auto text-[#a1a1aa]" />
              <p>No appointments match the selected filter or query.</p>
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs font-semibold text-[#09090b] underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Patient Brief Modal */}
      <PatientBriefModal
        patient={selectedBriefPatient}
        isOpen={Boolean(selectedBriefPatient)}
        onClose={() => setSelectedBriefPatient(null)}
        onBeginConsultation={(pt) => {
          setSelectedBriefPatient(null);
          onBeginConsultation(pt);
        }}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        patients={patients}
        onSelectPatient={(pt) => {
          onSelectPatient(pt);
          onBeginConsultation(pt);
        }}
        onAction={(actionId) => {
          if (actionId === 'start_consultation' && patients.length > 0) {
            onBeginConsultation(patients[0]);
          }
        }}
      />
    </div>
  );
}
