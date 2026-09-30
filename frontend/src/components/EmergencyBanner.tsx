import React from 'react';
import { AlertTriangle, Siren, X, CheckCircle, Eye } from 'lucide-react';
import { api } from '../services/api';

interface EmergencyBannerProps {
  events: any[];
  onAcknowledge: (id: string) => void;
}

export default function EmergencyBanner({ events, onAcknowledge }: EmergencyBannerProps) {
  const active = events.filter(e => e.status === 'ACTIVE');
  if (!active.length) return null;

  return (
    <div className="space-y-2 mb-4">
      {active.map(event => (
        <div key={event.id} className="emergency-glow border border-red-500/50 bg-red-500/10 backdrop-blur-sm rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/25 border border-red-500/40 flex items-center justify-center shrink-0">
                <Siren className="text-red-400 animate-pulse" size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-red-300 font-bold text-sm tracking-wide">🚨 EMERGENCY VEHICLE DETECTED</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/30 text-red-300 border border-red-400/40">
                    {event.priority}
                  </span>
                </div>
                <p className="text-white font-semibold">{event.vehicle_type}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span>📡 {event.camera_id}</span>
                  <span>🧭 {event.direction}</span>
                  <span>🎯 Confidence: {Math.round((event.confidence || 0.9) * 100)}%</span>
                </div>
                <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-amber-300 text-xs font-semibold">⚡ RECOMMENDED ACTION (SIMULATED)</p>
                  <p className="text-amber-200 text-xs mt-0.5">{event.recommended_action}</p>
                  <p className="text-amber-600 text-xs mt-1 italic">* Awaiting physical traffic controller integration</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => onAcknowledge(event.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-xs font-semibold transition-all"
              >
                <CheckCircle size={13} /> Acknowledge
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
