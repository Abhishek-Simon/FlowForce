import time
import os
import sys
import torch
from fastapi import APIRouter
from backend.app.core.config import settings

router = APIRouter(prefix="/api/system", tags=["System Health & Settings"])


@router.get("/health")
def get_system_health():
    cuda_available = torch.cuda.is_available()
    device_name = torch.cuda.get_device_name(0) if cuda_available else "CPU (Standard Host Execution)"

    model_exists = os.path.exists(settings.MODEL_PATH)

    return {
        "status": "HEALTHY" if model_exists else "WARNING",
        "app_name": settings.APP_NAME,
        "version": "2.0.0",
        "environment": settings.ENVIRONMENT,
        "hardware": {
            "device": device_name,
            "cuda_available": cuda_available,
            "python_version": sys.version.split(" ")[0],
            "pytorch_version": torch.__version__,
        },
        "ml_model": {
            "model_path": settings.MODEL_PATH,
            "model_loaded": model_exists,
            "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
            "iou_threshold": settings.IOU_THRESHOLD,
        },
        "services": {
            "api_server": "ONLINE",
            "database": "CONNECTED",
            "websocket_manager": "ACTIVE",
            "video_worker": "READY",
        },
        "timestamp": time.time(),
    }


@router.get("/settings")
def get_settings():
    return {
        "model_path": settings.MODEL_PATH,
        "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
        "iou_threshold": settings.IOU_THRESHOLD,
        "enable_tracking": settings.ENABLE_TRACKING,
        "enable_prediction": settings.ENABLE_PREDICTION,
        "enable_emergency": settings.ENABLE_EMERGENCY,
        "max_upload_mb": settings.MAX_UPLOAD_SIZE_MB,
    }
