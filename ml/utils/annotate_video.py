"""
Video Annotator Module
Owner: Computer Vision / Video Processing Engine

Processes video frame-by-frame, runs detection, tracking, traffic metric computation,
and emergency vehicle checks, overlaying smart-city HUD metrics and color-coded bounding boxes.
Produces an annotated output MP4 video.
"""

import os
import time
from typing import Optional, Callable
import cv2

from ml.utils.detector import VehicleDetector, CLASS_COLOR_MAP
from ml.utils.traffic_engine import TrafficStateEngine
from ml.utils.emergency import EmergencyDetector

OVERLAY_BG = (15, 23, 42)  # Dark slate blue HUD panel (BGR)
TEXT_COLOR = (240, 240, 240)
EMERGENCY_COLOR = (0, 0, 255)


def annotate_video(
    input_path: str,
    output_path: str,
    camera_id: str = "CAM-01",
    conf_override: Optional[float] = None,
    progress_callback: Optional[Callable[[int, int, float], None]] = None,
) -> dict:
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input video file not found: {input_path}")

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {input_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1

    # Ensure output directory exists
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    detector = VehicleDetector(conf_threshold=conf_override if conf_override is not None else 0.35)
    engine = TrafficStateEngine(roi_area_px2=width * height)
    emergency_detector = EmergencyDetector()

    frame_idx = 0
    start_time = time.time()

    total_vehicles_seen = 0
    total_pedestrians_seen = 0
    emergency_detected_count = 0
    max_congestion = "LOW"
    max_score = 0.0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        detections = detector.detect_and_track(frame, camera_id=camera_id)
        state = engine.update(camera_id, detections)

        any_emergency = False
        for det in detections:
            is_person = (det.get("class_name") == "person")
            emg = emergency_detector.check(frame, det["bbox"], det.get("class_name", "car"))
            is_emg = emg["is_emergency"]
            det["is_emergency"] = is_emg

            if is_emg:
                any_emergency = True
                emergency_detected_count += 1

            x1, y1, x2, y2 = [int(v) for v in det["bbox"]]
            cls_name = det.get("class_name", "car")

            if is_emg:
                box_color = EMERGENCY_COLOR
            else:
                box_color = CLASS_COLOR_MAP.get(cls_name, (46, 204, 113))

            cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)

            tid = det.get("track_id")
            conf = int(det.get("confidence", 0.0) * 100)
            label = f"{cls_name} #{tid} ({conf}%)" if tid is not None else f"{cls_name} ({conf}%)"
            if is_emg:
                label = f"🚨 EMERGENCY: {label}"

            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 6, y1), box_color, -1)
            cv2.putText(frame, label, (x1 + 3, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255) if is_emg else (0, 0, 0), 1, cv2.LINE_AA)

        # Track stats
        if state["traffic_score"] > max_score:
            max_score = state["traffic_score"]
            max_congestion = state["congestion_level"]

        # Build HUD telemetry box
        elapsed = time.time() - start_time
        proc_fps = frame_idx / elapsed if elapsed > 0 else fps

        overlay_lines = [
            f"SMART TRAFFIC CONTROL | {camera_id}",
            f"Vehicles: {state['vehicle_count']} | Pedestrians: {state['pedestrian_count']}",
            f"Density: {state['density_percentage']}% | Congestion: {state['congestion_level']}",
            f"Score: {state['traffic_score']:.0f}/100 | Queue: {state['queue_length']}",
            f"Proc FPS: {proc_fps:.1f}",
        ]
        if any_emergency:
            overlay_lines.append("🚨 EMERGENCY VEHICLE DETECTED - PRIORITY REQ")

        pad = 10
        line_h = 22
        box_h = line_h * len(overlay_lines) + pad * 2
        box_w = 380

        overlay = frame.copy()
        cv2.rectangle(overlay, (10, 10), (10 + box_w, 10 + box_h), OVERLAY_BG, -1)
        cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)

        for i, line in enumerate(overlay_lines):
            if "EMERGENCY" in line:
                line_color = EMERGENCY_COLOR
            elif i == 0:
                line_color = (0, 220, 255)  # Cyan header
            else:
                line_color = TEXT_COLOR
            cv2.putText(frame, line, (20, 10 + pad + line_h * (i + 1) - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.48, line_color, 1, cv2.LINE_AA)

        writer.write(frame)

        if progress_callback and frame_idx % 5 == 0:
            pct = (frame_idx / total_frames) * 100.0
            progress_callback(frame_idx, total_frames, pct)

    cap.release()
    writer.release()

    return {
        "input_path": input_path,
        "output_path": output_path,
        "total_frames": frame_idx,
        "duration_sec": round(frame_idx / fps, 2),
        "max_score": max_score,
        "max_congestion": max_congestion,
        "emergency_events": emergency_detected_count,
    }
