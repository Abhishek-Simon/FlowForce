import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle, AlertTriangle, Filter, Search, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

const severityConfig: Record<string, { cls: string; label: string; dot: string }> = {
  CRITICAL: { cls: 'border-l-red-500 bg-red-500/5', label: 'CRITICAL', dot: 'bg-red-500' },
  HIGH:     { cls: 'border-l-orange-500 bg-orange-500/5', label: 'HIGH', dot: 'bg-orange-500' },
  WARNING:  { cls: 'border-l-amber-500 bg-amber-500/5', label: 'WARNING', dot: 'bg-amber-500' },
  INFO:     { cls: 'border-l-brand-500 bg-brand-500/5', label: 'INFO', dot: 'bg-brand-400' },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      const [alts, incs] = await Promise.allSettled([api.getAlerts(), api.getIncidents()]);
      if (alts.status === 'fulfilled') setAlerts(alts.value as any[]);
      if (incs.status === 'fulfilled') setIncidents(incs.value as any[]);
    } catch {} finally { setLoading(false); }
  };

  const resolve = async (id: string) => {
    await api.resolveAlert(id).catch(() => {});
    fetchData();
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = alerts.filter(a => {
    const matchFilter = filter === 'ALL' || a.severity === filter || (!a.is_resolved && filter === 'ACTIVE');
    const matchSearch = !search || a.message.toLowerCase().includes(search.toLowerCase()) || a.camera_id.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const unread = alerts.filter(a => !a.is_read).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell size={20} className="text-blue-600 dark:text-blue-400" /> Alerts Center
            {unread > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30">{unread} new</span>}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">System alerts, congestion events, and incident reports</p>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', val: alerts.length, color: 'text-slate-900 dark:text-white' },
          { label: 'Critical', val: alerts.filter(a => a.severity === 'CRITICAL').length, color: 'text-red-600 dark:text-red-400' },
          { label: 'Unread', val: unread, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Resolved', val: alerts.filter(a => a.is_resolved).length, color: 'text-emerald-600 dark:text-emerald-400' },
        ].map(({ label, val, color }) => (
          <div key={label} className="panel p-3 text-center">
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
            <p className="text-slate-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search alerts..."
            className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500/50 w-56"
          />
        </div>
        <div className="flex gap-2">
          {['ALL', 'ACTIVE', 'CRITICAL', 'HIGH', 'WARNING'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f ? 'bg-blue-100 dark:bg-blue-500/25 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-500/40' : 'bg-white dark:bg-white/5 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/8'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="panel p-10 text-center">
            <Bell size={28} className="text-slate-400 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-700 dark:text-slate-400 font-medium">No alerts found</p>
            <p className="text-slate-500 dark:text-slate-600 text-sm mt-1">All systems operating normally</p>
          </div>
        ) : (
          filtered.map(alert => {
            const sc = severityConfig[alert.severity] || severityConfig.INFO;
            return (
              <div key={alert.id} className={`panel p-4 border-l-4 ${sc.cls} flex items-start gap-4 ${alert.is_resolved ? 'opacity-60' : ''}`}>
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${sc.dot} ${!alert.is_read ? 'ring-2 ring-offset-2 ring-offset-transparent' : ''}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-slate-900 dark:text-white text-sm font-bold">{alert.alert_type.replace(/_/g, ' ')}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${
                      alert.severity === 'CRITICAL' ? 'status-pill-red' :
                      alert.severity === 'HIGH' ? 'status-pill-amber' : 'status-pill-neutral'
                    }`}>{alert.severity}</span>
                    {alert.is_resolved && <span className="status-pill-neutral">RESOLVED</span>}
                    {!alert.is_read && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30">NEW</span>}
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">{alert.message}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-mono">
                    <span>{alert.camera_id}</span>
                    <span>·</span>
                    <span>{new Date(alert.timestamp * 1000).toLocaleString()}</span>
                  </div>
                </div>
                {!alert.is_resolved && (
                  <button onClick={() => resolve(alert.id)} className="btn-secondary text-xs flex items-center gap-1.5 shrink-0">
                    <CheckCircle size={12} /> Resolve
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Incidents */}
      {incidents.length > 0 && (
        <div>
          <h3 className="text-slate-900 dark:text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle size={15} className="text-orange-500" /> Active Incidents
          </h3>
          <div className="space-y-2">
            {incidents.map((inc: any) => (
              <div key={inc.id} className="panel p-4 border-l-4 border-l-orange-500 flex items-start gap-4">
                <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-slate-900 dark:text-white text-sm font-bold">{inc.incident_type.replace(/_/g, ' ')}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${inc.severity === 'HIGH' ? 'status-pill-red' : 'status-pill-amber'}`}>{inc.severity}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${inc.status === 'OPEN' ? 'status-pill-amber' : 'status-pill-neutral'}`}>{inc.status}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">{inc.description}</p>
                  <p className="text-slate-500 text-xs mt-1 font-mono">{inc.camera_id} · {new Date(inc.timestamp * 1000).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
