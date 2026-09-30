import time
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.core.config import settings
from backend.app.database.connection import engine, Base, SessionLocal
from backend.app.database.models import Camera, User, SignalRecommendation
from backend.app.services.websocket_manager import ws_manager

from backend.app.api.routes_auth import router as auth_router
from backend.app.api.routes_cameras import router as cameras_router
from backend.app.api.routes_videos import router as videos_router
from backend.app.api.routes_traffic import router as traffic_router
from backend.app.api.routes_emergency import router as emergency_router
from backend.app.api.routes_predictions import router as predictions_router
from backend.app.api.routes_signals import router as signals_router
from backend.app.api.routes_alerts import router as alerts_router
from backend.app.api.routes_analytics import router as analytics_router
from backend.app.api.routes_system import router as system_router


def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Camera).count() == 0:
            cams = [
                Camera(
                    id="CAM-01",
                    name="Sitabuldi Chowk (North Approach)",
                    location="Sitabuldi Main Junction",
                    source_type="VIDEO_FILE",
                    source_url="samples/sample_traffic.mp4",
                    status="ONLINE",
                    lat=21.1458,
                    lng=79.0882,
                    created_at=time.time(),
                ),
                Camera(
                    id="CAM-02",
                    name="Variety Square Hub (South Approach)",
                    location="Variety Chowk Arterial",
                    source_type="VIDEO_FILE",
                    source_url="samples/sample_pedestrian.mp4",
                    status="ONLINE",
                    lat=21.1442,
                    lng=79.0835,
                    created_at=time.time(),
                ),
                Camera(
                    id="CAM-03",
                    name="Medical Square (East Corridor)",
                    location="Medical Square Approach",
                    source_type="VIDEO_FILE",
                    source_url="samples/sample_traffic.mp4",
                    status="ONLINE",
                    lat=21.1294,
                    lng=79.0989,
                    created_at=time.time(),
                ),
                Camera(
                    id="CAM-04",
                    name="Law College Square (West Corridor)",
                    location="Law College Approach",
                    source_type="VIDEO_FILE",
                    source_url="samples/sample_pedestrian.mp4",
                    status="ONLINE",
                    lat=21.1528,
                    lng=79.0645,
                    created_at=time.time(),
                ),
            ]
            db.add_all(cams)
            db.commit()

        if db.query(User).count() == 0:
            admin_user = User(
                id="USR-01",
                username="admin",
                password_hash="admin123",
                role="ADMIN",
                full_name="System Administrator",
            )
            db.add(admin_user)
            db.commit()
    except Exception as e:
        print(f"[Database Seed Error]: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_database()
    print("=" * 60)
    print(f"🚀 {settings.APP_NAME} Started Successfully!")
    print(f"📡 API Documentation available at: /api/docs")
    print("=" * 60)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Full-stack Computer Vision Traffic Control & Emergency Priority System API",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount outputs and samples directory for static video downloads
outputs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "outputs")
samples_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "ml", "samples")
os.makedirs(outputs_dir, exist_ok=True)
os.makedirs(samples_dir, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=outputs_dir), name="outputs")
app.mount("/samples", StaticFiles(directory=samples_dir), name="samples")

from backend.app.api.routes_corridor import router as corridor_router
from backend.app.api.routes_network import router as network_router
from backend.app.api.routes_safety import router as safety_router
from backend.app.api.routes_junctions import router as junctions_router

# Include Routers
app.include_router(auth_router)
app.include_router(cameras_router)
app.include_router(videos_router)
app.include_router(traffic_router)
app.include_router(emergency_router)
app.include_router(predictions_router)
app.include_router(signals_router)
app.include_router(network_router)
app.include_router(safety_router)
app.include_router(junctions_router)
app.include_router(alerts_router)
app.include_router(analytics_router)
app.include_router(system_router)
app.include_router(corridor_router)


@app.get("/api/health")
def api_health():
    return {"status": "ok", "timestamp": time.time()}


@app.websocket("/api/ws/traffic")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo or process incoming commands if needed
            await websocket.send_json({"type": "pong", "timestamp": time.time()})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        ws_manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
