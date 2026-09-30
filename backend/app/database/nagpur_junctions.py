"""
Nagpur Traffic Junctions Registry
Centralized dataset for Nagpur Smart City CCTV & Corridor nodes.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class JunctionModel(BaseModel):
    id: str
    name: str
    area: str
    city: str = "Nagpur"
    streamType: str  # "demo" | "hls" | "mp4" | "unavailable"
    cctvUrl: str
    status: str      # "online" | "demo" | "offline"
    latitude: float
    longitude: float
    analytics_available: bool = True
    lanes: List[Dict[str, str]]


NAGPUR_JUNCTIONS: List[Dict[str, Any]] = [
    {
        "id": "sitabuldi",
        "name": "Sitabuldi Chowk",
        "area": "Sitabuldi",
        "city": "Nagpur",
        "streamType": "demo",
        "cctvUrl": "/samples/sample_traffic.mp4",
        "status": "online",
        "latitude": 21.1458,
        "longitude": 79.0882,
        "analytics_available": True,
        "lanes": [
            {"direction": "NORTH", "name": "North Approach (Towards Sadar)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "SOUTH", "name": "South Approach (Towards Rahate Colony)", "video": "/samples/sample_pedestrian.mp4"},
            {"direction": "EAST", "name": "East Approach (Towards Railway Station)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "WEST", "name": "West Approach (Towards Law College)", "video": "/samples/sample_pedestrian.mp4"},
        ],
    },
    {
        "id": "variety_square",
        "name": "Variety Square",
        "area": "Civil Lines",
        "city": "Nagpur",
        "streamType": "demo",
        "cctvUrl": "/samples/sample_traffic.mp4",
        "status": "online",
        "latitude": 21.1492,
        "longitude": 79.0815,
        "analytics_available": True,
        "lanes": [
            {"direction": "NORTH", "name": "North Approach (GPO Road)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "SOUTH", "name": "South Approach (Sitabuldi Link)", "video": "/samples/sample_pedestrian.mp4"},
            {"direction": "EAST", "name": "East Approach (Reserve Bank)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "WEST", "name": "West Approach (Amravati Road)", "video": "/samples/sample_pedestrian.mp4"},
        ],
    },
    {
        "id": "medical_square",
        "name": "Medical Square",
        "area": "Medical College",
        "city": "Nagpur",
        "streamType": "demo",
        "cctvUrl": "/samples/sample_pedestrian.mp4",
        "status": "online",
        "latitude": 21.1278,
        "longitude": 79.0984,
        "analytics_available": True,
        "lanes": [
            {"direction": "NORTH", "name": "North Approach (GMC Main Gate)", "video": "/samples/sample_pedestrian.mp4"},
            {"direction": "SOUTH", "name": "South Approach (Rambagh Road)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "EAST", "name": "East Approach (Imambada)", "video": "/samples/sample_pedestrian.mp4"},
            {"direction": "WEST", "name": "West Approach (Ajni Link)", "video": "/samples/sample_traffic.mp4"},
        ],
    },
    {
        "id": "manish_nagar",
        "name": "Manish Nagar Square",
        "area": "Manish Nagar",
        "city": "Nagpur",
        "streamType": "demo",
        "cctvUrl": "/samples/sample_traffic.mp4",
        "status": "online",
        "latitude": 21.0924,
        "longitude": 79.0768,
        "analytics_available": True,
        "lanes": [
            {"direction": "NORTH", "name": "North Approach (Somalwada Flyover)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "SOUTH", "name": "South Approach (Beltarodi Link)", "video": "/samples/sample_pedestrian.mp4"},
            {"direction": "EAST", "name": "East Approach (Besa Road)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "WEST", "name": "West Approach (Wardha Road)", "video": "/samples/sample_pedestrian.mp4"},
        ],
    },
    {
        "id": "sadar_chowk",
        "name": "Sadar Chowk",
        "area": "Sadar",
        "city": "Nagpur",
        "streamType": "demo",
        "cctvUrl": "/samples/sample_traffic.mp4",
        "status": "online",
        "latitude": 21.1610,
        "longitude": 79.0833,
        "analytics_available": True,
        "lanes": [
            {"direction": "NORTH", "name": "North Approach (Residency Road)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "SOUTH", "name": "South Approach (Liberty Cinema)", "video": "/samples/sample_pedestrian.mp4"},
            {"direction": "EAST", "name": "East Approach (Mankapur Ring Road)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "WEST", "name": "West Approach (Katol Road)", "video": "/samples/sample_pedestrian.mp4"},
        ],
    },
    {
        "id": "dharampeth",
        "name": "Dharampeth Tower Chowk",
        "area": "Dharampeth",
        "city": "Nagpur",
        "streamType": "demo",
        "cctvUrl": "/samples/sample_traffic.mp4",
        "status": "online",
        "latitude": 21.1444,
        "longitude": 79.0625,
        "analytics_available": True,
        "lanes": [
            {"direction": "NORTH", "name": "North Approach (Laxmi Bhuvan)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "SOUTH", "name": "South Approach (Shankar Nagar)", "video": "/samples/sample_pedestrian.mp4"},
            {"direction": "EAST", "name": "East Approach (Coffee House)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "WEST", "name": "West Approach (Traffic Park)", "video": "/samples/sample_pedestrian.mp4"},
        ],
    },
    {
        "id": "shankar_nagar",
        "name": "Shankar Nagar Square",
        "area": "Dharampeth",
        "city": "Nagpur",
        "streamType": "demo",
        "cctvUrl": "/samples/sample_traffic.mp4",
        "status": "online",
        "latitude": 21.1350,
        "longitude": 79.0610,
        "analytics_available": True,
        "lanes": [
            {"direction": "NORTH", "name": "North Approach (Dharampeth)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "SOUTH", "name": "South Approach (Bajaj Nagar)", "video": "/samples/sample_pedestrian.mp4"},
            {"direction": "EAST", "name": "East Approach (VNIT Gate)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "WEST", "name": "West Approach (LAD College)", "video": "/samples/sample_pedestrian.mp4"},
        ],
    },
    {
        "id": "chhatrapati_square",
        "name": "Chhatrapati Square",
        "area": "Wardha Road",
        "city": "Nagpur",
        "streamType": "demo",
        "cctvUrl": "/samples/sample_traffic.mp4",
        "status": "online",
        "latitude": 21.1120,
        "longitude": 79.0700,
        "analytics_available": True,
        "lanes": [
            {"direction": "NORTH", "name": "North Approach (Ajni Square)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "SOUTH", "name": "South Approach (Ujjwal Nagar)", "video": "/samples/sample_pedestrian.mp4"},
            {"direction": "EAST", "name": "East Approach (Khamla Road)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "WEST", "name": "West Approach (Ring Road)", "video": "/samples/sample_pedestrian.mp4"},
        ],
    },
    {
        "id": "ajni_square",
        "name": "Ajni Square",
        "area": "Ajni",
        "city": "Nagpur",
        "streamType": "demo",
        "cctvUrl": "/samples/sample_traffic.mp4",
        "status": "online",
        "latitude": 21.1215,
        "longitude": 79.0760,
        "analytics_available": True,
        "lanes": [
            {"direction": "NORTH", "name": "North Approach (Rahate Colony)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "SOUTH", "name": "South Approach (Chhatrapati Sq)", "video": "/samples/sample_pedestrian.mp4"},
            {"direction": "EAST", "name": "East Approach (Ajni Railway Station)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "WEST", "name": "West Approach (Chunabhatti)", "video": "/samples/sample_pedestrian.mp4"},
        ],
    },
    {
        "id": "rani_jhansi",
        "name": "Rani Jhansi Square",
        "area": "Sitabuldi",
        "city": "Nagpur",
        "streamType": "demo",
        "cctvUrl": "/samples/sample_traffic.mp4",
        "status": "online",
        "latitude": 21.1430,
        "longitude": 79.0780,
        "analytics_available": True,
        "lanes": [
            {"direction": "NORTH", "name": "North Approach (Variety Sq Link)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "SOUTH", "name": "South Approach (Panchsheel Cinema)", "video": "/samples/sample_pedestrian.mp4"},
            {"direction": "EAST", "name": "East Approach (Sitabuldi Main)", "video": "/samples/sample_traffic.mp4"},
            {"direction": "WEST", "name": "West Approach (Buldhana Bank Link)", "video": "/samples/sample_pedestrian.mp4"},
        ],
    },
    {
        "id": "mankapur_square",
        "name": "Mankapur Square",
        "area": "Mankapur",
        "city": "Nagpur",
        "streamType": "unavailable",
        "cctvUrl": "",
        "status": "offline",
        "latitude": 21.1850,
        "longitude": 79.0800,
        "analytics_available": False,
        "lanes": [],
    },
]
