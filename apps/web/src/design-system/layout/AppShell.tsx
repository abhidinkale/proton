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
      <div className={`relative min-h-screen w-full bg-[#F7F4EE] text-[#151719] flex flex-col font-sans antialiased selection:bg-[#FCE7F3] selection:text-[#9D174D] ${className}`}>

      {/* Ambient light field: gives the glass chrome something to refract. */}
      <div className="proton-workspace-ambient" aria-hidden="true">
        <div className="proton-orb -top-32 left-[18%] h-[34rem] w-[34rem] bg-[#DCE7F6]/70" />
        <div className="proton-orb -right-24 top-24 h-[28rem] w-[28rem] bg-[#F8DDE7]/60" />
        <div className="proton-orb -left-28 bottom-0 h-[30rem] w-[30rem] bg-[#F6E6CC]/60" />
        <div className="proton-grid absolute inset-x-0 top-0 h-[38rem]" />
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
          <main className={`flex-1 overflow-y-auto px-4 sm:px-8 pb-12 ${fillCanvas ? 'p-0' : fullBleed ? 'p-2' : ''}`}>
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
          <div className="relative w-72 bg-[#151619] text-white h-full flex flex-col shadow-2xl z-10 border-r border-[#23252B] p-5 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#23252B]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white text-[#151719] flex items-center justify-center font-black text-xs">
                  P
                </div>
                <span className="font-extrabold text-base tracking-tight text-white lowercase">proton</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg text-[#88909A] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#636873]">General</div>
                {DEFAULT_GENERAL_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[#A0A5AD] hover:bg-white/10 hover:text-white"
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>

              <div className="space-y-1">
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#636873]">Tools</div>
                {DEFAULT_TOOLS_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[#A0A5AD] hover:bg-white/10 hover:text-white"
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </nav>

            <div className="pt-3 border-t border-[#23252B]">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-white/5 rounded-xl cursor-pointer"
              >
                <LogOut size={16} />
                <span>Log out</span>
              </button>
            </div>
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
