import time
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.database.models import Alert, Incident
from backend.app.schemas.schemas import AlertResponse

router = APIRouter(prefix="/api/alerts", tags=["Alerts & Incidents"])


@router.get("", response_model=List[AlertResponse])
def get_alerts(db: Session = Depends(get_db)):
    alerts = db.query(Alert).order_by(Alert.timestamp.desc()).all()
    if not alerts:
        return [
            Alert(
                id="ALT-101",
                camera_id="CAM-01",
                alert_type="HIGH_CONGESTION",
                severity="HIGH",
                message="Traffic density exceeded 70% threshold at Junction North",
                is_read=False,
                is_resolved=False,
                timestamp=time.time() - 300,
            ),
            Alert(
                id="ALT-102",
                camera_id="CAM-04",
                alert_type="PEDESTRIAN_SURGE",
                severity="WARNING",
                message="Pedestrian count surge detected near crosswalk ROI",
                is_read=True,
                is_resolved=False,
                timestamp=time.time() - 600,
            ),
        ]
    return alerts


@router.post("/{alert_id}/resolve")
def resolve_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    alert.is_resolved = True
    alert.is_read = True
    db.commit()
    return {"status": "success", "message": f"Alert {alert_id} resolved"}


@router.get("/incidents")
def get_incidents(db: Session = Depends(get_db)):
    incidents = db.query(Incident).order_by(Incident.timestamp.desc()).all()
    if not incidents:
        return [
            {
                "id": "INC-01",
                "camera_id": "CAM-02",
                "incident_type": "STOPPED_VEHICLE",
                "severity": "WARNING",
                "description": "Vehicle stationary in active lane for > 45 seconds",
                "status": "OPEN",
                "timestamp": time.time() - 900,
            }
        ]
    return incidents
