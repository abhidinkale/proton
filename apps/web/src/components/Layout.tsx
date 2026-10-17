import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Users,
  Activity,
  Bot,
  FileText,
  Inbox,
  Settings,
  LogOut,
  Search,
  Command,
  ShieldCheck,
  Stethoscope,
  Menu,
  X
} from 'lucide-react';
import { useMedplum } from '@medplum/react';
import AppearanceToggle from './AppearanceToggle';
import CommandPalette from './ui/CommandPalette';
import { authService } from '../services/auth';

interface LayoutProps {
  children: ReactNode;
  fullBleed?: boolean;
  fillCanvas?: boolean;
  canvasBg?: string;
}

const primaryNavItems = [
  { to: '/', label: 'Command Center', icon: CalendarDays, end: true },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/consultation', label: 'Doctor Desk', icon: Activity },
  { to: '/assistant', label: 'AI Clinical Assistant', icon: Bot },
  { to: '/document-review', label: 'Document Intelligence', icon: FileText },
  { to: '/operations', label: 'Operations Center', icon: Inbox },
];

function getContextTitle(pathname: string): { title: string; subtitle: string } {
  if (pathname.startsWith('/patients/')) {
    return { title: 'Patient Profile', subtitle: 'Longitudinal record & clinical history' };
  }
  if (pathname.startsWith('/patients')) {
    return { title: 'Patient Panel', subtitle: 'Active clinical cohort & intake' };
  }
  if (pathname.startsWith('/consultation')) {
    return { title: 'Doctor Desk', subtitle: 'Ambient consultation & encounter' };
  }
  if (pathname.startsWith('/assistant')) {
    return { title: 'Clinical AI Assistant', subtitle: 'Diagnostic reasoning & chart intelligence' };
  }
  if (pathname.startsWith('/document-review') || pathname.startsWith('/documents') || pathname.startsWith('/review')) {
    return { title: 'Document Intelligence', subtitle: 'Optical extraction & verified facts' };
  }
  if (pathname.startsWith('/operations')) {
    return { title: 'Operations OS', subtitle: 'Triage, refills, referrals & queue' };
  }
  if (pathname.startsWith('/settings')) {
    return { title: 'Workspace Settings', subtitle: 'Clinician preferences & integrations' };
  }
  return { title: 'Doctor Command Center', subtitle: 'Clinical overview & attention queue' };
}

