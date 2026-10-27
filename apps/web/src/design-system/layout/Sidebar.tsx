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
  ChevronRight,
  Activity
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
  { to: '/care-loop', label: 'Care Loop', icon: Activity },
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
        className={`group relative flex h-9 items-center rounded-[7px] transition-colors duration-200 ${
          isCollapsed ? 'justify-center px-0' : 'gap-3 pl-3 pr-2'
        } ${
          active
            ? 'bg-[#EBE5D5] text-[#14161A]'
            : 'text-[#6E6A61] hover:bg-[#F1ECDE] hover:text-[#14161A]'
        }`}
      >
        {active && (
          <motion.span
            layoutId={layoutId}
            className="absolute inset-0 rounded-[7px] bg-[#EBE5D5]"
            transition={PROTON_SPRING}
          />
        )}

        <item.icon
          size={15}
          strokeWidth={active ? 1.9 : 1.6}
          className={`relative z-10 shrink-0 ${active ? 'text-[#14161A]' : 'text-[#8A8578] group-hover:text-[#14161A]'}`}
        />

        {!isCollapsed && (
          <>
            <span className="relative z-10 flex-1 truncate text-[12.5px] font-medium tracking-[-0.005em]">
              {item.label}
            </span>
            {active ? (
              <span className="relative z-10 h-1 w-1 rounded-full bg-[#14161A]" />
            ) : item.badge ? (
              <span className="relative z-10 font-mono text-[8.5px] text-[#A9A394]">
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
      className={`hidden lg:flex flex-col shrink-0 select-none transition-[width] duration-300 relative border-r border-[#E2DCCD] ${
        isCollapsed ? 'w-[76px]' : 'w-[228px]'
      } ${className}`}
      aria-label="Sidebar Navigation"
    >
      {/* Seam collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute right-[-11px] top-8 z-40 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#E2DCCD] bg-[#FBF9F3] text-[#8A8578] transition-colors hover:border-[#C9C3B4] hover:text-[#14161A] cursor-pointer"
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight size={12} strokeWidth={2} /> : <ChevronLeft size={12} strokeWidth={2} />}
      </button>

      {/* Wordmark */}
      <div className={`flex h-[72px] items-center ${isCollapsed ? 'justify-center px-0' : 'px-5'}`}>
        <NavLink to="/" className="group flex items-center gap-2" aria-label="Proton home">
          {isCollapsed ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#14161A] text-[12px] font-semibold text-[#FBF9F3]">
              p
            </span>
          ) : (
            <span className="font-editorial text-[27px] lowercase leading-none tracking-[-0.01em] text-[#14161A]">
              proton
            </span>
          )}
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden pb-2 ${isCollapsed ? 'px-3' : 'px-3'}`}>
        {!isCollapsed && (
          <div className="px-2.5 pb-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-[#A9A394]">
            Clinical
          </div>
        )}
        <div className="space-y-0.5">
          {generalNav.map((item) => renderItem(item, 'proton-pill-active'))}
        </div>

        <div className="my-4 h-px bg-[#E2DCCD]" />

        {!isCollapsed && (
          <div className="px-2.5 pb-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-[#A9A394]">
            Tools
          </div>
        )}
        <div className="space-y-0.5">
          {toolsNav.map((item) => renderItem(item, 'proton-pill-active-tools'))}
        </div>
      </nav>

      {/* Footer */}
      <div className={`pb-3 ${isCollapsed ? 'px-3' : 'px-3'}`}>
        {!isCollapsed ? (
          <div className="rounded-[10px] border border-[#E2DCCD] bg-[#F1ECDE] p-3">
            <div className="flex items-start justify-between">
              <span className="inline-flex items-center rounded-[4px] border border-[#D8C99B] px-1.5 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.12em] text-[#8A6A1F]">
                Synthetic
              </span>
              <LiveDot size={6} color="#5C8A55" />
            </div>
            <p className="mt-2 font-editorial text-[15px] leading-tight text-[#14161A]">
              Validation cohort
            </p>
            <p className="mt-1 text-[9.5px] leading-relaxed text-[#8A8578]">
              No real PHI. Every write needs a signature.
            </p>
            <NavLink
              to="/settings"
              className="mt-2.5 flex items-center justify-center rounded-[6px] border border-[#E2DCCD] bg-[#FBF9F3] py-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#6E6A61] transition-colors hover:border-[#C9C3B4] hover:text-[#14161A]"
            >
              Controls
            </NavLink>
          </div>
        ) : (
          <NavLink
            to="/settings"
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-[7px] bg-[#F1ECDE] text-[#8A8578]"
            title="Synthetic controls"
          >
            <LiveDot size={7} color="#5C8A55" />
          </NavLink>
        )}

        <button
          type="button"
          onClick={onLogout}
          className={`mt-2 flex h-9 w-full items-center rounded-[7px] text-[11.5px] font-medium text-[#8A8578] transition-colors hover:bg-[#F1ECDE] hover:text-[#A63A4E] cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : 'gap-3 pl-3 pr-2'
          }`}
          title="Log out"
        >
          <LogOut size={14} />
          {!isCollapsed && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
