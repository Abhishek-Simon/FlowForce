import React, { useState, useEffect } from 'react';
import { Bell, UserCheck, Sun, Moon, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trafficWS } from '../services/websocket';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';

interface TopbarProps {
  alertCount?: number;
}

export default function Topbar({ alertCount: initialAlertCount = 0 }: TopbarProps) {
  const [time, setTime] = useState(new Date());
  const [wsConnected, setWsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialAlertCount);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [activeLang, setActiveLang] = useState<string>('en');
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    // Read active language from googtrans cookie if set
    const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]*)/);
    if (match && match[1]) {
      const code = match[1].split('/').pop();
      if (code && ['en', 'hi', 'mr'].includes(code)) {
        setActiveLang(code);
      }
    }
  }, []);

  const handleLanguageSelect = (langCode: string) => {
    setActiveLang(langCode);
    setLangMenuOpen(false);

    // Set google translate cookie cleanly
    document.cookie = `googtrans=/en/${langCode}; path=/`;
    document.cookie = `googtrans=/en/${langCode}; domain=${window.location.hostname}; path=/`;

    // Trigger translate or reload smoothly
    window.location.reload();
  };

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);

    const fetchAlerts = async () => {
      try {
        const alerts = await api.getAlerts();
        if (Array.isArray(alerts)) {
          const unread = alerts.filter((a: any) => !a.is_read && !a.is_resolved).length;
          setUnreadCount(unread);
        }
      } catch {}
    };

    fetchAlerts();

    const unsubWs = trafficWS.on('connection', (d) => setWsConnected(d.status === 'connected'));
    const unsubAlerts = trafficWS.on('alert', () => {
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      clearInterval(t);
      unsubWs();
      unsubAlerts();
    };
  }, []);

  return (
    <header className="h-14 bg-white dark:bg-[#0e1422] border-b border-slate-200 dark:border-[#1c273e] flex items-center justify-between px-4 shrink-0 select-none transition-colors duration-150 shadow-xs">
      {/* Left Station Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-900 dark:text-white text-xs font-bold tracking-wide uppercase font-mono">
            COMMAND CTR · SECTOR 4
          </span>
        </div>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-mono">
          <span>STREAM:</span>
          <span className={wsConnected ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400'}>
            {wsConnected ? 'LIVE ACTIVE' : 'CONNECTING...'}
          </span>
        </div>
      </div>



      {/* Right Telemetry Readouts */}
      <div className="flex items-center gap-3">
        {/* Real-time UTC / Local Clock */}
        <div className="bg-slate-50 dark:bg-[#080c15] border border-slate-200 dark:border-[#1c273e] rounded px-2.5 py-1 text-right">
          <p className="text-slate-800 dark:text-slate-200 text-xs font-mono font-bold tabular-nums leading-none">
            {time.toLocaleTimeString('en-IN', { hour12: false })} <span className="text-slate-400 text-[10px]">IST</span>
          </p>
          <p className="text-slate-500 text-[10px] font-mono leading-none mt-0.5">
            {time.toISOString().split('T')[0]}
          </p>
        </div>

        {/* Stylish Custom Language Dropdown (English, Hindi, Marathi) */}
        <div className="relative">
          <button
            onClick={() => setLangMenuOpen(!langMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#151f33] hover:bg-slate-200 dark:hover:bg-[#1c2a44] border border-slate-300 dark:border-[#223048] text-slate-800 dark:text-slate-200 text-xs font-bold font-mono transition-colors shadow-xs cursor-pointer"
            title="Switch System Language"
          >
            <Globe size={13} className="text-blue-500 shrink-0" />
            <span>
              {activeLang === 'en' ? 'ENGLISH (EN)' : activeLang === 'hi' ? 'हिन्दी (HI)' : 'मराठी (MR)'}
            </span>
            <span className="text-[9px] text-slate-400">▼</span>
          </button>

          {/* Hidden Google Translate container */}
          <div id="google_translate_element" className="hidden" />

          {/* Custom Dropdown Menu */}
          {langMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-[#0e1422] border border-slate-200 dark:border-[#1c273e] rounded-lg shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              {[
                { code: 'en', label: 'English', sub: 'Default' },
                { code: 'hi', label: 'हिन्दी', sub: 'Hindi' },
                { code: 'mr', label: 'मराठी', sub: 'Marathi' },
              ].map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageSelect(lang.code)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#151f33] transition-colors cursor-pointer ${
                    activeLang === lang.code
                      ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{lang.label}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-mono">{lang.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Switcher Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-slate-100 dark:bg-[#151f33] hover:bg-slate-200 dark:hover:bg-[#1c2a44] border border-slate-300 dark:border-[#223048] text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center shadow-xs cursor-pointer"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun size={15} className="text-amber-400" />
          ) : (
            <Moon size={15} className="text-slate-700" />
          )}
        </button>

        {/* Alerts Bell */}
        <button
          onClick={() => navigate('/alerts')}
          className="relative p-2 rounded bg-slate-100 dark:bg-[#151f33] border border-slate-300 dark:border-[#223048] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          title="View Alerts & Incident Center"
        >
          <Bell size={14} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1 min-w-[14px] h-[14px] rounded-full bg-red-600 text-white text-[9px] font-mono font-bold flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Operator Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-[#1c273e]">
          <div className="w-7 h-7 rounded bg-slate-100 dark:bg-[#151f33] border border-slate-300 dark:border-[#223048] flex items-center justify-center text-slate-700 dark:text-slate-300">
            <UserCheck size={14} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-left">
            <p className="text-slate-800 dark:text-slate-200 text-xs font-bold leading-tight font-mono">ADMIN #14</p>
            <p className="text-slate-500 text-[10px] leading-tight font-medium">MUNICIPAL</p>
          </div>
        </div>
      </div>
    </header>
  );
}
