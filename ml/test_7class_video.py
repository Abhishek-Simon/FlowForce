from ultralytics import YOLO
import cv2
import os
import math
from collections import defaultdict, deque

from vehicle_classes import MODEL_TO_UI, UI_CLASSES


# ============================================================
# CONFIG
# ============================================================

MODEL_PATH = (
    "runs/detect/runs/final_traffic/"
    "yolov8n_final_14class/weights/best.pt"
)

VIDEO_PATH = r"C:\Users\J.A.R.V.I.S\Downloads\traffic-ml\traffic-ml\test4.mp4"

OUTPUT_PATH = r"runs\7class_ui_test.mp4"

CONFIDENCE = 0.10
IOU = 0.50

IMG_SIZE = 640
DEVICE = 'cpu'


# ============================================================
# COLORS - BGR
# ============================================================

GREEN = (0, 220, 0)
RED = (0, 0, 255)

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)


# ============================================================
# LOAD MODEL
# ============================================================

model = YOLO(MODEL_PATH)

print("Model loaded:")
print(MODEL_PATH)

print("\nFinal classes:")

for class_id, name in UI_CLASSES.items():
    print(f"  {class_id}: {name}")


# ============================================================
# VIDEO
# ============================================================

cap = cv2.VideoCapture(VIDEO_PATH)

if not cap.isOpened():
    raise RuntimeError(
        f"Could not open video: {VIDEO_PATH}"
    )


fps = cap.get(cv2.CAP_PROP_FPS)

if fps <= 0:
    fps = 30


width = int(
    cap.get(cv2.CAP_PROP_FRAME_WIDTH)
)

height = int(
    cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
)

total_frames = int(
    cap.get(cv2.CAP_PROP_FRAME_COUNT)
)


print()
print(f"Resolution: {width}x{height}")
print(f"FPS: {fps:.2f}")
print(f"Frames: {total_frames}")


# ============================================================
# OUTPUT
# ============================================================

os.makedirs("runs", exist_ok=True)

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
# SPEED TRACKING
# ============================================================

previous_positions = {}

speed_history = defaultdict(
    lambda: deque(maxlen=5)
)


# ============================================================
# DRAW TOP-LEFT PANEL
# ============================================================

def draw_dashboard(
    frame,
    vehicle_count,
    avg_speed,
    queue_length,
    traffic_score,
):

    # Panel dimensions

    panel_x = 15
    panel_y = 15

    panel_w = 390
    panel_h = 180


    # Transparent dark panel

    overlay = frame.copy()

    cv2.rectangle(
        overlay,
        (
            panel_x,
            panel_y
        ),
        (
            panel_x + panel_w,
            panel_y + panel_h
        ),
        (20, 20, 20),
        -1
    )

    frame = cv2.addWeighted(
        overlay,
        0.75,
        frame,
        0.25,
        0
    )


    # Text

    x = panel_x + 20

    y = panel_y + 35

    line_height = 32


    font = cv2.FONT_HERSHEY_SIMPLEX

    scale = 0.70

    thickness = 2


    cv2.putText(
        frame,
        f"Vehicles: {vehicle_count}",
        (x, y),
        font,
        scale,
        WHITE,
        thickness,
        cv2.LINE_AA
    )


    y += line_height

    cv2.putText(
        frame,
        f"Avg Speed: {avg_speed:.1f} km/h",
        (x, y),
        font,
        scale,
        WHITE,
        thickness,
        cv2.LINE_AA
    )


    y += line_height

    cv2.putText(
        frame,
        f"Queue Length: {queue_length}",
        (x, y),
        font,
        scale,
        WHITE,
        thickness,
        cv2.LINE_AA
    )


    y += line_height

    cv2.putText(
        frame,
        f"Traffic Score: {traffic_score} / 100",
        (x, y),
        font,
        scale,
        WHITE,
        thickness,
        cv2.LINE_AA
    )


    return frame


# ============================================================
# DRAW DETECTION
# ============================================================

def draw_detection(
    frame,
    bbox,
    label,
    is_ambulance
):

    x1, y1, x2, y2 = bbox


    if is_ambulance:

        box_color = RED

    else:

        box_color = GREEN


    # Bounding box

    cv2.rectangle(
        frame,
        (x1, y1),
        (x2, y2),
        box_color,
        3
    )


    # Text settings

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


    # Label position

    label_x = x1

    label_y = y1 - 8


    # If label would go outside frame,
    # put it inside the box.

    if label_y - text_height < 0:

        label_y = y1 + text_height + 8


    # Label rectangle

    cv2.rectangle(
        frame,
        (
            label_x,
            label_y - text_height - 6
        ),
        (
            label_x + text_width + 8,
            label_y + baseline
        ),
        box_color,
        -1
    )


    # BLACK TEXT

    cv2.putText(
        frame,
        label,
        (
            label_x + 4,
            label_y
        ),
        font,
        font_scale,
        BLACK,
        thickness,
        cv2.LINE_AA
    )


