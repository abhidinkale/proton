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
  CalendarDays,
  Inbox
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
  canvasBg = 'bg-canvas'
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

  // Primary navigation: Command Center, Patients, Consultations, Documents, Operations, Settings, Review Center
  const primaryNavItems = [
    { to: '/today', icon: CalendarDays, label: 'Today' },
    { to: '/dashboard', icon: CalendarDays, label: 'Command Center' },
    { to: '/patients', icon: Users, label: 'Patients' },
    { to: '/consultation', icon: Activity, label: 'Consultations' },
    { to: '/document-review', icon: FileText, label: 'Documents' },
    { to: '/operations', icon: Inbox, label: 'Operations' },
    { to: '/settings', icon: Settings, label: 'Settings' },
    { to: '/review', icon: CheckSquare, label: 'Review Center' },
  ];

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="proton-classic-shell flex h-screen bg-canvas text-ink font-sans antialiased overflow-hidden">
      {/* ── Sidebar (Calm Clinical Workspace Shell) ── */}
      <aside className="w-56 bg-paper border-r border-rule flex flex-col shrink-0">
        
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-rule/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-solid text-white flex items-center justify-center font-bold text-xs shadow-xs">
              P
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-ink leading-none block">
                Proton
              </span>
              <span className="text-[10px] text-ink-3 font-medium">Physician Desk</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-settled-wash text-settled border border-settled-line">
            <span className="w-1.5 h-1.5 rounded-full bg-settled-wash0 animate-pulse" />
            Live
          </span>
        </div>

        {/* Search Input Trigger */}
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-on-solid0 bg-paper-2 hover:bg-paper-2 hover:text-ink border border-rule rounded-md transition-colors cursor-pointer"
            title="Search patients or execute actions (⌘K)"
          >
            <span className="flex items-center gap-2">
              <Search size={13} className="text-ink-3" />
              <span>Search patients</span>
            </span>
            <kbd className="text-[10px] text-ink-3 font-sans border border-rule px-1 rounded bg-paper">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {primaryNavItems.map((item) => {
            const active = isActive(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? 'bg-paper-2 text-ink font-semibold'
                    : 'text-ink-2 hover:bg-paper-2 hover:text-ink'
                }`}
              >
                <item.icon 
                  size={15} 
                  strokeWidth={active ? 2.25 : 1.75} 
                  className={active ? 'text-ink' : 'text-ink-3'} 
                />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Physician Profile Card */}
        <div className="p-2.5 mx-3 mb-2 rounded-xl bg-paper-2 border border-rule/80 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-solid text-white font-bold text-xs flex items-center justify-center shrink-0">
            DP
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-ink truncate">Dr. Physician, MD</div>
            <div className="text-[10px] text-on-solid0 truncate">Attending • Internal Med</div>
          </div>
        </div>

        {/* Secondary: Settings & Sign Out */}
        <div className="px-3 py-3 border-t border-rule space-y-0.5">
          <NavLink
            to="/settings"
            className={({ isActive: active }) => `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active
                ? 'bg-paper-2 text-ink font-semibold'
                : 'text-on-solid0 hover:bg-paper-2 hover:text-ink'
            }`}
          >
            <Settings size={15} strokeWidth={1.75} className="text-ink-3" />
            <span>Settings</span>
          </NavLink>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-2.5 py-1.5 w-full text-left rounded-md text-xs font-medium text-on-solid0 hover:bg-paper-2 hover:text-critical transition-colors cursor-pointer"
          >
            <LogOut size={15} strokeWidth={1.75} className="text-ink-3" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <nav className="proton-classic-mobile-nav" aria-label="Primary navigation">
        {primaryNavItems.map((item) => {
          const active = isActive(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
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
        <div className="bg-paper border-b border-rule px-6 py-2 flex items-center justify-between text-xs text-on-solid0 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink-2">Clinical Evaluation Environment</span>
            <span className="text-ink-3">•</span>
            <span className="text-on-solid0">Synthetic FHIR R4 Records</span>
          </div>
          <div className="flex items-center gap-3">
            <AppearanceToggle />
            <span className="text-[11px] text-on-solid0">
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
