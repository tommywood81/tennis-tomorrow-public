"""
Pro-level feature engineering: Sackmann ATP data, strict anti-leakage, seq_len=10.

Steps: base columns → player-level → per-match features → rolling (3,5,10,30) with shift(1)
→ serve/return skill → expectation vs reality → form deltas → surface → clustering
→ matchup → fatigue → LSTM sequences (10 timesteps) + static. Drops rows with <10 prior matches.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

SEQ_LEN = 10
ROLLING_WINDOWS = (3, 5, 10, 30)
KMEANS_CLUSTERS = 4
KMEANS_SEED = 42

# Sequence features per timestep (order matters)
SEQ_FEATURE_NAMES = (
    "serve_skill",
    "return_skill",
    "spw_diff",
    "rpw_diff",
    "serve_form_delta",
    "return_form_delta",
    "surface_Hard",
    "surface_Clay",
    "surface_Grass",
    "days_since_last_match",
    "opp_serve_skill",
    "opp_return_skill",
)
# Static features for current match
STATIC_FEATURE_NAMES = (
    "serve_vs_return_edge",
    "return_vs_serve_edge",
    "net_edge",
    "surface_Hard",
    "surface_Clay",
    "surface_Grass",
    "player_style_cluster",
    "opp_style_cluster",
    "style_matchup",
)


@dataclass
class PreprocessedDataset:
    sequences: np.ndarray  # (N, 10, F)
    static: np.ndarray  # (N, S)
    masks: np.ndarray  # (N, 10)
    labels: np.ndarray  # (N,)
    metadata: pd.DataFrame
    sequence_feature_names: Tuple[str, ...] = SEQ_FEATURE_NAMES
    static_feature_names: Tuple[str, ...] = STATIC_FEATURE_NAMES


def _safe_pct(num: pd.Series, denom: pd.Series) -> pd.Series:
    out = num.astype(float) / denom.replace(0, np.nan)
    return out.fillna(0.0)


def _to_player_level(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure player-level rows with player_/opp_ prefixed columns. Accepts preprocessed (player, opponent, ace, 1stIn, ... opponent_ace, ...)."""
    working = df.copy()
    # Map existing names to player_ / opp_
    player_map = {
        "ace": "player_ace",
        "df": "player_df",
        "svpt": "player_svpt",
        "1stIn": "player_1stIn",
        "1stWon": "player_1stWon",
        "2ndWon": "player_2ndWon",
        "bpSaved": "player_bpSaved",
        "bpFaced": "player_bpFaced",
    }
    opp_map = {
        "opponent_ace": "opp_ace",
        "opponent_df": "opp_df",
        "opponent_svpt": "opp_svpt",
        "opponent_1stIn": "opp_1stIn",
        "opponent_1stWon": "opp_1stWon",
        "opponent_2ndWon": "opp_2ndWon",
        "opponent_bpSaved": "opp_bpSaved",
        "opponent_bpFaced": "opp_bpFaced",
    }
    for old, new in player_map.items():
        if old in working.columns and new not in working.columns:
            working[new] = working[old]
    for old, new in opp_map.items():
        if old in working.columns and new not in working.columns:
            working[new] = working[old]
    return working


def _ensure_tourney_date_int(df: pd.DataFrame) -> pd.DataFrame:
    if "tourney_date" not in df.columns:
        raise ValueError("tourney_date required")
    td = df["tourney_date"]
    if pd.api.types.is_integer_dtype(td):
        return df
    if pd.api.types.is_datetime64_any_dtype(td):
        df = df.copy()
        df["tourney_date"] = td.dt.strftime("%Y%m%d").astype(int)
        return df
    df = df.copy()
    df["tourney_date"] = pd.to_datetime(td, errors="coerce").dt.strftime("%Y%m%d").astype(int)
    return df


def _per_match_features(df: pd.DataFrame) -> pd.DataFrame:
    """Step 2: per-match serve/return/pressure metrics."""
    p = df
    p["player_1st_in_pct"] = _safe_pct(p["player_1stIn"], p["player_svpt"])
    p["player_1st_win_pct"] = _safe_pct(p["player_1stWon"], p["player_1stIn"])
    second_pts = p["player_svpt"] - p["player_1stIn"]
    p["player_2nd_win_pct"] = _safe_pct(p["player_2ndWon"], second_pts.replace(0, np.nan))
    p["player_ace_rate"] = _safe_pct(p["player_ace"], p["player_svpt"])
    p["player_df_rate"] = _safe_pct(p["player_df"], p["player_svpt"])
    p["player_1st_return_win_pct"] = 1.0 - _safe_pct(p["opp_1stWon"], p["opp_1stIn"])
    opp_second = p["opp_svpt"] - p["opp_1stIn"]
    p["player_2nd_return_win_pct"] = 1.0 - _safe_pct(p["opp_2ndWon"], opp_second.replace(0, np.nan))
    p["player_bp_save_pct"] = _safe_pct(p["player_bpSaved"], p["player_bpFaced"])
    p["player_bp_convert_pct"] = 1.0 - _safe_pct(p["opp_bpSaved"], p["opp_bpFaced"])
    return p