export default function Layout({
  children,
  fullBleed = false,
  fillCanvas = false,
  canvasBg = 'bg-[#F8F8F6]'
}: LayoutProps) {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const currentUser = authService.getCurrentUser();
  const doctorName = currentUser?.displayName || 'Dr. Aris Thorne, MD';

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

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    authService.logout();
    medplum.signOut().then(() => navigate('/login')).catch(() => navigate('/login'));
  };

  const contextMeta = getContextTitle(location.pathname);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F8F8F6] text-[#121417] font-sans antialiased selection:bg-zinc-200 selection:text-zinc-900">
      
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-[#EAE8E3] shrink-0 z-20">
        
        {/* Brand & System Status */}
        <div className="h-16 px-5 border-b border-[#EAE8E3]/80 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2.5 group cursor-pointer" aria-label="Proton Home">
            <div className="w-8 h-8 rounded-xl bg-[#111315] text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-sm group-hover:scale-[1.02] transition-transform">
              P+
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm tracking-tight text-[#111315]">
                Proton<span className="text-[#0F766E]">.</span>
              </span>
              <span className="text-[10px] text-[#6E767E] font-medium tracking-tight">Clinical OS</span>
            </div>
          </NavLink>

          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
        </div>

        {/* Quick Search / Command Trigger */}
        <div className="px-3.5 pt-3.5 pb-2">
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#6E767E] bg-[#F8F8F6] hover:bg-[#F2F1EC] hover:text-[#111315] border border-[#EAE8E3] rounded-xl transition-all cursor-pointer shadow-2xs group"
            title="Search patients or execute actions (⌘K)"
          >
            <span className="flex items-center gap-2">
              <Search size={14} className="text-[#949CA4] group-hover:text-[#111315] transition-colors" />
              <span>Search patients, records</span>
            </span>
            <kbd className="flex items-center gap-0.5 text-[9.5px] text-[#8C949D] font-mono border border-[#EAE8E3] px-1.5 py-0.5 rounded-md bg-white">
              <Command size={9} /> K
            </kbd>
          </button>
        </div>

        {/* Navigation Section */}
        <div className="px-4 pt-3 pb-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-[#949CA4] font-medium">
            CLINICAL WORKSPACE
          </span>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {primaryNavItems.map((item) => {
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  active
                    ? 'bg-[#111315] text-white font-semibold shadow-xs'
                    : 'text-[#50575F] hover:bg-[#F4F3EE] hover:text-[#111315]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <item.icon
                    size={16}
                    strokeWidth={active ? 2.2 : 1.75}
                    className={active ? 'text-white' : 'text-[#858D96] group-hover:text-[#111315] transition-colors'}
                  />
                  <span>{item.label}</span>
                </div>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Safety & Physician Governance Banner */}
        <div className="p-3 mx-3 mb-2 rounded-2xl bg-[#F8F8F6] border border-[#EAE8E3] space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111315]">
            <ShieldCheck size={14} className="text-[#0F766E] shrink-0" />
            <span>Clinical Autonomy</span>
          </div>
          <p className="text-[11px] text-[#6E767E] leading-relaxed">
            Deterministic safety rails active. All AI proposals require explicit physician sign-off.
          </p>
        </div>

        {/* Physician Profile Card */}
        <div className="p-2.5 mx-3 mb-2 rounded-2xl bg-white border border-[#EAE8E3] flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#F4F3EE] text-[#111315] font-semibold text-xs flex items-center justify-center shrink-0 border border-[#EAE8E3]">
              DR
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[#111315] truncate">{doctorName}</div>
              <div className="text-[10px] text-[#8C949D] truncate font-mono">Attending • NPI: 1841290481</div>
            </div>
          </div>
        </div>

        {/* Settings & Sign Out */}
        <div className="px-3 py-2.5 border-t border-[#EAE8E3] flex items-center justify-between text-xs text-[#6E767E]">
          <NavLink
            to="/settings"
            className="flex items-center gap-1.5 hover:text-[#111315] transition-colors py-1 px-1.5 rounded-lg hover:bg-[#F4F3EE]"
          >
            <Settings size={14} />
            <span>Settings</span>
          </NavLink>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 hover:text-red-700 transition-colors py-1 px-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
            title="Sign out of clinical desk"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── MOBILE OVERLAY DRAWER ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 bg-white h-full flex flex-col shadow-2xl z-10 border-r border-[#EAE8E3]">
            <div className="h-16 px-5 border-b border-[#EAE8E3] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#111315] text-white flex items-center justify-center font-bold text-xs">
                  P+
                </div>
                <span className="font-bold text-sm tracking-tight text-[#111315]">Proton Clinical OS</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg text-[#6E767E] hover:bg-[#F4F3EE]"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {primaryNavItems.map((item) => {
                const active = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium ${
                      active ? 'bg-[#111315] text-white font-semibold' : 'text-[#50575F] hover:bg-[#F4F3EE]'
                    }`}
                  >
                    <item.icon size={17} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="p-4 border-t border-[#EAE8E3]">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-semibold"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN WORKSPACE CONTENT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Clinical Header Bar */}
        <header className="h-16 bg-white border-b border-[#EAE8E3] px-4 sm:px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-[#50575F] hover:bg-[#F4F3EE] cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#8C949D] font-mono leading-none">
                <span>PROTON</span>
                <span>/</span>
                <span className="uppercase text-[#50575F] truncate">{contextMeta.title}</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#111315] truncate leading-tight mt-0.5">
                {contextMeta.title}
              </h1>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Synthetic Environment Tag */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-[#F4F3EE] text-[#50575F] border border-[#EAE8E3]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>SYNTHETIC EVALUATION // FHIR R4</span>
            </span>

            {/* Global Search Button */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-[#EAE8E3] text-[#50575F] hover:bg-[#F4F3EE] hover:text-[#111315] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Search command palette (⌘K)"
            >
              <Search size={14} />
              <span className="hidden md:inline">Quick Jump</span>
              <kbd className="hidden md:inline font-mono text-[9px] text-[#8C949D] border border-[#EAE8E3] px-1 rounded bg-white">
                ⌘K
              </kbd>
            </button>

            {/* Appearance Mode */}
            <AppearanceToggle />

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => navigate('/consultation')}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#111315] hover:bg-[#272B30] text-white rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer"
            >
              <Stethoscope size={14} className="text-emerald-400" />
              <span className="hidden sm:inline">New Consultation</span>
              <span className="sm:hidden">Consult</span>
            </button>
          </div>
        </header>

        {/* Dynamic Canvas Container */}
        <main
          className={`flex-1 overflow-y-auto ${fillCanvas ? 'min-h-0' : ''} ${canvasBg}`}
        >
          {fullBleed ? (
            children
          ) : (
            <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8${fillCanvas ? ' h-full flex flex-col' : ''}`}>
              {children}
            </div>
          )}
        </main>

        {/* Mobile Navigation Bottom Bar */}
        <nav className="lg:hidden flex items-center justify-around bg-white border-t border-[#EAE8E3] py-2 px-2 shrink-0 z-20">
          {primaryNavItems.slice(0, 5).map((item) => {
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                  active ? 'text-[#111315] font-bold' : 'text-[#8C949D]'
                }`}
              >
                <item.icon size={18} strokeWidth={active ? 2.2 : 1.75} />
                <span className="mt-0.5 leading-none">{item.label.split(' ')[0]}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
