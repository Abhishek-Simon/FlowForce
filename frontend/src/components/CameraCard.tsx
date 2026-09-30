import React from 'react';
import { Camera, Wifi, WifiOff, AlertCircle, Activity } from 'lucide-react';

interface CameraCardProps {
  camera: {
    id: string;
    name: string;
    location: string;
    status: string;
    source_type: string;
    fps?: number;
  };
  metric?: {
    vehicle_count?: number;
    pedestrian_count?: number;
    congestion_level?: string;
    traffic_score?: number;
    emergency_detected?: boolean;
  };
  onSelect?: () => void;
  selected?: boolean;
}

const statusConfig: Record<string, { dot: string; label: string; border: string }> = {
  ONLINE:     { dot: 'bg-emerald-400', label: 'Online',     border: 'border-emerald-500/20' },
  OFFLINE:    { dot: 'bg-slate-500',   label: 'Offline',    border: 'border-slate-600/20' },
  PROCESSING: { dot: 'bg-brand-400 animate-pulse', label: 'Processing', border: 'border-brand-500/25' },
  ERROR:      { dot: 'bg-red-400',     label: 'Error',      border: 'border-red-500/25' },
};

const congestionBadge: Record<string, string> = {
  LOW: 'badge-low', MODERATE: 'badge-moderate', HIGH: 'badge-high', SEVERE: 'badge-severe',
};

export default function CameraCard({ camera, metric, onSelect, selected }: CameraCardProps) {
  const sc = statusConfig[camera.status] || statusConfig.ONLINE;

  return (
    <div
      onClick={onSelect}
      className={`panel p-4 cursor-pointer transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/8 ${
        selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : sc.border
      } ${metric?.emergency_detected ? 'emergency-glow' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            camera.status === 'ONLINE' ? 'bg-emerald-100 dark:bg-emerald-500/15' : 'bg-slate-100 dark:bg-slate-700/50'
          }`}>
            <Camera size={15} className={camera.status === 'ONLINE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'} />
          </div>
          <div>
            <p className="text-slate-900 dark:text-white text-sm font-semibold leading-tight">{camera.name}</p>
            <p className="text-slate-500 text-xs font-mono">{camera.id} · {camera.location}</p>
          </div>
        </div>
        {metric?.emergency_detected && (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-500/25 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/40 animate-pulse">
            🚨 EMERG
          </span>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 font-mono">
          <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{sc.label}</span>
          <span className="text-slate-400">·</span>
          <span className="text-xs text-slate-500">{camera.source_type.replace('_', ' ')}</span>
        </div>
        {camera.fps && <span className="text-xs text-slate-500 font-mono">{camera.fps} fps</span>}
      </div>

      {/* Metrics */}
      {metric && (
        <div className="grid grid-cols-3 gap-2 font-mono">
          <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-2 text-center border border-slate-100 dark:border-white/5">
            <p className="text-slate-900 dark:text-white text-sm font-bold tabular-nums">{metric.vehicle_count ?? '--'}</p>
            <p className="text-slate-500 text-xs mt-0.5">Vehicles</p>
          </div>
          <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-2 text-center border border-slate-100 dark:border-white/5">
            <p className="text-blue-600 dark:text-blue-300 text-sm font-bold tabular-nums">{metric.pedestrian_count ?? '--'}</p>
            <p className="text-slate-500 text-xs mt-0.5">Pedestrians</p>
          </div>
          <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-2 text-center border border-slate-100 dark:border-white/5">
            <p className="text-slate-900 dark:text-white text-sm font-bold tabular-nums">{metric.traffic_score?.toFixed(0) ?? '--'}</p>
            <p className="text-slate-500 text-xs mt-0.5">Score</p>
          </div>
        </div>
      )}

      {metric?.congestion_level && (
        <div className="mt-2 flex justify-end">
          <span className={congestionBadge[metric.congestion_level] || 'status-pill-neutral'}>
            {metric.congestion_level}
          </span>
        </div>
      )}
    </div>
  );
}
