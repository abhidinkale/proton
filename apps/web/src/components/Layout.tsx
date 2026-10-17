import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Users,
  Bot,
  FileText,
  Inbox,
  LogOut,
  Search,
  Plus,
  Menu,
  X,
  Stethoscope
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

const navModules = [
  {
    category: 'CLINICAL CORE',
    items: [
      {
        to: '/',
        label: 'Command Center',
        subtitle: 'Daily triage & overview',
        icon: CalendarDays,
        iconBg: 'bg-zinc-100 text-zinc-900',
        end: true
      },
      {
        to: '/consultation',
        label: 'Doctor Desk',
        subtitle: 'Ambient encounter & SOAP',
        icon: Stethoscope,
        iconBg: 'bg-teal-50 text-teal-800'
      },
      {
        to: '/patients',
        label: 'Patients',
        subtitle: 'Directory & longitudinal cohort',
        icon: Users,
        iconBg: 'bg-amber-50 text-amber-900'
      },
      {
        to: '/assistant',
        label: 'AI Assistant',
        subtitle: 'Conversational clinical brain',
        icon: Bot,
        iconBg: 'bg-indigo-50 text-indigo-800'
      }
    ]
  },
  {
    category: 'SPECIALTY INTELLIGENCE',
    items: [
      {
        to: '/document-review',
        label: 'Documents',
        subtitle: 'Optical extraction & OCR',
        icon: FileText,
        iconBg: 'bg-rose-50 text-rose-800'
      },
      {
        to: '/operations',
        label: 'Operations',
        subtitle: 'Refills, scheduling & queue',
        icon: Inbox,
        iconBg: 'bg-emerald-50 text-emerald-800'
      }
    ]
  }
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
  canvasBg = 'bg-[#ECEEEF]'
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
    <div className={`h-screen w-full overflow-hidden ${canvasBg} p-2 sm:p-3 md:p-4 lg:p-5 flex items-center justify-center font-sans antialiased selection:bg-zinc-200 selection:text-zinc-900`}>
      
      {/* ── FLOATING LUXURY TABLET SLAB (Inspired by Diamond/Editorial Concept) ── */}
      <div className="w-full h-full max-w-[1720px] bg-white rounded-[24px] sm:rounded-[32px] md:rounded-[36px] shadow-2xl border border-black/[0.04] flex flex-row overflow-hidden relative">
        
        {/* ── DESKTOP MINIMAL SIDEBAR (Inspired by Nolla) ── */}
        <aside className="hidden lg:flex flex-col w-64 bg-[#FAF9F5]/70 border-r border-[#EFEFEA] shrink-0 z-20">
          
          {/* Top Brand Glyph & Status */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-[#EFEFEA]/80">
            <NavLink to="/" className="flex items-center gap-2.5 group cursor-pointer" aria-label="Proton Home">
              <div className="w-8 h-8 rounded-xl bg-[#111315] text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-xs group-hover:scale-[1.03] transition-transform">
                P+
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-bold text-sm tracking-tight text-[#111315]">
                  Proton<span className="text-[#0F766E]">.</span>
                </span>
                <span className="text-[9.5px] text-[#8C949D] font-mono mt-0.5">Clinical OS</span>
              </div>
            </NavLink>

            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-mono font-medium bg-white text-[#50575F] border border-[#EAE8E3]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>ONLINE</span>
            </span>
          </div>

          {/* "+ New Encounter" Prominent Rounded Action Button (Nolla-style) */}
          <div className="p-3.5">
            <button
              type="button"
              onClick={() => navigate('/consultation')}
              className="w-full py-3 px-3.5 rounded-2xl bg-[#EFECE6] hover:bg-[#E5E1D8] text-[#111315] transition-all flex items-center gap-3 text-left shadow-2xs group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-xl bg-white text-[#111315] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
                <Plus size={15} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight truncate">New Encounter</div>
                <div className="text-[10px] text-[#6E767E] truncate">Start patient visit</div>
              </div>
            </button>
          </div>

          {/* Search Trigger */}
          <div className="px-3.5 pb-2">
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-[#6E767E] bg-white hover:bg-[#F8F8F6] border border-[#EAE8E3] rounded-xl transition-all cursor-pointer shadow-2xs group"
            >
              <span className="flex items-center gap-2">
                <Search size={13} className="text-[#949CA4]" />
                <span className="text-[11px]">Quick Jump</span>
              </span>
              <kbd className="text-[9px] text-[#8C949D] font-mono border border-[#EAE8E3] px-1 py-0.2 rounded bg-[#FAF9F5]">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Module Navigation with Soft App Tile Icons */}
          <nav className="flex-1 px-3 space-y-4 overflow-y-auto py-2">
            {navModules.map((section) => (
              <div key={section.category} className="space-y-1">
                <div className="px-2 pb-1">
                  <span className="text-[9px] font-mono tracking-wider text-[#949CA4] uppercase font-semibold">
                    {section.category}
                  </span>
                </div>
                {section.items.map((item) => {
                  const active = item.end
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={`group flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs transition-all ${
                        active
                          ? 'bg-white text-[#111315] font-semibold shadow-xs border border-[#EAE8E3]'
                          : 'text-[#50575F] hover:bg-white/60 hover:text-[#111315]'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform ${item.iconBg} ${active ? 'scale-105' : 'opacity-85 group-hover:opacity-100'}`}>
                        <item.icon size={15} strokeWidth={active ? 2.2 : 1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs truncate leading-tight">{item.label}</div>
                      </div>
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E] shrink-0" />
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Bottom Physician Profile & Sign Out (Nolla-style bottom shelf) */}
          <div className="p-3 border-t border-[#EFEFEA]/80 bg-white/50 space-y-1.5">
            <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#111315] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  DR
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#111315] truncate leading-tight">
                    {doctorName}
                  </div>
                  <div className="text-[9.5px] text-[#8C949D] truncate">Attending Physician</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-[#8C949D] hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </aside>

        {/* ── MOBILE OVERLAY DRAWER ── */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative w-72 bg-[#FAF9F5] h-full flex flex-col shadow-2xl z-10 border-r border-[#EAE8E3]">
              <div className="h-16 px-5 border-b border-[#EAE8E3] flex items-center justify-between bg-white">
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

              <div className="p-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/consultation');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#111315] text-white text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  <span>New Encounter</span>
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navModules.flatMap(m => m.items).map((item) => {
                  const active = item.end
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium ${
                        active ? 'bg-white border border-[#EAE8E3] text-[#111315] font-semibold' : 'text-[#50575F] hover:bg-white/60'
                      }`}
                    >
                      <item.icon size={16} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-[#EAE8E3] bg-white">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN WORKSPACE VIEWPORT ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
          
          {/* Minimal Editorial Top Header (Image 2 style) */}
          <header className="h-14 bg-white/90 backdrop-blur-xs border-b border-[#F0EFEA] px-4 sm:px-6 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-1.5 rounded-lg text-[#50575F] hover:bg-[#F4F3EE] cursor-pointer"
                aria-label="Open navigation menu"
              >
                <Menu size={18} />
              </button>
              
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#949CA4] font-medium hidden sm:inline">
                  PROTON
                </span>
                <span className="text-[#CBD5E1] hidden sm:inline">/</span>
                <h1 className="text-xs sm:text-sm font-semibold tracking-tight text-[#111315] truncate">
                  {contextMeta.title}
                </h1>
              </div>
            </div>

            {/* Right Tools */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="px-2.5 py-1 rounded-lg border border-[#EAE8E3] text-[#6E767E] hover:text-[#111315] hover:bg-[#FAF9F5] text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Search size={12} />
                <span className="hidden sm:inline">Search</span>
                <kbd className="text-[9px] font-mono text-[#8C949D] px-1 py-0.2 rounded bg-[#FAF9F5] border border-[#EAE8E3]">⌘K</kbd>
              </button>

              <AppearanceToggle />
            </div>
          </header>

          {/* Workspace Body */}
          <main className={`flex-1 min-h-0 overflow-y-auto ${
            fillCanvas ? 'p-0' : fullBleed ? 'p-3 sm:p-4' : 'p-4 sm:p-6 lg:p-8'
          }`}>
            <div className="max-w-6xl mx-auto h-full">
              {children}
            </div>
          </main>
        </div>

      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
