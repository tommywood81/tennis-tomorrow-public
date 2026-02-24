from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import BaseModel
from pydantic_settings import BaseSettings


def _detect_root() -> Path:
    """Resolve the project root whether running from source or inside the backend image.

    The backend package lives under <root>/services/backend/app during development but
    is copied to /app/app in the container. We walk up the directory tree until we find
    a parent that already contains the project artefacts we need (experiments/, data/, etc.).
    """
    current = Path(__file__).resolve()
    for parent in [current.parent, *current.parents]:
        if (parent / "experiments").exists() and (parent / "data").exists():
            return parent
    # Fallback: default to two levels up (works for container layout /app/app/* -> /app)
    return current.parents[1]


_ROOT = _detect_root()
if str(_ROOT) not in sys.path:
    sys.path.append(str(_ROOT))
SRC_ROOT = _ROOT / "src"
if SRC_ROOT.exists():
    src_str = str(SRC_ROOT)
    if src_str not in sys.path:
        sys.path.append(src_str)


class Paths(BaseModel):
    root: Path = _ROOT

    @property
    def dataset(self) -> Path:
        return self.root / "data" / "processed" / "preprocessed_data.csv"

    @property
    def model_metadata(self) -> Path:
        return self.root / "models" / "production" / "model_metadata.json"

    @property
    def deployment_dir(self) -> Path:
        return self.root / "experiments" / "new_lstm" / "deployment_2025"

    @property
    def dataset_cache(self) -> Path:
        return self.deployment_dir / "dataset_cache.npz"

    @property
    def model_checkpoint(self) -> Path:
        # Production model: pro_level_production_model.pt (train ≤12/11/2025, inference As At / Current)
        # Must match scripts/run_pro_level_production_training.py output
        return self.root / "experiments" / "models" / "production" / "pro_level_production_model.pt"

    @property
    def results_dir(self) -> Path:
        return self.root / "experiments" / "results"

    @property
    def scaler_dir(self) -> Path:
        # Production scalers: same directory as model, copied during production training
        # Must match experiments/models/production/scalers/ (sequence_scaler.npz, static_scaler.joblib, kmeans_model.joblib, kmeans_scaler.joblib)
        return self.root / "experiments" / "models" / "production" / "scalers"

    @property
    def calibration_params_path(self) -> Path:
        # Temperature scaling fitted on 2023 holdout (frozen; matches backtesting)
        return self.root / "experiments" / "results" / "calibration_params_pro_level_2023_temperature.json"


class Settings(BaseSettings):
    api_prefix: str = "/api"
    dataset_path: Path = Paths().dataset
    model_metadata_path: Path = Paths().model_metadata
    dataset_cache_path: Path = Paths().dataset_cache
    model_weights_path: Path = Paths().model_checkpoint
    results_dir: Path = Paths().results_dir
    scaler_dir: Path = Paths().scaler_dir
    calibration_params_path: Path = Paths().calibration_params_path
    default_player_limit: int = 10
    cache_refresh_minutes: int = 30
    # Override calibration temperature (e.g. 1.0 = no calibration). Unset = use JSON params.
    calibration_temperature_override: Optional[float] = None

    class Config:
        env_prefix = "TPD_"
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()

