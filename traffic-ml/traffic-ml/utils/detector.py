"""
Vehicle Detection + Tracking Module

Uses the fine-tuned traffic YOLO model and converts the original
14-class model output into the final 7 UI classes.

The returned detection format remains compatible with the existing
traffic-processing/UI code.
"""

from ultralytics import YOLO
import numpy as np

from vehicle_classes import MODEL_TO_UI, UI_CLASSES


# ============================================================
# MODEL
# ============================================================

MODEL_PATH = (
    "runs/detect/runs/final_traffic/"
    "yolov8n_final_14class/weights/best.pt"
)


# ============================================================
# SETTINGS
# ============================================================

CONF_THRESHOLD = 0.35
IOU_THRESHOLD = 0.50

# Only these original model classes are allowed.
# Everything else is automatically ignored.
ALLOWED_MODEL_CLASSES = set(MODEL_TO_UI.keys())

# Used to remove overlapping duplicate detections.
DEDUP_IOU_THRESHOLD = 0.60


# ============================================================
# IOU
# ============================================================

def _iou(box_a, box_b) -> float:

    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)

    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_area = max(
        0,
        inter_x2 - inter_x1
    ) * max(
        0,
        inter_y2 - inter_y1
    )

    if inter_area <= 0:
        return 0.0

    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)

    union = area_a + area_b - inter_area

    if union <= 0:
        return 0.0

    return inter_area / union


# ============================================================
# DEDUPLICATION
# ============================================================

def _dedup_cross_class(detections: list[dict]) -> list[dict]:

    """
    Remove heavily overlapping duplicate detections.

    Highest-confidence detection is kept.
    """

    kept = []

    for det in sorted(
        detections,
        key=lambda d: d["confidence"],
        reverse=True
    ):

        duplicate = False

        for existing in kept:

            if _iou(
                det["bbox"],
                existing["bbox"]
            ) > DEDUP_IOU_THRESHOLD:

                duplicate = True
                break

        if not duplicate:
            kept.append(det)

    return kept


# ============================================================
# DETECTOR
# ============================================================

class VehicleDetector:

    def __init__(
        self,
        model_path: str = MODEL_PATH,
        device: int = 0,
    ):

        self.model = YOLO(model_path)

        self.device = device

        print("Traffic model loaded:")
        print(model_path)

        print("\nFinal UI classes:")

        for class_id, name in UI_CLASSES.items():
            print(f"  {class_id}: {name}")


    # ========================================================
    # DETECT + TRACK
    # ========================================================

    def detect_and_track(
        self,
        frame: np.ndarray
    ) -> list[dict]:

        """
        Run YOLO detection + ByteTrack tracking.

        Returns:

        [
            {
                "track_id": int | None,
                "class_name": str,
                "confidence": float,
                "bbox": [x1, y1, x2, y2],
                "center": [cx, cy],
            }
        ]
        """

        results = self.model.track(

            frame,

            persist=True,

            tracker="bytetrack.yaml",

            conf=CONF_THRESHOLD,

            iou=IOU_THRESHOLD,

            classes=list(ALLOWED_MODEL_CLASSES),

            imgsz=640,

            device=self.device,

            verbose=False,

        )[0]


        detections = []


        # ----------------------------------------------------
        # No detections
        # ----------------------------------------------------

        if results.boxes is None:
            return detections


        # ----------------------------------------------------
        # Process detections
        # ----------------------------------------------------

        for box in results.boxes:

            # Original trained-model class ID
            model_id = int(
                box.cls[0]
            )


            # ------------------------------------------------
            # Safety check
            # ------------------------------------------------

            if model_id not in MODEL_TO_UI:
                continue


            # ------------------------------------------------
            # Convert:
            #
            # 14-class model
            #       ↓
            # MODEL_TO_UI
            #       ↓
            # 7 UI classes
            # ------------------------------------------------

            ui_id = MODEL_TO_UI[model_id]

            class_name = UI_CLASSES[ui_id]


            # ------------------------------------------------
            # Confidence
            # ------------------------------------------------

            confidence = float(
                box.conf[0]
            )


            # ------------------------------------------------
            # Bounding box
            # ------------------------------------------------

            x1, y1, x2, y2 = box.xyxy[0].tolist()


            # ------------------------------------------------
            # Tracking ID
            # ------------------------------------------------

            if box.id is not None:

                track_id = int(
                    box.id[0]
                )

            else:

                track_id = None


            # ------------------------------------------------
            # Center
            # ------------------------------------------------

            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2


            # ------------------------------------------------
            # Store detection
            # ------------------------------------------------

            detections.append({

                "track_id": track_id,

                "class_name": class_name,

                "confidence": round(
                    confidence,
                    4
                ),

                "bbox": [
                    round(x1, 1),
                    round(y1, 1),
                    round(x2, 1),
                    round(y2, 1),
                ],

                "center": [
                    round(cx, 1),
                    round(cy, 1),
                ],

            })


        # ----------------------------------------------------
        # Remove overlapping duplicate boxes
        # ----------------------------------------------------

        return _dedup_cross_class(
            detections
        )


# ============================================================
# SMOKE TEST
# ============================================================

if __name__ == "__main__":

    import cv2


    detector = VehicleDetector()


    video_path = r"C:\Users\Arpit\Downloads\indian.mp4"


    cap = cv2.VideoCapture(
        video_path
    )


    if not cap.isOpened():

        raise RuntimeError(
            f"Could not open video: {video_path}"
        )


    fps = cap.get(
        cv2.CAP_PROP_FPS
    )

    if fps <= 0:
        fps = 30


    print("\nStarting detector test...")


    for i in range(100):

        ret, frame = cap.read()

        if not ret:
            break


        detections = detector.detect_and_track(
            frame
        )


        print(
            f"Frame {i}: "
            f"{len(detections)} detections"
        )


        for det in detections:

            print(
                f"  "
                f"{det['class_name']} "
                f"ID={det['track_id']} "
                f"conf={det['confidence']:.2f}"
            )


    cap.release()

    print("\nDetector test complete.")