def _rolling_shifted(series: pd.Series, window: int, group: pd.Grouper) -> pd.Series:
    return group[series.name].transform(lambda s: s.rolling(window, min_periods=1).mean().shift(1))


def _add_rolling_and_skills(df: pd.DataFrame) -> pd.DataFrame:
    """Steps 3–4: rolling 3,5,10,30 (shifted) and serve_skill / return_skill from roll10."""
    df = df.sort_values(["player", "tourney_date"]).reset_index(drop=True)
    by_player = df.groupby("player", sort=False)

    for w in ROLLING_WINDOWS:
        df[f"player_1st_win_pct_roll{w}"] = by_player["player_1st_win_pct"].transform(
            lambda s: s.rolling(w, min_periods=1).mean().shift(1)
        )
        df[f"player_2nd_win_pct_roll{w}"] = by_player["player_2nd_win_pct"].transform(
            lambda s: s.rolling(w, min_periods=1).mean().shift(1)
        )
        df[f"player_1st_return_win_pct_roll{w}"] = by_player["player_1st_return_win_pct"].transform(
            lambda s: s.rolling(w, min_periods=1).mean().shift(1)
        )
        df[f"player_2nd_return_win_pct_roll{w}"] = by_player["player_2nd_return_win_pct"].transform(
            lambda s: s.rolling(w, min_periods=1).mean().shift(1)
        )
        df[f"player_ace_rate_roll{w}"] = by_player["player_ace_rate"].transform(
            lambda s: s.rolling(w, min_periods=1).mean().shift(1)
        )
        df[f"player_df_rate_roll{w}"] = by_player["player_df_rate"].transform(
            lambda s: s.rolling(w, min_periods=1).mean().shift(1)
        )

    r10 = 10
    df["serve_skill"] = (
        0.4 * df[f"player_1st_win_pct_roll{r10}"].fillna(0)
        + 0.4 * df[f"player_2nd_win_pct_roll{r10}"].fillna(0)
        + 0.1 * df[f"player_ace_rate_roll{r10}"].fillna(0)
        - 0.1 * df[f"player_df_rate_roll{r10}"].fillna(0)
    )
    df["return_skill"] = (
        0.5 * df[f"player_1st_return_win_pct_roll{r10}"].fillna(0)
        + 0.5 * df[f"player_2nd_return_win_pct_roll{r10}"].fillna(0)
    )
    return df


def _opponent_skills_asof(df: pd.DataFrame) -> pd.DataFrame:
    """Attach opponent's serve_skill and return_skill as of before match date."""
    out = df.copy()
    # Build lookup: for each (opponent, date) get that opponent's stats from their most recent match before date
    # Use groupby + transform with expanding max to get last known value per opponent
    player_stats = out[["player", "tourney_date", "serve_skill", "return_skill"]].copy()
    player_stats = player_stats.rename(columns={"player": "opponent", "tourney_date": "opp_date"})
    player_stats = player_stats.sort_values(["opponent", "opp_date"])
    
    # For each opponent, create expanding lookup: for each date, get last serve_skill/return_skill before that date
    opp_serve = np.zeros(len(out), dtype=np.float32)
    opp_return = np.zeros(len(out), dtype=np.float32)
    
    # Group by opponent and use expanding max to propagate last known value
    for opp, grp in player_stats.groupby("opponent", sort=False):
        if len(grp) == 0:
            continue
        grp = grp.sort_values("opp_date")
        # For each row in out where opponent==opp, find the last row in grp with opp_date < out's tourney_date
        mask = out["opponent"].values == opp
        if not mask.any():
            continue
        out_dates = pd.to_numeric(out.loc[mask, "tourney_date"], errors="coerce").astype(np.int64).values
        grp_dates = pd.to_numeric(grp["opp_date"], errors="coerce").astype(np.int64).values
        grp_serve = grp["serve_skill"].values.astype(np.float32)
        grp_return = grp["return_skill"].values.astype(np.float32)
        
        # Vectorized searchsorted for all dates at once
        idxs = np.searchsorted(grp_dates, out_dates, side="right") - 1
        valid = idxs >= 0
        opp_serve[mask] = np.where(valid, grp_serve[idxs], 0.0)
        opp_return[mask] = np.where(valid, grp_return[idxs], 0.0)
    
    out["opp_serve_skill"] = opp_serve
    out["opp_return_skill"] = opp_return
    return out


