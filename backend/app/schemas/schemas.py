from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# Auth Schemas
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


# Camera Schemas
class CameraCreate(BaseModel):
    id: str
    name: str
    location: str
    source_type: str = "VIDEO_FILE"
    source_url: str
    status: str = "ONLINE"
    fps: float = 25.0
    resolution: str = "1920x1080"
    lat: float = 12.9716
    lng: float = 77.5946


class CameraResponse(CameraCreate):
    last_seen: float
    created_at: float

    class Config:
        from_attributes = True


# Video Job Schemas
class VideoJobResponse(BaseModel):
    id: str
    filename: str
    file_path: str
    camera_id: str
    status: str
    progress: float
    output_path: Optional[str] = None
    download_url: Optional[str] = None
    total_frames: int
    processed_frames: int
    duration_sec: float
    max_score: float
    max_congestion: str
    emergency_count: int
    error_message: Optional[str] = None
    created_at: float
    updated_at: float

    class Config:
        from_attributes = True


# Traffic Metric Schemas
class TrafficMetricResponse(BaseModel):
    camera_id: str
    timestamp: float
    vehicle_count: int
    pedestrian_count: int
    total_count: int
    density: float
    density_percentage: float
    queue_length: int
    avg_speed: float
    avg_waiting_time_sec: float
    traffic_score: float
    congestion_level: str
    emergency_detected: bool

    class Config:
        from_attributes = True


# Emergency Event Schema
class EmergencyEventResponse(BaseModel):
    id: str
    camera_id: str
    vehicle_type: str
    confidence: float
    direction: str
    priority: str
    status: str
    recommended_action: str
    timestamp: float

    class Config:
        from_attributes = True


# Signal Recommendation Schema
class SignalRecommendationResponse(BaseModel):
    id: str
    intersection_name: str
    camera_id: str
    northbound_green: int
    southbound_green: int
    eastbound_green: int
    westbound_green: int
    emergency_mode: bool
    priority_direction: Optional[str] = None
    status_text: str
    timestamp: float

    class Config:
        from_attributes = True


# Alert Schema
class AlertResponse(BaseModel):
    id: str
    camera_id: str
    alert_type: str
    severity: str
    message: str
    is_read: bool
    is_resolved: bool
    timestamp: float

    class Config:
        from_attributes = True
