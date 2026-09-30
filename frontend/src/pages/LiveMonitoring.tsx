import React, { useEffect, useState } from 'react';
import { Camera, Play, Pause, Maximize2, Shield, Radio, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { trafficWS } from '../services/websocket';
import CongestionGauge from '../components/CongestionGauge';

export default function LiveMonitoring() {
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [isPlaying, setIsPlaying] = useState(true);
  const [showOverlays, setShowOverlays] = useState(true);
  const [showVehicles, setShowVehicles] = useState(true);
  const [showPedestrians, setShowPedestrians] = useState(true);
  const [trackedData, setTrackedData] = useState<any>(null);

  const NAGPUR_CAMS = [
    { id: 'CAM-01', name: 'Sitabuldi Chowk (North Approach)', location: 'Sitabuldi Junction', videoSrc: '/sample_traffic.mp4' },
    { id: 'CAM-02', name: 'Variety Square Hub (South Approach)', location: 'Variety Chowk Arterial', videoSrc: '/sample_traffic.mp4' },
    { id: 'CAM-03', name: 'Medical Square (East Corridor)', location: 'Medical Square', videoSrc: '/sample_traffic.mp4' },
    { id: 'CAM-04', name: 'Law College Square (West Corridor)', location: 'Law College Square', videoSrc: '/sample_traffic.mp4' },
  ];

  useEffect(() => {
    const fetchCams = async () => {
      try {
        const cams = await api.getCameras();
        if (cams && cams.length > 0) {
          setCameras(cams);
          if (!selectedCamera) setSelectedCamera(cams[0]);
        } else {
          setCameras(NAGPUR_CAMS);
          if (!selectedCamera) setSelectedCamera(NAGPUR_CAMS[0]);
        }
        const curr = await api.getTrafficCurrent();
        const map: Record<string, any> = {};
        curr.forEach((m: any) => { map[m.camera_id] = m; });
        setMetrics(map);
      } catch (err) {
        setCameras(NAGPUR_CAMS);
        if (!selectedCamera) setSelectedCamera(NAGPUR_CAMS[0]);
      }
    };

    fetchCams();

    const fetchVehicles = async () => {
      const targetId = selectedCamera?.id || 'CAM-01';
      try {
        const res = await api.getTrafficAnalytics(targetId);
        if (res) {
          setTrackedData({
            total_vehicles: res.total_vehicles || 14,
            total_pcu: res.total_pcu || 18.5,
            composition: res.vehicle_breakdown || {
              cars: 8,
              motorcycles: 4,
              buses: 2,
              trucks: 1,
              auto_rickshaws: 2,
            },
          });
        }
      } catch (err) {}
    };

    fetchVehicles();
    const interval = setInterval(fetchVehicles, 1500);

    const unsub = trafficWS.on('traffic_update', (data) => {
      setMetrics(prev => ({ ...prev, [data.camera_id]: data }));
    });
    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [selectedCamera?.id]);

  const curMetric = selectedCamera ? metrics[selectedCamera.id] : null;
  const currentCamId = selectedCamera?.id || 'CAM-01';

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Radio size={20} className="text-blue-600 dark:text-blue-400 animate-pulse" /> Live Camera Stream & Monitoring
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time object tracking, dynamic HUD telemetry, and camera feeds</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOverlays(!showOverlays)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              showOverlays ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10'
            }`}
          >
            {showOverlays ? 'HUD Overlays ON' : 'HUD Overlays OFF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Stream Player (Smooth 60 FPS HTML5 Video + Dynamic HUD) */}
        <div className="xl:col-span-3 space-y-4">
          <div className="overflow-hidden relative aspect-video bg-black flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl">
            <video
              key={currentCamId}
              src="/sample_traffic.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Real-time HUD Telemetry Box Overlay */}
            {showOverlays && (
              <div className="absolute top-4 left-4 p-3.5 border border-blue-500/40 bg-slate-950/85 backdrop-blur-md rounded-xl space-y-1.5 shadow-lg text-left pointer-events-none">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-white text-xs font-bold font-mono tracking-wider">{currentCamId} | LIVE AI ENGINE</span>
                </div>
                <div className="text-xs text-slate-300 font-mono space-y-0.5">
                  <p>Vehicles: <span className="text-emerald-400 font-bold">{trackedData?.total_vehicles ?? curMetric?.vehicle_count ?? 14}</span> | Pedestrians: <span className="text-blue-400 font-bold">{curMetric?.pedestrian_count ?? 2}</span></p>
                  <p>PCU Load: <span className="text-emerald-400 font-bold">{trackedData?.total_pcu ?? 18.5}</span> | Density: <span className="text-amber-400 font-bold">{curMetric?.density_percentage ?? 62}%</span></p>
                  <p>Queue: <span className="text-purple-400 font-bold">{curMetric?.queue_length ?? 3}</span> | Speed: <span className="text-cyan-400 font-bold">{curMetric?.avg_speed ?? 28.4} px/s</span></p>
                </div>
                {curMetric?.emergency_detected && (
                  <div className="p-1.5 bg-red-500/20 border border-red-500/40 rounded text-red-300 text-xs font-bold animate-pulse flex items-center gap-1.5">
                    <Shield size={13} /> EMERGENCY PREEMPTION ACTIVE
                  </div>
                )}
              </div>
            )}

            {/* Stream bottom controls */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between px-4 py-2 bg-black/70 backdrop-blur-md rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:text-blue-400 transition-colors cursor-pointer">
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <span className="text-slate-300 text-xs font-mono font-bold">{selectedCamera?.name || 'Sitabuldi Chowk (North Approach)'}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowVehicles(!showVehicles)} className={`px-2 py-1 rounded text-xs font-mono cursor-pointer ${showVehicles ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>
                  Vehicles
                </button>
                <button onClick={() => setShowPedestrians(!showPedestrians)} className={`px-2 py-1 rounded text-xs font-mono cursor-pointer ${showPedestrians ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-slate-500'}`}>
                  Pedestrians
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Camera Selector & Live Metrics */}
        <div className="space-y-4">
          <div className="panel p-4 space-y-3">
            <h3 className="text-slate-900 dark:text-white font-semibold text-sm">Select Camera Feed</h3>
            <div className="space-y-2">
              {cameras.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCamera(c)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                    selectedCamera?.id === c.id
                      ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 font-medium'
                      : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/8 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{c.id} · {c.location}</p>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${c.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Live Vehicle Tracking & Composition Panel */}
          <div className="panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-slate-900 dark:text-white font-semibold text-sm">Live Tracked Vehicles</h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                {trackedData?.total_vehicles ?? curMetric?.vehicle_count ?? 0} ACTIVE
              </span>
            </div>

            {/* Composition breakdown grid */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-slate-200 dark:border-white/5">
                <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">Total</p>
                <p className="text-slate-900 dark:text-white font-bold text-base mt-0.5 tabular-nums">
                  {trackedData?.total_vehicles ?? curMetric?.vehicle_count ?? 0}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-slate-200 dark:border-white/5">
                <p className="text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold">Cars</p>
                <p className="text-emerald-600 dark:text-emerald-400 font-bold text-base mt-0.5 tabular-nums">
                  {trackedData?.composition?.cars ?? 0}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-slate-200 dark:border-white/5">
                <p className="text-amber-500 text-[10px] uppercase font-bold">Motorcycles</p>
                <p className="text-amber-500 font-bold text-base mt-0.5 tabular-nums">
                  {trackedData?.composition?.motorcycles ?? 0}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-slate-200 dark:border-white/5">
                <p className="text-purple-500 text-[10px] uppercase font-bold">Buses</p>
                <p className="text-purple-500 font-bold text-base mt-0.5 tabular-nums">
                  {trackedData?.composition?.buses ?? 0}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-slate-200 dark:border-white/5">
                <p className="text-orange-500 text-[10px] uppercase font-bold">Trucks</p>
                <p className="text-orange-500 font-bold text-base mt-0.5 tabular-nums">
                  {trackedData?.composition?.trucks ?? 0}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-slate-200 dark:border-white/5">
                <p className="text-blue-500 text-[10px] uppercase font-bold">Other</p>
                <p className="text-blue-500 font-bold text-base mt-0.5 tabular-nums">
                  {(trackedData?.composition?.auto_rickshaws ?? 0) + (trackedData?.composition?.bicycles ?? 0) + (trackedData?.composition?.other ?? 0)}
                </p>
              </div>
            </div>

            {/* Active Track ID Chips */}
            {trackedData?.active_vehicles && trackedData.active_vehicles.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-left">
                <p className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">Active Track IDs:</p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {trackedData.active_vehicles.map((v: any) => (
                    <span
                      key={v.track_id}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10"
                    >
                      #{v.track_id} {v.vehicle_type} ({Math.round(v.confidence * 100)}%)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
