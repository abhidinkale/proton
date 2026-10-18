import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Stethoscope,
  BookOpen,
  FileText,
  Bot,
  DollarSign,
  Inbox,
  Settings,
  LogOut,
  Search,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bell,
  User,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { useMedplum } from '@medplum/react';
import CommandPalette from './ui/CommandPalette';
import ProtonStatusChip from './proton/ProtonStatusChip';
import ProtonShortcutsModal from './proton/ProtonShortcutsModal';
import ProtonCopilot, { type CopilotMode } from './proton/ProtonCopilot';
import { authService } from '../services/auth';

interface LayoutProps {
  children: ReactNode;
  fullBleed?: boolean;
  fillCanvas?: boolean;
  canvasBg?: string;
}

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  badge?: string;
}

const GENERAL_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/schedule', label: 'Schedule', icon: Calendar },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/consultation', label: 'Consultation', icon: Stethoscope },
  { to: '/education', label: 'Education', icon: BookOpen },
  { to: '/document-review', label: 'Documents base', icon: FileText }
];

const TOOLS_NAV: NavItem[] = [
  { to: '/assistant', label: 'Chats & calls', icon: Bot },
  { to: '/billing', label: 'Billing', icon: DollarSign },
  { to: '/operations', label: 'Operations', icon: Inbox },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export default function Layout({
  children,
  fullBleed = false,
  fillCanvas = false
}: LayoutProps) {
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

  // Keyboard shortcut listener for ⌘K (Search) & ⌘/ (Shortcuts)
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

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsNotificationsOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    authService.logout();
    medplum.signOut().then(() => navigate('/login')).catch(() => navigate('/login'));
  };

  return (
    <div className="min-h-screen w-full bg-[#F9F8F5] text-[#151719] flex flex-col font-sans antialiased selection:bg-[#FCE7F3] selection:text-[#9D174D]">
      
      {/* ── DESKTOP APPLICATION FRAME (Inspired by Reference 1) ── */}
      <div className="flex-1 flex overflow-hidden min-h-screen">
        
        {/* ── LEFT PERSISTENT NAVIGATION RAIL (Near-black #151619) ── */}
        <aside
          className={`hidden lg:flex flex-col shrink-0 bg-[#151619] text-[#A0A5AD] transition-all duration-300 relative z-30 select-none ${
            isCollapsed ? 'w-20' : 'w-64'
          }`}
          aria-label="Sidebar Navigation"
        >
          {/* Seam Collapse/Expand Toggle Button (Soft Pink Pill Button) */}
          <button
            type="button"
            onClick={() => setIsCollapsed(prev => !prev)}
            className="absolute -right-3.5 top-7 z-40 w-7 h-7 rounded-full bg-[#FCE7F3] text-[#9D174D] border-2 border-[#151619] shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-transform cursor-pointer"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
          </button>

          {/* Top Brand Wordmark */}
          <div className="h-20 px-6 flex items-center justify-between">
            <NavLink to="/" className="flex items-center gap-2.5 group cursor-pointer" aria-label="Proton Home">
              <div className="w-8 h-8 rounded-full bg-white text-[#151619] flex items-center justify-center font-black text-sm tracking-tighter group-hover:rotate-12 transition-transform">
                P
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-xl tracking-tight text-white lowercase">
                    proton
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]" />
                </div>
              )}
            </NavLink>
          </div>

          {/* Nav Categories */}
          <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto overflow-x-hidden">
            
            {/* General Section */}
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#636873]">
                  General
                </div>
              )}
              {GENERAL_NAV.map((item) => {
                const active = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={`flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-150 ${
                      active
                        ? 'bg-white/10 text-white shadow-xs'
                        : 'text-[#A0A5AD] hover:bg-white/5 hover:text-white'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <item.icon
                      size={18}
                      strokeWidth={active ? 2.2 : 1.8}
                      className={active ? 'text-white' : 'text-[#88909A]'}
                    />
                    {!isCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>

            {/* Tools Section */}
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#636873]">
                  Tools
                </div>
              )}
              {TOOLS_NAV.map((item) => {
                const active = location.pathname.startsWith(item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-150 ${
                      active
                        ? 'bg-white/10 text-white shadow-xs'
                        : 'text-[#A0A5AD] hover:bg-white/5 hover:text-white'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <item.icon
                      size={18}
                      strokeWidth={active ? 2.2 : 1.8}
                      className={active ? 'text-white' : 'text-[#88909A]'}
                    />
                    {!isCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>

          </div>

          {/* Bottom Shelf: Log out */}
          <div className="p-4 border-t border-[#23252B]">
            <button
              type="button"
              onClick={handleLogout}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-xs font-semibold text-[#88909A] hover:bg-white/5 hover:text-rose-400 transition-colors cursor-pointer ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
              title="Log out"
            >
              <LogOut size={18} />
              {!isCollapsed && <span>Log out</span>}
            </button>
          </div>
        </aside>

        {/* ── MAIN WORKSPACE VIEWPORT ── */}
        <div className={`flex-1 flex flex-col min-w-0 min-h-screen overflow-hidden transition-all duration-300 ${copilotMode === 'docked' ? 'lg:mr-96' : ''}`}>
          
          {/* ── TOPBAR (Inspired by Reference 1 & 2) ── */}
          <header className="h-20 px-4 sm:px-8 flex items-center justify-between gap-4 shrink-0 z-20">
            
            {/* Mobile menu toggle & Global Pill Search */}
            <div className="flex items-center gap-3 flex-1 max-w-2xl min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-full bg-white border border-[#E8E5DC] text-[#151719] hover:bg-[#F9F8F5]"
                aria-label="Open navigation menu"
              >
                <Menu size={18} />
              </button>

              {/* Pill Search with embedded scope chips */}
              <div 
                onClick={() => setIsCommandPaletteOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-full bg-white border border-[#E8E5DC] shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-[#D6D2C4] transition-all cursor-pointer group"
              >
                {/* Search Icon in Pink Pill Circle */}
                <div className="w-7 h-7 rounded-full bg-[#FCE7F3] text-[#9D174D] flex items-center justify-center shrink-0">
                  <Search size={14} strokeWidth={2.5} />
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs text-[#151719] font-medium truncate">
                    Search patient, prescription, or guideline...
                  </span>
                </div>

                {/* Scope filters right inside search bar (Reference 1) */}
                <div className="hidden sm:flex items-center gap-1 shrink-0 text-[10px] text-[#575D65]">
                  <span className="font-semibold text-[#88909A]">In:</span>
                  {(['Patients', 'Education', 'Prescriptions', 'Test results'] as const).map(scope => (
                    <button
                      key={scope}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchScope(scope);
                        setIsCommandPaletteOpen(true);
                      }}
                      className={`px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                        searchScope === scope
                          ? 'bg-[#151619] text-white border-transparent'
                          : 'bg-[#F9F8F5] text-[#575D65] border-dashed border-[#D6D2C4] hover:border-[#151719]'
                      }`}
                    >
                      {scope}
                    </button>
                  ))}
                </div>

                <kbd className="hidden md:inline-block text-[10px] font-mono text-[#88909A] px-1.5 py-0.5 rounded bg-[#F9F8F5] border border-[#E8E5DC]">
                  ⌘K
                </kbd>
              </div>
            </div>

            {/* Right Controls: Connectivity Chip, Notifications, Profile */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <ProtonStatusChip className="hidden sm:inline-flex" />

              {/* Copilot Quick Launcher Button */}
              <button
                type="button"
                onClick={() => setCopilotMode(prev => prev === 'minimized' ? 'floating' : prev === 'floating' ? 'docked' : 'minimized')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-[#E8E5DC] text-[#151719] hover:bg-[#FCE7F3]/40 hover:border-[#FCE7F3] shadow-xs cursor-pointer text-xs font-semibold transition-colors"
                title="Toggle Proton Copilot (⌥A)"
              >
                <div className="w-4 h-4 rounded-full bg-[#FCE7F3] text-[#9D174D] flex items-center justify-center">
                  <Sparkles size={10} />
                </div>
                <span className="hidden xl:inline">Copilot</span>
                <span className="text-[10px] font-mono text-[#88909A] px-1 py-0.2 rounded bg-[#F4F3EE] hidden xl:inline">⌥A</span>
              </button>

              {/* Notification Bell with indicator */}
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(prev => !prev)}
                className="relative p-2.5 rounded-full bg-white border border-[#E8E5DC] text-[#575D65] hover:text-[#151719] hover:bg-[#F9F8F5] shadow-xs cursor-pointer"
                title="Clinical notifications"
                aria-label="Clinical notifications"
              >
                <Bell size={16} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E11D48] ring-2 ring-white" />
              </button>

              {/* Settings Gear */}
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="p-2.5 rounded-full bg-white border border-[#E8E5DC] text-[#575D65] hover:text-[#151719] hover:bg-[#F9F8F5] shadow-xs cursor-pointer"
                title="Settings"
                aria-label="Settings"
              >
                <Settings size={16} />
              </button>

              {/* Physician Profile Avatar Pill */}
              <div 
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white border border-[#E8E5DC] shadow-xs cursor-pointer hover:bg-[#F9F8F5] transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[#151619] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  <User size={14} />
                </div>
                <div className="hidden md:flex flex-col leading-tight">
                  <span className="text-xs font-bold text-[#151719] truncate">{doctorName}</span>
                  <span className="text-[10px] text-[#88909A]">Attending</span>
                </div>
              </div>
            </div>

          </header>

          {/* ── WORKSPACE BODY ── */}
          <main className={`flex-1 overflow-y-auto px-4 sm:px-8 pb-12 ${fillCanvas ? 'p-0' : fullBleed ? 'p-2' : ''}`}>
            <div className="max-w-[1560px] mx-auto">
              {children}
            </div>
          </main>

        </div>

      </div>

      {/* ── CLINICAL NOTIFICATIONS DRAWER ── */}
      {isNotificationsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-2xs">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl border-l border-[#E8E5DC] p-6 space-y-4 animate-in slide-in-from-right">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0ECE1]">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#151719]" />
                <h3 className="text-sm font-bold text-[#151719]">Clinical Attention Queue</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(false)}
                className="p-1 rounded-full text-[#88909A] hover:text-[#151719]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-140px)]">
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
                  className="w-full mt-2 py-1 rounded-xl bg-[#991B1B] text-white text-[11px] font-semibold text-center cursor-pointer hover:bg-[#7F1D1D]"
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
          </div>
        </div>
      )}

      {/* ── MOBILE OVERLAY DRAWER ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-2xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 bg-[#151619] text-white h-full flex flex-col shadow-2xl z-10 border-r border-[#23252B] p-5 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#23252B]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white text-[#151619] flex items-center justify-center font-black text-xs">
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
                {GENERAL_NAV.map((item) => (
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
                {TOOLS_NAV.map((item) => (
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
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-white/5 rounded-xl"
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
  );
}
