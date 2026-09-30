"""
FlowForce Multi-Intersection Network Optimization API Routes
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.database.models import TrafficMetric
from ml.utils.network_optimizer import NetworkSignalOptimizer, DEFAULT_NETWORK_TOPOLOGY
from backend.app.api.routes_traffic import traffic_engine

router = APIRouter(prefix="/api/network", tags=["Network Optimization"])

network_optimizer = NetworkSignalOptimizer()


@router.get("/topology")
def get_network_topology():
    """Returns the multi-junction network topology definition."""
    return network_optimizer.topology


@router.post("/optimize")
def optimize_network_traffic(network_state: Optional[Dict[str, Any]] = None, db: Session = Depends(get_db)):
    """
    POST /api/network/optimize
    Accepts network traffic state across junctions (or derives from active junction tracking/DB)
    and returns coordinated signal timings, downstream backpressure throttling, expected queue reduction,
    and network-level congestion score.
    """
    if not network_state:
        # Build network state from active camera feeds and DB telemetry
        cam_map = {"J1": "CAM-01", "J2": "CAM-02", "J3": "CAM-03", "J4": "CAM-04"}
        network_state = {}
        for jid, cid in cam_map.items():
            latest = db.query(TrafficMetric).filter(TrafficMetric.camera_id == cid).order_by(TrafficMetric.timestamp.desc()).first()
            v_cnt = latest.vehicle_count if latest else 15
            pcu = latest.pcu_score if (latest and latest.pcu_score > 0) else round(v_cnt * 1.2, 1)
            q_len = latest.queue_length if (latest and latest.queue_length > 0) else max(1, int(round(v_cnt * 0.45)))
            avg_w = int(round(latest.avg_waiting_time_sec)) if (latest and latest.avg_waiting_time_sec > 0) else int(round(q_len * 2.8))

            network_state[jid] = {
                "north": {"pcu": round(pcu * 0.45, 1), "queue_length": int(round(q_len * 0.45)), "average_wait": avg_w, "arrival_rate": round(v_cnt * 0.5, 1)},
                "south": {"pcu": round(pcu * 0.25, 1), "queue_length": int(round(q_len * 0.25)), "average_wait": int(round(avg_w * 0.7)), "arrival_rate": round(v_cnt * 0.3, 1)},
                "east":  {"pcu": round(pcu * 0.15, 1), "queue_length": int(round(q_len * 0.15)), "average_wait": int(round(avg_w * 0.5)), "arrival_rate": round(v_cnt * 0.1, 1)},
                "west":  {"pcu": round(pcu * 0.15, 1), "queue_length": int(round(q_len * 0.15)), "average_wait": int(round(avg_w * 0.5)), "arrival_rate": round(v_cnt * 0.1, 1)},
            }

    result = network_optimizer.optimize_network(network_state)
    return result


@router.get("/config")
def get_network_config():
    """Returns network-level objective weights."""
    return {
        "network_weights": network_optimizer.network_weights,
        "constraints": network_optimizer.base_optimizer.constraints,
    }


@router.post("/config")
def update_network_config(config_data: Dict[str, Any]):
    """Updates network-level objective weights."""
    if "network_weights" in config_data:
        network_optimizer.network_weights.update(config_data["network_weights"])
    return {
        "status": "success",
        "network_weights": network_optimizer.network_weights,
    }
