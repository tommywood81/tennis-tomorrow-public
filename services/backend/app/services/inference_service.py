"""
Canonical inference pipeline with explicit feature_mode.

This is the single source of truth for inference. Only one pipeline,
one variable (feature_mode), no flags, no fallbacks, no auto-detection.
"""

from __future__ import annotations

from typing import Literal, Dict, Any, Tuple, Optional
from datetime import date
import logging
import torch
import numpy as np

from ..schemas import MatchPredictionRequest, AdvancedPredictionRequest
from .model_service import ModelService
from .dynamic_feature_service import DynamicFeatureService
from ..utils.tennis_abstract_parser import parse_tennis_abstract_matches
from ..utils.calibration import load_calibration_params, apply_calibration

logger = logging.getLogger(__name__)


def run_inference(
    input_payload: MatchPredictionRequest | AdvancedPredictionRequest,
    feature_mode: Literal["frozen", "fresh"],
    model_service: ModelService,
    feature_service: DynamicFeatureService,
) -> Dict[str, Any]:
    """
    Canonical inference function with explicit feature_mode.
    
    Args:
        input_payload: Prediction request (standard or advanced)
        feature_mode: "frozen" (Nov-14 snapshot) or "fresh" (user-entered matches)
        model_service: Model service instance
        feature_service: Feature service instance
        
    Returns:
        Dictionary with prediction, feature_mode, and override_used
    """
    if feature_mode not in ["frozen", "fresh"]:
        raise ValueError(f"Invalid feature_mode: {feature_mode}. Must be 'frozen' or 'fresh'")
    
    # Log warning for fresh mode
    if feature_mode == "fresh":
        logger.warning(
            "Advanced mode enabled: using fresh match features not seen during training."
        )
    
    # Load features based on mode
    if feature_mode == "frozen":
        features = _load_frozen_features(input_payload, feature_service)
    elif feature_mode == "fresh":
        features = _load_fresh_features(input_payload, feature_service)
    else:
        raise ValueError(f"Invalid feature_mode: {feature_mode}")
    
    # Preprocess features (already done in feature service)
    # Features are already preprocessed and scaled
    
    # Run model prediction
    prediction_result = _predict_with_features(
        features, model_service, input_payload, feature_mode
    )
    
    return {
        "prediction": prediction_result,
        "feature_mode": feature_mode,
        "override_used": feature_mode == "fresh",
        "features": features  # Include features for response building
    }


def _load_frozen_features(
    payload: MatchPredictionRequest | AdvancedPredictionRequest,
    feature_service: DynamicFeatureService,
) -> Dict[str, np.ndarray]:
    """
    Load frozen features from Nov-14 snapshot.
    
    Uses standard compute_features which loads from frozen dataset.
    """
    # Extract common fields (works for both MatchPredictionRequest and AdvancedPredictionRequest)
    surface = getattr(payload, 'surface', None) or "Hard"
    tourney_level = getattr(payload, 'tournament_level', None) or "M"
    round_name = getattr(payload, 'round', None) or "F"
    match_date = getattr(payload, 'match_date', None)
    
    player_one = payload.player_one
    player_two = payload.player_two
    
    # Player One's perspective
    sequence_p1, static_p1, mask_p1 = feature_service.compute_features(
        player_one,
        player_two,
        surface=surface,
        tourney_level=tourney_level,
        round_name=round_name,
        match_date=match_date
    )
    
    # Player Two's perspective
    sequence_p2, static_p2, mask_p2 = feature_service.compute_features(
        player_two,
        player_one,
        surface=surface,
        tourney_level=tourney_level,
        round_name=round_name,
        match_date=match_date
    )
    
    return {
        "sequence_p1": sequence_p1,
        "static_p1": static_p1,
        "mask_p1": mask_p1,
        "sequence_p2": sequence_p2,
        "static_p2": static_p2,
        "mask_p2": mask_p2,
    }


def _load_fresh_features(
    payload: AdvancedPredictionRequest,
    feature_service: DynamicFeatureService,
) -> Dict[str, np.ndarray]:
    """
    Load fresh features from user-entered match history.
    
    Parses Tennis Abstract match history and overrides sequence features.
    """
    # Parse match histories - use display name for W/L determination when available
    player_one_name = payload.player_one_name or payload.player_one
    player_two_name = payload.player_two_name or payload.player_two
    player_one_matches = parse_tennis_abstract_matches(
        payload.player_one_match_history,
        max_matches=10,
        player_name=player_one_name
    )
    player_two_matches = parse_tennis_abstract_matches(
        payload.player_two_match_history,
        max_matches=10,
        player_name=player_two_name
    )
    
    surface = payload.surface or "Hard"
    tourney_level = payload.tournament_level or "M"
    round_name = payload.round or "F"
    
    # Player One's perspective with custom matches
    sequence_p1, static_p1, mask_p1 = feature_service.compute_features_with_custom_matches(
        payload.player_one,
        payload.player_two,
        player_one_matches,
        surface=surface,
        tourney_level=tourney_level,
        round_name=round_name,
        match_date=payload.match_date
    )
    
    # Player Two's perspective with custom matches
    sequence_p2, static_p2, mask_p2 = feature_service.compute_features_with_custom_matches(
        payload.player_two,
        payload.player_one,
        player_two_matches,
        surface=surface,
        tourney_level=tourney_level,
        round_name=round_name,
        match_date=payload.match_date
    )
    
    return {
        "sequence_p1": sequence_p1,
        "static_p1": static_p1,
        "mask_p1": mask_p1,
        "sequence_p2": sequence_p2,
        "static_p2": static_p2,
        "mask_p2": mask_p2,
    }


