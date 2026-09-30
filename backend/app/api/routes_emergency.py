import time
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.database.models import EmergencyEvent
from backend.app.schemas.schemas import EmergencyEventResponse

router = APIRouter(prefix="/api/emergency", tags=["Emergency Response"])


@router.get("/events", response_model=List[EmergencyEventResponse])
def get_emergency_events(db: Session = Depends(get_db)):
    events = db.query(EmergencyEvent).order_by(EmergencyEvent.timestamp.desc()).all()
    if not events:
        return [
            EmergencyEvent(
                id="EMG-SAMPLE-1",
                camera_id="CAM-01",
                vehicle_type="Ambulance",
                confidence=0.94,
                direction="Northbound",
                priority="CRITICAL",
                status="ACTIVE",
                recommended_action="Give GREEN priority to Northbound lane at Main Intersection",
                timestamp=time.time() - 120,
            )
        ]
    return events


@router.get("/active", response_model=List[EmergencyEventResponse])
def get_active_emergency(db: Session = Depends(get_db)):
    return db.query(EmergencyEvent).filter(EmergencyEvent.status == "ACTIVE").all()


@router.post("/{event_id}/acknowledge")
def acknowledge_emergency(event_id: str, db: Session = Depends(get_db)):
    event = db.query(EmergencyEvent).filter(EmergencyEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Emergency event {event_id} not found")

    event.status = "ACKNOWLEDGED"
    db.commit()
    return {"status": "success", "message": f"Emergency event {event_id} acknowledged"}


@router.post("/{event_id}/clear")
def clear_emergency(event_id: str, db: Session = Depends(get_db)):
    event = db.query(EmergencyEvent).filter(EmergencyEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Emergency event {event_id} not found")

    event.status = "CLEARED"
    db.commit()
    return {"status": "success", "message": f"Emergency event {event_id} cleared"}


@router.post("/simulate-corridor")
def simulate_corridor(camera_id: str = "CAM-01", db: Session = Depends(get_db)):
    sim_id = f"EMG-SIM-{int(time.time())}"
    new_event = EmergencyEvent(
        id=sim_id,
        camera_id=camera_id,
        vehicle_type="Ambulance",
        confidence=0.98,
        direction="North Corridor (Approach 1)",
        priority="CRITICAL",
        status="ACTIVE",
        recommended_action="ACTIVE PREEMPTION: Force GREEN on North approach; hold East/West/South on RED.",
        timestamp=time.time(),
    )
    db.add(new_event)
    db.commit()
    return {
        "status": "success",
        "event_id": sim_id,
        "message": "Emergency Priority Preemption Corridor Activated for North Approach!",
    }

