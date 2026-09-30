"""
ML Service API
Owner: ML Engineer

This is the ONLY thing the Backend Engineer needs to talk to. Spring Boot
calls POST /analyze-frame with a camera frame + camera_id, gets back a
single JSON object with everything downstream services need: vehicle
counts, traffic score, emergency flag, and a short-term congestion
prediction.

Run with:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Backend integration note: point Spring Boot's AI-service client at
http://<this-host>:8000
"""

import sys
import os
import time
import tempfile
import uuid

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "utils"))
from detector import VehicleDetector          # noqa: E402
from traffic_engine import TrafficStateEngine  # noqa: E402
from emergency import EmergencyDetector        # noqa: E402
from prediction import TrafficPredictor        # noqa: E402
from annotate_video import annotate_video      # noqa: E402

app = FastAPI(title="Traffic ML Service")

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "runs",
    "detect",
    "runs",
    "final_traffic",
    "yolov8n_final_14class",
    "weights",
    "best.pt"
)

detector = VehicleDetector(MODEL_PATH)
emergency_detector = EmergencyDetector()
predictor = TrafficPredictor()

# One TrafficStateEngine instance shared across all cameras — it keys
# internal state by camera_id, so multiple lanes/intersections work fine.
# roi_area_px2 uses a generic frame-size default; pass a real ROI polygon
# area per camera if your team calibrates one later.
engine = TrafficStateEngine(roi_area_px2=768 * 432)


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": time.time()}


@app.post("/analyze-frame")
async def analyze_frame(
    camera_id: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Accepts a single frame (image) from a given camera and returns full
    traffic state for that camera at this instant.
    """
    contents = await file.read()
    np_arr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if frame is None:
        return JSONResponse(status_code=400, content={"error": "Could not decode image"})

    # 1. Detect + track vehicles
    detections = detector.detect_and_track(frame)

    # 2. Update traffic state engine (density/queue/speed/waiting/score)
    state = engine.update(camera_id, detections)

    # 3. Emergency detection

    ambulance_detections = [
        det for det in detections
        if det["class_name"] == "ambulance"
    ]

    any_emergency = len(ambulance_detections) > 0

    max_emergency_conf = max(
        (det["confidence"] for det in ambulance_detections),
        default=0.0
    )

    # 4. Predict short-term congestion trend from this camera's score history
    prediction = predictor.predict(list(engine.score_history[camera_id]))

    response = {
        "camera_id": camera_id,
        "timestamp": time.time(),
        "vehicle_count": state["vehicle_count"],
        "density": state["density"],
        "queue_length": state["queue_length"],
        "avg_speed": state["avg_speed"],
        "avg_waiting_time_sec": state["avg_waiting_time_sec"],
        "traffic_score": state["traffic_score"],
        "emergency_detected": any_emergency,
        "emergency_confidence": round(max_emergency_conf, 2),
        "predicted_congestion": prediction["predicted_score"],
        "predicted_trend": prediction["trend"],
        "detections": detections,  # raw per-vehicle data, useful for the frontend's CCTV overlay view
    }
    return response


@app.post("/analyze-video")
async def analyze_video(
    camera_id: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Accepts a full video upload, runs it through the pipeline frame-by-frame,
    and returns the ANNOTATED VIDEO (bounding boxes + live stats overlay)
    as a downloadable .mp4 — this is the demo-friendly endpoint.

    Note: processes synchronously, so response time scales with video
    length (~roughly real-time or slower on CPU). Fine for short demo
    clips (under ~1-2 min); for longer videos, consider running
    annotate_video.py directly instead of through the API.
    """
    contents = await file.read()

    work_dir = tempfile.mkdtemp()
    input_path = os.path.join(work_dir, f"input_{uuid.uuid4().hex}.mp4")
    output_path = os.path.join(work_dir, f"annotated_{uuid.uuid4().hex}.mp4")

    with open(input_path, "wb") as f:
        f.write(contents)

    try:
        annotate_video(input_path, output_path, camera_id=camera_id)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Video processing failed: {e}"})

    if not os.path.exists(output_path):
        return JSONResponse(status_code=500, content={"error": "Annotated video was not created"})

    return FileResponse(
        output_path,
        media_type="video/mp4",
        filename=f"annotated_{camera_id}.mp4",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