def _predict_with_features(
    features: Dict[str, np.ndarray],
    model_service: ModelService,
    payload: MatchPredictionRequest | AdvancedPredictionRequest,
    feature_mode: str = "frozen",
) -> Dict[str, Any]:
    """
    Run model prediction with preprocessed features.
    
    Uses dual-perspective sigmoid averaging (same as training).
    
    Args:
        feature_mode: "frozen" (As At 12/11/2025) or "fresh" (user-entered matches)
    """
    model = model_service._ensure_model()
    
    # Convert to tensors
    seq_p1_tensor = torch.from_numpy(features["sequence_p1"]).float().unsqueeze(0)
    static_p1_tensor = torch.from_numpy(features["static_p1"]).float().unsqueeze(0)
    seq_p2_tensor = torch.from_numpy(features["sequence_p2"]).float().unsqueeze(0)
    static_p2_tensor = torch.from_numpy(features["static_p2"]).float().unsqueeze(0)
    
    # Get logits from both perspectives
    with torch.no_grad():
        logit_p1 = model(seq_p1_tensor, static_p1_tensor).item()
        logit_p2 = model(seq_p2_tensor, static_p2_tensor).item()
    
    logger.info(
        f"[INFERENCE DEBUG] {getattr(payload, 'player_one', 'unknown')} vs {getattr(payload, 'player_two', 'unknown')}: "
        f"logit_p1={logit_p1:.4f}, logit_p2={logit_p2:.4f}, "
        f"seq_p1_mean={seq_p1_tensor.mean().item():.4f}, static_p1_mean={static_p1_tensor.mean().item():.4f}"
    )
    
    # Apply sigmoid averaging (same as training pipeline)
    prob1_from_p1 = torch.sigmoid(torch.tensor(logit_p1)).item()
    prob2_from_p2 = torch.sigmoid(torch.tensor(logit_p2)).item()
    
    prob_one = (prob1_from_p1 + (1.0 - prob2_from_p2)) / 2.0
    prob_two = 1.0 - prob_one
    
    logger.info(
        f"[INFERENCE DEBUG] After sigmoid avg: prob_one={prob_one:.4f}, prob_two={prob_two:.4f}"
    )

    # Apply temperature/Platt scaling to match backtesting (truer to real-life probabilities)
    from ..config import get_settings
    from ..utils.calibration import apply_temperature
    settings = get_settings()
    
    # Hardcode T=1.2 for As At 12/11/2025 predictions (frozen mode) - optimized for betting performance
    # For fresh mode (user-entered matches), use standard calibration
    if feature_mode == "frozen":
        # As At predictions: use T=1.2 (optimized from backtesting on Pinnacle odds)
        prob_one_before_temp = prob_one
        prob_one = float(apply_temperature(np.array([prob_one]), 1.2)[0])
        prob_two = 1.0 - prob_one
        logger.info(
            f"[INFERENCE DEBUG] After T=1.2 scaling: prob_one={prob_one_before_temp:.4f} -> {prob_one:.4f}"
        )
    else:
        # Fresh/Current predictions: use standard calibration
        cal_params = load_calibration_params(settings.calibration_params_path)
        if cal_params:
            # Optional override: T=1.0 skips calibration (use raw model outputs for testing)
            T_override = getattr(settings, "calibration_temperature_override", None)
            if T_override is not None:
                prob_one = float(apply_temperature(np.array([prob_one]), T_override)[0])
            else:
                prob_one = float(apply_calibration(np.array([prob_one]), cal_params)[0])
            prob_two = 1.0 - prob_one
    
    # Calculate insights (same logic as model_service.predict)
    confidence = max(prob_one, prob_two)
    
    # Calculate expected margin
    if confidence >= 0.90:
        expected_margin = 6.0
    elif confidence >= 0.80:
        expected_margin = 5.0 + (confidence - 0.80) * 10.0
    elif confidence >= 0.70:
        expected_margin = 4.0 + (confidence - 0.70) * 10.0
    elif confidence >= 0.60:
        expected_margin = 3.0 + (confidence - 0.60) * 10.0
    elif confidence >= 0.55:
        expected_margin = 2.5 + (confidence - 0.55) * 10.0
    elif confidence >= 0.50:
        expected_margin = 2.0 + (confidence - 0.50) * 10.0
    else:
        expected_margin = 0.0
    
    # Score descriptor
    if confidence >= 0.95:
        score_descriptor = "bagel"
    elif confidence >= 0.90:
        score_descriptor = "smashing"
    elif confidence >= 0.80:
        score_descriptor = "dominant"
    elif confidence >= 0.65:
        score_descriptor = "likely"
    elif confidence >= 0.55:
        score_descriptor = "close"
    else:
        score_descriptor = "toss-up"
    
    # Betting odds
    odds_one = round(1 / max(prob_one, 1e-6), 3)
    odds_two = round(1 / max(prob_two, 1e-6), 3)
    
    # Betting guidance
    if confidence < 0.58:
        betting_guidance = "Probably a bad bet"
    elif confidence >= 0.70:
        betting_guidance = "Maybe a good bet"
    else:
        betting_guidance = "Proceed with caution"
    
    return {
        "logit_p1": logit_p1,
        "logit_p2": logit_p2,
        "prob_one": prob_one,
        "prob_two": prob_two,
        "prob1_from_p1": prob1_from_p1,
        "prob2_from_p2": prob2_from_p2,
        "confidence": confidence,
        "expected_margin": expected_margin,
        "score_descriptor": score_descriptor,
        "betting_odds_one": odds_one,
        "betting_odds_two": odds_two,
        "betting_guidance": betting_guidance,
    }
