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
      <div className="bg-paper rounded-3xl border border-rule p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-rule">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-solid text-white flex items-center justify-center">
              <Keyboard size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Proton Keyboard Shortcuts</h3>
              <p className="text-[11px] text-ink-3">High-velocity keyboard ergonomics for clinicians</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-ink-3 hover:text-ink hover:bg-canvas"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {categories.map(cat => (
            <div key={cat} className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-ink-3">
                {cat}
              </div>
              <div className="divide-y divide-rule bg-paper-2 rounded-2xl border border-rule p-2">
                {SHORTCUTS.filter(s => s.category === cat).map((s, idx) => (
                  <div key={idx} className="py-2 px-2 flex items-center justify-between text-xs">
                    <span className="text-ink-2">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-paper text-ink border border-rule shadow-2xs"
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

        <div className="pt-3 border-t border-rule flex items-center justify-between text-[11px] text-ink-3">
          <span>Press <kbd className="px-1.5 py-0.5 rounded font-mono bg-canvas border border-rule">Esc</kbd> anytime to dismiss</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-solid hover:bg-solid text-white text-xs font-semibold cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
