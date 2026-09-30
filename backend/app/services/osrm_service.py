"""
OSRM (Open Source Routing Machine) Service
Zero-cost, open-source routing helper for travel time ETA calculations between traffic junctions.
"""

import requests
from typing import Tuple, Dict, Any

OSRM_BASE_URL = "http://router.project-osrm.org/route/v1/driving/"


def get_travel_time_osrm(start_coords: Tuple[float, float], end_coords: Tuple[float, float]) -> Dict[str, Any]:
    """
    Calculates driving travel duration and distance between two junctions using OSRM.
    start_coords: (lat, lng)
    end_coords: (lat, lng)
    Returns duration in seconds and distance in meters.
    """
    lat1, lng1 = start_coords
    lat2, lng2 = end_coords

    # OSRM format: {lng1},{lat1};{lng2},{lat2}
    loc_str = f"{lng1},{lat1};{lng2},{lat2}"
    url = f"{OSRM_BASE_URL}{loc_str}?overview=false"

    try:
        res = requests.get(url, timeout=4)
        if res.ok:
            data = res.json()
            if data.get("routes") and len(data["routes"]) > 0:
                route = data["routes"][0]
                duration_sec = route.get("duration", 60.0)
                distance_m = route.get("distance", 1000.0)
                return {
                    "status": "success",
                    "duration_sec": round(duration_sec, 1),
                    "distance_m": round(distance_m, 1),
                    "source": "OSRM_ONLINE",
                }
    except Exception as e:
        print(f"[OSRM] Warning: OSRM request failed ({e}), using fallback estimate.")

    # Fallback distance heuristic (~35 km/h avg speed)
    dist_approx = (((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2) ** 0.5) * 111000.0
    duration_approx = max(30.0, dist_approx / 9.72)  # ~35 km/h
    return {
        "status": "fallback",
        "duration_sec": round(duration_approx, 1),
        "distance_m": round(dist_approx, 1),
        "source": "HEURISTIC_FALLBACK",
    }
