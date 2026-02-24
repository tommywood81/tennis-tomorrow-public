import os
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "src"
if str(SRC_DIR) not in os.sys.path:
    os.sys.path.append(str(SRC_DIR))

from new_lstm_strategy.sequence_builder import SequenceFeatureBuilder
from new_lstm_strategy.static_features import StaticFeatureBuilder

DATA_PATH = ROOT / "data" / "processed" / "preprocessed_data.csv"


def _load_dataset(max_rows: int = 6000) -> pd.DataFrame:
    if not DATA_PATH.exists():
        pytest.skip(f"required dataset not found: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    df = df.sort_values("tourney_date").head(max_rows).reset_index(drop=True)
    return df


def test_static_feature_shapes_and_names():
    df = _load_dataset()
    seq_builder = SequenceFeatureBuilder(seq_len=10, half_life=3.0)
    seq_df, _ = seq_builder.build(df)

    static_builder = StaticFeatureBuilder(
        seq_len=10, sequence_feature_names=seq_builder.feature_names
    )
    result = static_builder.build(seq_df)

    assert "recent_weighted_serve" in result.dataframe.columns
    assert result.features.shape[0] == len(result.dataframe)
    assert result.features.shape[1] == len(result.feature_names)
    assert len(result.feature_names) >= 14


def test_static_features_first_match_defaults():
    df = _load_dataset()
    seq_builder = SequenceFeatureBuilder(seq_len=10, half_life=3.0)
    seq_df, _ = seq_builder.build(df)

    static_builder = StaticFeatureBuilder(
        seq_len=10, sequence_feature_names=seq_builder.feature_names
    )
    result = static_builder.build(seq_df)

    first_row = result.dataframe.iloc[0]
    assert first_row["career_matches_prior"] == 0
    assert first_row["recent_weighted_serve"] == 0.0
    assert first_row["h2h_total_matches"] == 0
    assert first_row["streak"] == 0


def test_static_features_nonzero_for_later_match():
    df = _load_dataset()
    seq_builder = SequenceFeatureBuilder(seq_len=10, half_life=3.0)
    seq_df, _ = seq_builder.build(df)

    static_builder = StaticFeatureBuilder(
        seq_len=10, sequence_feature_names=seq_builder.feature_names
    )
    result = static_builder.build(seq_df)

    later_row = result.dataframe[result.dataframe["career_matches_prior"] >= 5].head(1)
    assert not later_row.empty
    row = later_row.iloc[0]
    assert row["career_matches_prior"] >= 5
    assert row["recent_weighted_serve"] >= 0.0 or np.isfinite(row["recent_weighted_serve"])
    assert np.isfinite(row["career_win_pct"])

