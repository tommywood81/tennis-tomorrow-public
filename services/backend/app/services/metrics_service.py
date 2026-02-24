from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

from ..config import Paths, Settings, get_settings
from ..schemas import (
    CalibrationPoint,
    ConfusionMatrix,
    Hyperparameters,
    ModelMetricSeriesPoint,
    ModelStatsResponse,
    RankBucketAccuracy,
    StoryMetric,
)


class MetricsService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.paths = Paths()

    def _load_json(self, path: Path) -> Dict:
        if not path.exists():
            return {}
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)

    def _cv_summary(self) -> Dict:
        return self._load_json(self.settings.results_dir / "lstm_cv_results.json")

    def _forward_summary(self) -> Dict:
        return self._load_json(
            self.settings.results_dir / "lstm_forward_test_forward_test_dec2025.json"
        )

    def _full_validation(self) -> Dict:
        return self._load_json(
            self.settings.results_dir / "lstm_full_validation_full_validation_2024.json"
        )

    def _phase1_validation(self) -> Dict:
        return self._load_json(
            self.settings.results_dir / "lstm_phase1_validation.json"
        )

    def _phase2_validation(self) -> Dict:
        return self._load_json(
            self.settings.results_dir / "lstm_phase2_validation.json"
        )

    def build_response(self) -> ModelStatsResponse:
        cv = self._cv_summary()
        folds = cv.get("folds", [])
        cv_plan = [fold["split"]["description"] for fold in folds]
        summary = cv.get("summary", {})

        # Cross-validation level metrics (validation folds only)
        val_acc_mean = float(summary.get("val_accuracy_mean", 0.0))
        val_acc_std = float(summary.get("val_accuracy_std", 0.0))
        val_auc_mean = float(summary.get("val_auc_mean", 0.0))

        # Full validation / test metrics for headline numbers
        # Use match-level metrics from full_validation results (production model with 82.68% accuracy)
        validation = self._full_validation()
        val_test = validation.get("metrics", {}).get("test", {})
        
        # Prefer match-level metrics if available (user-friendly, matches counted once)
        if "match_accuracy" in val_test:
            test_accuracy = float(val_test.get("match_accuracy", 0.0))
            test_auc = float(val_test.get("match_auc", 0.0))
            test_brier = float(val_test.get("match_brier", 0.0))
            test_log_loss = float(val_test.get("match_log_loss", 0.0))
        else:
            # Fall back to sample-level metrics
            test_accuracy = float(val_test.get("accuracy", 0.0))
            test_auc = float(val_test.get("auc", 0.0))
            test_brier = float(val_test.get("brier", 0.0))
            test_log_loss = float(val_test.get("log_loss", 0.0))
        
        # Try to load match-level confusion matrix and rank buckets from separate file
        match_level_path = self.settings.results_dir / "lstm_test_match_level_metrics.json"
        match_level_confusion = None
        match_level_rank_buckets = []
        if match_level_path.exists():
            match_level_data = self._load_json(match_level_path)
            # Load confusion matrix and rank bucket accuracy if available
            if "confusion_matrix" in match_level_data:
                cm = match_level_data["confusion_matrix"]
                match_level_confusion = ConfusionMatrix(
                    true_positive=int(cm.get("true_positive", 0)),
                    true_negative=int(cm.get("true_negative", 0)),
                    false_positive=int(cm.get("false_positive", 0)),
                    false_negative=int(cm.get("false_negative", 0)),
                )
            if "rank_bucket_accuracy" in match_level_data:
                match_level_rank_buckets = [
                    RankBucketAccuracy(**item)
                    for item in match_level_data.get("rank_bucket_accuracy", [])
                ]

        # Train/val/test ranges are metadata, not model outputs
        training_range = "2018-01-01 → 2023-12-31"
        validation_range = "2024 season"
        test_range = "2025 data (up to 2025-11-03)"

        # Derive a simple 95% CI for validation accuracy from CV folds
        # (CI is approximate but entirely data-driven)
        delta = 1.96 * val_acc_std
        confidence_interval = [
            max(0.0, val_acc_mean - delta),
            min(1.0, val_acc_mean + delta),
        ]

        # Build series directly from CV summary for charts
        loss_history = [
            ModelMetricSeriesPoint(
                label=fold["split"]["name"],
                value=float(fold["metrics"]["validation"].get("log_loss", np.nan)),
            )
            for idx, fold in enumerate(cv.get("folds", []))
        ]
        auc_history = [
            ModelMetricSeriesPoint(
                label=fold["split"]["name"],
                value=float(fold["metrics"]["validation"].get("auc", np.nan)),
            )
            for idx, fold in enumerate(cv.get("folds", []))
        ]

        # Approximate seasonal stability from validation folds
        # Prefer match-level accuracy if available, otherwise use sample-level
        seasonal_stability = []
        for fold in folds:
            val_cutoff = str(fold["split"].get("val_cutoff", ""))
            label = val_cutoff[:4] if val_cutoff else fold["split"]["name"]
            val_metrics = fold["metrics"].get("validation", {})
            # Prefer match-level accuracy if available
            accuracy = val_metrics.get("match_accuracy", val_metrics.get("accuracy", np.nan))
            seasonal_stability.append(
                ModelMetricSeriesPoint(
                    label=label,
                    value=float(accuracy),
                )
            )

        # We currently don't have per-surface / per-level breakdowns or feature-group
        # importance in the metrics files, so return empty series instead of dummies.
        surface_performance: List[StoryMetric] = []
        level_performance: List[StoryMetric] = []
        feature_group_importance: List[StoryMetric] = []
        
        # Generate rank bucket accuracy data (synthetic for now - can be replaced with real data)
        # Rank buckets: 1-5, 6-10, 11-20, 21-50, 51-100, 101+
        rank_buckets = ["1-5", "6-10", "11-20", "21-50", "51-100", "101+"]
        rank_bucket_accuracy: List[RankBucketAccuracy] = []
        
        # Generate synthetic accuracy data (higher accuracy for top players, lower for lower ranks)
        # In production, this would come from actual evaluation data
        base_accuracy = test_accuracy
        
        # Deterministic variation based on bucket indices
        for p_idx, player_bucket in enumerate(rank_buckets):
            for o_idx, opponent_bucket in enumerate(rank_buckets):
                # Higher accuracy when both players are top-ranked (more predictable)
                # Lower accuracy when rank difference is large (upsets more common)
                player_top = player_bucket in ["1-5", "6-10"]
                opp_top = opponent_bucket in ["1-5", "6-10"]
                
                # Deterministic variation based on indices
                variation = ((p_idx + o_idx) % 7 - 3) * 0.01  # Deterministic variation
                
                if player_top and opp_top:
                    acc = base_accuracy + 0.05 + variation  # Top vs top: slightly higher accuracy
                elif player_bucket == "1-5" and opponent_bucket in ["51-100", "101+"]:
                    acc = base_accuracy + 0.08 + variation  # Top vs lower: higher accuracy
                elif player_bucket in ["51-100", "101+"] and opponent_bucket == "1-5":
                    acc = base_accuracy - 0.10 + variation  # Lower vs top: lower accuracy (upsets)
                else:
                    acc = base_accuracy + variation  # Base accuracy with variation
                
                acc = max(0.5, min(0.95, acc))  # Clamp between 50% and 95%
                
                # Sample count decreases for higher rank buckets
                sample_count = int(1000 * (0.9 ** (p_idx + o_idx)))
                
                rank_bucket_accuracy.append(
                    RankBucketAccuracy(
                        player_rank_bucket=player_bucket,
                        opponent_rank_bucket=opponent_bucket,
                        accuracy=acc,
                        sample_count=sample_count
                    )
                )

        metadata = self._load_json(self.settings.model_metadata_path)
        
        # Get training date from metadata, or fall back to model file modification time
        training_date_str = metadata.get("model_info", {}).get("training_date")
        if not training_date_str and self.paths.model_checkpoint.exists():
            # Use model file modification time as training date
            model_mtime = datetime.fromtimestamp(self.paths.model_checkpoint.stat().st_mtime)
            training_date_str = model_mtime.isoformat()
        
        # Fallback to default if still not available
        training_date_str = training_date_str or "2025-11-27T22:34:19.500224"

        # Parse the date, handling both ISO format with and without microseconds
        try:
            if "T" in training_date_str:
                last_trained_dt = datetime.fromisoformat(training_date_str.replace("Z", "+00:00"))
            else:
                last_trained_dt = datetime.fromisoformat(f"{training_date_str}T00:00:00")
        except ValueError:
            # Fallback parsing
            last_trained_dt = datetime.fromisoformat("2025-11-27T22:34:19.500224")

        # Load Phase 1 and Phase 2 validation results if available
        phase1_accuracy = None
        phase2_accuracy = None
        phase1_hyperparams = None
        phase2_hyperparams = None
        final_hyperparams = None
        
        phase1_data = self._phase1_validation()
        phase1_auc = None
        phase1_brier = None
        phase1_log_loss = None
        if phase1_data and "metrics" in phase1_data:
            phase1_test = phase1_data.get("metrics", {}).get("test", {})
            if phase1_test:
                # Prefer match-level metrics if available, otherwise use sample-level
                phase1_accuracy = float(phase1_test.get("match_accuracy", phase1_test.get("accuracy", 0.0)))
                phase1_auc = float(phase1_test.get("match_auc", phase1_test.get("auc", 0.0))) if phase1_test.get("match_auc") is not None or phase1_test.get("auc") is not None else None
                phase1_brier = float(phase1_test.get("match_brier", phase1_test.get("brier", 0.0))) if phase1_test.get("match_brier") is not None or phase1_test.get("brier") is not None else None
                phase1_log_loss = float(phase1_test.get("match_log_loss", phase1_test.get("log_loss", 0.0))) if phase1_test.get("match_log_loss") is not None or phase1_test.get("log_loss") is not None else None
            # Load hyperparameters
            if "hyperparameters" in phase1_data:
                phase1_hyperparams = Hyperparameters(**phase1_data["hyperparameters"])
        
        # Phase 2 validation uses the same split as full_validation (train ≤2023, validate 2024, test 2025)
        # So we use the full_validation match-level metrics for phase2 accuracy
        phase2_data = self._phase2_validation()
        if validation and "metrics" in validation:
            phase2_test = validation.get("metrics", {}).get("test", {})
            if phase2_test:
                # Use match-level accuracy from full_validation (same split as phase2)
                phase2_accuracy = float(phase2_test.get("match_accuracy", phase2_test.get("accuracy", test_accuracy)))
        elif phase2_data and "metrics" in phase2_data:
            # Fallback: if full_validation not available, use phase2 data
            phase2_test = phase2_data.get("metrics", {}).get("test", {})
            if phase2_test:
                phase2_accuracy = float(phase2_test.get("match_accuracy", phase2_test.get("accuracy", 0.0)))
        
        # Load hyperparameters from phase2 data if available
        if phase2_data and "hyperparameters" in phase2_data:
            phase2_hyperparams = Hyperparameters(**phase2_data["hyperparameters"])
        
        # Load final model hyperparameters from full_validation
        if validation and "training_info" in validation:
            training_info = validation.get("training_info", {})
            if "hyperparameters" in training_info:
                final_hyperparams = Hyperparameters(**training_info["hyperparameters"])

        return ModelStatsResponse(
            model_version=str(training_date_str),
            last_trained=last_trained_dt,
            training_cutoff=date(2025, 11, 3),
            training_range=training_range,
            validation_range=validation_range,
            test_range=test_range,
            cross_validation_plan=cv_plan,
            accuracy=test_accuracy,
            auc_roc=test_auc,
            pr_auc=None,
            brier=test_brier,
            log_loss=test_log_loss,
            confidence_interval=confidence_interval,
            # Use match-level confusion matrix if available, otherwise empty
            confusion_matrix=match_level_confusion or ConfusionMatrix(
                true_positive=0,
                true_negative=0,
                false_positive=0,
                false_negative=0,
            ),
            calibration_curve=[],
            loss_history=loss_history,
            auc_history=auc_history,
            seasonal_stability=seasonal_stability,
            surface_performance=surface_performance,
            level_performance=level_performance,
            feature_group_importance=feature_group_importance,
            # Use match-level rank bucket accuracy if available, otherwise empty (no synthetic data)
            rank_bucket_accuracy=match_level_rank_buckets if match_level_rank_buckets else [],
            changelog=[
                "2025-11-09: Added tournament-level overrides and Sept-Oct holdout.",
                "2025-10-15: Upgraded model to dual-branch LSTM.",
            ],
            phase1_test_accuracy=phase1_accuracy,
            phase1_test_auc=phase1_auc,
            phase1_test_brier=phase1_brier,
            phase1_test_log_loss=phase1_log_loss,
            phase2_test_accuracy=phase2_accuracy,
            phase1_hyperparameters=phase1_hyperparams,
            phase2_hyperparameters=phase2_hyperparams,
            final_hyperparameters=final_hyperparams,
        )


def get_metrics_service() -> MetricsService:
    return MetricsService(get_settings())





