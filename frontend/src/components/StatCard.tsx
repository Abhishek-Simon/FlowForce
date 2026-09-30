import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  alert?: boolean;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trendValue,
  alert,
}: StatCardProps) {
  return (
    <div
      className={`panel p-3 flex flex-col justify-between ${
        alert ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase font-mono tracking-wider">
            {title}
          </p>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {value}
          </p>
        </div>
        <div
          className={`w-7 h-7 rounded flex items-center justify-center ${
            alert
              ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800'
              : 'bg-slate-100 dark:bg-[#151f33] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#223048]'
          }`}
        >
          <Icon size={14} />
        </div>
      </div>

      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-[#1c273e] flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
        {subtitle && <span className="truncate">{subtitle}</span>}
        {trendValue && (
          <span className="font-semibold text-slate-700 dark:text-slate-300 ml-auto">{trendValue}</span>
        )}
      </div>
    </div>
  );
}
