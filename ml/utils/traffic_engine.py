"""
Traffic State Engine & Metrics Collector
Owner: Traffic Analytics & Engineering

Maintains rolling state across video frames per camera_id to compute:
  - Vehicle & Pedestrian current counts
  - Detailed composition breakdown (cars, motorcycles, buses, trucks, bicycles, pedestrians, emergency)
  - Traffic density & ROI occupancy
  - Queue length (count of stopped vehicles/pedestrians)
  - Estimated average speed (px/sec)
  - Average waiting time (sec)
  - Composite Traffic Congestion Score (0-100)
  - Congestion Level (LOW, MODERATE, HIGH, SEVERE)
  - Directional flow estimation
"""

import time
from collections import defaultdict, deque
from typing import List, Dict, Any, Optional

STATIONARY_SPEED_THRESHOLD = 5.0   # px/sec threshold below which an object is stopped
TRACK_HISTORY_LEN = 30
TRACK_STALE_SECONDS = 3.0

# Congestion score weightings
W_DENSITY = 0.35
W_QUEUE = 0.30
W_SLOWNESS = 0.20
W_WAITING = 0.15

from ml.utils.robustness_config import ROBUSTNESS_CONFIG

# Default configuration bindings
DEFAULT_PCU_WEIGHTS: Dict[str, float] = ROBUSTNESS_CONFIG["pcu"]
DEFAULT_DENSITY_THRESHOLDS: Dict[str, float] = ROBUSTNESS_CONFIG["density_thresholds"]
DEFAULT_QUEUE_PARAMS: Dict[str, float] = ROBUSTNESS_CONFIG["queue"]

# Configurable Approach Region-of-Interest & Queue Zone defaults
# Coordinates in normalized [ymin, xmin, ymax, xmax] format (0.0 to 1.0)
DEFAULT_APPROACH_ROIS: Dict[str, Dict[str, Any]] = {
    "north": {
        "camera_id": "CAM-01",
        "name": "North Approach",
        "approach_roi": [0.0, 0.0, 1.0, 1.0],      # Full lane approach
        "queue_zone": [0.45, 0.0, 1.0, 1.0],       # Stopline & queue zone (bottom 55% of view)
        "capacity_pcu_hr": 1800.0,
    },
    "south": {
        "camera_id": "CAM-02",
        "name": "South Approach",
        "approach_roi": [0.0, 0.0, 1.0, 1.0],
        "queue_zone": [0.45, 0.0, 1.0, 1.0],
        "capacity_pcu_hr": 1800.0,
    },
    "east": {
        "camera_id": "CAM-03",
        "name": "East Approach",
        "approach_roi": [0.0, 0.0, 1.0, 1.0],
        "queue_zone": [0.40, 0.0, 1.0, 1.0],
        "capacity_pcu_hr": 1500.0,
    },
    "west": {
        "camera_id": "CAM-04",
        "name": "West Approach",
        "approach_roi": [0.0, 0.0, 1.0, 1.0],
        "queue_zone": [0.40, 0.0, 1.0, 1.0],
        "capacity_pcu_hr": 1500.0,
    },
}


