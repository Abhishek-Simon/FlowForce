import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Zap,
  Flame,
  Play,
  Pause,
  Upload,
  RefreshCw,
  Video,
  CheckCircle,
  Activity,
  Car,
  Users,
  Clock,
  Ruler,
  Maximize2,
  Minimize2,
  Search,
} from 'lucide-react';

import { NAGPUR_JUNCTIONS, NagpurJunction } from '../data/nagpurJunctions';
import JunctionSelector from '../components/JunctionSelector';
import CCTVViewer from '../components/CCTVViewer';
import { api } from '../services/api';

interface BBoxDetection {
  track_id: number;
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  is_emergency?: boolean;
}

interface LaneState {
  id: string;
  name: string;
  direction: 'Northbound' | 'Southbound' | 'Eastbound' | 'Westbound';
  videoSrc: string;
  customFile?: File | null;
  vehicleCount: number;
  pedestrianCount: number;
  queueLength: number;
  density: number; // 0 - 100
  pcu: number;
  avgWaitSec: number;
  maxWaitSec: number;
  hasEmergency: boolean;
  emergencyType?: string;
  signalState: 'GREEN' | 'AMBER' | 'RED';
  allocatedGreenSec: number;
  detections: BBoxDetection[];
  frameWidth: number;
  frameHeight: number;
}

const CLASS_COLORS: Record<string, string> = {
  person: '#3b82f6',
  bicycle: '#06b6d4',
  car: '#10b981',
  motorcycle: '#eab308',
  motorbike: '#eab308',
  'three wheeler': '#f59e0b',
  'auto rickshaw': '#f59e0b',
  bus: '#a855f7',
  truck: '#f97316',
  tractor: '#84cc16',
  ambulance: '#ef4444',
  emergency: '#ef4444',
};

