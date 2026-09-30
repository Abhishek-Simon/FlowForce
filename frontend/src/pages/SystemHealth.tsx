import React, { useEffect, useState } from 'react';
import { Cpu, Server, HardDrive, CheckCircle2, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { api } from '../services/api';

export default function SystemHealth() {
  const [health, setHealth] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [h, s] = await Promise.allSettled([api.systemHealth(), api.systemSettings()]);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (s.status === 'fulfilled') setSettings(s.value);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu size={20} className="text-blue-600 dark:text-blue-400" /> System Health & Diagnostics
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Hardware resources, inference accelerators, and service statuses</p>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Service Statuses */}
        <div className="panel p-5 space-y-4">
          <h3 className="text-slate-900 dark:text-white font-semibold text-sm flex items-center gap-2">
            <Server size={16} className="text-emerald-600 dark:text-emerald-400" /> Service Status
          </h3>
          <div className="space-y-3">
            {[
              { name: 'FastAPI Backend Core', status: health?.services?.api_server || 'ONLINE' },
              { name: 'SQLite / Relational Database', status: health?.services?.database || 'CONNECTED' },
              { name: 'Real-time WebSocket Manager', status: health?.services?.websocket_manager || 'ACTIVE' },
              { name: 'Async Video Processing Queue', status: health?.services?.video_worker || 'READY' },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50">
                <span className="text-slate-700 dark:text-slate-300 text-sm">{svc.name}</span>
                <span className="status-pill-green">{svc.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hardware Acceleration */}
        <div className="panel p-5 space-y-4">
          <h3 className="text-slate-900 dark:text-white font-semibold text-sm flex items-center gap-2">
            <Zap size={16} className="text-blue-600 dark:text-blue-400" /> Hardware & Compute Device
          </h3>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50 space-y-1">
              <p className="text-slate-500 text-xs font-semibold uppercase">Inference Device</p>
              <p className="text-slate-900 dark:text-white font-bold">{health?.hardware?.device || 'CPU (Standard Host Execution)'}</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50 space-y-1">
              <p className="text-slate-500 text-xs font-semibold uppercase">PyTorch Version</p>
              <p className="text-blue-600 dark:text-blue-400 font-mono font-bold">{health?.hardware?.pytorch_version || '2.x'}</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50 space-y-1">
              <p className="text-slate-500 text-xs font-semibold uppercase">CUDA Acceleration</p>
              <p className="text-slate-700 dark:text-slate-300 font-medium">
                {health?.hardware?.cuda_available ? '✅ CUDA Enabled (NVIDIA GPU)' : '⚡ Automatic CPU Fallback Active'}
              </p>
            </div>
          </div>
        </div>

        {/* ML Model Parameters */}
        <div className="panel p-5 space-y-4">
          <h3 className="text-slate-900 dark:text-white font-semibold text-sm flex items-center gap-2">
            <HardDrive size={16} className="text-purple-600 dark:text-purple-400" /> Computer Vision Model
          </h3>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50 space-y-1">
              <p className="text-slate-500 text-xs font-semibold uppercase">Model Architecture</p>
              <p className="text-slate-900 dark:text-white font-bold">YOLOv8 Nano (COCO Pretrained)</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50 space-y-1">
              <p className="text-slate-500 text-xs font-semibold uppercase">Tracker Engine</p>
              <p className="text-purple-700 dark:text-purple-300 font-medium">ByteTrack (Multi-Object Association)</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50 space-y-1">
              <p className="text-slate-500 text-xs font-semibold uppercase">Default Confidence Threshold</p>
              <p className="text-amber-600 dark:text-amber-400 font-mono font-bold">{settings?.confidence_threshold ?? 0.35}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
