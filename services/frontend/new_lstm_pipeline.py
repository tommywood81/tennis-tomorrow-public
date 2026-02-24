"""Training entry point for the experimental LSTM strategy."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Tuple

import numpy as np

logger = logging.getLogger(__name__)
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, roc_auc_score
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

ROOT = Path(__file__).resolve().parent
SRC_DIR = ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.append(str(SRC_DIR))

from new_lstm_strategy.config import config as lstm_config  # noqa: E402
from new_lstm_strategy.model import DualBranchLSTM  # noqa: E402
from new_lstm_strategy.preprocessing import LSTMPreprocessor  # noqa: E402
from separate_rolling_10_matches.preprocessing import (  # noqa: E402
    SeparateRollingPreprocessor,
)


def _randomize_player_order(
    sequences: np.ndarray,
    static: np.ndarray,
    masks: np.ndarray,
    labels: np.ndarray,
    metadata: pd.DataFrame,
    seed: int,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, pd.DataFrame]:
    """Randomly swap player/opponent orientation per match to avoid positional bias."""
    rng = np.random.default_rng(seed)
    metadata_reset = metadata.reset_index(drop=True)
    groups = metadata_reset.groupby("match_id").indices

    sequences = sequences.copy()
    static = static.copy()
    masks = masks.copy()
    labels = labels.copy()
    meta_array = metadata_reset.to_numpy(copy=True)

    for idxs in groups.values():
        idxs = list(idxs)
        if len(idxs) != 2:
            continue
        if rng.random() < 0.5:
            i, j = idxs
            sequences[[i, j]] = sequences[[j, i]]
            if static.size:
                static[[i, j]] = static[[j, i]]
            masks[[i, j]] = masks[[j, i]]
            labels[[i, j]] = labels[[j, i]]
            meta_array[[i, j]] = meta_array[[j, i]]

    randomized_metadata = pd.DataFrame(meta_array, columns=metadata_reset.columns)
    return sequences, static, masks, labels, randomized_metadata


def load_or_cache_dataset(
    preprocessor: LSTMPreprocessor,
    cache_path: Path,
    scaler_dir: Path,
    train_cutoff: int,
    force_rebuild: bool = False,
) -> Tuple[
    np.ndarray,
    np.ndarray,
    np.ndarray,
    np.ndarray,
    pd.DataFrame,
    Tuple[str, ...],
    Tuple[str, ...],
]:
    """
    Build (or reuse) preprocessed arrays for the LSTM.

    Parameters
    ----------
    preprocessor:
        Instance of ``LSTMPreprocessor`` configured with desired parameters.
    cache_path:
        Location of the cached dataset (per temporal split).
    scaler_dir:
        Directory where fitted scalers are stored.
    train_cutoff:
        The final year-day (YYYYMMDD) included in the training split.
    force_rebuild:
        When ``True`` the cached dataset is ignored and recomputed from scratch.

    Returns
    -------
    tuple
        ``(sequences, static, masks, labels, metadata)`` ready for model training.
    """
    if cache_path.exists() and not force_rebuild:
        logger.info("[pipeline] Loading from cache: %s", cache_path)
        data = np.load(cache_path, allow_pickle=True)
        required_keys = {"sequence_feature_names", "static_feature_names"}
        if not required_keys.issubset(set(data.files)):
            return load_or_cache_dataset(
                preprocessor,
                cache_path=cache_path,
                scaler_dir=scaler_dir,
                train_cutoff=train_cutoff,
                force_rebuild=True,
            )
        cached_seq_names = tuple(data["sequence_feature_names"].tolist())
        current_seq = preprocessor.sequence_feature_names
        if cached_seq_names != current_seq:
            # Feature set changed; rebuild so shapes and names stay in sync.
            return load_or_cache_dataset(
                preprocessor,
                cache_path=cache_path,
                scaler_dir=scaler_dir,
                train_cutoff=train_cutoff,
                force_rebuild=True,
            )
        metadata = pd.DataFrame(
            data["metadata"].tolist(),
            columns=["player", "opponent", "match_id", "tourney_date"],
        )
        return (
            data["sequences"],
            data["static"],
            data["masks"],
            data["labels"],
            metadata,
            tuple(data["sequence_feature_names"].tolist()),
            tuple(data["static_feature_names"].tolist()),
        )

    logger.info("[pipeline] Loading raw data from %s...", lstm_config.data_path)
    raw_df = (
        pd.read_csv(lstm_config.data_path)
        .sort_values(["tourney_id", "tourney_date", "match_num"])
        .reset_index(drop=True)
    )
    logger.info("[pipeline] Loaded %d rows. Building dataset (sequences + static)...", len(raw_df))
    scaler_dir.mkdir(parents=True, exist_ok=True)
    dataset = preprocessor.prepare_dataset(
        raw_df,
        scaler_dir=scaler_dir,
        train_cutoff=train_cutoff,
    )

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    logger.info("[pipeline] Saving cache to %s...", cache_path)
    np.savez_compressed(
        cache_path,
        sequences=dataset.sequences,
        static=dataset.static,
        masks=dataset.masks,
        labels=dataset.labels,
        metadata=dataset.metadata.to_dict("records"),
        sequence_feature_names=np.array(dataset.sequence_feature_names, dtype=object),
        static_feature_names=np.array(dataset.static_feature_names, dtype=object),
    )
    return (
        dataset.sequences,
        dataset.static,
        dataset.masks,
        dataset.labels,
        dataset.metadata,
        dataset.sequence_feature_names,
        dataset.static_feature_names,
    )


def temporal_split(
    metadata: pd.DataFrame, train_cutoff: int, val_cutoff: int
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Produce boolean index masks for train/validation/test splits."""
    tourney_dates = metadata["tourney_date"].to_numpy()
    train_idx = tourney_dates <= train_cutoff
    val_idx = (tourney_dates > train_cutoff) & (tourney_dates <= val_cutoff)
    test_idx = tourney_dates > val_cutoff
    return train_idx, val_idx, test_idx


