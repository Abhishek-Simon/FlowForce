"""
FlowForce Safety Analytics & Risk Hotspot API Routes
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.database.models import TrafficMetric, Incident, Alert
from ml.utils.safety_engine import SafetyRiskEngine

router = APIRouter(prefix="/api/safety", tags=["Predictive Safety Analytics"])
safety_engine = SafetyRiskEngine()


@router.get("/risk/{junction_id}")
def get_junction_risk(junction_id: str = "J1", db: Session = Depends(get_db)):
    """
    GET /api/safety/risk/{junction_id}
    Returns multi-factor composite risk score (0-100), risk level (LOW/MODERATE/HIGH/CRITICAL),
    and top contributing safety factors.
    """
    cam_id = "CAM-01"
    if junction_id.upper() in ["J2", "CAM-02"]:
        cam_id = "CAM-02"
    elif junction_id.upper() in ["J3", "CAM-03"]:
        cam_id = "CAM-03"
    elif junction_id.upper() in ["J4", "CAM-04"]:
        cam_id = "CAM-04"

    latest_metric = db.query(TrafficMetric).filter(TrafficMetric.camera_id == cam_id).order_by(TrafficMetric.timestamp.desc()).first()
    inc_cnt = db.query(Incident).filter(Incident.camera_id == cam_id).count()

    # Synthetic realistic event telemetry based on junction characteristics
    raw_events = {
        "wrong_direction_count": 2 if junction_id.upper() in ["J2", "J7"] else (1 if junction_id.upper() == "J1" else 0),
        "speed_variance": 28.5 if junction_id.upper() in ["J2", "J3"] else 14.0,
        "sudden_braking_events": 3 if junction_id.upper() in ["J2", "J7"] else 1,
        "incident_count": max(inc_cnt, 1 if junction_id.upper() == "J2" else 0),
    }

    v_cnt = latest_metric.vehicle_count if latest_metric else 25
    q_len = latest_metric.queue_length if (latest_metric and latest_metric.queue_length > 0) else max(2, int(round(v_cnt * 0.45)))
    density_val = latest_metric.density_percentage if (latest_metric and latest_metric.density_percentage > 0) else 65.0

    raw_traffic = {
        "density_percentage": density_val,
        "total_queue": q_len,
        "average_wait": 22.0 if junction_id.upper() == "J2" else 12.0,
    }

    eval_result = safety_engine.evaluate_junction_risk(
        junction_id=junction_id,
        events_data=raw_events,
        traffic_state=raw_traffic,
    )
    return eval_result


@router.get("/hotspots")
def get_safety_hotspots(db: Session = Depends(get_db)):
    """
    GET /api/safety/hotspots
    Aggregates safety evaluations across network junctions and identifies risk hotspots.
    """
    nodes = ["J1", "J2", "J3", "J4"]
    evaluations = [get_junction_risk(jid, db) for jid in nodes]
    hotspots = safety_engine.get_risk_hotspots(evaluations)
    return {
        "total_evaluated_junctions": len(nodes),
        "active_hotspots_count": len([h for h in hotspots if h["is_hotspot"]]),
        "hotspots": hotspots,
    }


@router.get("/config")
def get_safety_config():
    """Returns risk weighting configuration."""
    return {"risk_weights": safety_engine.risk_weights}


@router.post("/config")
def update_safety_config(config_data: Dict[str, Any]):
    """Updates risk weighting configuration."""
    if "risk_weights" in config_data:
        safety_engine.risk_weights.update(config_data["risk_weights"])
    return {
        "status": "success",
        "risk_weights": safety_engine.risk_weights,
    }
