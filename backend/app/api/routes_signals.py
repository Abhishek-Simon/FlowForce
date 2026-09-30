import time
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.database.models import SignalRecommendation, EmergencyEvent, TrafficMetric, Camera
from backend.app.schemas.schemas import SignalRecommendationResponse

router = APIRouter(prefix="/api/signals", tags=["Signal Optimization"])


def _calculate_webster_timing(pcu_north: float, pcu_south: float, pcu_east: float, pcu_west: float, bus_count: int = 0):
    """
    Webster's Optimum Cycle Length Formula:
    C_opt = (1.5 * L + 5) / (1 - Y)
    where L = Total lost time per cycle (sec), Y = Sum of critical flow ratios (q / s).
    Includes Transit Signal Priority (TSP) green extension when buses are present.
    """
    total_pcu = max(1.0, pcu_north + pcu_south + pcu_east + pcu_west)
    lost_time = 12.0  # 3s yellow/all-red per phase x 4 approaches
    
    # Saturation flow estimates (PCU/hr)
    sat_flow = 1800.0
    y_n = min(0.35, (pcu_north * 60) / sat_flow)
    y_s = min(0.35, (pcu_south * 60) / sat_flow)
    y_e = min(0.25, (pcu_east * 60) / sat_flow)
    y_w = min(0.25, (pcu_west * 60) / sat_flow)
    
    Y = max(0.1, min(0.85, y_n + y_s + y_e + y_w))
    c_opt = int(round((1.5 * lost_time + 5.0) / (1.0 - Y)))
    c_opt = max(60, min(150, c_opt))  # Clamp cycle time between 60s and 150s

    effective_green = c_opt - lost_time
    
    # Proportional split based on PCU flow ratios
    ratio_n = (pcu_north + 0.1) / (total_pcu + 0.4)
    ratio_s = (pcu_south + 0.1) / (total_pcu + 0.4)
    ratio_e = (pcu_east + 0.1) / (total_pcu + 0.4)
    ratio_w = (pcu_west + 0.1) / (total_pcu + 0.4)

    g_n = max(15, int(round(effective_green * ratio_n)))
    g_s = max(15, int(round(effective_green * ratio_s)))
    g_e = max(10, int(round(effective_green * ratio_e)))
    g_w = max(10, int(round(effective_green * ratio_w)))

    # Transit Signal Priority (TSP) boost for public buses
    tsp_active = bus_count > 0
    if tsp_active:
        g_n += 8  # Add 8s priority green extension for Northbound transit corridor

    return {
        "cycle_length": c_opt,
        "northbound_green": g_n,
        "southbound_green": g_s,
        "eastbound_green": g_e,
        "westbound_green": g_w,
        "tsp_active": tsp_active,
    }


