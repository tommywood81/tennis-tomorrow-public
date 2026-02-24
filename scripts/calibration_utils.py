"""
Post-hoc calibration: temperature scaling and Platt scaling.

Works on probability outputs. Converts prob -> logit space, applies scaling,
then back to probabilities. Used by fit_calibration.py and generate_cache_from_training_features.py.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

import numpy as np

# Clip to avoid log(0) / division issues
_EPS = 1e-6


def prob_to_logit(p: np.ndarray) -> np.ndarray:
    """Convert probabilities to logits. p in (0,1), clipped to (_EPS, 1-_EPS)."""
    p = np.clip(np.asarray(p, dtype=np.float64), _EPS, 1.0 - _EPS)
    return np.log(p / (1.0 - p))


def logit_to_prob(l: np.ndarray) -> np.ndarray:
    """Convert logits to probabilities."""
    l = np.asarray(l, dtype=np.float64)
    return 1.0 / (1.0 + np.exp(-l))


def apply_temperature(probs: np.ndarray, temperature: float) -> np.ndarray:
    """
    Temperature scaling: scaled_logit = logit / T, then sigmoid.
    T > 1 pulls predictions toward 0.5 (less confident); T < 1 sharpens.
    """
    logits = prob_to_logit(probs)
    return logit_to_prob(logits / temperature)


def apply_platt(probs: np.ndarray, a: float, b: float) -> np.ndarray:
    """
    Platt scaling: P_cal = sigmoid(a * logit + b).
    Learns affine transform in logit space.
    """
    logits = prob_to_logit(probs)
    return logit_to_prob(a * logits + b)


def nll(probs: np.ndarray, actuals: np.ndarray) -> float:
    """Negative log-likelihood (binary)."""
    p = np.clip(probs, _EPS, 1.0 - _EPS)
    return -np.mean(actuals * np.log(p) + (1.0 - actuals) * np.log(1.0 - p))


def brier(probs: np.ndarray, actuals: np.ndarray) -> float:
    """Brier score."""
    return float(np.mean((probs - actuals) ** 2))


def fit_temperature(
    probs: np.ndarray, actuals: np.ndarray, max_t: float = 10.0
) -> float:
    """
    Find temperature T that minimizes NLL on (probs, actuals).
    T is bounded to (0.01, max_t). Use max_t=2.5 or 3.0 to avoid collapsing to 0.5.
    """
    from scipy.optimize import minimize_scalar

    def obj(T: float) -> float:
        if T <= 0:
            return 1e10
        p_cal = apply_temperature(probs, T)
        return nll(p_cal, actuals)

    res = minimize_scalar(obj, bounds=(0.01, max_t), method="bounded")
    return float(res.x)


def fit_platt(probs: np.ndarray, actuals: np.ndarray) -> tuple[float, float]:
    """
    Find (a, b) that minimize NLL: P_cal = sigmoid(a * logit(p) + b).
    Returns (a, b).
    """
    from scipy.optimize import minimize

    logits = prob_to_logit(probs)

    def obj(x: np.ndarray) -> float:
        a, b = x[0], x[1]
        p_cal = logit_to_prob(a * logits + b)
        return nll(p_cal, actuals)

    res = minimize(obj, x0=[1.0, 0.0], method="L-BFGS-B", bounds=[(0.01, 20.0), (-10.0, 10.0)])
    return float(res.x[0]), float(res.x[1])


def load_calibration_params(path: Path | None) -> dict | None:
    """
    Load calibration_params.json. Returns None if file missing or invalid.
    Expected keys: method ("temperature" | "platt"), temperature, platt_a, platt_b.
    """
    if path is None or not path.exists():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if "method" not in data:
            return None
        return data
    except (json.JSONDecodeError, OSError):
        return None


def apply_calibration(
    probs: np.ndarray,
    params: dict,
) -> np.ndarray:
    """
    Apply calibration from params dict.
    params must have "method" ("temperature" or "platt") and the corresponding keys.
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
