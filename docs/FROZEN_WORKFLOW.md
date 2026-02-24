# Frozen Model Workflow (Time-Safe, Reproducible)

This document defines the **strict, one-time** workflow for training, calibration, prediction generation, and backtesting. No retraining or recalibration after completion.

## Data Splits (STRICT)

| Split | Date Range | Purpose |
|-------|------------|---------|
| **Train** | 1990–2022 | Model training only |
| **Holdout** | 2023 | Hyperparameter tuning, early stopping, temperature calibration |
| **Test** | 2024–2025 | True out-of-sample evaluation, saved predictions, backtesting |

**No data from 2024–2025 may be used in:** training, hyperparameter tuning, or calibration.

## Pipeline Order

### 1. Hyperparameter Tuning (run once)
```bash
python scripts/run_pro_level_hyperparam_tune.py
```
- Train ≤2022, Validate 2023
- Saves `experiments/results/lstm_pro_level_hyperparam_tune.json`

### 2. Final Model Training + Calibration + Predictions (run once)
```bash
python scripts/run_pro_level_final_training.py
```
This script:
- Trains on 1990–2022, validates on 2023 (early stopping)
- Fits temperature T on 2023 holdout predictions only
- Generates 2024–2025 OOS predictions (features use only prior match data)
- Saves model, scalers, calibration params, and predictions
- Predictions include: raw_probability, raw_logit, calibrated probability

Then copy model/scalers to production:
```bash
python scripts/run_pro_level_production_training.py
```

### 3. Backtesting (reads saved predictions only)
```bash
python scripts/apply_calibration_and_backtest.py
```
- Reads `tournament_predictions_pro_level_2025_*.json` (and 2024 if generated)
- Applies frozen T from `calibration_params_pro_level_2023_temperature.json`
- Writes to `experiments/odds/data/tournament_predictions_2025.json`
- Runs `back_testing.py` (joins with odds, computes strategy metrics)
- **No model calls.** Backtesting uses ONLY saved prediction files.

### 4. As At Inference Page
- Uses the same trained model + frozen T
- User selects date ≤2025
- Features computed using only matches prior to selected date
- **Never retrains or recalibrates**

## Saved Predictions Format (mandatory columns)

| Column | Description |
|--------|-------------|
| match_id | Unique match identifier |
| match_date | YYYY-MM-DD |
| player_1 | Canonical name (alphabetical by surname) |
| player_2 | |
| tourney_name | Tournament name |
| tourney_id | For odds join |
| surface | Hard/Clay/Grass |
| round | |
| raw_probability_player_one | Uncalibrated model probability |
| calibrated_probability_player_one | After temperature scaling |
| predicted_winner | player_1 or player_2 |
| actual_winner | Ground truth (player_1 or player_2) |

## Constraints

- **No data leakage:** Features use only matches before prediction date
- **No retraining after 2023:** Model weights frozen
- **No recalibration after 2023:** Temperature T frozen
- **Predictions generated once:** Backtesting reads from file, never calls model
- **Reproducibility:** Fixed seeds where applicable
