import time
import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.database.models import Camera
from backend.app.schemas.schemas import CameraCreate, CameraResponse

router = APIRouter(prefix="/api/cameras", tags=["Cameras"])


@router.get("", response_model=List[CameraResponse])
def list_cameras(db: Session = Depends(get_db)):
    return db.query(Camera).all()


@router.post("", response_model=CameraResponse)
def create_camera(camera_in: CameraCreate, db: Session = Depends(get_db)):
    existing = db.query(Camera).filter(Camera.id == camera_in.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Camera with ID {camera_in.id} already exists")

    cam = Camera(**camera_in.model_dump(), last_seen=time.time(), created_at=time.time())
    db.add(cam)
    db.commit()
    db.refresh(cam)
    return cam


@router.get("/{camera_id}", response_model=CameraResponse)
def get_camera(camera_id: str, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    return cam


@router.put("/{camera_id}", response_model=CameraResponse)
def update_camera(camera_id: str, camera_in: CameraCreate, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")

    for key, value in camera_in.model_dump().items():
        setattr(cam, key, value)

    cam.last_seen = time.time()
    db.commit()
    db.refresh(cam)
    return cam


@router.delete("/{camera_id}")
def delete_camera(camera_id: str, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")

    db.delete(cam)
    db.commit()
    return {"status": "success", "message": f"Camera {camera_id} deleted"}


@router.post("/{camera_id}/upload-source")
async def upload_camera_source(
    camera_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Saves an uploaded video file to server storage and updates the Camera's source_url in SQLite DB
    so that fitted videos persist permanently across page refreshes.
    """
    from backend.app.core.config import settings
    import uuid

    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")

    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".mp4"
    saved_filename = f"fitted_{camera_id}_{uuid.uuid4().hex[:8]}{ext}"
    saved_path = os.path.join(settings.UPLOAD_DIR, saved_filename)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    content = await file.read()
    with open(saved_path, "wb") as f:
        f.write(content)

    # Relative path stored in database
    rel_path = os.path.relpath(saved_path, os.getcwd()).replace("\\", "/")
    cam.source_url = rel_path
    cam.source_type = "VIDEO_FILE"
    cam.last_seen = time.time()
    db.commit()
    db.refresh(cam)

    return {
        "status": "success",
        "camera_id": camera_id,
        "source_url": cam.source_url,
        "filename": file.filename,
        "message": f"Fitted video for {camera_id} saved to database permanently",
    }


@router.get("/{camera_id}/stream")
def stream_camera_feed(camera_id: str, db: Session = Depends(get_db)):
    """
    Streams live OpenCV MJPEG video feed for target camera with real-time YOLOv8 HUD overlays.
    """
    from fastapi.responses import StreamingResponse
    import cv2
    from ml.utils.detector import VehicleDetector
    from ml.utils.emergency import EmergencyDetector

    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    source_url = cam.source_url if cam and cam.source_url else "samples/sample_traffic.mp4"

    # If Webcam device 0 or relative sample path
    if source_url.isdigit():
        video_src = int(source_url)
    elif not source_url.startswith("http") and not source_url.startswith("rtsp"):
        video_src = os.path.join(os.getcwd(), source_url)
    else:
        video_src = source_url

    def generate_frames():
        cap = cv2.VideoCapture(video_src)
        detector = VehicleDetector()
        emergency_det = EmergencyDetector()
        cached_detections = []
        frame_count = 0

        while True:
            success, frame = cap.read()
            if not success:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            frame_count += 1

            # Resize to lightweight 640x360 for high-speed 30 FPS playback
            h, w = frame.shape[:2]
            if w > 640:
                frame = cv2.resize(frame, (640, int(h * 640 / w)))

            # Run YOLOv8 detection every 3rd frame to ensure 30+ FPS smooth rendering
            if frame_count % 3 == 0 or len(cached_detections) == 0:
                try:
                    cached_detections = detector.detect_and_track(frame, camera_id=camera_id, conf_threshold=0.28)
                except Exception:
                    pass

            # Draw cached detection boxes smoothly on every frame
            for det in cached_detections:
                box = det["bbox"]
                cls_name = det.get("class_name", "object")
                x1, y1, x2, y2 = map(int, box)

                emg = emergency_det.check(frame, box, cls_name)
                color = (0, 0, 255) if emg["is_emergency"] else (46, 204, 113) if cls_name == "car" else (255, 140, 0)
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                label = f"{'🚨 EMG' if emg['is_emergency'] else cls_name} {int(det.get('confidence', 0.9)*100)}%"
                cv2.putText(frame, label, (x1, max(12, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.40, color, 1)

            # High-speed JPEG encoding (quality 65)
            ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 65])
            if not ret:
                continue
            frame_bytes = buffer.tobytes()
            time.sleep(0.033) # 30 FPS sync throttle
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")
