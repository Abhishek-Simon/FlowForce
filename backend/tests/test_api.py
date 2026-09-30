import os
import sys
import pytest
from fastapi.testclient import TestClient

# Add project root to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.app.main import app, seed_database
from backend.app.database.connection import engine, Base

# Seed DB tables
Base.metadata.create_all(bind=engine)
seed_database()

client = TestClient(app)


def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"


def test_system_health():
    res = client.get("/api/system/health")
    assert res.status_code == 200
    data = res.json()
    assert "hardware" in data
    assert "ml_model" in data


def test_list_cameras():
    res = client.get("/api/cameras")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_traffic_current():
    res = client.get("/api/traffic/current")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_emergency_events():
    res = client.get("/api/emergency/events")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_signal_recommendations():
    res = client.get("/api/signals/recommendations")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_analytics_summary():
    res = client.get("/api/analytics/summary")
    assert res.status_code == 200
    data = res.json()
    assert "active_cameras" in data
    assert "system_status" in data
