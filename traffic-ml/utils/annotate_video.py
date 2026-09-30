"""
Video Annotator
Owner: ML Engineer

Takes an input video, runs it through the full pipeline (detection +
tracking + traffic engine + emergency check), and writes out an annotated
video with:
  - bounding boxes + class label + track ID on every detected vehicle
  - a stats overlay (vehicle count, traffic score, queue length, emergency
    flag) in the top-left corner of every frame

Useful both as a standalone script and as the backend for the API's
/analyze-video endpoint.

Usage (standalone):
    python3 annotate_video.py --input path/to/clip.mp4 --output path/to/out.mp4
"""

import argparse
import os
import sys

import cv2

sys.path.append(os.path.dirname(__file__))
from detector import VehicleDetector       # noqa: E402
from traffic_engine import TrafficStateEngine  # noqa: E402
from emergency import EmergencyDetector    # noqa: E402

BOX_COLOR = (46, 204, 113)          # green (BGR)
EMERGENCY_COLOR = (0, 0, 255)       # red (BGR)
TEXT_COLOR = (255, 255, 255)
OVERLAY_BG = (0, 0, 0)


def annotate_video(input_path: str, output_path: str, camera_id: str = "annotator_cam", conf_override: float | None = None):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {input_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    detector = VehicleDetector(os.path.join(os.path.dirname(__file__), "..", "yolov8n.pt"))
    if conf_override is not None:
        import detector as detector_module
        detector_module.CONF_THRESHOLD = conf_override

    engine = TrafficStateEngine(roi_area_px2=width * height)
    emergency_detector = EmergencyDetector()

    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        detections = detector.detect_and_track(frame)
        state = engine.update(camera_id, detections)

        any_emergency = False
        for det in detections:
            emg = emergency_detector.check(frame, det["bbox"])
            is_emg = emg["is_emergency"]
            any_emergency = any_emergency or is_emg

            x1, y1, x2, y2 = [int(v) for v in det["bbox"]]
            color = EMERGENCY_COLOR if is_emg else BOX_COLOR
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            tid = det["track_id"]
            label = f"{det['class_name']} #{tid}" if tid is not None else det["class_name"]
            if is_emg:
                label += " EMERGENCY"

            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 4, y1), color, -1)
            cv2.putText(frame, label, (x1 + 2, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

        overlay_lines = [
            f"Vehicles: {state['vehicle_count']}",
            f"Traffic Score: {state['traffic_score']:.0f}/100",
            f"Queue: {state['queue_length']}  Speed: {state['avg_speed']:.0f}px/s",
        ]
        if any_emergency:
            overlay_lines.append("EMERGENCY VEHICLE DETECTED")

        pad = 8
        line_h = 22
        box_h = line_h * len(overlay_lines) + pad * 2
        box_w = 320
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (box_w, box_h), OVERLAY_BG, -1)
        cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)

        for i, line in enumerate(overlay_lines):
            color = EMERGENCY_COLOR if "EMERGENCY" in line else TEXT_COLOR
            cv2.putText(frame, line, (pad, pad + line_h * (i + 1) - 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1, cv2.LINE_AA)

        writer.write(frame)
        frame_idx += 1
        if frame_idx % 50 == 0:
            print(f"  processed {frame_idx}/{total_frames} frames")

    cap.release()
    writer.release()
    print(f"Done. Wrote annotated video to {output_path} ({frame_idx} frames)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Annotate a video with vehicle detections + traffic stats")
    parser.add_argument("--input", required=True, help="Path to input video")
    parser.add_argument("--output", required=True, help="Path to write annotated output video")
    parser.add_argument("--camera_id", default="annotator_cam")
    parser.add_argument("--conf", type=float, default=None, help="Override detection confidence threshold")
    args = parser.parse_args()

    annotate_video(args.input, args.output, args.camera_id, args.conf)
