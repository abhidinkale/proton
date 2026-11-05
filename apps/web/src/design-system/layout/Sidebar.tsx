import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileSignature,
  Settings,
  Activity,
  Bot,
  GraduationCap,
  CreditCard,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Palette
} from 'lucide-react';
import { readDoctorProfile, type DoctorProfileData } from '../../components/profile/ClinicianProfileModal';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  badge?: string;
}

export const CLINICAL_NAV: NavItem[] = [
  { to: '/', label: 'Day Sheet', icon: LayoutDashboard, end: true },
  { to: '/assistant', label: 'EHR Copilot', icon: Bot },
  { to: '/care-loop', label: 'Care Loop (Live)', icon: Activity },
  { to: '/patients', label: 'Patients (FHIR)', icon: Users },
  { to: '/schedule', label: 'Daily Schedule', icon: Calendar },
  { to: '/documents', label: 'Review & Sign', icon: FileSignature }
];

export const PRACTICE_NAV: NavItem[] = [
  { to: '/billing', label: 'Billing & Invoices', icon: CreditCard },
  { to: '/education', label: 'Clinical Learning', icon: GraduationCap },
  { to: '/settings', label: 'Clinic Settings', icon: Settings }
];

export const DEFAULT_GENERAL_NAV: NavItem[] = CLINICAL_NAV;
export const DEFAULT_TOOLS_NAV: NavItem[] = PRACTICE_NAV;
export const DEFAULT_SECONDARY_NAV = DEFAULT_TOOLS_NAV;

export interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenThemeCustomizer?: () => void;
  onOpenProfile?: () => void;
  onLogout?: () => void;
  currentPath?: string;
  className?: string;
}

