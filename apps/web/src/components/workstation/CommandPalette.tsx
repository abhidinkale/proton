import { useState, useEffect, useRef } from 'react';
import { Search, Stethoscope, Clock, ShieldAlert, ArrowRight, User, Pill, Activity, X } from 'lucide-react';
import type { DoctorDeskPatient } from '../DoctorDeskEncounter';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  patients: DoctorDeskPatient[];
  onSelectPatient: (patient: DoctorDeskPatient) => void;
  onAction?: (actionId: string) => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  patients,
  onSelectPatient,
  onAction
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.mrn.toLowerCase().includes(query.toLowerCase()) ||
    p.chiefComplaint.toLowerCase().includes(query.toLowerCase()) ||
    (p.scenarioKey && p.scenarioKey.toLowerCase().includes(query.toLowerCase()))
  );

  const quickCommands = [
    { id: 'start_consultation', label: 'Begin Consultation for Active Patient', icon: Stethoscope },
    { id: 'open_schedule', label: "Go to Today's Clinic Schedule", icon: Clock },
    { id: 'view_orders', label: 'Review Draft Medications & Orders', icon: Pill },
    { id: 'view_labs', label: 'Inspect Recent Laboratory Trends & Biomarkers', icon: Activity },
    { id: 'view_safety', label: 'Run Deterministic Allergy & Safety Gate Audit', icon: ShieldAlert }
  ].filter(cmd => cmd.label.toLowerCase().includes(query.toLowerCase()));

  const totalItems = filteredPatients.length + quickCommands.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (totalItems || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + totalItems) % (totalItems || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex < filteredPatients.length) {
        const pt = filteredPatients[selectedIndex];
        onSelectPatient(pt);
        onClose();
      } else {
        const cmdIndex = selectedIndex - filteredPatients.length;
        const cmd = quickCommands[cmdIndex];
        if (cmd && onAction) {
          onAction(cmd.id);
        }
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div 
        className="w-full max-w-xl bg-white border border-[#e4e4e7] rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans"
        role="dialog"
        aria-modal="true"
        aria-label="Clinical Command Palette"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#e4e4e7] bg-[#fafaf9]">
          <Search size={16} className="text-[#71717a] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a patient name, MRN, symptom, or command (⌘K)..."
            className="flex-1 bg-transparent text-xs text-[#09090b] placeholder-[#a1a1aa] outline-none font-medium"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-[#71717a] bg-white border border-[#e4e4e7] rounded shadow-2xs">
            ESC
          </kbd>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#09090b] p-1 rounded-md cursor-pointer"
            aria-label="Close command palette"
          >
            <X size={15} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-[#f4f4f5]">
          {/* Patients Section */}
          {filteredPatients.length > 0 && (
            <div className="pb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa] px-2.5 py-1">
                Patients & Appointments
              </div>
              {filteredPatients.map((pt, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={pt.id}
                    onClick={() => {
                      onSelectPatient(pt);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#18181b] text-white' : 'text-[#18181b] hover:bg-[#f4f4f5]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#f4f4f5] text-[#52525b]'
                      }`}>
                        <User size={13} />
                      </div>
                      <div className="truncate">
                        <div className="font-semibold flex items-center gap-2">
                          <span>{pt.name}</span>
                          <span className={`text-[10px] font-normal ${isSelected ? 'text-zinc-300' : 'text-[#71717a]'}`}>
                            ({pt.age}y, {pt.gender}) • {pt.mrn}
                          </span>
                        </div>
                        <p className={`text-[11px] truncate ${isSelected ? 'text-zinc-300' : 'text-[#71717a]'}`}>
                          {pt.time} &bull; {pt.chiefComplaint}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={13} className={isSelected ? 'text-white' : 'text-[#a1a1aa]'} />
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Commands Section */}
          {quickCommands.length > 0 && (
            <div className="pt-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa] px-2.5 py-1">
                Clinical Actions
              </div>
              {quickCommands.map((cmd, idx) => {
                const itemIndex = filteredPatients.length + idx;
                const isSelected = selectedIndex === itemIndex;
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      if (onAction) onAction(cmd.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#18181b] text-white' : 'text-[#18181b] hover:bg-[#f4f4f5]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#f4f4f5] text-[#52525b]'
                      }`}>
                        <Icon size={13} />
                      </div>
                      <span className="font-medium">{cmd.label}</span>
                    </div>
                    <ArrowRight size={13} className={isSelected ? 'text-white' : 'text-[#a1a1aa]'} />
                  </button>
                );
              })}
            </div>
          )}

          {totalItems === 0 && (
            <div className="text-center py-8 text-xs text-[#71717a]">
              No patients or clinical actions found matching &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 border-t border-[#e4e4e7] bg-[#fafaf9] flex items-center justify-between text-[11px] text-[#71717a]">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-white border border-[#e4e4e7] px-1 py-0.5 rounded text-[10px]">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono bg-white border border-[#e4e4e7] px-1 py-0.5 rounded text-[10px]">↵</kbd> Select</span>
          </div>
          <span className="font-medium text-[#111315]">Proton Workstation</span>
        </div>
      </div>
    </div>
  );
}
