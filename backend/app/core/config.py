import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    APP_NAME: str = "Smart Traffic Intelligence Command Center"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/traffic.db"

    MODEL_PATH: str = os.getenv("MODEL_PATH", str(BASE_DIR / "ml" / "models" / "yolov8n.pt"))
    CONFIDENCE_THRESHOLD: float = 0.35
    IOU_THRESHOLD: float = 0.45

    ENABLE_TRACKING: bool = True
    ENABLE_PREDICTION: bool = True
    ENABLE_EMERGENCY: bool = True

    UPLOAD_DIR: str = str(BASE_DIR / "data" / "uploads")
    OUTPUT_DIR: str = str(BASE_DIR / "data" / "outputs")
    LOG_DIR: str = str(BASE_DIR / "data" / "logs")

    MAX_UPLOAD_SIZE_MB: int = 500
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]

    SECRET_KEY: str = "smart-traffic-secret-key-change-in-production-2026"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
os.makedirs(settings.LOG_DIR, exist_ok=True)
