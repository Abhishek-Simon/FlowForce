import React, { useEffect, useState } from 'react';
import {
  Flame,
  AlertTriangle,
  CheckCircle,
  Radio,
  Clock,
  Shield,
  Layers,
  FileCheck,
} from 'lucide-react';
import { api } from '../services/api';

export default function EmergencyCenter() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      const data = await api.getEmergencyEvents();
      setEvents(data);
    } catch {
      setEvents([
        {
          id: 'EMG-081',
          camera_id: 'CAM-01',
          vehicle_type: 'Ambulance (EMS-911)',
          confidence: 0.94,
          direction: 'Northbound',
          priority: 'CRITICAL',
          status: 'ACTIVE',
          recommended_action: 'HOLD EAST/WEST CORRIDORS. EXTEND NORTHBOUND GREEN PHASE TO 60 SECONDS.',
          timestamp: Date.now() / 1000 - 90,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    await api.acknowledgeEmergency(id).catch(() => {});
    fetchEvents();
  };

  const handleClear = async (id: string) => {
    await api.clearEmergency(id).catch(() => {});
    fetchEvents();
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const active = events.filter((e) => e.status === 'ACTIVE');
  const past = events.filter((e) => e.status !== 'ACTIVE');

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-6xl mx-auto font-mono">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-[#1e293b] px-3.5 py-2.5 rounded-lg shadow-xs">
        <div className="flex items-center gap-2">
          <Flame size={15} className="text-red-500" />
          <span className="text-slate-500 dark:text-slate-400 text-xs">EMERGENCY_DISPATCH /</span>
          <span className="text-slate-900 dark:text-white text-xs font-semibold">SIGNAL PREEMPTION OVERRIDE</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">STATUS:</span>
          <span className={active.length > 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
            {active.length > 0 ? `${active.length} ACTIVE INCIDENT(S)` : 'ALL CORRIDORS NOMINAL'}
          </span>
        </div>
      </div>

      {/* Protocol Notice Banner */}
      <div className="p-3 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-[#1e293b] rounded text-xs flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Shield size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <span>Automated Emergency Vehicle Preemption (EVP) Protocol · OSRM Network Coordination Engine</span>
        </div>
        <button
          onClick={async () => {
            try {
              await api.triggerGreenWave('CAM-02', 'CAM-03', 'Northbound');
              await fetchEvents();
            } catch (e) {
              console.error(e);
            }
          }}
          className="btn-primary text-xs flex items-center gap-1.5 cursor-pointer hover:bg-blue-600 active:scale-95 transition-all"
        >
          <Radio size={12} className="animate-pulse" /> SIMULATE OSRM GREEN WAVE
        </button>
      </div>

      {/* Active Emergency Dispatch Callouts */}
      {active.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Active Priority Events Requiring Action:
          </p>
          {active.map((ev) => (
            <div
              key={ev.id}
              className="panel border-l-4 border-l-red-600 p-4 bg-red-50/60 dark:bg-red-950/20 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="status-pill-red font-bold">{ev.priority} PRIORITY</span>
                    <span className="text-slate-900 dark:text-white font-bold text-sm">
                      {ev.vehicle_type} @ {ev.camera_id}
                    </span>
                    <span className="text-slate-500 text-xs">CONFIDENCE: {Math.round(ev.confidence * 100)}%</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-xs mt-1">
                    Direction of Travel: <strong className="text-slate-900 dark:text-white">{ev.direction}</strong> · Detection Timestamp:{' '}
                    {new Date(ev.timestamp * 1000).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAcknowledge(ev.id)} className="btn-secondary text-xs">
                    ACKNOWLEDGE
                  </button>
                  <button onClick={() => handleClear(ev.id)} className="btn-primary text-xs">
                    <CheckCircle size={13} /> CLEAR & RESTORE
                  </button>
                </div>
              </div>

              {/* Recommended Preemption Pattern */}
              <div className="p-3 bg-white dark:bg-[#080e1a] border border-slate-200 dark:border-[#1e293b] rounded space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase">Computed Controller Preemption Action:</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">PHASE HOLD</span>
                </div>
                <p className="text-emerald-700 dark:text-emerald-400 text-xs font-bold">{ev.recommended_action}</p>

                <div className="grid grid-cols-4 gap-2 pt-1">
                  {['Northbound', 'Southbound', 'Eastbound', 'Westbound'].map((dir) => {
                    const isGreen = dir.toLowerCase() === ev.direction.toLowerCase();
                    return (
                      <div
                        key={dir}
                        className={`p-2 rounded border text-center text-xs ${
                          isGreen
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-bold'
                            : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                        }`}
                      >
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{dir.toUpperCase()}</p>
                        <p className="text-sm mt-0.5">{isGreen ? '🟢 GREEN PRIORITY' : '🔴 RED HOLD'}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel p-8 text-center space-y-2">
          <CheckCircle size={28} className="text-emerald-600 dark:text-emerald-400 mx-auto" />
          <p className="text-slate-900 dark:text-white text-sm font-semibold">NO ACTIVE EMERGENCY VEHICLE DETECTIONS</p>
          <p className="text-slate-500 text-xs">
            CV model continuously scans video frames for ambulance/fire unit color signatures.
          </p>
        </div>
      )}

      {/* Historical Dispatch Table */}
      <div className="panel">
        <div className="panel-header">
          <span className="text-white text-xs font-semibold uppercase">
            Emergency Preemption Audit Log
          </span>
          <span className="text-slate-400 text-xs">TOTAL: {events.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Target Sensor</th>
                <th>Classification</th>
                <th>Direction</th>
                <th>Priority</th>
                <th>Action Taken</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="font-bold text-white">{e.id}</td>
                  <td>{e.camera_id}</td>
                  <td>{e.vehicle_type}</td>
                  <td>{e.direction}</td>
                  <td>
                    <span
                      className={
                        e.priority === 'CRITICAL' ? 'status-pill-red' : 'status-pill-amber'
                      }
                    >
                      {e.priority}
                    </span>
                  </td>
                  <td className="text-slate-400 truncate max-w-xs">{e.recommended_action}</td>
                  <td>
                    <span
                      className={
                        e.status === 'ACTIVE'
                          ? 'status-pill-red'
                          : e.status === 'ACKNOWLEDGED'
                          ? 'status-pill-amber'
                          : 'status-pill-green'
                      }
                    >
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
