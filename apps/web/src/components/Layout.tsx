import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Activity, 
  Users, 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  FileText, 
  Search, 
  ShieldCheck, 
  ChevronLeft, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useMedplum } from '@medplum/react';
import CommandPalette from './ui/CommandPalette';

interface LayoutProps {
  children: ReactNode;
  fullBleed?: boolean;
  canvasBg?: string;
}

export default function Layout({ 
  children,
  fullBleed = false,
  canvasBg
}: LayoutProps) {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Luxury Monochrome Dark Theme with Blackgrain background (Default: True)
  const [isLuxuryTheme, setIsLuxuryTheme] = useState<boolean>(() => {
    const saved = localStorage.getItem('proton_theme');
    return saved !== null ? saved === 'luxury' : true;
  });

  const toggleLuxuryTheme = () => {
    setIsLuxuryTheme((prev) => {
      const next = !prev;
      localStorage.setItem('proton_theme', next ? 'luxury' : 'classic');
      return next;
    });
  };

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
    <div className={`flex h-screen font-sans antialiased overflow-hidden ${
      isLuxuryTheme 
        ? 'bg-blackgrain text-zinc-100 luxury-theme selection:bg-white selection:text-black' 
        : 'bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]'
    }`}>
      {/* ── Sidebar ── */}
      <aside 
        className={`${sidebarCollapsed ? 'w-[68px]' : 'w-[240px]'} ${
          isLuxuryTheme
            ? 'bg-zinc-950/85 backdrop-blur-xl border-r border-white/10'
            : 'bg-[var(--color-surface)] border-r border-[var(--color-border-subtle)]'
        } flex flex-col shrink-0 transition-all duration-300 ease-[var(--ease-out-expo)]`}
      >
        {/* Brand */}
        <div className={`${sidebarCollapsed ? 'px-3 py-5' : 'px-5 py-5'} ${
          isLuxuryTheme ? 'border-b border-white/[0.08]' : 'border-b border-[var(--color-border-subtle)]'
        }`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5'}`}>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 font-bold transition-all ${
              isLuxuryTheme 
                ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
                : 'bg-brand-700 text-white'
            }`}>
              <Activity size={18} strokeWidth={2.5} />
            </div>
            {!sidebarCollapsed && (
              <div className="proton-animate-in flex flex-col">
                <span className={`font-semibold tracking-[0.16em] text-sm ${
                  isLuxuryTheme ? 'text-white' : 'text-[var(--color-text-primary)]'
                }`}>
                  PROTON
                </span>
                <span className={`text-[9px] font-mono tracking-widest uppercase ${
                  isLuxuryTheme ? 'text-zinc-500' : 'text-slate-400'
                }`}>
                  CLINICAL OS
                </span>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="mt-2.5 proton-animate-in" style={{ animationDelay: '50ms' }}>
              <span className={`text-[9px] font-mono tracking-wider px-2 py-0.5 rounded border uppercase ${
                isLuxuryTheme
                  ? 'bg-white/[0.04] text-zinc-400 border-white/10'
                  : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}>
                [ SYNTHETIC // R4 ]
              </span>
            </div>
          )}
        </div>

        {/* Search Trigger */}
        <div className={`${sidebarCollapsed ? 'px-2' : 'px-3'} pt-3 pb-1`}>
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className={`w-full flex items-center ${
              sidebarCollapsed ? 'justify-center px-2 py-2' : 'justify-between px-3 py-2'
            } ${
              isLuxuryTheme
                ? 'bg-zinc-900/60 hover:bg-zinc-800/60 border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
                : 'bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-sunken)] border-[var(--color-border-default)] text-[var(--color-text-tertiary)]'
            } border rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer group`}
            title="Search patients or execute actions (⌘K)"
          >
            <span className="flex items-center gap-2">
              <Search size={14} className={isLuxuryTheme ? 'text-zinc-400 group-hover:text-white transition-colors' : 'text-[var(--color-text-tertiary)] group-hover:text-brand-600 transition-colors'} />
              {!sidebarCollapsed && <span>Search</span>}
            </span>
            {!sidebarCollapsed && (
              <span className={isLuxuryTheme ? 'text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400' : 'proton-kbd'}>
                ⌘K
              </span>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${sidebarCollapsed ? 'px-2' : 'px-3'} py-3 space-y-1`}>
          {navItems.map((item) => {
            const active = isActive(item.to, item.end);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={item.label}
                className={`flex items-center ${
                  sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
                } py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  active
                    ? isLuxuryTheme
                      ? 'bg-white text-black font-semibold shadow-[0_2px_14px_rgba(255,255,255,0.18)]'
                      : 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                    : isLuxuryTheme
                      ? 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <item.icon 
                  size={17} 
                  strokeWidth={active ? 2.5 : 2} 
                  className={active ? (isLuxuryTheme ? 'text-black' : 'text-white') : (isLuxuryTheme ? 'text-zinc-500' : 'text-slate-400')} 
                />
                {!sidebarCollapsed && item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Theme Toggle (Luxury Blackgrain vs Classic) */}
        <div className={`${sidebarCollapsed ? 'px-2' : 'px-3'} py-2`}>
          <button
            onClick={toggleLuxuryTheme}
            className={`w-full flex items-center ${
              sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-3'
            } py-2 rounded-lg text-xs font-mono transition-all cursor-pointer ${
              isLuxuryTheme
                ? 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/10'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
            title="Toggle Black & White Luxury Theme"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={14} className={isLuxuryTheme ? 'text-zinc-300' : 'text-slate-500'} />
              {!sidebarCollapsed && <span>{isLuxuryTheme ? 'Luxury B&W' : 'Classic'}</span>}
            </span>
            {!sidebarCollapsed && (
              <span className={`text-[9px] px-1.5 py-0.2 rounded ${
                isLuxuryTheme ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-800'
              }`}>
                {isLuxuryTheme ? 'ON' : 'OFF'}
              </span>
            )}
          </button>
        </div>

        {/* Collapse Toggle */}
        <div className={`${sidebarCollapsed ? 'px-2' : 'px-3'} py-1`}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full flex items-center justify-center py-2 rounded-lg transition-colors cursor-pointer ${
              isLuxuryTheme 
                ? 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5' 
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]'
            }`}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Sign Out */}
        <div className={`${sidebarCollapsed ? 'px-2' : 'px-3'} pb-4 pt-2 ${
          isLuxuryTheme ? 'border-t border-white/[0.08]' : 'border-t border-[var(--color-border-subtle)]'
        }`}>
          <button
            onClick={handleLogout}
            className={`flex items-center ${
              sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
            } py-2.5 w-full text-left rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
              isLuxuryTheme
                ? 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
                : 'text-[var(--color-text-tertiary)] hover:bg-red-50 hover:text-red-700'
            }`}
          >
            <LogOut size={17} />
            {!sidebarCollapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Telemetry Banner */}
        <div className={`${
          isLuxuryTheme
            ? 'bg-zinc-950/80 backdrop-blur-md border-b border-white/10 px-6 py-2 text-zinc-400'
            : 'bg-amber-50/80 border-b border-amber-200/60 px-6 py-1.5 text-amber-900'
        } flex items-center justify-between text-[11px] font-mono shrink-0`}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${
              isLuxuryTheme
                ? 'bg-white/10 text-white border border-white/20'
                : 'bg-amber-600 text-white'
            }`}>
              SYNTHETIC BETA
            </span>
            <span className={`hidden md:inline ${isLuxuryTheme ? 'text-zinc-400' : 'text-amber-700'}`}>
              All patients in this environment are synthetic &bull; Zero real PHI permitted
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                isLuxuryTheme
                  ? 'bg-white/[0.05] hover:bg-white/10 text-zinc-300 border border-white/10'
                  : 'bg-amber-100/60 hover:bg-amber-100 text-amber-800 border border-amber-200/60'
              }`}
            >
              <Search size={11} /> Quick Action
              <span className={`text-[9px] font-mono ml-0.5 ${isLuxuryTheme ? 'text-zinc-400' : 'proton-kbd'}`}>⌘K</span>
            </button>
            <span className={`text-[10px] font-mono hidden md:inline flex items-center gap-1.5 ${
              isLuxuryTheme ? 'text-zinc-500' : 'text-amber-600'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 animate-pulse" />
              PHYSICIAN GOVERNANCE ACTIVE
            </span>
          </div>
        </div>

        {/* Page Content */}
        <main className={`flex-1 overflow-auto ${isLuxuryTheme ? 'bg-blackgrain text-zinc-100' : (canvasBg || '')}`}>
          {fullBleed ? children : (
            <div className="max-w-[1240px] mx-auto px-6 lg:px-8 py-6 lg:py-8">{children}</div>
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