def _expectation_reality_and_form(df: pd.DataFrame) -> pd.DataFrame:
    """Steps 5–6: expected vs actual SPW/RPW, diffs; form deltas (roll5 - roll30)."""
    # Expected vs actual (use current match actual; expected uses pre-match skills)
    df["expected_spw"] = df["serve_skill"] - df["opp_return_skill"]
    df["actual_spw"] = _safe_pct(
        df["player_1stWon"] + df["player_2ndWon"],
        df["player_svpt"],
    )
    df["spw_diff"] = df["actual_spw"] - df["expected_spw"]

    df["expected_rpw"] = df["return_skill"] - df["opp_serve_skill"]
    opp_serve_won = df["opp_1stWon"] + df["opp_2ndWon"]
    df["actual_rpw"] = 1.0 - _safe_pct(opp_serve_won, df["opp_svpt"])
    df["rpw_diff"] = df["actual_rpw"] - df["expected_rpw"]

    serve_skill_roll5 = (
        0.4 * df["player_1st_win_pct_roll5"].fillna(0)
        + 0.4 * df["player_2nd_win_pct_roll5"].fillna(0)
        + 0.1 * df["player_ace_rate_roll5"].fillna(0)
        - 0.1 * df["player_df_rate_roll5"].fillna(0)
    )
    serve_skill_roll30 = (
        0.4 * df["player_1st_win_pct_roll30"].fillna(0)
        + 0.4 * df["player_2nd_win_pct_roll30"].fillna(0)
        + 0.1 * df["player_ace_rate_roll30"].fillna(0)
        - 0.1 * df["player_df_rate_roll30"].fillna(0)
    )
    return_skill_roll5 = (
        0.5 * df["player_1st_return_win_pct_roll5"].fillna(0)
        + 0.5 * df["player_2nd_return_win_pct_roll5"].fillna(0)
    )
    return_skill_roll30 = (
        0.5 * df["player_1st_return_win_pct_roll30"].fillna(0)
        + 0.5 * df["player_2nd_return_win_pct_roll30"].fillna(0)
    )
    df["serve_form_delta"] = serve_skill_roll5 - serve_skill_roll30
    df["return_form_delta"] = return_skill_roll5 - return_skill_roll30
    return df


def _surface_features(df: pd.DataFrame) -> pd.DataFrame:
    """Step 7: one-hot surface + surface_serve_skill, surface_return_skill (roll 10 same surface, shift 1)."""
    df = df.copy()
    surface = df["surface"].fillna("").astype(str).str.strip()
    for s in ["Hard", "Clay", "Grass"]:
        df[f"surface_{s}"] = (surface == s).astype(np.float32)

    df["surface_serve_skill"] = 0.0
    df["surface_return_skill"] = 0.0
    df["_surface_norm"] = surface.str.strip()
    df = df.sort_values(["player", "tourney_date"]).reset_index(drop=True)
    for (_player, _surf), grp in df.groupby(["player", "_surface_norm"], sort=False):
        if _surf == "" or _surf not in ("Hard", "Clay", "Grass"):
            continue
        idx_sorted = grp.sort_values("tourney_date").index
        ss = df.loc[idx_sorted, "serve_skill"].shift(1).rolling(10, min_periods=1).mean()
        rs = df.loc[idx_sorted, "return_skill"].shift(1).rolling(10, min_periods=1).mean()
        df.loc[idx_sorted, "surface_serve_skill"] = ss.values
        df.loc[idx_sorted, "surface_return_skill"] = rs.values
    df = df.drop(columns=["_surface_norm"])
    df["surface_serve_skill"] = df["surface_serve_skill"].fillna(0.0)
    df["surface_return_skill"] = df["surface_return_skill"].fillna(0.0)
    return df


