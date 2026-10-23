import { useState, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMedplum } from '@medplum/react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Drawer } from './Drawer';
import { authService } from '../../services/auth';
import CommandPalette from '../../components/ui/CommandPalette';
import ProtonShortcutsModal from '../../components/proton/ProtonShortcutsModal';
import ProtonCopilot, { type CopilotMode } from '../../components/proton/ProtonCopilot';
import { Bell, AlertTriangle, X, LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { PageTransition } from '../motion/primitives';
import { SESSION_EXPIRED_EVENT } from '../../lib/api';
import { DEFAULT_GENERAL_NAV, DEFAULT_TOOLS_NAV } from './Sidebar';

export interface AppShellProps {
  children: ReactNode;
  fullBleed?: boolean;
  fillCanvas?: boolean;
  className?: string;
}

export function AppShell({
  children,
  fullBleed = false,
  fillCanvas = false,
  className = ''
}: AppShellProps) {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [copilotMode, setCopilotMode] = useState<CopilotMode>('minimized');
  const [searchScope, setSearchScope] = useState<'Patients' | 'Education' | 'Prescriptions' | 'Test results'>('Patients');

  const currentUser = authService.getCurrentUser();
  const doctorName = currentUser?.displayName || 'Dr. Olivia';

  // Global Keyboard Shortcuts (⌘K, ⌘/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close overlays on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsNotificationsOpen(false);
  }, [location.pathname]);

  // Heal sessions that predate the Proton token bridge (or arrive tokenless in a new tab).
  useEffect(() => {
    void authService.ensureProtonSession();
  }, []);

  // One authoritative reaction to an expired credential, instead of every panel racing to redirect.
  useEffect(() => {
    const handleExpired = () => {
      authService.logout().catch(() => undefined);
      navigate('/login?reason=session_expired', { replace: true });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, [navigate]);

  const handleLogout = () => {
    authService.logout();
    medplum.signOut().then(() => navigate('/login')).catch(() => navigate('/login'));
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className={`relative min-h-screen w-full bg-[#EDECEA] text-[#151719] flex flex-col font-sans antialiased selection:bg-[#DDF25B] selection:text-[#26320A] ${className}`}>

      {/* Ambient light: a soft studio falloff rather than coloured orbs. */}
      <div className="proton-workspace-ambient" aria-hidden="true">
        <div className="proton-orb -top-56 left-1/2 h-[46rem] w-[52rem] -translate-x-1/2 bg-white/70" />
        <div className="proton-orb -right-48 top-1/4 h-[34rem] w-[34rem] bg-[#F5E7EA]/45" />
        <div className="proton-orb -left-48 bottom-0 h-[30rem] w-[30rem] bg-[#E6EDF5]/45" />
        <div className="proton-grain absolute inset-0" />
      </div>

      {/* Desktop Main Application Frame */}
      <div className="relative z-10 flex-1 flex overflow-hidden min-h-screen">
        
        {/* Left Persistent Navigation Rail */}
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(prev => !prev)}
          onLogout={handleLogout}
          currentPath={location.pathname}
        />

        {/* Main Workspace Viewport */}
        <div className={`flex-1 flex flex-col min-w-0 min-h-screen overflow-hidden transition-all duration-300 ${copilotMode === 'docked' ? 'lg:mr-96' : ''}`}>
          
          {/* TopBar */}
          <TopBar
            doctorName={doctorName}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            onToggleCopilot={() => setCopilotMode(prev => prev === 'minimized' ? 'floating' : prev === 'floating' ? 'docked' : 'minimized')}
            onNavigateSettings={() => navigate('/settings')}
            searchScope={searchScope}
            onSelectSearchScope={setSearchScope}
          />

          {/* Workspace Body */}
          <main className={`flex-1 overflow-y-auto px-4 sm:px-7 pb-12 ${fillCanvas ? 'p-0' : fullBleed ? 'p-2' : ''}`}>
            <div className="max-w-[1560px] mx-auto">
              <PageTransition routeKey={location.pathname} className="w-full">
                {children}
              </PageTransition>
            </div>
          </main>

        </div>

      </div>

      {/* Clinical Attention Queue Drawer */}
      <Drawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#151719]" />
            <span>Clinical Attention Queue</span>
          </div>
        }
        width="md"
      >
        <div className="space-y-3">
          {/* Critical notification */}
          <div className="p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#991B1B]">
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Critical Lab Alert
              </span>
              <span>5 min ago</span>
            </div>
            <p className="text-xs font-semibold text-[#151719]">
              Eleanor Vance: HbA1c escalated to 8.2% (+1.1% delta)
            </p>
            <p className="text-[11px] text-[#575D65]">
              Microalbumin/creatinine ratio flagged. Review cardiorenal treatment plan.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsNotificationsOpen(false);
                navigate('/consultation?patient=demo-scenario-b-eleanor');
              }}
              className="w-full mt-2 py-1.5 rounded-xl bg-[#991B1B] text-white text-[11px] font-semibold text-center cursor-pointer hover:bg-[#7F1D1D]"
            >
              Review Patient Record
            </button>
          </div>

          {/* Medication Interaction Alert */}
          <div className="p-3.5 rounded-2xl bg-[#FEF08A]/70 border border-[#FDE047] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#854D0E]">
              <span>Safety Stop Intercept</span>
              <span>18 min ago</span>
            </div>
            <p className="text-xs font-semibold text-[#151719]">
              Robert Hayes: Penicillin Anaphylaxis Guard
            </p>
            <p className="text-[11px] text-[#575D65]">
              Prescription draft Amoxicillin hard-blocked by deterministic safety engine.
            </p>
          </div>

          {/* Unsigned note */}
          <div className="p-3.5 rounded-2xl bg-[#F9F8F5] border border-[#E8E5DC] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#575D65]">
              <span>Documentation</span>
              <span>1h ago</span>
            </div>
            <p className="text-xs font-semibold text-[#151719]">
              Arthur Pendelton: 1 encounter note awaiting physician sign-off
            </p>
            <button
              type="button"
              onClick={() => {
                setIsNotificationsOpen(false);
                navigate('/consultation?patient=demo-scenario-d-arthur');
              }}
              className="text-xs font-bold text-[#151719] hover:underline"
            >
              Open Sign-off →
            </button>
          </div>
        </div>
      </Drawer>

      {/* Mobile Overlay Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-2xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex h-full w-72 flex-col gap-5 bg-[#F4F3F1] p-4 shadow-2xl">
            <div className="flex items-center justify-between px-1 pb-1">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#151719] text-[13px] font-semibold text-white">
                  p
                </span>
                <span className="text-[19px] font-semibold lowercase tracking-[-0.045em] text-[#111110]">proton</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-[#6F6F6D] hover:text-[#151719] cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X size={16} />
              </button>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <div className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#A5A4A0]">Workspace</div>
                {DEFAULT_GENERAL_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex h-11 items-center gap-3 rounded-full px-3.5 text-[12.5px] font-medium transition-colors ${
                        isActive
                          ? 'bg-white text-[#151719] shadow-[0_10px_30px_-22px_rgba(20,20,18,0.6)]'
                          : 'text-[#777774] hover:bg-white/60 hover:text-[#151719]'
                      }`
                    }
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>

              <div className="space-y-1">
                <div className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#A5A4A0]">Tools</div>
                {DEFAULT_TOOLS_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex h-11 items-center gap-3 rounded-full px-3.5 text-[12.5px] font-medium transition-colors ${
                        isActive
                          ? 'bg-white text-[#151719] shadow-[0_10px_30px_-22px_rgba(20,20,18,0.6)]'
                          : 'text-[#777774] hover:bg-white/60 hover:text-[#151719]'
                      }`
                    }
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </nav>

            <div className="rounded-[22px] bg-white/70 p-3">
              <span className="rounded-full bg-[#DDF25B] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em] text-[#26320A]">
                Synthetic
              </span>
              <p className="mt-2 text-[11px] font-semibold text-[#2A2A28]">Validation cohort</p>
              <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#9A9995]">
                No real PHI. Every write needs a signature.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="flex h-10 w-full items-center gap-3 rounded-full px-3.5 text-[11.5px] font-medium text-[#8A8A87] hover:bg-white/60 hover:text-[#C0483F] cursor-pointer"
            >
              <LogOut size={15} />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}

      {/* Docked / Floating AI Copilot */}
      <ProtonCopilot
        initialMode={copilotMode}
        onModeChange={setCopilotMode}
      />

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* Keyboard Shortcuts Modal */}
      <ProtonShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
      </div>
    </MotionConfig>
  );
}

export default AppShell;
