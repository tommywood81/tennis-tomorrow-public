"""
Final pro-level LSTM training: use best hyperparams from 2023 tuning, train on <=2023, test 2024+2025.
Saves model with version, architecture config, metrics, and predictions for backtesting.
"""

from __future__ import annotations

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
    from calibration_utils import apply_calibration, load_calibration_params, apply_temperature, fit_temperature
except ImportError:
    apply_calibration = None
    load_calibration_params = None
    apply_temperature = None
    fit_temperature = None

RESULTS_DIR = ROOT / "experiments" / "results"
# Temperature scaling: fit on 2023 holdout only, applied to 2024-2025 test predictions
CALIBRATION_PARAMS_PATH = RESULTS_DIR / "calibration_params_pro_level_2023_temperature.json"
TUNE_RESULTS_PATH = RESULTS_DIR / "lstm_pro_level_hyperparam_tune.json"
MODELS_DIR = ROOT / "experiments" / "models" / "pro_level"
PREDICTIONS_DIR = ROOT / "experiments" / "predictions" / "pro_level"

# Frozen workflow: train 1990-2022, holdout 2023 (tuning+calibration), test 2024-2025
# See docs/FROZEN_WORKFLOW.md
FINAL_SPLIT = SplitConfig(
    name="pro_level_final",
    train_cutoff=20221231,   # Train <= 2022
    val_cutoff=20231231,     # Holdout 2023 (early stopping + calibration)
    description="Train 1990-2022, holdout 2023, test 2024-2025",
    cache_tag="split_pro_level_2024_2025",
)

EPOCHS = 50
PATIENCE = 7


