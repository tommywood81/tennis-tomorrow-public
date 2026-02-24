"""
Dynamic feature computation service for on-the-fly predictions using pro-level strategy.

This service computes LSTM features dynamically from player match history,
using the same pro-level feature engineering pipeline as training.
"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Optional, Tuple, Dict, List
import sys

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
import joblib

from functools import lru_cache
import logging

from ..config import Settings, get_settings

logger = logging.getLogger(__name__)
from ..data_access import get_repository


def _detect_root() -> Path:
    """Resolve project root for both development and container (app lives at /app/app in container)."""
    current = Path(__file__).resolve()
    for parent in [current.parent, *current.parents]:
        if (parent / "experiments").exists() and (parent / "data").exists():
            return parent
    return current.parents[2]  # container: .../app/services/ -> /app


# Import pro-level preprocessing functions
ROOT = _detect_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
SRC_ROOT = ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from pro_level_strategy.preprocessing import (
    SEQ_FEATURE_NAMES,
    STATIC_FEATURE_NAMES,
    SEQ_LEN,
    ROLLING_WINDOWS,
    KMEANS_CLUSTERS,
    KMEANS_SEED,
    _to_player_level,
    _ensure_tourney_date_int,
    _per_match_features,
    _add_rolling_and_skills,
    _opponent_skills_asof,
    _expectation_reality_and_form,
    _surface_features,
    _matchup_and_fatigue,
    _safe_pct,
)


class DynamicFeatureService:
    """Compute pro-level LSTM features dynamically from player match history."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._repo = get_repository()
        self._scalers_loaded = False
        self._scaler_seq_mean: Optional[np.ndarray] = None
        self._scaler_seq_std: Optional[np.ndarray] = None
        self._static_scaler: Optional[StandardScaler] = None
        self._kmeans_model: Optional[KMeans] = None
        self._kmeans_scaler: Optional[StandardScaler] = None
        
        # Pro-level dimensions (must match pro_level_strategy.preprocessing)
        self.sequence_dim = len(SEQ_FEATURE_NAMES)  # 12
        self.static_dim = len(STATIC_FEATURE_NAMES)  # 9
        self.sequence_feature_names = list(SEQ_FEATURE_NAMES)
        self.static_feature_names = list(STATIC_FEATURE_NAMES)

    def _ensure_scalers_loaded(self) -> None:
        """Lazy load scalers and KMeans model only when needed for feature computation."""
        if self._scalers_loaded:
            return

        logger.info("Starting to load pro-level scalers (this may take a moment)...")
        
        scaler_dir = self.settings.scaler_dir
        if not scaler_dir.exists():
            raise RuntimeError(
                f"Scaler directory not found: {scaler_dir}. "
                "Run scripts/run_pro_level_production_training.py to generate the production model and scalers. "
                "Expected: experiments/models/production/scalers/ (sequence_scaler.npz, static_scaler.joblib, kmeans_model.joblib, kmeans_scaler.joblib)."
            )

        # Load sequence scaler
        logger.info("Loading sequence scaler...")
        seq_scaler_path = scaler_dir / "sequence_scaler.npz"
        if seq_scaler_path.exists():
            seq_data = np.load(seq_scaler_path, allow_pickle=True)
            self._scaler_seq_mean = seq_data["mean"]
            self._scaler_seq_std = seq_data["std"]
            logger.info("Sequence scaler loaded successfully")
        else:
            raise RuntimeError(f"Sequence scaler not found in {scaler_dir}")

        # Load static scaler
        logger.info("Loading static scaler...")
        static_scaler_path = scaler_dir / "static_scaler.joblib"
        if static_scaler_path.exists():
            import gc
            try:
                gc.collect()
                file_size_mb = static_scaler_path.stat().st_size / 1024 / 1024
                logger.info(f"Loading static scaler from {static_scaler_path} (file size: {file_size_mb:.2f} MB)")
                try:
                    self._static_scaler = joblib.load(static_scaler_path, mmap_mode='r')
                    logger.info("Static scaler loaded successfully with mmap_mode='r'")
                except (ValueError, TypeError):
                    logger.info("mmap_mode not supported, loading normally...")
                    self._static_scaler = joblib.load(static_scaler_path)
                    logger.info("Static scaler loaded successfully")
                gc.collect()
            except MemoryError as e:
                logger.error(f"MemoryError loading static scaler: {e}", exc_info=True)
                raise RuntimeError(f"Out of memory while loading static scaler.") from e
            except Exception as e:
                logger.error(f"Error loading static scaler: {e}", exc_info=True)
                raise
        else:
            raise RuntimeError(f"Static scaler not found in {scaler_dir}")
        
        # Try to load KMeans model (optional - will use fallback if not found)
        kmeans_path = scaler_dir / "kmeans_model.joblib"
        kmeans_scaler_path = scaler_dir / "kmeans_scaler.joblib"
        if kmeans_path.exists() and kmeans_scaler_path.exists():
            try:
                self._kmeans_model = joblib.load(kmeans_path)
                self._kmeans_scaler = joblib.load(kmeans_scaler_path)
                logger.info("KMeans model loaded successfully")
            except Exception as e:
                logger.warning(f"Could not load KMeans model: {e}. Will use fallback clustering.")
        else:
            logger.warning("KMeans model not found. Will use fallback clustering (assign cluster 0).")
        
        self._scalers_loaded = True
        logger.info("All scalers loaded successfully")

    def _build_player_match_dataframe(
        self, player_slug: str, match_date: Optional[date] = None
    ) -> pd.DataFrame:
        """
        Build a DataFrame with all historical matches for a player.
        
        Returns DataFrame with columns matching pro-level preprocessing expectations.
        """
        repo = self._repo
        player = repo.get_player(player_slug)
        if not player:
            raise ValueError(f"Player not found: {player_slug}")

        if match_date is None:
            match_date = datetime.now().date()
        match_timestamp = pd.Timestamp(match_date)

        # Get all historical matches BEFORE match_date
        player_frame = repo._player_frame(player_slug)
        historical_frame = player_frame[player_frame["tourney_date"] < match_timestamp].copy()
        
        if len(historical_frame) == 0:
            return pd.DataFrame()

        # Sort chronologically (oldest first)
        historical_frame = historical_frame.sort_values("tourney_date", ascending=True)

        # Build DataFrame with required columns for pro-level preprocessing
        matches = []
        for _, row in historical_frame.iterrows():
            tourney_date_str = row["tourney_date"].strftime("%Y%m%d")
            tourney_date_int = int(tourney_date_str)
            
            matches.append({
                "player": row["player"],
                "opponent": row["opponent"],
                "match_id": f"{tourney_date_str}_{row['player']}_{row['opponent']}",
                "tourney_date": tourney_date_int,
                "label": 1.0 if row["player"] == row["winner_name"] else 0.0,
                "player_ace": float(row.get("player_ace", 0)) if not pd.isna(row.get("player_ace", 0)) else 0.0,
                "player_df": float(row.get("player_df", 0)) if not pd.isna(row.get("player_df", 0)) else 0.0,
                "player_svpt": float(row.get("player_svpt", 100)) if not pd.isna(row.get("player_svpt", 100)) else 100.0,
                "player_1stIn": float(row.get("player_1stIn", 0)) if not pd.isna(row.get("player_1stIn", 0)) else 0.0,
                "player_1stWon": float(row.get("player_1stWon", 0)) if not pd.isna(row.get("player_1stWon", 0)) else 0.0,
                "player_2ndWon": float(row.get("player_2ndWon", 0)) if not pd.isna(row.get("player_2ndWon", 0)) else 0.0,
                "player_bpSaved": float(row.get("player_bpSaved", 0)) if not pd.isna(row.get("player_bpSaved", 0)) else 0.0,
                "player_bpFaced": float(row.get("player_bpFaced", 0)) if not pd.isna(row.get("player_bpFaced", 0)) else 0.0,
                "opp_ace": float(row.get("opponent_ace", 0)) if not pd.isna(row.get("opponent_ace", 0)) else 0.0,
                "opp_df": float(row.get("opponent_df", 0)) if not pd.isna(row.get("opponent_df", 0)) else 0.0,
                "opp_svpt": float(row.get("opponent_svpt", 100)) if not pd.isna(row.get("opponent_svpt", 100)) else 100.0,
                "opp_1stIn": float(row.get("opponent_1stIn", 0)) if not pd.isna(row.get("opponent_1stIn", 0)) else 0.0,
                "opp_1stWon": float(row.get("opponent_1stWon", 0)) if not pd.isna(row.get("opponent_1stWon", 0)) else 0.0,
                "opp_2ndWon": float(row.get("opponent_2ndWon", 0)) if not pd.isna(row.get("opponent_2ndWon", 0)) else 0.0,
                "opp_bpSaved": float(row.get("opponent_bpSaved", 0)) if not pd.isna(row.get("opponent_bpSaved", 0)) else 0.0,
                "opp_bpFaced": float(row.get("opponent_bpFaced", 0)) if not pd.isna(row.get("opponent_bpFaced", 0)) else 0.0,
                "surface": str(row.get("surface", "Hard")) if row.get("surface") is not None and not pd.isna(row.get("surface")) else "Hard",
            })

        df = pd.DataFrame(matches)
        return df

    def _apply_pro_level_preprocessing(
        self, combined_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Apply pro-level feature engineering pipeline to a combined DataFrame.
        
        Args:
            combined_df: DataFrame with both player's and opponent's matches combined
                        (needed for opponent skill lookup via _opponent_skills_asof)
        
        Returns:
            DataFrame with all pro-level features computed
        """
        if len(combined_df) == 0:
            # Return empty DataFrame with required columns
            required_cols = list(SEQ_FEATURE_NAMES) + list(STATIC_FEATURE_NAMES)
            return pd.DataFrame(columns=required_cols + ["player", "opponent", "tourney_date", "label"])

        # Step 1: Ensure player-level format
        working = _to_player_level(combined_df)
        working = _ensure_tourney_date_int(working)
        working = working.sort_values("tourney_date").reset_index(drop=True)

        # Ensure required base columns exist
        for c in ["player_ace", "player_svpt", "player_1stIn", "player_1stWon", "player_2ndWon",
                  "player_bpSaved", "player_bpFaced", "opp_ace", "opp_svpt", "opp_1stIn",
                  "opp_1stWon", "opp_2ndWon", "opp_bpSaved", "opp_bpFaced"]:
            if c not in working.columns:
                working[c] = 0.0
        if "surface" not in working.columns:
            working["surface"] = "Hard"

        # Steps 2-7: Apply feature engineering
        working = _per_match_features(working)
        working = _add_rolling_and_skills(working)
        
        # Opponent skills lookup (requires combined DataFrame with all players)
        working = _opponent_skills_asof(working)
        
        working = _expectation_reality_and_form(working)
        working = _surface_features(working)

        # Step 8: Style clustering (use fallback if KMeans not loaded)
        working = self._apply_style_clustering(working)

        # Steps 9-10: Matchup and fatigue
        working = _matchup_and_fatigue(working)

        return working

    def _apply_style_clustering(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply style clustering using saved KMeans model or fallback."""
        df = df.copy()
        
        cluster_cols = [
            "player_ace_rate_roll30",
            "player_df_rate_roll30",
            "player_1st_win_pct_roll30",
            "player_2nd_win_pct_roll30",
            "player_1st_return_win_pct_roll30",
            "player_2nd_return_win_pct_roll30",
        ]
        
        # Ensure all columns exist
        for col in cluster_cols:
            if col not in df.columns:
                df[col] = 0.0
        
        X = df[cluster_cols].fillna(0).to_numpy()
        
        if self._kmeans_model is not None and self._kmeans_scaler is not None:
            # Use saved KMeans model
            X_scaled = self._kmeans_scaler.transform(X)
            df["player_style_cluster"] = self._kmeans_model.predict(X_scaled).astype(np.int32)
        else:
            # Fallback: assign cluster 0 to all players
            df["player_style_cluster"] = 0

        # Opponent cluster lookup (mirrors preprocessing._style_clustering) - use opponent's most recent cluster
        player_cluster = df[["player", "tourney_date", "player_style_cluster"]].copy()
        player_cluster = player_cluster.rename(
            columns={"player": "opponent", "tourney_date": "opp_date", "player_style_cluster": "opp_style_cluster"}
        )
        player_cluster = player_cluster.sort_values(["opponent", "opp_date"])
        player_cluster["opp_date"] = pd.to_numeric(player_cluster["opp_date"], errors="coerce").astype(np.int64)
        opp_dates = pd.to_numeric(df["tourney_date"], errors="coerce").astype(np.int64)
        opp_cluster = np.zeros(len(df), dtype=np.int32)
        for opp, grp in player_cluster.groupby("opponent", sort=False):
            if len(grp) == 0:
                continue
            mask = df["opponent"].values == opp
            if not mask.any():
                continue
            out_dates = opp_dates[mask]
            grp_dates = pd.to_numeric(grp["opp_date"], errors="coerce").astype(np.int64).values
            grp_cluster = grp["opp_style_cluster"].values.astype(np.int32)
            idxs = np.searchsorted(grp_dates, out_dates, side="right") - 1
            valid = idxs >= 0
            opp_cluster[mask] = np.where(valid, grp_cluster[idxs], 0)
        df["opp_style_cluster"] = opp_cluster
        df["style_matchup"] = (df["player_style_cluster"] * 10 + df["opp_style_cluster"]).astype(np.int32)
        
        return df

    def _build_combined_dataframe(
        self, player_slug: str, opponent_slug: str, surface: str = "Hard",
        tourney_level: str = "M", round_name: str = "F", match_date: Optional[date] = None
    ) -> pd.DataFrame:
        """
        Build a combined DataFrame with both player's and opponent's matches for feature computation.
        
        This allows proper opponent skill lookup using _opponent_skills_asof.
        The key is to combine ALL matches (player's + opponent's) before preprocessing,
        so that _opponent_skills_asof can look up opponent stats from their own match history.
        
        IMPORTANT: Use display names (not slugs) for "player" and "opponent" columns so they
        match the format in historical rows from the dataset. The filter at the end must use
        the same identifier.
        """
        player_rec = self._repo.get_player(player_slug)
        opponent_rec = self._repo.get_player(opponent_slug)
        if not player_rec:
            raise ValueError(f"Player not found: {player_slug}")
        if not opponent_rec:
            raise ValueError(f"Player not found: {opponent_slug}")
        player_name = player_rec.name
        opponent_name = opponent_rec.name

        # Get player's matches
        player_df = self._build_player_match_dataframe(player_slug, match_date)
        
        # Get opponent's matches (need to convert to player-level format for opponent)
        opponent_df = self._build_player_match_dataframe(opponent_slug, match_date)
        
        # Add current match row (hypothetical match) to player's DataFrame
        if match_date is None:
            match_date = datetime.now().date()
        match_date_int = int(match_date.strftime("%Y%m%d"))
        
        # Use display names (not slugs) to match historical row format
        current_match = {
            "player": player_name,
            "opponent": opponent_name,
            "match_id": f"{match_date_int}_{player_slug}_{opponent_slug}",
            "tourney_date": match_date_int,
            "label": 0.5,  # Unknown outcome
            "surface": surface,
        }
        
        # Add all required feature columns (will be computed by preprocessing)
        for col in ["player_ace", "player_df", "player_svpt", "player_1stIn", "player_1stWon", "player_2ndWon",
                   "player_bpSaved", "player_bpFaced", "opp_ace", "opp_df", "opp_svpt", "opp_1stIn",
                   "opp_1stWon", "opp_2ndWon", "opp_bpSaved", "opp_bpFaced"]:
            current_match[col] = 0.0
        
        # Append current match to player's DataFrame
        current_df = pd.DataFrame([current_match])
        player_with_current = pd.concat([player_df, current_df], ignore_index=True)
        
        # CRITICAL: Combine player's matches + opponent's matches BEFORE preprocessing
        # This allows _opponent_skills_asof to look up opponent stats from their own history
        # We need to ensure both DataFrames have the same structure
        combined_before_preprocessing = pd.concat([player_with_current, opponent_df], ignore_index=True)
        
        # Now apply preprocessing to the combined DataFrame
        # This will compute features for both players, and opponent skills will be looked up correctly
        final_df = self._apply_pro_level_preprocessing(combined_before_preprocessing)
        
        # Filter to only player's matches (including current match) - use display name to match row format
        player_final = final_df[final_df["player"] == player_name].copy()
        
        return player_final

    def compute_features(
        self, player_slug: str, opponent_slug: str, surface: str = "Hard",
        tourney_level: str = "M", round_name: str = "F", match_date: Optional[date] = None
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Compute pro-level sequence and static features for a match prediction.
        
        Returns:
            sequence: (seq_len, feature_dim) array with last 10 matches
            static: (static_dim,) array for current match
            mask: (seq_len,) array indicating valid timesteps
        """
        # Lazy load scalers
        self._ensure_scalers_loaded()
        
        # Build combined DataFrame with all features
        df = self._build_combined_dataframe(
            player_slug, opponent_slug, surface, tourney_level, round_name, match_date
        )
        
        if len(df) == 0:
            raise ValueError(
                "Cannot compute prediction: no match data found. "
                "Both players must exist in the dataset with match history before the prediction date."
            )
        if len(df) <= 1:
            raise ValueError(
                "Cannot compute prediction: insufficient match history. "
                "Need at least one historical match before the prediction date for the primary player."
            )
        
        # Extract sequence features (last 10 matches before current)
        seq_feat_cols = list(SEQ_FEATURE_NAMES)
        if len(df) < SEQ_LEN + 1:
            # Not enough matches - pad with zeros
            available = df.iloc[:-1] if len(df) > 1 else df
            seq_data = available[seq_feat_cols].to_numpy(dtype=np.float32) if len(available) > 0 else np.zeros((0, self.sequence_dim), dtype=np.float32)
            padding = SEQ_LEN - len(seq_data)
            if padding > 0:
                seq_data = np.vstack([np.zeros((padding, self.sequence_dim), dtype=np.float32), seq_data])
            sequence = seq_data[-SEQ_LEN:]
            mask = np.concatenate([np.zeros(padding, dtype=np.float32), np.ones(len(seq_data) - padding, dtype=np.float32)])[-SEQ_LEN:]
        else:
            # Get last SEQ_LEN matches before current
            past_matches = df.iloc[-(SEQ_LEN + 1):-1]
            sequence = past_matches[seq_feat_cols].to_numpy(dtype=np.float32)
            mask = np.ones(SEQ_LEN, dtype=np.float32)
        
        # Extract static features for current match (last row)
        static_cols = list(STATIC_FEATURE_NAMES)
        static = df.iloc[-1][static_cols].to_numpy(dtype=np.float32)
        
        # Handle NaNs
        sequence = np.nan_to_num(sequence, nan=0.0, posinf=0.0, neginf=0.0)
        static = np.nan_to_num(static, nan=0.0, posinf=0.0, neginf=0.0)
        
        # Scale features (mean/std are per-feature, shape (12,); broadcast over (seq_len, feature_dim))
        seq_scaled = (sequence - self._scaler_seq_mean) / self._scaler_seq_std
        sequence = np.nan_to_num(seq_scaled, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)
        
        # Static: (static_dim,)
        static = self._static_scaler.transform(static.reshape(1, -1))[0]
        
        # Debug logging for suspicious predictions
        if np.abs(sequence.mean()) < 0.01 and np.abs(static.mean()) < 0.01:
            logger.warning(
                f"[FEATURE DEBUG] {player_slug} vs {opponent_slug}: "
                f"Features are suspiciously close to zero! "
                f"seq_mean={sequence.mean():.6f}, static_mean={static.mean():.6f}, "
                f"seq_std={sequence.std():.6f}, static_std={static.std():.6f}"
            )
        
        return sequence, static, mask

    def compute_features_with_custom_matches(
        self,
        player_slug: str,
        opponent_slug: str,
        custom_matches: list,
        surface: str = "Hard",
        tourney_level: str = "M",
        round_name: str = "F",
        match_date: Optional[date] = None
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Compute features with custom last-10 matches overriding the sequence features.
        
        This method:
        1. Gets standard static features (from frozen snapshot)
        2. Converts custom matches to pro-level DataFrame format
        3. Applies pro-level preprocessing to custom matches
        4. Extracts sequence features from custom matches
        5. Returns custom sequence + frozen static features
        
        Args:
            custom_matches: List of ParsedMatch objects from tennis_abstract_parser
        """
        # Lazy load scalers
        self._ensure_scalers_loaded()
        
        # Step 1: Get standard static features (frozen)
        standard_sequence, standard_static, standard_mask = self.compute_features(
            player_slug, opponent_slug, surface, tourney_level, round_name, match_date
        )
        
        # Step 2: Convert custom matches to DataFrame format
        if not custom_matches or len(custom_matches) == 0:
            # No custom matches - return standard features
            return standard_sequence, standard_static, standard_mask
        
        # Convert ParsedMatch objects to DataFrame format expected by pro-level preprocessing
        matches_data = []
        for idx, match in enumerate(custom_matches):
            match_date_int = int(match.date.strftime("%Y%m%d"))
            
            # Estimate serve points from percentages (typical match ~120 serve points)
            svpt = 120
            first_serve_attempts = int(match.first_serve_pct * svpt) if match.first_serve_pct else int(0.6 * svpt)
            first_won = int(match.first_serve_won_pct * first_serve_attempts) if match.first_serve_won_pct else 0
            second_serve_attempts = svpt - first_serve_attempts
            second_won = int(match.second_serve_won_pct * second_serve_attempts) if match.second_serve_won_pct else 0
            
            # Estimate opponent stats from return_pct
            opp_svpt = svpt
            opponent_serve_pct = 1.0 - match.return_pct if match.return_pct else 0.5
            opp_total_won = int(opponent_serve_pct * opp_svpt)
            opp_1st_attempts = int(0.6 * opp_svpt)
            opp_2nd_attempts = opp_svpt - opp_1st_attempts
            opp_1st_won = int(opp_total_won * 0.6)
            opp_2nd_won = opp_total_won - opp_1st_won
            
            matches_data.append({
                "player": player_slug,
                "opponent": match.opponent_name,
                "match_id": f"custom_{idx}_{player_slug}",
                "tourney_date": match_date_int,
                "label": 1.0 if match.result == "W" else 0.0,
                "player_ace": float(match.aces) if match.aces else 0.0,
                "player_df": float(match.double_faults) if match.double_faults else 0.0,
                "player_svpt": float(svpt),
                "player_1stIn": float(first_serve_attempts),
                "player_1stWon": float(first_won),
                "player_2ndWon": float(second_won),
                "player_bpSaved": float(match.break_points_saved) if match.break_points_saved else 0.0,
                "player_bpFaced": 10.0,  # Estimate
                "opp_ace": 0.0,  # Not available from custom matches
                "opp_df": 0.0,
                "opp_svpt": float(opp_svpt),
                "opp_1stIn": float(opp_1st_attempts),
                "opp_1stWon": float(opp_1st_won),
                "opp_2ndWon": float(opp_2nd_won),
                "opp_bpSaved": 0.0,
                "opp_bpFaced": 10.0,
                "surface": match.surface or surface,
            })
        
        if len(matches_data) == 0:
            return standard_sequence, standard_static, standard_mask
        
        # Step 3: Build DataFrame and apply pro-level preprocessing
        custom_df = pd.DataFrame(matches_data)
        
        # Get opponent's match history for opponent skill lookup
        opponent_df = self._build_player_match_dataframe(opponent_slug, match_date)
        
        # Combine custom matches with opponent history for preprocessing
        combined_before_preprocessing = pd.concat([custom_df, opponent_df], ignore_index=True)
        
        # Apply pro-level preprocessing
        processed_df = self._apply_pro_level_preprocessing(combined_before_preprocessing)
        
        # Filter to only custom matches (player's perspective)
        custom_processed = processed_df[processed_df["player"] == player_slug].copy()
        
        if len(custom_processed) == 0:
            return standard_sequence, standard_static, standard_mask
        
        # Step 4: Extract sequence features (last SEQ_LEN matches)
        seq_feat_cols = list(SEQ_FEATURE_NAMES)
        if len(custom_processed) >= SEQ_LEN:
            sequence_data = custom_processed.iloc[-SEQ_LEN:][seq_feat_cols].to_numpy(dtype=np.float32)
            mask = np.ones(SEQ_LEN, dtype=np.float32)
        else:
            # Pad with zeros if not enough matches
            available = custom_processed[seq_feat_cols].to_numpy(dtype=np.float32)
            padding = SEQ_LEN - len(available)
            sequence_data = np.vstack([np.zeros((padding, self.sequence_dim), dtype=np.float32), available])
            mask = np.concatenate([np.zeros(padding, dtype=np.float32), np.ones(len(available), dtype=np.float32)])
        
        # Handle NaNs
        sequence_data = np.nan_to_num(sequence_data, nan=0.0, posinf=0.0, neginf=0.0)
        
        # Scale sequence features (mean/std are per-feature, shape (12,); broadcast over (seq_len, feature_dim))
        seq_scaled = (sequence_data - self._scaler_seq_mean) / self._scaler_seq_std
        custom_sequence = np.nan_to_num(seq_scaled, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)
        
        # Step 5: Return custom sequence with frozen static features
        return custom_sequence, standard_static, mask

    def get_detailed_features_for_visualization(
        self, player_slug: str, opponent_slug: str, surface: str = "Hard",
        tourney_level: str = "M", round_name: str = "F", match_date: Optional[date] = None
    ) -> Dict:
        """
        Get detailed feature breakdown for visualization.
        
        Returns dict with historical matches, sequence features, and static features.
        """
        # Lazy load scalers
        self._ensure_scalers_loaded()
        
        # Build combined DataFrame
        df = self._build_combined_dataframe(
            player_slug, opponent_slug, surface, tourney_level, round_name, match_date
        )
        
        if len(df) == 0:
            return {
                "historical_matches": [],
                "sequence_features": [],
                "static_features": {},
                "sequence_feature_names": list(SEQ_FEATURE_NAMES),
                "static_feature_names": list(STATIC_FEATURE_NAMES),
            }
        
        # Extract historical matches (last 10 before current)
        historical_matches = []
        hist_df = df.iloc[:-1] if len(df) > 1 else df
        
        for i in range(max(0, len(hist_df) - 10), len(hist_df)):
            row = hist_df.iloc[i]
            historical_matches.append({
                "date": str(row.get("tourney_date", "")),
                "opponent": str(row.get("opponent", "")),
                "won": bool(row.get("label", 0) > 0.5),
                "surface": str(row.get("surface", surface)),
            })
        
        # Extract sequence features (last 10 matches before current)
        seq_feat_cols = list(SEQ_FEATURE_NAMES)
        if len(df) >= SEQ_LEN + 1:
            past_matches = df.iloc[-(SEQ_LEN + 1):-1]
            sequence_features_list = []
            for _, row in past_matches.iterrows():
                seq_dict = {name: float(row.get(name, 0.0)) for name in seq_feat_cols}
                sequence_features_list.append(seq_dict)
        else:
            # Pad with empty dicts if not enough matches
            sequence_features_list = [
                {name: 0.0 for name in seq_feat_cols}
                for _ in range(SEQ_LEN - len(df) + 1)
            ]
            for _, row in hist_df.iterrows():
                seq_dict = {name: float(row.get(name, 0.0)) for name in seq_feat_cols}
                sequence_features_list.append(seq_dict)
            sequence_features_list = sequence_features_list[-SEQ_LEN:]
        
        # Extract static features for current match (last row)
        static_cols = list(STATIC_FEATURE_NAMES)
        static_features_dict = {
            name: float(df.iloc[-1].get(name, 0.0)) for name in static_cols
        }
        
        return {
            "historical_matches": historical_matches[-10:],
            "sequence_features": sequence_features_list,
            "static_features": static_features_dict,
            "sequence_feature_names": list(SEQ_FEATURE_NAMES),
            "static_feature_names": list(STATIC_FEATURE_NAMES),
        }


@lru_cache(maxsize=1)
def get_dynamic_feature_service() -> DynamicFeatureService:
    return DynamicFeatureService(get_settings())
