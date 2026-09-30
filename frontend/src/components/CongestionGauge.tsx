import React from 'react';

interface CongestionGaugeProps {
  score: number;
  level: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function CongestionGauge({ score, level }: CongestionGaugeProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div className="w-full space-y-1.5 font-mono">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px]">Congestion Score</span>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{safeScore}</span>
          <span className="text-slate-400 text-[10px]">/100</span>
          <span className="status-pill-neutral">{level}</span>
        </div>
      </div>

      {/* Clean Monochromatic Progress Bar */}
      <div className="w-full h-2 bg-slate-100 dark:bg-[#141c2e] rounded overflow-hidden border border-slate-200 dark:border-[#202b40]">
        <div
          className="h-full bg-slate-800 dark:bg-slate-300 transition-all duration-300"
          style={{ width: `${safeScore}%` }}
        />
      </div>

      <div className="flex justify-between text-[9px] text-slate-500 font-medium">
        <span>0 (Free Flow)</span>
        <span>50 (Moderate)</span>
        <span>100 (Congested)</span>
      </div>
    </div>
  );
}
