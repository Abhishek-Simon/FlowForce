"""
Traffic Prediction Module
Owner: ML / Analytics Engineer

Predicts short-term (5-min and 15-min) future traffic congestion scores,
trends, and expected vehicle volume using linear extrapolation and statistical history.
Provides graceful fallback when historical data is limited.
"""

from typing import List, Dict, Any
import numpy as np


class TrafficPredictor:
    def __init__(self, min_history: int = 5):
        self.min_history = min_history

    def predict(self, score_history: List[float], horizon_5m_ticks: int = 10, horizon_15m_ticks: int = 30) -> Dict[str, Any]:
        """
        score_history: recent traffic_score values for a camera.
        Returns prediction dict with 5m and 15m forecasted scores and trend.
        """
        history = list(score_history)

        if len(history) < self.min_history:
            current = history[-1] if history else 0.0
            return {
                "predicted_score_5m": round(current, 1),
                "predicted_score_15m": round(current, 1),
                "trend": "stable",
                "confidence": 60,
                "congestion_level_15m": self._classify_congestion(current),
                "is_fallback": True,
            }

        x = np.arange(len(history))
        y = np.array(history)

        try:
            slope, intercept = np.polyfit(x, y, 1)

            pred_5m = slope * (len(history) - 1 + horizon_5m_ticks) + intercept
            pred_15m = slope * (len(history) - 1 + horizon_15m_ticks) + intercept

            pred_5m = float(np.clip(pred_5m, 0.0, 100.0))
            pred_15m = float(np.clip(pred_15m, 0.0, 100.0))

            if slope > 0.4:
                trend = "rising"
            elif slope < -0.4:
                trend = "falling"
            else:
                trend = "stable"

            confidence = min(85 + len(history) * 2, 95)

            return {
                "predicted_score_5m": round(pred_5m, 1),
                "predicted_score_15m": round(pred_15m, 1),
                "trend": trend,
                "confidence": confidence,
                "congestion_level_15m": self._classify_congestion(pred_15m),
                "is_fallback": False,
            }
        except Exception:
            current = history[-1]
            return {
                "predicted_score_5m": round(current, 1),
                "predicted_score_15m": round(current, 1),
                "trend": "stable",
                "confidence": 50,
                "congestion_level_15m": self._classify_congestion(current),
                "is_fallback": True,
            }

    def _classify_congestion(self, score: float) -> str:
        if score <= 25.0:
            return "LOW"
        elif score <= 50.0:
            return "MODERATE"
        elif score <= 75.0:
            return "HIGH"
        return "SEVERE"
