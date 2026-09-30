import React, { useRef, useState, useEffect } from 'react';
import { Video, AlertCircle, RefreshCw, Radio } from 'lucide-react';
import { NagpurJunction } from '../data/nagpurJunctions';

interface CCTVViewerProps {
  junction: NagpurJunction;
}

export default function CCTVViewer({ junction }: CCTVViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    if (videoRef.current && junction.cctvUrl) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [junction]);

  const isDemo = junction.streamType === 'demo';
  const isOnline = junction.status === 'online' && Boolean(junction.cctvUrl) && !hasError;

  return (
    <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-[#1c273e] rounded-lg p-3 space-y-2.5 font-mono">
      {/* CCTV Header info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-[#1c273e] pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500">
            <Video size={13} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-900 dark:text-white uppercase">{junction.name}</span>
              <span className="text-[10px] text-slate-400">({junction.area}, {junction.city})</span>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 text-[10px]">CAMERA STATUS:</span>
          {isOnline ? (
            <span className="text-emerald-500 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
            </span>
          ) : (
            <span className="text-red-500 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Offline
            </span>
          )}

          {/* Stream Type Pill */}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isOnline
                ? isDemo
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse'
                : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
            }`}
          >
            {isOnline ? (isDemo ? '🟡 DEMO CCTV FEED' : '🔴 LIVE CCTV') : '⚫ OFFLINE'}
          </span>
        </div>
      </div>

      {/* Video Stream Container */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
        {isOnline ? (
          <video
            ref={videoRef}
            src={junction.cctvUrl}
            autoPlay
            loop
            muted
            playsInline
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center p-6 space-y-2 text-slate-400">
            <AlertCircle size={32} className="mx-auto text-amber-500/70" />
            <p className="text-xs font-bold text-slate-300">Camera feed unavailable</p>
            <p className="text-[10px] text-slate-500 max-w-sm">
              Live IP stream connection to {junction.name} is currently offline or unreachable from this workstation.
            </p>
          </div>
        )}

        {/* Live / Demo Watermark */}
        <div className="absolute top-2 left-2 bg-black/80 border border-white/15 px-2.5 py-1 rounded text-[10px] text-white flex items-center gap-1.5 backdrop-blur-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline
                ? isDemo
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-red-500 animate-pulse'
                : 'bg-slate-500'
            }`}
          />
          <span className="font-bold">
            {isOnline ? (isDemo ? 'DEMO CCTV STREAM' : 'LIVE CCTV STREAM') : 'OFFLINE'}
          </span>
          <span className="text-slate-400">· {junction.id.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