def create_dataloader(
    sequences: np.ndarray,
    static: np.ndarray,
    labels: np.ndarray,
    batch_size: int,
    shuffle: bool = True,
) -> DataLoader:
    """Convert numpy arrays to a PyTorch ``DataLoader``."""
    tensor_ds = TensorDataset(
        torch.tensor(sequences, dtype=torch.float32),
        torch.tensor(static, dtype=torch.float32),
        torch.tensor(labels, dtype=torch.float32),
    )
    return DataLoader(tensor_ds, batch_size=batch_size, shuffle=shuffle)


def train_model(args: argparse.Namespace) -> None:
    """Train the DualBranchLSTM using the prepared dataset."""
    if args.test_year not in {"2024", "2025"}:
        raise ValueError("Unsupported test year requested.")

    strategy_suffix = "raw10" if args.raw_rolling else "default"

    if args.test_year == "2025":
        train_cutoff = 20231231  # Train ≤ 2023
        val_cutoff = 20241231  # Validation = 2024
        split_tag = f"split_2025_{strategy_suffix}"
    else:
        train_cutoff = lstm_config.train_cutoff
        val_cutoff = lstm_config.val_cutoff
        split_tag = f"split_2024_{strategy_suffix}"

    artifacts_dir = lstm_config.artifacts_root / split_tag
    cache_path = artifacts_dir / "dataset_cache.npz"
    scaler_dir = artifacts_dir / "scalers"
    best_model_path = artifacts_dir / "best_model.pt"

    device = torch.device(
        lstm_config.device
        if torch.cuda.is_available() and lstm_config.device == "cuda"
        else "cpu"
    )
    if args.raw_rolling:
        preprocessor = SeparateRollingPreprocessor(seq_len=10)
    else:
        preprocessor = LSTMPreprocessor(
            seq_len=lstm_config.seq_len,
            half_life=lstm_config.half_life,
            include_tourney_level=lstm_config.include_tourney_level,
            include_round=lstm_config.include_round,
        )
    (
        sequences,
        static,
        masks,
        labels,
        metadata,
        sequence_feature_names,
        static_feature_names,
    ) = load_or_cache_dataset(
        preprocessor,
        cache_path=cache_path,
        scaler_dir=scaler_dir,
        train_cutoff=train_cutoff,
        force_rebuild=args.rebuild,
    )

    if args.random_order:
        seed = args.seed if args.seed is not None else lstm_config.random_seed
        sequences, static, masks, labels, metadata = _randomize_player_order(
            sequences,
            static,
            masks,
            labels,
            metadata,
            seed=seed,
        )

    train_idx, val_idx, test_idx = temporal_split(metadata, train_cutoff, val_cutoff)

    train_loader = create_dataloader(
        sequences[train_idx],
        static[train_idx],
        labels[train_idx],
        lstm_config.batch_size,
    )
    val_loader = create_dataloader(
        sequences[val_idx],
        static[val_idx],
        labels[val_idx],
        lstm_config.batch_size,
        shuffle=False,
    )
    test_loader = create_dataloader(
        sequences[test_idx],
        static[test_idx],
        labels[test_idx],
        lstm_config.batch_size,
        shuffle=False,
    )

    model = DualBranchLSTM(
        seq_input_dim=sequences.shape[-1],
        static_input_dim=static.shape[-1],
        lstm_hidden=lstm_config.lstm_hidden,
        lstm_layers=lstm_config.lstm_layers,
        dropout=lstm_config.dropout,
    ).to(device)

    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lstm_config.learning_rate)

    best_auc = -np.inf
    patience_counter = 0
    best_model_path.parent.mkdir(parents=True, exist_ok=True)
    
    if args.dry_run:
        print("="*70)
        print("DRY RUN MODE: Model weights will NOT be saved")
        print(f"  Would save to: {best_model_path}")
        print("="*70)
        print()

    for epoch in range(1, lstm_config.epochs + 1):
        model.train()
        total_loss = 0.0
        for seq_batch, static_batch, label_batch in train_loader:
            seq_batch = seq_batch.to(device)
            static_batch = static_batch.to(device)
            label_batch = label_batch.to(device)

            optimizer.zero_grad()
            logits = model(seq_batch, static_batch)
            loss = criterion(logits, label_batch)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(seq_batch)

        avg_loss = total_loss / len(train_loader.dataset)
        val_auc = evaluate(model, val_loader, device)
        print(
            f"Epoch {epoch}/{lstm_config.epochs} - Loss: {avg_loss:.4f} - Val AUC: {val_auc:.4f}"
        )

        if val_auc > best_auc:
            best_auc = val_auc
            patience_counter = 0
            if not args.dry_run:
                torch.save(model.state_dict(), best_model_path)
        else:
            patience_counter += 1
            if patience_counter >= lstm_config.patience:
                print("Early stopping triggered!")
                break

    if args.dry_run:
        print(f"\n{'='*70}")
        print("DRY RUN MODE: Model weights NOT saved")
        print(f"  Would save to: {best_model_path}")
        print(f"  Best validation AUC: {best_auc:.4f}")
        print("  Skipping final test evaluation (no saved model to load)")
        print(f"{'='*70}\n")
    else:
        model.load_state_dict(torch.load(best_model_path, map_location=device))
        test_auc = evaluate(model, test_loader, device, report_accuracy=True)
        print(f"Test AUC: {test_auc:.4f}")


