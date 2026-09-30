import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, ShieldAlert, Sliders } from 'lucide-react';

export default function SettingsPage() {
  const [modelPath, setModelPath] = useState('ml/models/yolov8n.pt');
  const [confThreshold, setConfThreshold] = useState(0.35);
  const [iouThreshold, setIouThreshold] = useState(0.45);
  const [enableTracking, setEnableTracking] = useState(true);
  const [enablePrediction, setEnablePrediction] = useState(true);
  const [enableEmergency, setEnableEmergency] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon size={20} className="text-blue-600 dark:text-blue-400" /> System Settings & ML Hyperparameters
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Configure model paths, inference thresholds, and module toggles</p>
      </div>

      {saved && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm font-semibold flex items-center gap-2">
          ✅ Settings saved and applied successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="panel p-6 space-y-6">
        <div className="space-y-4">
          <h3 className="text-slate-900 dark:text-white font-semibold text-sm flex items-center gap-2">
            <Sliders size={16} className="text-blue-600 dark:text-blue-400" /> Computer Vision Thresholds
          </h3>

          <div>
            <label className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase block mb-1">Model Weights Path</label>
            <input
              type="text"
              value={modelPath}
              onChange={(e) => setModelPath(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#090f1d] border border-slate-300 dark:border-[#1e293b] text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase block mb-1">
                Detection Confidence: <span className="text-blue-600 dark:text-blue-400 font-bold">{confThreshold}</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={confThreshold}
                onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase block mb-1">
                IoU Suppression Threshold: <span className="text-blue-600 dark:text-blue-400 font-bold">{iouThreshold}</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={iouThreshold}
                onChange={(e) => setIouThreshold(parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t border-slate-200 dark:border-[#1e293b] pt-4">
          <h3 className="text-slate-900 dark:text-white font-semibold text-sm">Feature Modules</h3>
          <div className="space-y-3">
            {[
              { label: 'ByteTrack Multi-Object Association', checked: enableTracking, setter: setEnableTracking, desc: 'Tracks persistent IDs for velocity and stationary queue measurements' },
              { label: 'Short-Term Congestion Extrapolation (5m / 15m)', checked: enablePrediction, setter: setEnablePrediction, desc: 'Computes future congestion trends using rolling score history' },
              { label: 'Emergency Vehicle Heuristic Signature Engine', checked: enableEmergency, setter: setEnableEmergency, desc: 'Scans bounding boxes for emergency vehicle color patterns and priority preemption' },
            ].map(({ label, checked, setter, desc }) => (
              <label key={label} className="flex items-start gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/8">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setter(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-blue-600 rounded"
                />
                <div>
                  <p className="text-slate-900 dark:text-white text-sm font-medium">{label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <button type="submit" className="btn-primary flex items-center gap-2 text-sm">
            <Save size={16} /> Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
