"""
Video Test Client
Owner: ML Engineer (shared utility for the whole team)

Streams frames from ANY video file to the running /analyze-frame API, one
at a time, at a chosen sample rate. Use this to test the pipeline against
your own footage without writing any code.

Usage:
    python3 test_with_video.py --video path/to/your_clip.mp4 --camera_id cam_02

    # optional flags:
    --api http://localhost:8000      (default; change if API runs elsewhere, e.g. teammate's machine on LAN)
    --fps 2                          (how many frames per second of VIDEO to sample and send — not real-time speed)
    --save_csv results.csv           (dump every response as a row for analysis/plotting)

Each teammate can run this independently against their own video with a
unique --camera_id (e.g. cam_north, cam_south) — the API keeps tracking
state separate per camera_id, so multiple people can test in parallel
against the same running server without interfering with each other.
"""

import argparse
import csv
import time

import cv2
import requests


def stream_video_to_api(video_path: str, camera_id: str, api_url: str, sample_fps: float, save_csv: str | None):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"ERROR: could not open video {video_path}")
        return

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_interval = max(1, round(video_fps / sample_fps))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Video: {video_path}")
    print(f"  video_fps={video_fps:.1f}, total_frames={total_frames}, sampling every {frame_interval} frames (~{sample_fps} fps)")
    print(f"Sending to {api_url}/analyze-frame as camera_id='{camera_id}'\n")

    rows = []
    frame_idx = 0
    sent_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            ok, encoded = cv2.imencode(".jpg", frame)
            if not ok:
                frame_idx += 1
                continue

            try:
                resp = requests.post(
                    f"{api_url}/analyze-frame",
                    data={"camera_id": camera_id},
                    files={"file": ("frame.jpg", encoded.tobytes(), "image/jpeg")},
                    timeout=10,
                )
                resp.raise_for_status()
                result = resp.json()
                sent_count += 1
                print(
                    f"[frame {frame_idx}] vehicles={result['vehicle_count']} "
                    f"score={result['traffic_score']} speed={result['avg_speed']} "
                    f"queue={result['queue_length']} emergency={result['emergency_detected']} "
                    f"trend={result['predicted_trend']}"
                )
                if save_csv:
                    rows.append(result)
            except requests.exceptions.RequestException as e:
                print(f"[frame {frame_idx}] REQUEST FAILED: {e}")

        frame_idx += 1

    cap.release()
    print(f"\nDone. Sent {sent_count} frames out of {total_frames} total.")

    if save_csv and rows:
        keys = [k for k in rows[0].keys() if k != "detections"]  # skip nested list for flat CSV
        with open(save_csv, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            for r in rows:
                writer.writerow({k: r[k] for k in keys})
        print(f"Saved {len(rows)} rows to {save_csv}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stream a video's frames to the traffic ML API for testing")
    parser.add_argument("--video", required=True, help="Path to your video file")
    parser.add_argument("--camera_id", required=True, help="Unique camera/lane identifier for this video")
    parser.add_argument("--api", default="http://localhost:8000", help="Base URL of the running API")
    parser.add_argument("--fps", type=float, default=2.0, help="How many frames per second of VIDEO to sample")
    parser.add_argument("--save_csv", default=None, help="Optional path to save results as CSV")
    args = parser.parse_args()

    stream_video_to_api(args.video, args.camera_id, args.api, args.fps, args.save_csv)
