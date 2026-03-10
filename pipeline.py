"""
Pro-level tennis match prediction orchestration. prepare -> build -> time_split ->
train -> evaluate -> backtest. Implementation in src/ and scripts/; no modeling here.
Time-based splits (train<=2022, val 2023, test 2024-2025) avoid leakage and dist shift.
Calibration on holdout 2023. Backtesting on real odds for eval beyond AUC.
"""

from __future__ import annotations

import logging
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
SRC_DIR = ROOT / "src"
for p in (str(ROOT), str(SRC_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

TRAIN_CUTOFF = 20221231
VAL_CUTOFF = 20231231
RANDOM_SEED = 42
DATA_PATH = ROOT / "data" / "processed" / "preprocessed_data.csv"
ARTIFACTS_ROOT = ROOT / "experiments" / "new_lstm"
CACHE_TAG = "split_pro_level_2024_2025"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


@dataclass
class FeatureBatch:
    sequences: np.ndarray
    static: np.ndarray
    masks: np.ndarray
    labels: np.ndarray
    metadata: pd.DataFrame


def _set_seed(seed: int) -> None:
    import torch
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def prepare_data() -> Path:
    from src.preprocess import main as run_preprocess
    logger.info("Preparing data (preprocess)")
    run_preprocess()
    return DATA_PATH


def build_features(data_path: Path) -> FeatureBatch:
    from pro_level_strategy import ProLevelPreprocessor
    from new_lstm_pipeline import load_or_cache_dataset, lstm_config

    artifacts_dir = lstm_config.artifacts_root / CACHE_TAG
    cache_path = artifacts_dir / "dataset_cache.npz"
    scaler_dir = artifacts_dir / "scalers"
    preprocessor = ProLevelPreprocessor(seq_len=10)
    seq, static, masks, labels, meta, _, _ = load_or_cache_dataset(
        preprocessor, cache_path, scaler_dir, TRAIN_CUTOFF, force_rebuild=False
    )
    logger.info("Built features: %d samples", len(meta))
    return FeatureBatch(seq, static, masks, labels, meta)


def time_split(meta: pd.DataFrame):
    from new_lstm_pipeline import temporal_split
    train_idx, val_idx, test_idx = temporal_split(meta, TRAIN_CUTOFF, VAL_CUTOFF)
    logger.info("Time split: train=%d val=%d test=%d", train_idx.sum(), val_idx.sum(), test_idx.sum())
    return train_idx, val_idx, test_idx


def train(batch: FeatureBatch, train_idx: np.ndarray, val_idx: np.ndarray, artifacts_dir: Path):
    from scripts.run_lstm_training_plan import SplitConfig, _train_split
    split = SplitConfig("pro_level_production", TRAIN_CUTOFF, VAL_CUTOFF, "Production", CACHE_TAG)
    split_results = _train_split(
        split, batch.sequences, batch.static, batch.labels, batch.metadata, artifacts_dir,
        raw_rolling=False, mode="pro_level_production", include_test=True, dry_run=False,
    )
    val = split_results.get("validation", {})
    test = split_results.get("test", {})
    logger.info("Training complete: val auc=%.2f test auc=%.2f", val.get("auc", 0), test.get("auc", 0))
    return split_results


def evaluate(split_results) -> None:
    test = split_results.get("test", {})
    logger.info("Eval: test acc=%.2f auc=%.2f brier=%.2f", test.get("accuracy", 0), test.get("auc", 0), test.get("brier", 0))


def run_backtest() -> int:
    from scripts.apply_calibration_and_backtest import main as run_backtest_script
    logger.info("Running backtest (calibration + odds join + Kelly)")
    return run_backtest_script()


def main() -> None:
    _set_seed(RANDOM_SEED)
    prepare_data()
    batch = build_features(DATA_PATH)
    train_idx, val_idx, test_idx = time_split(batch.metadata)
    split_results = train(batch, train_idx, val_idx, ARTIFACTS_ROOT / CACHE_TAG)
    evaluate(split_results)
    rc = run_backtest()
    if rc != 0:
        logger.error("Backtest failed with code %d", rc)
        sys.exit(rc)
    logger.info("Pipeline complete")


if __name__ == "__main__":
    main()
