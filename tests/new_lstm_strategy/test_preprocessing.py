import os
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "src"
if str(SRC_DIR) not in os.sys.path:
    os.sys.path.append(str(SRC_DIR))

from new_lstm_strategy.preprocessing import LSTMPreprocessor

DATA_PATH = ROOT / "data" / "processed" / "preprocessed_data.csv"


def _load_dataset(max_rows: int = 8000) -> pd.DataFrame:
    if not DATA_PATH.exists():
        pytest.skip(f"required dataset not found: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    df = df.sort_values("tourney_date").head(max_rows).reset_index(drop=True)
    return df


def test_prepare_dataset_outputs(tmp_path):
    df = _load_dataset()
    preprocessor = LSTMPreprocessor(seq_len=10, half_life=3.0)
    dataset = preprocessor.prepare_dataset(
        df,
        scaler_dir=tmp_path,
        train_cutoff=20220101,
    )

    assert dataset.sequences.shape[0] == len(dataset.metadata)
    assert dataset.static.shape[1] > 20

    seq_scaler_file = tmp_path / "sequence_scaler.npz"
    static_scaler_file = tmp_path / "static_scaler.joblib"
    assert seq_scaler_file.exists()
    assert static_scaler_file.exists()


def test_sequence_scaling_zero_mean(tmp_path):
    df = _load_dataset()
    preprocessor = LSTMPreprocessor(seq_len=10, half_life=3.0)
    dataset = preprocessor.prepare_dataset(
        df,
        scaler_dir=tmp_path,
        train_cutoff=20200101,
    )

    train_mask = dataset.metadata["tourney_date"] <= 20200101
    sequences = dataset.sequences[train_mask]
    masks = dataset.masks[train_mask]

    numeric_idx = preprocessor.sequence_numeric_idx
    means = []
    for idx in numeric_idx:
        values = sequences[:, :, idx][masks > 0]
        if values.size:
            means.append(values.mean())
    assert np.allclose(means, 0.0, atol=1e-2)


def test_static_scaling_zero_mean(tmp_path):
    df = _load_dataset()
    preprocessor = LSTMPreprocessor(seq_len=10, half_life=3.0)
    dataset = preprocessor.prepare_dataset(
        df,
        scaler_dir=tmp_path,
        train_cutoff=20210101,
    )

    train_mask = dataset.metadata["tourney_date"] <= 20210101
    static_train = dataset.static[train_mask]
    means = static_train.mean(axis=0)
    assert np.allclose(means, 0.0, atol=1e-2)

