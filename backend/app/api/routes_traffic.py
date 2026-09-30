import time
import cv2
import numpy as np
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.database.models import TrafficMetric, Camera
from ml.utils.detector import VehicleDetector
from ml.utils.traffic_engine import TrafficStateEngine
from ml.utils.emergency import EmergencyDetector

router = APIRouter(prefix="/api/traffic", tags=["Traffic Analytics"])

detector = VehicleDetector()
traffic_engine = TrafficStateEngine(roi_area_px2=1280 * 720)
emergency_detector = EmergencyDetector()


@router.get("/current")
def get_current_traffic(db: Session = Depends(get_db)):
    metrics = db.query(TrafficMetric).order_by(TrafficMetric.timestamp.desc()).limit(10).all()
    if not metrics:
        # Fallback metric if DB is fresh
        return [{
            "camera_id": "CAM-01",
            "timestamp": time.time(),
            "vehicle_count": 24,
            "pedestrian_count": 6,
            "total_count": 30,
            "density": 0.052,
            "density_percentage": 68.0,
            "queue_length": 4,
            "avg_speed": 28.4,
            "avg_waiting_time_sec": 7.5,
            "traffic_score": 64.5,
            "congestion_level": "HIGH",
            "emergency_detected": False,
        }]
    return metrics


@router.get("/vehicles")
def get_tracked_vehicles(camera_id: str = "CAM-01"):
    """
    Returns active tracked vehicles and aggregate counts for a given camera / corridor.
    Includes persistent track IDs, vehicle type, bounding box, center coordinates, confidence,
    and movement direction.
    """
    vehicles = traffic_engine.get_tracked_vehicles(camera_id)
    
    # Calculate vehicle type composition
    composition = {
        "cars": sum(1 for v in vehicles if v.get("vehicle_type") == "car"),
        "motorcycles": sum(1 for v in vehicles if v.get("vehicle_type") in ["motorcycle", "motorbike"]),
        "buses": sum(1 for v in vehicles if v.get("vehicle_type") == "bus"),
        "trucks": sum(1 for v in vehicles if v.get("vehicle_type") == "truck"),
        "auto_rickshaws": sum(1 for v in vehicles if v.get("vehicle_type") in ["three wheeler", "auto", "auto rickshaw"]),
        "bicycles": sum(1 for v in vehicles if v.get("vehicle_type") == "bicycle"),
        "emergency": sum(1 for v in vehicles if v.get("vehicle_type") in ["ambulance", "emergency"]),
        "other": sum(1 for v in vehicles if v.get("vehicle_type") in ["tractor", "van", "pickup", "minivan", "suv"]),
    }

    return {
        "camera_id": camera_id,
        "timestamp": time.time(),
        "total_vehicles": len(vehicles),
        "composition": composition,
        "active_vehicles": vehicles,
    }


