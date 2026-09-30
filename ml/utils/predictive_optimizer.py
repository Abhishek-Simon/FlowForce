"""
FlowForce Predictive Adaptive Signal Integration Layer
Seamlessly unites Current Traffic State with Short-Horizon Predictions (+5m, +10m, +15m)
to calculate proactive signal timings with transparent explanations.
"""

from typing import Dict, Any, Optional
from ml.utils.signal_optimizer import AdaptiveSignalOptimizer
from ml.utils.forecaster import CongestionForecaster


# Configurable Blending Weights for Current vs Predicted Demand
DEFAULT_PREDICTIVE_BLEND_CONFIG = {
    "current_state_weight": 0.65,    # 65% weight on real-time active detections
    "predicted_state_weight": 0.35,  # 35% proactive weight on +10 min forecasted surge
    "proactive_extension_cap_sec": 14.0, # Max proactive green extension allowed
}


class PredictiveSignalOptimizer:
    """
    Clean Integration Layer uniting:
    1. AdaptiveSignalOptimizer (Current Real-time Actuation)
    2. CongestionForecaster (Short-Horizon Extrapolation)
    """

    def __init__(
        self,
        base_optimizer: Optional[AdaptiveSignalOptimizer] = None,
        forecaster: Optional[CongestionForecaster] = None,
        blend_config: Optional[Dict[str, float]] = None,
    ):
        self.base_optimizer = base_optimizer or AdaptiveSignalOptimizer()
        self.forecaster = forecaster or CongestionForecaster()
        self.blend_config = {**DEFAULT_PREDICTIVE_BLEND_CONFIG, **(blend_config or {})}

    def optimize_predictive_signals(
        self,
        current_state: Dict[str, Any],
        forecast_data: Optional[Dict[str, Any]] = None,
        junction_id: str = "JUNCTION-01",
    ) -> Dict[str, Any]:
        """
        Integrates current traffic state and predicted forecast to calculate
        proactive signal actions with detailed explanatory transparency.
        """
        w_cur = self.blend_config["current_state_weight"]
        w_pred = self.blend_config["predicted_state_weight"]
        cap_sec = self.blend_config["proactive_extension_cap_sec"]

        # 1. Base Real-time Optimization
        base_rec = self.base_optimizer.optimize_junction_signals(current_state)
        current_phase = base_rec["recommended_phase"]
        base_green = base_rec["green_time"]

        # 2. Derive or Use Provided Forecast Data
        if not forecast_data:
            forecast_data = self.forecaster.forecast_junction(
                junction_id=junction_id,
                history_records=[],
                current_state=current_state,
            )

        p10 = forecast_data.get("plus_10min", {})
        cur_pcu = float(forecast_data.get("current", {}).get("pcu", 30.0))
        pred_10m_pcu = float(p10.get("pcu", cur_pcu))
        pred_10m_density = float(p10.get("density", 40.0))
        pred_level = p10.get("level", "MEDIUM")

        # 3. Calculate Approach-Specific Predicted Deltas
        # Construct synthetic blended approach demand for proactive anticipation
        blended_approach_state: Dict[str, Any] = {}
        approaches = ["north", "south", "east", "west"]

        growth_pct = 0.0
        if cur_pcu > 0:
            growth_pct = round(((pred_10m_pcu - cur_pcu) / cur_pcu) * 100.0, 1)

        proactive_adjustment_sec = 0.0
        proactive_reason_detail = ""

        for app in approaches:
            app_cur = current_state.get(app, {})
            app_pcu = float(app_cur.get("pcu", 0.0))
            app_q = int(app_cur.get("queue_length", app_cur.get("queue", 0)))
            app_w = float(app_cur.get("average_wait", 0.0))
            app_arr = float(app_cur.get("arrival_rate", 0.0))

            # Apply proportional growth if predicted trend is rising
            growth_factor = 1.0 + (growth_pct / 100.0) if growth_pct > 0 else 1.0
            app_pred_pcu = app_pcu * growth_factor
            app_pred_q = app_q * growth_factor

            # Blended features: w_cur * current + w_pred * predicted
            blended_pcu = (w_cur * app_pcu) + (w_pred * app_pred_pcu)
            blended_q = (w_cur * app_q) + (w_pred * app_pred_q)

            blended_approach_state[app] = {
                "pcu": round(blended_pcu, 1),
                "queue_length": int(round(blended_q)),
                "average_wait": app_w,
                "arrival_rate": app_arr,
            }

        # 4. Compute Blended Optimization
        proactive_rec = self.base_optimizer.optimize_junction_signals(blended_approach_state)
        proactive_phase = proactive_rec["recommended_phase"]
        proactive_green = proactive_rec["green_time"]

        # Calculate exact second difference from baseline
        delta_sec = proactive_green - base_green
        delta_sec = max(-cap_sec, min(cap_sec, delta_sec))
        final_green = int(max(
            self.base_optimizer.constraints["min_green_sec"],
            min(self.base_optimizer.constraints["max_green_sec"], base_green + delta_sec)
        ))

        # 5. Formulate Clear Operator / Citizen Explanations
        dominant_app = proactive_phase.split("_")[0].capitalize()
        if delta_sec > 1.0:
            action_desc = f"{proactive_phase} green extended by +{int(round(delta_sec))}s"
            explanation = (
                f"{dominant_app} green extended by {int(round(delta_sec))} seconds because current PCU is "
                f"active ({current_state.get(dominant_app.lower(), {}).get('pcu', 0)} PCU) and predicted PCU will increase "
                f"by {growth_pct}% (+10 min forecast: {pred_10m_pcu} PCU, {pred_level} density)."
            )
            expected_outcome = f"Preemptively clears oncoming platoon before {pred_level} bottleneck develops at junction."
        elif delta_sec < -1.0:
            action_desc = f"{proactive_phase} green trimmed by {abs(int(round(delta_sec)))}s"
            explanation = (
                f"{dominant_app} green trimmed by {abs(int(round(delta_sec)))}s to allocate clearance buffer "
                f"for cross-corridors before anticipated demand shift."
            )
            expected_outcome = "Balances cycle capacity to avoid starvation on secondary approaches."
        else:
            action_desc = f"Maintained standard optimal split ({final_green}s)"
            explanation = (
                f"Traffic flow stable. Current demand is balanced and +10 min forecast indicates {growth_pct}% growth, "
                f"within standard cycle equilibrium."
            )
            expected_outcome = "Sustains smooth vehicle progression without requiring cycle intervention."

        return {
            "junction_id": junction_id,
            "current_state": {
                "approaches": current_state,
                "base_recommended_phase": current_phase,
                "base_green_time": base_green,
                "current_pcu": cur_pcu,
            },
            "prediction": {
                "plus_5min": forecast_data.get("plus_5min", {}),
                "plus_10min": forecast_data.get("plus_10min", {}),
                "plus_15min": forecast_data.get("plus_15min", {}),
                "predicted_10m_pcu": pred_10m_pcu,
                "predicted_growth_pct": growth_pct,
                "predicted_level": pred_level,
                "confidence_pct": forecast_data.get("confidence_pct", 88),
            },
            "blend_weights": {
                "current_state_weight": w_cur,
                "predicted_state_weight": w_pred,
            },
            "recommended_action": {
                "phase": proactive_phase,
                "green_time": final_green,
                "delta_from_baseline_sec": int(round(delta_sec)),
                "action_summary": action_desc,
            },
            "reason": explanation,
            "expected_effect": expected_outcome,
        }