# ============================================================
# PROCESS
# ============================================================

frame_number = 0


for result in model.track(

    source=VIDEO_PATH,

    stream=True,

    persist=True,

    conf=CONFIDENCE,

    iou=IOU,

    tracker="bytetrack.yaml",

    imgsz=IMG_SIZE,

    device=DEVICE,

    verbose=False,

):

    frame = result.orig_img.copy()


    detections = []


    # --------------------------------------------------------
    # DETECTIONS
    # --------------------------------------------------------

    if result.boxes is not None:

        for box in result.boxes:

            model_id = int(
                box.cls[0]
            )


            # Remove unwanted classes

            if model_id not in MODEL_TO_UI:
                continue


            # Convert model class
            # to final UI class

            ui_id = MODEL_TO_UI[
                model_id
            ]

            class_name = UI_CLASSES[
                ui_id
            ]


            confidence = float(
                box.conf[0]
            )


            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0].tolist()
            )


            if box.id is not None:

                track_id = int(
                    box.id[0]
                )

            else:

                track_id = None


            detections.append({

                "class_name": class_name,

                "confidence": confidence,

                "bbox": (
                    x1,
                    y1,
                    x2,
                    y2
                ),

                "track_id": track_id,

            })


    # --------------------------------------------------------
    # VEHICLE COUNT
    # --------------------------------------------------------

    vehicle_count = len(
        detections
    )


    # --------------------------------------------------------
    # SPEED
    # --------------------------------------------------------

    speeds = []


    for det in detections:

        track_id = det["track_id"]


        if track_id is None:
            continue


        x1, y1, x2, y2 = det["bbox"]


        cx = (x1 + x2) / 2

        cy = (y1 + y2) / 2


        current_position = (
            cx,
            cy
        )


        if track_id in previous_positions:

            px, py = previous_positions[
                track_id
            ]


            pixel_distance = math.sqrt(

                (cx - px) ** 2
                +
                (cy - py) ** 2

            )


            # Pixel movement → approximate km/h.
            #
            # This is only a visual estimate because
            # the video has no camera calibration.

            speed_kmh = (
                pixel_distance
                * fps
                * 0.12
            )


            speed_history[
                track_id
            ].append(
                speed_kmh
            )


            smoothed_speed = sum(
                speed_history[track_id]
            ) / len(
                speed_history[track_id]
            )


            speeds.append(
                smoothed_speed
            )


        previous_positions[
            track_id
        ] = current_position


    if speeds:

        avg_speed = sum(
            speeds
        ) / len(speeds)

    else:

        avg_speed = 0.0


    # --------------------------------------------------------
    # QUEUE
    # --------------------------------------------------------

    # Vehicles moving very slowly are considered queued.

    queue_length = 0


    for det in detections:

        track_id = det["track_id"]


        if track_id is None:
            continue


        history = speed_history.get(
            track_id
        )


        if history and (
            sum(history) / len(history)
        ) < 5:

            queue_length += 1


    # --------------------------------------------------------
    # TRAFFIC SCORE
    # --------------------------------------------------------

    # Density component

    density_score = min(
        vehicle_count * 5,
        50
    )


    # Queue component

    queue_score = min(
        queue_length * 8,
        30
    )


    # Speed component

    if avg_speed < 5:

        speed_score = 20

    elif avg_speed < 15:

        speed_score = 10

    else:

        speed_score = 0


    traffic_score = min(
        100,
        int(
            density_score
            +
            queue_score
            +
            speed_score
        )
    )


    # --------------------------------------------------------
    # DRAW VEHICLES
    # --------------------------------------------------------

    for det in detections:

        class_name = det[
            "class_name"
        ]

        track_id = det[
            "track_id"
        ]

        confidence = det[
            "confidence"
        ]


        if track_id is not None:

            label = (
                f"{class_name.upper()} "
                f"#{track_id}"
            )

        else:

            label = (
                f"{class_name.upper()}"
            )


        is_ambulance = (
            class_name == "ambulance"
        )


        draw_detection(

            frame,

            det["bbox"],

            label,

            is_ambulance

        )


    # --------------------------------------------------------
    # DASHBOARD
    # --------------------------------------------------------

    frame = draw_dashboard(

        frame,

        vehicle_count,

        avg_speed,

        queue_length,

        traffic_score

    )


    # --------------------------------------------------------
    # SAVE
    # --------------------------------------------------------

    out.write(frame)


    frame_number += 1


    if frame_number % 100 == 0:

        print(
            f"Processed "
            f"{frame_number}/"
            f"{total_frames} "
            f"("
            f"{frame_number / total_frames * 100:.1f}%"
            f")"
        )


# ============================================================
# CLEANUP
# ============================================================

cap.release()

out.release()

print()
print("=" * 50)
print("VIDEO COMPLETE")
print("=" * 50)

print(
    "Saved:"
)

print(
    os.path.abspath(
        OUTPUT_PATH
    )
)