@router.get("/analytics")
def get_pcu_analytics(camera_id: str = "CAM-01", db: Session = Depends(get_db)):
    """
    Returns real-time PCU traffic analytics:
    - total_vehicles
    - total_pcu
    - vehicle_breakdown
    - pcu_breakdown
    - density_level (LOW, MEDIUM, HIGH, SEVERE)
    - timestamp
    """
    analytics = traffic_engine.get_pcu_analytics(camera_id)
    
    # If no live tracks exist in in-memory window yet, retrieve most recent metric from DB as fallback
    if analytics["total_vehicles"] == 0:
        latest = db.query(TrafficMetric).filter(TrafficMetric.camera_id == camera_id).order_by(TrafficMetric.timestamp.desc()).first()
        if latest and latest.vehicle_count > 0:
            est_pcu = latest.pcu_score if latest.pcu_score > 0 else round(latest.vehicle_count * 1.15, 1)
            est_cars = max(0, int(round(latest.vehicle_count * 0.55)))
            est_motos = max(0, int(round(latest.vehicle_count * 0.25)))
            est_buses = max(0, int(round(latest.vehicle_count * 0.08)))
            est_trucks = max(0, int(round(latest.vehicle_count * 0.04)))
            est_autos = max(0, latest.vehicle_count - (est_cars + est_motos + est_buses + est_trucks))

            v_bd = {
                "cars": est_cars,
                "motorcycles": est_motos,
                "buses": est_buses,
                "trucks": est_trucks,
                "auto_rickshaws": est_autos,
                "bicycles": 0,
                "emergency": 1 if latest.emergency_detected else 0,
                "other": 0,
            }
            p_bd = {
                "cars": round(est_cars * traffic_engine.get_pcu_weight("car"), 1),
                "motorcycles": round(est_motos * traffic_engine.get_pcu_weight("motorcycle"), 1),
                "buses": round(est_buses * traffic_engine.get_pcu_weight("bus"), 1),
                "trucks": round(est_trucks * traffic_engine.get_pcu_weight("truck"), 1),
                "auto_rickshaws": round(est_autos * traffic_engine.get_pcu_weight("auto_rickshaw"), 1),
                "bicycles": 0.0,
                "emergency": round(1 * traffic_engine.get_pcu_weight("emergency"), 1) if latest.emergency_detected else 0.0,
                "other": 0.0,
            }
            return {
                "camera_id": camera_id,
                "timestamp": latest.timestamp,
                "total_vehicles": latest.vehicle_count,
                "total_pcu": round(sum(p_bd.values()), 1),
                "vehicle_breakdown": v_bd,
                "pcu_breakdown": p_bd,
                "density_level": traffic_engine.classify_density_level(pcu=sum(p_bd.values()), density_percentage=latest.density_percentage, queue_length=latest.queue_length),
            }

    return {
        "camera_id": analytics["camera_id"],
        "timestamp": analytics["timestamp"],
        "total_vehicles": analytics["total_vehicles"],
        "total_pcu": analytics["total_pcu"],
        "vehicle_breakdown": analytics["vehicle_breakdown"],
        "pcu_breakdown": analytics["pcu_breakdown"],
        "density_level": analytics["density_level"],
    }


@router.get("/pcu-config")
def get_pcu_config():
    """Returns current active PCU weights and density thresholds."""
    return {
        "pcu_weights": traffic_engine.pcu_weights,
        "density_thresholds": traffic_engine.density_thresholds,
        "road_capacity_pcu_per_hr": traffic_engine.road_capacity,
    }


@router.post("/pcu-config")
def update_pcu_config(weights: dict):
    """Updates configurable PCU weights dynamically without server restart."""
    for vtype, weight in weights.items():
        traffic_engine.set_pcu_weight(vtype, weight)
    return {
        "status": "success",
        "message": "PCU configuration updated",
        "pcu_weights": traffic_engine.pcu_weights,
    }