export function Sidebar({
  isCollapsed = false,
  onToggleCollapse,
  onOpenThemeCustomizer,
  onOpenProfile,
  currentPath = window.location.pathname,
  className = ''
}: SidebarProps) {
  const navigate = useNavigate();
  const [docProfile, setDocProfile] = useState<DoctorProfileData>(readDoctorProfile);

  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setDocProfile(e.detail);
      }
    };
    window.addEventListener('proton.doctor_profile_updated', handleProfileUpdate);
    return () => window.removeEventListener('proton.doctor_profile_updated', handleProfileUpdate);
  }, []);

  const initials = docProfile.name
    .replace(/^(Dr\.?|Prof\.?)\s+/i, '')
    .replace(/,?\s*MD$/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase() || 'SL';

  const isElectron = typeof window !== 'undefined' && Boolean((window as any).protonNative?.isElectron || navigator.userAgent.includes('Electron'));
  const isMac = typeof window !== 'undefined' && ((window as any).protonNative?.platform === 'darwin' || navigator.userAgent.includes('Mac'));
  const isElectronMac = isElectron && isMac;

  // ─────────────────────────────────────────────────────────────
  // Collapsed Arc Slim Rail Mode (72px with generous breathing room)
  // ─────────────────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <aside
        className={`app-drag-region relative w-[72px] shrink-0 flex flex-col items-center justify-between z-30 select-none pb-4 bg-transparent transition-all duration-300 ${
          isElectronMac ? 'pt-10' : 'pt-4'
        } ${className}`}
        aria-label="Arc Sidebar Navigation (Collapsed)"
      >
        <div className="flex flex-col items-center w-full px-2">
          {/* 1. Undo / Redo (Back / Forward) Navigation Duo ON TOP with generous spacing */}
          <div className="flex items-center justify-center gap-2 w-full py-1 text-ink-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="app-no-drag flex h-7 w-7 items-center justify-center rounded-xl text-ink-3 hover:text-ink hover:bg-paper-2/80 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Back (⌘[)"
              aria-label="Navigate back"
            >
              <ArrowLeft size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="app-no-drag flex h-7 w-7 items-center justify-center rounded-xl text-ink-3 hover:text-ink hover:bg-paper-2/80 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Forward (⌘])"
              aria-label="Navigate forward"
            >
              <ArrowRight size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* 2. Sidebar Expand Toggle Bar / Button with deliberate vertical separation */}
          <div className="flex items-center justify-center w-full my-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="app-no-drag flex h-8 w-8 items-center justify-center rounded-xl text-ink-3 hover:text-ink hover:bg-paper-2/80 border border-rule/50 hover:border-rule-strong transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Expand Arc Sidebar (⌘B)"
              aria-label="Expand Arc Sidebar"
            >
              <PanelLeftOpen size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* 3. Refined Lining / Divider */}
          <div className="w-8 h-[1px] bg-rule/70 my-2.5" />

          {/* Primary Clinical Navigation Icons */}
          <nav className="flex flex-col items-center gap-2 w-full" aria-label="Clinical Workstation">
            {CLINICAL_NAV.map((item) => {
              const active = item.end
                ? currentPath === item.to
                : currentPath.startsWith(item.to);

              return (
                <NavLink
                  key={item.to + item.label}
                  to={item.to}
                  end={item.end}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`app-no-drag relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    active
                      ? 'bg-paper text-ink font-semibold shadow-xs border border-rule'
                      : 'text-ink-2 hover:text-ink hover:bg-paper-2/60'
                  }`}
                >
                  <item.icon size={16} strokeWidth={1.25} />
                </NavLink>
              );
            })}
          </nav>

          <div className="w-5 h-[1px] bg-rule/60 my-1" />

          {/* Secondary Practice Tray Icons */}
          <div className="flex flex-col items-center gap-1.5 w-full px-2" aria-label="Practice & Billing">
            {PRACTICE_NAV.map((item) => {
              const active = currentPath.startsWith(item.to);

              return (
                <NavLink
                  key={item.to + item.label}
                  to={item.to}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`app-no-drag relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    active
                      ? 'bg-paper text-ink font-semibold shadow-xs border border-rule'
                      : 'text-ink-3 hover:text-ink hover:bg-paper-2/60'
                  }`}
                >
                  <item.icon size={15} strokeWidth={1.25} />
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Bottom Theme & Doctor Profile (Theme ABOVE, Profile BELOW) */}
        <div className="flex flex-col items-center gap-2 w-full pb-1">
          {onOpenThemeCustomizer && (
            <button
              type="button"
              onClick={onOpenThemeCustomizer}
              title="Arc Theme & Color Customizer"
              className="app-no-drag flex h-8 w-8 items-center justify-center rounded-xl text-ink-3 hover:text-ink hover:bg-paper-2/60 transition-colors cursor-pointer"
            >
              <Palette size={15} strokeWidth={1.25} />
            </button>
          )}

          {/* Collapsed Doctor Profile Trigger (Below Theme) */}
          <button
            type="button"
            onClick={onOpenProfile || (() => navigate('/settings'))}
            title={`Clinician Profile: ${docProfile.name}`}
            className="app-no-drag flex h-8 w-8 items-center justify-center rounded-xl bg-accent-wash text-accent-ink border border-accent-line font-bold text-[10px] hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xs"
            aria-label={`Clinician Profile: ${docProfile.name}`}
          >
            {initials}
          </button>
        </div>
      </aside>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Full Arc Clean Sidebar (No Spaces clutter, Separate Practice Tray)
  // ─────────────────────────────────────────────────────────────
  return (
    <aside
      className={`app-drag-region relative w-[250px] shrink-0 flex flex-col justify-between z-30 select-none bg-transparent transition-all duration-300 ${
        isElectronMac ? 'pt-10' : 'pt-4'
      } ${className}`}
      aria-label="Arc Sidebar Navigation"
    >
      {/* 1. Top Controls & Arc Search Capsule */}
      <div className="flex flex-col shrink-0 px-4 pt-1 pb-3">
        {/* Navigation & Collapse Strip with generous breathing room */}
        <div className="flex items-center justify-between pb-3.5 text-ink-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="app-no-drag flex h-7 w-7 items-center justify-center rounded-lg hover:text-ink hover:bg-paper-2/70 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Back (⌘[)"
              aria-label="Navigate back"
            >
              <ArrowLeft size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="app-no-drag flex h-7 w-7 items-center justify-center rounded-lg hover:text-ink hover:bg-paper-2/70 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Forward (⌘])"
              aria-label="Navigate forward"
            >
              <ArrowRight size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="app-no-drag flex h-7 w-7 items-center justify-center rounded-lg hover:text-ink hover:bg-paper-2/70 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Reload (⌘R)"
              aria-label="Reload workstation"
            >
              <RotateCw size={13} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="app-no-drag flex h-7 w-7 items-center justify-center rounded-lg hover:text-ink hover:bg-paper-2/70 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Collapse Arc Sidebar (⌘B)"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={15} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* 2. Arc Command / URL Search Pill */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          }}
          className="app-no-drag group relative w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-paper-2/70 hover:bg-paper-2 border border-rule/70 hover:border-rule-strong text-ink transition-all cursor-pointer shadow-2xs"
          title="Search patients, records, commands... (⌘K)"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search size={13} strokeWidth={1.25} className="text-ink-3 group-hover:text-ink shrink-0" />
            <span className="text-xs text-ink-3 group-hover:text-ink truncate font-medium">
              Search...
            </span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded border border-rule/70 bg-paper/60 font-mono text-[9px] text-ink-3">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* 3. Middle Section: Clinical Station Tray & Separate Practice Tray */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-4 custom-scrollbar">
        {/* Tray 1: Clinical Workstation */}
        <div className="space-y-1">
          <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-ink-3 font-semibold">
            Clinical Workstation
          </div>

          <nav className="space-y-1" aria-label="Clinical Navigation">
            {CLINICAL_NAV.map((item) => {
              const active = item.end
                ? currentPath === item.to
                : currentPath.startsWith(item.to);

              return (
                <NavLink
                  key={item.to + item.label}
                  to={item.to}
                  end={item.end}
                  className={`app-no-drag group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    active
                      ? 'bg-paper text-ink font-semibold shadow-xs border border-rule'
                      : 'text-ink-2 hover:text-ink hover:bg-paper-2/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <item.icon
                      size={15}
                      strokeWidth={1.25}
                      className={`shrink-0 ${active ? 'text-accent' : 'text-ink-3 group-hover:text-ink'}`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Tray 2: Separate Practice & Financial Operations Tray */}
        <div className="border-t border-rule/60 pt-3 space-y-1">
          <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-ink-3 font-semibold">
            Practice & Finance
          </div>

          <nav className="space-y-1" aria-label="Practice Navigation">
            {PRACTICE_NAV.map((item) => {
              const active = currentPath.startsWith(item.to);

              return (
                <NavLink
                  key={item.to + item.label}
                  to={item.to}
                  className={`app-no-drag group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    active
                      ? 'bg-paper text-ink font-semibold shadow-xs border border-rule'
                      : 'text-ink-2 hover:text-ink hover:bg-paper-2/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <item.icon
                      size={15}
                      strokeWidth={1.25}
                      className={`shrink-0 ${active ? 'text-accent' : 'text-ink-3 group-hover:text-ink'}`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* 4. "+ New Visit" Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => navigate('/consultation?action=new-patient')}
            className="app-no-drag w-full py-2 px-3 rounded-xl text-xs font-semibold text-ink-2 hover:text-ink hover:bg-paper-2/60 flex items-center gap-2 transition-all cursor-pointer border border-dashed border-rule/80 hover:border-accent"
          >
            <Plus size={14} strokeWidth={1.3} className="text-ink-3" />
            <span>New Visit</span>
          </button>
        </div>
      </div>

      {/* 5. Bottom Arc Controls & Doctor Profile (Theme ABOVE, Profile BELOW) */}
      <div className="p-3 shrink-0 select-none space-y-1.5 border-t border-rule/50">
        {/* Theme Customizer Trigger (Above Profile) */}
        {onOpenThemeCustomizer && (
          <button
            type="button"
            onClick={onOpenThemeCustomizer}
            className="app-no-drag w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-ink-2 hover:text-ink hover:bg-paper-2/60 transition-all cursor-pointer group"
            title="Arc Theme & Color Customizer"
          >
            <div className="flex items-center gap-2">
              <Palette size={14} strokeWidth={1.25} className="text-accent" />
              <span>Theme & Colors</span>
            </div>
            <span className="text-[10px] text-ink-3 font-mono group-hover:text-ink">⌥T</span>
          </button>
        )}

        {/* Doctor Profile Pill (Below Theme) */}
        <button
          type="button"
          onClick={onOpenProfile || (() => navigate('/settings'))}
          className="app-no-drag w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-paper-2/70 active:scale-98 transition-all cursor-pointer group text-left"
          title={`Clinician Profile: ${docProfile.name} (Click to view or edit)`}
          aria-label={`Clinician Profile: ${docProfile.name}`}
        >
          <div className="h-7 w-7 rounded-lg bg-accent-wash text-accent-ink flex items-center justify-center font-bold text-[10px] border border-accent-line shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-ink truncate group-hover:text-accent transition-colors">
              {docProfile.name}
            </div>
            <div className="text-[9.5px] text-ink-3 font-mono truncate">
              {docProfile.specialty.split('•')[0]?.trim() || 'Attending MD'}
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
