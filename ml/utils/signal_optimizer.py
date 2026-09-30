"""
FlowForce Adaptive Signal Optimization Engine
Independent Recommendation & Simulation Module

Provides dynamic signal split recommendations and phase transitions
based on real-time multi-approach traffic demand (PCU, queue, wait time, arrival rate),
with fairness constraints, starvation prevention, and safety intervals.
"""

from typing import Dict, Any, Optional, List


from ml.utils.robustness_config import ROBUSTNESS_CONFIG

# Configurable Demand Scoring Weights
DEFAULT_DEMAND_WEIGHTS: Dict[str, float] = {
    "pcu": 0.40,
    "queue_length": 0.30,
    "waiting_time": 0.20,
    "arrival_rate": 0.10,
}

# Configurable Fairness & Safety Constraints bound from ROBUSTNESS_CONFIG
DEFAULT_SIGNAL_CONSTRAINTS: Dict[str, Any] = {
    "min_green_sec": ROBUSTNESS_CONFIG["signals"]["min_green_sec"],
    "max_green_sec": ROBUSTNESS_CONFIG["signals"]["max_green_sec"],
    "yellow_sec": ROBUSTNESS_CONFIG["signals"]["yellow_clearance_sec"],
    "all_red_sec": ROBUSTNESS_CONFIG["signals"]["all_red_clearance_sec"],
    "default_cycle_length_sec": 120.0,
    "starvation_wait_threshold_sec": ROBUSTNESS_CONFIG["signals"]["starvation_wait_threshold_sec"],
    "max_phase_extension_sec": ROBUSTNESS_CONFIG["signals"]["max_phase_extension_sec"],
    "min_phase_hold_time_sec": ROBUSTNESS_CONFIG["signals"]["min_phase_hold_time_sec"],
}

# Standard NEMA Dual-Ring / 4-Phase Groupings for 4-Way Junctions
PHASE_GROUPS: Dict[str, List[str]] = {
    "NORTH_SOUTH": ["north", "south"],
    "EAST_WEST": ["east", "west"],
    "NORTH_ONLY": ["north"],
    "SOUTH_ONLY": ["south"],
    "EAST_ONLY": ["east"],
    "WEST_ONLY": ["west"],
}


