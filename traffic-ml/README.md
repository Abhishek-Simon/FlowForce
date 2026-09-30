# Traffic ML Service — ML Engineer's Deliverable

Detection → Tracking → Traffic State → Emergency Check → Prediction, all
wrapped in one FastAPI service. This is the **only** thing the Backend
Engineer needs to integrate against — everything else in this folder is
internal.

## Quick Start

```bash
pip install -r requirements.txt
cd api
uvicorn main:app --host 0.0.0.0 --port 8000
```

Test it:
```bash
curl -X POST http://localhost:8000/analyze-frame \
  -F "camera_id=cam_01" \
  -F "file=@../samples/sample_traffic.mp4_frame.jpg"
```

## What's inside

| File | What it does |
|---|---|
| `utils/detector.py` | YOLOv8n + ByteTrack — detects & tracks cars/buses/trucks/motorcycles/bicycles per frame |
| `utils/traffic_engine.py` | Turns raw detections into density, queue length, avg speed, avg waiting time, and a 0–100 traffic score |
| `utils/emergency.py` | Flags likely ambulances/fire trucks via red+white color signature on each detected vehicle crop |
| `utils/prediction.py` | Linear trend extrapolation on recent traffic scores → short-term congestion forecast |
| `utils/annotate_video.py` | Standalone script: video in → labeled video out (bboxes, track IDs, stats overlay) |
| `utils/test_with_video.py` | Streams any video's frames to the running API for JSON-based testing |
| `api/main.py` | FastAPI service tying it all together — **this is the integration point** |

Each module has a `if __name__ == "__main__"` smoke test at the bottom — run
any file directly (`python3 detector.py`) to sanity-check it in isolation.

## API Contract (for Backend Engineer)

### `POST /analyze-video` — upload a video, get back a labeled video
**Request:** `multipart/form-data`
- `camera_id` (string)
- `file` (video) — a full video file (.mp4)

**Response:** the annotated video itself (`video/mp4`) — bounding boxes,
class + track ID labels, and a live stats overlay (vehicle count, traffic
score, queue, speed) burned into every frame. Red box + "EMERGENCY" label
if the emergency heuristic fires.

This is the demo-friendly endpoint — great for showing the team/judges a
labeled video instead of raw JSON. It processes synchronously, so response
time scales with video length (roughly real-time to a bit slower on CPU).
Fine for short clips (under ~1–2 min); for longer videos, run
`utils/annotate_video.py` directly instead of through the API — same
underlying code, just skips the upload/download overhead.

```bash
curl -X POST http://localhost:8000/analyze-video \
  -F "camera_id=cam_01" \
  -F "file=@your_clip.mp4" \
  -o annotated_output.mp4
```

### `POST /analyze-frame`
**Request:** `multipart/form-data`
- `camera_id` (string) — identifies the lane/intersection, keeps tracking state separate per camera
- `file` (image) — a single JPEG/PNG frame extracted from the CCTV stream

**Response:**
```json
{
  "camera_id": "cam_01",
  "timestamp": 1786734843.6,
  "vehicle_count": 4,
  "density": 0.31,
  "queue_length": 2,
  "avg_speed": 12.4,
  "avg_waiting_time_sec": 18.5,
  "traffic_score": 71.2,
  "emergency_detected": false,
  "emergency_confidence": 0.12,
  "predicted_congestion": 78.0,
  "predicted_trend": "rising",
  "detections": [
    {
      "track_id": 7,
      "class_name": "car",
      "confidence": 0.82,
      "bbox": [126.8, 165.7, 287.0, 375.4],
      "center": [206.9, 270.6]
    }
  ]
}
```

`detections` is included for the Frontend Engineer — it's raw per-vehicle
data useful for drawing bounding-box overlays on the CCTV dashboard view.

### `GET /health`
Returns `{"status": "ok", "timestamp": ...}` — use for a Docker healthcheck.

## Testing with your own video (any teammate)

Any team member can test the pipeline against their own video file without
writing code — a reusable client script streams frames from any video to
the running API automatically:

```bash
python3 utils/test_with_video.py \
  --video path/to/your_clip.mp4 \
  --camera_id cam_north \
  --api http://<server-ip>:8000 \
  --fps 2 \
  --save_csv results.csv
```

- `--camera_id` should be unique per video/camera — the API tracks state
  separately per camera_id, so **multiple teammates can test different
  videos against the same running server at the same time** without
  interfering with each other.
- `--fps` controls how many frames per second *of the video* get sampled
  and sent — this is not playback speed, just sampling density (2 fps is
  usually enough to see meaningful score/speed changes without hammering
  the API).
- `--save_csv` dumps every response as a row, useful for plotting
  traffic_score over time or sanity-checking results after the run.
- If the API is running on someone else's laptop on the same network,
  swap `--api` to `http://<their-ip>:8000` instead of localhost.

## Important: call this endpoint repeatedly with the SAME camera_id

Speed, queue length, and waiting time are computed from **tracking state
across calls**, not from a single frame. For a given camera, keep POSTing
consecutive frames (e.g. every ~1 sec) with the same `camera_id` string —
tracking, scoring, and prediction all improve/stabilize the more frames
that camera has seen. A single one-off frame will show `avg_speed: 0` and
`predicted_trend: "stable"` because there's no motion history yet — this is
expected, not a bug.

## Known limitations / next steps (be upfront about these in the demo)

- **Emergency detection is a color heuristic**, not a trained classifier —
  works well on a controlled test clip, may false-positive on red vehicles
  in general. Upgrade path documented at the bottom of `emergency.py`
  (fine-tune YOLO with a labeled emergency_vehicle class if time allows).
- **Prediction is linear trend extrapolation**, not a trained forecasting
  model — deliberately simple and explainable for the demo timeline.
- **Density is a raw vehicle-count ratio** — pass a real ROI polygon area
  per camera (`TrafficStateEngine(roi_area_px2=...)`) once camera
  calibration is available, otherwise it's using the full frame area as a
  rough default.
- Confidence threshold (`CONF_THRESHOLD` in `detector.py`) is set low
  (0.25) to work on our sparse/compressed test clips. **Raise it to 0.4+
  once you're running on real CCTV footage** to cut false positives.

## Sample test videos

`samples/sample_traffic.mp4` and `samples/sample_pedestrian.mp4` are public
domain test clips (Intel IoT DevKit) — sparse footage, useful for pipeline
smoke-testing but NOT representative of dense traffic. Integration/DevOps:
please source a real dense-traffic CCTV clip for the actual demo dataset.
