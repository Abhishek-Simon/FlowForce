from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.database.models import TrafficMetric
from ml.utils.prediction import TrafficPredictor
from ml.utils.forecaster import CongestionForecaster
from backend.app.api.routes_traffic import traffic_engine

router = APIRouter(prefix="/api/predictions", tags=["Traffic Prediction"])
predictor = TrafficPredictor()
forecaster = CongestionForecaster(warning_pcu_threshold=60.0, warning_density_threshold=70.0)


@router.get("/junction/{junction_id}")
def get_junction_forecast(junction_id: str = "JUNCTION-01", db: Session = Depends(get_db)):
    """
    GET /api/predictions/junction/{junction_id}
    Returns short-horizon (+5 min, +10 min, +15 min) predictive traffic forecasts:
    - predicted PCU, density %, queue length, waiting times
    - congestion classification
    - model confidence score
    - predictive warning banner when thresholds are crossed.
    """
    # Fetch historical time-series observations from database
    cam_id = "CAM-01"
    if junction_id.upper() in ["J2", "JUNCTION-02"]:
        cam_id = "CAM-02"
    elif junction_id.upper() in ["J3", "JUNCTION-03"]:
        cam_id = "CAM-03"
    elif junction_id.upper() in ["J4", "JUNCTION-04"]:
        cam_id = "CAM-04"

    metrics = (
        db.query(TrafficMetric)
        .filter(TrafficMetric.camera_id == cam_id)
        .order_by(TrafficMetric.timestamp.desc())
        .limit(30)
        .all()
    )

    history_records = [
        {
            "timestamp": m.timestamp,
            "vehicle_count": m.vehicle_count,
            "pcu": m.pcu_score if m.pcu_score > 0 else round(m.vehicle_count * 1.2, 1),
            "density_percentage": m.density_percentage,
            "queue_length": m.queue_length,
            "average_wait": m.avg_waiting_time_sec,
        }
        for m in reversed(metrics)
    ]

    latest = (
        db.query(TrafficMetric)
        .filter(TrafficMetric.camera_id == cam_id)
        .order_by(TrafficMetric.timestamp.desc())
        .first()
    )

    v_cnt = latest.vehicle_count if latest and latest.vehicle_count > 0 else 14
    real_pcu = latest.pcu_score if latest and latest.pcu_score > 0 else round(v_cnt * 1.25, 1)
    real_queue = latest.queue_length if latest and latest.queue_length > 0 else max(1, int(round(v_cnt * 0.45)))
    real_density = latest.density_percentage if latest and latest.density_percentage > 0 else min(95.0, round((v_cnt / 20) * 100, 1))
    real_wait = int(round(latest.avg_waiting_time_sec)) if latest and latest.avg_waiting_time_sec > 0 else int(round(real_queue * 2.8))

    current_snap = {
        "total_pcu": real_pcu,
        "total_queue": real_queue,
        "density_percentage": real_density,
        "average_wait": real_wait,
    }

    forecast = forecaster.forecast_junction(
        junction_id=junction_id,
        history_records=history_records,
        current_state=current_snap,
    )

    return forecast


@router.get("/config")
def get_forecast_config():
    """Returns predictive warning thresholds."""
    return {
        "warning_pcu_threshold": forecaster.warning_pcu_threshold,
        "warning_density_threshold": forecaster.warning_density_threshold,
    }


@router.post("/config")
def update_forecast_config(config: Dict[str, float]):
    """Updates predictive warning thresholds."""
    if "warning_pcu_threshold" in config:
        forecaster.warning_pcu_threshold = float(config["warning_pcu_threshold"])
    if "warning_density_threshold" in config:
        forecaster.warning_density_threshold = float(config["warning_density_threshold"])
    return {
        "status": "success",
        "warning_pcu_threshold": forecaster.warning_pcu_threshold,
        "warning_density_threshold": forecaster.warning_density_threshold,
    }


@router.get("/{camera_id}")
def get_camera_prediction(camera_id: str, db: Session = Depends(get_db)):
    metrics = (
        db.query(TrafficMetric)
        .filter(TrafficMetric.camera_id == camera_id)
        .order_by(TrafficMetric.timestamp.desc())
        .limit(30)
        .all()
    )

    history = [m.traffic_score for m in reversed(metrics)]
    pred = predictor.predict(history)

    return {
        "camera_id": camera_id,
        "historical_data_points": len(history),
        "prediction": pred,
        "disclaimer": "AI Statistical Extrapolation Model - Simulated Smart Forecast",
    }


@router.get("")
def get_all_predictions(db: Session = Depends(get_db)):
    cameras = ["CAM-01", "CAM-02", "CAM-03", "CAM-04"]
    res = []
    for cam_id in cameras:
        metrics = (
            db.query(TrafficMetric)
            .filter(TrafficMetric.camera_id == cam_id)
            .order_by(TrafficMetric.timestamp.desc())
            .limit(30)
            .all()
        )
        history = [m.traffic_score for m in reversed(metrics)]
        pred = predictor.predict(history)
        res.append({
            "camera_id": cam_id,
            "prediction": pred,
        })
    return res
