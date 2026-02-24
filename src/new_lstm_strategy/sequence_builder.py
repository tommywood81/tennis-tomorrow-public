"""
Sequence feature builder for the experimental LSTM strategy.

This module is responsible for assembling a fixed-length history for every
player/match sample in a dual-perspective dataset.  It produces a dense
numeric tensor ready to be consumed by an LSTM branch, following the plan
outlined in ``notebooks/newfeatureplanlstm.txt``.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

SEQ_SURFACE_ORDER = ["Hard", "Clay", "Grass", "Carpet", "Unknown"]
SEQ_TOURNEY_LEVEL_ORDER = ["C", "A", "250", "500", "M", "G", "F", "D", "Unknown"]
SEQ_ROUND_ORDER = [
    "RR",
    "R128",
    "R96",
    "R64",
    "R48",
    "R32",
    "R16",
    "QF",
    "SF",
    "F",
    "BR",
    "Unknown",
]

# Opponent-strength normalization for serve (return removed – outcome proxy)
LEAGUE_AVG_SERVE = 0.65
OPP_ADJ_COEF = 0.10

# Short-term (last 3): strong decay, most recent gets highest weight
SHORT_TERM_WEIGHTS_3 = np.array([0.65, 0.25, 0.10], dtype=np.float32)
# Medium-term (last 10): gentler decay
MEDIUM_TERM_DECAY = 0.15
# Recency lambda for bookmaker-style EWM (matches bookmaker features)
RECENCY_LAMBDA = 0.4


def decay_weights(seq_len: int = 10, half_life: float = 3.0) -> np.ndarray:
    """
    Generate normalized decay weights for a fixed-length sequence.

    The newest timestep receives the largest weight (1.0). Older timesteps have
    their contribution reduced exponentially according to the supplied half-life.

    Args:
        seq_len: Number of timesteps.
        half_life: Number of matches required for the weight to halve.

    Returns:
        np.ndarray of shape (seq_len,) with weights summing to 1.0.
    """
    if seq_len <= 0:
        raise ValueError("seq_len must be positive")
    if half_life <= 0:
        raise ValueError("half_life must be positive")

    lam = math.log(2.0) / half_life
    weights = np.array(
        [math.exp(-lam * ((seq_len - 1) - t)) for t in range(seq_len)], dtype=np.float32
    )
    weights /= weights.sum()
    return weights


def _rank_to_strength(rank: float, max_rank: float = 2000.0) -> float:
    """
    Map ATP rank to a normalized strength in [0, 1] using log-rank.

    Lower rank → higher strength. Log scaling captures that rank 1 vs 10
    is a much larger gap than rank 100 vs 110, matching ATP ranking skew.
    """
    if pd.isna(rank) or rank <= 0:
        return 0.0
    rank = float(max(1.0, rank))
    max_rank = float(max_rank)
    # log-rank: strength = 1 - log(rank) / log(max_rank)
    # rank 1 -> 1.0, rank max_rank -> 0.0
    log_r = math.log(rank)
    log_max = math.log(max_rank)
    strength = 1.0 - log_r / log_max
    return float(max(0.0, min(1.0, strength)))


def _safe_pct(numerator: float, denominator: float) -> float:
    if denominator and denominator != 0:
        return float(numerator / denominator)
    return 0.0


def _surface_idx(surface: str) -> int:
    if surface not in SEQ_SURFACE_ORDER:
        surface = "Unknown"
    return SEQ_SURFACE_ORDER.index(surface)


def _tourney_level_idx(level: str) -> int:
    if level not in SEQ_TOURNEY_LEVEL_ORDER:
        level = "Unknown"
    return SEQ_TOURNEY_LEVEL_ORDER.index(level)


def _round_idx(round_name: str) -> int:
    if round_name not in SEQ_ROUND_ORDER:
        round_name = "Unknown"
    return SEQ_ROUND_ORDER.index(round_name)


# Per-timestep feature names: SERVE ONLY (return removed – outcome proxy / leakage risk)
SEQUENCE_FEATURE_NAMES_SHORT_MEDIUM = (
    "adj_serve_short_decay",
    "adj_serve_medium_decay",
    "opponent_rank_norm",
    "surface_idx",
    "days_since_prev",
    "form_delta_serve",
)
# Bookmaker mode: no rank; use opponent return strength for adj_serve only
SEQUENCE_FEATURE_NAMES_NO_RANK = (
    "adj_serve_short_decay",
    "adj_serve_medium_decay",
    "surface_idx",
    "days_since_prev",
    "form_delta_serve",
    "rpw_adj_last10",
    "rpw_adj_last3",
    "net_skill_last10",
)


@dataclass
class SequenceSample:
    """Container for sequence features associated with a single match sample."""

    player: str
    opponent: str
    match_id: str
    tourney_date: pd.Timestamp
    sequence: np.ndarray  # shape (seq_len, feature_dim)
    mask: np.ndarray  # shape (seq_len,) with 1 for valid timesteps, 0 for padding


def _adj_serve(serve_pct: float, opp_rank_norm: float) -> float:
    expected = LEAGUE_AVG_SERVE - OPP_ADJ_COEF * opp_rank_norm
    return float(serve_pct - expected)


def _short_term_decayed(values: np.ndarray, weights_3: np.ndarray = SHORT_TERM_WEIGHTS_3) -> float:
    """Weighted sum of last 3 (or fewer) values; most recent is last element and gets 0.65."""
    last3 = values[-3:] if len(values) >= 3 else values
    n = len(last3)
    if n == 0:
        return 0.0
    w = weights_3[-n:][::-1].copy()
    w /= w.sum()
    return float(np.dot(last3, w))


def _medium_term_decayed(values: np.ndarray, decay: float = MEDIUM_TERM_DECAY) -> float:
    """Exponentially weighted average; most recent (last element) gets exp(0), then exp(-decay), ..."""
    n = len(values)
    if n == 0:
        return 0.0
    ages = np.arange(n - 1, -1, -1, dtype=np.float32)  # last is 0, first is n-1
    weights = np.exp(-decay * ages)
    weights /= weights.sum()
    return float(np.dot(values, weights))


def _ewm_last_n(values: np.ndarray, lam: float, n: int) -> float:
    """Exponential weighted mean over last N values (bookmaker-style). Most recent gets highest weight."""
    if len(values) == 0:
        return 0.0
    last_n = values[-n:] if len(values) >= n else values
    if len(last_n) == 0:
        return 0.0
    ages = np.arange(len(last_n) - 1, -1, -1, dtype=np.float32)  # last is 0, first is len-1
    weights = np.exp(-lam * ages)
    weights /= weights.sum()
    return float(np.dot(last_n, weights))


def _validate_sequence(
    history: List[pd.Series],
    match_date: pd.Timestamp,
    seq_array: np.ndarray,
    mask: np.ndarray,
    match_id: str,
    player: str,
    opponent: str,
) -> None:
    """
    Sanity checks for leakage-free tensor construction.

    Raises AssertionError if any invariant is violated.
    """
    valid_count = int(np.sum(mask))
    assert 0 <= valid_count <= mask.shape[0], (
        f"Sequence mask sum {valid_count} must be in [0, seq_len={mask.shape[0]}]"
    )
    assert seq_array.shape[0] == mask.shape[0], (
        f"Sequence length {seq_array.shape[0]} != mask length {mask.shape[0]}"
    )
    # No NaNs in valid (masked) positions
    valid_mask_bool = mask > 0
    if valid_mask_bool.any():
        valid_vals = seq_array[valid_mask_bool]
        assert not np.isnan(valid_vals).any(), (
            f"Found NaN in valid sequence positions for {player} vs {opponent} match_id={match_id}"
        )
    # Max date in sequence < match date
    if history:
        max_date = max(r["match_datetime"] for r in history)
        assert max_date < match_date, (
            f"Leakage: max sequence date {max_date} >= match date {match_date} "
            f"for {player} vs {opponent} match_id={match_id}"
        )
    # Note: Duplicate-match check skipped (match_id collides for same-day rematches)


class SequenceFeatureBuilder:
    """
    Build per-player historical sequences: short/medium decayed opponent-adjusted
    serve and return only. All computed from matches before current (no leakage).
    """

    def __init__(
        self,
        seq_len: int = 10,
        half_life: float = 3.0,
        include_tourney_level: bool = True,
        include_round: bool = True,
        use_rank: bool = True,
    ) -> None:
        self.seq_len = seq_len
        self.half_life = half_life
        self.include_tourney_level = include_tourney_level
        self.include_round = include_round
        self.use_rank = use_rank
        self.feature_names: Tuple[str, ...] = (
            SEQUENCE_FEATURE_NAMES_SHORT_MEDIUM
            if use_rank
            else SEQUENCE_FEATURE_NAMES_NO_RANK
        )
        self.feature_dim = len(self.feature_names)

    def build(
        self, df: pd.DataFrame, debug: bool = False
    ) -> Tuple[pd.DataFrame, List[SequenceSample]]:
        """
        Construct sequences for every row in the provided dual-perspective dataset.

        Args:
            df: Player/opponent perspective data with at least the following columns:
                player, opponent, match_id, tourney_date, label,
                1stWon, 2ndWon, svpt, opponent_1stWon, opponent_2ndWon,
                opponent_svpt, opponent_rank, surface, tourney_level, round.

        Returns:
            tuple where the first element is the original DataFrame with additional
            columns ``sequence_features`` and ``sequence_mask`` and the second element
            is a list of ``SequenceSample`` instances for downstream consumers.
        """
        required_cols = [
            "player",
            "opponent",
            "match_id",
            "tourney_date",
            "label",
            "1stWon",
            "2ndWon",
            "svpt",
            "opponent_1stWon",
            "opponent_2ndWon",
            "opponent_svpt",
            "surface",
            "tourney_level",
            "round",
        ]
        if self.use_rank:
            required_cols.append("opponent_rank")
        else:
            required_cols.extend(["opp_return_strength", "adj_spw", "adj_rpw", "net_skill"])
        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        working = df.copy()
        working["match_datetime"] = pd.to_datetime(
            working["tourney_date"].astype(str), format="%Y%m%d", errors="coerce"
        )
        if working["match_datetime"].isna().any():
            raise ValueError("Unable to parse some tourney_date values into timestamps")

        # Pre-compute per-row sequence metrics
        working["serve_pct"] = (
            (working["1stWon"] + working["2ndWon"])
            .div(working["svpt"].replace(0, np.nan))
            .fillna(0.0)
            .astype(float)
        )
        working["return_pct"] = (
            (
                working["opponent_svpt"]
                - working["opponent_1stWon"]
                - working["opponent_2ndWon"]
            )
            .div(working["opponent_svpt"].replace(0, np.nan))
            .fillna(0.0)
            .astype(float)
        )
        if self.use_rank:
            working["opp_rank_norm"] = working["opponent_rank"].apply(_rank_to_strength)
        else:
            working["opp_rank_norm"] = working["opp_return_strength"].astype(float)
        working["adj_serve"] = working.apply(
            lambda r: _adj_serve(float(r["serve_pct"]), float(r["opp_rank_norm"])), axis=1
        )
        # Return NOT used: return_pct = 1 - opponent_serve in that match → outcome proxy (leakage)
        working["surface_idx"] = working["surface"].fillna("Unknown").apply(_surface_idx)
        working["tourney_level_idx"] = (
            working["tourney_level"].fillna("Unknown").apply(_tourney_level_idx)
        )
        working["round_idx"] = working["round"].fillna("Unknown").apply(_round_idx)

        working = working.sort_values(["player", "match_datetime", "match_id"]).reset_index(drop=True)
        working["days_since_prev"] = (
            working.groupby("player")["match_datetime"]
            .diff()
            .dt.days.fillna(0)
            .clip(lower=0, upper=365)
            .astype(float)
        )

        sequences: List[np.ndarray] = []
        masks: List[np.ndarray] = []
        sequence_samples: List[SequenceSample] = []
        debug_count = 0
        debug_limit = 10

        grouped = working.groupby("player", sort=False, group_keys=False)
        for _, player_df in grouped:
            # LEAKAGE-FREE: Equivalent to shift(1) - we append to player_history AFTER using it.
            # history_before_today = only rows with match_datetime < current_date (strictly past).
            # When we process match i, player_history contains matches 0..i-1; match i is never included.
            player_history: List[pd.Series] = []
            for _, row in player_df.iterrows():
                current_date = row["match_datetime"]
                history_before_today = [
                    r for r in player_history if r["match_datetime"] < current_date
                ]
                seq_array, mask = self._history_to_sequence(history_before_today)

                # Sanity checks (mandatory)
                _validate_sequence(
                    history_before_today,
                    current_date,
                    seq_array,
                    mask,
                    str(row["match_id"]),
                    str(row["player"]),
                    str(row["opponent"]),
                )

                if debug and debug_count < debug_limit:
                    seq_dates = [r["match_datetime"] for r in history_before_today]
                    last_seq_date = max(seq_dates) if seq_dates else None
                    logger.info(
                        "[sequence_builder] DEBUG %s vs %s match_date=%s "
                        "seq_dates=%s last_seq_date=%s last<match=%s",
                        row["player"],
                        row["opponent"],
                        current_date,
                        seq_dates[-5:] if len(seq_dates) >= 5 else seq_dates,
                        last_seq_date,
                        last_seq_date is None or last_seq_date < current_date,
                    )
                    debug_count += 1

                sequences.append(seq_array)
                masks.append(mask)
                sequence_samples.append(
                    SequenceSample(
                        player=row["player"],
                        opponent=row["opponent"],
                        match_id=row["match_id"],
                        tourney_date=row["match_datetime"],
                        sequence=seq_array,
                        mask=mask,
                    )
                )
                # Append AFTER building seq - ensures next match only sees past (shift(1) equivalent)
                player_history.append(row)

        working["sequence_features"] = sequences
        working["sequence_mask"] = masks
        return working, sequence_samples

    def _history_to_sequence(
        self,
        history: List[pd.Series],
    ) -> Tuple[np.ndarray, np.ndarray]:
        seq = np.zeros((self.seq_len, self.feature_dim), dtype=np.float32)
        mask = np.zeros(self.seq_len, dtype=np.float32)

        if not history:
            return seq, mask

        tail = history[-self.seq_len :]
        tail_len = len(tail)
        adj_serves = np.array([float(r["adj_serve"]) for r in tail], dtype=np.float32)
        
        # Extract adj_rpw and net_skill for rolling EWM features (bookmaker mode)
        has_bookmaker_features = not self.use_rank and len(tail) > 0 and "adj_rpw" in tail[0] and "net_skill" in tail[0]
        if has_bookmaker_features:
            adj_rpws = np.array([float(r.get("adj_rpw", 0.0)) for r in tail], dtype=np.float32)
            net_skills = np.array([float(r.get("net_skill", 0.0)) for r in tail], dtype=np.float32)
        else:
            adj_rpws = None
            net_skills = None

        for idx in range(tail_len):
            seq_idx = self.seq_len - tail_len + idx
            prior_serve = adj_serves[:idx]
            if idx == 0:
                short_serve = adj_serves[0]
                medium_serve = adj_serves[0]
            else:
                short_serve = _short_term_decayed(prior_serve)
                medium_serve = _medium_term_decayed(prior_serve)

            row = tail[idx]
            surface = float(row["surface_idx"])
            days = float(row["days_since_prev"])
            form_delta_serve = short_serve - medium_serve

            seq[seq_idx, 0] = short_serve
            seq[seq_idx, 1] = medium_serve
            
            if self.feature_dim >= 6:
                # With rank (6 features)
                seq[seq_idx, 2] = float(row["opp_rank_norm"])
                seq[seq_idx, 3] = surface
                seq[seq_idx, 4] = days
                seq[seq_idx, 5] = form_delta_serve
            elif self.feature_dim == 8:
                # Bookmaker mode: no rank, with new EWM features (8 features)
                seq[seq_idx, 2] = surface
                seq[seq_idx, 3] = days
                seq[seq_idx, 4] = form_delta_serve
                # Compute rolling EWM features from prior matches (past-only)
                if idx == 0:
                    # No prior matches: use current match value or 0
                    seq[seq_idx, 5] = float(row.get("adj_rpw", 0.0)) if adj_rpws is not None else 0.0  # rpw_adj_last10
                    seq[seq_idx, 6] = float(row.get("adj_rpw", 0.0)) if adj_rpws is not None else 0.0  # rpw_adj_last3
                    seq[seq_idx, 7] = float(row.get("net_skill", 0.0)) if net_skills is not None else 0.0  # net_skill_last10
                else:
                    # Compute EWM over prior matches only (shift(1) equivalent)
                    prior_rpw = adj_rpws[:idx] if adj_rpws is not None else np.array([], dtype=np.float32)
                    prior_net_skill = net_skills[:idx] if net_skills is not None else np.array([], dtype=np.float32)
                    seq[seq_idx, 5] = _ewm_last_n(prior_rpw, RECENCY_LAMBDA, 10) if len(prior_rpw) > 0 else 0.0  # rpw_adj_last10
                    seq[seq_idx, 6] = _ewm_last_n(prior_rpw, RECENCY_LAMBDA, 3) if len(prior_rpw) > 0 else 0.0  # rpw_adj_last3
                    seq[seq_idx, 7] = _ewm_last_n(prior_net_skill, RECENCY_LAMBDA, 10) if len(prior_net_skill) > 0 else 0.0  # net_skill_last10
            else:
                # No rank, no new features (5 features) - legacy
                seq[seq_idx, 2] = surface
                seq[seq_idx, 3] = days
                seq[seq_idx, 4] = form_delta_serve
            mask[seq_idx] = 1.0

        return seq, mask


