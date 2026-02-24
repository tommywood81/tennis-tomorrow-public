"""
Preprocessing utilities for the experimental LSTM pipeline.

Combines sequence and static feature builders, fits normalization parameters
on the training split, and returns numpy arrays ready for model ingestion.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from .sequence_builder import SequenceFeatureBuilder

logger = logging.getLogger(__name__)
from .static_features import StaticFeatureBuilder, StaticFeatureResult
from separate_rolling_10_matches.sequence_builder import (
    SeparateRollingSequenceBuilder,
    SequenceResult as SeparateSequenceResult,
)

try:
    from bookmaker.features import build_bookmaker_features, BOOKMAKER_FEATURE_NAMES
except ImportError:
    build_bookmaker_features = None
    BOOKMAKER_FEATURE_NAMES = ()


@dataclass
class PreprocessedDataset:
    sequences: np.ndarray  # (N, seq_len, feature_dim)
    static: np.ndarray  # (N, F_static)
    masks: np.ndarray  # (N, seq_len)
    labels: np.ndarray  # (N,)
    metadata: pd.DataFrame  # columns: player, opponent, match_id, tourney_date
    sequence_feature_names: Tuple[str, ...]
    static_feature_names: Tuple[str, ...]


class LSTMPreprocessor:
    """Create sequence/static features and normalize them for training."""

    # win_flag REMOVED: outcome of past matches caused overfitting and inflated underdog backtest
    RAW_SEQUENCE_FEATURE_NAMES: Tuple[str, ...] = (
        "raw_serve_pct",
        "raw_serve_diff_prev_year",
        "raw_player_rank_norm",
        "raw_opponent_rank_norm",
    )

    # Indices to scale: base (0,1,2,4,5 excluding surface_idx 3) + raw (6,7,8,9)
    _SEQUENCE_NUMERIC_IDX: Tuple[int, ...] = (0, 1, 2, 4, 5, 6, 7, 8, 9)
    # Bookmaker: 5 base + 3 new EWM + 2 raw = 10; scale numeric excluding surface_idx (2)
    # Features: 0=adj_serve_short, 1=adj_serve_medium, 2=surface_idx (skip), 3=days, 4=form_delta,
    #           5=rpw_adj_last10, 6=rpw_adj_last3, 7=net_skill_last10
    # Raw: 8=raw_serve_pct, 9=raw_serve_diff_prev_year
    _SEQUENCE_NUMERIC_IDX_BOOKMAKER: Tuple[int, ...] = (0, 1, 3, 4, 5, 6, 7, 8, 9)
    _SEQUENCE_NUMERIC_IDX_BOOKMAKER_NO_RAW: Tuple[int, ...] = (0, 1, 3, 4, 5, 6, 7)  # 8 features, no raw

    def __init__(
        self,
        seq_len: int = 10,
        half_life: float = 3.0,
        include_tourney_level: bool = True,
        include_round: bool = True,
        use_bookmaker: bool = False,
        use_raw_sequence: bool = True,
    ) -> None:
        self.seq_len = seq_len
        self.use_bookmaker = use_bookmaker and (build_bookmaker_features is not None)
        self.use_raw_sequence = use_raw_sequence
        self.sequence_builder = SequenceFeatureBuilder(
            seq_len=seq_len,
            half_life=half_life,
            include_tourney_level=include_tourney_level,
            include_round=include_round,
            use_rank=not self.use_bookmaker,
        )
        self.sequence_feature_names: Tuple[str, ...] = self.sequence_builder.feature_names
        self.sequence_numeric_idx: Tuple[int, ...] = (
            self._SEQUENCE_NUMERIC_IDX_BOOKMAKER_NO_RAW
            if (self.use_bookmaker and not self.use_raw_sequence)
            else (self._SEQUENCE_NUMERIC_IDX_BOOKMAKER if self.use_bookmaker else self._SEQUENCE_NUMERIC_IDX)
        )
        self.raw_sequence_builder = SeparateRollingSequenceBuilder(
            seq_len=seq_len, use_rank=not self.use_bookmaker
        )
        self.static_builder = StaticFeatureBuilder(
            seq_len=seq_len,
            sequence_feature_names=self.sequence_feature_names,
        )
        self._seq_mean: Optional[np.ndarray] = None
        self._seq_std: Optional[np.ndarray] = None
        self._static_scaler: Optional[StandardScaler] = None
        if self.use_bookmaker:
            self.RAW_SEQUENCE_FEATURE_NAMES = (
                () if not self.use_raw_sequence
                else ("raw_serve_pct", "raw_serve_diff_prev_year")
            )
        else:
            self.RAW_SEQUENCE_FEATURE_NAMES = (
                "raw_serve_pct",
                "raw_serve_diff_prev_year",
                "raw_player_rank_norm",
                "raw_opponent_rank_norm",
            )

    def prepare_dataset(
        self,
        df: pd.DataFrame,
        scaler_dir: Path,
        train_cutoff: Optional[int] = None,
    ) -> PreprocessedDataset:
        """
        Build sequence/static features, fit scalers on training split, and return arrays.

        Args:
            df: Dual-perspective match table (output of preprocess pipeline).
            scaler_dir: Directory where fitted scalers will be stored.
            train_cutoff: If provided, rows with ``tourney_date`` <= cutoff define
                the training subset used to fit normalization parameters. Otherwise
                the entire dataset is used.
        """
        scaler_dir.mkdir(parents=True, exist_ok=True)

        if self.use_bookmaker:
            logger.info("[preprocess] Building bookmaker features (no rank)...")
            df_bm = build_bookmaker_features(df)
            keys = ["player", "opponent", "match_id", "tourney_date"]
            # Merge bookmaker features including adj_spw, adj_rpw, net_skill for sequence builder
            merged = df.merge(
                df_bm[keys + ["opp_return_strength", "adj_spw", "adj_rpw", "net_skill"] + list(BOOKMAKER_FEATURE_NAMES)],
                on=keys,
                how="left",
            )
            df_for_seq = merged
        else:
            df_bm = None
            merged = None
            df_for_seq = df

        logger.info("[preprocess] Building main sequence features...")
        seq_df, _ = self.sequence_builder.build(df_for_seq)
        if self.use_raw_sequence:
            logger.info("[preprocess] Building raw rolling sequence...")
            raw_sequence_result: SeparateSequenceResult = self.raw_sequence_builder.build(seq_df)
        else:
            raw_sequence_result = None
        if self.use_bookmaker and merged is not None:
            logger.info("[preprocess] Using bookmaker static features (%d)...", len(BOOKMAKER_FEATURE_NAMES))
            keys = ["player", "opponent", "match_id", "tourney_date"]
            # One row per key so merge with seq_df is 1:1 (merged can have duplicates from dual-perspective)
            merged_dedup = merged[keys + list(BOOKMAKER_FEATURE_NAMES)].drop_duplicates(subset=keys, keep="first")
            order_col = np.arange(len(seq_df))
            static_merged = seq_df[keys].copy()
            static_merged["_ord"] = order_col
            static_merged = static_merged.merge(merged_dedup, on=keys, how="left")
            static_merged = static_merged.sort_values("_ord")
            static_features = static_merged[list(BOOKMAKER_FEATURE_NAMES)].to_numpy(dtype=np.float32)
            working = seq_df
        else:
            logger.info("[preprocess] Building static features...")
            static_result = self.static_builder.build(seq_df)
            working = static_result.dataframe
            static_features = static_result.features

        base_sequences = np.stack(working["sequence_features"].to_numpy())
        masks = np.stack(working["sequence_mask"].to_numpy())
        if self.use_raw_sequence and raw_sequence_result is not None:
            raw_sequences = np.stack(raw_sequence_result.dataframe["sequence_features"].to_numpy())
            raw_masks = np.stack(raw_sequence_result.dataframe["sequence_mask"].to_numpy())
            if not np.array_equal(masks, raw_masks):
                raise ValueError("Mask mismatch between primary and raw sequence builders.")
            combined_sequences = np.concatenate([base_sequences, raw_sequences], axis=2)
        else:
            combined_sequences = base_sequences
        labels = working["label"].to_numpy(dtype=np.float32)

        metadata = working[["player", "opponent", "match_id", "tourney_date"]].copy()
        metadata["tourney_date"] = metadata["tourney_date"].astype(int)

        if train_cutoff is None:
            train_mask = np.ones(len(working), dtype=bool)
        else:
            train_mask = working["tourney_date"] <= train_cutoff

        logger.info(
            "[preprocess] Fitting sequence scaler (base + raw, train rows=%d)...",
            train_mask.sum(),
        )
        self._fit_sequence_scaler(combined_sequences[train_mask], masks[train_mask])
        logger.info("[preprocess] Fitting static scaler...")
        self._fit_static_scaler(static_features[train_mask])

        combined_sequences = self._transform_sequences(combined_sequences.copy(), masks)
        static_scaled = self._static_scaler.transform(static_features)

        logger.info("[preprocess] Saving scalers...")
        self._save_scalers(scaler_dir)

        sequence_feature_names = self.sequence_feature_names + self.RAW_SEQUENCE_FEATURE_NAMES
        static_feature_names = (
            tuple(BOOKMAKER_FEATURE_NAMES) if self.use_bookmaker else tuple(static_result.feature_names)
        )
        logger.info(
            "[preprocess] Done. N=%d samples, seq_dim=%d, static_dim=%d",
            len(working),
            combined_sequences.shape[-1],
            static_features.shape[-1],
        )

        return PreprocessedDataset(
            sequences=combined_sequences.astype(np.float32),
            static=static_scaled.astype(np.float32),
            masks=masks.astype(np.float32),
            labels=labels,
            metadata=metadata.reset_index(drop=True),
            sequence_feature_names=sequence_feature_names,
            static_feature_names=static_feature_names,
        )

    def _fit_sequence_scaler(self, sequences: np.ndarray, masks: np.ndarray) -> None:
        numeric_features = self.sequence_numeric_idx
        valid_mask = masks > 0
        means = []
        stds = []
        for feature_idx in numeric_features:
            feature_vals = sequences[:, :, feature_idx][valid_mask]
            if feature_vals.size == 0:
                means.append(0.0)
                stds.append(1.0)
            else:
                mean = float(feature_vals.mean())
                std = float(feature_vals.std())
                if std == 0.0:
                    std = 1.0
                means.append(mean)
                stds.append(std)
        self._seq_mean = np.array(means, dtype=np.float32)
        self._seq_std = np.array(stds, dtype=np.float32)

    def _fit_static_scaler(self, static_features: np.ndarray) -> None:
        scaler = StandardScaler()
        scaler.fit(static_features)
        self._static_scaler = scaler

    def _transform_sequences(self, sequences: np.ndarray, masks: np.ndarray) -> np.ndarray:
        if self._seq_mean is None or self._seq_std is None:
            raise RuntimeError("Sequence scaler has not been fit.")
        valid_mask = masks > 0
        for idx, feature_idx in enumerate(self.sequence_numeric_idx):
            values = sequences[:, :, feature_idx]
            values_valid = values[valid_mask]
            values[valid_mask] = (values_valid - self._seq_mean[idx]) / self._seq_std[idx]
            sequences[:, :, feature_idx] = values
        return sequences

    def _save_scalers(self, scaler_dir: Path) -> None:
        if self._seq_mean is None or self._seq_std is None or self._static_scaler is None:
            raise RuntimeError("Cannot save scalers before fit.")
        full_seq_names = self.sequence_feature_names + self.RAW_SEQUENCE_FEATURE_NAMES
        np.savez(
            scaler_dir / "sequence_scaler.npz",
            mean=self._seq_mean,
            std=self._seq_std,
            numeric_idx=np.array(self.sequence_numeric_idx, dtype=np.int32),
            feature_names=np.array(full_seq_names),
        )
        joblib.dump(self._static_scaler, scaler_dir / "static_scaler.joblib")

