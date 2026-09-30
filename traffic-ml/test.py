from ultralytics import YOLO
import cv2
import os
from collections import defaultdict, deque

from vehicle_classes import MODEL_TO_UI, UI_CLASSES


# ============================================================
# CONFIGURATION
# ============================================================

MODEL_PATH = (
    "runs/detect/runs/final_traffic/"
    "yolov8n_final_14class/weights/best.pt"
)

VIDEO_PATH = r"C:\Users\J.A.R.V.I.S\Downloads\test4.mp4"

OUTPUT_PATH = r"runs\7class_ui_test4.mp4"

CONFIDENCE = 0.10
IOU = 0.50
IMGSZ = 640
DEVICE = 'cpu'

# Number of previous predictions used to stabilize a track's class
CLASS_HISTORY_SIZE = 12


# ============================================================
# CLASS STABILIZATION
# ============================================================

class_history = defaultdict(
    lambda: deque(maxlen=CLASS_HISTORY_SIZE)
)


# ============================================================
# LOAD MODEL
# ============================================================

print("Loading model...")

model = YOLO(MODEL_PATH)

print("Model loaded.")
print("Processing:", VIDEO_PATH)


# ============================================================
# OPEN VIDEO
# ============================================================

cap = cv2.VideoCapture(VIDEO_PATH)

if not cap.isOpened():
    raise RuntimeError(
        f"Could not open video: {VIDEO_PATH}"
    )


fps = cap.get(cv2.CAP_PROP_FPS)

width = int(
    cap.get(cv2.CAP_PROP_FRAME_WIDTH)
)

height = int(
    cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
)

total_frames = int(
    cap.get(cv2.CAP_PROP_FRAME_COUNT)
)


if fps <= 0:
    fps = 30


print(
    f"Resolution: {width}x{height}"
)

print(
    f"FPS: {fps:.2f}"
)

print(
    f"Frames: {total_frames}"
)


# ============================================================
# CREATE OUTPUT DIRECTORY
# ============================================================

os.makedirs(
    os.path.dirname(OUTPUT_PATH),
    exist_ok=True
)


# ============================================================
# VIDEO WRITER
# ============================================================

fourcc = cv2.VideoWriter_fourcc(
    *"mp4v"
)

out = cv2.VideoWriter(
    OUTPUT_PATH,
    fourcc,
    fps,
    (width, height)
)

if not out.isOpened():
    raise RuntimeError(
        "Could not create output video."
    )


# ============================================================
# TRACKING
# ============================================================

results = model.track(
    source=VIDEO_PATH,
    stream=True,
    persist=True,
    conf=CONFIDENCE,
    iou=IOU,
    tracker="bytetrack.yaml",
    imgsz=IMGSZ,
    device=DEVICE,
    verbose=False,
)


# ============================================================
# PROCESS VIDEO
# ============================================================

frame_number = 0


