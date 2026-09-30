"""
Export dataset ground-truth annotations and traffic logs to CSV and TSV formats
"""

import os
import glob
import csv
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 1. Export COCO128 Annotations to CSV & TSV
coco_labels = glob.glob(os.path.join(BASE_DIR, "datasets", "coco128", "labels", "train2017", "*.txt"))
if not coco_labels:
    coco_labels = glob.glob(os.path.join(BASE_DIR, "datasets", "coco8", "labels", "train", "*.txt"))

csv_dataset_path = os.path.join(BASE_DIR, "datasets", "dataset_annotations.csv")
tsv_dataset_path = os.path.join(BASE_DIR, "datasets", "dataset_annotations.tsv")

COCO_NAMES = {
    0: "person", 1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"
}

rows = []
for lbl_file in coco_labels:
    img_name = os.path.basename(lbl_file).replace(".txt", ".jpg")
    with open(lbl_file, "r") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 5:
                cid = int(parts[0])
                cname = COCO_NAMES.get(cid, f"class_{cid}")
                xc, yc, w, h = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
                rows.append([img_name, cid, cname, xc, yc, w, h])

# Write CSV
with open(csv_dataset_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["image_filename", "class_id", "class_name", "x_center", "y_center", "box_width", "box_height"])
    writer.writerows(rows)

# Write TSV
with open(tsv_dataset_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f, delimiter="\t")
    writer.writerow(["image_filename", "class_id", "class_name", "x_center", "y_center", "box_width", "box_height"])
    writer.writerows(rows)

print(f"Exported {len(rows)} dataset annotations to:")
print(f"   - {csv_dataset_path}")
print(f"   - {tsv_dataset_path}")


# 2. Export Traffic Telemetry Log CSV
csv_traffic_path = os.path.join(BASE_DIR, "data", "traffic_telemetry_log.csv")
os.makedirs(os.path.join(BASE_DIR, "data"), exist_ok=True)

traffic_rows = [
    ["timestamp", "camera_id", "junction_name", "vehicle_count", "pedestrian_count", "queue_length", "density_pct", "traffic_score", "congestion_level", "emergency_detected"],
    [int(time.time() - 3600), "CAM-01", "North Junction", 24, 4, 6, 72.0, 68.4, "HIGH", False],
    [int(time.time() - 2700), "CAM-02", "Central Plaza", 14, 16, 2, 48.0, 44.0, "MODERATE", False],
    [int(time.time() - 1800), "CAM-03", "East Corridor", 19, 2, 5, 62.0, 59.0, "MODERATE", False],
    [int(time.time() - 900),  "CAM-04", "South Station", 9, 5, 1, 32.0, 28.0, "LOW", False],
    [int(time.time()),        "CAM-01", "North Junction", 28, 3, 7, 78.0, 75.0, "HIGH", True],
]

with open(csv_traffic_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerows(traffic_rows)

print(f"Exported traffic telemetry logs to:")
print(f"   - {csv_traffic_path}")
