from __future__ import annotations

import threading
from datetime import date, datetime
from functools import lru_cache
from typing import Optional, Any, Tuple, List

import json
import numpy as np
import torch
from torch import nn

from ..config import Settings, get_settings
from ..data_access import get_repository
from ..schemas import (
    MatchPredictionRequest,
    PlayerSummary,
    PredictionInsights,
    PredictionProbabilities,
    PredictionResponse,
    StoryMetric,
)
from .feature_store import get_feature_store
from .dynamic_feature_service import get_dynamic_feature_service

from new_lstm_strategy.config import NewLSTMConfig
from new_lstm_strategy.model import DualBranchLSTM

LSTM_CONFIG = NewLSTMConfig()


class ModelService:
    def __init__(self, settings: Settings):
        import logging
        logger = logging.getLogger(__name__)
        logger.info("ModelService.__init__ starting...")
        
        self.settings = settings
        self._model: Optional[nn.Module] = None
        self._model_lock = threading.Lock()
        self.device = torch.device("cpu")
        
        logger.info("Getting repository...")
        self._repo = get_repository()
        logger.info("Repository obtained")
        
        # FeatureStore is not used for predictions (we use dynamic features)
        # Lazy load only if needed (currently not used)
        self._store: Optional[Any] = None  # Lazy load to avoid OOM
        
        self._dynamic_store: Optional[Any] = None  # Lazy load to avoid OOM
        logger.info("ModelService.__init__ completed successfully")
    
    @property
    def dynamic_store(self):
        """Lazy load dynamic feature service to reduce memory usage."""
        if self._dynamic_store is None:
            self._dynamic_store = get_dynamic_feature_service()
        return self._dynamic_store

    def _load_production_hyperparams(self) -> dict:
        """Load hyperparams from production config if available. Fallback to NewLSTMConfig."""
        config_path = self.settings.model_weights_path.parent / "pro_level_production_config.json"
        if config_path.exists():
            try:
                with open(config_path, encoding="utf-8") as f:
                    cfg = json.load(f)
                hp = cfg.get("hyperparams", {})
                if hp:
                    return {
                        "lstm_hidden": hp.get("lstm_hidden", LSTM_CONFIG.lstm_hidden),
                        "lstm_layers": hp.get("lstm_layers", LSTM_CONFIG.lstm_layers),
                        "dropout": hp.get("dropout", LSTM_CONFIG.dropout),
                    }
            except (json.JSONDecodeError, IOError):
                pass
        return {
            "lstm_hidden": LSTM_CONFIG.lstm_hidden,
            "lstm_layers": LSTM_CONFIG.lstm_layers,
            "dropout": LSTM_CONFIG.dropout,
        }

    def _ensure_model(self) -> nn.Module:
        import logging
        logger = logging.getLogger(__name__)
        
        if self._model is not None:
            return self._model
        if not self.settings.model_weights_path.exists():
            logger.error(
                f"LSTM weights not found at {self.settings.model_weights_path}. "
                f"Absolute path: {self.settings.model_weights_path.resolve()}"
            )
            raise RuntimeError(
                f"LSTM weights not found at {self.settings.model_weights_path}. "
                "Export the trained model before starting the API."
            )
        with self._model_lock:
            if self._model is None:
                logger.info(f"Loading model from {self.settings.model_weights_path}")
                # Use dimensions from dynamic feature service (matches training pipeline)
                dynamic_store = self.dynamic_store
                hp = self._load_production_hyperparams()
                model = DualBranchLSTM(
                    seq_input_dim=dynamic_store.sequence_dim,
                    static_input_dim=dynamic_store.static_dim,
                    lstm_hidden=hp["lstm_hidden"],
                    lstm_layers=hp["lstm_layers"],
                    dropout=hp["dropout"],
                ).to(self.device)
                state_dict = torch.load(self.settings.model_weights_path, map_location=self.device)
                model.load_state_dict(state_dict)
                model.eval()
                self._model = model
                logger.info("Model loaded successfully")
        return self._model

    def _score_descriptor(self, prob: float) -> str:
        if prob >= 0.95:
            return "bagel"
        if prob >= 0.90:
            return "smashing"
        if prob >= 0.80:
            return "dominant"
        if prob >= 0.65:
            return "likely"
        if prob >= 0.55:
            return "close"
        return "toss-up"

    def _betting_guidance(self, confidence: float) -> str:
        if confidence < 0.58:
            return "Probably a bad bet"
        if confidence >= 0.70:
            return "Maybe a good bet"
        return "Proceed with caution"

    def _predict_logit(
        self, player_one_slug: str, player_two_slug: str,
        surface: str = "Hard", tourney_level: str = "M", round_name: str = "F",
        match_date: Optional[date] = None, return_features: bool = False
    ) -> tuple:
        """
        Return the raw logit for ``player_one_slug`` winning using the LSTM,
        computing features dynamically from player match history.
        
        Args:
            match_date: Date of the match. If None, uses current date (for future predictions).
                       For historical matches, provide the actual match date to use correct historical features.
        
        Returns:
            logit (float): Raw logit value
            features (tuple): (sequence, static, mask) if return_features=True, else None
        """
        import logging
        logger = logging.getLogger(__name__)
        
        # Compute features dynamically - NO FALLBACKS
        # Access via property to ensure it's loaded
        # IMPORTANT: Pass match_date to ensure only historical matches before that date are used
        sequence, static, mask = self.dynamic_store.compute_features(
            player_one_slug, player_two_slug, surface, tourney_level, round_name, match_date
        )
        logger.warning(
            f"[PREDICTION DEBUG] {player_one_slug} vs {player_two_slug}: "
            f"Computed features dynamically | "
            f"Sequence shape: {sequence.shape}, Static shape: {static.shape}, Mask: {mask}"
        )
        
        model = self._ensure_model()
        seq_tensor = torch.from_numpy(sequence).float().unsqueeze(0).to(self.device)
        static_tensor = torch.from_numpy(static).float().unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits = model(seq_tensor, static_tensor)
            logit = logits.item()
        
        logger.warning(
            f"[PREDICTION RESULT] {player_one_slug} vs {player_two_slug}: "
            f"Raw logit: {logit:.4f}"
        )
        
        if return_features:
            return float(logit), (sequence, static, mask)
        return float(logit)
    
    def _format_feature_name(self, name: str) -> str:
        """Format feature names for better readability."""
        # Map technical names to interpretable descriptions (pro-level + legacy)
        name_mapping = {
            # Pro-level sequence features
            "serve_skill": "Serve Skill (roll10)",
            "return_skill": "Return Skill (roll10)",
            "spw_diff": "SPW vs Expected",
            "rpw_diff": "RPW vs Expected",
            "serve_form_delta": "Serve Form (roll5 - roll30)",
            "return_form_delta": "Return Form (roll5 - roll30)",
            "opp_serve_skill": "Opponent Serve Skill",
            "opp_return_skill": "Opponent Return Skill",
            "days_since_last_match": "Days Since Last Match",
            # Pro-level static features
            "serve_vs_return_edge": "Serve vs Return Edge",
            "return_vs_serve_edge": "Return vs Serve Edge",
            "net_edge": "Net Edge",
            "player_style_cluster": "Player Style Cluster",
            "opp_style_cluster": "Opponent Style Cluster",
            "style_matchup": "Style Matchup",
            # Legacy sequence features (recent form)
            "serve_pct_weighted": "Recent Serve Performance",
            "return_pct_weighted": "Recent Return Performance",
            "win_flag": "Recent Win Rate",
            "opp_rank_norm_weighted": "Recent Opponent Strength",
            "opp_strength_weighted": "Recent Opponent Quality",
            "days_since_prev_weighted": "Match Frequency",
            "decay_weight": "Recency Weight",
            "surface_idx": "Surface Preference",
            "tourney_level_idx": "Tournament Level",
            "round_idx": "Round Importance",
            # Raw sequence features (exclude from display - they're on different scales)
            "raw_serve_pct": "Raw Serve %",
            "raw_return_pct": "Raw Return %",
            "raw_win_flag": "Raw Win Flag",
            "raw_serve_diff_prev_year": "Serve Trend vs Last Year",
            "raw_return_diff_prev_year": "Return Trend vs Last Year",
            "raw_player_rank": "Current Player Rank",
            "raw_opponent_rank": "Current Opponent Rank",
            # Static features
            "player_rank_norm": "Player Ranking Strength",
            "opponent_rank_norm": "Opponent Ranking Strength",
            "rank_diff": "Ranking Advantage",
            "career_matches_prior": "Career Experience",
            "career_win_pct": "Career Win Rate",
            "player_age": "Player Age",
            "opponent_age": "Opponent Age",
            "age_diff": "Age Advantage",
            "days_since_prev": "Days Since Last Match",
            "days_since_prev_log": "Match Frequency (Log)",
            "recent_weighted_serve": "Recent Serve Form",
            "recent_weighted_return": "Recent Return Form",
            "recent_weighted_opp_strength": "Recent Opponent Quality",
            "recent_weighted_win_pct": "Recent Win Rate",
            "serve_slope_last3": "Serve Form Trend",
            "return_slope_last3": "Return Form Trend",
            "expected_serve_pct": "Expected Serve Performance",
            "expected_return_pct": "Expected Return Performance",
            "expected_diff_serve": "Serve vs Expected",
            "expected_diff_return": "Return vs Expected",
            "h2h_total_matches": "Head-to-Head Matches",
            "h2h_total_wins": "Head-to-Head Wins",
            "h2h_recent_wins": "Recent H2H Performance",
            "h2h_last_result": "Last H2H Result",
            "streak": "Current Win Streak",
        }
        return name_mapping.get(name, name.replace("_", " ").title())
    
    def _categorize_feature(self, name: str) -> str:
        """Categorize features into interpretable groups."""
        # Pro-level features
        pro_level_serve_return = ["serve_skill", "return_skill", "spw_diff", "rpw_diff", "serve_form_delta", "return_form_delta"]
        pro_level_opponent = ["opp_serve_skill", "opp_return_skill", "opp_style_cluster", "style_matchup"]
        pro_level_matchup = ["serve_vs_return_edge", "return_vs_serve_edge", "net_edge"]
        pro_level_surface = ["surface_Hard", "surface_Clay", "surface_Grass"]
        pro_level_style = ["player_style_cluster"]
        if name in pro_level_serve_return:
            return "Serve/Return Form"
        if name in pro_level_opponent:
            return "Opponent"
        if name in pro_level_matchup:
            return "Matchup Edge"
        if name in pro_level_surface:
            return "Surface"
        if name in pro_level_style:
            return "Style"
        if name == "days_since_last_match":
            return "Temporal"
        # Legacy: Recent form (last 10 matches)
        recent_form = [
            "serve_pct_weighted", "return_pct_weighted", "win_flag",
            "recent_weighted_serve", "recent_weighted_return", "recent_weighted_win_pct",
            "serve_slope_last3", "return_slope_last3",
        ]
        # Opponent strength
        opponent_strength = [
            "opp_rank_norm_weighted", "opp_strength_weighted", "opponent_rank_norm",
            "recent_weighted_opp_strength",
        ]
        # Match context
        match_context = [
            "surface_idx", "tourney_level_idx", "round_idx",
        ]
        # Career/historical
        career_historical = [
            "career_matches_prior", "career_win_pct", "player_rank_norm",
            "rank_diff", "player_age", "opponent_age", "age_diff",
        ]
        # Head-to-head
        h2h = [
            "h2h_total_matches", "h2h_total_wins", "h2h_recent_wins", "h2h_last_result",
        ]
        # Temporal
        temporal = [
            "days_since_prev_weighted", "days_since_prev", "days_since_prev_log",
            "match_frequency",
        ]
        # Performance vs expected
        performance_vs_expected = [
            "expected_serve_pct", "expected_return_pct",
            "expected_diff_serve", "expected_diff_return",
        ]
        # Other
        other = ["streak", "decay_weight"]
        
        if name in recent_form:
            return "Recent Form"
        elif name in opponent_strength:
            return "Opponent Strength"
        elif name in match_context:
            return "Match Context"
        elif name in career_historical:
            return "Career & Ranking"
        elif name in h2h:
            return "Head-to-Head"
        elif name in temporal:
            return "Match Timing"
        elif name in performance_vs_expected:
            return "Performance vs Expected"
        else:
            return "Other"
    
    def _compute_feature_importance(
        self, sequence: np.ndarray, static: np.ndarray, mask: np.ndarray
    ) -> List[Dict]:
        """
        Compute gradient-based feature importance with categorization.
        
        Uses gradients of the output logit w.r.t. input features to measure importance.
        Groups features into interpretable categories for better presentation.
        
        Returns:
            List of dicts with 'feature', 'importance', 'category', and 'display_name'
        """
        model = self._ensure_model()
        model.eval()
        
        # Convert to tensors and require gradients
        seq_tensor = torch.from_numpy(sequence).float().unsqueeze(0).to(self.device)
        static_tensor = torch.from_numpy(static).float().unsqueeze(0).to(self.device)
        mask_tensor = torch.from_numpy(mask).float().unsqueeze(0).to(self.device)
        
        seq_tensor.requires_grad_(True)
        static_tensor.requires_grad_(True)
        
        # Forward pass
        logits = model(seq_tensor, static_tensor, mask_tensor)
        
        # Backward pass to get gradients
        logits.backward()
        
        # Get gradients (absolute values as importance)
        seq_grads = seq_tensor.grad.abs().cpu().numpy()[0]  # (seq_len, feature_dim)
        static_grads = static_tensor.grad.abs().cpu().numpy()[0]  # (static_dim,)
        
        # Aggregate sequence gradients: take mean across timesteps (weighted by mask)
        # This gives us importance per feature across the sequence
        mask_np = mask_tensor.cpu().numpy()[0]  # (seq_len,)
        seq_importance = np.zeros(seq_grads.shape[1])  # (feature_dim,)
        for t in range(seq_grads.shape[0]):
            if mask_np[t] > 0:  # Only count valid timesteps
                seq_importance += seq_grads[t, :]
        valid_timesteps = mask_np.sum()
        if valid_timesteps > 0:
            seq_importance /= valid_timesteps
        
        # Get feature names from dynamic feature service (pro-level: 12 seq, 9 static)
        feature_service = self.dynamic_store
        seq_feature_names = getattr(feature_service, "sequence_feature_names", []) or []
        static_feature_names = getattr(feature_service, "static_feature_names", []) or []

        # Combine sequence and static features with their importance scores
        all_features = []
        temporal_features = ["days_since_prev_weighted", "days_since_prev", "days_since_prev_log", "decay_weight", "days_since_last_match"]
        
        for name, importance in zip(seq_feature_names, seq_importance):
            # Exclude raw features that are on different scales and less interpretable
            if not name.startswith("raw_"):
                # Exclude temporal features from main display - they're less interpretable and often dominate
                if name not in temporal_features:
                    all_features.append({
                        "feature": name,
                        "importance": float(importance),
                        "category": self._categorize_feature(name),
                        "display_name": self._format_feature_name(name),
                    })
        for name, importance in zip(static_feature_names, static_grads):
            # Exclude temporal static features too
            if name not in temporal_features:
                all_features.append({
                    "feature": name,
                    "importance": float(importance),
                    "category": self._categorize_feature(name),
                    "display_name": self._format_feature_name(name),
                })
        
        # Sort by importance (descending) and return top 20
        all_features.sort(key=lambda x: x["importance"], reverse=True)
        return all_features[:20]

    def predict(self, payload: MatchPredictionRequest) -> Tuple[PredictionResponse, List]:
        """
        Predict match outcome using dual-perspective logits with sigmoid averaging.
        
        The model outputs logits from each player's perspective. We apply sigmoid to each
        logit separately, then average the probabilities from both perspectives. This matches
        the training pipeline's evaluation methodology for consistency.
        """
        import logging
        import torch.nn.functional as F
        logger = logging.getLogger(__name__)
        
        surface = payload.surface or "Hard"
        tourney_level = payload.tournament_level or "M"
        round_name = payload.round or "F"
        match_date = payload.match_date  # Can be None (for future predictions)
        
        # Get raw logits from each player's perspective
        # From player_one's perspective: logit for player_one winning
        # IMPORTANT: Pass match_date to ensure features only use historical data before that date
        logit_player1 = self._predict_logit(
            payload.player_one, payload.player_two,
            surface=surface, tourney_level=tourney_level, round_name=round_name,
            match_date=match_date
        )
        
        # From player_two's perspective: logit for player_two winning
        logit_player2 = self._predict_logit(
            payload.player_two, payload.player_one,
            surface=surface, tourney_level=tourney_level, round_name=round_name,
            match_date=match_date
        )
        
        # Use sigmoid averaging (same as training pipeline):
        # Apply sigmoid to each logit separately, then average probabilities
        # This matches the training evaluation methodology
        prob1_from_p1 = torch.sigmoid(torch.tensor(logit_player1)).item()  # P(player1 wins | player1's view)
        prob2_from_p2 = torch.sigmoid(torch.tensor(logit_player2)).item()  # P(player2 wins | player2's view)
        
        # Average probabilities from both perspectives
        # prob_one = (P(player1 wins | player1 view) + P(player1 wins | player2 view)) / 2
        prob_one = (prob1_from_p1 + (1.0 - prob2_from_p2)) / 2.0
        prob_two = 1.0 - prob_one  # Ensure probabilities sum to 1.0
        
        logger.info(
            f"[SIGMOID AVERAGING PREDICTION] {payload.player_one} vs {payload.player_two}: "
            f"Logit P1: {logit_player1:.4f}, Logit P2: {logit_player2:.4f}, "
            f"Sigmoid P1: {prob1_from_p1:.4f}, Sigmoid P2: {prob2_from_p2:.4f}, "
            f"Avg P1: {prob_one:.4f} ({prob_one*100:.1f}%), "
            f"Avg P2: {prob_two:.4f} ({prob_two*100:.1f}%)"
        )
        
        confidence = max(prob_one, prob_two)
        
        # Calibrate expected margin from probability using piecewise linear function
        # Margin represents expected game difference per set (max 6 games = 6-0 set)
        # Based on real tennis set dynamics:
        # - Close matches (50-55%): ~2 game margin (e.g., 6-4 set)
        # - Slight favorite (55-60%): ~3 game margin (e.g., 6-3 set)
        # - Moderate favorite (60-70%): ~3-4 game margin (e.g., 6-3 or 6-2 set)
        # - Strong favorite (70-80%): ~4-5 game margin (e.g., 6-2 or 6-1 set)
        # - Very strong (80-90%): ~5-6 game margin (e.g., 6-1 or 6-0 set)
        # - Dominant (90%+): ~6 game margin (e.g., 6-0 set)
        if confidence >= 0.90:
            # >90%: 6 game margin (dominant favorite, 6-0 set)
            expected_margin = 6.0
        elif confidence >= 0.80:
            # 80-90%: Linear interpolation from 5 to 6 games
            expected_margin = 5.0 + (confidence - 0.80) * 10.0  # 5 + (0-0.1) * 10 = 5-6
        elif confidence >= 0.70:
            # 70-80%: Linear interpolation from 4 to 5 games
            expected_margin = 4.0 + (confidence - 0.70) * 10.0  # 4 + (0-0.1) * 10 = 4-5
        elif confidence >= 0.60:
            # 60-70%: Linear interpolation from 3 to 4 games
            expected_margin = 3.0 + (confidence - 0.60) * 10.0  # 3 + (0-0.1) * 10 = 3-4
        elif confidence >= 0.55:
            # 55-60%: Linear interpolation from 2.5 to 3 games
            expected_margin = 2.5 + (confidence - 0.55) * 10.0  # 2.5 + (0-0.05) * 10 = 2.5-3
        elif confidence >= 0.50:
            # 50-55%: Linear interpolation from 2 to 2.5 games
            expected_margin = 2.0 + (confidence - 0.50) * 10.0  # 2 + (0-0.05) * 10 = 2-2.5
        else:
            # <50%: Shouldn't happen (confidence is max prob), but handle edge case
            expected_margin = 0.0
        
        # Calculate decimal odds from averaged probabilities
        # Decimal odds = 1 / probability (e.g., 60% probability = 1/0.6 = 1.67x odds)
        # Using sigmoid-averaged probabilities (same as training pipeline)
        odds_one = round(1 / max(prob_one, 1e-6), 3)
        odds_two = round(1 / max(prob_two, 1e-6), 3)

        player_one = self._repo.get_player(payload.player_one) or PlayerSummary(
            id=payload.player_one, name=payload.player_one
        )
        player_two = self._repo.get_player(payload.player_two) or PlayerSummary(
            id=payload.player_two, name=payload.player_two
        )

        insights = PredictionInsights(
            confidence=confidence,
            expected_margin=expected_margin,
            score_descriptor=self._score_descriptor(confidence),
            betting_odds_player_one=odds_one,
            betting_odds_player_two=odds_two,
            betting_guidance=self._betting_guidance(confidence),
            # We currently don't expose feature group importances from the LSTM,
            # so leave this empty rather than returning hardcoded values.
            feature_groups=[],
        )

        # Compute feature importance from player_one's perspective (primary prediction)
        # Get features for importance computation
        _, (seq_p1, static_p1, mask_p1) = self._predict_logit(
            payload.player_one, payload.player_two,
            surface=surface, tourney_level=tourney_level, round_name=round_name,
            match_date=match_date, return_features=True
        )
        
        # Compute gradient-based feature importance
        feature_importance_list = self._compute_feature_importance(seq_p1, static_p1, mask_p1)
        
        # Convert to FeatureImportance objects (now includes category and display_name)
        from ..schemas import FeatureImportance
        feature_importance = [
            FeatureImportance(
                feature=item["feature"],
                importance=item["importance"],
                category=item.get("category", "Other"),
                display_name=item.get("display_name", item["feature"])
            )
            for item in feature_importance_list
        ]

        return PredictionResponse(
            generated_at=datetime.utcnow(),
            player_one=player_one,
            player_two=player_two,
            probabilities=PredictionProbabilities(player_one=prob_one, player_two=prob_two),
            insights=insights,
            model_version=str(self.settings.model_weights_path),
            feature_mode="frozen",  # Standard prediction uses frozen features
            override_used=False,  # No override for standard prediction
        ), feature_importance


@lru_cache(maxsize=1)
def get_model_service() -> ModelService:
    return ModelService(get_settings())

