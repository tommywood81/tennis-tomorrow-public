# src/tennis_forecast/paths.py
from pathlib import Path

# git repo root == file three parents up from here
ROOT = Path(__file__).resolve().parents[1]

DATA_RAW = ROOT / "data" / "raw"
DATA_DIR = ROOT / "data"
DATA_PROCESSED = ROOT / "data" / "processed"
ARTIFACTS = ROOT / "artifacts"
MODEL_DIR = ARTIFACTS / "models"
TENSORBOARD = ARTIFACTS / "runs" / "seq_model"
TBRUNS = ARTIFACTS / "runs" / "seq_model"
CONFIGS = ROOT / "configs"