def _style_clustering(
    df: pd.DataFrame, train_mask: np.ndarray, scaler_dir: Optional[Path] = None
) -> pd.DataFrame:
    """Step 8: KMeans(4) on roll30 long-term stats (fit on train), assign player_style_cluster, opp_style_cluster, style_matchup.

    If scaler_dir is provided, saves kmeans_model.joblib and kmeans_scaler.joblib for inference parity.
    """
    cluster_cols = [
        "player_ace_rate_roll30",
        "player_df_rate_roll30",
        "player_1st_win_pct_roll30",
        "player_2nd_win_pct_roll30",
        "player_1st_return_win_pct_roll30",
        "player_2nd_return_win_pct_roll30",
    ]
    X = df[cluster_cols].fillna(0).to_numpy()
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X[train_mask])
    kmeans = KMeans(n_clusters=KMEANS_CLUSTERS, random_state=KMEANS_SEED)
    kmeans.fit(X_scaled)
    X_all = scaler.transform(X)
    df = df.copy()
    df["player_style_cluster"] = kmeans.predict(X_all).astype(np.int32)

    # Save KMeans artifacts for inference pipeline parity
    if scaler_dir is not None:
        scaler_dir.mkdir(parents=True, exist_ok=True)
        joblib.dump(kmeans, scaler_dir / "kmeans_model.joblib")
        joblib.dump(scaler, scaler_dir / "kmeans_scaler.joblib")
        logger.info("[pro_level] Saved kmeans_model.joblib and kmeans_scaler.joblib for inference")

    # Opponent's cluster: opponent's most recent match before this date (vectorized)
    player_cluster = df[["player", "tourney_date", "player_style_cluster"]].copy()
    player_cluster = player_cluster.rename(columns={"player": "opponent", "tourney_date": "opp_date", "player_style_cluster": "opp_style_cluster"})
    player_cluster = player_cluster.sort_values(["opponent", "opp_date"])
    player_cluster["opp_date"] = pd.to_numeric(player_cluster["opp_date"], errors="coerce").astype(np.int64)
    opp_dates = pd.to_numeric(df["tourney_date"], errors="coerce").astype(np.int64)
    opp_cluster = np.zeros(len(df), dtype=np.int32)
    
    # Vectorized lookup per opponent
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


def _matchup_and_fatigue(df: pd.DataFrame) -> pd.DataFrame:
    """Steps 9–10: serve_vs_return_edge, return_vs_serve_edge, net_edge; days_since_last_match."""
    df["serve_vs_return_edge"] = df["serve_skill"] - df["opp_return_skill"]
    df["return_vs_serve_edge"] = df["return_skill"] - df["opp_serve_skill"]
    df["net_edge"] = df["serve_vs_return_edge"] + df["return_vs_serve_edge"]

    df = df.sort_values(["player", "tourney_date"]).reset_index(drop=True)
    df["match_datetime"] = pd.to_datetime(df["tourney_date"].astype(str), format="%Y%m%d", errors="coerce")
    df["days_since_last_match"] = (
        df.groupby("player")["match_datetime"]
        .diff()
        .dt.days
        .fillna(0)
        .clip(lower=0, upper=365)
        .astype(float)
    )
    return df


def _build_sequences_and_static(
    df: pd.DataFrame,
    train_cutoff: Optional[int],
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, pd.DataFrame]:
    """Steps 11–12: last 10 matches per row → (N,10,F) and static (N,S); drop rows with <10 prior matches."""
    df = df.sort_values(["player", "tourney_date"]).reset_index(drop=True)
    seq_feat_cols = [
        "serve_skill", "return_skill", "spw_diff", "rpw_diff",
        "serve_form_delta", "return_form_delta",
        "surface_Hard", "surface_Clay", "surface_Grass",
        "days_since_last_match", "opp_serve_skill", "opp_return_skill",
    ]
    static_cols = [
        "serve_vs_return_edge", "return_vs_serve_edge", "net_edge",
        "surface_Hard", "surface_Clay", "surface_Grass",
        "player_style_cluster", "opp_style_cluster", "style_matchup",
    ]

    sequences: List[np.ndarray] = []
    masks: List[np.ndarray] = []
    static_list: List[np.ndarray] = []
    labels_list: List[float] = []
    meta_rows: List[dict] = []

    by_player = df.groupby("player", sort=False, group_keys=False)
    for player, grp in by_player:
        grp = grp.sort_values("tourney_date").reset_index(drop=True)
        for i in range(len(grp)):
            if i < SEQ_LEN:
                continue  # need at least SEQ_LEN prior matches
            row = grp.iloc[i]
            past = grp.iloc[i - SEQ_LEN:i]
            seq = past[seq_feat_cols].to_numpy(dtype=np.float32)
            mask = np.ones(SEQ_LEN, dtype=np.float32)
            seq = np.nan_to_num(seq, nan=0.0, posinf=0.0, neginf=0.0)
            sequences.append(seq)
            masks.append(mask)
            st = row[static_cols].to_numpy(dtype=np.float32)
            st = np.nan_to_num(st, nan=0.0, posinf=0.0, neginf=0.0)
            static_list.append(st)
            labels_list.append(float(row["label"]))
            mid = row.get("match_id")
            if pd.isna(mid) or mid == "":
                mid = f"{row['player']}_{row['opponent']}_{row['tourney_date']}"
            meta_rows.append({
                "player": row["player"],
                "opponent": row["opponent"],
                "match_id": mid,
                "tourney_date": int(row["tourney_date"]),
            })

    if not sequences:
        raise ValueError("No rows with >= 10 prior matches; cannot build sequences.")

    sequences_arr = np.stack(sequences, axis=0)
    masks_arr = np.stack(masks, axis=0)
    static_arr = np.stack(static_list, axis=0)
    labels_arr = np.array(labels_list, dtype=np.float32)
    metadata = pd.DataFrame(meta_rows)

    return sequences_arr, static_arr, masks_arr, labels_arr, metadata


