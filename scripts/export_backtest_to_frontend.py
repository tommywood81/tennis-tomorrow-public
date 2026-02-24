"""
Export backtest results and graphs to frontend/public/backtesting for static display.

Run after apply_calibration_and_backtest.py (and optionally calibration_reliability_curve.py,
diagnose_underdog_bets.py). Copies summary JSON and PNGs so the BacktestingPage can load
them without hitting the backend API.

Usage:
  python scripts/export_backtest_to_frontend.py
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
ODDS_RESULTS = ROOT / "experiments" / "odds" / "results"
TABLES_DIR = ODDS_RESULTS / "tables"
TEMPERATURE_DIR = ODDS_RESULTS / "temperature_bookmaker"
FRONTEND_PUBLIC = ROOT / "services" / "frontend" / "public" / "backtesting"


def main() -> int:
    FRONTEND_PUBLIC.mkdir(parents=True, exist_ok=True)

    # 1. Export summary from best_strategy_summary.csv
    summary_path = TABLES_DIR / "best_strategy_summary.csv"
    if summary_path.exists():
        df = pd.read_csv(summary_path)
        strategies = []
        for _, row in df.iterrows():
            strategies.append({
                "strategy": str(row["strategy"]),
                "num_bets_placed": int(row["num_bets_placed"]),
                "bets_won": int(row["bets_won"]),
                "bets_lost": int(row["bets_lost"]),
                "win_rate": float(row["win_rate"]),
                "final_bankroll": float(row["final_bankroll"]),
                "total_profit": float(row["total_profit"]),
                "roi_pct": float(row["roi_pct"]),
                "max_drawdown": float(row["max_drawdown"]),
                "risk_adjusted_roi": float(row["risk_adjusted_roi"]),
                "pct_bet_on": float(row["pct_bet_on"]),
            })
        total_matches = int(df.iloc[0]["num_total_matches"]) if len(df) > 0 else 0
        calib_exists = (ODDS_RESULTS / "calibration_reliability_curve.png").exists()
        underdog_exists = (ODDS_RESULTS / "underdog_diagnostic.png").exists()
        summary = {
            "strategies": strategies,
            "total_matches": total_matches,
            "note": "Results from validation model (trained ≤2023) evaluated on 2025 test set with real betting odds",
            "calibration_reliability_exists": calib_exists,
            "underdog_diagnostic_exists": underdog_exists,
        }
        out_summary = FRONTEND_PUBLIC / "summary.json"
        with open(out_summary, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        print(f"Exported summary: {out_summary}")
    else:
        print(f"Warning: {summary_path} not found. Run apply_calibration_and_backtest.py first.")

    # 2. Copy calibration reliability graph
    src = ODDS_RESULTS / "calibration_reliability_curve.png"
    if src.exists():
        shutil.copy2(src, FRONTEND_PUBLIC / "calibration_reliability_curve.png")
        print(f"Copied: calibration_reliability_curve.png")
    else:
        print(f"Skip: {src} not found (run calibration_reliability_curve.py)")

    # 3. Copy underdog diagnostic graph
    src = ODDS_RESULTS / "underdog_diagnostic.png"
    if src.exists():
        shutil.copy2(src, FRONTEND_PUBLIC / "underdog_diagnostic.png")
        print(f"Copied: underdog_diagnostic.png")
    else:
        print(f"Skip: {src} not found (run diagnose_underdog_bets.py)")

    # 4. Export temperature optimization if present
    optimal_path = TEMPERATURE_DIR / "optimal_temperature.json"
    comparison_path = TEMPERATURE_DIR / "temperature_comparison_table.csv"
    if optimal_path.exists() and comparison_path.exists():
        with open(optimal_path, "r") as f:
            optimal_t = json.load(f)
        comparison_df = pd.read_csv(comparison_path)
        comparison_rows = []
        for _, row in comparison_df.iterrows():
            comparison_rows.append({
                "temperature": float(row["temperature"]),
                "bets": int(row["bets"]),
                "profit": float(row["profit"]),
                "roi": float(row["roi"]),
                "hit_rate": float(row["hit_rate"]),
                "avg_edge": float(row["avg_edge"]),
                "max_drawdown": float(row["max_drawdown"]),
            })
        equity_csv = TEMPERATURE_DIR / "equity_curve.csv"
        equity_data = None
        if equity_csv.exists():
            eq_df = pd.read_csv(equity_csv)
            equity_data = {
                "bet_number": eq_df["bet_number"].tolist(),
                "bankroll": eq_df["bankroll"].tolist(),
            }
        equity_png = TEMPERATURE_DIR / "equity_curve.png"
        if equity_png.exists():
            shutil.copy2(equity_png, FRONTEND_PUBLIC / "equity_curve.png")
            print(f"Copied: equity_curve.png")
        temp_out = {
            "optimal_temperature": optimal_t,
            "comparison_table": comparison_rows,
            "equity_curve": equity_data,
            "equity_curve_image_exists": equity_png.exists(),
        }
        with open(FRONTEND_PUBLIC / "temperature_optimization.json", "w", encoding="utf-8") as f:
            json.dump(temp_out, f, indent=2)
        print(f"Exported: temperature_optimization.json")
    else:
        print(f"Skip: temperature optimization not found (run temperature_bookmaker_backtest.py)")

    print(f"\nDone. Frontend static files in {FRONTEND_PUBLIC}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
