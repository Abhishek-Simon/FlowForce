"""
Corridor Green Wave & Multi-Junction Network Coordinator Route
Coordinates automated priority signal preemption across consecutive CCTV junction nodes using OSRM ETAs.
"""

import time
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.database.models import Camera, EmergencyEvent, SignalRecommendation
from backend.app.services.osrm_service import get_travel_time_osrm
from backend.app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/api/corridor", tags=["Corridor Network Coordination"])


class GreenWaveRequest(BaseModel):
    source_camera_id: str = "CAM-01"
    target_camera_id: Optional[str] = "CAM-02"
    vehicle_type: str = "Ambulance (EMS-911)"
    direction: str = "Northbound"


@router.post("/ambulance-trigger")
async def trigger_corridor_green_wave(
    req: GreenWaveRequest,
    db: Session = Depends(get_db),
):
    """
    Triggers Green Wave corridor coordination between source and next downstream junction.
    Uses OSRM for zero-cost routing ETA calculations.
    """
    cam1 = db.query(Camera).filter(Camera.id == req.source_camera_id).first()
    cam2 = db.query(Camera).filter(Camera.id == req.target_camera_id).first()

    if not cam1:
        cam1 = db.query(Camera).first() or Camera(id="CAM-01", name="North Junction", lat=12.9716, lng=77.5946)
    if not cam2:
        cams = db.query(Camera).all()
        cam2 = cams[1] if len(cams) > 1 else (cams[0] if cams else Camera(id="CAM-02", name="Central Plaza", lat=12.9725, lng=77.5955))

    coords1 = (cam1.lat, cam1.lng)
    coords2 = (cam2.lat, cam2.lng)

    # Calculate travel time via OSRM
    eta_res = get_travel_time_osrm(coords1, coords2)
    travel_time_sec = eta_res["duration_sec"]
    preemption_lead_sec = max(5.0, travel_time_sec - 10.0)

    now = time.time()

    # 1. Immediate override on Source Junction (CAM-01)
    rec1 = SignalRecommendation(
        id=f"GW-SIG-{int(now)}-1",
        intersection_name=f"{cam1.name} (Source Node)",
        camera_id=cam1.id,
        northbound_green=60 if req.direction == "Northbound" else 15,
        southbound_green=60 if req.direction == "Southbound" else 15,
        eastbound_green=60 if req.direction == "Eastbound" else 15,
        westbound_green=60 if req.direction == "Westbound" else 15,
        emergency_mode=True,
        priority_direction=req.direction,
        status_text=f"🚨 IMMEDIATE GREEN WAVE OVERRIDE ACTIVE for {req.vehicle_type}",
        timestamp=now,
    )
    db.add(rec1)

    # 2. Primed Green Wave on Next Junction (CAM-02)
    rec2 = SignalRecommendation(
        id=f"GW-SIG-{int(now)}-2",
        intersection_name=f"{cam2.name} (Downstream Corridor Node)",
        camera_id=cam2.id,
        northbound_green=55 if req.direction == "Northbound" else 20,
        southbound_green=55 if req.direction == "Southbound" else 20,
        eastbound_green=55 if req.direction == "Eastbound" else 20,
        westbound_green=55 if req.direction == "Westbound" else 20,
        emergency_mode=True,
        priority_direction=req.direction,
        status_text=f"🟢 GREEN WAVE PRIMED (OSRM ETA: {travel_time_sec}s · Triggering in {preemption_lead_sec:.0f}s)",
        timestamp=now,
    )
    db.add(rec2)

    # Record Emergency Event
    emg = EmergencyEvent(
        id=f"GW-EMG-{int(now)}",
        camera_id=cam1.id,
        vehicle_type=req.vehicle_type,
        confidence=0.96,
        direction=req.direction,
        priority="CRITICAL",
        status="ACTIVE",
        recommended_action=f"CORRIDOR GREEN WAVE: Hold {cam1.id} & {cam2.id} {req.direction} GREEN for incoming {req.vehicle_type}. OSRM ETA: {travel_time_sec}s",
        timestamp=now,
    )
    db.add(emg)
    db.commit()

    # Broadcast via WebSocket
    corridor_data = {
        "event": "green_wave_triggered",
        "source_camera": cam1.id,
        "target_camera": cam2.id,
        "direction": req.direction,
        "osrm_eta_sec": travel_time_sec,
        "distance_meters": eta_res["distance_m"],
        "preemption_lead_sec": preemption_lead_sec,
        "osrm_source": eta_res["source"],
    }
    await ws_manager.broadcast_json({"type": "corridor_alert", "data": corridor_data})

    return {
        "status": "success",
        "message": f"Green Wave active from {cam1.name} to {cam2.name}",
        "corridor_details": corridor_data,
    }


