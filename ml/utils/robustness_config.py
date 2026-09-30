"""
FlowForce Indian Traffic Conditions Robustness Configuration
Centralized configuration repository eliminating magic numbers.

Calibrated specifically for heterogeneous traffic, weak lane discipline,
high density of 2-wheelers & 3-wheelers, stop-and-go filtering, and occlusion resilience.
"""

from typing import Dict, Any

ROBUSTNESS_CONFIG: Dict[str, Any] = {
    # 1. Detection & Tracking Confidence Thresholds
    "detection": {
        "base_confidence_threshold": 0.28,       # Low enough to capture small 2-wheelers/auto-rickshaws in dense clusters
        "motorcycle_conf_threshold": 0.25,       # Specialized threshold for motorcycles weaving between buses
        "auto_rickshaw_conf_threshold": 0.25,    # Specialized threshold for three-wheelers
        "large_vehicle_conf_threshold": 0.35,    # Higher confidence for buses/trucks to avoid false positives
        "iou_deduplication_threshold": 0.58,     # NMS threshold to handle overlapping vehicles in congested lanes
        "min_box_area_px": 350,                  # Filter out camera noise specks
    },

    # 2. Tracking Persistence & Occlusion Handling (ByteTrack tuning)
    "tracking": {
        "track_buffer_frames": 45,               # Retain track state across ~1.5 seconds of camera frame drops/occlusion
        "min_hits_to_confirm": 4,                # Require detection in at least 4 consecutive frames before registering a new vehicle
        "max_stale_seconds": 3.5,                # Evict tracks that have disappeared for > 3.5s
        "history_smoothing_window": 8,           # Moving average window for centroid (x, y) smoothing to remove pixel jitter
        "max_speed_jump_outlier_px_s": 350.0,    # Reject unphysical centroid teleportation (e.g. occlusion ID switches)
    },

    # 3. Queue & Stationary Waiting Time Verification (Stop-and-Go Filter)
    "queue": {
        "stationary_speed_threshold_px_s": 6.0,  # Below this speed, vehicle considered stationary
        "min_waiting_duration_sec": 3.0,         # Require 3.0s continuous stopped state before counting as "waiting in queue"
        "queue_hysteresis_sec": 1.5,             # Tolerance window to avoid breaking waiting timers when creeping forward
        "speed_moving_threshold_px_s": 14.0,     # Speed required to confirm vehicle has fully discharged from queue
        "approach_queue_depth_meters": 45.0,     # Spatial depth of approach queue estimation zone
    },

    # 4. Indian Road Congress (IRC:106-1990) PCU Conversion Map
    "pcu": {
        "car": 1.0,
        "motorcycle": 0.5,
        "motorbike": 0.5,
        "scooter": 0.5,
        "bus": 3.5,
        "truck": 3.5,
        "auto_rickshaw": 1.0,
        "three wheeler": 1.0,
        "three wheelers (cng)": 1.0,
        "bicycle": 0.5,
        "ambulance": 3.5,
        "emergency": 3.5,
        "tractor": 4.0,
        "tempo": 1.5,
        "van": 1.4,
        "person": 0.2,
    },

    # 5. Density Band Classification (PCU index per junction approach)
    "density_thresholds": {
        "LOW": 12.0,                             # 0 - 12 PCU
        "MEDIUM": 28.0,                          # 12 - 28 PCU
        "HIGH": 50.0,                            # 28 - 50 PCU
        "SEVERE": 50.0,                          # > 50 PCU
    },

    # 6. Safety & Conflict Temporal Confirmation (Anti-False-Alarm Filters)
    "safety_events": {
        "wrong_direction_min_frames": 8,         # Require 8 consecutive frames of reverse vector trajectory
        "wrong_direction_min_distance_px": 45.0, # Minimum vector distance to confirm wrong-way movement
        "triple_riding_persistence_frames": 6,   # Require 6 consecutive frames of person-motorcycle bounding box overlap
        "triple_riding_min_persons": 3,          # Person count within motorcycle envelope
        "sudden_braking_decel_threshold_px_s2": 45.0, # Deceleration spike to qualify as abrupt braking
        "sudden_braking_confirm_frames": 3,      # Must sustain decel across 3 frames
    },

    # 7. Adaptive Signal Optimization & Anti-Oscillation Safeguards
    "signals": {
        "min_green_sec": 12.0,                   # Pedestrian and intersection clearance safety floor
        "max_green_sec": 65.0,                   # Maximum green time cap
        "yellow_clearance_sec": 3.0,             # Amber transition
        "all_red_clearance_sec": 2.0,            # Safety all-red clearance interval
        "min_phase_hold_time_sec": 15.0,         # Hysteresis: prevent rapid signal switching / oscillation
        "max_phase_extension_sec": 15.0,         # Maximum single actuation extension
        "starvation_wait_threshold_sec": 45.0,   # Waiting seconds before starvation boost activates
        "proactive_blend_current_weight": 0.65,  # 65% real-time actuation weight
        "proactive_blend_forecast_weight": 0.35, # 35% proactive +10m forecast weight
    },

    # 8. Multi-Intersection Network Arterial Coordination
    "network": {
        "downstream_penalty_scale": 14.0,        # Scaling factor for downstream link backpressure
        "max_backpressure_throttle_sec": 25.0,   # Maximum green reduction to prevent spillback gridlock
        "default_arterial_link_capacity_pcu": 80.0,
    },
}
