import React, { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, TrendingUp, MapPin, Sliders, CheckCircle2, Flame, Eye, Compass, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { api } from '../services/api';

const junctions = [
  { id: 'J1', name: 'Junction J1 (North Avenue)', camId: 'CAM-01', x: 140, y: 80 },
  { id: 'J2', name: 'Junction J2 (Central Square)', camId: 'CAM-02', x: 340, y: 80 },
  { id: 'J3', name: 'Junction J3 (Brigade Hub)', camId: 'CAM-03', x: 540, y: 80 },
  { id: 'J4', name: 'Junction J4 (Residency Cross)', camId: 'CAM-04', x: 340, y: 220 },
];

export default function SafetyAnalyticsPage() {
  const [selectedJunction, setSelectedJunction] = useState<string>('J2');
  const [riskData, setRiskData] = useState<any>(null);
  const [hotspotsData, setHotspotsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Historical Risk Trend
  const [riskTrend, setRiskTrend] = useState<any[]>([
    { time: '-60m', risk: 42 },
    { time: '-45m', risk: 48 },
    { time: '-30m', risk: 65 },
    { time: '-15m', risk: 74 },
    { time: 'Now', risk: 78 },
  ]);

  const fetchData = async () => {
    try {
      const risk = await api.getJunctionRisk(selectedJunction);
      setRiskData(risk);
      const hotspots = await api.getSafetyHotspots();
      setHotspotsData(hotspots);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [selectedJunction]);

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'MODERATE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
  };

  const factorBarData = riskData?.factor_breakdown
    ? [
        { factor: 'Wrong-Way Freq', score: riskData.factor_breakdown.wrong_direction_frequency },
        { factor: 'Speed Variance', score: riskData.factor_breakdown.speed_variance },
        { factor: 'Sudden Braking', score: riskData.factor_breakdown.sudden_braking },
        { factor: 'Traffic Density', score: riskData.factor_breakdown.traffic_density },
        { factor: 'Queue Pressure', score: riskData.factor_breakdown.queue_pressure },
        { factor: 'Incident History', score: riskData.factor_breakdown.incident_frequency },
      ]
    : [];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-7xl mx-auto font-mono">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-[#1e293b] px-4 py-3 rounded-lg shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500">
            <ShieldAlert size={18} />
          </div>
          <div>
            <h1 className="text-slate-900 dark:text-white font-bold text-sm uppercase">Safety Analytics & Risk Hotspots</h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Multi-Factor Conflict Risk & Black Spot Monitoring
            </p>
          </div>
        </div>

        {/* Junction Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#151f33] p-1 rounded-lg border border-slate-200 dark:border-[#223048]">
          {junctions.map((junc) => (
            <button
              key={junc.id}
              onClick={() => setSelectedJunction(junc.id)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                selectedJunction === junc.id
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {junc.id}
            </button>
          ))}
        </div>
      </div>

      {/* Safety Disclaimer Banner */}
      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs">
        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-slate-700 dark:text-slate-300">
          <strong className="text-amber-500">SAFETY ANALYTICS DISCLAIMER:</strong> This predictive engine evaluates elevated conflict likelihood and identifies statistical high-risk locations/hotspots based on observed speed variance, abrupt braking, and queue pressure. It does <em>not</em> make deterministic guarantees that an accident will occur.
        </p>
      </div>

      {/* Main KPI Risk Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Risk Score */}
        <div className="panel p-4 bg-white dark:bg-[#0c1322] border-slate-200 dark:border-[#1c273e] space-y-1">
          <span className="text-slate-500 text-[10px] uppercase font-bold">Safety Risk Score</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold text-slate-900 dark:text-white font-mono">
              {riskData?.risk_score ?? 0}
            </span>
            <span className="text-xs text-slate-500">/ 100 PTS</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-[#1c273e] rounded-full overflow-hidden mt-2">
            <div
              className={`h-full ${
                (riskData?.risk_score ?? 0) >= 75 ? 'bg-red-500' :
                (riskData?.risk_score ?? 0) >= 50 ? 'bg-orange-500' :
                (riskData?.risk_score ?? 0) >= 25 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${riskData?.risk_score ?? 0}%` }}
            />
          </div>
        </div>

        {/* Risk Classification Level */}
        <div className="panel p-4 bg-white dark:bg-[#0c1322] border-slate-200 dark:border-[#1c273e] space-y-1">
          <span className="text-slate-500 text-[10px] uppercase font-bold">Assessed Risk Level</span>
          <div className="mt-1">
            <span className={`px-2.5 py-1 rounded border text-sm font-bold inline-block ${getRiskBadgeColor(riskData?.risk_level || 'LOW')}`}>
              {riskData?.risk_level || 'LOW'} LEVEL
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">0-25 LOW · 26-50 MOD · 51-75 HIGH · 76-100 CRIT</span>
        </div>

        {/* Primary Contributing Factor */}
        <div className="panel p-4 bg-white dark:bg-[#0c1322] border-slate-200 dark:border-[#1c273e] space-y-1">
          <span className="text-slate-500 text-[10px] uppercase font-bold">Top Contributing Factor</span>
          <p className="text-sm font-bold text-orange-400 mt-1 line-clamp-1">
            {riskData?.top_contributing_factors?.[0]?.factor || 'Evaluating telemetry...'}
          </p>
          <span className="text-[10px] text-slate-400">Impact: {riskData?.top_contributing_factors?.[0]?.weighted_impact || 0} pts weighted</span>
        </div>

        {/* Active Hotspot Count */}
        <div className="panel p-4 bg-white dark:bg-[#0c1322] border-slate-200 dark:border-[#1c273e] space-y-1">
          <span className="text-slate-500 text-[10px] uppercase font-bold">Network Risk Hotspots</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold text-red-500 font-mono">
              {hotspotsData?.active_hotspots_count ?? 1}
            </span>
            <span className="text-xs text-slate-500">/ {hotspotsData?.total_evaluated_junctions ?? 4} Nodes</span>
          </div>
          <span className="text-[10px] text-red-400 font-bold block mt-1">Identified Elevated Risk Nodes</span>
        </div>
      </div>

      {/* Middle Row: Contributing Factors Breakdown & Historical Risk Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Normalized Factor Breakdown Bar Chart */}
        <div className="panel p-4 bg-white dark:bg-[#0c1322] border-slate-200 dark:border-[#1c273e] space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1c273e] pb-2">
            <span className="text-slate-900 dark:text-white font-bold text-xs uppercase flex items-center gap-2">
              <Sliders size={14} className="text-orange-400" /> Multi-Factor Safety Risk Breakdown
            </span>
            <span className="text-[10px] text-slate-500">Normalized Index (0-100)</span>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={factorBarData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis dataKey="factor" type="category" tick={{ fill: '#64748b', fontSize: 10 }} width={120} />
              <Tooltip
                contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
              />
              <Bar dataKey="score" fill="#f97316" radius={[0, 4, 4, 0]} name="Risk Intensity" />
            </BarChart>
          </ResponsiveContainer>

          {/* Top Contributing Factors Explanatory List */}
          <div className="space-y-1.5 pt-1">
            <span className="text-slate-500 text-[10px] font-bold uppercase block">Top Contributing Factors:</span>
            {riskData?.top_contributing_factors?.map((f: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-xs p-1.5 rounded bg-slate-50 dark:bg-[#121a2d] border border-slate-200 dark:border-[#1c273e]">
                <span className="text-slate-800 dark:text-slate-200">{f.factor}</span>
                <span className="font-mono text-orange-400 font-bold">Severity: {f.severity_score}/100</span>
              </div>
            ))}
          </div>
        </div>

        {/* Historical Risk Trend Over Time */}
        <div className="panel p-4 bg-white dark:bg-[#0c1322] border-slate-200 dark:border-[#1c273e] space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1c273e] pb-2">
            <span className="text-slate-900 dark:text-white font-bold text-xs uppercase flex items-center gap-2">
              <TrendingUp size={14} className="text-blue-400" /> Historical Risk Score Progression
            </span>
            <span className="text-[10px] text-slate-500">Past 60 Minutes</span>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={riskTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
              />
              <ReferenceLine y={50} stroke="rgba(245,158,11,0.5)" strokeDasharray="4 4" label={{ value: 'Elevated Risk (50)', fill: '#f59e0b', fontSize: 9 }} />
              <ReferenceLine y={75} stroke="rgba(239,68,68,0.5)" strokeDasharray="4 4" label={{ value: 'Critical Risk (75)', fill: '#ef4444', fontSize: 9 }} />
              <Line type="monotone" dataKey="risk" stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', r: 4 }} name="Risk Score" />
            </LineChart>
          </ResponsiveContainer>

          <div className="p-2.5 rounded bg-slate-50 dark:bg-[#121a2d] border border-slate-200 dark:border-[#1c273e] text-xs">
            <span className="text-slate-500 text-[10px] uppercase font-bold block">SAFETY LOG SUMMARY:</span>
            <p className="text-slate-700 dark:text-slate-300 mt-0.5">
              Risk score at {selectedJunction} has risen over the last 30 minutes primarily driven by elevated speed variance and queuing spillover during peak cross-corridor actuation.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Section: Risk Hotspot Matrix & Interactive Spatial Hotspot Map */}
      <div className="panel p-4 bg-white dark:bg-[#0c1322] border-slate-200 dark:border-[#1c273e] space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1c273e] pb-2">
          <span className="text-slate-900 dark:text-white font-bold text-xs uppercase flex items-center gap-2">
            <MapPin size={14} className="text-red-400" /> Arterial Risk Hotspots Matrix & Map
          </span>
          <span className="text-[10px] text-slate-500">Aggregated High-Risk Corridor Nodes</span>
        </div>

        {/* Hotspots Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {hotspotsData?.hotspots?.map((h: any) => (
            <div
              key={h.junction_id}
              onClick={() => setSelectedJunction(h.junction_id)}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                selectedJunction === h.junction_id
                  ? 'bg-orange-500/10 border-orange-500/50 shadow-xs'
                  : 'bg-slate-50 dark:bg-[#121a2d] border-slate-200 dark:border-[#1c273e] hover:border-slate-400'
              }`}
            >
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#1c273e] pb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">{h.junction_id}</span>
                  {h.is_hotspot && (
                    <span className="px-1.5 py-0.2 rounded bg-red-500 text-white text-[9px] font-bold">HOTSPOT</span>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadgeColor(h.risk_level)}`}>
                  {h.risk_score} PTS
                </span>
              </div>

              <div className="space-y-1 pt-2 text-xs">
                <div className="text-[11px] text-slate-500">
                  <span>Primary Issue:</span>
                  <p className="text-orange-400 font-medium line-clamp-1">{h.primary_contributor}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
