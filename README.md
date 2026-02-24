LSTM Tennis Prediction

Sequence-based tennis match prediction system built with strict temporal evaluation and real-world backtesting.

Built as a fully reproducible pipeline from raw ATP data through to live predictions and backtesting. 

Trained on 1990–2022, calibrated on 2023, and evaluated cleanly out-of-sample on 2024–2025 (~70% accuracy, ~0.77 AUC). There’s also a live site at <a href="https://www.tennistomorrow.com" target="_blank" rel="noopener noreferrer">tennistomorrow.com</a>, a FastAPI backend, and a backtesting pipeline against real market odds.

The model combines sequence features (last 10 matches) with static context. Features are opponent-aware (serve/return splits, form, H2H), and player styles are inferred via clustering to capture matchup effects — not just overall player strength, but style mismatches. No player identity leakage, strict year-based splits, and calibrated probabilities before any betting logic.

What this project shows

Taking a model all the way to a usable system (API + frontend)

Treating time properly (no leakage, clean year splits)

Modelling matchups instead of relying on player IDs or ratings

Not trusting raw model probabilities without calibration

Backtesting with real odds instead of stopping at AUC

Project structure
services/
  backend/          # FastAPI + model serving
  frontend/         # React (Vite + MUI)
src/
  pro_level_strategy/   # pro-level feature engineering + preprocessing
  preprocess.py
experiments/
  models/production/   # model + scalers used at inference time
  new_lstm/            # training artifacts
  results/             # predictions + calibration outputs
  odds/                # backtesting logic + data
scripts/               # entrypoints for training / backtesting
data/
  raw/
  processed/
How to run

Requirements: Python 3.11+, Node 20+

Install
cd services/backend
pip install -r requirements.txt

cd ../frontend
npm install
Data
python -c "from src.preprocess import main; main()"
Training (pro-level pipeline, run in order)
python scripts/run_pro_level_hyperparam_tune.py
python scripts/run_pro_level_final_training.py
python scripts/run_pro_level_production_training.py
python scripts/apply_calibration_and_backtest.py

Optional:

python scripts/run_pro_level_final_training.py --rebuild-cache
python scripts/run_pro_level_production_training.py --rebuild-cache
python scripts/export_backtest_to_frontend.py
Run locally
# backend
cd services/backend
uvicorn app.main:app --reload --port 8000

# frontend
cd services/frontend
npm run dev
Notes

Inference uses artifacts in experiments/models/production/

Backend expects data/processed/preprocessed_data.csv

Backtesting uses saved predictions + odds (no live inference calls)

Workflow intentionally frozen post-2023

“Full training pipeline included, but data and model weights are omitted for brevity; the repo can be run end-to-end with your own sample data.”