@router.get("/recommendations", response_model=List[SignalRecommendationResponse])
def get_signal_recommendations(db: Session = Depends(get_db)):
    recs = db.query(SignalRecommendation).order_by(SignalRecommendation.timestamp.desc()).all()
    if not recs:
        active_emg = db.query(EmergencyEvent).filter(EmergencyEvent.status == "ACTIVE").first()
        is_emg = bool(active_emg)

        timing = _calculate_webster_timing(pcu_north=24.0, pcu_south=14.0, pcu_east=10.0, pcu_west=8.0, bus_count=2)

        rec = SignalRecommendation(
            id="SIG-REC-01",
            intersection_name="Central City Junction (MG Road x Brigade Rd)",
            camera_id="CAM-01",
            northbound_green=60 if is_emg else timing["northbound_green"],
            southbound_green=15 if is_emg else timing["southbound_green"],
            eastbound_green=10 if is_emg else timing["eastbound_green"],
            westbound_green=10 if is_emg else timing["westbound_green"],
            emergency_mode=is_emg,
            priority_direction="Northbound" if is_emg else ("Northbound (Bus TSP)" if timing["tsp_active"] else None),
            status_text="🚨 Green Wave Active" if is_emg else "⚡ Webster Optimum Adaptive Timing (Edge Autonomous Active)",
            timestamp=time.time(),
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        return [rec]

    return recs


from ml.utils.signal_optimizer import AdaptiveSignalOptimizer
from backend.app.api.routes_traffic import traffic_engine

signal_optimizer = AdaptiveSignalOptimizer()


@router.post("/optimize")
def optimize_signal_state(traffic_input: Optional[Dict[str, Any]] = None, db: Session = Depends(get_db)):
    """
    POST /api/signals/optimize
    Accepts current traffic state (or derives from live junction tracking if empty)
    and returns recommended phase, green duration, next phase, reason, and expected effect.
    """
    if not traffic_input:
        # Pull live junction traffic metrics from active cameras or database
        cam_map = {"north": "CAM-01", "south": "CAM-02", "east": "CAM-03", "west": "CAM-04"}
        traffic_input = {}
        for app_name, cid in cam_map.items():
            latest = db.query(TrafficMetric).filter(TrafficMetric.camera_id == cid).order_by(TrafficMetric.timestamp.desc()).first()
            v_cnt = latest.vehicle_count if latest and latest.vehicle_count > 0 else 12
            pcu = latest.pcu_score if latest and latest.pcu_score > 0 else round(v_cnt * 1.25, 1)
            q_len = latest.queue_length if latest and latest.queue_length > 0 else max(1, int(round(v_cnt * 0.45)))
            avg_w = int(round(latest.avg_waiting_time_sec)) if latest and latest.avg_waiting_time_sec > 0 else int(round(q_len * 2.8))

            traffic_input[app_name] = {
                "vehicles": v_cnt,
                "pcu": pcu,
                "queue_length": q_len,
                "average_wait": avg_w,
                "arrival_rate": round(v_cnt * 0.8, 1),
                "has_emergency": bool(latest.emergency_detected) if latest else False,
            }

    active_emg = db.query(EmergencyEvent).filter(EmergencyEvent.status == "ACTIVE").first()
    emg_app = active_emg.direction.lower() if active_emg and active_emg.direction else None

    recommendation = signal_optimizer.optimize_junction_signals(
        traffic_state=traffic_input,
        current_phase=traffic_input.get("current_phase", "NORTH_SOUTH"),
        elapsed_green=float(traffic_input.get("elapsed_green", 20.0)),
        emergency_approach=emg_app,
    )

    return recommendation


@router.get("/config")
def get_optimizer_config():
    """Returns configurable demand weights and fairness constraints."""
    return {
        "demand_weights": signal_optimizer.demand_weights,
        "constraints": signal_optimizer.constraints,
    }


@router.post("/config")
def update_optimizer_config(config_data: Dict[str, Any]):
    """Updates demand weights and fairness constraints dynamically."""
    if "demand_weights" in config_data:
        signal_optimizer.demand_weights.update(config_data["demand_weights"])
    if "constraints" in config_data:
        signal_optimizer.constraints.update(config_data["constraints"])
    return {
        "status": "success",
        "demand_weights": signal_optimizer.demand_weights,
        "constraints": signal_optimizer.constraints,
    }


@router.post("/optimize/{camera_id}")
def calculate_optimal_signal(camera_id: str, db: Session = Depends(get_db)):
    active_emg = db.query(EmergencyEvent).filter(EmergencyEvent.camera_id == camera_id, EmergencyEvent.status == "ACTIVE").first()
    
    # Query latest traffic metric for this camera
    latest_metric = db.query(TrafficMetric).filter(TrafficMetric.camera_id == camera_id).order_by(TrafficMetric.timestamp.desc()).first()
    pcu = latest_metric.pcu_score if latest_metric else 25.0

    if active_emg:
        rec = SignalRecommendation(
            id=f"SIG-{int(time.time())}",
            intersection_name=f"Intersection ({camera_id})",
            camera_id=camera_id,
            northbound_green=60,
            southbound_green=10,
            eastbound_green=10,
            westbound_green=10,
            emergency_mode=True,
            priority_direction=active_emg.direction,
            status_text="🚨 EMERGENCY OVERRIDE PRIORITY ACTIVE (Green Wave)",
            timestamp=time.time(),
        )
    else:
        timing = _calculate_webster_timing(pcu_north=pcu * 0.45, pcu_south=pcu * 0.25, pcu_east=pcu * 0.15, pcu_west=pcu * 0.15, bus_count=1)
        rec = SignalRecommendation(
            id=f"SIG-{int(time.time())}",
            intersection_name=f"Intersection ({camera_id})",
            camera_id=camera_id,
            northbound_green=timing["northbound_green"],
            southbound_green=timing["southbound_green"],
            eastbound_green=timing["eastbound_green"],
            westbound_green=timing["westbound_green"],
            emergency_mode=False,
            priority_direction="Transit Signal Priority (Bus)" if timing["tsp_active"] else None,
            status_text=f"⚡ Webster Dynamic Timing (Cycle: {timing['cycle_length']}s, Edge Resilient)",
            timestamp=time.time(),
        )

    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


from ml.utils.predictive_optimizer import PredictiveSignalOptimizer
predictive_optimizer = PredictiveSignalOptimizer(base_optimizer=signal_optimizer)


@router.post("/predictive-optimize")
def predictive_optimize(payload: Optional[Dict[str, Any]] = None, db: Session = Depends(get_db)):
    """
    POST /api/signals/predictive-optimize
    Integrates real-time current traffic state with short-horizon forecast (+5m, +10m, +15m)
    to calculate proactive signal adjustments with complete operator explanations.
    """
    payload = payload or {}
    current_state = payload.get("current_state")
    forecast_data = payload.get("prediction")
    junction_id = payload.get("junction_id", "JUNCTION-01")

    if not current_state:
        # Pull live metrics from database / engine
        cam_id = "CAM-01"
        latest = db.query(TrafficMetric).filter(TrafficMetric.camera_id == cam_id).order_by(TrafficMetric.timestamp.desc()).first()
        v_cnt = latest.vehicle_count if latest else 22
        pcu = latest.pcu_score if (latest and latest.pcu_score > 0) else round(v_cnt * 1.2, 1)
        q_len = latest.queue_length if (latest and latest.queue_length > 0) else max(1, int(round(v_cnt * 0.45)))
        avg_w = int(round(latest.avg_waiting_time_sec)) if (latest and latest.avg_waiting_time_sec > 0) else int(round(q_len * 2.5))

        current_state = {
            "north": {"pcu": round(pcu * 0.50, 1), "queue_length": int(round(q_len * 0.50)), "average_wait": avg_w, "arrival_rate": round(v_cnt * 0.5, 1)},
            "south": {"pcu": round(pcu * 0.25, 1), "queue_length": int(round(q_len * 0.25)), "average_wait": int(round(avg_w * 0.7)), "arrival_rate": round(v_cnt * 0.3, 1)},
            "east":  {"pcu": round(pcu * 0.15, 1), "queue_length": int(round(q_len * 0.15)), "average_wait": int(round(avg_w * 0.5)), "arrival_rate": round(v_cnt * 0.1, 1)},
            "west":  {"pcu": round(pcu * 0.10, 1), "queue_length": int(round(q_len * 0.10)), "average_wait": int(round(avg_w * 0.4)), "arrival_rate": round(v_cnt * 0.1, 1)},
        }

    res = predictive_optimizer.optimize_predictive_signals(
        current_state=current_state,
        forecast_data=forecast_data,
        junction_id=junction_id,
    )
    return res