export default function IntersectionMatrix() {
  const [junctionsList, setJunctionsList] = useState<NagpurJunction[]>(NAGPUR_JUNCTIONS);
  const [selectedJunction, setSelectedJunction] = useState<NagpurJunction>(NAGPUR_JUNCTIONS[0]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [streamMode, setStreamMode] = useState<'LIVE_AI_STREAM' | 'HTML5_CANVAS'>('LIVE_AI_STREAM');
  const [activeLaneId, setActiveLaneId] = useState<string>('CAM-01');
  const [fullscreenLaneId, setFullscreenLaneId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(25);
  const [controllerMode, setControllerMode] = useState<'ADAPTIVE_AI' | 'EMERGENCY_OVERRIDE'>('ADAPTIVE_AI');
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [isInferencing, setIsInferencing] = useState(false);

  const fileInputRefs = {
    'CAM-01': useRef<HTMLInputElement>(null),
    'CAM-02': useRef<HTMLInputElement>(null),
    'CAM-03': useRef<HTMLInputElement>(null),
    'CAM-04': useRef<HTMLInputElement>(null),
  };

  const videoRefs = {
    'CAM-01': useRef<HTMLVideoElement>(null),
    'CAM-02': useRef<HTMLVideoElement>(null),
    'CAM-03': useRef<HTMLVideoElement>(null),
    'CAM-04': useRef<HTMLVideoElement>(null),
  };

  const canvasRefs = {
    'CAM-01': useRef<HTMLCanvasElement>(null),
    'CAM-02': useRef<HTMLCanvasElement>(null),
    'CAM-03': useRef<HTMLCanvasElement>(null),
    'CAM-04': useRef<HTMLCanvasElement>(null),
  };

  // 4 Lanes State (Initialized to 0 until real ML detection runs)
  const [lanes, setLanes] = useState<LaneState[]>([
    {
      id: 'CAM-01',
      name: 'North Approach (Lane 1)',
      direction: 'Northbound',
      videoSrc: '/samples/sample_traffic.mp4',
      vehicleCount: 0,
      pedestrianCount: 0,
      queueLength: 0,
      density: 0,
      pcu: 0.0,
      avgWaitSec: 0,
      maxWaitSec: 0,
      hasEmergency: false,
      signalState: 'GREEN',
      allocatedGreenSec: 25,
      detections: [],
      frameWidth: 1280,
      frameHeight: 720,
    },
    {
      id: 'CAM-02',
      name: 'South Approach (Lane 2)',
      direction: 'Southbound',
      videoSrc: '/samples/sample_pedestrian.mp4',
      vehicleCount: 0,
      pedestrianCount: 0,
      queueLength: 0,
      density: 0,
      pcu: 0.0,
      avgWaitSec: 0,
      maxWaitSec: 0,
      hasEmergency: false,
      signalState: 'RED',
      allocatedGreenSec: 20,
      detections: [],
      frameWidth: 1280,
      frameHeight: 720,
    },
    {
      id: 'CAM-03',
      name: 'East Corridor (Lane 3)',
      direction: 'Eastbound',
      videoSrc: '/samples/sample_traffic.mp4',
      vehicleCount: 0,
      pedestrianCount: 0,
      queueLength: 0,
      density: 0,
      pcu: 0.0,
      avgWaitSec: 0,
      maxWaitSec: 0,
      hasEmergency: false,
      signalState: 'RED',
      allocatedGreenSec: 20,
      detections: [],
      frameWidth: 1280,
      frameHeight: 720,
    },
    {
      id: 'CAM-04',
      name: 'West Corridor (Lane 4)',
      direction: 'Westbound',
      videoSrc: '/samples/sample_pedestrian.mp4',
      vehicleCount: 0,
      pedestrianCount: 0,
      queueLength: 0,
      density: 0,
      pcu: 0.0,
      avgWaitSec: 0,
      maxWaitSec: 0,
      hasEmergency: false,
      signalState: 'RED',
      allocatedGreenSec: 20,
      detections: [],
      frameWidth: 1280,
      frameHeight: 720,
    },
  ]);

  // Handle Junction Selection Change
  const handleSelectJunction = (j: NagpurJunction) => {
    setSelectedJunction(j);
    if (j.lanes && j.lanes.length === 4) {
      setLanes((prev) =>
        prev.map((lane, idx) => {
          const jLane = j.lanes![idx];
          return {
            ...lane,
            name: `${jLane.name}`,
            videoSrc: jLane.video || lane.videoSrc,
            customFile: null,
            detections: [],
          };
        })
      );
    }
  };

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Animated tracking box state for smooth vehicle motion
  const animatedBoxesRef = useRef<Record<string, Record<string | number, {
    x1: number; y1: number; x2: number; y2: number;
    class_name: string; confidence: number; track_id?: number | null; is_emergency?: boolean;
    lastSeen: number;
  }>>>({});

  // Live Frame Extraction & Telemetry Loop (Smooth HTML5 Video + Real-Time YOLOv8 Inference)
  useEffect(() => {
    if (!isPlaying) return;

    let isPolling = false;
    const inferenceInterval = setInterval(async () => {
      if (isPolling) return;
      isPolling = true;

      for (const lane of lanes) {
        const video = videoRefs[lane.id as keyof typeof videoRefs].current;
        if (!video || video.readyState < 2 || video.paused) continue;

        try {
          const captureCanvas = document.createElement('canvas');
          const vw = video.videoWidth || 640;
          const vh = video.videoHeight || 360;
          captureCanvas.width = 480;
          captureCanvas.height = Math.round((vh / vw) * 480);
          const ctx = captureCanvas.getContext('2d');
          if (!ctx) continue;
          ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

          const blob = await new Promise<Blob | null>((resolve) =>
            captureCanvas.toBlob(resolve, 'image/jpeg', 0.5)
          );
          if (!blob) continue;

          const form = new FormData();
          form.append('file', blob, 'frame.jpg');
          form.append('camera_id', lane.id);
          form.append('conf_threshold', '0.25');

          const res = await fetch(`${API_BASE}/api/traffic/analyze-frame`, {
            method: 'POST',
            body: form,
          });

          if (res.ok) {
            const data = await res.json();
            const rawDets: BBoxDetection[] = data.detections || [];
            const state = data.state || {};
            const isEmgDetected = Boolean(data.emergency_detected);

            // Re-scale detection bounding boxes back to original video dimensions
            const scaleFromCapturedX = vw / captureCanvas.width;
            const scaleFromCapturedY = vh / captureCanvas.height;
            const realDets: BBoxDetection[] = rawDets.map((d) => ({
              ...d,
              bbox: [
                d.bbox[0] * scaleFromCapturedX,
                d.bbox[1] * scaleFromCapturedY,
                d.bbox[2] * scaleFromCapturedX,
                d.bbox[3] * scaleFromCapturedY,
              ] as [number, number, number, number],
            }));

            // Update animated tracking reference with new ground truth positions
            const now = Date.now();
            if (!animatedBoxesRef.current[lane.id]) {
              animatedBoxesRef.current[lane.id] = {};
            }
            const laneBoxes = animatedBoxesRef.current[lane.id];

            realDets.forEach((d, idx) => {
              const key = d.track_id !== null && d.track_id !== undefined ? d.track_id : `temp_${idx}`;
              if (!laneBoxes[key]) {
                laneBoxes[key] = {
                  x1: d.bbox[0],
                  y1: d.bbox[1],
                  x2: d.bbox[2],
                  y2: d.bbox[3],
                  class_name: d.class_name,
                  confidence: d.confidence,
                  track_id: d.track_id,
                  is_emergency: d.is_emergency,
                  lastSeen: now,
                };
              } else {
                laneBoxes[key].class_name = d.class_name;
                laneBoxes[key].confidence = d.confidence;
                laneBoxes[key].is_emergency = d.is_emergency;
                laneBoxes[key].lastSeen = now;
                (laneBoxes[key] as any).targetX1 = d.bbox[0];
                (laneBoxes[key] as any).targetY1 = d.bbox[1];
                (laneBoxes[key] as any).targetX2 = d.bbox[2];
                (laneBoxes[key] as any).targetY2 = d.bbox[3];
              }
            });

            // Prune old boxes
            Object.keys(laneBoxes).forEach((k) => {
              if (now - laneBoxes[k].lastSeen > 1800) {
                delete laneBoxes[k];
              }
            });

            const computedVehicles = realDets.filter((d) => d.class_name !== 'person').length;
            const computedPeds = realDets.filter((d) => d.class_name === 'person').length;
            const realQueue = state.queue_length ?? Math.max(1, Math.round(computedVehicles * 0.45));
            const realDensity = Math.round(state.density_percentage ?? Math.min(100, (computedVehicles / 20) * 100));

            // Compute exact PCU from real detections
            const calculatedPcu = realDets.reduce((acc, d) => {
              if (d.class_name === 'car') return acc + 1.0;
              if (d.class_name === 'motorcycle' || d.class_name === 'motorbike') return acc + 0.5;
              if (d.class_name === 'bus') return acc + 3.5;
              if (d.class_name === 'truck') return acc + 3.5;
              return acc + 1.0;
            }, 0);

            const realPcu = Math.round(calculatedPcu * 10) / 10 || (computedVehicles > 0 ? computedVehicles : 0);
            const realAvgWait = Math.round(state.avg_waiting_time_sec ?? (realQueue * 2.8));
            const realMaxWait = Math.round(state.max_waiting_time_sec ?? (realAvgWait * 1.6));

            setLanes((prev) =>
              prev.map((l) => {
                if (l.id === lane.id) {
                  return {
                    ...l,
                    vehicleCount: computedVehicles,
                    pedestrianCount: computedPeds,
                    queueLength: realQueue,
                    density: realDensity,
                    pcu: realPcu,
                    avgWaitSec: realAvgWait,
                    maxWaitSec: realMaxWait,
                    hasEmergency: isEmgDetected,
                    detections: realDets,
                    frameWidth: vw,
                    frameHeight: vh,
                  };
                }
                return l;
              })
            );
          }
        } catch (err) {}
      }

      isPolling = false;
    }, 400);

    return () => clearInterval(inferenceInterval);
  }, [isPlaying, lanes]);

  // Canvas Bounding Box Rendering Loop with Smooth Movement Interpolation
  useEffect(() => {
    let animationFrameId: number;

    const renderOverlayBoxes = () => {
      lanes.forEach((lane) => {
        const canvas = canvasRefs[lane.id as keyof typeof canvasRefs].current;
        const video = videoRefs[lane.id as keyof typeof videoRefs].current;
        if (!canvas || !video) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        if (canvas.width !== W || canvas.height !== H) {
          canvas.width = W;
          canvas.height = H;
        }

        ctx.clearRect(0, 0, W, H);

        if (!showBoundingBoxes) return;

        const scaleX = W / (lane.frameWidth || 1280);
        const scaleY = H / (lane.frameHeight || 720);

        const laneBoxes = animatedBoxesRef.current[lane.id] || {};
        const now = Date.now();

        Object.values(laneBoxes).forEach((b: any) => {
          if (now - b.lastSeen > 1600) return;

          // Smooth interpolation (lerp) towards target coordinates
          if (b.targetX1 !== undefined) {
            b.x1 += (b.targetX1 - b.x1) * 0.25;
            b.y1 += (b.targetY1 - b.y1) * 0.25;
            b.x2 += (b.targetX2 - b.x2) * 0.25;
            b.y2 += (b.targetY2 - b.y2) * 0.25;
          }

          const bx = b.x1 * scaleX;
          const by = b.y1 * scaleY;
          const bw = (b.x2 - b.x1) * scaleX;
          const bh = (b.y2 - b.y1) * scaleY;

          const color = b.is_emergency
            ? CLASS_COLORS.emergency
            : CLASS_COLORS[b.class_name] || '#10b981';

          // Box outline
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, bw, bh);

          // Corner accents
          const bl = Math.min(8, bw * 0.25, bh * 0.25);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(bx, by + bl); ctx.lineTo(bx, by); ctx.lineTo(bx + bl, by);
          ctx.moveTo(bx + bw - bl, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + bl);
          ctx.moveTo(bx, by + bh - bl); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + bl, by + bh);
          ctx.moveTo(bx + bw - bl, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - bl);
          ctx.stroke();

          // Form label
          const idPrefix = b.track_id !== undefined && b.track_id !== null ? `ID:${b.track_id} ` : '';
          const labelText = `${b.is_emergency ? '🚨 EMG' : b.class_name} ${idPrefix}${Math.round(b.confidence * 100)}%`;
          
          ctx.font = 'bold 10px monospace';
          const textMetric = ctx.measureText(labelText);
          const textW = textMetric.width + 8;
          const textH = 14;

          const labelY = by >= textH + 4 ? by - textH : by + 2;
          
          ctx.fillStyle = color;
          ctx.fillRect(bx, labelY, textW, textH);

          ctx.fillStyle = '#ffffff';
          ctx.fillText(labelText, bx + 4, labelY + 11);
        });
      });

      animationFrameId = requestAnimationFrame(renderOverlayBoxes);
    };

    animationFrameId = requestAnimationFrame(renderOverlayBoxes);
    return () => cancelAnimationFrame(animationFrameId);
  }, [lanes, showBoundingBoxes]);

  // Load active persisted camera sources from SQLite DB on mount
  useEffect(() => {
    const loadPersistedSources = async () => {
      try {
        const cams = await api.getCameras();
        if (cams && cams.length > 0) {
          const camMap: Record<string, string> = {};
          cams.forEach((c: any) => {
            if (c.source_url) {
              camMap[c.id] = c.source_url.startsWith('http') || c.source_url.startsWith('/')
                ? c.source_url
                : `/${c.source_url}`;
            }
          });

          setLanes((prev) =>
            prev.map((l) => {
              if (camMap[l.id]) {
                return {
                  ...l,
                  videoSrc: camMap[l.id],
                };
              }
              return l;
            })
          );
        }
      } catch (err) {}
    };

    loadPersistedSources();
  }, []);

  // Video Fit Handler with permanent Database persistence
  const handleFitCustomVideo = async (laneId: string, file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setLanes((prev) =>
      prev.map((l) => {
        if (l.id === laneId) {
          return {
            ...l,
            videoSrc: objectUrl,
            customFile: file,
            vehicleCount: 0,
            pedestrianCount: 0,
            queueLength: 0,
            density: 0,
            pcu: 0.0,
            detections: [],
            avgWaitSec: 0,
            maxWaitSec: 0,
            hasEmergency: false,
          };
        }
        return l;
      })
    );

    // Save uploaded video file to server storage & persist source_url in SQLite Database
    try {
      await api.uploadCameraSource(laneId, file);
    } catch (err) {
      console.warn(`[IntersectionMatrix] Could not save fitted video for ${laneId} to DB:`, err);
    }
  };

  // Signal Decision Algorithm
  const evaluateNextBestLane = (currentLanes: LaneState[], currentActiveId: string): string => {
    const emergencyLane = currentLanes.find((l) => l.hasEmergency);
    if (emergencyLane) return emergencyLane.id;

    const otherLanes = currentLanes.filter((l) => l.id !== currentActiveId);
    let bestLane = otherLanes[0];
    let maxDemandScore = -1;

    otherLanes.forEach((lane) => {
      const score =
        lane.density * 0.45 + lane.queueLength * 6.0 + lane.avgWaitSec * 1.6 + lane.pedestrianCount * 1.5;
      if (score > maxDemandScore) {
        maxDemandScore = score;
        bestLane = lane;
      }
    });

    return bestLane ? bestLane.id : currentLanes[0].id;
  };

  // Real-World Signal Cycle Loop: Option A (4s AMBER + 1s ALL-RED clearance)
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        // Step 1: When countdown hits 5s, transition active green lane to AMBER/YELLOW for 4 seconds
        if (prev === 5) {
          setLanes((currLanes) =>
            currLanes.map((l) => ({
              ...l,
              signalState: l.id === activeLaneId ? ('AMBER' as const) : ('RED' as const),
            }))
          );
          return prev - 1;
        }

        // Step 2: When countdown hits 1s, transition all lanes to ALL-RED clearance for 1 second
        if (prev === 1) {
          setLanes((currLanes) =>
            currLanes.map((l) => ({
              ...l,
              signalState: 'RED' as const,
            }))
          );
          return prev - 1;
        }

        // Step 3: When countdown hits 0s, evaluate demand and award GREEN to next best approach
        if (prev <= 0) {
          setLanes((currLanes) => {
            const nextLaneId = evaluateNextBestLane(currLanes, activeLaneId);
            setActiveLaneId(nextLaneId);

            const nextLane = currLanes.find((l) => l.id === nextLaneId);
            const isEmg = nextLane?.hasEmergency ?? false;
            setControllerMode(isEmg ? 'EMERGENCY_OVERRIDE' : 'ADAPTIVE_AI');

            // Dynamic green time proportional to demand (15s to 35s)
            const demandQ = nextLane ? nextLane.queueLength : 4;
            const allocatedTime = isEmg ? 45 : Math.max(15, Math.min(35, 12 + demandQ * 3));

            return currLanes.map((l) => ({
              ...l,
              signalState: l.id === nextLaneId ? ('GREEN' as const) : ('RED' as const),
              allocatedGreenSec: allocatedTime,
              avgWaitSec: l.id === nextLaneId ? 0 : l.avgWaitSec + 3,
            }));
          });

          // Reset timer with next lane's allocated time
          return 25;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, activeLaneId]);

  // Emergency injection with Safe Indian Standard transition (Option A)
  const toggleEmergencyOnLane = (laneId: string) => {
    setLanes((prev) => {
      const updated = prev.map((l) => {
        if (l.id === laneId) {
          const nextEmg = !l.hasEmergency;
          return {
            ...l,
            hasEmergency: nextEmg,
            emergencyType: nextEmg ? 'Ambulance (EMS-911)' : undefined,
          };
        }
        return l;
      });

      const target = updated.find((l) => l.id === laneId);
      if (target?.hasEmergency) {
        // If target lane is not already green, initiate safe 5-second amber clearance before granting full green
        if (laneId !== activeLaneId) {
          // Give current lane amber warning so traffic stops safely
          setCountdown(5);
          setControllerMode('EMERGENCY_OVERRIDE');
          return updated.map((l) => ({
            ...l,
            signalState: l.id === activeLaneId ? ('AMBER' as const) : ('RED' as const),
          }));
        } else {
          setActiveLaneId(laneId);
          setCountdown(45);
          setControllerMode('EMERGENCY_OVERRIDE');
          return updated.map((l) => ({
            ...l,
            signalState: l.id === laneId ? ('GREEN' as const) : ('RED' as const),
          }));
        }
      } else {
        setControllerMode('ADAPTIVE_AI');
      }
      return updated;
    });
  };

  const activeLane = lanes.find((l) => l.id === activeLaneId) || lanes[0];

  const [junctionMenuOpen, setJunctionMenuOpen] = useState(false);
  const [junctionSearchQuery, setJunctionSearchQuery] = useState('');

  const filteredJunctions = junctionsList.filter(
    (j) =>
      j.name.toLowerCase().includes(junctionSearchQuery.toLowerCase()) ||
      j.id.toLowerCase().includes(junctionSearchQuery.toLowerCase()) ||
      j.area.toLowerCase().includes(junctionSearchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono">
      {/* Unified Compact Command & Junction Header Bar */}
      <div className="panel p-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
        {/* Left: Searchable Junction Selector Dropdown & Current Signal Phase */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setJunctionMenuOpen(!junctionMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#151f33] hover:bg-slate-200 dark:hover:bg-[#1c2a44] border border-slate-300 dark:border-[#223048] text-slate-800 dark:text-slate-200 text-xs font-bold font-mono transition-colors shadow-xs cursor-pointer"
            >
              <Layers size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{selectedJunction.name}</span>
              <span className="text-[10px] text-slate-400 font-mono">({selectedJunction.id})</span>
              <span className="text-[9px] text-slate-400 ml-1">▼</span>
            </button>

            {/* Custom Searchable Junction Dropdown Menu */}
            {junctionMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-[#0e1422] border border-slate-200 dark:border-[#1c273e] rounded-lg shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048] rounded mb-1.5">
                  <Search size={12} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search chowk or area..."
                    value={junctionSearchQuery}
                    onChange={(e) => setJunctionSearchQuery(e.target.value)}
                    className="w-full text-xs bg-transparent text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400"
                    autoFocus
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {filteredJunctions.map((junc) => (
                    <button
                      key={junc.id}
                      onClick={() => {
                        handleSelectJunction(junc);
                        setJunctionMenuOpen(false);
                        setJunctionSearchQuery('');
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#151f33] transition-colors cursor-pointer ${
                        selectedJunction.id === junc.id
                          ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/40'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div>
                        <p className="font-semibold">{junc.name}</p>
                        <p className="text-[10px] text-slate-400">{junc.area}</p>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1b273d] text-slate-600 dark:text-slate-400">
                        {junc.id}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

          {/* Active Phase Pill */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                activeLane.hasEmergency
                  ? 'bg-red-500 animate-ping'
                  : activeLane.signalState === 'AMBER'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {activeLane.signalState === 'GREEN'
                ? `ACTIVE: ${activeLane.name}`
                : activeLane.signalState === 'AMBER'
                ? `AMBER: ${activeLane.name}`
                : 'ALL-RED CLEARANCE'}
            </span>
          </div>
        </div>

        {/* Right: Controls & Countdown Timer */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
            className="btn-secondary py-1 text-[11px]"
          >
            {showBoundingBoxes ? 'BOXES: ON' : 'BOXES: OFF'}
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="btn-secondary py-1 text-[11px]"
          >
            {isPlaying ? <Pause size={11} /> : <Play size={11} />} {isPlaying ? 'PAUSE' : 'RESUME'}
          </button>

          {/* Countdown Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048] rounded font-bold">
            <span className="text-[10px] text-slate-400 uppercase">
              {activeLane.signalState === 'AMBER' ? 'AMBER' : 'TIMER'}:
            </span>
            <span
              className={`text-sm font-mono tabular-nums ${
                activeLane.signalState === 'AMBER'
                  ? 'text-amber-500'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {countdown}s
            </span>
          </div>
        </div>
      </div>

      {/* 4 REAL-TIME VIDEO SCREEN LANES (2x2 Grid or Single Fullscreen View) */}
      <div className={`grid gap-3.5 ${fullscreenLaneId ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
        {lanes
          .filter((lane) => !fullscreenLaneId || lane.id === fullscreenLaneId)
          .map((lane) => {
            const isGreen = lane.id === activeLaneId;
            const isFullscreen = fullscreenLaneId === lane.id;
            const fileInput = fileInputRefs[lane.id as keyof typeof fileInputRefs];
            const videoRef = videoRefs[lane.id as keyof typeof videoRefs];
            const canvasRef = canvasRefs[lane.id as keyof typeof canvasRefs];
            const queueMeters = lane.queueLength * 5.2; // approx 5.2 meters per car queue length

            return (
              <div
                key={lane.id}
                className={`panel relative overflow-hidden transition-all duration-200 ${
                  isGreen
                    ? 'border-emerald-500 ring-2 ring-emerald-500/25 shadow-md'
                    : lane.hasEmergency
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                    : ''
                }`}
              >
                {/* Lane Header Bar */}
                <div className="panel-header">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isGreen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                      }`}
                    />
                    <span className="text-slate-900 dark:text-white text-xs font-bold uppercase">{lane.name}</span>
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">({lane.direction})</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="file"
                      ref={fileInput}
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFitCustomVideo(lane.id, e.target.files[0]);
                        }
                      }}
                    />

                    <button
                      onClick={() => fileInput.current?.click()}
                      className="text-[10px] px-2 py-0.5 rounded font-mono bg-blue-50 dark:bg-[#151f33] hover:bg-blue-100 dark:hover:bg-[#1c2a44] text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 flex items-center gap-1 transition-colors"
                      title="Upload video for this lane"
                    >
                      <Upload size={10} /> FIT VIDEO
                    </button>

                    <button
                      onClick={() => toggleEmergencyOnLane(lane.id)}
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border transition-colors ${
                        lane.hasEmergency
                          ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-700'
                          : 'bg-slate-100 dark:bg-[#151f33] text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 border-slate-200 dark:border-[#243350]'
                      }`}
                    >
                      {lane.hasEmergency ? '🚨 CLEAR EMG' : '+ INJECT EMG'}
                    </button>

                    {/* Maximize / Minimize Fullscreen Button */}
                    <button
                      onClick={() => setFullscreenLaneId(isFullscreen ? null : lane.id)}
                      className={`p-1 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                        isFullscreen
                          ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 hover:bg-orange-500/30'
                          : 'bg-slate-100 dark:bg-[#151f33] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1c2a44] border-slate-200 dark:border-[#243350]'
                      }`}
                      title={isFullscreen ? 'Exit Fullscreen (Show all 4 lanes)' : 'Expand to Fullscreen view'}
                    >
                      {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                  </div>
                </div>

              {/* Video Player Container (Smooth 60 FPS HTML5 Video + Real-Time YOLOv8 Canvas Overlay) */}
              <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={lane.videoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
                />

                {/* Real-Time Live AI Canvas Layer Overlay */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />

                {/* CCTV Top Corner Watermark */}
                <div className="absolute top-2 left-2 bg-black/80 border border-white/15 px-2 py-1 rounded text-[10px] text-white flex items-center gap-1.5 pointer-events-none backdrop-blur-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${isGreen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                  <span className="font-bold">{lane.id}</span>
                  <span className="text-emerald-400 text-[9px] font-bold">· LIVE AI DETECTOR</span>
                </div>

                {/* Signal Light Tag in Top Right with 3-Phase Display */}
                <div className="absolute top-2 right-2 pointer-events-none">
                  <span
                    className={`font-bold text-xs shadow-md px-2 py-0.5 rounded border ${
                      lane.signalState === 'GREEN'
                        ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/50 animate-pulse'
                        : lane.signalState === 'AMBER'
                        ? 'bg-amber-500/30 text-amber-300 border-amber-500/60 animate-bounce'
                        : 'bg-red-500/25 text-red-400 border-red-500/50'
                    }`}
                  >
                    {lane.signalState === 'GREEN'
                      ? '🟢 GREEN'
                      : lane.signalState === 'AMBER'
                      ? '🟡 AMBER (3s)'
                      : '🔴 RED'}
                  </span>
                </div>

                {/* Emergency Overlay Banner */}
                {lane.hasEmergency && (
                  <div className="absolute inset-0 bg-red-950/50 border-4 border-red-600 flex items-center justify-center pointer-events-none">
                    <div className="bg-[#090d16] border border-red-600 px-3 py-1.5 rounded text-center">
                      <p className="text-red-400 font-bold text-xs animate-pulse">
                        🚨 EMERGENCY VEHICLE DETECTED
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Dedicated Telemetry Strip */}
              <div className="p-2.5 bg-slate-50 dark:bg-[#121a2d] border-t border-slate-200 dark:border-[#1c273e] space-y-2">
                {/* Top Metrics Row: Vehicles | PCU | Queue Length | Avg Wait */}
                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  {/* Vehicle Count */}
                  <div className="p-1.5 rounded bg-white dark:bg-[#090d16] border border-slate-200 dark:border-[#1c273e]">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold block">Vehicles</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {lane.vehicleCount}
                    </p>
                  </div>

                  {/* PCU Load */}
                  <div className="p-1.5 rounded bg-white dark:bg-[#090d16] border border-slate-200 dark:border-[#1c273e]">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold block">PCU</span>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                      {lane.pcu.toFixed(1)}
                    </p>
                  </div>

                  {/* Queue Length */}
                  <div className="p-1.5 rounded bg-white dark:bg-[#090d16] border border-slate-200 dark:border-[#1c273e]">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold block">Queue</span>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                      {lane.queueLength} <span className="text-[10px] text-slate-400 font-normal">({queueMeters.toFixed(0)}m)</span>
                    </p>
                  </div>

                  {/* Average Wait Time */}
                  <div className="p-1.5 rounded bg-white dark:bg-[#090d16] border border-slate-200 dark:border-[#1c273e]">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold block">Avg Wait</span>
                    <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5 tabular-nums">
                      {lane.avgWaitSec}s
                    </p>
                  </div>
                </div>

                {/* Live Vehicle Type Breakdown Row (Clean Monochromatic in Light Mode) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono">
                  <span className="text-slate-500 dark:text-slate-400 font-bold uppercase">Classes:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048] text-slate-700 dark:text-slate-300 font-medium">
                    🚗 {lane.detections.filter((d) => d.class_name === 'car').length} Cars
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048] text-slate-700 dark:text-slate-300 font-medium">
                    🏍️ {lane.detections.filter((d) => d.class_name === 'motorcycle' || d.class_name === 'motorbike').length} Motos
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048] text-slate-700 dark:text-slate-300 font-medium">
                    🚌 {lane.detections.filter((d) => d.class_name === 'bus').length} Buses
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048] text-slate-700 dark:text-slate-300 font-medium">
                    🚛 {lane.detections.filter((d) => d.class_name === 'truck').length} Trucks
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048] text-slate-700 dark:text-slate-300 font-medium">
                    🛺 {lane.detections.filter((d) => d.class_name === 'three wheeler' || d.class_name === 'bicycle' || d.class_name === 'tractor').length} Other
                  </span>
                  {lane.detections.some((d) => d.is_emergency || d.class_name === 'ambulance') && (
                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400 font-bold animate-pulse">
                      🚑 {lane.detections.filter((d) => d.is_emergency || d.class_name === 'ambulance').length} EMG
                    </span>
                  )}
                </div>

                {/* Bottom Density Bar + Demand Score */}
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <div className="flex items-center gap-2 flex-1 mr-4">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold shrink-0">
                      Lane Occupancy:
                    </span>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-[#1c273e] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          lane.density > 75
                            ? 'bg-red-500'
                            : lane.density > 50
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${lane.density}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] shrink-0 font-mono">
                    <span className="text-slate-500 dark:text-slate-400">WAIT: <strong className="text-slate-900 dark:text-white">{lane.avgWaitSec}s</strong></span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-slate-500 dark:text-slate-400">DEMAND: <strong className="text-slate-900 dark:text-white">{(lane.density * 0.45 + lane.queueLength * 6.0).toFixed(0)} PTS</strong></span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