def evaluate(
    model: DualBranchLSTM,
    dataloader: DataLoader,
    device: torch.device,
    report_accuracy: bool = False,
) -> float:
    """
    Evaluate the model on a dataloader, returning ROC-AUC.

    Parameters
    ----------
    model:
        Trained ``DualBranchLSTM`` instance.
    dataloader:
        DataLoader providing (sequence, static, label) batches.
    device:
        PyTorch device where inference should run.
    report_accuracy:
        When ``True`` prints accuracy in addition to returning AUC.
    """
    model.eval()
    all_probs: list[np.ndarray] = []
    all_labels: list[np.ndarray] = []
    with torch.no_grad():
        for seq_batch, static_batch, label_batch in dataloader:
            seq_batch = seq_batch.to(device)
            static_batch = static_batch.to(device)
            logits = model(seq_batch, static_batch)
            probs = torch.sigmoid(logits).cpu().numpy()
            all_probs.append(probs)
            all_labels.append(label_batch.numpy())

    probs = np.concatenate(all_probs)
    labels = np.concatenate(all_labels)
    auc = roc_auc_score(labels, probs)

    if report_accuracy:
        preds = (probs >= 0.5).astype(int)
        accuracy = accuracy_score(labels, preds)
        print(f"Test Accuracy: {accuracy:.4f}")

    return auc


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments for the training script."""
    parser = argparse.ArgumentParser(description="Train the experimental LSTM pipeline.")
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Rebuild cached dataset from scratch.",
    )
    parser.add_argument(
        "--test-year",
        choices=("2024", "2025"),
        default="2024",
        help="Temporal split to use for evaluation (default: 2024 test year).",
    )
    parser.add_argument(
        "--raw-rolling",
        action="store_true",
        help="Use raw serve/return percentages for the last 10 matches as the only features.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed used for player-order randomization (default: config value).",
    )
    parser.add_argument(
        "--disable-random-order",
        action="store_true",
        help="Disable random shuffling of player/opponent order per match.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run training without saving model weights. Prints metrics and model path that would be used.",
    )
    args = parser.parse_args()
    args.random_order = not args.disable_random_order
    return args


if __name__ == "__main__":
    ARGS = parse_args()
    train_model(ARGS)