for result in results:

    # Original frame
    frame = result.orig_img.copy()

    # --------------------------------------------------------
    # DETECTIONS
    # --------------------------------------------------------

    if result.boxes is not None:

        for box in result.boxes:

            # Original model class ID
            model_id = int(
                box.cls[0]
            )

            # ------------------------------------------------
            # REMOVE UNWANTED CLASSES
            # ------------------------------------------------

            if model_id not in MODEL_TO_UI:
                continue


            # ------------------------------------------------
            # ORIGINAL MODEL ID → FINAL UI ID
            # ------------------------------------------------

            ui_id = MODEL_TO_UI[model_id]

            class_name = UI_CLASSES[ui_id]

            confidence = float(
                box.conf[0]
            )


            # ------------------------------------------------
            # BOUNDING BOX
            # ------------------------------------------------

            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0].tolist()
            )


            # ------------------------------------------------
            # TRACK ID
            # ------------------------------------------------

            if box.id is not None:

                track_id = int(
                    box.id[0]
                )

            else:

                track_id = None


            # =================================================
            # CLASS STABILIZATION
            # =================================================

            if track_id is not None:

                # Add current prediction to history
                class_history[track_id].append(
                    ui_id
                )

                history = class_history[
                    track_id
                ]

                # Majority vote
                stable_ui_id = max(
                    set(history),
                    key=history.count
                )

            else:

                stable_ui_id = ui_id


            stable_class_name = UI_CLASSES[
                stable_ui_id
            ]


            # =================================================
            # COLORS
            # =================================================

            if stable_ui_id == 0:

                # --------------------------------------------
                # AMBULANCE
                # --------------------------------------------

                box_color = (
                    0,
                    0,
                    255
                )

            else:

                # --------------------------------------------
                # NORMAL VEHICLE
                # --------------------------------------------

                box_color = (
                    0,
                    255,
                    0
                )


            # =================================================
            # DRAW BOX
            # =================================================

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                box_color,
                3
            )


            # =================================================
            # LABEL
            # =================================================

            label = stable_class_name.upper()


            # =================================================
            # LABEL BACKGROUND
            # =================================================

            font = cv2.FONT_HERSHEY_SIMPLEX

            font_scale = 0.65

            thickness = 2

            (
                text_width,
                text_height
            ), baseline = cv2.getTextSize(
                label,
                font,
                font_scale,
                thickness
            )


            label_x1 = x1

            label_y1 = max(
                0,
                y1 - text_height - 12
            )

            label_x2 = x1 + text_width + 12

            label_y2 = y1


            # Same color as box
            cv2.rectangle(
                frame,
                (
                    label_x1,
                    label_y1
                ),
                (
                    label_x2,
                    label_y2
                ),
                box_color,
                -1
            )


            # =================================================
            # BLACK TEXT
            # =================================================

            cv2.putText(
                frame,
                label,
                (
                    x1 + 6,
                    y1 - 6
                ),
                font,
                font_scale,
                (
                    0,
                    0,
                    0
                ),
                thickness,
                cv2.LINE_AA
            )


    # ========================================================
    # DASHBOARD
    # ========================================================

    # Count currently visible vehicles
    visible_vehicles = 0

    if result.boxes is not None:

        for box in result.boxes:

            model_id = int(
                box.cls[0]
            )

            if model_id in MODEL_TO_UI:
                visible_vehicles += 1


    # --------------------------------------------------------
    # SIMPLE VIDEO METRICS
    #
    # These are UI estimates for this standalone video test.
    # Your backend TrafficStateEngine can provide the actual
    # project metrics later.
    # --------------------------------------------------------

    vehicle_count = visible_vehicles

    speed = 0

    queue = 0

    traffic_score = min(
        100,
        vehicle_count * 5
    )


    # ========================================================
    # DASHBOARD BACKGROUND
    # ========================================================

    dashboard_width = 360

    dashboard_height = 145

    overlay = frame.copy()

    cv2.rectangle(
        overlay,
        (15, 15),
        (
            dashboard_width,
            dashboard_height
        ),
        (0, 0, 0),
        -1
    )


    # Slight transparency
    frame = cv2.addWeighted(
        overlay,
        0.70,
        frame,
        0.30,
        0
    )


    # ========================================================
    # DASHBOARD TEXT
    # ========================================================

    dashboard_lines = [
        f"VEHICLES: {vehicle_count}",
        f"SPEED: {speed} km/h",
        f"QUEUE: {queue}",
        f"TRAFFIC SCORE: {traffic_score}/100",
    ]


    y = 45


    for line in dashboard_lines:

        cv2.putText(
            frame,
            line,
            (30, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 255),
            2,
            cv2.LINE_AA
        )

        y += 30


    # ========================================================
    # EMERGENCY INDICATOR
    # ========================================================

    ambulance_present = False

    if result.boxes is not None:

        for box in result.boxes:

            model_id = int(
                box.cls[0]
            )

            if model_id not in MODEL_TO_UI:
                continue

            ui_id = MODEL_TO_UI[
                model_id
            ]

            if ui_id == 0:

                ambulance_present = True

                break


    if ambulance_present:

        cv2.putText(
            frame,
            "AMBULANCE DETECTED",
            (30, 180),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (0, 0, 255),
            2,
            cv2.LINE_AA
        )


    # ========================================================
    # SAVE FRAME
    # ========================================================

    out.write(frame)


    frame_number += 1


    # ========================================================
    # PROGRESS
    # ========================================================

    if frame_number % 100 == 0:

        percentage = (
            frame_number /
            total_frames *
            100
        )

        print(
            f"Processed "
            f"{frame_number}/"
            f"{total_frames} "
            f"({percentage:.1f}%)"
        )


# ============================================================
# CLEANUP
# ============================================================

cap.release()

out.release()


# ============================================================
# FINAL MESSAGE
# ============================================================

print()
print("=" * 60)
print("7-CLASS VIDEO PROCESSING COMPLETE")
print("=" * 60)

print()
print("Output saved to:")

print(
    os.path.abspath(
        OUTPUT_PATH
    )
)

print()
print("Final UI classes:")

for class_id, name in UI_CLASSES.items():

    print(
        f"  {class_id}: {name}"
    )

print()
print("No preview window was opened.")
print("The complete video has been saved.")