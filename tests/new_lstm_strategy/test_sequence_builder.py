import os
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Ensure src/ is on path for direct test invocation
ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "src"
if str(SRC_DIR) not in os.sys.path:
    os.sys.path.append(str(SRC_DIR))

from new_lstm_strategy.sequence_builder import (
    SequenceFeatureBuilder,
    SEQUENCE_FEATURE_NAMES_SHORT_MEDIUM,
    decay_weights,
)


DATA_PATH = Path("data/processed/preprocessed_data.csv")


def _load_preprocessed_subset(max_rows: int = 5000) -> pd.DataFrame:
    if not DATA_PATH.exists():
        pytest.skip(f"required dataset not found: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    df = df.sort_values("tourney_date").head(max_rows).reset_index(drop=True)
    return df


def test_decay_weights_sum_to_one():
    weights = decay_weights(seq_len=10, half_life=3.0)
    assert pytest.approx(weights.sum(), rel=1e-6) == 1.0
    assert weights[-1] > weights[0], "newest timestep should have highest weight"


def test_sequence_builder_output_shapes():
    df = _load_preprocessed_subset()
    builder = SequenceFeatureBuilder(seq_len=10, half_life=3.0)
    augmented_df, samples = builder.build(df)

    assert "sequence_features" in augmented_df.columns
    assert "sequence_mask" in augmented_df.columns
    assert len(augmented_df) == len(df) == len(samples)

    # Find first sample with full history
    full_history_idx = next(
        (
            idx
            for idx, mask in enumerate(augmented_df["sequence_mask"])
            if np.sum(mask) == builder.seq_len
        ),
        None,
    )
    assert full_history_idx is not None, "expected at least one sample with full history"

    seq = augmented_df.iloc[full_history_idx]["sequence_features"]
    mask = augmented_df.iloc[full_history_idx]["sequence_mask"]
    assert seq.shape == (builder.seq_len, len(SEQUENCE_FEATURE_NAMES_SHORT_MEDIUM)), (
        f"expected (seq_len, {len(SEQUENCE_FEATURE_NAMES_SHORT_MEDIUM)})"
    )
    assert mask.shape == (builder.seq_len,)
    assert mask[-1] == 1.0
    # surface_idx is index 3 (serve short, medium, opp_rank, surface, days, form_delta_serve)
    assert seq[-1, 3] >= 0 and seq[-1, 3] <= 4, "surface_idx should be in [0,4]"
    assert seq[-1, 5] == seq[-1, 0] - seq[-1, 1], "form_delta_serve = short - medium"


def test_sequence_builder_padding_for_first_matches():
    df = _load_preprocessed_subset()
    builder = SequenceFeatureBuilder(seq_len=10, half_life=3.0)
    augmented_df, _ = builder.build(df)

    first_sample = augmented_df.iloc[0]
    mask = first_sample["sequence_mask"]
    assert np.sum(mask) == 0, "first appearance of player should have no history"
    assert np.allclose(first_sample["sequence_features"], 0.0)


