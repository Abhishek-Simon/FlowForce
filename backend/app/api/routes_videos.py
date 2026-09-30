import os
import uuid
import time
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.connection import get_db
from backend.app.database.models import VideoJob
from backend.app.schemas.schemas import VideoJobResponse
from backend.app.workers.video_worker import video_worker

router = APIRouter(prefix="/api/videos", tags=["Video Processing"])


@router.post("/upload", response_model=VideoJobResponse)
async def upload_video(
    file: UploadFile = File(...),
    camera_id: str = Form("CAM-01"),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".mp4", ".avi", ".mov", ".mkv"]:
        raise HTTPException(status_code=400, detail=f"Unsupported video format: {ext}. Supported: MP4, AVI, MOV, MKV")

    job_id = f"JOB-{uuid.uuid4().hex[:8]}"
    upload_path = os.path.join(settings.UPLOAD_DIR, f"{job_id}_{file.filename}")

    content = await file.read()

    # If dummy placeholder from quick-test button (length < 100 bytes), copy real sample video from ml/samples
    if len(content) < 100 and file.filename in ["sample_traffic.mp4", "sample_pedestrian.mp4"]:
        sample_source = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "ml", "samples", file.filename)
        if not os.path.exists(sample_source):
            sample_source = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "traffic-ml", "samples", file.filename)
        if os.path.exists(sample_source):
            with open(sample_source, "rb") as sf:
                content = sf.read()

    with open(upload_path, "wb") as f:
        f.write(content)

    job = VideoJob(
        id=job_id,
        filename=file.filename,
        file_path=upload_path,
        camera_id=camera_id,
        status="QUEUED",
        progress=0.0,
        created_at=time.time(),
        updated_at=time.time(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return job


@router.post("/{job_id}/process", response_model=VideoJobResponse)
def process_video(job_id: str, db: Session = Depends(get_db)):
    job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if job.status == "PROCESSING":
        return job

    video_worker.process_job_async(job_id)
    job.status = "PROCESSING"
    job.progress = 5.0
    job.updated_at = time.time()
    db.commit()
    db.refresh(job)
    return job


@router.get("", response_model=List[VideoJobResponse])
def list_video_jobs(db: Session = Depends(get_db)):
    return db.query(VideoJob).order_by(VideoJob.created_at.desc()).all()


@router.get("/{job_id}", response_model=VideoJobResponse)
def get_video_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


@router.get("/download/{job_id}")
def download_video(job_id: str, db: Session = Depends(get_db)):
    job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
    if not job or not job.output_path or not os.path.exists(job.output_path):
        raise HTTPException(status_code=404, detail="Annotated video not ready or file missing")

    return FileResponse(
        job.output_path,
        media_type="video/mp4",
        filename=f"annotated_{job.camera_id}.mp4",
    )