def extract_predictions(
    model: torch.nn.Module,
    dataloader: torch.utils.data.DataLoader,
    metadata: pd.DataFrame,
    indices: np.ndarray,
    raw_df: pd.DataFrame,
    device: torch.device,
    calibration_params: Optional[dict] = None,
) -> tuple[pd.DataFrame, dict]:
    """Extract predictions with probabilities for backtesting. Returns (CSV DataFrame, JSON dict).
    If calibration_params is provided, applies temperature/Platt scaling to probabilities."""
    model.eval()
    all_probs = []
    all_labels = []
    current_idx = 0

    with torch.no_grad():
        for batch_sequences, batch_static, batch_labels in dataloader:
            batch_sequences = batch_sequences.to(device)
            batch_static = batch_static.to(device)

            logits = model(batch_sequences, batch_static)
            probs = torch.sigmoid(logits).cpu().numpy().flatten()

            batch_size = len(probs)
            all_probs.extend(probs)
            all_labels.extend(batch_labels.numpy())
            current_idx += batch_size

    # Create DataFrame with predictions
    pred_df = pd.DataFrame({
        'index': np.arange(len(all_probs)),
        'prob': all_probs,
        'label': all_labels,
    })

    # Merge with metadata
    test_metadata = metadata.iloc[indices].reset_index(drop=True)
    test_metadata_reset = test_metadata.reset_index()
    pred_df = pred_df.merge(
        test_metadata_reset[['index', 'match_id', 'player', 'opponent', 'tourney_date']],
        on='index',
        how='left'
    )

    # Get tournament info from raw data
    # Handle missing columns gracefully
    info_cols = ['match_id']
    for col in ['tourney_name', 'tourney_id', 'tourney_level', 'surface', 'round']:
        if col in raw_df.columns:
            info_cols.append(col)
    
    match_info_df = raw_df[info_cols].copy()
    for col in ['tourney_name', 'tourney_id', 'tourney_level', 'surface', 'round']:
        if col not in match_info_df.columns:
            match_info_df[col] = ''
    
    match_info = match_info_df.drop_duplicates(subset=['match_id']).set_index('match_id')

    # Average dual-perspective predictions per match
    match_predictions_csv = []
    match_predictions_json = {}
    
    for match_id, group in pred_df.groupby('match_id'):
        if len(group) != 2:
            continue

        row1 = group.iloc[0]
        row2 = group.iloc[1]

        # Average probabilities from both perspectives
        avg_prob = (row1['prob'] + (1.0 - row2['prob'])) / 2.0
        label = int(row1['label'])
        match_pred = 1 if avg_prob >= 0.5 else 0

        # Determine player_one/player_two (alphabetical by last name)
        p1_name = min(row1['player'], row1['opponent'], key=lambda x: x.split()[-1].lower() if isinstance(x, str) else "")
        p2_name = max(row1['player'], row1['opponent'], key=lambda x: x.split()[-1].lower() if isinstance(x, str) else "")
        
        # Get probabilities for p1 (row N['prob'] = P(row N['player'] wins))
        prob_p1_from_p1 = row1['prob'] if row1['player'] == p1_name else (1.0 - row1['prob'])
        prob_p1_from_p2 = row2['prob'] if row2['player'] == p1_name else (1.0 - row2['prob'])
        prob_p1 = (prob_p1_from_p1 + prob_p1_from_p2) / 2.0
        prob_p2 = 1.0 - prob_p1

        raw_prob_p1 = float(prob_p1)
        raw_logit = float(np.log(np.clip(raw_prob_p1, 1e-6, 1 - 1e-6) / (1 - np.clip(raw_prob_p1, 1e-6, 1 - 1e-6))))

        # Apply post-hoc calibration (temperature/Platt) if params provided
        if calibration_params and apply_calibration is not None:
            prob_p1 = float(apply_calibration(np.array([prob_p1]), calibration_params)[0])
            prob_p2 = 1.0 - prob_p1

        # CRITICAL: Use player_one (p1_name) perspective for ALL stored values.
        # Row1/row2 order varies by match; mixing perspectives causes ~50% accuracy.
        actual_p1 = 1 if ((row1['label'] == 1 and row1['player'] == p1_name) or
                          (row2['label'] == 1 and row2['player'] == p1_name)) else 0
        match_pred = 1 if prob_p1 >= 0.5 else 0

        # Get tournament info
        info = match_info.loc[match_id] if match_id in match_info.index else pd.Series({
            'tourney_name': '', 'tourney_id': '', 'tourney_level': '', 'surface': '', 'round': ''
        })
        
        date_int = int(row1['tourney_date'])
        date_str = f"{date_int // 10000}-{(date_int % 10000) // 100:02d}-{date_int % 100:02d}"
        
        actual_winner = "player_one" if actual_p1 == 1 else "player_two"

        match_predictions_csv.append({
            'match_id': match_id,
            'player': row1['player'],
            'opponent': row1['opponent'],
            'tourney_date': date_int,
            'raw_probability': raw_prob_p1,
            'probability': float(prob_p1),
            'raw_logit': raw_logit,
            'prediction': match_pred,
            'actual': actual_p1,
        })

        match_predictions_json[match_id] = {
            "match_id": match_id,
            "tourney_id": str(info.get('tourney_id', '')),
            "tourney_name": str(info.get('tourney_name', '')),
            "tourney_level": str(info.get('tourney_level', '')),
            "date": date_str,
            "round": str(info.get('round', '')),
            "surface": str(info.get('surface', '')),
            "player_one": {"slug": "", "name": p1_name, "country": None, "last_rank": None},
            "player_two": {"slug": "", "name": p2_name, "country": None, "last_rank": None},
            "actual_winner": actual_winner,
            "raw_probability_player_one": raw_prob_p1,
            "raw_logit": raw_logit,
            "predicted_probability_player_one": float(prob_p1),
            "predicted_probability_player_two": float(prob_p2),
            "predicted_winner": "player_one" if prob_p1 >= 0.5 else "player_two",
            "top_features": [],
        }

    return pd.DataFrame(match_predictions_csv), match_predictions_json


