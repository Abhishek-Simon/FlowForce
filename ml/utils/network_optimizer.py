"""
FlowForce Multi-Intersection Network Optimizer Module
Models connected junction networks with upstream/downstream relationships,
link capacity, and downstream congestion backpressure penalties.
"""

from typing import Dict, Any, List, Optional
from ml.utils.signal_optimizer import AdaptiveSignalOptimizer, DEFAULT_DEMAND_WEIGHTS, DEFAULT_SIGNAL_CONSTRAINTS


# Default Network Topology Modeling Connected Arterials & Cross Corridors
# Node Graph: J1 (MG Road Entry) ➔ J2 (Central Square) ➔ J3 (Brigade Hub)
#                                               ↓
#                                         J4 (Residency Road)
DEFAULT_NETWORK_TOPOLOGY: Dict[str, Dict[str, Any]] = {
    "junctions": {
        "J1": {
            "name": "J1: North Entry Junction",
            "camera_id": "CAM-01",
            "coordinates": {"x": 100, "y": 120},
            "downstream_links": [{"target_junction": "J2", "approach": "north", "link_capacity_pcu": 85.0, "travel_time_sec": 20}],
            "upstream_links": [],
        },
        "J2": {
            "name": "J2: Central Square Junction",
            "camera_id": "CAM-02",
            "coordinates": {"x": 320, "y": 120},
            "downstream_links": [
                {"target_junction": "J3", "approach": "west", "link_capacity_pcu": 75.0, "travel_time_sec": 18},
                {"target_junction": "J4", "approach": "north", "link_capacity_pcu": 60.0, "travel_time_sec": 25},
            ],
            "upstream_links": [{"source_junction": "J1", "approach": "north"}],
        },
        "J3": {
            "name": "J3: Brigade Hub Junction",
            "camera_id": "CAM-03",
            "coordinates": {"x": 540, "y": 120},
            "downstream_links": [],
            "upstream_links": [{"source_junction": "J2", "approach": "west"}],
        },
        "J4": {
            "name": "J4: Residency Cross Junction",
            "camera_id": "CAM-04",
            "coordinates": {"x": 320, "y": 280},
            "downstream_links": [],
            "upstream_links": [{"source_junction": "J2", "approach": "north"}],
        },
    },
    "network_weights": {
        "waiting_time": 0.30,
        "queue_length": 0.25,
        "downstream_congestion": 0.30,
        "starvation_unfairness": 0.15,
    },
}


