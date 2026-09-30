"""
FlowForce Junctions & CCTV Feeds API Router
Provides endpoints to list supported junctions, search chowrahas, and fetch CCTV configs.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from backend.app.database.nagpur_junctions import NAGPUR_JUNCTIONS

router = APIRouter(prefix="/api/junctions", tags=["Junctions & CCTV"])


@router.get("")
def list_junctions(q: Optional[str] = Query(None, description="Search term for junction/chowraha name or area")):
    """
    GET /api/junctions
    Returns list of configured junctions with case-insensitive search and partial matching.
    """
    if not q:
        return NAGPUR_JUNCTIONS

    query_str = q.strip().lower()
    matches = [
        j for j in NAGPUR_JUNCTIONS
        if query_str in j["name"].lower()
        or query_str in j["area"].lower()
        or query_str in j["id"].lower()
    ]
    return matches


@router.get("/{junction_id}")
def get_junction_by_id(junction_id: str):
    """
    GET /api/junctions/{junction_id}
    Returns detailed configuration and lane CCTV references for a specific junction.
    """
    for j in NAGPUR_JUNCTIONS:
        if j["id"].lower() == junction_id.lower():
            return j
    raise HTTPException(status_code=404, detail=f"Junction '{junction_id}' not found in registry")
