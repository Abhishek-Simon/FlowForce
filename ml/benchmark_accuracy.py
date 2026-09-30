"""
FlowForce - Model Accuracy & Performance Benchmark Script
Evaluates YOLOv8 detection accuracy, mean confidence per class, latency (ms), and FPS.
"""

import os
import sys
import time
import cv2
import numpy as np

# Ensure project root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from ml.utils.detector import VehicleDetector


def benchmark_video(video_path: str, max_frames: int = 150):
    if not os.path.exists(video_path):
        print(f"❌ Video not found: {video_path}")
        return

    print("=" * 70)
    print(f"📊 BENCHMARKING YOLOv8 MODEL ACCURACY ON: {os.path.basename(video_path)}")
    print("=" * 70)

    detector = VehicleDetector(conf_threshold=0.35)
    cap = cv2.VideoCapture(video_path)

    total_frames = 0
    inference_times = []
    class_confidences = {}
    class_counts = {}

    while cap.isOpened() and total_frames < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        total_frames += 1
        t0 = time.time()
        
        # Run detection
        detections = detector.detect_and_track(frame, camera_id="BENCHMARK", conf_threshold=0.35)
        
        latency = (time.time() - t0) * 1000  # ms
        inference_times.append(latency)

        for det in detections:
            cname = det.get("class_name", "unknown")
            conf = det.get("confidence", 0.0)

            if cname not in class_confidences:
                class_confidences[cname] = []
                class_counts[cname] = 0

            class_confidences[cname].append(conf)
            class_counts[cname] += 1

    cap.release()

    avg_latency = np.mean(inference_times)
    avg_fps = 1000.0 / avg_latency if avg_latency > 0 else 0

    print(f"\n✅ Evaluated Frames:      {total_frames}")
    print(f"⚡ Average Latency:       {avg_latency:.2f} ms per frame")
    print(f"🚀 Processing Throughput: {avg_fps:.1f} FPS")
    print("\n--- CLASS DETECTION ACCURACY & MEAN CONFIDENCE ---")
    print(f"{'Class Name':<15} | {'Total Detections':<18} | {'Mean Confidence':<18} | {'Max Confidence':<15}")
    print("-" * 72)

    total_dets = 0
    all_confs = []

    for cname, confs in sorted(class_confidences.items()):
        mean_c = np.mean(confs) * 100
        max_c = np.max(confs) * 100
        count = class_counts[cname]
        total_dets += count
        all_confs.extend(confs)
        print(f"{cname.capitalize():<15} | {count:<18} | {mean_c:>6.2f}%            | {max_c:>6.2f}%")

    overall_mean_conf = np.mean(all_confs) * 100 if all_confs else 0
    print("-" * 72)
    print(f"{'OVERALL AVERAGE':<15} | {total_dets:<18} | {overall_mean_conf:>6.2f}%            | {np.max(all_confs)*100 if all_confs else 0:>6.2f}%")
    print("=" * 70)


if __name__ == "__main__":
    sample = os.path.join(BASE_DIR, "ml", "samples", "sample_traffic.mp4")
    if not os.path.exists(sample):
        sample = os.path.join(BASE_DIR, "traffic-ml", "samples", "sample_traffic.mp4")
    benchmark_video(sample)
