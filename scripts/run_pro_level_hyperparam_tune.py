"""
Pro-level LSTM hyperparameter tuning: broad sweep on 2023 val, then fine sweep.
Train <= 2022, validate 2023, test 2024+2025.
Freeze best params and report test metrics.
"""

from __future__ import annotations

import json
import logging
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "src"
for p in [str(ROOT), str(SRC_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from new_lstm_pipeline import load_or_cache_dataset, lstm_config, temporal_split
from pro_level_strategy import ProLevelPreprocessor
from scripts.run_lstm_training_plan import SplitConfig, _train_split

RESULTS_DIR = ROOT / "experiments" / "results"
TUNE_RESULTS_PATH = RESULTS_DIR / "lstm_pro_level_hyperparam_tune.json"
EPOCHS = 6
PATIENCE = 3

# Split: train <= 2022, val 2023, test 2024+2025
TUNE_SPLIT = SplitConfig(
    name="pro_level_tune",
    train_cutoff=20221231,
    val_cutoff=20231231,
    description="Train <=2022, validate 2023, test 2024+2025",
    cache_tag="split_pro_level_2024_2025",
)


def run_one_trial(
    sequences: np.ndarray,
    static: np.ndarray,
    labels: np.ndarray,
    metadata: pd.DataFrame,
    artifacts_dir: Path,
    lr: float,
    lstm_hidden: int,
    lstm_layers: int,
    dropout: float,
    batch_size: int,
    epochs: int = EPOCHS,
    patience: int = PATIENCE,
) -> Dict[str, Any]:
    """Train one config; return metrics (validation + test match-level)."""
    metrics = _train_split(
        TUNE_SPLIT,
        sequences,
        static,
        labels,
        metadata,
        artifacts_dir,
        raw_rolling=False,
        mode="pro_level_tune",
        include_test=True,
        dry_run=True,  # Don't save model during tuning
        epochs_override=epochs,
        patience_override=patience,
        learning_rate_override=lr,
        lstm_hidden_override=lstm_hidden,
        lstm_layers_override=lstm_layers,
        dropout_override=dropout,
        batch_size_override=batch_size,
    )
    return metrics


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
        force=True,
    )
    logger = logging.getLogger(__name__)

    logger.info("=== Pro-level LSTM Hyperparameter Tuning ===")
    logger.info("Train <= 2022, Validate 2023, Test 2024+2025\n")

    # Load dataset
    artifacts_dir = lstm_config.artifacts_root / TUNE_SPLIT.cache_tag
    cache_path = artifacts_dir / "dataset_cache.npz"
    scaler_dir = artifacts_dir / "scalers"

    preprocessor = ProLevelPreprocessor(seq_len=10)
    sequences, static, masks, labels, metadata, seq_names, static_names = load_or_cache_dataset(
        preprocessor,
        cache_path=cache_path,
        scaler_dir=scaler_dir,
        train_cutoff=TUNE_SPLIT.train_cutoff,
        force_rebuild=False,
    )
    logger.info("Loaded: seq_shape=%s static_shape=%s", sequences.shape, static.shape)

    train_idx, val_idx, test_idx = temporal_split(
        metadata,
        TUNE_SPLIT.train_cutoff,
        TUNE_SPLIT.val_cutoff,
    )

    # --- Broad sweep (8 configs) ---
    broad_grid = [
        {"learning_rate": 1e-3, "lstm_hidden": 64, "lstm_layers": 1, "dropout": 0.2, "batch_size": 128},
        {"learning_rate": 1e-3, "lstm_hidden": 128, "lstm_layers": 1, "dropout": 0.2, "batch_size": 128},
        {"learning_rate": 1e-3, "lstm_hidden": 256, "lstm_layers": 1, "dropout": 0.2, "batch_size": 128},
        {"learning_rate": 2e-3, "lstm_hidden": 64, "lstm_layers": 1, "dropout": 0.2, "batch_size": 128},
        {"learning_rate": 2e-3, "lstm_hidden": 128, "lstm_layers": 1, "dropout": 0.2, "batch_size": 128},
        {"learning_rate": 1e-3, "lstm_hidden": 128, "lstm_layers": 2, "dropout": 0.2, "batch_size": 128},
        {"learning_rate": 1e-3, "lstm_hidden": 128, "lstm_layers": 1, "dropout": 0.3, "batch_size": 128},
        {"learning_rate": 2e-3, "lstm_hidden": 128, "lstm_layers": 2, "dropout": 0.25, "batch_size": 128},
    ]

    logger.info("Broad sweep: %d configs, %d epochs, patience=%d", len(broad_grid), EPOCHS, PATIENCE)
    broad_results: List[Dict[str, Any]] = []
    best_val_auc = -np.inf
    best_broad: Optional[Dict[str, Any]] = None

    for i, hp in enumerate(broad_grid):
        logger.info("Broad trial %d/%d: lr=%.0e hidden=%d layers=%d drop=%.2f bs=%d",
                    i + 1, len(broad_grid), hp["learning_rate"], hp["lstm_hidden"],
                    hp["lstm_layers"], hp["dropout"], hp["batch_size"])
        try:
            m = run_one_trial(
                sequences, static, labels, metadata, artifacts_dir,
                lr=hp["learning_rate"],
                lstm_hidden=hp["lstm_hidden"],
                lstm_layers=hp["lstm_layers"],
                dropout=hp["dropout"],
                batch_size=hp["batch_size"],
                epochs=EPOCHS,
                patience=PATIENCE,
            )
        except Exception as e:
            logger.warning("Trial failed: %s", e)
            broad_results.append({**hp, "val_auc": float("nan"), "error": str(e)})
            continue
        val_auc = m.get("validation", {}).get("auc", float("-inf"))
        test_match_acc = m.get("test", {}).get("match_accuracy")
        broad_results.append({
            **hp,
            "val_auc": val_auc,
            "val_accuracy": m.get("validation", {}).get("accuracy"),
            "match_accuracy": test_match_acc,
            "test_2024_accuracy": m.get("test", {}).get("test_2024_accuracy"),
            "test_2025_accuracy": m.get("test", {}).get("test_2025_accuracy"),
        })
        if val_auc > best_val_auc:
            best_val_auc = val_auc
            best_broad = broad_results[-1]
            logger.info("New best val AUC: %.4f (test match acc: %s)", val_auc,
                        f"{test_match_acc:.2%}" if test_match_acc is not None else "N/A")

    if best_broad is None:
        logger.error("No successful broad trial.")
        sys.exit(1)

    # --- Fine sweep around best ---
    lr0 = best_broad["learning_rate"]
    h0 = best_broad["lstm_hidden"]
    L0 = best_broad["lstm_layers"]
    d0 = best_broad["dropout"]
    b0 = best_broad["batch_size"]

    fine_grid = [
        best_broad,
        {"learning_rate": lr0 * 0.7, "lstm_hidden": h0, "lstm_layers": L0, "dropout": d0, "batch_size": b0},
        {"learning_rate": lr0 * 1.3, "lstm_hidden": h0, "lstm_layers": L0, "dropout": d0, "batch_size": b0},
        {"learning_rate": lr0, "lstm_hidden": max(64, h0 - 64) if h0 > 64 else min(256, h0 + 64), "lstm_layers": L0, "dropout": d0, "batch_size": b0},
        {"learning_rate": lr0, "lstm_hidden": h0, "lstm_layers": 2 if L0 == 1 else 1, "dropout": d0, "batch_size": b0},
    ]
    seen: set = set()
    unique_fine: List[Dict[str, Any]] = []
    for g in fine_grid:
        key = (g["learning_rate"], g["lstm_hidden"], g["lstm_layers"], g["dropout"], g["batch_size"])
        if key not in seen:
            seen.add(key)
            unique_fine.append(g)
    fine_grid = unique_fine

    logger.info("Fine sweep: %d configs", len(fine_grid))
    fine_results: List[Dict[str, Any]] = []
    best_fine: Optional[Dict[str, Any]] = None
    best_fine_val_auc = best_val_auc

    for i, hp in enumerate(fine_grid):
        logger.info("Fine trial %d/%d: lr=%.0e hidden=%d layers=%d drop=%.2f",
                    i + 1, len(fine_grid), hp["learning_rate"], hp["lstm_hidden"], hp["lstm_layers"], hp["dropout"])
        try:
            m = run_one_trial(
                sequences, static, labels, metadata, artifacts_dir,
                lr=hp["learning_rate"],
                lstm_hidden=hp["lstm_hidden"],
                lstm_layers=hp["lstm_layers"],
                dropout=hp["dropout"],
                batch_size=hp["batch_size"],
                epochs=EPOCHS,
                patience=PATIENCE,
            )
        except Exception as e:
            logger.warning("Fine trial failed: %s", e)
            continue
        val_auc = m.get("validation", {}).get("auc", float("-inf"))
        test_match_acc = m.get("test", {}).get("match_accuracy")
        fine_results.append({
            **hp,
            "val_auc": val_auc,
            "match_accuracy": test_match_acc,
            "test_2024_accuracy": m.get("test", {}).get("test_2024_accuracy"),
            "test_2025_accuracy": m.get("test", {}).get("test_2025_accuracy"),
        })
        if val_auc > best_fine_val_auc:
            best_fine_val_auc = val_auc
            best_fine = fine_results[-1]
            logger.info("New best val AUC: %.4f (test match acc: %s)", val_auc,
                        f"{test_match_acc:.2%}" if test_match_acc is not None else "N/A")

    final_best = best_fine if best_fine is not None else best_broad
    best_hp = {k: final_best[k] for k in ("learning_rate", "lstm_hidden", "lstm_layers", "dropout", "batch_size") if k in final_best}

    # Save tuning results
    out = {
        "split": asdict(TUNE_SPLIT),
        "epochs": EPOCHS,
        "patience": PATIENCE,
        "best_params": best_hp,
        "best_val_auc": final_best.get("val_auc"),
        "best_test_match_accuracy": final_best.get("match_accuracy"),
        "test_2024_accuracy": final_best.get("test_2024_accuracy"),
        "test_2025_accuracy": final_best.get("test_2025_accuracy"),
        "broad_results": broad_results,
        "fine_results": fine_results,
    }
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(TUNE_RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

    logger.info("\nTuning complete. Best params: %s", best_hp)
    logger.info("Best val AUC: %.4f", final_best.get("val_auc", 0))
    logger.info("Best test match accuracy: %s", f"{final_best.get('match_accuracy', 0):.2%}" if final_best.get('match_accuracy') is not None else "N/A")
    logger.info("Results saved to %s", TUNE_RESULTS_PATH)


if __name__ == "__main__":
    main()