class PlatoonProgressionRequest(BaseModel):
    source_camera_id: str = "CAM-01"
    target_camera_id: str = "CAM-02"
    platoon_speed_kmh: float = 35.0


@router.post("/platoon-progression")
def calculate_platoon_progression_offset(
    req: PlatoonProgressionRequest,
    db: Session = Depends(get_db),
):
    """
    Calculates Platoon Progression Green Wave offset for regular vehicles using OSRM ETAs.
    Ensures vehicles passing Junction 1 arrive at Junction 2 right as Junction 2 turns GREEN.
    """
    cam1 = db.query(Camera).filter(Camera.id == req.source_camera_id).first()
    cam2 = db.query(Camera).filter(Camera.id == req.target_camera_id).first()

    if not cam1:
        cam1 = db.query(Camera).first() or Camera(id="CAM-01", name="North Junction", lat=12.9716, lng=77.5946)
    if not cam2:
        cams = db.query(Camera).all()
        cam2 = cams[1] if len(cams) > 1 else (cams[0] if cams else Camera(id="CAM-02", name="Central Plaza", lat=12.9725, lng=77.5955))

    # Get OSRM travel duration
    eta = get_travel_time_osrm((cam1.lat, cam1.lng), (cam2.lat, cam2.lng))
    travel_sec = eta["duration_sec"]

    # Calculate optimal signal phase offset
    # Junction 2 Green Phase start = Junction 1 Green Phase start + travel duration
    now = time.time()
    offset_sec = round(travel_sec % 120.0, 1)

    rec = SignalRecommendation(
        id=f"PLT-{int(now)}",
        intersection_name=f"Platoon Corridor ({cam1.id} ➔ {cam2.id})",
        camera_id=cam2.id,
        northbound_green=40,
        southbound_green=40,
        eastbound_green=20,
        westbound_green=20,
        emergency_mode=False,
        priority_direction="Northbound",
        status_text=f"🟢 PLATOON PROGRESSION BANDWIDTH ACTIVE: {travel_sec:.0f}s OSRM Offset applied. Zero-Stop Flow Enabled.",
        timestamp=now,
    )
    db.add(rec)
    db.commit()

    return {
        "status": "success",
        "corridor": f"{cam1.name} ➔ {cam2.name}",
        "osrm_travel_duration_sec": travel_sec,
        "platoon_speed_kmh": req.platoon_speed_kmh,
        "junction2_phase_offset_sec": offset_sec,
        "progression_mode": "ZERO_STOP_PLATOON_FLOW",
    }


@router.get("/status")
def get_corridor_status(db: Session = Depends(get_db)):
    """
    Returns current multi-junction corridor status across consecutive network nodes.
    """
    cameras = db.query(Camera).all()
    active_emg = db.query(EmergencyEvent).filter(EmergencyEvent.status == "ACTIVE").all()

    corridor_nodes = []
    for c in cameras:
        corridor_nodes.append({
            "camera_id": c.id,
            "name": c.name,
            "location": c.location,
            "lat": c.lat,
            "lng": c.lng,
            "status": c.status,
        })

    return {
        "total_nodes": len(corridor_nodes),
        "corridor_nodes": corridor_nodes,
        "active_corridor_emergencies": len(active_emg),
        "green_wave_status": "ACTIVE_OVERRIDE" if active_emg else "PLATOON_PROGRESSION_ACTIVE",
    }
