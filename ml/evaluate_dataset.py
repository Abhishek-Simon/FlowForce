"""
FlowForce - Ground-Truth Dataset Evaluation & Accuracy Validator
Evaluates YOLOv8 against a labeled dataset (COCO8 / Ground Truth) computing:
- Precision (P)
- Recall (R)
- mAP@50 (Mean Average Precision at IoU=0.50)
- mAP@50-95 (Mean Average Precision at IoU=0.50:0.95)
"""

import os
import sys
from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "ml", "models", "yolov8n.pt")
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = os.path.join(BASE_DIR, "traffic-ml", "yolov8n.pt")


def evaluate_on_dataset():
    print("=" * 70)
    print("🧪 RUNNING GROUND-TRUTH DATASET VALIDATION (COCO VALIDATION BENCHMARK)")
    print("=" * 70)

    # Load YOLOv8 model
    model = YOLO(MODEL_PATH)

    # Validate against standard COCO8 mini-dataset (official Ultralytics ground-truth test set)
    print("\nRunning dataset validation across labeled ground-truth images...")
    metrics = model.val(data="coco8.yaml", split="val", imgsz=640, batch=8, verbose=True)

    print("\n" + "=" * 70)
    print("📊 DATASET ACCURACY & EVALUATION RESULTS:")
    print("=" * 70)
    print(f"🎯 Precision (P):       {metrics.box.mp * 100:.2f}%")
    print(f"🎯 Recall (R):          {metrics.box.mr * 100:.2f}%")
    print(f"🏆 mAP@50:              {metrics.box.map50 * 100:.2f}%")
    print(f"🏆 mAP@50-95:           {metrics.box.map * 100:.2f}%")
    print("=" * 70)


if __name__ == "__main__":
    evaluate_on_dataset()