class NetworkSignalOptimizer:
    """
    Multi-Intersection Network-Aware Signal Optimizer.
    Evaluates localized junction demands while penalizing green extension into
    congested downstream link bottlenecks to prevent intersection gridlock.
    """

    def __init__(
        self,
        topology: Optional[Dict[str, Any]] = None,
        base_optimizer: Optional[AdaptiveSignalOptimizer] = None,
    ):
        self.topology = topology or DEFAULT_NETWORK_TOPOLOGY
        self.base_optimizer = base_optimizer or AdaptiveSignalOptimizer()
        self.network_weights = self.topology.get("network_weights", DEFAULT_NETWORK_TOPOLOGY["network_weights"])

    def compute_junction_metrics(self, junc_id: str, state: Dict[str, Any]) -> Dict[str, Any]:
        """Calculates total PCU, queue, avg wait, and density for a single junction."""
        approaches = ["north", "south", "east", "west"]
        total_pcu = sum(float(state.get(a, {}).get("pcu", 0.0)) for a in approaches)
        total_queue = sum(int(state.get(a, {}).get("queue_length", state.get(a, {}).get("queue", 0))) for a in approaches)
        
        waits = [float(state.get(a, {}).get("average_wait", state.get(a, {}).get("wait_time", 0.0))) for a in approaches]
        avg_wait = round(sum(waits) / len(waits), 1) if waits else 0.0

        # Density index (0 to 100%)
        density_pct = min(100.0, round((total_pcu / 90.0) * 100.0, 1))

        # Congestion classification
        if density_pct < 35.0 and total_queue < 5:
            status = "LOW"
            status_color = "GREEN"
        elif density_pct < 65.0 and total_queue < 14:
            status = "MODERATE"
            status_color = "YELLOW"
        else:
            status = "SEVERE"
            status_color = "RED"

        return {
            "junction_id": junc_id,
            "total_pcu": round(total_pcu, 1),
            "total_queue": total_queue,
            "average_wait": avg_wait,
            "density_percentage": density_pct,
            "status": status,
            "status_color": status_color,
        }

    def optimize_network(self, network_state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimizes traffic signals across all network junctions with downstream congestion penalty.

        Args:
            network_state: Dict keyed by junction ID (e.g. 'J1', 'J2', 'J3', 'J4') containing approach data.
        """
        junctions_def = self.topology.get("junctions", {})
        junction_metrics: Dict[str, Dict[str, Any]] = {}
        
        # 1. Calculate base telemetry and congestion state for all nodes
        for jid in junctions_def.keys():
            j_state = network_state.get(jid, {})
            junction_metrics[jid] = self.compute_junction_metrics(jid, j_state)

        recommendations: Dict[str, Any] = {}
        affected_downstreams: List[Dict[str, Any]] = []
        total_network_wait = 0.0
        total_network_queue = 0
        total_downstream_penalty = 0.0

        # 2. Optimize each junction considering downstream link pressure
        for jid, jdef in junctions_def.items():
            j_state = network_state.get(jid, {})
            downstream_links = jdef.get("downstream_links", [])

            # Single-junction base recommendation
            base_rec = self.base_optimizer.optimize_junction_signals(j_state)
            rec_phase = base_rec["recommended_phase"]
            recommended_green = base_rec["green_time"]
            reason = base_rec["reason"]
            expected_effect = base_rec["expected_effect"]
            backpressure_applied = False

            # Check downstream congestion penalties
            for link in downstream_links:
                target_junc = link["target_junction"]
                target_approach = link["approach"]
                link_cap = float(link.get("link_capacity_pcu", 80.0))
                target_metric = junction_metrics.get(target_junc, {})
                target_pcu = target_metric.get("total_pcu", 0.0)
                target_status = target_metric.get("status", "LOW")

                # If upstream phase feeds directly into downstream link
                feeds_downstream = (
                    (rec_phase == "NORTH_SOUTH" and target_approach in ["north", "south"])
                    or (rec_phase == "EAST_WEST" and target_approach in ["east", "west"])
                    or target_approach in rec_phase.lower()
                )

                if feeds_downstream and target_status in ["MODERATE", "SEVERE"]:
                    # Compute backpressure penalty
                    congestion_ratio = min(1.5, target_pcu / max(10.0, link_cap))
                    penalty_sec = round(min(25.0, (congestion_ratio * 14.0)))

                    if penalty_sec > 4.0:
                        original_green = recommended_green
                        # Throttle upstream green to prevent downstream spillback
                        recommended_green = max(
                            int(self.base_optimizer.constraints["min_green_sec"]),
                            int(recommended_green - penalty_sec)
                        )
                        backpressure_applied = True
                        total_downstream_penalty += penalty_sec

                        reason = (
                            f"Downstream bottleneck at {target_junc} ({target_status}, {target_pcu} PCU). "
                            f"Throttled {jid} green from {original_green}s to {recommended_green}s to prevent gridlock."
                        )
                        expected_effect = f"Avoids link overflow into {target_junc}; meters inflow while maintaining network equilibrium."

                        affected_downstreams.append({
                            "source_junction": jid,
                            "target_junction": target_junc,
                            "target_approach": target_approach,
                            "target_status": target_status,
                            "throttled_seconds": penalty_sec,
                        })

            recommendations[jid] = {
                "junction_id": jid,
                "junction_name": jdef.get("name", jid),
                "camera_id": jdef.get("camera_id", "CAM-01"),
                "status": junction_metrics[jid]["status"],
                "status_color": junction_metrics[jid]["status_color"],
                "total_pcu": junction_metrics[jid]["total_pcu"],
                "total_queue": junction_metrics[jid]["total_queue"],
                "average_wait": junction_metrics[jid]["average_wait"],
                "density_percentage": junction_metrics[jid]["density_percentage"],
                "recommended_phase": rec_phase,
                "green_time": recommended_green,
                "next_phase": base_rec["next_phase"],
                "cycle_length": base_rec["cycle_length"],
                "phase_splits": base_rec["phase_splits"],
                "backpressure_applied": backpressure_applied,
                "reason": reason,
                "expected_effect": expected_effect,
            }

            total_network_wait += junction_metrics[jid]["average_wait"]
            total_network_queue += junction_metrics[jid]["total_queue"]

        # 3. Network-Level Congestion Objective Score
        num_junctions = max(1, len(junctions_def))
        avg_net_wait = total_network_wait / num_junctions
        w = self.network_weights

        net_congestion_score = round(
            w["waiting_time"] * min(100.0, avg_net_wait * 2.5)
            + w["queue_length"] * min(100.0, total_network_queue * 2.0)
            + w["downstream_congestion"] * min(100.0, total_downstream_penalty * 3.5)
            + w["starvation_unfairness"] * 10.0,
            1
        )

        # Expected network queue reduction from coordinated optimization
        expected_queue_reduction_pct = max(12, min(42, int(round(35.0 - (net_congestion_score * 0.2)))))

        return {
            "network_id": "METRO-CORRIDOR-01",
            "network_congestion_score": net_congestion_score,
            "overall_status": "OPTIMAL" if net_congestion_score < 40 else ("MODERATE" if net_congestion_score < 70 else "CRITICAL"),
            "expected_queue_reduction_pct": expected_queue_reduction_pct,
            "total_network_queue": total_network_queue,
            "average_network_wait_sec": round(avg_net_wait, 1),
            "affected_downstream_junctions": affected_downstreams,
            "junction_recommendations": recommendations,
            "topology": junctions_def,
        }
