"""
Download and extract COCO128 traffic & object dataset
"""

import os
import sys
from ultralytics.utils.downloads import download

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASETS_DIR = os.path.join(BASE_DIR, "datasets")
os.makedirs(DATASETS_DIR, exist_ok=True)

print("=" * 70)
print("📦 EXTRACTING FULL BENCHMARK DATASET (COCO128)...")
print("=" * 70)

# Download and automatically unzip coco128 to datasets/
url = "https://github.com/ultralytics/assets/releases/download/v0.0.0/coco128.zip"
download(url, dir=DATASETS_DIR, unzip=True, delete=False)

print("\n✅ Dataset extracted successfully into: C:\\PROJECTS\\FlowForce\\datasets\\coco128")
print("📂 Structure:")
print("   - images/train2017 (128 images)")
print("   - labels/train2017 (Ground-truth YOLO annotation text files)")
print("=" * 70)
