import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest
import torch
from torch.utils.data import DataLoader, TensorDataset

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.append(str(SRC))

from new_lstm_strategy.sequence_builder import SequenceFeatureBuilder
from new_lstm_strategy.static_features import StaticFeatureBuilder
from new_lstm_strategy.preprocessing import LSTMPreprocessor
from new_lstm_strategy.config import config as lstm_config
from new_lstm_strategy.model import DualBranchLSTM

DATA_PATH = ROOT / "data" / "processed" / "preprocessed_data.csv"


def _load_raw_dataframe(limit: int = 6000) -> pd.DataFrame:
    if not DATA_PATH.exists():
        pytest.skip(f"required dataset not found: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    df = df.sort_values(["tourney_id", "tourney_date", "match_num"]).head(limit).reset_index(drop=True)
    return df


def test_static_features_use_only_prior_matches():
    df = _load_raw_dataframe()
    seq_builder = SequenceFeatureBuilder(seq_len=lstm_config.seq_len, half_life=lstm_config.half_life)
    seq_df, _ = seq_builder.build(df)
    static_result = StaticFeatureBuilder(seq_len=lstm_config.seq_len).build(seq_df)
    working = static_result.dataframe.reset_index(drop=True)

    expected_matches = working.groupby(["player", "opponent"]).cumcount()
    expected_wins = (
        working.groupby(["player", "opponent"])["label"].cumsum().shift(1).fillna(0.0)
    )
    assert np.allclose(working["h2h_total_matches"], expected_matches)
    assert np.allclose(working["h2h_total_wins"], expected_wins)


def test_lstm_generalization_gap(tmp_path):
    df = _load_raw_dataframe(limit=40000)
    preprocessor = LSTMPreprocessor(seq_len=lstm_config.seq_len, half_life=lstm_config.half_life)
    dataset = preprocessor.prepare_dataset(df, scaler_dir=tmp_path / "scalers", train_cutoff=lstm_config.train_cutoff)

    sequences = dataset.sequences
    static = dataset.static
    labels = dataset.labels
    metadata = dataset.metadata

    train_idx = metadata["tourney_date"] <= lstm_config.train_cutoff
    val_idx = (metadata["tourney_date"] > lstm_config.train_cutoff) & (metadata["tourney_date"] <= lstm_config.val_cutoff)
    test_idx = metadata["tourney_date"] > lstm_config.val_cutoff

    if val_idx.sum() == 0 or test_idx.sum() == 0:
        pytest.skip("Insufficient validation/test samples for generalization gap check.")

    def make_loader(idx, shuffle=False):
        ds = TensorDataset(
            torch.tensor(sequences[idx], dtype=torch.float32),
            torch.tensor(static[idx], dtype=torch.float32),
            torch.tensor(labels[idx], dtype=torch.float32),
        )
        return DataLoader(ds, batch_size=lstm_config.batch_size, shuffle=shuffle)

    device = torch.device("cuda" if torch.cuda.is_available() and lstm_config.device == "cuda" else "cpu")
    model = DualBranchLSTM(
        sequences.shape[-1],
        static.shape[-1],
        lstm_config.lstm_hidden,
        lstm_config.lstm_layers,
        lstm_config.dropout,
    ).to(device)

    criterion = torch.nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lstm_config.learning_rate)

    best_state = None
    best_val_auc = -np.inf
    patience_counter = 0

    def evaluate(model, loader):
        model.eval()
        all_probs = []
        all_labels = []
        with torch.no_grad():
            for seq_batch, static_batch, label_batch in loader:
                seq_batch, static_batch = seq_batch.to(device), static_batch.to(device)
                probs = torch.sigmoid(model(seq_batch, static_batch)).cpu().numpy()
                all_probs.append(probs)
                all_labels.append(label_batch.numpy())
        probs = np.concatenate(all_probs)
        labels_np = np.concatenate(all_labels)
        positives = labels_np.sum()
        negatives = len(labels_np) - positives
        if positives == 0 or negatives == 0:
            return 0.5
        from sklearn.metrics import roc_auc_score
        return roc_auc_score(labels_np, probs)

    train_loader = make_loader(train_idx, shuffle=True)
    val_loader = make_loader(val_idx, shuffle=False)
    test_loader = make_loader(test_idx, shuffle=False)

    for epoch in range(lstm_config.epochs):
        model.train()
        for seq_batch, static_batch, label_batch in train_loader:
            seq_batch = seq_batch.to(device)
            static_batch = static_batch.to(device)
            label_batch = label_batch.to(device)
            optimizer.zero_grad()
            logits = model(seq_batch, static_batch)
            loss = criterion(logits, label_batch)
            loss.backward()
            optimizer.step()

        val_auc = evaluate(model, val_loader)
        if val_auc > best_val_auc:
            best_val_auc = val_auc
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= lstm_config.patience:
                break

    assert best_state is not None
    model.load_state_dict(best_state)

    train_auc = evaluate(model, train_loader)
    val_auc = evaluate(model, val_loader)
    test_auc = evaluate(model, test_loader)

    assert train_auc - val_auc < 0.05
    assert train_auc - test_auc < 0.05

