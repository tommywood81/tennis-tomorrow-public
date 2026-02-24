"""
Static feature builder for the experimental LSTM strategy.

This module augments the dual-perspective match table with match-level and
player-level features that are constant for the current match (unlike the
sequence inputs handled by ``sequence_builder``).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd

from .sequence_builder import _rank_to_strength, LEAGUE_AVG_SERVE, OPP_ADJ_COEF

logger = logging.getLogger(__name__)


def _safe_divide(numerator: np.ndarray, denominator: np.ndarray) -> np.ndarray:
    result = np.zeros_like(numerator, dtype=np.float32)
    mask = denominator > 0
    result[mask] = numerator[mask] / denominator[mask]
    return result


def _compute_streak(labels: pd.Series) -> pd.Series:
    streak = 0
    results = []
    prior_results = labels.shift(1)
    for val in prior_results:
        if pd.isna(val):
            streak = 0
        elif val == 1:
            streak = streak + 1 if streak >= 0 else 1
        else:
            streak = streak - 1 if streak <= 0 else -1
        results.append(streak)
    return pd.Series(results, index=labels.index, dtype=float)


@dataclass
class StaticFeatureResult:
    dataframe: pd.DataFrame
    features: np.ndarray
    feature_names: List[str]


class StaticFeatureBuilder:
    """Generate match-level static features for the new LSTM model."""

    def __init__(
        self,
        seq_len: int = 10,
        sequence_feature_names: Optional[Tuple[str, ...]] = None,
    ) -> None:
        self.seq_len = seq_len
        self.sequence_feature_names = sequence_feature_names or tuple()
        self._sequence_feature_index = {
            name: idx for idx, name in enumerate(self.sequence_feature_names)
        }

    def build(self, df: pd.DataFrame) -> StaticFeatureResult:
        required = [
            "player",
            "opponent",
            "label",
            "match_datetime",
            "player_rank",
            "opponent_rank",
            "sequence_features",
            "sequence_mask",
            "surface",
        ]
        missing = [col for col in required if col not in df.columns]
        if missing:
            raise ValueError(f"StaticFeatureBuilder requires columns: {missing}")

        working = df.copy()

        working["player_rank_norm"] = working["player_rank"].apply(_rank_to_strength)
        working["opponent_rank_norm"] = working["opponent_rank"].apply(_rank_to_strength)
        working["rank_diff"] = working["player_rank_norm"] - working["opponent_rank_norm"]

        working = working.sort_values(["player", "match_datetime", "match_id"]).reset_index(drop=True)

        # LEAKAGE-FREE: diff() = current_date - previous_date (equivalent to shift(1) for prior)
        working["days_since_prev"] = (
            working.groupby("player")["match_datetime"]
            .diff()
            .dt.days.fillna(0)
            .clip(lower=0, upper=365)
            .astype(float)
        )
        working["days_since_prev_log"] = np.log1p(working["days_since_prev"])

        seq_stack = np.stack(working["sequence_features"].to_numpy())
        mask_stack = np.stack(working["sequence_mask"].to_numpy())

        # From last valid timestep (return removed – outcome proxy)
        idx_serve_med = self._feature_idx("adj_serve_medium_decay")
        idx_fd_serve = self._feature_idx("form_delta_serve")

        def last_valid_per_row(stack: np.ndarray, mask: np.ndarray) -> np.ndarray:
            out = np.zeros(len(mask), dtype=np.float32)
            for i in range(len(mask)):
                valid = np.where(mask[i] > 0)[0]
                if valid.size > 0:
                    out[i] = stack[i, valid[-1]]
            return out

        working["recent_weighted_serve"] = last_valid_per_row(
            seq_stack[:, :, idx_serve_med], mask_stack
        )
        working["form_delta_serve"] = last_valid_per_row(
            seq_stack[:, :, idx_fd_serve], mask_stack
        )

        # Date-based "prior": only rows with match_datetime < current (no same-day leak)
        # Use groupby + searchsorted for O(n log n) instead of O(n^2)
        logger.info("  [static] Computing career stats (date-based)...")
        _date = pd.to_datetime(working["match_datetime"])
        career_matches_prior = np.zeros(len(working), dtype=np.float32)
        career_wins_prior = np.zeros(len(working), dtype=np.float32)
        _label = working["label"].values
        group_player = working.groupby("player", sort=False)
        n_groups = group_player.ngroups
        for gi, (player, grp) in enumerate(group_player):
            if (gi + 1) % 500 == 0 or gi == n_groups - 1:
                logger.info("    career: player group %d/%d", gi + 1, n_groups)
            idx = grp.index.values
            dates = _date.loc[idx].values
            labels = _label[working.index.get_indexer(idx)]
            for j, i in enumerate(idx):
                pos = np.searchsorted(dates, dates[j], side="left")
                career_matches_prior[working.index.get_loc(i)] = pos
                career_wins_prior[working.index.get_loc(i)] = labels[:pos].sum()
        working["career_matches_prior"] = career_matches_prior
        working["career_wins_prior"] = career_wins_prior
        working["career_win_pct"] = _safe_divide(
            career_wins_prior,
            np.maximum(career_matches_prior, 1.0),
        )

        logger.info("  [static] Computing H2H stats (date-based)...")
        h2h_matches = np.zeros(len(working), dtype=np.float32)
        h2h_wins = np.zeros(len(working), dtype=np.float32)
        h2h_recent_wins = np.zeros(len(working), dtype=np.float32)
        h2h_last_result = np.full(len(working), np.nan, dtype=np.float32)
        group_h2h = working.groupby(["player", "opponent"], sort=False)
        n_h2h = group_h2h.ngroups
        for gi, ((p, o), grp) in enumerate(group_h2h):
            if (gi + 1) % 1000 == 0 or gi == n_h2h - 1:
                logger.info("    h2h: group %d/%d", gi + 1, n_h2h)
            idx = grp.index.values
            dates = _date.loc[idx].values
            labels = _label[working.index.get_indexer(idx)]
            for j, i in enumerate(idx):
                pos = np.searchsorted(dates, dates[j], side="left")
                loc = working.index.get_loc(i)
                h2h_matches[loc] = pos
                if pos > 0:
                    lb = labels[:pos]
                    h2h_wins[loc] = lb.sum()
                    h2h_recent_wins[loc] = lb[-5:].sum()
                    h2h_last_result[loc] = float(lb[-1])
        working["h2h_total_matches"] = h2h_matches
        working["h2h_total_wins"] = h2h_wins
        working["h2h_recent_wins"] = np.nan_to_num(h2h_recent_wins, nan=0.0)
        working["h2h_last_result"] = np.nan_to_num(h2h_last_result, nan=0.0)

        logger.info("  [static] Computing streak (date-based)...")
        streak_arr = np.zeros(len(working), dtype=np.float32)
        group_player2 = working.groupby("player", sort=False)
        for gi, (player, grp) in enumerate(group_player2):
            if (gi + 1) % 500 == 0 or gi == n_groups - 1:
                logger.info("    streak: player group %d/%d", gi + 1, n_groups)
            idx = grp.index.values
            dates = _date.loc[idx].values
            labels = _label[working.index.get_indexer(idx)]
            for j, i in enumerate(idx):
                pos = np.searchsorted(dates, dates[j], side="left")
                lb = labels[:pos][::-1]  # most recent first
                s = 0
                for lab in lb:
                    if lab == 1:
                        s = s + 1 if s >= 0 else 1
                    else:
                        s = s - 1 if s <= 0 else -1
                streak_arr[working.index.get_loc(i)] = s
        working["streak"] = streak_arr

        # ABLATION: Removed all outcome-derived and H2H features for leakage audit.
        # See UNDERDOG_77_INVESTIGATION.md, ACTIVE_FEATURES_AUDIT.md
        feature_names = [
            "player_rank_norm",
            "opponent_rank_norm",
            "rank_diff",
            "career_matches_prior",
            # "career_win_pct",   # REMOVED: uses prior match outcomes
            "days_since_prev",
            "days_since_prev_log",
            "recent_weighted_serve",
            "form_delta_serve",
            # "h2h_total_matches", # REMOVED: H2H count (correlates with outcome-derived h2h_wins)
            # "h2h_total_wins",   # REMOVED: prior H2H outcomes
            # "h2h_recent_wins",  # REMOVED: prior H2H outcomes
            # "h2h_last_result",  # REMOVED: prior H2H outcome
            # "streak",           # REMOVED: win/loss streak from prior outcomes
        ]

        feature_matrix = working[feature_names].to_numpy(dtype=np.float32)
        return StaticFeatureResult(
            dataframe=working,
            features=feature_matrix,
            feature_names=feature_names,
        )

    def _feature_idx(self, name: str) -> int:
        if name not in self._sequence_feature_index:
            raise KeyError(
                f"Sequence feature '{name}' not available. Available features: {self.sequence_feature_names}"
            )
        return self._sequence_feature_index[name]

