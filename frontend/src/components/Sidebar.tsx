import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Video,
  Camera,
  BarChart3,
  Zap,
  Bell,
  Cpu,
  Settings,
  ChevronLeft,
  ChevronRight,
  Radio,
  FileVideo,
  TrendingUp,
  Flame,
  Layers,
  ShieldAlert,
} from 'lucide-react';

interface NavSection {
  title: string;
  items: { path: string; icon: React.ElementType; label: string; badge?: string }[];
}

const navSections: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Overview' },
      { path: '/matrix', icon: Layers, label: '4-Lane Matrix', badge: 'LIVE' },
      { path: '/monitoring', icon: Video, label: 'Live CCTV Matrix' },
      { path: '/video-analysis', icon: FileVideo, label: 'Video Analysis' },
      { path: '/cameras', icon: Camera, label: 'Sensors & Cameras' },
    ],
  },
  {
    title: 'Intelligence & Control',
    items: [
      { path: '/signals', icon: Zap, label: 'Signal Optimization' },
      { path: '/safety', icon: ShieldAlert, label: 'Safety Analytics', badge: 'RISK' },
      { path: '/emergency', icon: Flame, label: 'Emergency Priority', badge: 'Active' },
      { path: '/predictions', icon: TrendingUp, label: 'Traffic Forecast' },
      { path: '/analytics', icon: BarChart3, label: 'Reports & Analytics' },
    ],
  },
  {
    title: 'System & Admin',
    items: [
      { path: '/alerts', icon: Bell, label: 'Incident Log' },
      { path: '/system', icon: Cpu, label: 'Node Telemetry' },
      { path: '/settings', icon: Settings, label: 'Parameters' },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside
      className={`flex flex-col h-screen bg-white dark:bg-[#0e1422] border-r border-slate-200 dark:border-[#1c273e] transition-colors duration-150 ${
        collapsed ? 'w-14' : 'w-60'
      } shrink-0 select-none`}
    >
      {/* Platform Branding with Official FlowForce Logo */}
      <div className="h-14 px-2 border-b border-slate-200 dark:border-[#1c273e] flex items-center justify-center overflow-hidden">
        <img
          src="/flowforce_logo.png"
          alt="FlowForce"
          className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-screen"
        />
      </div>

      {/* Navigation list */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-0.5">
            {!collapsed && (
              <p className="px-2.5 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                {section.title}
              </p>
            )}
            {section.items.map(({ path, icon: Icon, label, badge }) => {
              const active = location.pathname === path;
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-xs transition-colors ${
                    active
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#151f33]'
                  }`}
                  title={collapsed ? label : undefined}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={15} className={`shrink-0 ${active ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`} />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </div>
                  {!collapsed && badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 uppercase font-bold">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom System Status & Toggle */}
      <div className="p-2 border-t border-slate-200 dark:border-[#1c273e] bg-slate-50 dark:bg-[#121a2d] space-y-1">
        {!collapsed && (
          <div className="px-2.5 py-2 rounded bg-white dark:bg-[#080c15] border border-slate-200 dark:border-[#1c273e] text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">SYSTEM CORE</span>
              <span className="status-pill-green text-[9px] py-0 px-1">ONLINE</span>
            </div>
            <div className="flex items-center justify-between mt-1 text-slate-700 dark:text-slate-300 font-mono text-[10px]">
              <span>NODE: IN-BLR-01</span>
              <span>4/4 SENSORS</span>
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-1.5 rounded hover:bg-slate-200 dark:hover:bg-[#151f33] text-slate-500 dark:text-slate-400 transition-colors"
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
    </aside>
  );
}
