import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Activity, Users, LayoutDashboard, Settings, LogOut, FileText, Search, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMedplum } from '@medplum/react';
import CommandPalette from './ui/CommandPalette';

export default function Layout({ children }: { children: ReactNode }) {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Command Center', end: true },
    { to: '/patients', icon: Users, label: 'Patients' },
    { to: '/consultations', icon: Activity, label: 'Consultations' },
    { to: '/document-review', icon: FileText, label: 'Documents' },
    { to: '/review', icon: ShieldCheck, label: 'Review Center' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-[var(--color-surface-raised)]">
      {/* ── Sidebar ── */}
      <aside 
        className={`${sidebarCollapsed ? 'w-[68px]' : 'w-[240px]'} bg-[var(--color-surface)] border-r border-[var(--color-border-subtle)] flex flex-col shrink-0 transition-all duration-300 ease-[var(--ease-out-expo)]`}
      >
        {/* Brand */}
        <div className={`${sidebarCollapsed ? 'px-3 py-5' : 'px-5 py-5'} border-b border-[var(--color-border-subtle)]`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5'}`}>
            <div className="h-8 w-8 bg-brand-700 text-white rounded-lg flex items-center justify-center shrink-0">
              <Activity size={18} strokeWidth={2.5} />
            </div>
            {!sidebarCollapsed && (
              <div className="proton-animate-in">
                <span className="font-bold text-lg tracking-tight text-[var(--color-text-primary)]">PROTON</span>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="mt-2 proton-animate-in" style={{ animationDelay: '50ms' }}>
              <span className="proton-micro-label px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                Synthetic Beta
              </span>
            </div>
          )}
        </div>

        {/* Search Trigger */}
        <div className={`${sidebarCollapsed ? 'px-2' : 'px-3'} pt-3 pb-1`}>
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2' : 'justify-between px-3 py-2'} bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-lg text-xs text-[var(--color-text-tertiary)] font-medium transition-all duration-150 cursor-pointer group`}
            title="Search patients or execute actions (⌘K)"
          >
            <span className="flex items-center gap-2">
              <Search size={14} className="text-[var(--color-text-tertiary)] group-hover:text-brand-600 transition-colors" />
              {!sidebarCollapsed && <span>Search</span>}
            </span>
            {!sidebarCollapsed && (
              <span className="proton-kbd">⌘K</span>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${sidebarCollapsed ? 'px-2' : 'px-3'} py-3 space-y-0.5`}>
          {navItems.map((item) => {
            const active = isActive(item.to, item.end);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={item.label}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'} py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  active
                    ? 'bg-brand-50 text-brand-700 border border-brand-100'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)] border border-transparent'
                }`}
              >
                <item.icon size={18} strokeWidth={active ? 2 : 1.75} />
                {!sidebarCollapsed && item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className={`${sidebarCollapsed ? 'px-2' : 'px-3'} py-2`}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center py-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Sign Out */}
        <div className={`${sidebarCollapsed ? 'px-2' : 'px-3'} pb-4 pt-2 border-t border-[var(--color-border-subtle)]`}>
          <button
            onClick={handleLogout}
            className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'} py-2.5 w-full text-left rounded-lg text-[13px] font-medium text-[var(--color-text-tertiary)] hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer`}
          >
            <LogOut size={18} />
            {!sidebarCollapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Synthetic Beta Banner */}
        <div className="bg-amber-50/80 border-b border-amber-200/60 px-6 py-1.5 flex items-center justify-between text-[11px] text-amber-900 shrink-0 font-medium">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="proton-micro-label px-1.5 py-0.5 rounded bg-amber-600 text-white">
              SYNTHETIC BETA
            </span>
            <span className="hidden md:inline text-amber-700">
              All patients in this environment are synthetic · No real patient data permitted
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-100/60 hover:bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-200/60 transition-colors cursor-pointer"
            >
              <Search size={11} /> Search
              <span className="proton-kbd text-[9px] ml-0.5">⌘K</span>
            </button>
            <span className="text-[10px] text-amber-600 font-medium hidden sm:inline">
              Controlled Physician Evaluation
            </span>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-6 lg:py-8">{children}</div>
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
