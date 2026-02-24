"""
Apply temperature scaling to existing pro-level 2025 predictions and run backtesting.

Reads: experiments/results/tournament_predictions_pro_level_2025_*.json (latest)
       experiments/results/calibration_params_pro_level_2023_temperature.json (fitted on 2023)
Writes: experiments/odds/data/tournament_predictions_2025.json (overwrite)
Then runs: experiments/odds/back_testing.py -use_tennis_data_odds -quarter_kelly
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from calibration_utils import apply_calibration, load_calibration_params

RESULTS_DIR = ROOT / "experiments" / "results"
ODDS_DATA_DIR = ROOT / "experiments" / "odds" / "data"
# Must match calibration from run_pro_level_final_training (fitted on 2023 holdout)
CALIBRATION_PARAMS_PATH = RESULTS_DIR / "calibration_params_pro_level_2023_temperature.json"
OUTPUT_JSON = ODDS_DATA_DIR / "tournament_predictions_2025.json"


def main() -> int:
    # Find latest pro-level 2025 JSON
    candidates = list(RESULTS_DIR.glob("tournament_predictions_pro_level_2025_*.json"))
    if not candidates:
        print(f"No pro-level 2025 JSON found in {RESULTS_DIR}")
        return 1
    input_json = max(candidates, key=lambda p: p.stat().st_mtime)
    print(f"Using predictions: {input_json.name}")

    if not CALIBRATION_PARAMS_PATH.exists():
        print(f"Calibration params not found: {CALIBRATION_PARAMS_PATH}")
        return 1
    params = load_calibration_params(CALIBRATION_PARAMS_PATH)
    if not params:
        print("Failed to load calibration params")
        return 1
    print(f"Applying calibration: {params.get('method', '?')} (T={params.get('temperature', 'N/A')})")

    with open(input_json, encoding="utf-8") as f:
        data = json.load(f)

    for match_id, m in data.items():
        # Use raw prob if available; otherwise assume already calibrated (legacy format)
        if "raw_probability_player_one" in m:
            p1_cal = float(apply_calibration(np.array([m["raw_probability_player_one"]]), params)[0])
        else:
            p1_cal = m["predicted_probability_player_one"]
        p2_cal = 1.0 - p1_cal
        m["predicted_probability_player_one"] = p1_cal
        m["predicted_probability_player_two"] = p2_cal

    ODDS_DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Wrote {len(data)} matches to {OUTPUT_JSON}")

    print("\nRunning backtesting...")
    cmd = [
        sys.executable,
        str(ROOT / "experiments" / "odds" / "back_testing.py"),
        "-use_tennis_data_odds",
        "-quarter_kelly",
    ]
    rc = subprocess.call(cmd, cwd=str(ROOT))
    if rc != 0:
        return rc

    # Export results to frontend for static display (no backend API needed)
    print("\nExporting backtest results to frontend...")
    export_script = ROOT / "scripts" / "export_backtest_to_frontend.py"
    if export_script.exists():
        subprocess.call([sys.executable, str(export_script)], cwd=str(ROOT))
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