def compute_year_metrics(pred_df: pd.DataFrame, year: int, use_raw: bool = False) -> Dict[str, float]:
    """Compute metrics for a specific year. use_raw=True uses raw (uncalibrated) probs for model evaluation."""
    year_df = pred_df[pred_df['tourney_date'] // 10000 == year].copy()
    if len(year_df) == 0:
        return {}

    if use_raw:
        probs = year_df['raw_probability'].values
        preds = (probs >= 0.5).astype(int)
    else:
        probs = year_df['probability'].values
        preds = year_df['prediction'].values
    labels = year_df['actual'].values

    metrics = {
        "accuracy": accuracy_score(labels, preds),
        "brier": float(np.mean((probs - labels) ** 2)),
        "count": len(year_df),
    }

    try:
        metrics["auc"] = roc_auc_score(labels, probs)
    except ValueError:
        metrics["auc"] = float("nan")

    try:
        eps = 1e-7
        clipped = np.clip(probs, eps, 1 - eps)
        metrics["log_loss"] = log_loss(labels, clipped)
    except ValueError:
        metrics["log_loss"] = float("nan")

    return metrics


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Train frozen model (1990-2022), calibrate on 2023, save 2024-2025 predictions")
    parser.add_argument("--rebuild-cache", action="store_true", help="Force rebuild dataset cache and scalers (including KMeans)")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
        force=True,
    )
    logger = logging.getLogger(__name__)

    logger.info("=== Pro-level LSTM Final Training ===")
    logger.info("Train <= 2023, Test 2024+2025\n")

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
    artifacts_dir = lstm_config.artifacts_root / FINAL_SPLIT.cache_tag
    cache_path = artifacts_dir / "dataset_cache.npz"
    scaler_dir = artifacts_dir / "scalers"

    preprocessor = ProLevelPreprocessor(seq_len=10)
    sequences, static, masks, labels, metadata, seq_names, static_names = load_or_cache_dataset(
        preprocessor,
        cache_path=cache_path,
        scaler_dir=scaler_dir,
        train_cutoff=FINAL_SPLIT.train_cutoff,
        force_rebuild=args.rebuild_cache,
    )
    logger.info("Loaded: seq_shape=%s static_shape=%s", sequences.shape, static.shape)

    # Load raw data for tournament info
    logger.info("Loading raw data for tournament info...")
    raw_df = pd.read_csv(lstm_config.data_path)
    logger.info("Loaded %d raw rows", len(raw_df))

    train_idx, val_idx, test_idx = temporal_split(
        metadata,
        FINAL_SPLIT.train_cutoff,
        FINAL_SPLIT.val_cutoff,
    )

    # Train with best hyperparams
    logger.info("Training with best hyperparams...")
    metrics = _train_split(
        FINAL_SPLIT,
        sequences,
        static,
        labels,
        metadata,
        artifacts_dir,
        raw_rolling=False,
        mode="pro_level_final",
        include_test=True,
        dry_run=False,
        epochs_override=EPOCHS,
        patience_override=PATIENCE,
        learning_rate_override=best_hp["learning_rate"],
        lstm_hidden_override=best_hp["lstm_hidden"],
        lstm_layers_override=best_hp["lstm_layers"],
        dropout_override=best_hp["dropout"],
        batch_size_override=best_hp["batch_size"],
    )

    # Load trained model and extract predictions
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = DualBranchLSTM(
        seq_input_dim=sequences.shape[-1],
        static_input_dim=static.shape[-1],
        lstm_hidden=best_hp["lstm_hidden"],
        lstm_layers=best_hp["lstm_layers"],
        dropout=best_hp["dropout"],
    ).to(device)

    # Model is saved by _train_split with pattern: {mode}_{split.name}_model.pt
    model_path = artifacts_dir / "pro_level_final_pro_level_final_model.pt"
    if not model_path.exists():
        logger.error("Model not found: %s", model_path)
        sys.exit(1)

    model.load_state_dict(torch.load(model_path, map_location=device))
    logger.info("Loaded trained model from %s", model_path)

    # Step 1: Extract 2023 val predictions (raw), fit temperature T on holdout only
    val_loader = create_dataloader(
        sequences[val_idx],
        static[val_idx],
        labels[val_idx],
        batch_size=best_hp["batch_size"],
        shuffle=False,
    )
    val_csv, val_json = extract_predictions(
        model, val_loader, metadata, val_idx, raw_df, device,
        calibration_params=None,
    )
    if len(val_csv) > 0 and fit_temperature is not None and apply_calibration is not None:
        probs_val = val_csv["probability"].values.astype(np.float64)
        actuals_val = val_csv["actual"].values.astype(np.float64)
        probs_val = np.clip(probs_val, 1e-6, 1.0 - 1e-6)
        T = fit_temperature(probs_val, actuals_val, max_t=2.5)
        calibration_params = {"method": "temperature", "temperature": T}
        CALIBRATION_PARAMS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CALIBRATION_PARAMS_PATH, "w", encoding="utf-8") as f:
            json.dump(calibration_params, f, indent=2)
        logger.info("Fitted temperature T=%.4f on 2023 holdout (%d matches), saved to %s",
                    T, len(val_csv), CALIBRATION_PARAMS_PATH.name)
    else:
        calibration_params = None
        if CALIBRATION_PARAMS_PATH.exists() and load_calibration_params is not None:
            calibration_params = load_calibration_params(CALIBRATION_PARAMS_PATH)
            if calibration_params:
                logger.info("Using calibration from %s", CALIBRATION_PARAMS_PATH.name)
        if not calibration_params:
            logger.info("No calibration; saving raw probabilities")

    # Step 2: Extract 2024-2025 test predictions with calibration
    test_loader = create_dataloader(
        sequences[test_idx],
        static[test_idx],
        labels[test_idx],
        batch_size=best_hp["batch_size"],
        shuffle=False,
    )

    logger.info("Extracting 2024-2025 test predictions (calibration already fitted on 2023)...")
    test_predictions_csv, test_predictions_json = extract_predictions(
        model, test_loader, metadata, test_idx, raw_df, device,
        calibration_params=calibration_params,
    )

    # Compute year-specific metrics (use raw probs for model evaluation; calibration is for odds alignment)
    metrics_2024 = compute_year_metrics(test_predictions_csv, 2024, use_raw=True)
    metrics_2025 = compute_year_metrics(test_predictions_csv, 2025, use_raw=True)

    # Create version label
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    version = f"v1.0_{timestamp}"

    # Save model with version
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    versioned_model_path = MODELS_DIR / f"pro_level_model_{version}.pt"
    torch.save(model.state_dict(), versioned_model_path)
    logger.info("Saved versioned model to %s", versioned_model_path)

    # Save architecture config
    arch_config = {
        "strategy": "pro_level",
        "version": version,
        "seq_len": 10,
        "seq_input_dim": int(sequences.shape[-1]),
        "static_input_dim": int(static.shape[-1]),
        "seq_features": list(seq_names),
        "static_features": list(static_names),
        "hyperparams": best_hp,
        "training": {
            "epochs": EPOCHS,
            "patience": PATIENCE,
            "train_cutoff": FINAL_SPLIT.train_cutoff,
            "test_years": [2024, 2025],
        },
    }
    config_path = MODELS_DIR / f"pro_level_config_{version}.json"
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(arch_config, f, indent=2)
    logger.info("Saved architecture config to %s", config_path)

    # Save predictions for backtesting (CSV and JSON formats)
    PREDICTIONS_DIR.mkdir(parents=True, exist_ok=True)
    predictions_csv_path = PREDICTIONS_DIR / f"pro_level_predictions_{version}.csv"
    test_predictions_csv.to_csv(predictions_csv_path, index=False)
    logger.info("Saved predictions CSV to %s (%d matches)", predictions_csv_path, len(test_predictions_csv))

    # Save JSON format for odds backtesting pipeline
    predictions_json_2024 = {k: v for k, v in test_predictions_json.items() if v['date'].startswith('2024')}
    predictions_json_2025 = {k: v for k, v in test_predictions_json.items() if v['date'].startswith('2025')}
    
    json_2024_path = RESULTS_DIR / f"tournament_predictions_pro_level_2024_{version}.json"
    json_2025_path = RESULTS_DIR / f"tournament_predictions_pro_level_2025_{version}.json"
    
    with open(json_2024_path, "w", encoding="utf-8") as f:
        json.dump(predictions_json_2024, f, indent=2)
    logger.info("Saved 2024 predictions JSON to %s (%d matches)", json_2024_path, len(predictions_json_2024))
    
    with open(json_2025_path, "w", encoding="utf-8") as f:
        json.dump(predictions_json_2025, f, indent=2)
    logger.info("Saved 2025 predictions JSON to %s (%d matches)", json_2025_path, len(predictions_json_2025))

    # Save metrics (after predictions are saved so we can include paths)
    results = {
        "strategy": "pro_level",
        "version": version,
        "split": {
            "train_cutoff": FINAL_SPLIT.train_cutoff,
            "test_years": [2024, 2025],
        },
        "hyperparams": best_hp,
        "metrics": {
            "test": metrics.get("test", {}),
            "test_2024": metrics_2024,
            "test_2025": metrics_2025,
        },
        "model_path": str(versioned_model_path.relative_to(ROOT)),
        "config_path": str(config_path.relative_to(ROOT)),
        "predictions": {
            "csv_path": str(predictions_csv_path.relative_to(ROOT)),
            "json_2024_path": str(json_2024_path.relative_to(ROOT)),
            "json_2025_path": str(json_2025_path.relative_to(ROOT)),
        },
    }
    results_path = RESULTS_DIR / f"lstm_pro_level_final_{version}.json"
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    logger.info("Saved metrics to %s", results_path)

    # Print summary
    logger.info("\n=== Final Results Summary ===")
    logger.info("Version: %s", version)
    logger.info("\nTest 2024:")
    logger.info("  Accuracy: %.2f%%", metrics_2024.get("accuracy", 0) * 100)
    logger.info("  AUC: %.4f", metrics_2024.get("auc", 0))
    logger.info("  Brier: %.4f", metrics_2024.get("brier", 0))
    logger.info("  Log Loss: %.4f", metrics_2024.get("log_loss", 0))
    logger.info("  Count: %d", metrics_2024.get("count", 0))
    logger.info("\nTest 2025:")
    logger.info("  Accuracy: %.2f%%", metrics_2025.get("accuracy", 0) * 100)
    logger.info("  AUC: %.4f", metrics_2025.get("auc", 0))
    logger.info("  Brier: %.4f", metrics_2025.get("brier", 0))
    logger.info("  Log Loss: %.4f", metrics_2025.get("log_loss", 0))
    logger.info("  Count: %d", metrics_2025.get("count", 0))


if __name__ == "__main__":
    main()
