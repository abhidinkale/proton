import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  LayoutDashboard, 
  Users, 
  Mic, 
  FileText, 
  ChevronRight, 
  X,
  Stethoscope,
  ShieldCheck,
  Calendar,
  BookOpen,
  DollarSign,
  LoaderCircle,
  AlertTriangle
} from 'lucide-react';
import {
  clinicApi,
  type ClinicAppointment,
  type ClinicNote,
  type ClinicPatientSummary
} from '../../lib/clinicApi';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteAction {
  id: string;
  category: 'NAVIGATION' | 'WORKFLOW' | 'PATIENT';
  title: string;
  subtitle?: string;
  shortcut?: string;
  icon: ReactNode;
  onSelect: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<ClinicPatientSummary[]>([]);
  const [notes, setNotes] = useState<ClinicNote[]>([]);
  const [appointments, setAppointments] = useState<ClinicAppointment[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search the durable clinic workspace instead of a frozen roster.
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);

    let active = true;
    setSearchState('loading');
    clinicApi
      .listPatients({})
      .then((result) => {
        if (!active) return;
        setPatients(result.patients);
        setNotes([]);
        setAppointments([]);
        setSearchState('idle');
      })
      .catch(() => {
        if (active) setSearchState('error');
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!trimmed) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setSearchState('loading');
      clinicApi
        .search(trimmed)
        .then((result) => {
          if (!active) return;
          setPatients(result.patients);
          setNotes(result.notes);
          setAppointments(result.appointments);
          setSearchState('idle');
        })
        .catch(() => {
          if (active) setSearchState('error');
        });
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isOpen, query]);

  // Global Keyboard listener for ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent or state
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compile actions
  const actions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = [];
    const q = query.toLowerCase().trim();

    // Standard Quick Actions
    const standardWorkflows: PaletteAction[] = [
      {
        id: 'act-cmd',
        category: 'NAVIGATION',
        title: 'Go to Command Center',
        subtitle: "Today's Clinical Workspace & Attention Center",
        shortcut: 'G C',
        icon: <LayoutDashboard size={16} className="text-brand-600" />,
        onSelect: () => {
          navigate('/dashboard');
          onClose();
        }
      },
      {
        id: 'act-schedule',
        category: 'NAVIGATION',
        title: 'Open Clinic Schedule',
        subtitle: 'Multi-provider timetable and room assignments',
        shortcut: 'G S',
        icon: <Calendar size={16} className="text-ink" />,
        onSelect: () => {
          navigate('/schedule');
          onClose();
        }
      },
      {
        id: 'act-education',
        category: 'NAVIGATION',
        title: 'Clinical Knowledge & Education',
        subtitle: 'Live CME, clinical guidelines & research updates',
        shortcut: 'G E',
        icon: <BookOpen size={16} className="text-accent-ink" />,
        onSelect: () => {
          navigate('/education');
          onClose();
        }
      },
      {
        id: 'act-billing',
        category: 'NAVIGATION',
        title: 'Patient Billing & Invoices',
        subtitle: 'Claims ledger, E/M coding attribution & payouts',
        shortcut: 'G B',
        icon: <DollarSign size={16} className="text-accent-ink" />,
        onSelect: () => {
          navigate('/billing');
          onClose();
        }
      },
      {
        id: 'act-patients',
        category: 'NAVIGATION',
        title: 'View Patient Directory',
        subtitle: 'All synthetic clinical patient profiles',
        shortcut: 'G P',
        icon: <Users size={16} className="text-ink-2" />,
        onSelect: () => {
          navigate('/patients');
          onClose();
        }
      },
      {
        id: 'act-new-consult',
        category: 'WORKFLOW',
        title: 'Start New Consultation',
        subtitle: 'Launch clinical dialogue capture & copilot',
        shortcut: 'N C',
        icon: <Mic size={16} className="text-settled" />,
        onSelect: () => {
          navigate('/consultation');
          onClose();
        }
      },
      {
        id: 'act-review-center',
        category: 'WORKFLOW',
        title: 'Open Review Center',
        subtitle: 'Verify unconfirmed AI facts & document intake',
        shortcut: 'G R',
        icon: <ShieldCheck size={16} className="text-caution" />,
        onSelect: () => {
          navigate('/document-review');
          onClose();
        }
      },
      {
        id: 'act-doc-review',
        category: 'WORKFLOW',
        title: 'Upload Previous Clinical Records',
        subtitle: 'Ingest lab reports, discharge summaries & PDFs',
        icon: <FileText size={16} className="text-accent-ink" />,
        onSelect: () => {
          navigate('/document-review');
          onClose();
        }
      },
      {
        id: 'act-settings',
        category: 'NAVIGATION',
        title: 'Settings & Clinical Policies',
        subtitle: 'Physician identity, AI engine parameters & safety rules',
        shortcut: 'G S',
        icon: <LayoutDashboard size={16} className="text-ink-2" />,
        onSelect: () => {
          navigate('/settings');
          onClose();
        }
      }
    ];

    if (!q) {
      list.push(...standardWorkflows);
    } else {
      // Filter standard actions
      const matchedWorkflows = standardWorkflows.filter(
        a => a.title.toLowerCase().includes(q) || (a.subtitle && a.subtitle.toLowerCase().includes(q))
      );
      list.push(...matchedWorkflows);
    }

    // Patient, note and appointment results from the live clinic index.
    const patientResults: PaletteAction[] = [];

    patients.slice(0, 6).forEach((patient) => {
      patientResults.push({
        id: `pat-${patient.id}`,
        category: 'PATIENT',
        title: patient.name,
        subtitle: `${patient.mrn || 'MRN pending'} · ${patient.age}y ${patient.gender} · ${patient.primaryCondition || patient.chiefComplaint || 'No condition recorded'}`,
        icon: <Stethoscope size={16} className="text-brand-600" />,
        onSelect: () => {
          navigate(`/patients/${patient.id}`);
          onClose();
        }
      });
    });

    notes.slice(0, 3).forEach((note) => {
      patientResults.push({
        id: `note-${note.id}`,
        category: 'PATIENT',
        title: note.title,
        subtitle: `${note.patientName} · ${note.status === 'SIGNED' ? 'Signed note' : 'Unsigned draft'} · ${note.updatedAt.slice(0, 10)}`,
        icon: <FileText size={16} className="text-caution" />,
        onSelect: () => {
          navigate(`/consultation?patient=${note.patientId}`);
          onClose();
        }
      });
    });

    appointments.slice(0, 3).forEach((appointment) => {
      patientResults.push({
        id: `apt-${appointment.id}`,
        category: 'PATIENT',
        title: `${appointment.patientName} · ${appointment.time}`,
        subtitle: `${appointment.date} · ${appointment.appointmentType} · ${appointment.roomOrVirtual}`,
        icon: <Calendar size={16} className="text-accent-ink" />,
        onSelect: () => {
          navigate('/schedule');
          onClose();
        }
      });
    });

    list.push(...patientResults.slice(0, 10));

    return list;
  }, [query, patients, notes, appointments, navigate, onClose]);

  // Reset selected index when actions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [actions.length, query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (actions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % actions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + actions.length) % actions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const action = actions[selectedIndex];
      if (action) {
        action.onSelect();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm select-none animate-in fade-in duration-150"
    >
      <div 
        className="w-full max-w-[560px] rounded-[22px] bg-[#1c1c1f]/95 dark:bg-[#18181b]/95 backdrop-blur-2xl border border-white/12 shadow-[0_32px_96px_rgba(0,0,0,0.65)] overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[82vh] p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arc Search Input Bar (Matching Arc Floating Palette) */}
        <div className="relative px-3.5 py-2.5 flex items-center gap-3">
          <Search size={16} strokeWidth={1.5} className="text-white/45 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search patients, actions, or jump to workspace..."
            className="flex-1 bg-transparent text-[14px] text-white placeholder:text-white/40 focus:outline-none font-medium antialiased"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-white/40 hover:text-white/80 p-0.5 rounded cursor-pointer transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-white/50 bg-white/10 rounded border border-white/10">
            ESC
          </kbd>
        </div>

        {/* Separator */}
        <div className="h-[1px] bg-white/8 mx-2 mb-1" />

        {/* Results List */}
        <div className="overflow-y-auto flex-1 px-1 py-1 space-y-0.5 no-scrollbar">
          {searchState === 'loading' && (
            <div className="flex items-center gap-2 px-3 py-2.5 text-[12px] text-white/50">
              <LoaderCircle size={13} className="animate-spin text-white/60" />
              Searching records…
            </div>
          )}
          {searchState === 'error' && (
            <div className="flex items-center gap-2 px-3 py-2.5 text-[12px] text-rose-400">
              <AlertTriangle size={13} />
              Search is unavailable. Check clinic service connection.
            </div>
          )}
          {actions.length === 0 && searchState !== 'loading' ? (
            <div className="p-8 text-center text-white/40 text-xs">
              No matching records or actions found.
            </div>
          ) : (
            actions.map((act, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={act.id}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={act.onSelect}
                  className={`px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors duration-100 ${
                    isSelected
                      ? 'bg-[var(--accent,#8b5cf6)] text-white shadow-sm'
                      : 'hover:bg-white/6 text-white/85'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'text-white' : 'text-white/60'}`}>
                      {act.icon}
                    </div>
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={`font-medium text-[13px] truncate ${isSelected ? 'text-white' : 'text-white/95'}`}>
                        {act.title}
                      </span>
                      {act.subtitle && (
                        <span className={`text-[12px] truncate ${isSelected ? 'text-white/75' : 'text-white/45'}`}>
                          — {act.subtitle}
                        </span>
                      )}
                      {act.category === 'PATIENT' && (
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
                        }`}>
                          Patient
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {act.shortcut && (
                      <kbd className={`hidden md:inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-white/20 text-white' : 'text-white/40 bg-white/6'
                      }`}>
                        {act.shortcut}
                      </kbd>
                    )}
                    <ChevronRight size={13} className={isSelected ? 'text-white' : 'text-white/30'} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Minimal Footer Hint */}
        <div className="px-3.5 py-2 mt-1 border-t border-white/8 flex items-center justify-between text-[11px] text-white/40 shrink-0">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.2 bg-white/10 rounded font-mono text-[9px] text-white/70">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 py-0.2 bg-white/10 rounded font-mono text-[9px] text-white/70">↵</kbd> Select</span>
            <span><kbd className="px-1 py-0.2 bg-white/10 rounded font-mono text-[9px] text-white/70">ESC</kbd> Dismiss</span>
          </div>
          <span className="text-white/30 text-[10px]">
            Proton Command Palette
          </span>
        </div>
      </div>
    </div>
  );
}