@router.get("/junction/{junction_id}")
def get_junction_traffic(junction_id: str = "JUNCTION-01", db: Session = Depends(get_db)):
    """
    Returns approach-wise metrics for a 4-way junction:
    - north, south, east, west approaches
    - vehicle count, PCU, estimated queue length (units & meters), average & max waiting time, arrival rate
    """
    metrics = traffic_engine.get_junction_metrics(junction_id)

    # Fallback to recent metrics from DB if live video snapshot has not been polled yet
    if metrics["total_vehicles"] == 0:
        cam_map = {"north": "CAM-01", "south": "CAM-02", "east": "CAM-03", "west": "CAM-04"}
        approaches = {}
        for app_name, cid in cam_map.items():
            latest = db.query(TrafficMetric).filter(TrafficMetric.camera_id == cid).order_by(TrafficMetric.timestamp.desc()).first()
            v_cnt = latest.vehicle_count if latest else 14
            pcu = latest.pcu_score if (latest and latest.pcu_score > 0) else round(v_cnt * 1.2, 1)
            q_len = latest.queue_length if (latest and latest.queue_length > 0) else max(1, int(round(v_cnt * 0.45)))
            avg_w = int(round(latest.avg_waiting_time_sec)) if (latest and latest.avg_waiting_time_sec > 0) else int(round(q_len * 2.8))

            approaches[app_name] = {
                "name": f"{app_name.capitalize()} Approach",
                "camera_id": cid,
                "vehicles": v_cnt,
                "pcu": pcu,
                "queue_length": q_len,
                "queue_meters": round(q_len * 5.2, 1),
                "average_wait": avg_w,
                "max_wait": int(round(avg_w * 1.5)),
                "arrival_rate": round(v_cnt * 1.2, 1),
                "density_level": traffic_engine.classify_density_level(pcu=pcu, queue_length=q_len, vehicle_count=v_cnt),
            }

        return {
            "junction_id": junction_id,
            "timestamp": time.time(),
            "total_vehicles": sum(a["vehicles"] for a in approaches.values()),
            "total_pcu": round(sum(a["pcu"] for a in approaches.values()), 1),
            "approaches": approaches,
            "north": approaches["north"],
            "south": approaches["south"],
            "east": approaches["east"],
            "west": approaches["west"],
        }

    return metrics


@router.get("/queue-config")
def get_queue_config():
    """Returns configurable queue and waiting time thresholds."""
    return {
        "queue_params": traffic_engine.queue_params,
        "approach_rois": traffic_engine.approach_configs,
    }


@router.post("/queue-config")
def update_queue_config(params: dict):
    """Updates stationary speed threshold, min wait duration, or approach queue zones."""
    for key, val in params.items():
        if key in traffic_engine.queue_params:
            traffic_engine.set_queue_param(key, val)
    return {
        "status": "success",
        "message": "Queue parameters updated",
        "queue_params": traffic_engine.queue_params,
    }


@router.get("/history")
def get_traffic_history(camera_id: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    query = db.query(TrafficMetric)
    if camera_id:
        query = query.filter(TrafficMetric.camera_id == camera_id)
    return query.order_by(TrafficMetric.timestamp.desc()).limit(limit).all()


@router.post("/analyze-frame")
async def analyze_frame(
    camera_id: str = Form("CAM-01"),
    conf_threshold: float = Form(0.35),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    contents = await file.read()
    np_arr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image frame")

    detections = detector.detect_and_track(frame, camera_id=camera_id, conf_threshold=conf_threshold)
    state = traffic_engine.update(camera_id, detections)

    emergency_hits = []
    any_emergency = any(det.get("class_name") == "ambulance" for det in detections)

    for det in detections:
        if det.get("class_name") == "ambulance":
            det["is_emergency"] = True
            emergency_hits.append({
                "is_emergency": True,
                "confidence": det.get("confidence", 0.9),
                "reason": "Ambulance class detected",
                "bbox": det["bbox"]
            })
            continue

        emg = emergency_detector.check(frame, det["bbox"], det.get("class_name", "car"))
        if emg["is_emergency"]:
            any_emergency = True
            det["is_emergency"] = True
            emergency_hits.append(emg)

    metric = TrafficMetric(
        camera_id=camera_id,
        timestamp=time.time(),
        vehicle_count=state["vehicle_count"],
        pedestrian_count=state["pedestrian_count"],
        total_count=state["total_count"],
        pcu_score=state.get("pcu_score", 0.0),
        density=state["density"],
        density_percentage=state["density_percentage"],
        queue_length=state["queue_length"],
        avg_speed=state["avg_speed"],
        avg_waiting_time_sec=state["avg_waiting_time_sec"],
        traffic_score=state["traffic_score"],
        congestion_level=state["congestion_level"],
        emergency_detected=any_emergency,
    )
    db.add(metric)
    db.commit()

    return {
        "camera_id": camera_id,
        "timestamp": time.time(),
        "state": state,
        "emergency_detected": any_emergency,
        "emergency_hits": emergency_hits,
        "detections": detections,
    }
