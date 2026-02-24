"""
Production pro-level LSTM training: FROZEN model (train 1990-2022, holdout 2023).

This is the ONE model used everywhere:
- As At inference page
- Current inference (later)
- Backtesting (uses saved 2024-2025 predictions from run_pro_level_final_training)

Uses hyperparams from 2023 tuning. Calibration T fitted on 2023 holdout.
See docs/FROZEN_WORKFLOW.md. Run run_pro_level_final_training for full workflow
(training + calibration + saved predictions). This script trains and copies to production.

Run with --rebuild-cache to force regeneration of dataset and scalers (including KMeans).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, log_loss, roc_auc_score

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "src"
SCRIPTS_DIR = ROOT / "scripts"
for p in [str(ROOT), str(SRC_DIR), str(SCRIPTS_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from new_lstm_pipeline import (
    DualBranchLSTM,
    create_dataloader,
    load_or_cache_dataset,
    lstm_config,
    temporal_split,
)
from pro_level_strategy import ProLevelPreprocessor
from scripts.run_lstm_training_plan import SplitConfig, _train_split

try:
    from calibration_utils import apply_calibration, load_calibration_params
except ImportError:
    apply_calibration = None
    load_calibration_params = None

RESULTS_DIR = ROOT / "experiments" / "results"
TUNE_RESULTS_PATH = RESULTS_DIR / "lstm_pro_level_hyperparam_tune.json"
PRODUCTION_MODELS_DIR = ROOT / "experiments" / "models" / "production"

# Frozen split: train 1990-2022, holdout 2023 (same as final_training)
PRODUCTION_SPLIT = SplitConfig(
    name="pro_level_production",
    train_cutoff=20221231,   # Train <= 2022
    val_cutoff=20231231,     # Holdout 2023 (early stopping)
    description="Production: Train 1990-2022, holdout 2023",
    cache_tag="split_pro_level_2024_2025",
)

# Use same max epochs as validation model (which trained for 28 epochs total, best epoch 23).
# Early stopping will determine the actual number of epochs to train.
# If validation AUC is nan (small validation set), early stopping will use validation loss instead.
EPOCHS = 50  # Same max epochs as validation model - early stopping will stop before this if needed
PATIENCE = 5  # Same patience as validation model (README: "Best epoch: 23 (early stopping with patience=5)")


def main():
    parser = argparse.ArgumentParser(description="Train production pro-level LSTM for inference")
    parser.add_argument(
        "--rebuild-cache",
        action="store_true",
        help="Force regeneration of dataset cache and scalers (including KMeans)",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
        force=True,
    )
    logger = logging.getLogger(__name__)

    logger.info("=== Pro-level LSTM Production Training (Frozen) ===")
    logger.info("Train 1990-2022, Holdout 2023. See docs/FROZEN_WORKFLOW.md\n")

    # Load best hyperparams from tuning
    if not TUNE_RESULTS_PATH.exists():
        logger.error("Hyperparameter tuning results not found: %s", TUNE_RESULTS_PATH)
        logger.error("Please run scripts/run_pro_level_hyperparam_tune.py first")
        sys.exit(1)

    with open(TUNE_RESULTS_PATH, encoding="utf-8") as f:
        tune_results = json.load(f)

    best_hp = tune_results.get("best_params")
    if not best_hp:
        logger.error("No best_params found in tuning results")
        sys.exit(1)

    logger.info("Best hyperparams from tuning:")
    for k, v in best_hp.items():
        logger.info("  %s: %s", k, v)

    # Load dataset
    artifacts_dir = lstm_config.artifacts_root / PRODUCTION_SPLIT.cache_tag
    cache_path = artifacts_dir / "dataset_cache.npz"
    scaler_dir = artifacts_dir / "scalers"

    preprocessor = ProLevelPreprocessor(seq_len=10)
    sequences, static, masks, labels, metadata, seq_names, static_names = load_or_cache_dataset(
        preprocessor,
        cache_path=cache_path,
        scaler_dir=scaler_dir,
        train_cutoff=PRODUCTION_SPLIT.train_cutoff,
        force_rebuild=args.rebuild_cache,
    )
    logger.info("Loaded: seq_shape=%s static_shape=%s", sequences.shape, static.shape)

    train_idx, val_idx, test_idx = temporal_split(
        metadata,
        PRODUCTION_SPLIT.train_cutoff,
        PRODUCTION_SPLIT.val_cutoff,
    )

    # Train with best hyperparams
    logger.info("Training production model with best hyperparams...")
    metrics = _train_split(
        PRODUCTION_SPLIT,
        sequences,
        static,
        labels,
        metadata,
        artifacts_dir,
        raw_rolling=False,
        mode="pro_level_production",
        include_test=False,  # No test set for production - this is for inference
        dry_run=False,
        epochs_override=EPOCHS,
        patience_override=PATIENCE,
        learning_rate_override=best_hp["learning_rate"],
        lstm_hidden_override=best_hp["lstm_hidden"],
        lstm_layers_override=best_hp["lstm_layers"],
        dropout_override=best_hp["dropout"],
        batch_size_override=best_hp["batch_size"],
    )

    # Copy model to production location
    PRODUCTION_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Model is saved by _train_split with pattern: {mode}_{split.name}_model.pt
    source_model_path = artifacts_dir / "pro_level_production_pro_level_production_model.pt"
    if not source_model_path.exists():
        logger.error("Model not found: %s", source_model_path)
        sys.exit(1)

    production_model_path = PRODUCTION_MODELS_DIR / "pro_level_production_model.pt"
    import shutil
    shutil.copy2(source_model_path, production_model_path)
    logger.info("Copied production model to %s", production_model_path)

    # Copy scalers
    production_scaler_dir = PRODUCTION_MODELS_DIR / "scalers"
    production_scaler_dir.mkdir(parents=True, exist_ok=True)
    for scaler_file in scaler_dir.glob("*"):
        shutil.copy2(scaler_file, production_scaler_dir / scaler_file.name)
    logger.info("Copied scalers to %s", production_scaler_dir)

    # Save architecture config
    arch_config = {
        "strategy": "pro_level",
        "model_type": "production",
        "seq_len": 10,
        "seq_input_dim": int(sequences.shape[-1]),
        "static_input_dim": int(static.shape[-1]),
        "seq_features": list(seq_names),
        "static_features": list(static_names),
        "hyperparams": best_hp,
        "training": {
            "epochs": EPOCHS,
            "patience": PATIENCE,
            "train_cutoff": PRODUCTION_SPLIT.train_cutoff,
            "purpose": "inference_only",
        },
    }
    config_path = PRODUCTION_MODELS_DIR / "pro_level_production_config.json"
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(arch_config, f, indent=2)
    logger.info("Saved production config to %s", config_path)

    logger.info("\n=== Production Training Complete ===")
    logger.info("Model ready for inference at: %s", production_model_path)


if __name__ == "__main__":
    main()
