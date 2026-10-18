import { X, Keyboard } from 'lucide-react';

interface ProtonShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'NAVIGATION' | 'CLINICAL' | 'AI & SCRIBE';
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['⌘', 'K'], description: 'Open Global Search & Command Palette', category: 'NAVIGATION' },
  { keys: ['G', 'C'], description: 'Jump to Command Center / Dashboard', category: 'NAVIGATION' },
  { keys: ['G', 'S'], description: 'Jump to Clinic Schedule', category: 'NAVIGATION' },
  { keys: ['G', 'P'], description: 'Jump to Patient Directory', category: 'NAVIGATION' },
  { keys: ['G', 'E'], description: 'Jump to Knowledge & Education', category: 'NAVIGATION' },
  { keys: ['G', 'B'], description: 'Jump to Billing & Invoices', category: 'NAVIGATION' },
  { keys: ['⌥', 'Space'], description: 'Start / Pause Ambient Scribe recording', category: 'AI & SCRIBE' },
  { keys: ['⌘', 'Enter'], description: 'Sign-off and Commit SOAP Note to FHIR', category: 'CLINICAL' },
  { keys: ['⌘', 'Shift', 'C'], description: 'Copy formatted note to clipboard', category: 'CLINICAL' },
  { keys: ['Esc'], description: 'Close active modal, drawer, or palette', category: 'NAVIGATION' },
  { keys: ['⌘', '/'], description: 'Open Keyboard Shortcuts cheat sheet', category: 'NAVIGATION' }
];

export default function ProtonShortcutsModal({ isOpen, onClose }: ProtonShortcutsModalProps) {
  if (!isOpen) return null;

  const categories = ['NAVIGATION', 'CLINICAL', 'AI & SCRIBE'] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-3xl border border-[#E8E5DC] p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0ECE1]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#151619] text-white flex items-center justify-center">
              <Keyboard size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#151719]">Proton Keyboard Shortcuts</h3>
              <p className="text-[11px] text-[#88909A]">High-velocity keyboard ergonomics for clinicians</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[#88909A] hover:text-[#151719] hover:bg-[#F9F8F5]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {categories.map(cat => (
            <div key={cat} className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-[#88909A]">
                {cat}
              </div>
              <div className="divide-y divide-[#F0ECE1] bg-[#FAF9F5] rounded-2xl border border-[#E8E5DC] p-2">
                {SHORTCUTS.filter(s => s.category === cat).map((s, idx) => (
                  <div key={idx} className="py-2 px-2 flex items-center justify-between text-xs">
                    <span className="text-[#575D65]">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-white text-[#151719] border border-[#E8E5DC] shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-[#F0ECE1] flex items-center justify-between text-[11px] text-[#88909A]">
          <span>Press <kbd className="px-1.5 py-0.5 rounded font-mono bg-[#F9F8F5] border border-[#E8E5DC]">Esc</kbd> anytime to dismiss</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-[#151619] hover:bg-[#252830] text-white text-xs font-semibold cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
