import React, { useEffect, useState, useRef } from 'react';
import { Zap, RefreshCw, Layers, Shield, Clock, AlertCircle, Play, Sliders, CheckCircle2, Flame, ArrowRight, Activity, Car, Ruler, Maximize2, Minimize2 } from 'lucide-react';
import { api } from '../services/api';

export default function SignalPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'LIVE' | 'SIMULATION' | 'NETWORK' | 'PREDICTIVE'>('LIVE');
  const [currentPhase, setCurrentPhase] = useState<string>('NORTH_SOUTH');
  const [currentGreen, setCurrentGreen] = useState<number>(30);
  const [liveRecommendation, setLiveRecommendation] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Simulation Traffic State Inputs
  const [simInputs, setSimInputs] = useState({
    north: { vehicles: 35, pcu: 80.0, queue_length: 18, average_wait: 24, arrival_rate: 28.0 },
    south: { vehicles: 12, pcu: 20.0, queue_length: 5, average_wait: 10, arrival_rate: 12.0 },
    east: { vehicles: 8, pcu: 10.0, queue_length: 2, average_wait: 6, arrival_rate: 8.0 },
    west: { vehicles: 4, pcu: 5.0, queue_length: 1, average_wait: 4, arrival_rate: 5.0 },
  });
  const [simRecommendation, setSimRecommendation] = useState<any>(null);

  // Predictive Optimization State
  const [predictiveResult, setPredictiveResult] = useState<any>(null);
  const [blendWeights, setBlendWeights] = useState({ current: 0.65, predicted: 0.35 });

  // Network Multi-Junction State (9 Interconnected Nagpur 8-Lane Corridors - 3x3 Grid Mesh)
  // Each junction operates in realistic 4-approach single-lane green cycle: NORTH -> EAST -> SOUTH -> WEST
  const [selectedJunctionId, setSelectedJunctionId] = useState<string>('J5');
  const [isSimRunning, setIsSimRunning] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [simTick, setSimTick] = useState<number>(0);
  const [networkData, setNetworkData] = useState<any>(null);
  const [networkSimJunctions, setNetworkSimJunctions] = useState<any>({
    J1: { id: 'J1', name: 'J1: Kadbi Chowk', row: 1, col: 1, pcu: 58.0, queue: 8, wait: 12, phase: 'NORTH', green: 15, timeLeft: 12 },
    J2: { id: 'J2', name: 'J2: RBI Square', row: 1, col: 2, pcu: 72.5, queue: 12, wait: 16, phase: 'EAST', green: 18, timeLeft: 14 },
    J3: { id: 'J3', name: 'J3: Mayo Hospital Sq', row: 1, col: 3, pcu: 48.0, queue: 6, wait: 10, phase: 'SOUTH', green: 14, timeLeft: 8 },
    J4: { id: 'J4', name: 'J4: Law College Sq', row: 2, col: 1, pcu: 64.0, queue: 10, wait: 14, phase: 'WEST', green: 16, timeLeft: 11 },
    J5: { id: 'J5', name: 'J5: Variety Square (Center Hub)', row: 2, col: 2, pcu: 98.0, queue: 26, wait: 44, phase: 'NORTH', green: 22, timeLeft: 19 },
    J6: { id: 'J6', name: 'J6: Sitabuldi Chowk', row: 2, col: 3, pcu: 86.5, queue: 18, wait: 28, phase: 'SOUTH', green: 18, timeLeft: 13 },
    J7: { id: 'J7', name: 'J7: Shankar Nagar Sq', row: 3, col: 1, pcu: 44.0, queue: 5, wait: 9, phase: 'EAST', green: 14, timeLeft: 9 },
    J8: { id: 'J8', name: 'J8: Rahate Colony Sq', row: 3, col: 2, pcu: 68.0, queue: 11, wait: 15, phase: 'WEST', green: 16, timeLeft: 10 },
    J9: { id: 'J9', name: 'J9: Medical Square', row: 3, col: 3, pcu: 56.0, queue: 8, wait: 13, phase: 'NORTH', green: 15, timeLeft: 12 },
  });

  // Dense Multi-Class Vehicle Fleet (Realistic Traffic: Normal Cars, City Buses, and 1 Dedicated Emergency Ambulance)
  const [vehicles, setVehicles] = useState<any[]>([
    // Column 1 (x=180: Kadbi -> Law College -> Shankar Nagar)
    { id: 'v1', type: 'car', dir: 'south', col: 180, x: 168, y: 40, speed: 2.3, color: '#38bdf8', turn: 'left' },
    { id: 'v2', type: 'car', dir: 'south', col: 180, x: 168, y: 110, speed: 2.1, color: '#34d399', turn: 'straight' },
    { id: 'v3', type: 'bus', dir: 'south', col: 180, x: 168, y: 340, speed: 1.6, color: '#f59e0b', length: 28, turn: 'right' },
    { id: 'v4', type: 'car', dir: 'south', col: 180, x: 168, y: 640, speed: 2.2, color: '#60a5fa', turn: 'straight' },
    { id: 'v5', type: 'car', dir: 'north', col: 180, x: 194, y: 860, speed: 2.4, color: '#38bdf8', turn: 'right' },
    { id: 'v6', type: 'bus', dir: 'north', col: 180, x: 194, y: 690, speed: 1.7, color: '#fbbf24', length: 26, turn: 'straight' },
    { id: 'v7', type: 'car', dir: 'north', col: 180, x: 194, y: 410, speed: 2.2, color: '#a78bfa', turn: 'left' },
    { id: 'v8', type: 'car', dir: 'north', col: 180, x: 194, y: 130, speed: 2.0, color: '#60a5fa', turn: 'straight' },

    // Column 2 (x=480: RBI -> Variety Square Hub -> Rahate Colony)
    { id: 'v9', type: 'car', dir: 'south', col: 480, x: 468, y: 30, speed: 2.4, color: '#38bdf8', turn: 'straight' },
    { id: 'v10', type: 'bus', dir: 'south', col: 480, x: 468, y: 100, speed: 1.6, color: '#f59e0b', length: 28, turn: 'left' },
    { id: 'v11', type: 'car', dir: 'south', col: 480, x: 468, y: 320, speed: 2.3, color: '#34d399', turn: 'straight' },
    { id: 'v12', type: 'car', dir: 'south', col: 480, x: 468, y: 620, speed: 2.3, color: '#34d399', turn: 'right' },
    // 🚑 The 1 Single Live Emergency Ambulance Patrol on the Map:
    { id: 'v13', type: 'ambulance', dir: 'north', col: 480, x: 494, y: 780, speed: 3.4, color: '#ef4444', turn: 'straight', siren: true },
    { id: 'v14', type: 'bus', dir: 'north', col: 480, x: 494, y: 840, speed: 1.7, color: '#fbbf24', length: 28, turn: 'left' },
    { id: 'v15', type: 'car', dir: 'north', col: 480, x: 494, y: 560, speed: 2.4, color: '#38bdf8', turn: 'straight' },
    { id: 'v16', type: 'car', dir: 'north', col: 480, x: 494, y: 400, speed: 2.2, color: '#a78bfa', turn: 'right' },
    { id: 'v17', type: 'car', dir: 'north', col: 480, x: 494, y: 240, speed: 2.3, color: '#60a5fa', turn: 'straight' },

    // Column 3 (x=780: Mayo -> Sitabuldi -> Medical Square)
    { id: 'v18', type: 'car', dir: 'south', col: 780, x: 768, y: 60, speed: 2.2, color: '#38bdf8', turn: 'right' },
    { id: 'v19', type: 'bus', dir: 'south', col: 780, x: 768, y: 240, speed: 1.6, color: '#f59e0b', length: 26, turn: 'straight' },
    { id: 'v20', type: 'car', dir: 'south', col: 780, x: 768, y: 540, speed: 2.3, color: '#34d399', turn: 'left' },
    { id: 'v21', type: 'car', dir: 'south', col: 780, x: 768, y: 720, speed: 2.1, color: '#60a5fa', turn: 'straight' },
    { id: 'v22', type: 'car', dir: 'north', col: 780, x: 794, y: 850, speed: 2.4, color: '#38bdf8', turn: 'straight' },
    { id: 'v23', type: 'bus', dir: 'north', col: 794, x: 794, y: 610, speed: 1.7, color: '#fbbf24', length: 28, turn: 'right' },
    { id: 'v24', type: 'car', dir: 'north', col: 780, x: 794, y: 360, speed: 2.4, color: '#38bdf8', turn: 'straight' },
    { id: 'v25', type: 'car', dir: 'north', col: 780, x: 794, y: 130, speed: 2.0, color: '#a78bfa', turn: 'left' },

    // Row 1 (y=180: Kadbi <-> RBI <-> Mayo)
    { id: 'v26', type: 'car', dir: 'east', row: 180, x: 40, y: 168, speed: 2.3, color: '#38bdf8', turn: 'right' },
    { id: 'v27', type: 'bus', dir: 'east', row: 180, x: 260, y: 168, speed: 1.6, color: '#f59e0b', length: 26, turn: 'straight' },
    { id: 'v28', type: 'car', dir: 'east', row: 180, x: 560, y: 168, speed: 2.4, color: '#34d399', turn: 'left' },
    { id: 'v29', type: 'car', dir: 'west', row: 180, x: 860, y: 194, speed: 2.3, color: '#38bdf8', turn: 'straight' },
    { id: 'v30', type: 'car', dir: 'west', row: 180, x: 620, y: 194, speed: 2.2, color: '#a78bfa', turn: 'left' },
    { id: 'v31', type: 'car', dir: 'west', row: 180, x: 340, y: 194, speed: 2.1, color: '#60a5fa', turn: 'straight' },

    // Row 2 (y=480: Law College <-> Variety Hub <-> Sitabuldi Arterial)
    { id: 'v32', type: 'bus', dir: 'east', row: 480, x: 50, y: 468, speed: 1.6, color: '#f59e0b', length: 28, turn: 'right' },
    { id: 'v33', type: 'car', dir: 'east', row: 480, x: 220, y: 468, speed: 2.5, color: '#38bdf8', turn: 'straight' },
    { id: 'v34', type: 'car', dir: 'east', row: 480, x: 630, y: 468, speed: 2.2, color: '#34d399', turn: 'straight' },
    { id: 'v35', type: 'car', dir: 'west', row: 480, x: 870, y: 494, speed: 2.4, color: '#38bdf8', turn: 'left' },
    { id: 'v36', type: 'bus', dir: 'west', row: 480, x: 670, y: 494, speed: 1.7, color: '#fbbf24', length: 28, turn: 'straight' },
    { id: 'v37', type: 'car', dir: 'west', row: 480, x: 390, y: 494, speed: 2.3, color: '#a78bfa', turn: 'right' },

    // Row 3 (y=780: Shankar <-> Rahate <-> Medical Square)
    { id: 'v38', type: 'car', dir: 'east', row: 780, x: 60, y: 768, speed: 2.2, color: '#38bdf8', turn: 'straight' },
    { id: 'v39', type: 'car', dir: 'east', row: 780, x: 250, y: 768, speed: 2.0, color: '#60a5fa', turn: 'left' },
    { id: 'v40', type: 'bus', dir: 'east', row: 780, x: 570, y: 768, speed: 1.6, color: '#f59e0b', length: 26, turn: 'right' },
    { id: 'v41', type: 'car', dir: 'west', row: 780, x: 860, y: 794, speed: 2.4, color: '#34d399', turn: 'straight' },
    { id: 'v42', type: 'car', dir: 'west', row: 780, x: 290, y: 794, speed: 2.2, color: '#a78bfa', turn: 'straight' },
  ]);

  // Mutable state reference to prevent React stale closure locks during high-frequency animation
  const junctionsRef = useRef(networkSimJunctions);
  const vehiclesRef = useRef(vehicles);

  useEffect(() => {
    junctionsRef.current = networkSimJunctions;
  }, [networkSimJunctions]);

  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  // High-Precision Real-Time Clock & Synchronized Network Simulation Loop
  useEffect(() => {
    if (!isSimRunning) return;

    const phases = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
    const junctionCenters = [180, 480, 780];
    const stopDist = 48;

    // 1. Dedicated 1-Second Signal Countdown Clock & Density-Based Signal Optimization
    const timerInterval = setInterval(() => {
      setNetworkSimJunctions((prevJunctions: any) => {
        const next: any = {};
        const curVehicles = vehiclesRef.current;

        Object.keys(prevJunctions).forEach((k) => {
          const j = { ...prevJunctions[k] };
          let updated = (j.timeLeft || 15) - 1;

          // Compute LIVE approaching vehicles in the active green approach of this junction
          const jColPos = j.col === 1 ? 180 : j.col === 2 ? 480 : 780;
          const jRowPos = j.row === 1 ? 180 : j.row === 2 ? 480 : 780;

          // Count vehicles currently approaching or queued at this junction
          let activeApproachVehicles = 0;
          let activeApproachPCU = 0;

          curVehicles.forEach((veh) => {
            if (j.phase === 'NORTH' && veh.dir === 'south' && veh.col === jColPos && veh.y < jRowPos && (jRowPos - veh.y) < 180) {
              activeApproachVehicles++;
              activeApproachPCU += veh.type === 'bus' ? 2.5 : veh.type === 'ambulance' ? 3.0 : 1.0;
            } else if (j.phase === 'SOUTH' && veh.dir === 'north' && veh.col === jColPos && veh.y > jRowPos && (veh.y - jRowPos) < 180) {
              activeApproachVehicles++;
              activeApproachPCU += veh.type === 'bus' ? 2.5 : veh.type === 'ambulance' ? 3.0 : 1.0;
            } else if (j.phase === 'WEST' && veh.dir === 'east' && veh.row === jRowPos && veh.x < jColPos && (jColPos - veh.x) < 180) {
              activeApproachVehicles++;
              activeApproachPCU += veh.type === 'bus' ? 2.5 : veh.type === 'ambulance' ? 3.0 : 1.0;
            } else if (j.phase === 'EAST' && veh.dir === 'west' && veh.row === jRowPos && veh.x > jColPos && (veh.x - jColPos) < 180) {
              activeApproachVehicles++;
              activeApproachPCU += veh.type === 'bus' ? 2.5 : veh.type === 'ambulance' ? 3.0 : 1.0;
            }
          });

          // Real-World Signal Stability Floor:
          // Guaranteed Minimum Green floor of 10s prevents rapid flickering/switching
          // When 4-5 cars are waiting, gives full 16-24s clearance time
          if (updated <= 0) {
            const curIdx = phases.indexOf(j.phase || 'NORTH');
            const nextIdx = (curIdx + 1) % 4;
            const nextPhase = phases[nextIdx];
            j.phase = nextPhase;

            // Compute actual incoming demand for the new phase
            let incomingVehicles = 0;
            let incomingPCU = 0;
            curVehicles.forEach((veh) => {
              if (nextPhase === 'NORTH' && veh.dir === 'south' && veh.col === jColPos && veh.y < jRowPos && (jRowPos - veh.y) < 240) {
                incomingVehicles++;
                incomingPCU += veh.type === 'bus' ? 2.5 : 1.0;
              } else if (nextPhase === 'SOUTH' && veh.dir === 'north' && veh.col === jColPos && veh.y > jRowPos && (veh.y - jRowPos) < 240) {
                incomingVehicles++;
                incomingPCU += veh.type === 'bus' ? 2.5 : 1.0;
              } else if (nextPhase === 'WEST' && veh.dir === 'east' && veh.row === jRowPos && veh.x < jColPos && (jColPos - veh.x) < 240) {
                incomingVehicles++;
                incomingPCU += veh.type === 'bus' ? 2.5 : 1.0;
              } else if (nextPhase === 'EAST' && veh.dir === 'west' && veh.row === jRowPos && veh.x > jColPos && (veh.x - jColPos) < 240) {
                incomingVehicles++;
                incomingPCU += veh.type === 'bus' ? 2.5 : 1.0;
              }
            });

            // Realistic Stable Traffic Engineering Green Time:
            // Minimum Green Floor = 10s (Pedestrian & vehicle clearance safety standard)
            // 3-5 vehicles = 16s - 24s full smooth clearance
            const calcGreen = Math.min(26, Math.max(10, 10 + Math.round(incomingPCU * 2.5)));
            j.green = calcGreen;
            updated = calcGreen;
            j.preempted = false;
          }

          j.timeLeft = updated;
          next[k] = j;
        });

        return next;
      });
    }, 1000 / simSpeed);

    // 2. 40ms High-Frame-Rate Vehicle Animation & Turning Physics Loop
    const animInterval = setInterval(() => {
      setSimTick((prev) => prev + 1);

      const currentJunctions = junctionsRef.current;
      const currentVehicles = vehiclesRef.current;

      // Preemption Trigger: Check for approaching ambulances within 280px to instantly trigger 5s Emergency Preemption
      currentVehicles.forEach((veh) => {
        if (veh.type === 'ambulance') {
          if (veh.dir === 'south') {
            const targetY = junctionCenters.find((cy) => cy > veh.y && cy - veh.y < 280);
            if (targetY) {
              const jCol = veh.col === 180 ? 1 : veh.col === 480 ? 2 : 3;
              const jRow = targetY === 180 ? 1 : targetY === 480 ? 2 : 3;
              const jId = `J${(jRow - 1) * 3 + jCol}`;
              if (currentJunctions[jId] && (!currentJunctions[jId].preempted || currentJunctions[jId].phase !== 'NORTH')) {
                setNetworkSimJunctions((prevJ: any) => ({
                  ...prevJ,
                  [jId]: { ...prevJ[jId], phase: 'NORTH', green: 8, timeLeft: 8, preempted: true }
                }));
              }
            }
          } else if (veh.dir === 'north') {
            const targetY = junctionCenters.find((cy) => cy < veh.y && veh.y - cy < 280);
            if (targetY) {
              const jCol = veh.col === 180 ? 1 : veh.col === 480 ? 2 : 3;
              const jRow = targetY === 180 ? 1 : targetY === 480 ? 2 : 3;
              const jId = `J${(jRow - 1) * 3 + jCol}`;
              if (currentJunctions[jId] && (!currentJunctions[jId].preempted || currentJunctions[jId].phase !== 'SOUTH')) {
                setNetworkSimJunctions((prevJ: any) => ({
                  ...prevJ,
                  [jId]: { ...prevJ[jId], phase: 'SOUTH', green: 8, timeLeft: 8, preempted: true }
                }));
              }
            }
          } else if (veh.dir === 'east') {
            const targetX = junctionCenters.find((cx) => cx > veh.x && cx - veh.x < 280);
            if (targetX) {
              const jCol = targetX === 180 ? 1 : targetX === 480 ? 2 : 3;
              const jRow = veh.row === 180 ? 1 : veh.row === 480 ? 2 : 3;
              const jId = `J${(jRow - 1) * 3 + jCol}`;
              if (currentJunctions[jId] && (!currentJunctions[jId].preempted || currentJunctions[jId].phase !== 'WEST')) {
                setNetworkSimJunctions((prevJ: any) => ({
                  ...prevJ,
                  [jId]: { ...prevJ[jId], phase: 'WEST', green: 8, timeLeft: 8, preempted: true }
                }));
              }
            }
          } else if (veh.dir === 'west') {
            const targetX = junctionCenters.find((cx) => cx < veh.x && veh.x - cx < 280);
            if (targetX) {
              const jCol = targetX === 180 ? 1 : targetX === 480 ? 2 : 3;
              const jRow = veh.row === 180 ? 1 : veh.row === 480 ? 2 : 3;
              const jId = `J${(jRow - 1) * 3 + jCol}`;
              if (currentJunctions[jId] && (!currentJunctions[jId].preempted || currentJunctions[jId].phase !== 'EAST')) {
                setNetworkSimJunctions((prevJ: any) => ({
                  ...prevJ,
                  [jId]: { ...prevJ[jId], phase: 'EAST', green: 8, timeLeft: 8, preempted: true }
                }));
              }
            }
          }
        }
      });

      // Update Vehicle Positions, Turning & Queue Detection
      setVehicles((prevVehicles) => {
        const juncs = junctionsRef.current;
        return prevVehicles.map((veh, i) => {
          let newX = veh.x;
          let newY = veh.y;
          let newDir = veh.dir;
          let newCol = veh.col;
          let newRow = veh.row;
          let newTurn = veh.turn;
          let shouldStop = false;
          const isAmbulance = veh.type === 'ambulance';

          // 1. Red Light Stop Detection (Ambulance with siren never stops at red light)
          if (!isAmbulance) {
            if (veh.dir === 'south') {
              const nextJuncY = junctionCenters.find((cy) => cy - stopDist > veh.y && cy - stopDist - veh.y < 36);
              if (nextJuncY) {
                const jCol = veh.col === 180 ? 1 : veh.col === 480 ? 2 : 3;
                const jRow = nextJuncY === 180 ? 1 : nextJuncY === 480 ? 2 : 3;
                const jId = `J${(jRow - 1) * 3 + jCol}`;
                if (juncs[jId]?.phase !== 'NORTH') {
                  shouldStop = true;
                }
              }
            } else if (veh.dir === 'north') {
              const nextJuncY = junctionCenters.find((cy) => cy + stopDist < veh.y && veh.y - (cy + stopDist) < 36);
              if (nextJuncY) {
                const jCol = veh.col === 180 ? 1 : veh.col === 480 ? 2 : 3;
                const jRow = nextJuncY === 180 ? 1 : nextJuncY === 480 ? 2 : 3;
                const jId = `J${(jRow - 1) * 3 + jCol}`;
                if (juncs[jId]?.phase !== 'SOUTH') {
                  shouldStop = true;
                }
              }
            } else if (veh.dir === 'east') {
              const nextJuncX = junctionCenters.find((cx) => cx - stopDist > veh.x && cx - stopDist - veh.x < 36);
              if (nextJuncX) {
                const jCol = nextJuncX === 180 ? 1 : nextJuncX === 480 ? 2 : 3;
                const jRow = veh.row === 180 ? 1 : veh.row === 480 ? 2 : 3;
                const jId = `J${(jRow - 1) * 3 + jCol}`;
                if (juncs[jId]?.phase !== 'WEST') {
                  shouldStop = true;
                }
              }
            } else if (veh.dir === 'west') {
              const nextJuncX = junctionCenters.find((cx) => cx + stopDist < veh.x && veh.x - (cx + stopDist) < 36);
              if (nextJuncX) {
                const jCol = nextJuncX === 180 ? 1 : nextJuncX === 480 ? 2 : 3;
                const jRow = veh.row === 180 ? 1 : veh.row === 480 ? 2 : 3;
                const jId = `J${(jRow - 1) * 3 + jCol}`;
                if (juncs[jId]?.phase !== 'EAST') {
                  shouldStop = true;
                }
              }
            }
          }

          // 2. Bumper-to-Bumper Queue Detection & Yield to Siren
          for (let j = 0; j < prevVehicles.length; j++) {
            if (i === j) continue;
            const other = prevVehicles[j];
            if (other.dir === veh.dir && other.col === veh.col && other.row === veh.row) {
              if (veh.dir === 'south' && other.y > veh.y && other.y - veh.y < 32 && other.isStopped && !isAmbulance) {
                shouldStop = true;
              } else if (veh.dir === 'north' && other.y < veh.y && veh.y - other.y < 32 && other.isStopped && !isAmbulance) {
                shouldStop = true;
              } else if (veh.dir === 'east' && other.x > veh.x && other.x - veh.x < 32 && other.isStopped && !isAmbulance) {
                shouldStop = true;
              } else if (veh.dir === 'west' && other.x < veh.x && veh.x - other.x < 32 && other.isStopped && !isAmbulance) {
                shouldStop = true;
              }
            }
          }

          // 3. Forward Movement, Smooth Correct-Side Turning & Boundary Looping
          if (!shouldStop) {
            const turnOptions = ['straight', 'left', 'right'];

            if (veh.dir === 'south') {
              newY = veh.y + veh.speed * simSpeed;
              const curJuncY = junctionCenters.find((cy) => Math.abs(cy - veh.y) < 4);
              if (curJuncY && veh.turn !== 'straight') {
                if (veh.turn === 'left') {
                  newDir = 'east';
                  newRow = curJuncY;
                  newY = curJuncY - 14; // Correct Eastbound side (Above yellow median)
                  newCol = undefined;
                } else if (veh.turn === 'right') {
                  newDir = 'west';
                  newRow = curJuncY;
                  newY = curJuncY + 14; // Correct Westbound side (Below yellow median)
                  newCol = undefined;
                }
                newTurn = turnOptions[Math.floor(Math.random() * turnOptions.length)];
              }
              if (newY > 900) newY = 0; // Continuous loop
            } else if (veh.dir === 'north') {
              newY = veh.y - veh.speed * simSpeed;
              const curJuncY = junctionCenters.find((cy) => Math.abs(cy - veh.y) < 4);
              if (curJuncY && veh.turn !== 'straight') {
                if (veh.turn === 'left') {
                  newDir = 'west';
                  newRow = curJuncY;
                  newY = curJuncY + 14; // Correct Westbound side (Below yellow median)
                  newCol = undefined;
                } else if (veh.turn === 'right') {
                  newDir = 'east';
                  newRow = curJuncY;
                  newY = curJuncY - 14; // Correct Eastbound side (Above yellow median)
                  newCol = undefined;
                }
                newTurn = turnOptions[Math.floor(Math.random() * turnOptions.length)];
              }
              if (newY < 0) newY = 900; // Continuous loop
            } else if (veh.dir === 'east') {
              newX = veh.x + veh.speed * simSpeed;
              const curJuncX = junctionCenters.find((cx) => Math.abs(cx - veh.x) < 4);
              if (curJuncX && veh.turn !== 'straight') {
                if (veh.turn === 'left') {
                  newDir = 'north';
                  newCol = curJuncX;
                  newX = curJuncX + 14; // Correct Northbound side (Right of yellow median)
                  newRow = undefined;
                } else if (veh.turn === 'right') {
                  newDir = 'south';
                  newCol = curJuncX;
                  newX = curJuncX - 14; // Correct Southbound side (Left of yellow median)
                  newRow = undefined;
                }
                newTurn = turnOptions[Math.floor(Math.random() * turnOptions.length)];
              }
              if (newX > 900) newX = 0; // Continuous loop
            } else if (veh.dir === 'west') {
              newX = veh.x - veh.speed * simSpeed;
              const curJuncX = junctionCenters.find((cx) => Math.abs(cx - veh.x) < 4);
              if (curJuncX && veh.turn !== 'straight') {
                if (veh.turn === 'left') {
                  newDir = 'south';
                  newCol = curJuncX;
                  newX = curJuncX - 14; // Correct Southbound side (Left of yellow median)
                  newRow = undefined;
                } else if (veh.turn === 'right') {
                  newDir = 'north';
                  newCol = curJuncX;
                  newX = curJuncX + 14; // Correct Northbound side (Right of yellow median)
                  newRow = undefined;
                }
                newTurn = turnOptions[Math.floor(Math.random() * turnOptions.length)];
              }
              if (newX < 0) newX = 900; // Continuous loop
            }
          }

          return {
            ...veh,
            x: newX,
            y: newY,
            dir: newDir,
            col: newCol,
            row: newRow,
            turn: newTurn,
            isStopped: shouldStop
          };
        });
      });
    }, 40);

    return () => {
      clearInterval(timerInterval);
      clearInterval(animInterval);
    };
  }, [isSimRunning, simSpeed]);

  // Fetch Live Signal Recommendation & Network State
  const fetchLiveRecommendation = async () => {
    try {
      const rec = await api.optimizeSignals();
      setLiveRecommendation(rec);
      const net = await api.optimizeNetwork();
      setNetworkData(net);
      const predOpt = await api.optimizePredictiveSignals();
      setPredictiveResult(predOpt);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Run Simulation Calculation
  const runSimulation = async () => {
    try {
      const rec = await api.optimizeSignals({
        ...simInputs,
        current_phase: currentPhase,
        elapsed_green: currentGreen,
      });
      setSimRecommendation(rec);
    } catch (e) {
      console.error(e);
    }
  };

  // Run Predictive Optimization Simulation
  const runPredictiveOptimization = async (customInputs?: any) => {
    const inputs = customInputs || simInputs;
    try {
      const res = await api.optimizePredictiveSignals({
        current_state: inputs,
        junction_id: 'J3',
      });
      setPredictiveResult(res);
    } catch (e) {}
  };

  // Run Network Simulator
  const runNetworkSimulation = async (customNet?: any) => {
    const targetState = customNet || networkSimJunctions;
    const formatted: any = {};
    for (const [jid, vals] of Object.entries(targetState) as any) {
      formatted[jid] = {
        north: { pcu: vals.pcu * 0.55, queue_length: Math.round(vals.queue * 0.55), average_wait: vals.wait, arrival_rate: vals.pcu * 0.3 },
        south: { pcu: vals.pcu * 0.25, queue_length: Math.round(vals.queue * 0.25), average_wait: Math.round(vals.wait * 0.7), arrival_rate: vals.pcu * 0.2 },
        east:  { pcu: vals.pcu * 0.10, queue_length: Math.round(vals.queue * 0.10), average_wait: Math.round(vals.wait * 0.5), arrival_rate: vals.pcu * 0.1 },
        west:  { pcu: vals.pcu * 0.10, queue_length: Math.round(vals.queue * 0.10), average_wait: Math.round(vals.wait * 0.5), arrival_rate: vals.pcu * 0.1 },
      };
    }
    try {
      const res = await api.optimizeNetwork(formatted);
      setNetworkData(res);
    } catch (e) {}
  };

  useEffect(() => {
    fetchLiveRecommendation();
    runSimulation();
    const interval = setInterval(fetchLiveRecommendation, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSimInputChange = (approach: 'north' | 'south' | 'east' | 'west', field: string, val: number) => {
    setSimInputs((prev) => {
      const next = {
        ...prev,
        [approach]: {
          ...prev[approach],
          [field]: val,
        },
      };
      api.optimizeSignals({
        ...next,
        current_phase: currentPhase,
        elapsed_green: currentGreen,
      }).then(setSimRecommendation).catch(() => {});
      runPredictiveOptimization(next);
      return next;
    });
  };

  const handleNetworkSimChange = (jid: string, field: string, val: number) => {
    setNetworkSimJunctions((prev: any) => {
      const updated = {
        ...prev,
        [jid]: {
          ...prev[jid],
          [field]: val,
        },
      };
      runNetworkSimulation(updated);
      return updated;
    });
  };

  const activeRec = activeTab === 'LIVE' ? liveRecommendation : simRecommendation;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-7xl mx-auto font-mono">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-[#1e293b] px-4 py-3 rounded-lg shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Zap size={18} />
          </div>
          <div>
            <h1 className="text-slate-900 dark:text-white font-bold text-sm uppercase">Adaptive Signal Optimization Engine</h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">Real-Time Actuation & Predictive Proactive Signal Control</p>
          </div>
        </div>

        {/* Tab Switcher: Live Actuated vs Single Sim vs Network Map vs Predictive AI */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#151f33] p-1 rounded-lg border border-slate-200 dark:border-[#223048]">
          <button
            onClick={() => setActiveTab('LIVE')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'LIVE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ACTUATED LIVE
          </button>
          <button
            onClick={() => {
              setActiveTab('PREDICTIVE');
              runPredictiveOptimization();
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'PREDICTIVE'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock size={13} /> PREDICTIVE AI
          </button>
          <button
            onClick={() => {
              setActiveTab('SIMULATION');
              runSimulation();
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'SIMULATION'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sliders size={13} /> SINGLE SIM
          </button>
          <button
            onClick={() => {
              setActiveTab('NETWORK');
              runNetworkSimulation();
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'NETWORK'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers size={13} /> NETWORK MAP
          </button>
        </div>
      </div>

      {/* PREDICTIVE AI INTEGRATION TAB VIEW (CURRENT TRAFFIC ➔ PREDICTED TRAFFIC ➔ AI RECOMMENDATION) */}
      {activeTab === 'PREDICTIVE' && (
        <div className="space-y-4">
          {/* Top Transparency Banner */}
          <div className="p-4 rounded-xl bg-indigo-950/20 border-2 border-indigo-500/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-500/20 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Clock size={20} />
                </div>
                <div>
                  <span className="text-indigo-400 text-[10px] uppercase font-bold">Proactive AI Decision Transparency</span>
                  <h2 className="text-slate-900 dark:text-white font-bold text-sm">
                    Current Detections + Forecasted Trends Integration
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-slate-500">REAL-TIME WEIGHT: <strong className="text-blue-400">65%</strong></span>
                <span className="text-slate-700">|</span>
                <span className="text-slate-500">FORECAST WEIGHT: <strong className="text-purple-400">35%</strong></span>
                <span className="text-slate-700">|</span>
                <span className="text-slate-500">HORIZON: <strong className="text-emerald-400">+10 MIN</strong></span>
              </div>
            </div>

            {/* 3-Tier Step Flow: CURRENT ➔ PREDICTED ➔ AI RECOMMENDATION */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* TIER 1: CURRENT TRAFFIC */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#0c1322] border border-blue-500/30 space-y-3 relative">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1c273e] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                    <span className="text-blue-500 font-bold text-xs uppercase">Current Traffic State</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">LIVE AI DETECT</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">North PCU Load:</span>
                    <strong className="text-slate-900 dark:text-white">{simInputs.north.pcu} PCU</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">South PCU Load:</span>
                    <strong className="text-slate-900 dark:text-white">{simInputs.south.pcu} PCU</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Baseline Signal:</span>
                    <strong className="text-blue-400">{predictiveResult?.current_state?.base_recommended_phase || 'NORTH_SOUTH'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Standard Green:</span>
                    <strong className="text-slate-900 dark:text-white">{predictiveResult?.current_state?.base_green_time || 30}s</strong>
                  </div>
                </div>
              </div>

              {/* TIER 2: PREDICTED TRAFFIC (+10 min) */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#0c1322] border border-purple-500/30 space-y-3 relative">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1c273e] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                    <span className="text-purple-400 font-bold text-xs uppercase">Predicted Forecast</span>
                  </div>
                  <span className="text-[10px] text-purple-400 font-mono">+10 MIN HORIZON</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Forecast PCU:</span>
                    <strong className="text-emerald-400">{predictiveResult?.prediction?.predicted_10m_pcu || 95} PCU</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Anticipated Growth:</span>
                    <strong className="text-amber-500">+{predictiveResult?.prediction?.predicted_growth_pct || 18.5}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Predicted Severity:</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                      {predictiveResult?.prediction?.predicted_level || 'HIGH'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Model Confidence:</span>
                    <strong className="text-purple-400">{predictiveResult?.prediction?.confidence_pct || 90}%</strong>
                  </div>
                </div>
              </div>

              {/* TIER 3: PROACTIVE AI RECOMMENDATION */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#0c1322] border border-emerald-500/40 space-y-3 relative shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1c273e] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">3</span>
                    <span className="text-emerald-500 font-bold text-xs uppercase">Proactive Signal Action</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">OPTIMAL</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Recommended Phase:</span>
                    <strong className="text-emerald-400">{predictiveResult?.recommended_action?.phase || 'NORTH_SOUTH'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Proactive Green:</span>
                    <strong className="text-2xl font-bold text-emerald-400">
                      {predictiveResult?.recommended_action?.green_time || 52}s
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Proactive Adjustment:</span>
                    <strong className="text-blue-400 font-bold">
                      {predictiveResult?.recommended_action?.delta_from_baseline_sec >= 0 ? '+' : ''}
                      {predictiveResult?.recommended_action?.delta_from_baseline_sec || 8}s vs Baseline
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Operator / Citizen Explanatory Box */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#080e1a] border border-slate-200 dark:border-[#1e293b] space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1c273e] pb-2">
                <span className="text-indigo-400 font-bold uppercase text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400" /> Human-Readable Optimization Explanation
                </span>
                <span className="text-slate-500 text-[10px]">AUDITABLE TRANSPARENCY LOG</span>
              </div>
              <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed font-sans font-medium">
                "{predictiveResult?.reason || 'North green extended by 8 seconds because current PCU is high (80.0 PCU) and predicted PCU will increase by 18.5% within 10 minutes.'}"
              </p>
              <div className="flex items-center gap-2 text-slate-500 text-[11px] pt-1">
                <span className="text-emerald-400 font-bold">EXPECTED BENEFIT:</span>
                <span>{predictiveResult?.expected_effect || 'Preemptively clears oncoming platoon before HIGH bottleneck develops at junction.'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Signal Control Status Panel (For LIVE and SIMULATION modes) */}
      {activeTab !== 'NETWORK' && activeTab !== 'PREDICTIVE' && activeRec && (
        <div className="panel p-4 space-y-4 bg-white dark:bg-[#0c1322] border-slate-200 dark:border-[#1c273e]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-[#1c273e] pb-3">
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold">Signal Recommendation Mode</span>
                <p className="text-slate-900 dark:text-white font-bold text-sm">
                  {activeTab === 'LIVE' ? 'Autonomous Live Optimization (CAM-01 to CAM-04)' : 'Interactive Volume Simulation Sandbox'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">CYCLE TARGET: <strong className="text-slate-900 dark:text-white">{activeRec.cycle_length || 120}s</strong></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-slate-500">YELLOW: <strong className="text-amber-500">{activeRec.yellow_time || 3}s</strong></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-slate-500">ALL-RED: <strong className="text-red-500">{activeRec.all_red_time || 2}s</strong></span>
            </div>
          </div>

          {/* Phase & Green Time Comparison Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded bg-slate-50 dark:bg-[#121a2d] border border-slate-200 dark:border-[#1c273e]">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Current Phase</span>
              <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1">{currentPhase}</p>
              <span className="text-[10px] text-slate-400">Elapsed: {currentGreen}s</span>
            </div>

            <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold">Recommended Phase</span>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">{activeRec.recommended_phase}</p>
              <span className="text-[10px] text-emerald-500/80">Next: {activeRec.next_phase}</span>
            </div>

            <div className="p-3 rounded bg-slate-50 dark:bg-[#121a2d] border border-slate-200 dark:border-[#1c273e]">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Current Green Time</span>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{currentGreen} <span className="text-xs text-slate-500 font-normal">SEC</span></p>
              <span className="text-[10px] text-slate-400">Standard Baseline</span>
            </div>

            <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30">
              <span className="text-blue-600 dark:text-blue-400 text-[10px] uppercase font-bold">Recommended Green</span>
              <p className="text-base font-bold text-blue-600 dark:text-blue-400 mt-1">{activeRec.green_time} <span className="text-xs text-blue-400 font-normal">SEC</span></p>
              <span className="text-[10px] text-blue-400/80">Fairness Clamped (12s-65s)</span>
            </div>
          </div>

          {/* AI Rationale & Expected Effect Banner */}
          <div className="p-3 rounded bg-blue-500/5 border border-blue-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs">
            <div className="space-y-0.5">
              <span className="text-blue-600 dark:text-blue-400 font-bold uppercase text-[11px]">OPTIMIZER RATIONALE:</span>
              <p className="text-slate-800 dark:text-slate-200">{activeRec.reason}</p>
            </div>
            <div className="md:text-right space-y-0.5 shrink-0">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[11px]">EXPECTED OUTCOME:</span>
              <p className="text-slate-700 dark:text-slate-300">{activeRec.expected_effect}</p>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Simulation Controls (When in SIMULATION mode) */}
      {activeTab === 'SIMULATION' && (
        <div className="panel p-4 space-y-4 bg-purple-950/10 border-purple-500/30 border-2 rounded-xl">
          <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-purple-400" />
              <span className="text-slate-900 dark:text-white font-bold text-xs uppercase">Interactive Traffic Volume Simulator</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSimInputs({
                    north: { vehicles: 40, pcu: 95.0, queue_length: 22, average_wait: 35, arrival_rate: 32.0 },
                    south: { vehicles: 10, pcu: 15.0, queue_length: 3, average_wait: 8, arrival_rate: 10.0 },
                    east: { vehicles: 5, pcu: 8.0, queue_length: 1, average_wait: 4, arrival_rate: 6.0 },
                    west: { vehicles: 3, pcu: 4.0, queue_length: 1, average_wait: 3, arrival_rate: 4.0 },
                  });
                }}
                className="btn-secondary text-[11px] py-1"
              >
                Preset: Peak North Congestion
              </button>
              <button
                onClick={() => {
                  setSimInputs({
                    north: { vehicles: 8, pcu: 10.0, queue_length: 2, average_wait: 6, arrival_rate: 8.0 },
                    south: { vehicles: 6, pcu: 8.0, queue_length: 1, average_wait: 5, arrival_rate: 6.0 },
                    east: { vehicles: 32, pcu: 75.0, queue_length: 19, average_wait: 48, arrival_rate: 26.0 },
                    west: { vehicles: 22, pcu: 50.0, queue_length: 12, average_wait: 32, arrival_rate: 20.0 },
                  });
                }}
                className="btn-secondary text-[11px] py-1"
              >
                Preset: East-West Surge (Starvation)
              </button>
            </div>
          </div>

          {/* Slider Inputs for each Approach */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {(['north', 'south', 'east', 'west'] as const).map((dir) => (
              <div key={dir} className="p-3.5 rounded-lg bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-[#1e2d4a] space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1c273e] pb-1.5">
                  <span className="text-slate-900 dark:text-white font-bold text-xs uppercase">{dir} Approach</span>
                  <span className="text-purple-400 font-mono font-bold text-xs">
                    Score: {activeRec?.demand_scores?.[dir]?.toFixed(1) ?? '—'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-500 mb-1">
                      <span>PCU Load:</span>
                      <strong className="text-slate-900 dark:text-white">{simInputs[dir].pcu} PCU</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="120"
                      step="5"
                      value={simInputs[dir].pcu}
                      onChange={(e) => handleSimInputChange(dir, 'pcu', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-500 mb-1">
                      <span>Queue Length:</span>
                      <strong className="text-amber-500">{simInputs[dir].queue_length} vehicles</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="35"
                      step="1"
                      value={simInputs[dir].queue_length}
                      onChange={(e) => handleSimInputChange(dir, 'queue_length', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-500 mb-1">
                      <span>Avg Waiting Time:</span>
                      <strong className="text-purple-500">{simInputs[dir].average_wait}s</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      step="2"
                      value={simInputs[dir].average_wait}
                      onChange={(e) => handleSimInputChange(dir, 'average_wait', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MULTI-JUNCTION NETWORK TAB VIEW */}
      {activeTab === 'NETWORK' && networkData && (
        <div className="space-y-4">
          {/* Network Objective & Global Status Card */}
          <div className="panel p-4 bg-white dark:bg-[#0c1322] border-slate-200 dark:border-[#1c273e] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-[#1c273e] pb-3">
              <div className="flex items-center gap-3">
                <span className={`w-3.5 h-3.5 rounded-full ${
                  networkData.overall_status === 'OPTIMAL' ? 'bg-emerald-500' :
                  networkData.overall_status === 'MODERATE' ? 'bg-amber-500' : 'bg-red-500'
                } animate-pulse`} />
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Network Coordinated Objective</span>
                  <p className="text-slate-900 dark:text-white font-bold text-sm">
                    Arterial Downstream-Aware Signal Balancing · Status: <span className={
                      networkData.overall_status === 'OPTIMAL' ? 'text-emerald-500' :
                      networkData.overall_status === 'MODERATE' ? 'text-amber-500' : 'text-red-500'
                    }>{networkData.overall_status}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">NETWORK CONGESTION</span>
                  <strong className="text-base text-amber-500">{networkData.network_congestion_score} PTS</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">EST. QUEUE REDUCTION</span>
                  <strong className="text-base text-emerald-500">-{networkData.expected_queue_reduction_pct}%</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">TOTAL NETWORK QUEUE</span>
                  <strong className="text-base text-slate-900 dark:text-white">{networkData.total_network_queue} VEH</strong>
                </div>
              </div>
            </div>

            {/* Real-Life 9-Junction Unified 3x3 City Grid Road Network Simulator */}
            <div className="panel p-5 bg-white dark:bg-[#070b12] border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 dark:text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={15} className="text-emerald-500" /> City Grid Network (9 Synchronized Junctions)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40 text-[10px] font-bold">
                    Green Wave Active
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                    title={isFullscreen ? "Exit Fullscreen" : "Fit to Fullscreen"}
                  >
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    <span>{isFullscreen ? "Exit Fullscreen" : "Full Screen"}</span>
                  </button>
                </div>
              </div>

              {/* Fullscreen Overlay Wrapper if isFullscreen is true */}
              <div className={
                isFullscreen
                  ? 'fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 overflow-hidden h-screen w-screen'
                  : 'space-y-4'
              }>
                {isFullscreen && (
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <Layers size={16} className="text-emerald-400" />
                      <span>FlowForce 9-Junction Real-Time Command Center (Fit Full Screen)</span>
                    </div>
                    <button
                      onClick={() => setIsFullscreen(false)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow"
                    >
                      <Minimize2 size={14} /> Exit Fullscreen (ESC)
                    </button>
                  </div>
                )}

                {/* Live Simulation Control Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsSimRunning(!isSimRunning)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                        isSimRunning
                          ? 'bg-amber-500 hover:bg-amber-600 text-black'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-black'
                      }`}
                    >
                      {isSimRunning ? '⏸️ PAUSE SIMULATION' : '▶️ RESUME SIMULATION'}
                    </button>

                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      {[1, 2, 4].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => setSimSpeed(spd)}
                          className={`px-2.5 py-0.5 rounded text-[11px] font-bold font-mono transition-all cursor-pointer ${
                            simSpeed === spd
                              ? 'bg-blue-600 text-white shadow'
                              : 'text-slate-600 dark:text-slate-400 hover:text-white'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>

                    {/* Live Emergency Preemption Status */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[11px] font-bold text-red-600 dark:text-red-400 font-mono">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      <span>🚑 Emergency Preemption: 1 Active Corridor</span>
                    </div>
                  </div>

                  {/* Simulation Legend */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span className="w-3 h-2 rounded-sm bg-[#38bdf8] inline-block" /> Car
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span className="w-4 h-2.5 rounded-sm bg-[#f59e0b] inline-block" /> City Bus
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span className="w-3.5 h-2 rounded-sm bg-[#ef4444] animate-pulse inline-block" /> Ambulance (Preempt)
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      ⏱️ Frame #{simTick}
                    </span>
                  </div>
                </div>

                {/* Unified 3x3 9-Junction Road Canvas with Live Animated Vehicles (Fit to screen non-scrollable) */}
                <div className={`relative mx-auto bg-slate-100 dark:bg-[#0b101b] rounded-2xl border border-slate-300 dark:border-slate-800 overflow-hidden shadow-xl flex items-center justify-center p-3 ${
                  isFullscreen
                    ? 'flex-1 w-full max-h-[calc(100vh-140px)] aspect-square my-auto'
                    : 'w-full max-w-4xl aspect-square'
                }`}>
                <svg viewBox="0 0 900 900" className="w-full h-full select-none">
                  {/* Background City Blocks (9 Greenery/Building Parcels) */}
                  {[
                    [0, 0], [280, 0], [580, 0],
                    [0, 280], [280, 280], [580, 280],
                    [0, 580], [280, 580], [580, 580]
                  ].map(([bx, by], idx) => (
                    <rect
                      key={`block-${idx}`}
                      x={bx + 15}
                      y={by + 15}
                      width="150"
                      height="150"
                      rx="8"
                      className="fill-slate-200/80 stroke-slate-300 dark:fill-[#0e1726] dark:stroke-[#1e293b]"
                      strokeWidth="1.5"
                    />
                  ))}

                  {/* 3 Continuous Vertical 4-Lane Arterials (Columns at x=180, x=480, x=780) */}
                  {[180, 480, 780].map((vx, vi) => (
                    <g key={`v-road-${vi}`}>
                      {/* Asphalt Road Base (80px wide) */}
                      <rect x={vx - 40} y="0" width="80" height="900" className="fill-slate-800 dark:fill-[#151d2d]" />
                      {/* Center Yellow Solid Median Line */}
                      <line x1={vx} y1="0" x2={vx} y2="900" stroke="#f59e0b" strokeWidth="2.5" />
                      {/* Left & Right Lane Divider Dashed Lines */}
                      <line x1={vx - 20} y1="0" x2={vx - 20} y2="900" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="6 6" opacity="0.65" />
                      <line x1={vx + 20} y1="0" x2={vx + 20} y2="900" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="6 6" opacity="0.65" />
                    </g>
                  ))}

                  {/* 3 Continuous Horizontal 4-Lane Arterials (Rows at y=180, y=480, y=780) */}
                  {[180, 480, 780].map((hy, hi) => (
                    <g key={`h-road-${hi}`}>
                      {/* Asphalt Road Base (80px wide) */}
                      <rect x="0" y={hy - 40} width="900" height="80" className="fill-slate-800 dark:fill-[#151d2d]" />
                      {/* Center Yellow Solid Median Line */}
                      <line x1="0" y1={hy} x2="900" y2={hy} stroke="#f59e0b" strokeWidth="2.5" />
                      {/* Top & Bottom Lane Divider Dashed Lines */}
                      <line x1="0" y1={hy - 20} x2="900" y2={hy - 20} stroke="#ffffff" strokeWidth="1.2" strokeDasharray="6 6" opacity="0.65" />
                      <line x1="0" y1={hy + 20} x2="900" y2={hy + 20} stroke="#ffffff" strokeWidth="1.2" strokeDasharray="6 6" opacity="0.65" />
                    </g>
                  ))}

                  {/* 9 Intersecting Junction Boxes with Traffic Signals & Actuators */}
                  {[
                    { id: 'J1', cx: 180, cy: 180, name: 'Kadbi', phase: networkSimJunctions.J1.phase, green: networkSimJunctions.J1.green, pcu: networkSimJunctions.J1.pcu },
                    { id: 'J2', cx: 480, cy: 180, name: 'RBI Sq', phase: networkSimJunctions.J2.phase, green: networkSimJunctions.J2.green, pcu: networkSimJunctions.J2.pcu },
                    { id: 'J3', cx: 780, cy: 180, name: 'Mayo', phase: networkSimJunctions.J3.phase, green: networkSimJunctions.J3.green, pcu: networkSimJunctions.J3.pcu },
                    { id: 'J4', cx: 180, cy: 480, name: 'Law Coll', phase: networkSimJunctions.J4.phase, green: networkSimJunctions.J4.green, pcu: networkSimJunctions.J4.pcu },
                    { id: 'J5', cx: 480, cy: 480, name: 'Variety (Hub)', phase: networkSimJunctions.J5.phase, green: networkSimJunctions.J5.green, pcu: networkSimJunctions.J5.pcu, isHub: true },
                    { id: 'J6', cx: 780, cy: 480, name: 'Sitabuldi', phase: networkSimJunctions.J6.phase, green: networkSimJunctions.J6.green, pcu: networkSimJunctions.J6.pcu },
                    { id: 'J7', cx: 180, cy: 780, name: 'Shankar', phase: networkSimJunctions.J7.phase, green: networkSimJunctions.J7.green, pcu: networkSimJunctions.J7.pcu },
                    { id: 'J8', cx: 480, cy: 780, name: 'Rahate', phase: networkSimJunctions.J8.phase, green: networkSimJunctions.J8.green, pcu: networkSimJunctions.J8.pcu },
                    { id: 'J9', cx: 780, cy: 780, name: 'Medical', phase: networkSimJunctions.J9.phase, green: networkSimJunctions.J9.green, pcu: networkSimJunctions.J9.pcu },
                  ].map((j) => {
                    const isSelected = selectedJunctionId === j.id;
                    const isNorthGreen = j.phase === 'NORTH';
                    const isEastGreen = j.phase === 'EAST';
                    const isSouthGreen = j.phase === 'SOUTH';
                    const isWestGreen = j.phase === 'WEST';

                    return (
                      <g key={`junc-box-${j.id}`} onClick={() => setSelectedJunctionId(j.id)} className="cursor-pointer">
                        {/* Central Intersection Box Yellow Boundary */}
                        <rect
                          x={j.cx - 40}
                          y={j.cy - 40}
                          width="80"
                          height="80"
                          fill={isSelected ? '#1e3a8a' : j.isHub ? '#2a1a08' : '#1e293b'}
                          stroke={isSelected ? '#60a5fa' : j.isHub ? '#f59e0b' : '#eab308'}
                          strokeWidth={isSelected ? 3 : 2}
                          strokeDasharray={isSelected ? undefined : '4 4'}
                          rx="4"
                        />

                        {/* Zebra Crossings (N, S, E, W of each junction) */}
                        {/* North Crosswalk */}
                        <line x1={j.cx - 36} y1={j.cy - 45} x2={j.cx + 36} y2={j.cy - 45} stroke="#f8fafc" strokeWidth="4" strokeDasharray="4 4" opacity="0.9" />
                        {/* South Crosswalk */}
                        <line x1={j.cx - 36} y1={j.cy + 45} x2={j.cx + 36} y2={j.cy + 45} stroke="#f8fafc" strokeWidth="4" strokeDasharray="4 4" opacity="0.9" />
                        {/* West Crosswalk */}
                        <line x1={j.cx - 45} y1={j.cy - 36} x2={j.cx - 45} y2={j.cy + 36} stroke="#f8fafc" strokeWidth="4" strokeDasharray="4 4" opacity="0.9" />
                        {/* East Crosswalk */}
                        <line x1={j.cx + 45} y1={j.cy - 36} x2={j.cx + 45} y2={j.cy + 36} stroke="#f8fafc" strokeWidth="4" strokeDasharray="4 4" opacity="0.9" />

                        {/* 4 Multi-Phase Signal Heads with INDIVIDUAL REAL-TIME LANE COUNTDOWN TIMERS */}
                        {/* Approach countdown calculations */}
                        {(() => {
                          const phasesList = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
                          const curPhaseIdx = phasesList.indexOf(j.phase || 'NORTH');
                          const tLeft = Math.max(1, Math.round(networkSimJunctions[j.id]?.timeLeft || 15));
                          const baseDur = 16;

                          const getApproachTime = (appPhase: string) => {
                            if (j.phase === appPhase) return tLeft;
                            const targetIdx = phasesList.indexOf(appPhase);
                            const diff = (targetIdx - curPhaseIdx + 4) % 4;
                            return tLeft + (diff - 1) * baseDur;
                          };

                          const nTime = getApproachTime('NORTH');
                          const eTime = getApproachTime('EAST');
                          const sTime = getApproachTime('SOUTH');
                          const wTime = getApproachTime('WEST');

                          return (
                            <>
                              {/* 1. North Approach Signal Light & Digital Timer */}
                              <g>
                                <circle cx={j.cx - 48} cy={j.cy - 48} r="5.5" fill={isNorthGreen ? '#22c55e' : '#ef4444'} className="filter drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
                                <rect x={j.cx - 72} y={j.cy - 54} width="20" height="11" rx="2" fill="#020617" stroke={isNorthGreen ? '#22c55e' : '#ef4444'} strokeWidth="0.8" opacity="0.9" />
                                <text x={j.cx - 62} y={j.cy - 46} fontSize="7.5" fill={isNorthGreen ? '#4ade80' : '#f87171'} textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                                  {nTime}s
                                </text>
                              </g>

                              {/* 2. East Approach Signal Light & Digital Timer */}
                              <g>
                                <circle cx={j.cx + 48} cy={j.cy - 48} r="5.5" fill={isEastGreen ? '#22c55e' : '#ef4444'} className="filter drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
                                <rect x={j.cx + 54} y={j.cy - 54} width="20" height="11" rx="2" fill="#020617" stroke={isEastGreen ? '#22c55e' : '#ef4444'} strokeWidth="0.8" opacity="0.9" />
                                <text x={j.cx + 64} y={j.cy - 46} fontSize="7.5" fill={isEastGreen ? '#4ade80' : '#f87171'} textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                                  {eTime}s
                                </text>
                              </g>

                              {/* 3. South Approach Signal Light & Digital Timer */}
                              <g>
                                <circle cx={j.cx + 48} cy={j.cy + 48} r="5.5" fill={isSouthGreen ? '#22c55e' : '#ef4444'} className="filter drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
                                <rect x={j.cx + 54} y={j.cy + 42} width="20" height="11" rx="2" fill="#020617" stroke={isSouthGreen ? '#22c55e' : '#ef4444'} strokeWidth="0.8" opacity="0.9" />
                                <text x={j.cx + 64} y={j.cy + 50} fontSize="7.5" fill={isSouthGreen ? '#4ade80' : '#f87171'} textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                                  {sTime}s
                                </text>
                              </g>

                              {/* 4. West Approach Signal Light & Digital Timer */}
                              <g>
                                <circle cx={j.cx - 48} cy={j.cy + 48} r="5.5" fill={isWestGreen ? '#22c55e' : '#ef4444'} className="filter drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
                                <rect x={j.cx - 72} y={j.cy + 42} width="20" height="11" rx="2" fill="#020617" stroke={isWestGreen ? '#22c55e' : '#ef4444'} strokeWidth="0.8" opacity="0.9" />
                                <text x={j.cx - 62} y={j.cy + 50} fontSize="7.5" fill={isWestGreen ? '#4ade80' : '#f87171'} textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                                  {wTime}s
                                </text>
                              </g>
                            </>
                          );
                        })()}

                        {/* Junction HUD Title & Info inside box */}
                        <text x={j.cx} y={j.cy - 14} fontSize="11" fill="#ffffff" textAnchor="middle" fontWeight="bold">
                          {j.id}
                        </text>
                        <text x={j.cx} y={j.cy} fontSize="9" fill="#4ade80" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                          {j.phase} 🟢 {Math.round(networkSimJunctions[j.id]?.timeLeft || 15)}s
                        </text>
                        <text x={j.cx} y={j.cy + 14} fontSize="8" fill="#cbd5e1" textAnchor="middle" fontFamily="monospace">
                          {j.pcu} PCU · {networkSimJunctions[j.id]?.queue || 8} Q
                        </text>
                        <text x={j.cx} y={j.cy + 26} fontSize="7" fill="#fbbf24" textAnchor="middle" fontWeight="500">
                          {j.name}
                        </text>
                      </g>
                    );
                  })}

                  {/* Dynamic Moving & Stopping Vehicles (Cars, Buses, Emergency Vehicles) */}
                  {vehicles.filter(v => v.active !== false).map((v) => {
                    const isVertical = v.dir === 'north' || v.dir === 'south';
                    const width = isVertical ? (v.type === 'bus' ? 14 : 11) : (v.length || (v.type === 'bus' ? 26 : 16));
                    const height = isVertical ? (v.length || (v.type === 'bus' ? 26 : 16)) : (v.type === 'bus' ? 14 : 11);

                    return (
                      <g key={v.id} transform={`translate(${v.x}, ${v.y})`}>
                        {/* Emergency Ambulance Floating Badge & Siren */}
                        {v.type === 'ambulance' && (
                          <g transform="translate(0, -14)">
                            {/* Floating 'A' Badge */}
                            <rect x="-8" y="-7" width="16" height="12" rx="3" fill="#dc2626" stroke="#ffffff" strokeWidth="1.2" />
                            <text x="0" y="2.5" fontSize="9" fill="#ffffff" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                              A
                            </text>
                            {/* Dual Flashing Blue & Red Strobe Beacons */}
                            <circle cx="-10" cy="-1" r="3" fill="#3b82f6" className="animate-ping" />
                            <circle cx="10" cy="-1" r="3" fill="#ef4444" className="animate-ping" />
                          </g>
                        )}

                        {/* Vehicle Body */}
                        <rect
                          x={-width / 2}
                          y={-height / 2}
                          width={width}
                          height={height}
                          rx={v.type === 'bus' ? 3 : 2}
                          fill={v.color}
                          stroke={v.isStopped ? '#ef4444' : '#ffffff'}
                          strokeWidth={v.isStopped ? 1.5 : 0.8}
                          className={v.type === 'ambulance' ? 'animate-pulse' : ''}
                        />

                        {/* Vehicle Windshield detail */}
                        {isVertical ? (
                          <rect
                            x={-width / 2 + 2}
                            y={v.dir === 'south' ? height / 2 - 5 : -height / 2 + 1}
                            width={width - 4}
                            height={4}
                            rx={1}
                            fill="#0f172a"
                            opacity="0.8"
                          />
                        ) : (
                          <rect
                            x={v.dir === 'east' ? width / 2 - 5 : -width / 2 + 1}
                            y={-height / 2 + 2}
                            width={4}
                            height={height - 4}
                            rx={1}
                            fill="#0f172a"
                            opacity="0.8"
                          />
                        )}

                        {/* Ambulance Roof Siren Bar */}
                        {v.type === 'ambulance' && (
                          <rect x="-4" y="-2" width="8" height="4" rx="1" fill="#ffffff" stroke="#ef4444" strokeWidth="0.8" />
                        )}

                        {/* Stopped Brake Light indicator */}
                        {v.isStopped && (
                          <circle
                            cx={isVertical ? 0 : v.dir === 'east' ? -width / 2 : width / 2}
                            cy={isVertical ? (v.dir === 'south' ? -height / 2 : height / 2) : 0}
                            r="2"
                            fill="#ef4444"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

                {/* Quick Selected Junction HUD Strip */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs shrink-0">
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 block font-bold text-[10px]">SELECTED NODE</span>
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm mt-0.5">{networkSimJunctions[selectedJunctionId]?.name}</p>
                  </div>
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 block font-bold text-[10px]">ACTIVE PHASE</span>
                    <p className="text-slate-900 dark:text-slate-200 font-bold mt-0.5">{networkSimJunctions[selectedJunctionId]?.phase} 🟢</p>
                  </div>
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 block font-bold text-[10px]">ALLOCATED GREEN</span>
                    <p className="text-amber-600 dark:text-amber-400 font-bold mt-0.5 font-mono">{networkSimJunctions[selectedJunctionId]?.green}s DURATION</p>
                  </div>
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 block font-bold text-[10px]">PCU LOADING</span>
                    <p className="text-blue-600 dark:text-blue-400 font-bold mt-0.5 font-mono">{networkSimJunctions[selectedJunctionId]?.pcu} PCU</p>
                  </div>
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 block font-bold text-[10px]">PLATOON OFFSET</span>
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 font-mono">0s STOP DELAY</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Network Topology Map with Upstream/Downstream Flow (3x3 - 9 Interconnected Junctions) */}
            <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Layers size={14} className="text-emerald-400" /> 3x3 Arterial Flow Mesh Topology Map (9 Interconnected 8-Lane Corridors)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Coordinated Platoon Synchronization · Multi-Arterial Bi-Directional Grid Linking 9 Nagpur Junctions
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                  9-NODE MESH ACTIVE
                </span>
              </div>

              {/* 3x3 Topology Mesh Grid */}
              <div className="max-w-4xl mx-auto p-4 bg-[#090e18] rounded-2xl border border-slate-800/80 shadow-2xl relative">
                {/* 3 Rows of 3 Junctions */}
                <div className="space-y-6">
                  {/* Row 1: J1 (Kadbi) ➔ J2 (RBI) ➔ J3 (Mayo) */}
                  <div className="grid grid-cols-5 items-center justify-items-center">
                    {/* J1 */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => setSelectedJunctionId('J1')}
                        className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                          selectedJunctionId === 'J1' ? 'ring-2 ring-blue-400 bg-blue-950/70 border-blue-400 scale-105' : 'border-emerald-500 bg-emerald-950/60'
                        }`}
                      >
                        <span className="font-bold text-xs text-white">J1</span>
                        <span className="text-[8px] font-mono text-emerald-400">{networkSimJunctions.J1.green}s G</span>
                      </button>
                      <span className="text-[9px] font-bold text-slate-300 mt-1 text-center">Kadbi Chowk</span>
                    </div>

                    {/* Horizontal Link J1 <-> J2 */}
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full h-1 bg-emerald-500/70 rounded" />
                      <span className="text-[8px] font-mono text-slate-400 mt-0.5">50 PCU</span>
                    </div>

                    {/* J2 */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => setSelectedJunctionId('J2')}
                        className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                          selectedJunctionId === 'J2' ? 'ring-2 ring-blue-400 bg-blue-950/70 border-blue-400 scale-105' : 'border-emerald-500 bg-emerald-950/60'
                        }`}
                      >
                        <span className="font-bold text-xs text-white">J2</span>
                        <span className="text-[8px] font-mono text-emerald-400">{networkSimJunctions.J2.green}s G</span>
                      </button>
                      <span className="text-[9px] font-bold text-slate-300 mt-1 text-center">RBI Square</span>
                    </div>

                    {/* Horizontal Link J2 <-> J3 */}
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full h-1 bg-emerald-500/70 rounded" />
                      <span className="text-[8px] font-mono text-slate-400 mt-0.5">45 PCU</span>
                    </div>

                    {/* J3 */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => setSelectedJunctionId('J3')}
                        className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                          selectedJunctionId === 'J3' ? 'ring-2 ring-blue-400 bg-blue-950/70 border-blue-400 scale-105' : 'border-emerald-500 bg-emerald-950/60'
                        }`}
                      >
                        <span className="font-bold text-xs text-white">J3</span>
                        <span className="text-[8px] font-mono text-emerald-400">{networkSimJunctions.J3.green}s G</span>
                      </button>
                      <span className="text-[9px] font-bold text-slate-300 mt-1 text-center">Mayo Hospital</span>
                    </div>
                  </div>

                  {/* Vertical Links Row 1 to Row 2 */}
                  <div className="grid grid-cols-5 items-center justify-items-center h-4">
                    <div className="w-1 h-full bg-emerald-500/70 rounded" />
                    <div />
                    <div className="w-1 h-full bg-emerald-500/70 rounded" />
                    <div />
                    <div className="w-1 h-full bg-emerald-500/70 rounded" />
                  </div>

                  {/* Row 2: J4 (Law College) ➔ J5 (Variety Square - Center Hub) ➔ J6 (Sitabuldi) */}
                  <div className="grid grid-cols-5 items-center justify-items-center">
                    {/* J4 */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => setSelectedJunctionId('J4')}
                        className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                          selectedJunctionId === 'J4' ? 'ring-2 ring-blue-400 bg-blue-950/70 border-blue-400 scale-105' : 'border-emerald-500 bg-emerald-950/60'
                        }`}
                      >
                        <span className="font-bold text-xs text-white">J4</span>
                        <span className="text-[8px] font-mono text-emerald-400">{networkSimJunctions.J4.green}s G</span>
                      </button>
                      <span className="text-[9px] font-bold text-slate-300 mt-1 text-center">Law College Sq</span>
                    </div>

                    {/* Horizontal Link J4 <-> J5 */}
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full h-1.5 bg-amber-500/80 rounded animate-pulse" />
                      <span className="text-[8px] font-mono text-amber-400 mt-0.5">85 PCU (Heavy)</span>
                    </div>

                    {/* J5 (Center Hub) */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => setSelectedJunctionId('J5')}
                        className={`w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer shadow-xl ${
                          selectedJunctionId === 'J5' ? 'ring-2 ring-blue-400 bg-blue-950/90 border-blue-400 scale-110' : 'border-amber-500 bg-amber-950/80 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                        }`}
                      >
                        <span className="font-bold text-sm text-white">J5</span>
                        <span className="text-[9px] font-mono text-amber-400">{networkSimJunctions.J5.green}s G</span>
                      </button>
                      <span className="text-[10px] font-bold text-amber-400 mt-1 text-center">Variety Square (Hub)</span>
                    </div>

                    {/* Horizontal Link J5 <-> J6 */}
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full h-1.5 bg-amber-500/80 rounded animate-pulse" />
                      <span className="text-[8px] font-mono text-amber-400 mt-0.5">90 PCU (Heavy)</span>
                    </div>

                    {/* J6 */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => setSelectedJunctionId('J6')}
                        className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                          selectedJunctionId === 'J6' ? 'ring-2 ring-blue-400 bg-blue-950/70 border-blue-400 scale-105' : 'border-emerald-500 bg-emerald-950/60'
                        }`}
                      >
                        <span className="font-bold text-xs text-white">J6</span>
                        <span className="text-[8px] font-mono text-emerald-400">{networkSimJunctions.J6.green}s G</span>
                      </button>
                      <span className="text-[9px] font-bold text-slate-300 mt-1 text-center">Sitabuldi Chowk</span>
                    </div>
                  </div>

                  {/* Vertical Links Row 2 to Row 3 */}
                  <div className="grid grid-cols-5 items-center justify-items-center h-4">
                    <div className="w-1 h-full bg-emerald-500/70 rounded" />
                    <div />
                    <div className="w-1.5 h-full bg-amber-500/80 rounded" />
                    <div />
                    <div className="w-1 h-full bg-emerald-500/70 rounded" />
                  </div>

                  {/* Row 3: J7 (Shankar Nagar) ➔ J8 (Rahate Colony) ➔ J9 (Medical Square) */}
                  <div className="grid grid-cols-5 items-center justify-items-center">
                    {/* J7 */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => setSelectedJunctionId('J7')}
                        className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                          selectedJunctionId === 'J7' ? 'ring-2 ring-blue-400 bg-blue-950/70 border-blue-400 scale-105' : 'border-emerald-500 bg-emerald-950/60'
                        }`}
                      >
                        <span className="font-bold text-xs text-white">J7</span>
                        <span className="text-[8px] font-mono text-emerald-400">{networkSimJunctions.J7.green}s G</span>
                      </button>
                      <span className="text-[9px] font-bold text-slate-300 mt-1 text-center">Shankar Nagar</span>
                    </div>

                    {/* Horizontal Link J7 <-> J8 */}
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full h-1 bg-emerald-500/70 rounded" />
                      <span className="text-[8px] font-mono text-slate-400 mt-0.5">40 PCU</span>
                    </div>

                    {/* J8 */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => setSelectedJunctionId('J8')}
                        className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                          selectedJunctionId === 'J8' ? 'ring-2 ring-blue-400 bg-blue-950/70 border-blue-400 scale-105' : 'border-emerald-500 bg-emerald-950/60'
                        }`}
                      >
                        <span className="font-bold text-xs text-white">J8</span>
                        <span className="text-[8px] font-mono text-emerald-400">{networkSimJunctions.J8.green}s G</span>
                      </button>
                      <span className="text-[9px] font-bold text-slate-300 mt-1 text-center">Rahate Colony</span>
                    </div>

                    {/* Horizontal Link J8 <-> J9 */}
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full h-1 bg-emerald-500/70 rounded" />
                      <span className="text-[8px] font-mono text-slate-400 mt-0.5">55 PCU</span>
                    </div>

                    {/* J9 */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => setSelectedJunctionId('J9')}
                        className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                          selectedJunctionId === 'J9' ? 'ring-2 ring-blue-400 bg-blue-950/70 border-blue-400 scale-105' : 'border-emerald-500 bg-emerald-950/60'
                        }`}
                      >
                        <span className="font-bold text-xs text-white">J9</span>
                        <span className="text-[8px] font-mono text-emerald-400">{networkSimJunctions.J9.green}s G</span>
                      </button>
                      <span className="text-[9px] font-bold text-slate-300 mt-1 text-center">Medical Square</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Junction Traffic State Simulator Controls */}
            <div className="p-4 rounded-xl bg-purple-950/10 border border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-900 dark:text-white font-bold text-xs uppercase flex items-center gap-2">
                  <Sliders size={14} className="text-purple-400" /> Network Load Simulator
                </span>
                <span className="text-[11px] text-purple-400 font-mono">Observe how downstream congestion at J2 throttles J1 green</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {['J1', 'J2', 'J3', 'J4'].map((jid) => (
                  <div key={jid} className="p-3 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-[#1e293b] rounded space-y-2 text-xs">
                    <div className="flex justify-between border-b border-slate-200 dark:border-[#1c273e] pb-1">
                      <strong className="text-slate-900 dark:text-white">{jid} Traffic Input</strong>
                      <span className="text-purple-400 font-bold">{networkSimJunctions[jid]?.pcu} PCU</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Load (PCU):</span>
                        <span>{networkSimJunctions[jid]?.pcu}</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="120"
                        step="5"
                        value={networkSimJunctions[jid]?.pcu}
                        onChange={(e) => handleNetworkSimChange(jid, 'pcu', Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Wait (sec):</span>
                        <span className="text-amber-500">{networkSimJunctions[jid]?.wait}s</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="65"
                        step="2"
                        value={networkSimJunctions[jid]?.wait}
                        onChange={(e) => handleNetworkSimChange(jid, 'wait', Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Junction Network Recommendations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {['J1', 'J2', 'J3', 'J4'].map((jid) => {
                const jrec = networkData.junction_recommendations?.[jid] || {};
                return (
                  <div key={jid} className="p-3.5 rounded bg-slate-50 dark:bg-[#121a2d] border border-slate-200 dark:border-[#1c273e] space-y-2.5 text-xs">
                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#1c273e] pb-1.5">
                      <span className="font-bold text-slate-900 dark:text-white uppercase">{jrec.junction_name || jid}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        jrec.status_color === 'RED' ? 'bg-red-500/20 text-red-400' :
                        jrec.status_color === 'YELLOW' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {jrec.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px]">REC GREEN:</span>
                        <p className="text-base font-bold text-blue-500">{jrec.green_time}s</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">REC PHASE:</span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{jrec.recommended_phase}</p>
                      </div>
                    </div>

                    {jrec.backpressure_applied && (
                      <div className="p-1.5 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-400 font-bold flex items-center gap-1">
                        <span>⚠️ DOWNSTREAM THROTTLE APPLIED</span>
                      </div>
                    )}

                    <div className="space-y-0.5 pt-1 text-[11px]">
                      <span className="text-slate-500 text-[10px] block">RATIONALE:</span>
                      <p className="text-slate-700 dark:text-slate-300 line-clamp-3">{jrec.reason}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4 Approach State & Split Telemetry Cards (When in Single Junction / Sim mode) */}
      {activeTab !== 'NETWORK' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {(['north', 'south', 'east', 'west'] as const).map((dir) => {
            const metricsData = activeRec?.approach_metrics?.[dir] || {};
            const splitSec = activeRec?.phase_splits?.[`${dir}_green`] || 20;

            return (
              <div key={dir} className="panel p-3.5 space-y-3 bg-white dark:bg-[#0c1322] border-slate-200 dark:border-[#1c273e]">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1c273e] pb-2">
                  <span className="text-slate-900 dark:text-white font-bold text-xs uppercase">{dir} Approach</span>
                  <span className="text-blue-500 font-bold text-xs">{splitSec}s ALLOCATED</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-slate-50 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048]">
                    <span className="text-slate-500 text-[10px]">VEHICLES</span>
                    <p className="text-slate-900 dark:text-white font-bold text-base">{metricsData.vehicles ?? 0}</p>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048]">
                    <span className="text-slate-500 text-[10px]">PCU</span>
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold text-base">{metricsData.pcu ?? 0}</p>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048]">
                    <span className="text-slate-500 text-[10px]">QUEUE</span>
                    <p className="text-amber-600 dark:text-amber-400 font-bold text-base">{metricsData.queue_length ?? 0}</p>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-[#151f33] border border-slate-200 dark:border-[#223048]">
                    <span className="text-slate-500 text-[10px]">AVG WAIT</span>
                    <p className="text-purple-600 dark:text-purple-400 font-bold text-base">{metricsData.average_wait ?? 0}s</p>
                  </div>
                </div>

                {/* Demand Score Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Approach Demand:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{metricsData.demand_score?.toFixed(1) || '0.0'} PTS</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-[#1c273e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, (metricsData.demand_score || 0) * 1.2)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

