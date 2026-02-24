"""
Post-hoc calibration: temperature scaling and Platt scaling.

Applied at inference to match backtesting. Uses same logic as scripts/calibration_utils.py.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Literal

import numpy as np

logger = logging.getLogger(__name__)
_EPS = 1e-6


def _prob_to_logit(p: np.ndarray) -> np.ndarray:
    """Convert probabilities to logits."""
    p = np.clip(np.asarray(p, dtype=np.float64), _EPS, 1.0 - _EPS)
    return np.log(p / (1.0 - p))


def _logit_to_prob(l: np.ndarray) -> np.ndarray:
    """Convert logits to probabilities."""
    l = np.asarray(l, dtype=np.float64)
    return 1.0 / (1.0 + np.exp(-np.clip(l, -500, 500)))


def apply_temperature(probs: np.ndarray, temperature: float) -> np.ndarray:
    """
    Temperature scaling: scaled_logit = logit / T, then sigmoid.
    T > 1 pulls predictions toward 0.5 (less confident).
    """
    logits = _prob_to_logit(probs)
    return _logit_to_prob(logits / temperature)


def apply_platt(probs: np.ndarray, a: float, b: float) -> np.ndarray:
    """Platt scaling: P_cal = sigmoid(a * logit + b)."""
    logits = _prob_to_logit(probs)
    return _logit_to_prob(a * logits + b)


def load_calibration_params(path: Path | None) -> dict | None:
    """Load calibration params JSON. Returns None if missing or invalid."""
    if path is None or not path.exists():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if "method" not in data:
            return None
        return data
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Could not load calibration params from %s: %s", path, e)
        return None


def apply_calibration(probs: np.ndarray, params: dict) -> np.ndarray:
    """
    Apply calibration from params dict.
    Params: method ("temperature" | "platt"), temperature, platt_a, platt_b.
    """
    method: Literal["temperature", "platt"] = params.get("method", "temperature")
    if method == "temperature":
        T = params.get("temperature", 1.0)
        return apply_temperature(probs, T)
    if method == "platt":
        a = params.get("platt_a", 1.0)
        b = params.get("platt_b", 0.0)
        return apply_platt(probs, a, b)
    return probs
