"""
Traffic State Engine
Owner: ML Engineer (heuristic layer, not ML — deliberately simple & explainable
for a hackathon demo; the Optimization/Algorithms teammate can tune weights).

Takes a stream of per-frame vehicle detections (with track_ids) for a single
camera/lane and maintains rolling state to compute:
    - density         : vehicles per unit ROI area
    - queue_length     : count of currently-stationary vehicles
    - avg_speed        : pixels/sec, averaged across active tracks
    - avg_waiting_time  : seconds a vehicle has been stationary, averaged
    - traffic_score    : single 0-100 composite score

State is kept per camera_id so multiple lanes/intersections can be processed
independently by the same engine instance.
"""

import time
from collections import defaultdict, deque

STATIONARY_SPEED_THRESHOLD = 5.0   # px/sec below this = considered "stopped"
TRACK_HISTORY_LEN = 30              # how many past positions to keep per track
TRACK_STALE_SECONDS = 3.0           # drop a track if not seen for this long

# Score weights — tune these live during the demo, they're intentionally simple
W_DENSITY = 0.35
W_QUEUE = 0.30
W_SLOWNESS = 0.20   # inverse of speed
W_WAITING = 0.15


class _TrackState:
    def __init__(self):
        self.positions: deque = deque(maxlen=TRACK_HISTORY_LEN)  # (x, y, timestamp)
        self.stopped_since: float | None = None
        self.last_seen: float = time.time()


class TrafficStateEngine:
    def __init__(self, roi_area_px2: float = 1.0):
        """
        roi_area_px2: area of the region-of-interest in pixels^2, used to
        normalize density. Pass the real ROI polygon area per camera if
        known; defaults to 1.0 (density becomes a raw vehicle count).
        """
        self.roi_area = roi_area_px2
        # per-camera track state: camera_id -> {track_id: _TrackState}
        self._tracks: dict[str, dict[int, _TrackState]] = defaultdict(dict)
        # per-camera rolling score history, useful for the prediction module
        self.score_history: dict[str, deque] = defaultdict(lambda: deque(maxlen=60))

    def update(self, camera_id: str, detections: list[dict]) -> dict:
        """
        Call once per processed frame for a given camera.
        `detections` is the output of VehicleDetector.detect_and_track().
        Returns the current traffic state dict for this camera.
        """
        now = time.time()
        tracks = self._tracks[camera_id]

        seen_ids = set()
        for det in detections:
            tid = det["track_id"]
            if tid is None:
                continue  # can't compute speed/waiting without a stable id
            seen_ids.add(tid)
            cx, cy = det["center"]

            if tid not in tracks:
                tracks[tid] = _TrackState()
            ts = tracks[tid]
            ts.positions.append((cx, cy, now))
            ts.last_seen = now

        # drop stale tracks (vehicle left frame / occluded too long)
        for tid in list(tracks.keys()):
            if now - tracks[tid].last_seen > TRACK_STALE_SECONDS:
                del tracks[tid]

        vehicle_count = len(detections)
        speeds = []
        waiting_times = []
        queue_count = 0

        for tid, ts in tracks.items():
            speed = self._compute_speed(ts)
            if speed is not None:
                speeds.append(speed)
                if speed < STATIONARY_SPEED_THRESHOLD:
                    if ts.stopped_since is None:
                        ts.stopped_since = now
                    queue_count += 1
                    waiting_times.append(now - ts.stopped_since)
                else:
                    ts.stopped_since = None

        density = vehicle_count / self.roi_area
        avg_speed = sum(speeds) / len(speeds) if speeds else 0.0
        avg_waiting = sum(waiting_times) / len(waiting_times) if waiting_times else 0.0

        score = self._traffic_score(density, queue_count, avg_speed, avg_waiting, vehicle_count)
        self.score_history[camera_id].append(score)

        return {
            "camera_id": camera_id,
            "vehicle_count": vehicle_count,
            "density": round(density, 4),
            "queue_length": queue_count,
            "avg_speed": round(avg_speed, 2),
            "avg_waiting_time_sec": round(avg_waiting, 1),
            "traffic_score": round(score, 1),
        }

    def _compute_speed(self, ts: _TrackState) -> float | None:
        """Pixels/sec, using the oldest and newest position in the buffer."""
        if len(ts.positions) < 2:
            return None
        x0, y0, t0 = ts.positions[0]
        x1, y1, t1 = ts.positions[-1]
        dt = t1 - t0
        if dt <= 0:
            return None
        dist = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
        return dist / dt

    def _traffic_score(self, density, queue_count, avg_speed, avg_waiting, vehicle_count) -> float:
        """
        Composite 0-100 score. Higher = more congested.
        Each term is normalized with a soft cap so one runaway metric
        doesn't blow out the whole score — tune the caps to your camera's
        typical vehicle counts / speeds during setup.
        """
        if vehicle_count == 0:
            return 0.0  # no vehicles present = no congestion, regardless of default avg_speed

        density_term = min(density * 100, 100)          # cap: assumes density ~1.0 = full
        queue_term = min(queue_count * 10, 100)          # cap: 10+ queued = max
        slowness_term = 100 - min(avg_speed, 100)         # low speed = high congestion
        waiting_term = min(avg_waiting * 5, 100)          # cap: 20s wait = max

        score = (
            W_DENSITY * density_term
            + W_QUEUE * queue_term
            + W_SLOWNESS * slowness_term
            + W_WAITING * waiting_term
        )
        return max(0.0, min(100.0, score))


if __name__ == "__main__":
    # Simulate a vehicle that arrives, slows, and stops, to sanity-check
    # that queue_length and waiting_time respond correctly.
    engine = TrafficStateEngine(roi_area_px2=768 * 432)

    frames = [
        [{"track_id": 1, "center": [100, 200], "class_name": "car", "confidence": 0.9, "bbox": [90, 190, 110, 210]}],
        [{"track_id": 1, "center": [100, 200], "class_name": "car", "confidence": 0.9, "bbox": [90, 190, 110, 210]}],
        [{"track_id": 1, "center": [100, 200], "class_name": "car", "confidence": 0.9, "bbox": [90, 190, 110, 210]}],
    ]
    for i, frame_dets in enumerate(frames):
        state = engine.update("cam_test", frame_dets)
        print(f"tick {i}: {state}")
        time.sleep(0.5)