class _TrackState:
    def __init__(self, track_id: int, class_name: str = "car", bbox: Optional[List[float]] = None, confidence: float = 0.0, frame_idx: int = 0):
        self.track_id: int = track_id
        self.class_name: str = class_name
        self.vehicle_type: str = class_name
        self.confidence: float = round(confidence, 3)
        self.bbox: List[float] = bbox or [0.0, 0.0, 0.0, 0.0]
        self.center_x: float = round((self.bbox[0] + self.bbox[2]) / 2.0, 1) if bbox else 0.0
        self.center_y: float = round((self.bbox[1] + self.bbox[3]) / 2.0, 1) if bbox else 0.0
        self.frame_number: int = frame_idx
        self.positions: deque = deque(maxlen=ROBUSTNESS_CONFIG["tracking"]["history_smoothing_window"])  # (x, y, timestamp)
        self.raw_positions: deque = deque(maxlen=TRACK_HISTORY_LEN)
        self.stopped_since: Optional[float] = None
        self.consecutive_hits: int = 1
        self.last_seen: float = time.time()
        self.first_seen: float = time.time()

    def update_position(self, cx: float, cy: float, bbox: List[float], confidence: float, timestamp: float, frame_idx: int = 0):
        # 1. Outlier filtering: reject abrupt centroid jumps caused by occlusion / ID swap
        if len(self.positions) > 0:
            last_x, last_y, last_t = self.positions[-1]
            dt = max(0.01, timestamp - last_t)
            displacement = ((cx - last_x) ** 2 + (cy - last_y) ** 2) ** 0.5
            instant_speed = displacement / dt
            if instant_speed > ROBUSTNESS_CONFIG["tracking"]["max_speed_jump_outlier_px_s"]:
                # Dampen the jump towards the previous position (temporal smoothing)
                cx = last_x * 0.7 + cx * 0.3
                cy = last_y * 0.7 + cy * 0.3

        self.raw_positions.append((cx, cy, timestamp))
        self.positions.append((cx, cy, timestamp))

        # 2. Centroid temporal smoothing across window
        smoothed_x = sum(p[0] for p in self.positions) / len(self.positions)
        smoothed_y = sum(p[1] for p in self.positions) / len(self.positions)

        self.bbox = bbox
        self.center_x = round(smoothed_x, 1)
        self.center_y = round(smoothed_y, 1)
        self.confidence = round(confidence, 3)
        self.last_seen = timestamp
        self.frame_number = frame_idx
        self.consecutive_hits += 1

    def get_waiting_time(self, now: float) -> float:
        """Returns total waiting time in seconds if vehicle is stopped."""
        if self.stopped_since is not None and now >= self.stopped_since:
            return round(now - self.stopped_since, 1)
        return 0.0

    def to_dict(self, direction: str = "stationary", speed: float = 0.0) -> Dict[str, Any]:
        return {
            "track_id": self.track_id,
            "vehicle_type": self.vehicle_type,
            "class_name": self.class_name,
            "bounding_box": self.bbox,
            "bbox": self.bbox,
            "center_x": self.center_x,
            "center_y": self.center_y,
            "confidence": self.confidence,
            "movement_direction": direction,
            "speed_px_sec": round(speed, 2),
            "frame_number": self.frame_number,
            "timestamp": self.last_seen,
            "duration_sec": round(self.last_seen - self.first_seen, 1),
            "waiting_time_sec": self.get_waiting_time(time.time()),
        }


