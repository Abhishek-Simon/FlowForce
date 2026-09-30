import time
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, ForeignKey, DateTime
from backend.app.database.connection import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="OPERATOR")  # ADMIN, OPERATOR, VIEWER
    full_name = Column(String)
    created_at = Column(Float, default=time.time)


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    source_type = Column(String, default="VIDEO_FILE")  # VIDEO_FILE, WEBCAM, RTSP, HTTP_STREAM
    source_url = Column(String, nullable=False)
    status = Column(String, default="ONLINE")  # ONLINE, OFFLINE, PROCESSING, ERROR
    fps = Column(Float, default=25.0)
    resolution = Column(String, default="1920x1080")
    lat = Column(Float, default=12.9716)
    lng = Column(Float, default=77.5946)
    last_seen = Column(Float, default=time.time)
    created_at = Column(Float, default=time.time)


class VideoJob(Base):
    __tablename__ = "video_jobs"

    id = Column(String, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    camera_id = Column(String, ForeignKey("cameras.id"), index=True, default="CAM-01")
    status = Column(String, default="QUEUED")  # QUEUED, PROCESSING, COMPLETED, FAILED
    progress = Column(Float, default=0.0)
    output_path = Column(String, nullable=True)
    download_url = Column(String, nullable=True)
    total_frames = Column(Integer, default=0)
    processed_frames = Column(Integer, default=0)
    duration_sec = Column(Float, default=0.0)
    max_score = Column(Float, default=0.0)
    max_congestion = Column(String, default="LOW")
    emergency_count = Column(Integer, default=0)
    error_message = Column(String, nullable=True)
    created_at = Column(Float, default=time.time)
    updated_at = Column(Float, default=time.time)


class TrafficMetric(Base):
    __tablename__ = "traffic_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.id"), index=True)
    timestamp = Column(Float, index=True, default=time.time)
    vehicle_count = Column(Integer, default=0)
    pedestrian_count = Column(Integer, default=0)
    total_count = Column(Integer, default=0)
    pcu_score = Column(Float, default=0.0)
    density = Column(Float, default=0.0)
    density_percentage = Column(Float, default=0.0)
    queue_length = Column(Integer, default=0)
    avg_speed = Column(Float, default=0.0)
    avg_waiting_time_sec = Column(Float, default=0.0)
    traffic_score = Column(Float, default=0.0)
    congestion_level = Column(String, default="LOW")  # LOW, MODERATE, HIGH, SEVERE
    emergency_detected = Column(Boolean, default=False)


class EmergencyEvent(Base):
    __tablename__ = "emergency_events"

    id = Column(String, primary_key=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.id"), index=True)
    vehicle_type = Column(String, default="Ambulance")
    confidence = Column(Float, default=0.9)
    direction = Column(String, default="Northbound")
    priority = Column(String, default="HIGH")  # CRITICAL, HIGH, MEDIUM
    status = Column(String, default="ACTIVE")  # ACTIVE, ACKNOWLEDGED, CLEARED
    recommended_action = Column(String, default="Prioritize Green signal for target direction")
    timestamp = Column(Float, default=time.time)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.id"), index=True)
    incident_type = Column(String, nullable=False)  # STOPPED_VEHICLE, HIGH_CONGESTION, PEDESTRIAN_SURGE, EMERGENCY_VEHICLE
    severity = Column(String, default="WARNING")  # INFO, WARNING, HIGH, CRITICAL
    description = Column(String, nullable=False)
    status = Column(String, default="OPEN")  # OPEN, INVESTIGATING, RESOLVED
    timestamp = Column(Float, default=time.time)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.id"), index=True)
    alert_type = Column(String, nullable=False)
    severity = Column(String, default="WARNING")
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    is_resolved = Column(Boolean, default=False)
    timestamp = Column(Float, default=time.time)


class SignalRecommendation(Base):
    __tablename__ = "signal_recommendations"

    id = Column(String, primary_key=True, index=True)
    intersection_name = Column(String, default="Main Junction")
    camera_id = Column(String, ForeignKey("cameras.id"), index=True)
    northbound_green = Column(Integer, default=30)
    southbound_green = Column(Integer, default=30)
    eastbound_green = Column(Integer, default=20)
    westbound_green = Column(Integer, default=20)
    emergency_mode = Column(Boolean, default=False)
    priority_direction = Column(String, nullable=True)
    status_text = Column(String, default="Simulated - Awaiting Traffic Controller Integration")
    timestamp = Column(Float, default=time.time)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    username = Column(String, default="system")
    action = Column(String, nullable=False)
    details = Column(String, nullable=True)
    timestamp = Column(Float, default=time.time)
