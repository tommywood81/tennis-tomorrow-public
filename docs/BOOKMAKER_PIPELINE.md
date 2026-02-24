# Bookmaker-Style Tennis Prediction Pipeline

Lightweight, rank-free feature engineering and model for match outcome prediction.

## Design

- **No rank features**: No `player_rank`, `opponent_rank`, `rank_diff`, or log(rank).
- **Dual perspective**: Each match = 2 rows (player A vs B, player B vs A); features from player perspective.
- **Train/test split**: By `match_id` (time-based). Entire match in train or test.
- **Input**: Per-match `spw` (serve points won %) and `rpw` (return points won %), derived from existing columns.

## Features (Steps 1–8)

1. **Opponent strength baselines**: Rolling mean of opponent spw/rpw (past only), with shrinkage.
2. **Opponent-adjusted stats**: `adj_spw`, `adj_rpw` (difference form, clipped).
3. **Recency weighted**: `spw_adj_last3`, `spw_adj_last10`, `rpw_adj_last3`, `rpw_adj_last10` (exponential weights).
4. **Return buckets**: 8 bins from `rpw_adj_last10` percentile; keep continuous + `rpw_bucket_8`.
5. **Matchup interactions**: `player_serve_edge`, `opponent_serve_edge`, `net_edge`, `player_form_edge`, `interaction_product`.
6. **Differences**: `spw_diff_10`, `rpw_diff_10`, `bucket_diff`.
7. **H2H**: `h2h_win_pct` (smoothed), `h2h_matches_capped`.
8. **Reliability**: `player_matches_last10`, `opponent_matches_last10`.

## Usage

### Train and evaluate (with optional leakage test)

```bash
python scripts/run_bookmaker_pipeline.py --test-cutoff 20241231
python scripts/run_bookmaker_pipeline.py --test-cutoff 20241231 --leakage-test
python scripts/run_bookmaker_pipeline.py --test-cutoff 20241231 --nn   # small NN instead of LR
python scripts/run_bookmaker_pipeline.py --limit 25000   # quick run on last 25k rows
```

### Export predictions for backtest

Exports `experiments/results/tournament_predictions_2025.json` (same format as LSTM cache) so the fixed backtest pipeline can run:

```bash
python scripts/export_bookmaker_predictions.py --test-cutoff 20241231 --year 2025
```

Then run the backtest:

```bash
python experiments/odds/run_fixed_pipeline.py
```

(If `calibration_params.json` exists, the pipeline will apply it when exporting; for bookmaker-only, you can remove or rename that file so the export uses raw model probs.)

## Files

- `src/bookmaker/features.py` – feature builder (no rank, strict past-only).
- `src/bookmaker/__init__.py` – exports.
- `scripts/run_bookmaker_pipeline.py` – train, evaluate, optional shuffle leakage test.
- `scripts/export_bookmaker_predictions.py` – build features, train, predict on test year, write JSON.

## LSTM + bookmaker (train ≤2022, val 2023, test 2024+2025)

Train the LSTM with bookmaker features as static (12) and no-rank sequence (7 dims):

```bash
python scripts/run_lstm_training_plan.py --mode bookmaker [--rebuild-cache]
```

- **Accuracy boost**: Bookmaker mode uses 12 epochs and patience 5 by default. Override with `--epochs 15 --patience 6` if you want more training.
- **Leakage check**: Run the shuffle-and-retrain test (expect test AUC ≈ 0.5 if no leakage):
  - From the training plan (after bookmaker training):  
    `python scripts/run_lstm_training_plan.py --mode bookmaker --leakage-test`
  - Standalone (uses existing bookmaker cache):  
    `python scripts/run_shuffle_leakage_test.py --bookmaker [--epochs 15] [--rebuild]`

## Current status

- Pipeline runs on full or limited data; feature build can be slow on full data (per-opponent merge).
- Target: ≥75% accuracy; then run through backtest for bookie-grade, modest profit.
- Leakage test: shuffle labels within match pairs and retrain; expect AUC ≈ 0.5. Slightly higher AUC can be residual strength signal rather than leakage.
