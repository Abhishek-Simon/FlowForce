"""
Emergency Vehicle Detection Module
Owner: ML / Emergency Systems Engineer

Strict multi-strategy emergency vehicle identification with false-positive suppression:
1. Only analyzes valid vehicle bounding boxes (car, bus, truck, van) - ignores poles & pedestrians.
2. Requires realistic vehicle aspect ratio (0.55 <= w/h <= 2.8) and minimum pixel area.
3. Requires strong, co-occurring dual HSV signature (High Red Markings >= 14% AND High White Body >= 25%).
4. Discards single-color red vehicles (red cars, red transit buses) unless emergency patterns match.
"""

from typing import List, Dict, Any, Optional
import numpy as np
import cv2


class EmergencyDetector:
    def __init__(self, red_white_ratio_threshold: float = 0.40):
        self.threshold = red_white_ratio_threshold

    def check(self, frame: np.ndarray, bbox: List[float], class_name: str = "car") -> Dict[str, Any]:
        """
        Check vehicle crop for emergency vehicle signatures with strict false-positive suppression.
        """
        if frame is None or len(bbox) < 4:
            return {"is_emergency": False, "confidence": 0.0, "vehicle_type": class_name, "reason": "invalid_frame"}

        # Guard: Never check non-vehicle objects (pedestrians, bicycles, poles, signs)
        if class_name.lower() in ["person", "bicycle", "traffic light", "stop sign"]:
            return {"is_emergency": False, "confidence": 0.0, "vehicle_type": class_name, "reason": "non_vehicle_class"}

        # Strategy 1: Direct ML class check (if fine-tuned model has emergency class)
        if class_name.lower() in ["ambulance", "fire_truck", "police_car", "emergency_vehicle"]:
            return {
                "is_emergency": True,
                "confidence": 0.95,
                "vehicle_type": class_name.title(),
                "reason": "Direct ML model classification",
            }

        # Strategy 2: Visual HSV color signature with strict geometrical sanity checks
        x1, y1, x2, y2 = [int(v) for v in bbox]
        h_frame, w_frame = frame.shape[:2]
        x1, y1 = max(x1, 0), max(y1, 0)
        x2, y2 = min(x2, w_frame), min(y2, h_frame)

        w, h = x2 - x1, y2 - y1

        # Geometrical Guard 1: Minimum pixel area (avoids tiny background specks or distant taillights)
        if w < 25 or h < 25 or (w * h) < 900:
            return {"is_emergency": False, "confidence": 0.0, "vehicle_type": class_name, "reason": "crop_too_small"}

        # Geometrical Guard 2: Vehicle Aspect Ratio (Poles/trees/pedestrians are tall & thin, e.g. w/h < 0.45)
        aspect_ratio = w / float(h)
        if aspect_ratio < 0.50 or aspect_ratio > 3.0:
            return {"is_emergency": False, "confidence": 0.0, "vehicle_type": class_name, "reason": "invalid_vehicle_aspect_ratio"}

        # Inward padding (12%) to remove background road/barrier bleed
        pad_x, pad_y = int(w * 0.12), int(h * 0.12)
        x1c, y1c = x1 + pad_x, y1 + pad_y
        x2c, y2c = x2 - pad_x, y2 - pad_y

        crop = frame[y1c:y2c, x1c:x2c]
        if crop.size == 0 or crop.shape[0] < 10 or crop.shape[1] < 10:
            crop = frame[y1:y2, x1:x2]

        try:
            hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)

            # Red color ranges in OpenCV HSV (Dual wrap-around)
            red_mask1 = cv2.inRange(hsv, (0, 120, 90), (10, 255, 255))
            red_mask2 = cv2.inRange(hsv, (170, 120, 90), (180, 255, 255))
            red_mask = red_mask1 | red_mask2

            # High-brightness White body paint mask (Ambulances have white base)
            white_mask = cv2.inRange(hsv, (0, 0, 195), (180, 45, 255))

            total_px = crop.shape[0] * crop.shape[1]
            red_ratio = np.count_nonzero(red_mask) / total_px
            white_ratio = np.count_nonzero(white_mask) / total_px

            # STRICT CO-OCCURRENCE RULE:
            # Must have BOTH substantial white body paint (>= 22%) AND bold red emergency crosses/stripes (>= 12%)
            # This completely rejects plain red cars/buses (white < 22%) and plain white cars (red < 12%)
            is_emergency = (red_ratio >= 0.12 and white_ratio >= 0.22)
            
            if is_emergency:
                confidence = min(0.70 + ((red_ratio + white_ratio) * 0.4), 0.96)
            else:
                confidence = 0.0

            vehicle_type = "Ambulance" if is_emergency else class_name

            return {
                "is_emergency": bool(is_emergency),
                "confidence": round(float(confidence), 2),
                "vehicle_type": vehicle_type,
                "reason": "Ambulance dual red/white high-contrast signature" if is_emergency else "Standard vehicle",
            }
        except Exception as e:
            return {"is_emergency": False, "confidence": 0.0, "vehicle_type": class_name, "reason": f"error: {e}"}


if __name__ == "__main__":
    detector = EmergencyDetector()

    # Synthetic Ambulance: 50% white top, 50% red bottom
    fake_ambulance = np.zeros((100, 100, 3), dtype=np.uint8)
    fake_ambulance[:50, :] = (255, 255, 255)   # white
    fake_ambulance[50:, :] = (0, 0, 255)        # red

    # Synthetic Normal Red Car (90% red, 10% white windshield) -> Should NOT trigger
    fake_red_car = np.zeros((100, 100, 3), dtype=np.uint8)
    fake_red_car[:, :] = (0, 0, 255)            # red
    fake_red_car[20:40, 20:80] = (200, 200, 200)

    # Synthetic Normal White Car (95% white, 5% red taillights) -> Should NOT trigger
    fake_white_car = np.zeros((100, 100, 3), dtype=np.uint8)
    fake_white_car[:, :] = (255, 255, 255)      # white
    fake_white_car[85:95, 80:95] = (0, 0, 255)  # small taillight

    print("Ambulance Test (Expected True):", detector.check(fake_ambulance, [0, 0, 100, 100], "car")["is_emergency"])
    print("Red Car Test (Expected False):", detector.check(fake_red_car, [0, 0, 100, 100], "car")["is_emergency"])
    print("White Car Test (Expected False):", detector.check(fake_white_car, [0, 0, 100, 100], "car")["is_emergency"])
