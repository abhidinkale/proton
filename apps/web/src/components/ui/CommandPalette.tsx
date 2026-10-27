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
          navigate('/');
          onClose();
        }
      },
      {
        id: 'act-schedule',
        category: 'NAVIGATION',
        title: 'Open Clinic Schedule',
        subtitle: 'Multi-provider timetable and room assignments',
        shortcut: 'G S',
        icon: <Calendar size={16} className="text-[#151719]" />,
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
        icon: <BookOpen size={16} className="text-[#9D174D]" />,
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
        icon: <DollarSign size={16} className="text-[#1E40AF]" />,
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
        icon: <Users size={16} className="text-slate-600" />,
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
        icon: <Mic size={16} className="text-emerald-600" />,
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
        icon: <ShieldCheck size={16} className="text-amber-600" />,
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
        icon: <FileText size={16} className="text-blue-600" />,
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
        icon: <LayoutDashboard size={16} className="text-slate-600" />,
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
        icon: <FileText size={16} className="text-amber-600" />,
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
        icon: <Calendar size={16} className="text-[#1E40AF]" />,
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative border-b border-slate-200 px-4 py-3.5 flex items-center gap-3">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search patients, actions, or jump to workspace..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto divide-y divide-slate-100 flex-1 p-2">
          {searchState === 'loading' && (
            <div className="flex items-center gap-2 px-3.5 py-2 text-[11px] text-slate-500">
              <LoaderCircle size={12} className="animate-spin" />
              Searching the clinic record…
            </div>
          )}
          {searchState === 'error' && (
            <div className="flex items-center gap-2 px-3.5 py-2 text-[11px] text-amber-800">
              <AlertTriangle size={12} />
              Search is unavailable. Check that the clinic API is running.
            </div>
          )}
          {actions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No matching patients or actions found.
            </div>
          ) : (
            actions.map((act, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={act.id}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={act.onSelect}
                  className={`px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-brand-50 text-brand-950' : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-white shadow-2xs' : 'bg-slate-100'}`}>
                      {act.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{act.title}</span>
                        {act.category === 'PATIENT' && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            Patient
                          </span>
                        )}
                      </div>
                      {act.subtitle && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{act.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {act.shortcut && (
                      <kbd className="hidden md:inline-flex text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                        {act.shortcut}
                      </kbd>
                    )}
                    <ChevronRight size={14} className={isSelected ? 'text-brand-600' : 'text-slate-300'} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">↵</kbd> Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">ESC</kbd> Close
            </span>
          </div>
          <span className="font-medium text-brand-700">
            Proton Command Palette
          </span>
        </div>
      </div>
    </div>
  );
}
