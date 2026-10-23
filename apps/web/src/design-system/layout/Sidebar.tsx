import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { PROTON_SPRING, LiveDot } from '../motion/primitives';
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
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  badge?: string;
}

export const DEFAULT_GENERAL_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/schedule', label: 'Schedule', icon: Calendar },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/consultation', label: 'Consultation', icon: Stethoscope },
  { to: '/education', label: 'Education', icon: BookOpen },
  { to: '/document-review', label: 'Documents', icon: FileText }
];

export const DEFAULT_TOOLS_NAV: NavItem[] = [
  { to: '/assistant', label: 'Chats & calls', icon: Bot },
  { to: '/billing', label: 'Billing', icon: DollarSign },
  { to: '/operations', label: 'Operations', icon: Inbox },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
  generalNav?: NavItem[];
  toolsNav?: NavItem[];
  currentPath?: string;
  className?: string;
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  onLogout,
  generalNav = DEFAULT_GENERAL_NAV,
  toolsNav = DEFAULT_TOOLS_NAV,
  currentPath = window.location.pathname,
  className = ''
}: SidebarProps) {
  const renderItem = (item: NavItem, layoutId: string) => {
    const active = item.end
      ? currentPath === item.to
      : currentPath.startsWith(item.to);

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        title={isCollapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex h-11 items-center rounded-full transition-colors duration-200 ${
          isCollapsed ? 'justify-center px-0' : 'gap-3 pl-3.5 pr-2'
        } ${
          active
            ? 'text-[#151719]'
            : 'text-[#777774] hover:bg-white/60 hover:text-[#151719]'
        }`}
      >
        {active && (
          <motion.span
            layoutId={layoutId}
            className="absolute inset-0 rounded-full bg-white shadow-[0_10px_30px_-20px_rgba(20,20,18,0.55),0_1px_0_rgba(255,255,255,0.9)_inset]"
            transition={PROTON_SPRING}
          />
        )}

        <item.icon
          size={16}
          strokeWidth={active ? 2 : 1.7}
          className={`relative z-10 shrink-0 ${active ? 'text-[#151719]' : 'text-[#8A8A87] group-hover:text-[#151719]'}`}
        />

        {!isCollapsed && (
          <>
            <span className="relative z-10 flex-1 truncate text-[12.5px] font-medium tracking-[-0.01em]">
              {item.label}
            </span>
            {active ? (
              <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#F1F0ED] text-[#9A9995]">
                <ChevronRight size={12} strokeWidth={2} />
              </span>
            ) : item.badge ? (
              <span className="relative z-10 rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-semibold text-[#9A9995]">
                {item.badge}
              </span>
            ) : null}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={`hidden lg:flex flex-col shrink-0 select-none transition-[width] duration-300 relative ${
        isCollapsed ? 'w-[76px]' : 'w-[228px]'
      } ${className}`}
      aria-label="Sidebar Navigation"
    >
      {/* Seam collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute right-[-11px] top-8 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-white text-[#8A8A87] shadow-[0_6px_18px_-10px_rgba(20,20,18,0.5)] transition-transform hover:scale-110 hover:text-[#151719] active:scale-95 cursor-pointer"
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight size={13} strokeWidth={2.2} /> : <ChevronLeft size={13} strokeWidth={2.2} />}
      </button>

      {/* Wordmark */}
      <div className={`flex h-[72px] items-center ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}>
        <NavLink to="/" className="group flex items-center gap-2" aria-label="Proton home">
          {isCollapsed ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#151719] text-[13px] font-semibold text-white">
              p
            </span>
          ) : (
            <span className="text-[20px] font-semibold lowercase tracking-[-0.045em] text-[#111110]">
              proton
            </span>
          )}
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden pb-2 ${isCollapsed ? 'px-3' : 'px-3'}`}>
        <div className="space-y-1">
          {generalNav.map((item) => renderItem(item, 'proton-pill-active'))}
        </div>

        <div className="my-4 h-px bg-[#151719]/[0.06]" />

        {!isCollapsed && (
          <div className="px-3.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#A5A4A0]">
            Tools
          </div>
        )}
        <div className="space-y-1">
          {toolsNav.map((item) => renderItem(item, 'proton-pill-active-tools'))}
        </div>
      </nav>

      {/* Footer */}
      <div className={`pb-3 ${isCollapsed ? 'px-3' : 'px-3'}`}>
        {!isCollapsed ? (
          <div className="relative rounded-[22px] bg-white/70 p-3 shadow-[0_18px_40px_-32px_rgba(20,20,18,0.5)]">
            <div className="flex items-start justify-between">
              <span className="rounded-full bg-[#DDF25B] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em] text-[#26320A]">
                Synthetic
              </span>
              <LiveDot size={6} color="#5AC46A" />
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-snug text-[#2A2A28]">
              Validation cohort
            </p>
            <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#9A9995]">
              No real PHI. Every write needs a signature.
            </p>
            <NavLink
              to="/settings"
              className="mt-2.5 flex items-center justify-center rounded-full bg-[#F1F0ED] py-1.5 text-[10px] font-semibold text-[#3A3A38] transition-colors hover:bg-[#E8E7E4]"
            >
              Controls
            </NavLink>
          </div>
        ) : (
          <NavLink
            to="/settings"
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-[#8A8A87]"
            title="Synthetic controls"
          >
            <LiveDot size={7} color="#5AC46A" />
          </NavLink>
        )}

        <button
          type="button"
          onClick={onLogout}
          className={`mt-2 flex h-10 w-full items-center rounded-full text-[11.5px] font-medium text-[#8A8A87] transition-colors hover:bg-white/60 hover:text-[#C0483F] cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : 'gap-3 pl-3.5 pr-2'
          }`}
          title="Log out"
        >
          <LogOut size={15} />
          {!isCollapsed && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
