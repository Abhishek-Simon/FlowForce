"""
FlowForce Predictive Safety Analytics & Risk Scoring Engine

Assesses safety risk across traffic junctions using normalized factors:
- wrong-direction frequency
- traffic density
- speed variance
- sudden braking / abrupt deceleration
- queue pressure / extreme waiting
- historical incident proximity

Produces explainable Risk Score (0-100), Level (LOW, MODERATE, HIGH, CRITICAL),
and top contributing safety factors.
Identifies potential "Risk Hotspots" without making deterministic accident claims.
"""

import time
from typing import Dict, Any, List, Optional


DEFAULT_RISK_WEIGHTS: Dict[str, float] = {
    "wrong_direction_frequency": 0.25,
    "traffic_density": 0.20,
    "speed_variance": 0.20,
    "sudden_braking": 0.15,
    "queue_pressure": 0.10,
    "incident_frequency": 0.10,
}

RISK_CLASSIFICATION_BANDS = [
    (25.0, "LOW", "GREEN"),
    (50.0, "MODERATE", "YELLOW"),
    (75.0, "HIGH", "ORANGE"),
    (100.0, "CRITICAL", "RED"),
]


class SafetyRiskEngine:
    """
    Predictive Safety Analytics Engine for traffic junctions and corridors.
    """

    def __init__(self, risk_weights: Optional[Dict[str, float]] = None):
        self.risk_weights = {**DEFAULT_RISK_WEIGHTS, **(risk_weights or {})}

    def evaluate_junction_risk(
        self,
        junction_id: str,
        events_data: Optional[Dict[str, Any]] = None,
        traffic_state: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates multi-factor risk score for a single junction.
        """
        events = events_data or {}
        traffic = traffic_state or {}

        # 1. Extract raw parameters
        wrong_dir_cnt = float(events.get("wrong_direction_count", 0))
        speed_var = float(events.get("speed_variance", 12.0))
        sudden_brake_cnt = float(events.get("sudden_braking_events", 1))
        incident_cnt = float(events.get("incident_count", 0))

        density_pct = float(traffic.get("density_percentage", traffic.get("density", 45.0)))
        queue_len = float(traffic.get("total_queue", traffic.get("queue_length", 4)))
        avg_wait = float(traffic.get("average_wait", 12.0))

        # 2. Normalize each factor to 0 - 100
        norm_wrong_dir = min(100.0, wrong_dir_cnt * 30.0)
        norm_density = min(100.0, density_pct)
        norm_speed_var = min(100.0, (speed_var / 35.0) * 100.0)
        norm_braking = min(100.0, sudden_brake_cnt * 25.0)
        norm_queue = min(100.0, (queue_len / 20.0) * 60.0 + (avg_wait / 45.0) * 40.0)
        norm_incidents = min(100.0, incident_cnt * 40.0)

        factor_scores = {
            "wrong_direction_frequency": round(norm_wrong_dir, 1),
            "traffic_density": round(norm_density, 1),
            "speed_variance": round(norm_speed_var, 1),
            "sudden_braking": round(norm_braking, 1),
            "queue_pressure": round(norm_queue, 1),
            "incident_frequency": round(norm_incidents, 1),
        }

        # 3. Calculate Weighted Composite Risk Score (0 - 100)
        w = self.risk_weights
        composite_score = round(
            w["wrong_direction_frequency"] * norm_wrong_dir
            + w["traffic_density"] * norm_density
            + w["speed_variance"] * norm_speed_var
            + w["sudden_braking"] * norm_braking
            + w["queue_pressure"] * norm_queue
            + w["incident_frequency"] * norm_incidents,
            1
        )

        # 4. Classify Risk Level
        risk_level = "LOW"
        risk_color = "GREEN"
        for thresh, lvl, col in RISK_CLASSIFICATION_BANDS:
            if composite_score <= thresh:
                risk_level = lvl
                risk_color = col
                break

        # 5. Extract Top Contributing Factors (Sorted descending by contribution)
        contributions = [
            ("Wrong-direction frequency", w["wrong_direction_frequency"] * norm_wrong_dir, norm_wrong_dir),
            ("Heavy traffic density", w["traffic_density"] * norm_density, norm_density),
            ("High speed variance & differential", w["speed_variance"] * norm_speed_var, norm_speed_var),
            ("Sudden braking / abrupt stop frequency", w["sudden_braking"] * norm_braking, norm_braking),
            ("Extreme queue pressure & waiting time", w["queue_pressure"] * norm_queue, norm_queue),
            ("Historical incident frequency", w["incident_frequency"] * norm_incidents, norm_incidents),
        ]
        contributions.sort(key=lambda x: x[1], reverse=True)

        top_contributors = [
            {"factor": c[0], "weighted_impact": round(c[1], 1), "severity_score": round(c[2], 1)}
            for c in contributions if c[2] > 20.0
        ]
        if not top_contributors:
            top_contributors = [{"factor": contributions[0][0], "weighted_impact": round(contributions[0][1], 1), "severity_score": round(contributions[0][2], 1)}]

        return {
            "junction_id": junction_id,
            "timestamp": time.time(),
            "risk_score": composite_score,
            "risk_level": risk_level,
            "risk_color": risk_color,
            "factor_breakdown": factor_scores,
            "top_contributing_factors": top_contributors,
            "weights": self.risk_weights,
            "disclaimer": "Predictive safety risk index indicates elevated conflict probability under observed patterns; not a deterministic accident prediction.",
        }

    def get_risk_hotspots(self, junction_evaluations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Ranks and filters high-risk locations / hotspots based on aggregated risk scores.
        """
        ranked = sorted(junction_evaluations, key=lambda x: x["risk_score"], reverse=True)
        hotspots = []
        for rank, item in enumerate(ranked, 1):
            hotspots.append({
                "rank": rank,
                "junction_id": item["junction_id"],
                "junction_name": f"Junction {item['junction_id']} (Corridor Node)",
                "risk_score": item["risk_score"],
                "risk_level": item["risk_level"],
                "risk_color": item["risk_color"],
                "is_hotspot": item["risk_score"] >= 51.0,
                "primary_contributor": item["top_contributing_factors"][0]["factor"] if item["top_contributing_factors"] else "General congestion",
                "top_factors": [f["factor"] for f in item["top_contributing_factors"][:3]],
            })
        return hotspots