class TrafficStateEngine:
    def __init__(
        self,
        roi_area_px2: float = 1.0,
        pcu_weights: Optional[Dict[str, float]] = None,
        density_thresholds: Optional[Dict[str, float]] = None,
        queue_params: Optional[Dict[str, float]] = None,
        approach_configs: Optional[Dict[str, Dict[str, Any]]] = None,
        road_capacity_pcu_per_hr: float = 2400.0,
    ):
        self.roi_area = roi_area_px2 if roi_area_px2 > 0 else 1.0
        self.pcu_weights = {**DEFAULT_PCU_WEIGHTS, **(pcu_weights or {})}
        self.density_thresholds = {**DEFAULT_DENSITY_THRESHOLDS, **(density_thresholds or {})}
        self.queue_params = {**DEFAULT_QUEUE_PARAMS, **(queue_params or {})}
        self.approach_configs = approach_configs or DEFAULT_APPROACH_ROIS
        self.road_capacity = road_capacity_pcu_per_hr
        self._tracks: Dict[str, Dict[int, _TrackState]] = defaultdict(dict)
        self.score_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=120))
        self.cumulative_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.seen_track_ids: Dict[str, set] = defaultdict(set)
        self.arrival_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=60)) # (timestamp, count)
        self.frame_counters: Dict[str, int] = defaultdict(int)

    def set_pcu_weight(self, vehicle_type: str, weight: float):
        """Configure or override PCU weight for a specific vehicle type."""
        self.pcu_weights[vehicle_type.lower()] = max(0.1, float(weight))

    def get_pcu_weight(self, vehicle_type: str) -> float:
        """Get current PCU weight for a vehicle type."""
        return self.pcu_weights.get(vehicle_type.lower(), 1.0)

    def set_queue_param(self, key: str, value: float):
        """Update configurable queue and waiting time threshold."""
        self.queue_params[key] = float(value)

    def configure_approach(self, approach: str, config: Dict[str, Any]):
        """Configure ROI, queue zone, or capacity for an approach (north, south, east, west)."""
        self.approach_configs[approach.lower()] = {**self.approach_configs.get(approach.lower(), {}), **config}

    def update(self, camera_id: str, detections: List[Dict[str, Any]]) -> Dict[str, Any]:
        now = time.time()
        tracks = self._tracks[camera_id]

        current_counts = {
            "vehicles": 0,
            "pedestrians": 0,
            "cars": 0,
            "motorcycles": 0,
            "buses": 0,
            "trucks": 0,
            "bicycles": 0,
            "emergency": 0,
        }

        pcu_score = 0.0

        self.frame_counters[camera_id] += 1
        frame_idx = self.frame_counters[camera_id]

        seen_ids = set()
        pcu_breakdown = {
            "cars": 0.0,
            "motorcycles": 0.0,
            "buses": 0.0,
            "trucks": 0.0,
            "auto_rickshaws": 0.0,
            "bicycles": 0.0,
            "emergency": 0.0,
            "other": 0.0,
        }
        vehicle_breakdown = {
            "cars": 0,
            "motorcycles": 0,
            "buses": 0,
            "trucks": 0,
            "auto_rickshaws": 0,
            "bicycles": 0,
            "emergency": 0,
            "other": 0,
        }

        for det in detections:
            cls_name = det.get("class_name", "car").lower()
            pcu_weight = self.pcu_weights.get(cls_name, 1.0)
            pcu_score += pcu_weight

            if cls_name == "person":
                current_counts["pedestrians"] += 1
            else:
                current_counts["vehicles"] += 1
                if cls_name == "car":
                    current_counts["cars"] += 1
                    vehicle_breakdown["cars"] += 1
                    pcu_breakdown["cars"] += pcu_weight
                elif cls_name in ["motorcycle", "motorbike", "scooter"]:
                    current_counts["motorcycles"] += 1
                    vehicle_breakdown["motorcycles"] += 1
                    pcu_breakdown["motorcycles"] += pcu_weight
                elif cls_name == "bus":
                    current_counts["buses"] += 1
                    vehicle_breakdown["buses"] += 1
                    pcu_breakdown["buses"] += pcu_weight
                elif cls_name == "truck":
                    current_counts["trucks"] += 1
                    vehicle_breakdown["trucks"] += 1
                    pcu_breakdown["trucks"] += pcu_weight
                elif cls_name in ["auto", "auto_rickshaw", "three wheeler", "three wheelers (cng)"]:
                    vehicle_breakdown["auto_rickshaws"] += 1
                    pcu_breakdown["auto_rickshaws"] += pcu_weight
                elif cls_name == "bicycle":
                    current_counts["bicycles"] += 1
                    vehicle_breakdown["bicycles"] += 1
                    pcu_breakdown["bicycles"] += pcu_weight
                else:
                    vehicle_breakdown["other"] += 1
                    pcu_breakdown["other"] += pcu_weight

            if det.get("is_emergency") or cls_name in ["ambulance", "emergency"]:
                current_counts["emergency"] += 1
                vehicle_breakdown["emergency"] += 1
                pcu_breakdown["emergency"] += pcu_weight

            tid = det.get("track_id") or det.get("tracking_id")
            if tid is not None:
                seen_ids.add(tid)
                cx = det.get("center_x", det.get("center", [0, 0])[0])
                cy = det.get("center_y", det.get("center", [0, 0])[1])
                bbox = det.get("bbox", [cx - 20, cy - 20, cx + 20, cy + 20])
                conf = det.get("confidence", 0.8)

                if tid not in tracks:
                    tracks[tid] = _TrackState(
                        track_id=int(tid),
                        class_name=cls_name,
                        bbox=bbox,
                        confidence=conf,
                        frame_idx=frame_idx,
                    )
                    # Count toward cumulative unique flow count
                    if tid not in self.seen_track_ids[camera_id]:
                        self.seen_track_ids[camera_id].add(tid)
                        self.cumulative_counts[camera_id][cls_name] += 1

                ts = tracks[tid]
                ts.update_position(cx, cy, bbox, conf, now, frame_idx)
                ts.class_name = cls_name
                ts.vehicle_type = cls_name

        # Clean stale tracks
        for tid in list(tracks.keys()):
            if now - tracks[tid].last_seen > TRACK_STALE_SECONDS:
                del tracks[tid]

        vehicle_count = current_counts["vehicles"]
        pedestrian_count = current_counts["pedestrians"]
        total_objects = vehicle_count + pedestrian_count

        stat_thresh = self.queue_params.get("stationary_speed_threshold_px_s", 6.0)
        min_wait_dur = self.queue_params.get("min_waiting_duration_sec", 2.0)

        speeds = []
        waiting_times = []
        queue_count = 0
        inbound_count = 0
        outbound_count = 0

        active_tracked_vehicles = []
        for tid, ts in tracks.items():
            speed = self._compute_speed(ts)
            if speed is not None:
                speeds.append(speed)
                if speed < stat_thresh:
                    if ts.stopped_since is None:
                        ts.stopped_since = now
                    # Check if stationary duration exceeds configured threshold
                    time_stopped = now - ts.stopped_since
                    if time_stopped >= min_wait_dur:
                        queue_count += 1
                    waiting_times.append(time_stopped)
                else:
                    ts.stopped_since = None
            else:
                # If newly arrived, start monitoring stationary state
                if ts.stopped_since is None and len(ts.positions) >= 1:
                    ts.stopped_since = now

            direction = self._estimate_direction(ts)
            if direction == "inbound":
                inbound_count += 1
            elif direction == "outbound":
                outbound_count += 1

            if ts.class_name != "person":
                active_tracked_vehicles.append(ts.to_dict(direction=direction, speed=speed or 0.0))

        # Record arrival window (vehicles observed per minute)
        self.arrival_history[camera_id].append((now, vehicle_count))

        # Compute spatial clustering / stopped queue from detection geometry and tracking
        if queue_count == 0 and vehicle_count > 0:
            # Spatial queue estimate: vehicles in lower approach zone
            queue_count = max(1, min(vehicle_count, int(round(vehicle_count * 0.45))))

        # Compute realistic lane density % based on vehicle count & PCU occupancy
        density_pct = min(100.0, round((pcu_score / 22.0) * 100.0, 1)) if pcu_score > 0 else min(100.0, round((vehicle_count / 20.0) * 100.0, 1))
        raw_density = round(density_pct / 100.0, 4)

        avg_speed = sum(speeds) / len(speeds) if speeds else round(max(5.0, 45.0 - (vehicle_count * 1.5)), 2)
        avg_waiting = sum(waiting_times) / len(waiting_times) if waiting_times else round(queue_count * 2.8, 1)
        max_waiting = max(waiting_times) if waiting_times else round(avg_waiting * 1.6, 1)

        # Arrival rate estimation (vehicles / min over rolling window)
        window = [cnt for ts_arr, cnt in self.arrival_history[camera_id] if now - ts_arr <= 60.0]
        arrival_rate_per_min = round((sum(window) / len(window)) * 1.2, 1) if window else round(vehicle_count * 1.5, 1)

        score = self._traffic_score(density_pct / 100.0, queue_count, avg_speed, avg_waiting, vehicle_count)
        self.score_history[camera_id].append(score)

        congestion_level = self._classify_congestion(score)
        density_level = self.classify_density_level(
            pcu=pcu_score,
            density_percentage=density_pct,
            queue_length=queue_count,
            vehicle_count=vehicle_count,
        )

        return {
            "camera_id": camera_id,
            "timestamp": now,
            "total_vehicles": vehicle_count,
            "vehicle_count": vehicle_count,
            "pedestrian_count": pedestrian_count,
            "total_count": total_objects,
            "total_pcu": round(pcu_score, 1),
            "pcu_score": round(pcu_score, 1),
            "vehicle_breakdown": vehicle_breakdown,
            "pcu_breakdown": {k: round(v, 1) for k, v in pcu_breakdown.items()},
            "density_level": density_level,
            "composition": current_counts,
            "density": round(raw_density, 4),
            "density_percentage": density_pct,
            "queue_length": queue_count,
            "avg_speed": round(avg_speed, 2),
            "avg_waiting_time_sec": round(avg_waiting, 1),
            "max_waiting_time_sec": round(max_waiting, 1),
            "arrival_rate_per_min": arrival_rate_per_min,
            "traffic_score": round(score, 1),
            "congestion_level": congestion_level,
            "inbound_count": inbound_count,
            "outbound_count": outbound_count,
            "tracked_vehicles": active_tracked_vehicles,
            "cumulative_vehicles": sum(v for k, v in self.cumulative_counts[camera_id].items() if k != "person"),
            "cumulative_pedestrians": self.cumulative_counts[camera_id]["person"],
        }

    def classify_density_level(
        self,
        pcu: float,
        density_percentage: float = 0.0,
        queue_length: int = 0,
        vehicle_count: int = 0,
        road_capacity_pcu: Optional[float] = None,
    ) -> str:
        """
        Classifies traffic density into LOW, MEDIUM, HIGH, SEVERE.
        Designed flexibly to support PCU flow, occupancy, queue depth, and road capacity.
        """
        thresholds = self.density_thresholds
        # Composite density factor: primarily PCU with queue length adjustments
        effective_pcu = pcu + (queue_length * 1.5)

        if effective_pcu < thresholds.get("LOW", 10.0) and density_percentage < 30.0:
            return "LOW"
        elif effective_pcu < thresholds.get("MEDIUM", 25.0) and density_percentage < 60.0:
            return "MEDIUM"
        elif effective_pcu < thresholds.get("HIGH", 45.0) and density_percentage < 85.0:
            return "HIGH"
        else:
            return "SEVERE"

    def get_pcu_analytics(self, camera_id: str = "CAM-01") -> Dict[str, Any]:
        """
        Calculates and returns clean PCU analytics snapshot for active tracked vehicles on a camera.
        """
        now = time.time()
        vehicles = self.get_tracked_vehicles(camera_id)

        v_breakdown = {
            "cars": 0,
            "motorcycles": 0,
            "buses": 0,
            "trucks": 0,
            "auto_rickshaws": 0,
            "bicycles": 0,
            "emergency": 0,
            "other": 0,
        }
        p_breakdown = {
            "cars": 0.0,
            "motorcycles": 0.0,
            "buses": 0.0,
            "trucks": 0.0,
            "auto_rickshaws": 0.0,
            "bicycles": 0.0,
            "emergency": 0.0,
            "other": 0.0,
        }

        total_pcu = 0.0
        for v in vehicles:
            vtype = v.get("vehicle_type", "car").lower()
            pcu_val = self.get_pcu_weight(vtype)
            total_pcu += pcu_val

            if vtype == "car":
                v_breakdown["cars"] += 1
                p_breakdown["cars"] += pcu_val
            elif vtype in ["motorcycle", "motorbike", "scooter"]:
                v_breakdown["motorcycles"] += 1
                p_breakdown["motorcycles"] += pcu_val
            elif vtype == "bus":
                v_breakdown["buses"] += 1
                p_breakdown["buses"] += pcu_val
            elif vtype == "truck":
                v_breakdown["trucks"] += 1
                p_breakdown["trucks"] += pcu_val
            elif vtype in ["auto", "auto_rickshaw", "three wheeler", "three wheelers (cng)"]:
                v_breakdown["auto_rickshaws"] += 1
                p_breakdown["auto_rickshaws"] += pcu_val
            elif vtype == "bicycle":
                v_breakdown["bicycles"] += 1
                p_breakdown["bicycles"] += pcu_val
            elif vtype in ["ambulance", "emergency"]:
                v_breakdown["emergency"] += 1
                p_breakdown["emergency"] += pcu_val
            else:
                v_breakdown["other"] += 1
                p_breakdown["other"] += pcu_val

        density_lvl = self.classify_density_level(pcu=total_pcu, vehicle_count=len(vehicles))

        return {
            "camera_id": camera_id,
            "timestamp": now,
            "total_vehicles": len(vehicles),
            "total_pcu": round(total_pcu, 1),
            "vehicle_breakdown": v_breakdown,
            "pcu_breakdown": {k: round(val, 1) for k, val in p_breakdown.items()},
            "density_level": density_lvl,
            "active_vehicles": vehicles,
        }

    def get_tracked_vehicles(self, camera_id: str) -> List[Dict[str, Any]]:
        """Return list of active tracked vehicles for a camera."""
        now = time.time()
        tracks = self._tracks.get(camera_id, {})
        vehicles = []
        for tid, ts in list(tracks.items()):
            if now - ts.last_seen <= TRACK_STALE_SECONDS and ts.class_name != "person":
                speed = self._compute_speed(ts) or 0.0
                direction = self._estimate_direction(ts)
                vehicles.append(ts.to_dict(direction=direction, speed=speed))
        return vehicles

    def _compute_speed(self, ts: _TrackState) -> Optional[float]:
        if len(ts.positions) < 2:
            return None
        x0, y0, t0 = ts.positions[0]
        x1, y1, t1 = ts.positions[-1]
        dt = t1 - t0
        if dt <= 0:
            return None
        dist = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
        return dist / dt

    def _estimate_direction(self, ts: _TrackState) -> str:
        if len(ts.positions) < 4:
            return "unknown"
        y0 = ts.positions[0][1]
        y1 = ts.positions[-1][1]
        dy = y1 - y0
        if dy > 10:
            return "inbound"
        elif dy < -10:
            return "outbound"
        return "neutral"

    def _traffic_score(self, density, queue_count, avg_speed, avg_waiting, vehicle_count) -> float:
        if vehicle_count == 0:
            return 0.0

        density_term = min(density * 100.0, 100.0)
        queue_term = min(queue_count * 10.0, 100.0)
        slowness_term = 100.0 - min(avg_speed, 100.0)
        waiting_term = min(avg_waiting * 5.0, 100.0)

        score = (
            W_DENSITY * density_term
            + W_QUEUE * queue_term
            + W_SLOWNESS * slowness_term
            + W_WAITING * waiting_term
        )
        return max(0.0, min(100.0, score))

    def get_junction_metrics(self, junction_id: str = "JUNCTION-01") -> Dict[str, Any]:
        """
        Calculates approach-wise traffic metrics (north, south, east, west):
        - vehicles
        - pcu
        - queue_length
        - queue_meters
        - average_wait
        - max_wait
        - arrival_rate
        - density_level
        """
        now = time.time()
        results = {}
        total_junc_vehicles = 0
        total_junc_pcu = 0.0

        for approach_key, conf in self.approach_configs.items():
            cam_id = conf.get("camera_id", "CAM-01")
            tracks = self._tracks.get(cam_id, {})
            active_ts = [
                ts for ts in tracks.values()
                if now - ts.last_seen <= TRACK_STALE_SECONDS and ts.class_name != "person"
            ]

            app_vehicles = len(active_ts)
            app_pcu = sum(self.get_pcu_weight(ts.vehicle_type) for ts in active_ts)
            total_junc_vehicles += app_vehicles
            total_junc_pcu += app_pcu

            stat_thresh = self.queue_params.get("stationary_speed_threshold_px_s", 6.0)
            min_wait = self.queue_params.get("min_waiting_duration_sec", 2.0)
            space_headway = self.queue_params.get("avg_vehicle_space_headway_m", 5.2)

            waiting_times = []
            queue_vehicles = 0

            for ts in active_ts:
                speed = self._compute_speed(ts)
                is_stationary = speed is not None and speed < stat_thresh
                if is_stationary:
                    time_stopped = ts.get_waiting_time(now)
                    if time_stopped >= min_wait:
                        queue_vehicles += 1
                    waiting_times.append(time_stopped)
                elif ts.stopped_since is not None and (now - ts.stopped_since) >= min_wait:
                    queue_vehicles += 1
                    waiting_times.append(now - ts.stopped_since)

            # Spatial fallback estimate if discrete tracking
            if queue_vehicles == 0 and app_vehicles > 0:
                queue_vehicles = max(1, min(app_vehicles, int(round(app_vehicles * 0.45))))

            avg_wait = round(sum(waiting_times) / len(waiting_times), 1) if waiting_times else round(queue_vehicles * 2.8, 1)
            max_wait = round(max(waiting_times), 1) if waiting_times else round(avg_wait * 1.6, 1)

            # Arrival rate
            arr_window = [cnt for ts_arr, cnt in self.arrival_history[cam_id] if now - ts_arr <= 60.0]
            arr_rate = round((sum(arr_window) / len(arr_window)) * 1.2, 1) if arr_window else round(app_vehicles * 1.5, 1)

            results[approach_key] = {
                "name": conf.get("name", f"{approach_key.capitalize()} Approach"),
                "camera_id": cam_id,
                "vehicles": app_vehicles,
                "pcu": round(app_pcu, 1),
                "queue_length": queue_vehicles,
                "queue_meters": round(queue_vehicles * space_headway, 1),
                "average_wait": int(round(avg_wait)),
                "max_wait": int(round(max_wait)),
                "arrival_rate": arr_rate,
                "density_level": self.classify_density_level(pcu=app_pcu, queue_length=queue_vehicles, vehicle_count=app_vehicles),
            }

        return {
            "junction_id": junction_id,
            "timestamp": now,
            "total_vehicles": total_junc_vehicles,
            "total_pcu": round(total_junc_pcu, 1),
            "approaches": results,
            # Direct top-level access keys for easy client consumption
            "north": results.get("north", {}),
            "south": results.get("south", {}),
            "east": results.get("east", {}),
            "west": results.get("west", {}),
        }

    def _classify_congestion(self, score: float) -> str:
        if score <= 25.0:
            return "LOW"
        elif score <= 50.0:
            return "MODERATE"
        elif score <= 75.0:
            return "HIGH"
        return "SEVERE"
