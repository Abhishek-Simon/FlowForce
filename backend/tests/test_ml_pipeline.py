import os
import sys
import numpy as np
import pytest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from ml.utils.detector import VehicleDetector
from ml.utils.traffic_engine import TrafficStateEngine
from ml.utils.emergency import EmergencyDetector
from ml.utils.prediction import TrafficPredictor


def test_detector_initialization():
    detector = VehicleDetector()
    assert detector.model_path is not None


def test_emergency_detector_synthetic():
    detector = EmergencyDetector()
    # Synthetic ambulance pattern: top half white, bottom half red
    crop = np.zeros((100, 100, 3), dtype=np.uint8)
    crop[:50, :] = (255, 255, 255)  # white (BGR)
    crop[50:, :] = (0, 0, 255)      # red (BGR)

    res = detector.check(crop, [0, 0, 100, 100], "car")
    assert "is_emergency" in res
    assert res["is_emergency"] is True


def test_traffic_engine_density_and_score():
    engine = TrafficStateEngine(roi_area_px2=1000)
    fake_dets = [
        {"track_id": 1, "center": [100, 200], "class_name": "car", "confidence": 0.9, "bbox": [90, 190, 110, 210]},
        {"track_id": 2, "center": [150, 250], "class_name": "person", "confidence": 0.85, "bbox": [145, 240, 155, 260]},
    ]
    state = engine.update("CAM-TEST", fake_dets)
    assert state["vehicle_count"] == 1
    assert state["pedestrian_count"] == 1
    assert state["total_count"] == 2
    assert "traffic_score" in state
    assert state["congestion_level"] in ["LOW", "MODERATE", "HIGH", "SEVERE"]


def test_traffic_predictor():
    predictor = TrafficPredictor()
    history = [10, 15, 20, 25, 30, 35, 40]
    pred = predictor.predict(history)
    assert "predicted_score_5m" in pred
    assert "predicted_score_15m" in pred
    assert pred["trend"] == "rising"
