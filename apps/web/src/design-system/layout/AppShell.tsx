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
import { applyAppearance } from '../theme/palettes';
import { ArcThemeCustomizer, applyArcThemeToDOM, readStoredArcTheme } from '../theme/ArcThemeCustomizer';
import ClinicianProfileModal, { readDoctorProfile } from '../../components/profile/ClinicianProfileModal';
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

  // Persist sidebar collapsed mode across page navigation and clicks
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('proton.sidebar_collapsed');
        if (stored !== null) {
          return stored === 'true';
        }
      } catch {
        // Fallback if localStorage is restricted
      }
    }
    return false;
  });

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('proton.sidebar_collapsed', String(next));
          window.dispatchEvent(new CustomEvent('proton.sidebar_toggle', { detail: { isCollapsed: next } }));
        } catch {
          // ignore
        }
      }
      return next;
    });
  }, []);

  // Listen for sidebar toggle events to ensure any mounted shell instances stay in perfect sync
  useEffect(() => {
    const handleSync = () => {
      try {
        const stored = localStorage.getItem('proton.sidebar_collapsed');
        if (stored !== null) {
          setIsCollapsed(stored === 'true');
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('proton.sidebar_toggle', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('proton.sidebar_toggle', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isThemeCustomizerOpen, setIsThemeCustomizerOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeDocProfile, setActiveDocProfile] = useState(readDoctorProfile);
  const [notifications, setNotifications] = useState<ClinicNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setActiveDocProfile(e.detail);
      }
    };
    window.addEventListener('proton.doctor_profile_updated', handleProfileUpdate);
    return () => window.removeEventListener('proton.doctor_profile_updated', handleProfileUpdate);
  }, []);

  // Apply customized Arc theme colors and texture on initial boot
  useEffect(() => {
    applyArcThemeToDOM(readStoredArcTheme());
  }, []);

  // Persist copilot mode across page navigation
  const [copilotMode, setCopilotMode] = useState<CopilotMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('proton.copilot_mode') as CopilotMode | null;
        if (stored && ['minimized', 'floating', 'docked'].includes(stored)) {
          return stored;
        }
      } catch {
        // ignore
      }
    }
    return 'minimized';
  });

  const handleToggleCopilot = useCallback(() => {
    setCopilotMode((prev) => {
      const next: CopilotMode = prev === 'minimized' ? 'floating' : prev === 'floating' ? 'docked' : 'minimized';
      try {
        localStorage.setItem('proton.copilot_mode', next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const [searchScope, setSearchScope] = useState<'Patients' | 'Education' | 'Prescriptions' | 'Test results'>('Patients');

  const currentUser = authService.getCurrentUser();
  const doctorName = activeDocProfile.name || currentUser?.displayName || 'Dr. Sarah Lin, MD';

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
  // keeps the clinician's theme, density and motion settings without stomping local palette selection.
  useEffect(() => {
    let active = true;
    clinicApi
      .getPreferences()
      .then(({ preferences }) => {
        if (!active) return;
        const storedPalette = localStorage.getItem('proton.palette');
        if (!storedPalette && preferences.appearance && preferences.appearance !== 'system') {
          localStorage.setItem('proton_appearance', preferences.appearance);
          applyAppearance(preferences.appearance);
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

  // Global Keyboard Shortcuts (⌘K, ⌘/, ⌘B)
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
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleCollapse]);

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
      <div className={`proton-workspace-root relative h-screen w-screen overflow-hidden bg-canvas text-ink flex flex-col font-sans antialiased selection:bg-accent-wash selection:text-ink ${className}`}>

      {/* Desktop Application Frame: 100% Authentic Arc Browser Frame with Signature Texture */}
      <div className="relative z-10 flex-1 flex overflow-hidden h-full bg-canvas arc-textured-canvas">
        
        {/* Left Native Arc Sidebar (flush against window edges) */}
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onOpenThemeCustomizer={() => setIsThemeCustomizerOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onLogout={handleLogout}
          currentPath={location.pathname}
        />

        {/* Right Inset Arc Floating Viewport Canvas */}
        <div className={`flex-1 flex flex-col min-w-0 bg-paper border border-rule/80 rounded-[18px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-all duration-300 my-2 mr-2 ${isCollapsed ? 'ml-2' : ''} ${copilotMode === 'docked' ? 'lg:mr-96' : ''}`}>
          
          {/* TopBar Integrated Seamlessly */}
          <TopBar
            doctorName={doctorName}
            unreadNotifications={unreadCount}
            criticalNotifications={criticalCount}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            onToggleCopilot={handleToggleCopilot}
            onOpenThemeCustomizer={() => setIsThemeCustomizerOpen(true)}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onNavigateSettings={() => navigate('/settings')}
            searchScope={searchScope}
            onSelectSearchScope={setSearchScope}
          />

          {/* Workspace Body */}
          <main className={`flex-1 overflow-y-auto ${fillCanvas ? 'p-0' : fullBleed ? 'p-2' : 'px-8 py-6 pb-12'}`}>
            <div className="max-w-[1560px] mx-auto h-full">
              <PageTransition routeKey={location.pathname} className="w-full h-full">
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
            <Bell className="w-4 h-4 text-ink" />
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
          <div className="relative z-10 flex h-full w-72 flex-col gap-5 border-r border-rule-strong bg-canvas p-4 shadow-2xl">
            <div className="flex items-center justify-between px-1 pb-1">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-solid text-[13px] font-semibold text-on-solid">
                  p
                </span>
                <span className="font-editorial text-[24px] lowercase leading-none tracking-[-0.01em] text-ink">proton</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-paper/80 text-ink-2 hover:text-ink cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X size={16} />
              </button>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <div className="px-3 pb-1 font-mono text-[8.5px] uppercase tracking-[0.18em] text-ink-3">Clinical</div>
                {DEFAULT_GENERAL_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex h-10 items-center gap-3 rounded-[7px] px-3 text-[12.5px] font-medium transition-colors ${
                        isActive
                          ? 'bg-accent-wash text-ink'
                          : 'text-ink-2 hover:bg-paper-2 hover:text-ink'
                      }`
                    }
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>

              <div className="space-y-1">
                <div className="px-3 pb-1 font-mono text-[8.5px] uppercase tracking-[0.18em] text-ink-3">Tools</div>
                {DEFAULT_TOOLS_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex h-10 items-center gap-3 rounded-[7px] px-3 text-[12.5px] font-medium transition-colors ${
                        isActive
                          ? 'bg-accent-wash text-ink'
                          : 'text-ink-2 hover:bg-paper-2 hover:text-ink'
                      }`
                    }
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </nav>

            <div className="rounded-[10px] border border-rule-strong bg-paper-2 p-3">
              <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-rule-strong px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-caution">
                Synthetic
              </span>
              <p className="mt-2 font-editorial text-[15px] leading-tight text-ink">Validation cohort</p>
              <p className="mt-0.5 text-[9.5px] leading-relaxed text-ink-3">
                No real PHI. Every write needs a signature.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="flex h-10 w-full items-center gap-3 rounded-full px-3.5 text-[11.5px] font-medium text-ink-3 hover:bg-paper/60 hover:text-critical cursor-pointer"
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

      {/* Arc Theme & Color Customizer Modal */}
      <ArcThemeCustomizer
        isOpen={isThemeCustomizerOpen}
        onClose={() => setIsThemeCustomizerOpen(false)}
      />

      {/* Clinician Profile Modal */}
      <ClinicianProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onOpenThemeCustomizer={() => setIsThemeCustomizerOpen(true)}
        onLogout={handleLogout}
      />
      </div>
    </MotionConfig>
  );
}

export default AppShell;
