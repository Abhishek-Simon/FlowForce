"""
Emergency Vehicle Detection
Owner: ML Engineer

COCO (what yolov8n.pt is trained on) has NO ambulance/fire-truck/police
class, so plain YOLO can't flag emergency vehicles out of the box. Two
options, in order of hackathon-feasibility:

  1. (THIS FILE, default) Heuristic color-signature check on each detected
     vehicle's crop — ambulances/fire trucks are usually white/red or
     white/orange with high-contrast markings. Fast, no training data
     needed, good enough for a demo with a controlled test clip.

  2. (upgrade path, see bottom of file) Fine-tune YOLO with an extra
     "emergency_vehicle" class on ~100-200 labeled images. Better accuracy,
     needs a couple hours + a labeled mini-dataset.

Swap swap EmergencyDetector's `check()` implementation for option 2 later
without changing its interface — the API layer doesn't need to change.
"""

import numpy as np
import cv2


class EmergencyDetector:
    def __init__(self, red_white_ratio_threshold: float = 0.18):
        self.threshold = red_white_ratio_threshold

    def check(self, frame: np.ndarray, bbox: list[float]) -> dict:
        x1, y1, x2, y2 = [int(v) for v in bbox]
        x1, y1 = max(x1, 0), max(y1, 0)

        # Shrink the crop inward ~15% on each side to avoid picking up
        # neighboring vehicles' colors from loose/overlapping boxes
        w, h = x2 - x1, y2 - y1
        pad_x, pad_y = int(w * 0.15), int(h * 0.15)
        x1c, y1c = x1 + pad_x, y1 + pad_y
        x2c, y2c = x2 - pad_x, y2 - pad_y

        crop = frame[y1c:y2c, x1c:x2c]
        if crop.size == 0:
            return {"is_emergency": False, "confidence": 0.0}

        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        red_mask1 = cv2.inRange(hsv, (0, 100, 80), (10, 255, 255))
        red_mask2 = cv2.inRange(hsv, (170, 100, 80), (180, 255, 255))
        red_mask = red_mask1 | red_mask2
        white_mask = cv2.inRange(hsv, (0, 0, 200), (180, 40, 255))

        total_px = crop.shape[0] * crop.shape[1]
        red_ratio = np.count_nonzero(red_mask) / total_px
        white_ratio = np.count_nonzero(white_mask) / total_px

        # BOTH must be independently significant, not just the sum —
        # this is what stops "white car + small red taillight" from firing
        is_emergency = red_ratio > 0.10 and white_ratio > 0.20
        confidence = min((red_ratio + white_ratio) / 0.5, 1.0) if is_emergency else 0.0

        return {"is_emergency": bool(is_emergency), "confidence": round(float(confidence), 2)}


if __name__ == "__main__":
    # Smoke test with a synthetic red+white patch standing in for an
    # ambulance crop, and a plain gray patch standing in for a normal car.
    detector = EmergencyDetector()

    fake_ambulance = np.zeros((100, 100, 3), dtype=np.uint8)
    fake_ambulance[:50, :] = (255, 255, 255)   # white top half (BGR)
    fake_ambulance[50:, :] = (0, 0, 255)        # red bottom half (BGR)

    fake_car = np.full((100, 100, 3), (120, 120, 120), dtype=np.uint8)  # gray

    print("Fake ambulance crop:", detector.check(fake_ambulance, [0, 0, 100, 100]))
    print("Fake normal car crop:", detector.check(fake_car, [0, 0, 100, 100]))

# ---------------------------------------------------------------------------
# UPGRADE PATH (option 2): fine-tune YOLO with an emergency_vehicle class
# ---------------------------------------------------------------------------
# 1. Collect ~100-200 images of ambulances/fire trucks/police cars
#    (Roboflow Universe has open datasets you can pull directly for this).
# 2. Label with a bounding box + class "emergency_vehicle" (Roboflow/LabelImg).
# 3. Fine-tune:
#       from ultralytics import YOLO
#       model = YOLO("yolov8n.pt")
#       model.train(data="emergency.yaml", epochs=30, imgsz=640)
# 4. Swap VehicleDetector's model_path to the fine-tuned weights, add
#    "emergency_vehicle" to VEHICLE_CLASSES in detector.py, and this file's
#    check() becomes unnecessary — emergency detection happens inline with
#    normal detection instead of as a second pass per bbox.
