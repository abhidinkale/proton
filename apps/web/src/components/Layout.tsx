import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, Users, LayoutDashboard, Settings, LogOut, FileText, Search, ShieldCheck } from 'lucide-react';
import { useMedplum } from '@medplum/react';
import CommandPalette from './ui/CommandPalette';

export default function Layout({ children }: { children: ReactNode }) {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const handleLogout = () => {
    medplum.signOut().then(() => {
      navigate('/login');
    });
  };

  // Keyboard shortcut listener for ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          setIsCommandPaletteOpen(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-600'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity className="text-brand-600" size={24} />
            <h1 className="text-2xl font-bold tracking-tight text-brand-900">PROTON</h1>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
              Synthetic Beta
            </span>
          </div>
        </div>

        {/* Global Quick Search Button in Sidebar */}
        <div className="px-4 pt-3 pb-1">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-xs text-slate-500 font-medium transition-colors cursor-pointer group shadow-2xs"
            title="Search patients or execute actions (⌘K)"
          >
            <span className="flex items-center gap-2">
              <Search size={14} className="text-slate-400 group-hover:text-brand-600" />
              <span>Command Palette</span>
            </span>
            <kbd className="text-[10px] font-mono bg-white border border-slate-200 text-slate-400 px-1.5 py-0.2 rounded shadow-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        <nav className="flex-1 px-4 py-3 space-y-1.5">
          <NavLink to="/" className={navItemClass} title="Doctor Command Center">
            <LayoutDashboard size={20} /> Command Center
          </NavLink>
          <NavLink to="/patients" className={navItemClass}>
            <Users size={20} /> Patients
          </NavLink>
          <NavLink to="/consultations" className={navItemClass}>
            <Activity size={20} /> Consultations
          </NavLink>
          <NavLink to="/document-review" className={navItemClass}>
            <FileText size={20} /> Documents
          </NavLink>
          <NavLink to="/review" className={navItemClass} title="Physician Review Center">
            <ShieldCheck size={20} /> Review Center
          </NavLink>
          <NavLink to="/settings" className={navItemClass}>
            <Settings size={20} /> Settings
          </NavLink>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* SYNTHETIC BETA TOP BANNER */}
        <div className="bg-amber-500/10 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0 font-medium">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-bold text-[10px] tracking-wider uppercase">
              SYNTHETIC BETA — NO REAL PATIENT DATA
            </span>
            <span className="hidden md:inline text-amber-800">
              Proton Validation Environment &bull; All patients in this environment are synthetic.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-600/10 hover:bg-amber-600/20 text-amber-900 text-[11px] font-semibold border border-amber-300/60 transition-colors cursor-pointer"
            >
              <Search size={12} /> Search (⌘K)
            </button>
            <span className="text-[11px] text-amber-800/80 font-medium hidden sm:inline">
              Controlled Physician Evaluation
            </span>
          </div>
        </div>
        <main className="flex-1 overflow-auto bg-slate-50">
          <div className="max-w-6xl mx-auto p-8">{children}</div>
        </main>
      </div>

      {/* Global Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
