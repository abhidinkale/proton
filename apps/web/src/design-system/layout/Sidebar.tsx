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
  { to: '/document-review', label: 'Documents base', icon: FileText }
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
  return (
    <aside
      className={`proton-glass-dark hidden lg:flex flex-col shrink-0 text-[#A0A5AD] transition-all duration-300 relative z-30 select-none my-3.5 ml-3.5 rounded-[28px] overflow-hidden ${
        isCollapsed ? 'w-20' : 'w-60'
      } ${className}`}
      aria-label="Sidebar Navigation"
    >
      {/* Seam Collapse/Expand Toggle Button */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute -right-3.5 top-7 z-40 w-7 h-7 rounded-full bg-[#FCE7F3] text-[#9D174D] border-2 border-[#151619] shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-transform cursor-pointer"
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
      </button>

      {/* Top Brand Wordmark */}
      <div className="h-20 px-6 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-2.5 group cursor-pointer" aria-label="Proton Home">
          <div className="w-8 h-8 rounded-full bg-white text-[#151719] flex items-center justify-center font-black text-sm tracking-tighter group-hover:rotate-12 transition-transform">
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

      {/* Navigation Categories */}
      <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto overflow-x-hidden">
        {/* General Section */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#636873]">
              General
            </div>
          )}
          {generalNav.map((item) => {
            const active = item.end
              ? currentPath === item.to
              : currentPath.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={`relative flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-colors duration-150 ${
                  active ? 'text-white' : 'text-[#A0A5AD] hover:bg-white/5 hover:text-white'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="proton-nav-active"
                    className="absolute inset-0 rounded-2xl bg-white/10 shadow-xs"
                    transition={PROTON_SPRING}
                  />
                )}
                {active && !isCollapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-[#F43F5E]" />
                )}
                <item.icon
                  size={18}
                  strokeWidth={active ? 2.2 : 1.8}
                  className={`relative z-10 ${active ? 'text-white' : 'text-[#88909A]'}`}
                />
                {!isCollapsed && <span className="relative z-10 truncate">{item.label}</span>}
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
          {toolsNav.map((item) => {
            const active = currentPath.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`relative flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-colors duration-150 ${
                  active ? 'text-white' : 'text-[#A0A5AD] hover:bg-white/5 hover:text-white'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="proton-nav-active"
                    className="absolute inset-0 rounded-2xl bg-white/10 shadow-xs"
                    transition={PROTON_SPRING}
                  />
                )}
                {active && !isCollapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-[#F43F5E]" />
                )}
                <item.icon
                  size={18}
                  strokeWidth={active ? 2.2 : 1.8}
                  className={`relative z-10 ${active ? 'text-white' : 'text-[#88909A]'}`}
                />
                {!isCollapsed && <span className="relative z-10 truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Bottom Shelf: live system state + Log out */}
      <div className="p-4 border-t border-[#23252B] space-y-2">
        {!isCollapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.03] border border-white/5">
            <LiveDot size={7} />
            <span className="text-[10px] font-semibold tracking-wide text-[#88909A]">
              Ambient capture ready
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onLogout}
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
  );
}

export default Sidebar;
