"""
Traffic Prediction Module
Owner: ML Engineer

Deliberately NOT a trained model for the hackathon timeline — this uses
linear trend extrapolation over the recent traffic_score history (already
tracked by TrafficStateEngine.score_history) to predict congestion a few
minutes out. Defensible, explainable, and takes minutes to build instead
of hours.

Upgrade path (if time remains): replace `predict()`'s internals with a
small LSTM trained on your own generated score time-series — the function
signature below can stay identical, so nothing downstream (API/backend)
needs to change.
"""

import numpy as np


class TrafficPredictor:
    def __init__(self, min_history: int = 5):
        self.min_history = min_history

    def predict(self, score_history: list[float], horizon_ticks: int = 5) -> dict:
        """
        score_history: recent traffic_score values for one camera, oldest first
                        (e.g. TrafficStateEngine.score_history[camera_id]).
        horizon_ticks: how many ticks ahead to extrapolate. If your engine is
                        updated ~once/sec, horizon_ticks=300 ≈ 5 minutes out.

        Returns: {"predicted_score": float, "trend": "rising"|"falling"|"stable"}
        """
        history = list(score_history)

        if len(history) < self.min_history:
            # not enough data yet — just assume it stays where it is
            current = history[-1] if history else 0.0
            return {"predicted_score": round(current, 1), "trend": "stable"}

        x = np.arange(len(history))
        y = np.array(history)
        slope, intercept = np.polyfit(x, y, 1)

        predicted = slope * (len(history) - 1 + horizon_ticks) + intercept
        predicted = max(0.0, min(100.0, predicted))

        if slope > 0.5:
            trend = "rising"
        elif slope < -0.5:
            trend = "falling"
        else:
            trend = "stable"

        return {"predicted_score": round(float(predicted), 1), "trend": trend}


if __name__ == "__main__":
    predictor = TrafficPredictor()

    rising = [20, 25, 30, 35, 42, 48, 55]
    falling = [80, 75, 68, 60, 55, 50, 45]
    stable = [50, 51, 49, 50, 52, 49, 50]

    print("Rising trend:", predictor.predict(rising, horizon_ticks=10))
    print("Falling trend:", predictor.predict(falling, horizon_ticks=10))
    print("Stable trend:", predictor.predict(stable, horizon_ticks=10))
