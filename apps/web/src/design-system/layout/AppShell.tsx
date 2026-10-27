import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMedplum } from '@medplum/react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Drawer } from './Drawer';
import { authService } from '../../services/auth';
import CommandPalette from '../../components/ui/CommandPalette';
import ProtonShortcutsModal from '../../components/proton/ProtonShortcutsModal';
import ProtonCopilot, { type CopilotMode } from '../../components/proton/ProtonCopilot';
import { AttentionQueue } from '../../components/clinic/AttentionQueue';
import { Bell, X, LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { PageTransition } from '../motion/primitives';
import { SESSION_EXPIRED_EVENT } from '../../lib/api';
import { clinicApi, type ClinicNotification } from '../../lib/clinicApi';
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
  const [notifications, setNotifications] = useState<ClinicNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [copilotMode, setCopilotMode] = useState<CopilotMode>('minimized');
  const [searchScope, setSearchScope] = useState<'Patients' | 'Education' | 'Prescriptions' | 'Test results'>('Patients');

  const currentUser = authService.getCurrentUser();
  const doctorName = currentUser?.displayName || 'Dr. Sarah Lin, MD';

  const refreshNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const result = await clinicApi.listNotifications({ limit: 30 });
      setNotifications(result.notifications);
    } catch (err) {
      setNotificationsError((err as Error).message || 'Could not reach the clinic API.');
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
    const interval = window.setInterval(() => { void refreshNotifications(); }, 60_000);
    return () => window.clearInterval(interval);
  }, [refreshNotifications]);

  // Apply persisted working preferences on every shell mount so a fast reload
  // keeps the clinician's theme, density and motion settings.
  useEffect(() => {
    let active = true;
    clinicApi
      .getPreferences()
      .then(({ preferences }) => {
        if (!active) return;
        if (preferences.appearance !== 'system') {
          localStorage.setItem('proton_appearance', preferences.appearance);
          document.documentElement.dataset.theme = preferences.appearance;
          document.documentElement.style.colorScheme = preferences.appearance;
        }
        document.documentElement.dataset.density = preferences.density;
        document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion);
      })
      .catch(() => {
        // Preferences are an enhancement; the default theme still renders.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isNotificationsOpen) void refreshNotifications();
  }, [isNotificationsOpen, refreshNotifications]);

  const markNotificationRead = async (notification: ClinicNotification) => {
    if (!notification.readAt) {
      setNotifications((current) => current.map((entry) => (
        entry.id === notification.id ? { ...entry, readAt: new Date().toISOString() } : entry
      )));
      try {
        await clinicApi.markNotificationRead(notification.id);
      } catch {
        // The optimistic state is replaced on the next refresh.
      }
    }
    if (notification.actionPath) {
      setIsNotificationsOpen(false);
      navigate(notification.actionPath);
    }
  };

  const resolveNotification = async (notification: ClinicNotification) => {
    setNotifications((current) => current.map((entry) => (
      entry.id === notification.id
        ? { ...entry, readAt: entry.readAt || new Date().toISOString(), resolvedAt: new Date().toISOString() }
        : entry
    )));
    try {
      await clinicApi.resolveNotification(notification.id);
    } catch {
      void refreshNotifications();
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.readAt && !notification.resolvedAt).length;
  const criticalCount = notifications.filter((notification) => notification.severity === 'critical' && !notification.resolvedAt).length;

  const markAllRead = async () => {
    const now = new Date().toISOString();
    setNotifications((current) => current.map((notification) => (
      notification.readAt ? notification : { ...notification, readAt: now }
    )));
    try {
      await clinicApi.markAllNotificationsRead();
    } catch {
      void refreshNotifications();
    }
  };

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
      <div className={`proton-workspace-root relative min-h-screen w-full bg-[#F7F4EC] text-[#14161A] flex flex-col font-sans antialiased selection:bg-[#E8E2D0] selection:text-[#14161A] ${className}`}>

      {/* Paper, not chrome: one flat warm ground with a whisper of grain. */}
      <div className="proton-workspace-ambient" aria-hidden="true">
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
            unreadNotifications={unreadCount}
            criticalNotifications={criticalCount}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            onToggleCopilot={() => setCopilotMode(prev => prev === 'minimized' ? 'floating' : prev === 'floating' ? 'docked' : 'minimized')}
            onNavigateSettings={() => navigate('/settings')}
            searchScope={searchScope}
            onSelectSearchScope={setSearchScope}
          />

          {/* Workspace Body */}
          <main className={`flex-1 overflow-y-auto px-4 pb-24 sm:px-7 ${fillCanvas ? 'p-0' : fullBleed ? 'p-2' : ''}`}>
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
        <AttentionQueue
          notifications={notifications}
          loading={notificationsLoading}
          error={notificationsError}
          onRefresh={() => { void refreshNotifications(); }}
          onOpen={(notification) => { void markNotificationRead(notification); }}
          onResolve={(notification) => { void resolveNotification(notification); }}
          onMarkAllRead={() => { void markAllRead(); }}
        />
      </Drawer>

      {/* Mobile Overlay Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-2xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex h-full w-72 flex-col gap-5 border-r border-[#E2DCCD] bg-[#F7F4EC] p-4 shadow-2xl">
            <div className="flex items-center justify-between px-1 pb-1">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-[#14161A] text-[13px] font-semibold text-[#FBF9F3]">
                  p
                </span>
                <span className="font-editorial text-[24px] lowercase leading-none tracking-[-0.01em] text-[#14161A]">proton</span>
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
                <div className="px-3 pb-1 font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#A9A394]">Clinical</div>
                {DEFAULT_GENERAL_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex h-10 items-center gap-3 rounded-[7px] px-3 text-[12.5px] font-medium transition-colors ${
                        isActive
                          ? 'bg-[#EBE5D5] text-[#14161A]'
                          : 'text-[#6E6A61] hover:bg-[#F1ECDE] hover:text-[#14161A]'
                      }`
                    }
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>

              <div className="space-y-1">
                <div className="px-3 pb-1 font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#A9A394]">Tools</div>
                {DEFAULT_TOOLS_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex h-10 items-center gap-3 rounded-[7px] px-3 text-[12.5px] font-medium transition-colors ${
                        isActive
                          ? 'bg-[#EBE5D5] text-[#14161A]'
                          : 'text-[#6E6A61] hover:bg-[#F1ECDE] hover:text-[#14161A]'
                      }`
                    }
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </nav>

            <div className="rounded-[10px] border border-[#E2DCCD] bg-[#F1ECDE] p-3">
              <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#D8C99B] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[#8A6A1F]">
                Synthetic
              </span>
              <p className="mt-2 font-editorial text-[15px] leading-tight text-[#14161A]">Validation cohort</p>
              <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#8A8578]">
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