class AdaptiveSignalOptimizer:
    """
    Independent Adaptive Signal Optimization Engine.
    Evaluates traffic states across junction approaches and computes
    recommended phase, green split durations, next phases, and rationale.
    """

    def __init__(
        self,
        demand_weights: Optional[Dict[str, float]] = None,
        constraints: Optional[Dict[str, Any]] = None,
    ):
        self.demand_weights = {**DEFAULT_DEMAND_WEIGHTS, **(demand_weights or {})}
        self.constraints = {**DEFAULT_SIGNAL_CONSTRAINTS, **(constraints or {})}

    def calculate_approach_demand(self, approach_state: Dict[str, Any]) -> float:
        """
        Calculates normalized demand score for a single approach:
        Demand = w_pcu * PCU + w_queue * Queue + w_wait * Wait + w_arrival * Arrival
        Includes non-linear starvation penalty when waiting time exceeds safety threshold.
        """
        w = self.demand_weights
        pcu = float(approach_state.get("pcu", 0.0))
        queue = float(approach_state.get("queue_length", approach_state.get("queue", 0.0)))
        wait_time = float(approach_state.get("average_wait", approach_state.get("wait_time", 0.0)))
        arrival_rate = float(approach_state.get("arrival_rate", 0.0))

        # Base weighted demand
        raw_demand = (
            w["pcu"] * (pcu * 1.5)
            + w["queue_length"] * (queue * 3.0)
            + w["waiting_time"] * (wait_time * 1.8)
            + w["arrival_rate"] * (arrival_rate * 0.8)
        )

        # Starvation Prevention Multiplier:
        # If vehicles on this approach have been waiting longer than threshold, rapidly boost demand
        starvation_limit = self.constraints["starvation_wait_threshold_sec"]
        if wait_time > starvation_limit:
            starvation_factor = 1.0 + min(2.5, (wait_time - starvation_limit) / 20.0)
            raw_demand *= starvation_factor

        return round(max(1.0, raw_demand), 2)

    def optimize_junction_signals(
        self,
        traffic_state: Dict[str, Any],
        current_phase: str = "NORTH_SOUTH",
        elapsed_green: float = 20.0,
        emergency_approach: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Computes optimal signal recommendation for a 4-way junction given current traffic state.

        Args:
            traffic_state: Dict containing 'north', 'south', 'east', 'west' approach state dictionaries.
            current_phase: Current active phase (e.g. 'NORTH_SOUTH' or 'EAST_WEST').
            elapsed_green: Seconds current phase has been green.
            emergency_approach: Specific approach if emergency vehicle detected.
        """
        approaches = ["north", "south", "east", "west"]
        demand_scores = {}
        approach_summaries = {}

        for app in approaches:
            data = traffic_state.get(app, {})
            score = self.calculate_approach_demand(data)
            demand_scores[app] = score
            approach_summaries[app] = {
                "vehicles": data.get("vehicles", 0),
                "pcu": data.get("pcu", 0.0),
                "queue_length": data.get("queue_length", data.get("queue", 0)),
                "average_wait": data.get("average_wait", data.get("wait_time", 0)),
                "arrival_rate": data.get("arrival_rate", 0.0),
                "demand_score": score,
            }

        # 1. Emergency Preemption Override Check
        if emergency_approach and emergency_approach.lower() in approaches:
            target_app = emergency_approach.lower()
            rec_phase = f"{target_app.upper()}_ONLY" if target_app in ["north", "south"] else "EAST_WEST"
            return {
                "recommended_phase": rec_phase,
                "green_time": int(self.constraints["max_green_sec"]),
                "next_phase": "NORTH_SOUTH" if "EAST" in rec_phase else "EAST_WEST",
                "yellow_time": int(self.constraints["yellow_sec"]),
                "all_red_time": int(self.constraints["all_red_sec"]),
                "demand_scores": demand_scores,
                "approach_metrics": approach_summaries,
                "reason": f"🚨 Emergency preemption active on {target_app.upper()} corridor",
                "expected_effect": "Immediate clearance for emergency vehicle with minimal network delay",
                "emergency_override": True,
            }

        # 2. Phase Demand Aggregation
        ns_demand = demand_scores["north"] + demand_scores["south"]
        ew_demand = demand_scores["east"] + demand_scores["west"]
        total_demand = max(1.0, ns_demand + ew_demand)

        # 3. Available Green Budget Calculation
        target_cycle = float(self.constraints["default_cycle_length_sec"])
        lost_time = 2 * (self.constraints["yellow_sec"] + self.constraints["all_red_sec"]) # 2 phase transitions
        available_green = target_cycle - lost_time

        min_g = self.constraints["min_green_sec"]
        max_g = self.constraints["max_green_sec"]

        # Proportional Allocation based on Phase Demands with clamped fairness
        ns_ratio = ns_demand / total_demand
        ew_ratio = ew_demand / total_demand

        ns_green = max(min_g, min(max_g, round(available_green * ns_ratio)))
        ew_green = max(min_g, min(max_g, round(available_green * ew_ratio)))

        # 4. Phase Selection & Starvation Safeguard
        # Determine highest critical demand direction
        max_app = max(demand_scores, key=demand_scores.get)
        max_wait_app = max(approaches, key=lambda a: approach_summaries[a]["average_wait"])
        is_starving = approach_summaries[max_wait_app]["average_wait"] >= self.constraints["starvation_wait_threshold_sec"]

        if is_starving and max_wait_app in ["east", "west"] and current_phase == "NORTH_SOUTH":
            recommended_phase = "EAST_WEST"
            assigned_green = int(ew_green)
            next_phase = "NORTH_SOUTH"
            reason = f"Starvation safeguard triggered for {max_wait_app.upper()} (Wait: {approach_summaries[max_wait_app]['average_wait']}s)"
            expected_effect = f"Clear accumulated {max_wait_app.upper()} queue and restore fairness"
        elif ns_demand >= ew_demand:
            recommended_phase = "NORTH_SOUTH"
            assigned_green = int(ns_green)
            next_phase = "EAST_WEST"
            highest = "North" if demand_scores["north"] >= demand_scores["south"] else "South"
            reason = f"High PCU ({approach_summaries['north']['pcu']} N, {approach_summaries['south']['pcu']} S) and demand on {highest} approach"
            expected_effect = f"Reduce north-south bottleneck with {assigned_green}s optimal green window"
        else:
            recommended_phase = "EAST_WEST"
            assigned_green = int(ew_green)
            next_phase = "NORTH_SOUTH"
            highest = "East" if demand_scores["east"] >= demand_scores["west"] else "West"
            reason = f"High cross-traffic demand on {highest} corridor (Demand: {ew_demand:.1f} vs NS {ns_demand:.1f})"
            expected_effect = f"Discharge east-west queue in {assigned_green}s before next corridor wave"

        return {
            "recommended_phase": recommended_phase,
            "green_time": assigned_green,
            "next_phase": next_phase,
            "cycle_length": int(ns_green + ew_green + lost_time),
            "phase_splits": {
                "north_south_green": int(ns_green),
                "east_west_green": int(ew_green),
                "north_green": int(max(min_g, min(max_g, round(ns_green * (demand_scores['north'] / max(1.0, ns_demand)))))),
                "south_green": int(max(min_g, min(max_g, round(ns_green * (demand_scores['south'] / max(1.0, ns_demand)))))),
                "east_green": int(max(min_g, min(max_g, round(ew_green * (demand_scores['east'] / max(1.0, ew_demand)))))),
                "west_green": int(max(min_g, min(max_g, round(ew_green * (demand_scores['west'] / max(1.0, ew_demand)))))),
            },
            "yellow_time": int(self.constraints["yellow_sec"]),
            "all_red_time": int(self.constraints["all_red_sec"]),
            "demand_scores": demand_scores,
            "approach_metrics": approach_summaries,
            "reason": reason,
            "expected_effect": expected_effect,
            "emergency_override": False,
        }
