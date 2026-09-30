"""
Vehicle & Pedestrian Detection + Tracking Module
Owner: ML / Computer Vision Engine

Wraps YOLOv8 (fine-tuned traffic model or pretrained COCO) + ByteTrack to detect and track vehicles.
Supports 7 UI classes (ambulance, three wheeler, bus, car, motorbike, truck, tractor) when fine-tuned weights are present,
with fallback to COCO detection classes.
"""

import os
import time
from typing import List, Dict, Any, Optional
import numpy as np
from ultralytics import YOLO

try:
    from ml.utils.vehicle_classes import MODEL_TO_UI, UI_CLASSES, ALLOWED_MODEL_IDS
except ImportError:
    try:
        from vehicle_classes import MODEL_TO_UI, UI_CLASSES, ALLOWED_MODEL_IDS
    except ImportError:
        MODEL_TO_UI = None
        UI_CLASSES = None
        ALLOWED_MODEL_IDS = None

# Fallback detection classes with COCO IDs
COCO_DETECTION_CLASSES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

CLASS_COLOR_MAP = {
    "person": (255, 140, 0),      # Blue/Cyan in BGR
    "bicycle": (255, 215, 0),     # Gold/Cyan
    "car": (46, 204, 113),        # Green
    "motorbike": (0, 230, 255),   # Yellow
    "motorcycle": (0, 230, 255),
    "three wheeler": (255, 165, 0),
    "bus": (204, 102, 255),       # Purple
    "truck": (0, 140, 255),       # Orange
    "tractor": (128, 128, 0),
    "ambulance": (0, 0, 255),     # Red
    "emergency": (0, 0, 255),
}

DEFAULT_CONF_THRESHOLD = 0.30
DEDUP_IOU_THRESHOLD = 0.60


def _iou(box_a: List[float], box_b: List[float]) -> float:
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b
    inter_x1, inter_y1 = max(ax1, bx1), max(ay1, by1)
    inter_x2, inter_y2 = min(ax2, bx2), min(ay2, by2)
    inter_area = max(0.0, inter_x2 - inter_x1) * max(0.0, inter_y2 - inter_y1)
    if inter_area == 0:
        return 0.0
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    union = area_a + area_b - inter_area
    return float(inter_area / union) if union > 0 else 0.0


def _dedup_cross_class(detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    kept = []
    for det in sorted(detections, key=lambda d: d["confidence"], reverse=True):
        if any(_iou(det["bbox"], k["bbox"]) > DEDUP_IOU_THRESHOLD for k in kept):
            continue
        kept.append(det)
    return kept


class VehicleDetector:
    def __init__(
        self,
        model_path: Optional[str] = None,
        conf_threshold: float = DEFAULT_CONF_THRESHOLD,
        imgsz: int = 640,
    ):
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

        candidates = []
        if model_path:
            candidates.append(model_path if os.path.isabs(model_path) else os.path.join(base_dir, model_path))

        candidates.extend([
            os.path.join(base_dir, "ml", "models", "best.pt"),
            os.path.join(base_dir, "traffic-ml", "runs", "detect", "runs", "final_traffic", "yolov8n_final_14class", "weights", "best.pt"),
            os.path.join(base_dir, "ml", "models", "yolov8s.pt"),
            os.path.join(base_dir, "ml", "models", "yolov8n.pt"),
            "yolov8n.pt",
        ])

        resolved_path = None
        for p in candidates:
            if os.path.exists(p) or p in ["yolov8s.pt", "yolov8n.pt"]:
                resolved_path = p
                break

        self.model_path = resolved_path or "yolov8n.pt"
        self.conf_threshold = conf_threshold
        self.imgsz = imgsz
        self.is_custom_traffic_model = False

        try:
            self.model = YOLO(self.model_path)
            self.has_model = True
            if "best.pt" in self.model_path or (hasattr(self.model, "names") and len(self.model.names) == 14):
                self.is_custom_traffic_model = True
        except Exception as e:
            print(f"[VehicleDetector] Warning: could not load YOLO model from {self.model_path}: {e}")
            try:
                self.model = YOLO("yolov8n.pt")
                self.has_model = True
            except Exception as e2:
                print(f"[VehicleDetector] Fallback failed: {e2}")
                self.model = None
                self.has_model = False

    def detect_and_track(
        self,
        frame: np.ndarray,
        camera_id: str = "CAM-01",
        conf_threshold: Optional[float] = None,
        enable_tracking: bool = True,
        imgsz: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Run detection and tracking on a single image frame.
        Returns list of detection objects.
        """
        if not self.has_model or frame is None:
            return []

        conf = conf_threshold if conf_threshold is not None else self.conf_threshold
        target_imgsz = imgsz if imgsz is not None else self.imgsz
        now_ts = time.time()

        try:
            allowed_classes = list(ALLOWED_MODEL_IDS) if (self.is_custom_traffic_model and ALLOWED_MODEL_IDS) else list(COCO_DETECTION_CLASSES.keys())

            if enable_tracking:
                results = self.model.track(
                    frame,
                    persist=True,
                    tracker="bytetrack.yaml",
                    conf=conf,
                    imgsz=target_imgsz,
                    classes=allowed_classes,
                    verbose=False,
                )[0]
            else:
                results = self.model.predict(
                    frame,
                    conf=conf,
                    imgsz=target_imgsz,
                    classes=allowed_classes,
                    verbose=False,
                )[0]

            detections = []
            if results.boxes is None:
                return detections

            for box in results.boxes:
                cls_id = int(box.cls[0])
                
                if self.is_custom_traffic_model and MODEL_TO_UI and UI_CLASSES:
                    if cls_id not in MODEL_TO_UI:
                        continue
                    ui_id = MODEL_TO_UI[cls_id]
                    class_name = UI_CLASSES[ui_id]
                else:
                    if cls_id not in COCO_DETECTION_CLASSES:
                        continue
                    class_name = COCO_DETECTION_CLASSES[cls_id]

                x1, y1, x2, y2 = box.xyxy[0].tolist()
                track_id = int(box.id[0]) if (enable_tracking and box.id is not None) else None
                confidence = float(box.conf[0])

                cx = round((x1 + x2) / 2.0, 1)
                cy = round((y1 + y2) / 2.0, 1)

                detections.append({
                    "tracking_id": track_id,
                    "track_id": track_id,
                    "class_name": class_name,
                    "class_id": cls_id,
                    "confidence": round(confidence, 3),
                    "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                    "x1": round(x1, 1),
                    "y1": round(y1, 1),
                    "x2": round(x2, 1),
                    "y2": round(y2, 1),
                    "center": [cx, cy],
                    "center_x": cx,
                    "center_y": cy,
                    "timestamp": now_ts,
                    "camera_id": camera_id,
                })

            return _dedup_cross_class(detections)
        except Exception as err:
            print(f"[VehicleDetector] Exception during inference: {err}")
            return []

