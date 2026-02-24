"""
Backtesting API endpoint - serves validation model backtesting results (2025 only).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import pandas as pd
import json

router = APIRouter(prefix="/backtesting", tags=["backtesting"])

ROOT = Path(__file__).resolve().parent.parent.parent.parent
BACKTEST_SUMMARY_PATH = ROOT / "experiments" / "odds" / "results" / "tables" / "best_strategy_summary.csv"
CALIBRATION_PLOT_PATH = ROOT / "experiments" / "results" / "calibration_pro_level_2025_temperature.png"
TEMPERATURE_DIR = ROOT / "experiments" / "odds" / "results" / "temperature_bookmaker"
TEMPERATURE_COMPARISON_PATH = TEMPERATURE_DIR / "temperature_comparison_table.csv"
OPTIMAL_TEMPERATURE_PATH = TEMPERATURE_DIR / "optimal_temperature.json"
EQUITY_CURVE_CSV_PATH = TEMPERATURE_DIR / "equity_curve.csv"
EQUITY_CURVE_PNG_PATH = TEMPERATURE_DIR / "equity_curve.png"
RESULTS_DIR = ROOT / "experiments" / "odds" / "results"
CALIBRATION_RELIABILITY_PNG = RESULTS_DIR / "calibration_reliability_curve.png"
UNDERDOG_DIAGNOSTIC_PNG = RESULTS_DIR / "underdog_diagnostic.png"


@router.get("/summary")
def get_backtest_summary():
    """
    Get backtesting summary (reads saved predictions only, no model calls).
    
    Uses pre-saved 2024-2025 predictions from run_pro_level_final_training.
    Backtesting MUST only read from saved files. See docs/FROZEN_WORKFLOW.md.
    """
    if not BACKTEST_SUMMARY_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Backtest summary not found at {BACKTEST_SUMMARY_PATH}. Run backtesting pipeline first."
        )
    
    df = pd.read_csv(BACKTEST_SUMMARY_PATH)
    
    # Filter to strategies we want to show (half_kelly, quarter_kelly, flat)
    # If quarter_kelly is the only one, that's fine
    strategies_to_show = ['half_kelly', 'quarter_kelly', 'flat']
    df_filtered = df[df['strategy'].isin(strategies_to_show)]
    
    if df_filtered.empty:
        # Fallback to whatever is available
        df_filtered = df
    
    # Convert to dict format
    strategies = []
    for _, row in df_filtered.iterrows():
        strategies.append({
            "strategy": row['strategy'],
            "num_bets_placed": int(row['num_bets_placed']),
            "bets_won": int(row['bets_won']),
            "bets_lost": int(row['bets_lost']),
            "win_rate": float(row['win_rate']),
            "final_bankroll": float(row['final_bankroll']),
            "total_profit": float(row['total_profit']),
            "roi_pct": float(row['roi_pct']),
            "max_drawdown": float(row['max_drawdown']),
            "risk_adjusted_roi": float(row['risk_adjusted_roi']),
            "pct_bet_on": float(row['pct_bet_on']),
        })
    
    return {
        "strategies": strategies,
        "total_matches": int(df.iloc[0]['num_total_matches']) if len(df) > 0 else 0,
        "note": "Results from validation model (trained ≤2023) evaluated on 2025 test set with real betting odds",
        "calibration_reliability_exists": CALIBRATION_RELIABILITY_PNG.exists(),
        "underdog_diagnostic_exists": UNDERDOG_DIAGNOSTIC_PNG.exists(),
    }


@router.get("/calibration-plot")
def get_calibration_plot():
    """
    Check if calibration plot exists (for display on backtesting page).
    """
    exists = CALIBRATION_PLOT_PATH.exists()
    return {
        "exists": exists,
        "path": str(CALIBRATION_PLOT_PATH.relative_to(ROOT)) if exists else None,
    }


@router.get("/equity-curve-image")
def get_equity_curve_image():
    """
    Serve equity curve PNG image.
    """
    if not EQUITY_CURVE_PNG_PATH.exists():
        raise HTTPException(status_code=404, detail="Equity curve image not found")
    return FileResponse(EQUITY_CURVE_PNG_PATH, media_type="image/png")


@router.get("/calibration-reliability-image")
def get_calibration_reliability_image():
    """
    Serve calibration reliability curve PNG (from calibration_reliability_curve.py).
    """
    if not CALIBRATION_RELIABILITY_PNG.exists():
        raise HTTPException(status_code=404, detail="Calibration reliability image not found")
    return FileResponse(CALIBRATION_RELIABILITY_PNG, media_type="image/png")


@router.get("/underdog-diagnostic-image")
def get_underdog_diagnostic_image():
    """
    Serve underdog diagnostic PNG (from diagnose_underdog_bets.py).
    """
    if not UNDERDOG_DIAGNOSTIC_PNG.exists():
        raise HTTPException(status_code=404, detail="Underdog diagnostic image not found")
    return FileResponse(UNDERDOG_DIAGNOSTIC_PNG, media_type="image/png")


@router.get("/temperature-optimization")
def get_temperature_optimization():
    """
    Get temperature optimization results (simple file read, no fancy API).
    """
    if not OPTIMAL_TEMPERATURE_PATH.exists() or not TEMPERATURE_COMPARISON_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Temperature optimization results not found. Run temperature_bookmaker_backtest.py first."
        )
    
    # Load optimal T
    with open(OPTIMAL_TEMPERATURE_PATH, "r") as f:
        optimal_t = json.load(f)
    
    # Load comparison table
    comparison_df = pd.read_csv(TEMPERATURE_COMPARISON_PATH)
    
    # Load equity curve data
    equity_data = None
    if EQUITY_CURVE_CSV_PATH.exists():
        equity_df = pd.read_csv(EQUITY_CURVE_CSV_PATH)
        equity_data = {
            "bet_number": equity_df["bet_number"].tolist(),
            "bankroll": equity_df["bankroll"].tolist(),
        }
    
    # Format comparison table
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
    
    return {
        "optimal_temperature": optimal_t,
        "comparison_table": comparison_rows,
        "equity_curve": equity_data,
        "equity_curve_image_exists": EQUITY_CURVE_PNG_PATH.exists(),
        "equity_curve_image_path": str(EQUITY_CURVE_PNG_PATH.relative_to(ROOT)) if EQUITY_CURVE_PNG_PATH.exists() else None,
    }
