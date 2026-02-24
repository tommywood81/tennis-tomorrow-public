# Pro-Level LSTM Training Pipeline

## Overview

Two-step pipeline:
1. **Hyperparameter tuning** on 2023 holdout (train ≤2022, validate 2023)
2. **Final training** with best hyperparams (train ≤2023, test 2024+2025)

## Step 1: Hyperparameter Tuning

**Command:**
```bash
python scripts/run_pro_level_hyperparam_tune.py
```

**What it does:**
- Trains on ≤2022, validates on 2023, tests on 2024+2025
- Runs broad sweep (8 configs) then fine sweep (4-5 configs)
- Each trial: 6 epochs, patience 3
- Saves best hyperparams to `experiments/results/lstm_pro_level_hyperparam_tune.json`

**Output:**
- `experiments/results/lstm_pro_level_hyperparam_tune.json` - Best hyperparams and all trial results

## Step 2: Final Training

**Command:**
```bash
python scripts/run_pro_level_final_training.py
```

**What it does:**
- Loads best hyperparams from Step 1
- Trains on ≤Nov 2023, validates Dec 2023, tests 2024+2025
- Uses best architecture from tuning
- Saves versioned model, config, metrics, and predictions

**Outputs:**

1. **Model** (versioned):
   - `experiments/models/pro_level/pro_level_model_v1.0_{timestamp}.pt`

2. **Architecture config**:
   - `experiments/models/pro_level/pro_level_config_v1.0_{timestamp}.json`
   - Contains: hyperparams, feature names, training config

3. **Metrics**:
   - `experiments/results/lstm_pro_level_final_{version}.json`
   - Includes: AUC, Brier, accuracy, log loss for 2024 and 2025 separately

4. **Predictions (CSV)**:
   - `experiments/predictions/pro_level/pro_level_predictions_{version}.csv`
   - Columns: match_id, player, opponent, tourney_date, probability, prediction, actual

5. **Predictions (JSON for odds backtesting)**:
   - `experiments/results/tournament_predictions_pro_level_2024_{version}.json`
   - `experiments/results/tournament_predictions_pro_level_2025_{version}.json`
   - Format matches `tournament_predictions_{year}.json` expected by odds pipeline

## Best Hyperparams (from 2023 tuning)

- **Learning rate:** 0.001
- **LSTM hidden:** 64
- **LSTM layers:** 1
- **Dropout:** 0.2
- **Batch size:** 128

## Using Predictions for Odds Backtesting

The JSON files can be used directly with the odds backtesting pipeline:
- `experiments/odds/run_fixed_pipeline.py` expects `tournament_predictions_{year}.json`
- Or use `scripts/export_predictions_to_odds_csv.py` to convert JSON → CSV

## Metrics Saved

For each year (2024, 2025):
- **Accuracy** (%)
- **AUC** (Area Under ROC Curve)
- **Brier Score** (calibration)
- **Log Loss**
- **Count** (number of matches)

All metrics are saved in the results JSON file.
