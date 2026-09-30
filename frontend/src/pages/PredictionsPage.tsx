import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info, Clock, ShieldAlert, Activity, Car, Ruler, Layers } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { api } from '../services/api';
import CongestionGauge from '../components/CongestionGauge';

const junctions = [
  { id: 'J1', name: 'Junction J1 (North Avenue)', camId: 'CAM-01' },
  { id: 'J2', name: 'Junction J2 (Central Square)', camId: 'CAM-02' },
  { id: 'J3', name: 'Junction J3 (Brigade Hub)', camId: 'CAM-03' },
  { id: 'J4', name: 'Junction J4 (Residency Cross)', camId: 'CAM-04' },
];

export default function PredictionsPage() {
  const [selectedJunction, setSelectedJunction] = useState<string>('J3');
  const [junctionForecast, setJunctionForecast] = useState<any>(null);
  const [allForecasts, setAllForecasts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const fetchForecasts = async () => {
    const results: Record<string, any> = {};
    await Promise.allSettled(
      junctions.map(async (junc) => {
        try {
          const data = await api.getJunctionForecast(junc.id);
          results[junc.id] = data;
        } catch {}
      })
    );
    setAllForecasts(results);
    if (results[selectedJunction]) {
      setJunctionForecast(results[selectedJunction]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchForecasts();
    const interval = setInterval(fetchForecasts, 4000);
    return () => clearInterval(interval);
  }, [selectedJunction]);

  const activeData = allForecasts[selectedJunction] || junctionForecast;

  const timelineData = activeData?.timeline?.map((t: any) => ({
    horizon: t.horizon,
    pcu: t.pcu,
    density: t.density,
    queue: t.queue,
    wait: t.wait_sec,
    level: t.level,
  })) || [
    { horizon: 'Current', pcu: 35, density: 45, queue: 4, wait: 12, level: 'MEDIUM' },
    { horizon: '+5 min', pcu: 48, density: 58, queue: 7, wait: 16, level: 'HIGH' },
    { horizon: '+10 min', pcu: 64, density: 74, queue: 11, wait: 24, level: 'HIGH' },
    { horizon: '+15 min', pcu: 78, density: 86, queue: 16, wait: 35, level: 'SEVERE' },
  ];

  const trendIcon = (trend: string) => {
    if (trend === 'rising') return <TrendingUp size={16} className="text-red-500" />;
    if (trend === 'falling') return <TrendingDown size={16} className="text-emerald-500" />;
    return <Minus size={16} className="text-slate-400" />;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-7xl mx-auto font-mono">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-[#1e293b] px-4 py-3 rounded-lg shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-500">
            <Clock size={18} />
          </div>
          <div>
            <h1 className="text-slate-900 dark:text-white font-bold text-sm uppercase">Short-Horizon Traffic Forecast</h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              +5m, +10m, and +15m Predictive Volume Horizons
            </p>
          </div>
        </div>

        {/* Junction Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#151f33] p-1 rounded-lg border border-slate-200 dark:border-[#223048]">
          {junctions.map((junc) => (
            <button
              key={junc.id}
              onClick={() => {
                setSelectedJunction(junc.id);
                setJunctionForecast(allForecasts[junc.id]);
              }}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                selectedJunction === junc.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {junc.id}
            </button>
          ))}
        </div>
      </div>

      {/* Warning Alert Banner (If predicted congestion exceeds threshold) */}
      {activeData?.warning_triggered && (
        <div className="p-4 rounded-xl bg-red-950/30 border-2 border-red-500/50 flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-600/20 border border-red-500/40 text-red-500">
              <ShieldAlert size={22} />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">PREDICTIVE CONGESTION ALERT</span>
              <p className="text-slate-900 dark:text-white font-bold text-sm mt-1">
                {activeData.warning_message || `High congestion predicted at ${selectedJunction} within next 10-15 minutes.`}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Trigger Threshold</span>
            <strong className="text-red-400 text-sm font-mono">&gt; 60 PCU / &gt; 70% Density</strong>
          </div>
        </div>
      )}

      {/* Main 4-Horizon Timeline Cards (Current ➔ +5 min ➔ +10 min ➔ +15 min) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {timelineData.map((item: any, idx: number) => {
          const isNow = idx === 0;
          const isSevere = item.level === 'SEVERE';
          const isHigh = item.level === 'HIGH';

          return (
            <div
              key={item.horizon}
              className={`panel p-4 space-y-3 relative overflow-hidden ${
                isNow
                  ? 'bg-blue-500/5 border-blue-500/30'
                  : isSevere
                  ? 'bg-red-500/5 border-red-500/30'
                  : isHigh
                  ? 'bg-amber-500/5 border-amber-500/30'
                  : 'bg-white dark:bg-[#0c1322] border-slate-200 dark:border-[#1c273e]'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1c273e] pb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    isNow ? 'bg-blue-500' : isSevere ? 'bg-red-500 animate-ping' : isHigh ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <span className="text-slate-900 dark:text-white font-bold text-xs uppercase">{item.horizon}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isSevere ? 'bg-red-500/20 text-red-400' :
                  isHigh ? 'bg-amber-500/20 text-amber-400' :
                  item.level === 'MEDIUM' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {item.level} DENSITY
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-slate-50 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048]">
                  <span className="text-slate-500 text-[10px]">PREDICTED PCU</span>
                  <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg mt-0.5">{item.pcu} <span className="text-[10px] text-slate-400 font-normal">PCU</span></p>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048]">
                  <span className="text-slate-500 text-[10px]">DENSITY INDEX</span>
                  <p className="text-blue-600 dark:text-blue-400 font-bold text-lg mt-0.5">{item.density}%</p>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048]">
                  <span className="text-slate-500 text-[10px]">EST. QUEUE</span>
                  <p className="text-amber-600 dark:text-amber-400 font-bold text-base mt-0.5">{item.queue} <span className="text-[10px] text-slate-400 font-normal">VEH</span></p>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048]">
                  <span className="text-slate-500 text-[10px]">WAIT TIME</span>
                  <p className="text-purple-600 dark:text-purple-400 font-bold text-base mt-0.5">{item.wait}s</p>
                </div>
              </div>

              {/* Progress Level Bar */}
              <div className="w-full h-1.5 bg-slate-200 dark:bg-[#1c273e] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    item.density > 75 ? 'bg-red-500' : item.density > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${item.density}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Predictive Trend Progression Chart & All Junction Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend Area Chart (2 Cols) */}
        <div className="lg:col-span-2 panel p-4 bg-white dark:bg-[#0c1322] border-slate-200 dark:border-[#1c273e] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-900 dark:text-white font-bold text-xs uppercase flex items-center gap-2">
              <Activity size={14} className="text-blue-500" /> Short-Horizon PCU & Queue Forecast Curve
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>MODEL CONFIDENCE: <strong className="text-emerald-500">{activeData?.confidence_pct ?? 88}%</strong></span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="pcuPredGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="densityPredGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="horizon" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
              />
              <ReferenceLine y={60} stroke="rgba(239,68,68,0.5)" strokeDasharray="4 4" label={{ value: 'Warning Limit (60 PCU)', fill: '#ef4444', fontSize: 10 }} />
              <Area type="monotone" dataKey="pcu" stroke="#10b981" fill="url(#pcuPredGrad)" strokeWidth={2.5} name="PCU Load" />
              <Area type="monotone" dataKey="density" stroke="#3b82f6" fill="url(#densityPredGrad)" strokeWidth={2} name="Density %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* All Junctions Forecast Summary (1 Col) */}
        <div className="panel p-4 bg-white dark:bg-[#0c1322] border-slate-200 dark:border-[#1c273e] space-y-3">
          <span className="text-slate-900 dark:text-white font-bold text-xs uppercase block border-b border-slate-200 dark:border-[#1c273e] pb-2">
            Network Forecast Matrix (+15 min)
          </span>

          <div className="space-y-2.5">
            {junctions.map((j) => {
              const jData = allForecasts[j.id];
              const p15 = jData?.plus_15min || { pcu: 30, density: 40, level: 'MEDIUM' };

              return (
                <div
                  key={j.id}
                  onClick={() => setSelectedJunction(j.id)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    selectedJunction === j.id
                      ? 'bg-blue-500/10 border-blue-500/40 shadow-xs'
                      : 'bg-slate-50 dark:bg-[#121a2d] border-slate-200 dark:border-[#1c273e] hover:border-slate-400'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">{j.id}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      p15.level === 'SEVERE' ? 'bg-red-500/20 text-red-400' :
                      p15.level === 'HIGH' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {p15.level}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                    <span>+15m PCU: <strong className="text-emerald-500">{p15.pcu}</strong></span>
                    <span>Density: <strong className="text-blue-500">{p15.density}%</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