class ProLevelPreprocessor:
    """Build pro-level LSTM dataset: (N, 10, F), (N, S), labels with strict anti-leakage."""

    sequence_feature_names = SEQ_FEATURE_NAMES
    static_feature_names = STATIC_FEATURE_NAMES

    def __init__(self, seq_len: int = 10) -> None:
        self.seq_len = seq_len
        self._scaler_seq_mean: Optional[np.ndarray] = None
        self._scaler_seq_std: Optional[np.ndarray] = None
        self._static_scaler: Optional[StandardScaler] = None

    def prepare_dataset(
        self,
        df: pd.DataFrame,
        scaler_dir: Path,
        train_cutoff: Optional[int] = None,
    ) -> PreprocessedDataset:
        """
        Build sequences and static features; fit scalers on train only; return arrays (no NaNs).
        Drops rows where player has < 10 prior matches.
        """
        scaler_dir.mkdir(parents=True, exist_ok=True)

        # Step 1: player-level columns, sort by tourney_date
        working = _to_player_level(df)
        working = _ensure_tourney_date_int(working)
        working = working.sort_values("tourney_date").reset_index(drop=True)

        # Ensure required base columns exist (preprocessed uses ace, 1stIn etc; we added player_*)
        for c in ["player_ace", "player_svpt", "player_1stIn", "player_1stWon", "player_2ndWon",
                  "player_bpSaved", "player_bpFaced", "opp_ace", "opp_svpt", "opp_1stIn",
                  "opp_1stWon", "opp_2ndWon", "opp_bpSaved", "opp_bpFaced"]:
            if c not in working.columns:
                working[c] = 0.0
        if "surface" not in working.columns:
            working["surface"] = "Hard"

        working = _per_match_features(working)
        working = _add_rolling_and_skills(working)
        working = _opponent_skills_asof(working)
        working = _expectation_reality_and_form(working)
        working = _surface_features(working)

        train_mask = np.ones(len(working), dtype=bool)
        if train_cutoff is not None:
            train_mask = working["tourney_date"].to_numpy() <= train_cutoff
        working = _style_clustering(working, train_mask, scaler_dir)
        working = _matchup_and_fatigue(working)

        sequences, static, masks, labels, metadata = _build_sequences_and_static(working, train_cutoff)

        # Fit scalers on train subset of built data (metadata has tourney_date)
        if train_cutoff is not None:
            train_idx = np.where(metadata["tourney_date"].to_numpy() <= train_cutoff)[0]
        else:
            train_idx = np.arange(len(metadata))

        self._scaler_seq_mean = np.nanmean(sequences[train_idx], axis=(0, 1))
        self._scaler_seq_std = np.nanstd(sequences[train_idx], axis=(0, 1))
        self._scaler_seq_std[self._scaler_seq_std == 0] = 1.0
        sequences = (sequences - self._scaler_seq_mean) / self._scaler_seq_std
        sequences = np.nan_to_num(sequences, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)

        self._static_scaler = StandardScaler()
        self._static_scaler.fit(static[train_idx])
        static = self._static_scaler.transform(static)
        static = np.nan_to_num(static, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)

        joblib.dump(self._static_scaler, scaler_dir / "static_scaler.joblib")
        np.savez(
            scaler_dir / "sequence_scaler.npz",
            mean=self._scaler_seq_mean,
            std=self._scaler_seq_std,
        )

        logger.info(
            "[pro_level] Done. N=%d, seq_shape=%s, static_shape=%s",
            len(sequences), sequences.shape, static.shape,
        )
        return PreprocessedDataset(
            sequences=sequences,
            static=static,
            masks=masks.astype(np.float32),
            labels=labels,
            metadata=metadata,
        )
