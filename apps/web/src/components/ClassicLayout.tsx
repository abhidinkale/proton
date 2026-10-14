import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, 
  Settings, 
  LogOut, 
  FileText, 
  Search, 
  CheckSquare, 
  Activity,
  MessageSquareText,
  CalendarDays,
} from 'lucide-react';
import { useMedplum } from '@medplum/react';
import AppearanceToggle from './AppearanceToggle';
import CommandPalette from './ui/CommandPalette';

interface LayoutProps {
  children: ReactNode;
  fullBleed?: boolean;
  fillCanvas?: boolean;
  canvasBg?: string;
}

export default function Layout({ 
  children,
  fullBleed = false,
  fillCanvas = false,
  canvasBg = 'bg-[#fafaf9]'
}: LayoutProps) {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const location = useLocation();
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
          setIsCommandPaletteOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Primary navigation specified: Today, Patients, Consultations, Documents, Review
  const primaryNavItems = [
    { to: '/', icon: CalendarDays, label: 'Today', end: true },
    { to: '/patients', icon: Users, label: 'Patients' },
    { to: '/consultation', icon: Activity, label: 'Consultations' },
    { to: '/document-review', icon: FileText, label: 'Documents' },
    { to: '/review', icon: CheckSquare, label: 'Review' },
    { to: '/assistant', icon: MessageSquareText, label: 'Assistant' },
  ];

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="proton-classic-shell flex h-screen bg-[#fafaf9] text-zinc-900 font-sans antialiased overflow-hidden">
      {/* ── Sidebar (Calm Clinical Workspace Shell) ── */}
      <aside className="w-56 bg-white border-r border-zinc-200 flex flex-col shrink-0">
        
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              P
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-zinc-900 leading-none block">
                Proton
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">Physician Desk</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>

        {/* Search Input Trigger */}
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-500 bg-zinc-50 hover:bg-zinc-100 hover:text-zinc-800 border border-zinc-200 rounded-md transition-colors cursor-pointer"
            title="Search patients or execute actions (⌘K)"
          >
            <span className="flex items-center gap-2">
              <Search size={13} className="text-zinc-400" />
              <span>Search patients</span>
            </span>
            <kbd className="text-[10px] text-zinc-400 font-sans border border-zinc-200 px-1 rounded bg-white">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {primaryNavItems.map((item) => {
            const active = isActive(item.to, item.end);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? 'bg-zinc-100 text-zinc-900 font-semibold'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <item.icon 
                  size={15} 
                  strokeWidth={active ? 2.25 : 1.75} 
                  className={active ? 'text-zinc-900' : 'text-zinc-400'} 
                />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Physician Profile Card */}
        <div className="p-2.5 mx-3 mb-2 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
            DP
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-zinc-900 truncate">Dr. Physician, MD</div>
            <div className="text-[10px] text-zinc-500 truncate">Attending • Internal Med</div>
          </div>
        </div>

        {/* Secondary: Settings & Sign Out */}
        <div className="px-3 py-3 border-t border-zinc-200 space-y-0.5">
          <NavLink
            to="/settings"
            className={({ isActive: active }) => `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active
                ? 'bg-zinc-100 text-zinc-900 font-semibold'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
            }`}
          >
            <Settings size={15} strokeWidth={1.75} className="text-zinc-400" />
            <span>Settings</span>
          </NavLink>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-2.5 py-1.5 w-full text-left rounded-md text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-red-700 transition-colors cursor-pointer"
          >
            <LogOut size={15} strokeWidth={1.75} className="text-zinc-400" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <nav className="proton-classic-mobile-nav" aria-label="Primary navigation">
        {primaryNavItems.map((item) => {
          const active = isActive(item.to, item.end);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={`proton-classic-mobile-nav-link${active ? ' is-active' : ''}`}
            >
              <item.icon size={16} strokeWidth={active ? 2.1 : 1.8} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        <NavLink
          to="/settings"
          className={({ isActive: active }) => `proton-classic-mobile-nav-link${active ? ' is-active' : ''}`}
        >
          <Settings size={16} strokeWidth={1.8} />
          <span>Settings</span>
        </NavLink>
      </nav>

      {/* ── Main Workspace Area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Subtle Evaluation Context Bar */}
        <div className="bg-white border-b border-zinc-200 px-6 py-2 flex items-center justify-between text-xs text-zinc-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-700">Clinical Evaluation Environment</span>
            <span className="text-zinc-300">•</span>
            <span className="text-zinc-500">Synthetic FHIR R4 Records</span>
          </div>
          <div className="flex items-center gap-3">
            <AppearanceToggle />
            <span className="text-[11px] text-zinc-500">
              Physician approval required for all clinical commitments
            </span>
          </div>
        </div>

        {/* Page Canvas */}
        <main className={`flex-1 overflow-y-auto ${fillCanvas ? 'min-h-0' : ''} ${canvasBg}`}>
          {fullBleed ? children : (
            <div className={`max-w-6xl mx-auto px-6 py-8${fillCanvas ? ' h-full flex flex-col' : ''}`}>{children}</div>
          )}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
