import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

interface TrafficMapProps {
  cameras: any[];
  metrics: Record<string, any>;
  onSelectCamera: (id: string) => void;
  selectedCamera?: string;
}

const cameraPositions = [
  { id: 'CAM-01', x: 0.35, y: 0.25, label: 'North Junction' },
  { id: 'CAM-02', x: 0.65, y: 0.50, label: 'Central Plaza' },
  { id: 'CAM-03', x: 0.80, y: 0.30, label: 'East Exit' },
  { id: 'CAM-04', x: 0.25, y: 0.70, label: 'South Station' },
];

export default function TrafficMap({ cameras, metrics, onSelectCamera, selectedCamera }: TrafficMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    const isDark = theme === 'dark';

    // Canvas Background
    ctx.fillStyle = isDark ? '#0a0e19' : '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    // Muted structural grid lines
    ctx.strokeStyle = isDark ? '#141d2e' : '#e2e8f0';
    ctx.lineWidth = 14;
    ctx.lineCap = 'square';

    const roads = [
      { x1: 0, y1: H * 0.25, x2: W, y2: H * 0.25 },
      { x1: 0, y1: H * 0.50, x2: W, y2: H * 0.50 },
      { x1: 0, y1: H * 0.70, x2: W, y2: H * 0.70 },
      { x1: W * 0.25, y1: 0, x2: W * 0.25, y2: H },
      { x1: W * 0.55, y1: 0, x2: W * 0.55, y2: H },
      { x1: W * 0.80, y1: 0, x2: W * 0.80, y2: H },
    ];

    roads.forEach((r) => {
      ctx.beginPath();
      ctx.moveTo(r.x1, r.y1);
      ctx.lineTo(r.x2, r.y2);
      ctx.stroke();
    });

    // Camera nodes
    cameraPositions.forEach((pos) => {
      const cx = pos.x * W;
      const cy = pos.y * H;
      const isSelected = pos.id === selectedCamera;
      const metric = metrics[pos.id];
      const isEmergency = metric?.emergency_detected;

      // Outer ring
      ctx.strokeStyle = isEmergency ? '#ef4444' : isSelected ? '#2563eb' : isDark ? '#475569' : '#94a3b8';
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.beginPath();
      ctx.arc(cx, cy, isSelected ? 12 : 8, 0, Math.PI * 2);
      ctx.stroke();

      // Inner dot
      ctx.fillStyle = isEmergency ? '#ef4444' : isSelected ? '#2563eb' : isDark ? '#94a3b8' : '#64748b';
      ctx.beginPath();
      ctx.arc(cx, cy, isSelected ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = isSelected ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#94a3b8' : '#475569');
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pos.id, cx, cy - 14);

      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText(pos.label, cx, cy + 18);
    });
  }, [cameras, metrics, selectedCamera, theme]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    const hit = cameraPositions.find((p) => {
      const dx = p.x - mx,
        dy = p.y - my;
      return Math.sqrt(dx * dx + dy * dy) < 0.08;
    });
    if (hit) onSelectCamera(hit.id);
  };

  return (
    <div className="w-full h-full relative overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onClick={handleClick}
        style={{ display: 'block' }}
      />
    </div>
  );
}
