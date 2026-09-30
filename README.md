# FlowForce: AI-Powered Intelligent Traffic Management & Emergency Priority Platform

A production-grade, smart-city **AI Traffic Intelligence & Actuated Signal Control Command Center** that combines real-time video computer vision (YOLOv8 + ByteTrack), multi-lane synchronized junction matrices, pedestrian crowd detection, emergency vehicle prioritization, 5m/15m congestion forecasting, adaptive Webster signal optimization, dataset accuracy validation, and analytics reporting.

---

## 🏛️ System Architecture

```text
Traffic Video Streams / CCTV / User Video Feeds (4-Lane Matrix)
                                │
                                ▼
                    OpenCV Decoding Pipeline
                                │
                                ▼
            YOLOv8 Object Detection & ByteTrack Association
         (Cars, Motorcycles, Buses, Trucks, Pedestrians)
                                │
                                ▼
          Emergency Vehicle Preemption (EVP) Engine
       (HSV Color Signatures & Flashing Light Contrast)
                                │
                                ▼
                Traffic State & Demand Engine
         (Density %, Stopped Queue Length, Speed, Wait Time)
                                │
                                ▼
          Adaptive 4-Way Multi-Signal Clearance Controller
          (Webster's Cycle Optimization & Green Allocation)
                                │
                                ▼
                    FastAPI + WebSocket Core
            (REST Endpoints, SQLite DB, Background Workers)
                                │
                                ▼
        React Command Center UI (Dark & Light White Theme)
```

---

## 🚀 Key Platform Features

### 1. 🚦 4-Way Synchronized Intersection Matrix (`/matrix`)
- **4 Live Feeds on One Screen (2x2 Matrix)**: Displays North, South, East, and West corridors simultaneously.
- **Manual Video Fit Option (`FIT VIDEO`)**: Upload and assign any real MP4/CCTV video file to any lane.
- **Live AI Detection Overlays**: Real-time YOLOv8 bounding boxes with class confidence pills tracked frame-by-frame.
- **Actuated Signal Clearance**: The AI decision engine calculates live demand scores:
  $$\text{Demand Score} = (\text{Density} \times 0.45) + (\text{Queue} \times 6.0) + (\text{Wait Time} \times 1.6) + (\text{Pedestrians} \times 1.5)$$
  The lane with the heaviest traffic automatically gets **`🟢 GREEN (CLEARING)`** while holding other lanes on **`🔴 RED`**.

### 2. 🚨 Emergency Vehicle Priority Handling
- Multi-strategy detection using **HSV color signature analysis** (`red_ratio` + `white_ratio` thresholding) and flashing emergency light contrast.
- Instant cycle preemption: Forces the target lane to **`🟢 GREEN`** and safely locks conflicting lanes on **`🔴 RED HOLD`**.

### 3. ☀️ Light (White) & 🌙 Dark Theme Switching
- One-click toggle in the topbar (`SWITCH TO WHITE` / `SWITCH TO DARK`).
- Clean industrial dark mode and high-contrast municipal white mode.

### 4. 📊 Ground-Truth Dataset & Accuracy Evaluation
- Evaluated against labeled **COCO Ground-Truth Datasets** (`datasets/coco8/` and `datasets/coco128/`):
  - **$\text{mAP}_{50}$ Accuracy**: **88.75%**
  - **Precision (P)**: **62.10%**
  - **Recall (R)**: **83.33%**
  - **Inference Latency**: **70.0 ms**
- Exported dataset annotations and traffic logs available in **CSV and TSV** formats (`datasets/dataset_annotations.csv`, `datasets/dataset_annotations.tsv`, `data/traffic_telemetry_log.csv`).

### 5. 🎥 Video Upload & Annotated MP4 Generation (`/video-analysis`)
- Non-blocking background worker processes uploaded video clips.
- Generates downloadable annotated `.mp4` video with color-coded bounding boxes and smart-city telemetry HUD overlays.

---

## 🛠️ Quick Start & Setup

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Single-Command Quick Launcher
Run both FastAPI backend and React frontend together:

```powershell
python run_system.py
```

- **Frontend Command Center**: [http://localhost:5173](http://localhost:5173)
- **4-Lane Actuation Matrix**: [http://localhost:5173/matrix](http://localhost:5173/matrix)
- **Interactive Swagger API Docs**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

---

## 🧪 Testing & Accuracy Scripts

### Run Automated Unit Tests (11/11 Passing):
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\pytest backend/tests/ -v
```

### Run Model Latency & Accuracy Benchmark:
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\python.exe ml\benchmark_accuracy.py
```

### Run Ground-Truth Dataset Validation (mAP):
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\python.exe ml\evaluate_dataset.py
```

### Export Annotations & Logs to CSV/TSV:
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\python.exe ml\export_csv_tsv.py
```

---

## 📁 Repository Structure

```text
FlowForce/
├── backend/
│   ├── app/
│   │   ├── api/             # REST Route handlers (cameras, videos, traffic, emergency, signals, analytics)
│   │   ├── core/            # App configurations & settings
│   │   ├── database/        # SQLAlchemy database connection & ORM models
│   │   ├── services/        # WebSocket manager & helpers
│   │   └── workers/         # Async video worker pipeline
│   ├── tests/               # Backend & ML pipeline pytest unit tests
│   └── requirements.txt
├── ml/
│   ├── models/              # YOLOv8 weights (yolov8n.pt)
│   ├── samples/             # Sample traffic & pedestrian footage
│   ├── utils/               # Detector, emergency engine, traffic state, predictor, annotator
│   ├── benchmark_accuracy.py# Model latency & confidence benchmark
│   ├── evaluate_dataset.py  # Ground-truth dataset accuracy validator
│   └── export_csv_tsv.py    # CSV and TSV export script
├── datasets/
│   ├── coco8/               # Extracted COCO8 dataset
│   ├── coco128/             # Extracted COCO128 dataset
│   ├── dataset_annotations.csv
│   └── dataset_annotations.tsv
├── data/
│   ├── traffic_telemetry_log.csv
│   └── outputs/             # Rendered annotated MP4 videos
├── frontend/
│   ├── src/
│   │   ├── components/      # Sidebar, Topbar, StatCard, CongestionGauge, TrafficMap
│   │   ├── context/         # ThemeContext (Dark & Light Theme)
│   │   ├── pages/           # Dashboard, IntersectionMatrix, VideoAnalysis, Emergency, etc.
│   │   └── services/        # API client and WebSocket handlers
│   ├── package.json
│   └── vite.config.ts
├── run_system.py            # Single-command launcher
├── docker-compose.yml
└── README.md
```
