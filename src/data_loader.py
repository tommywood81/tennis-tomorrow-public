#!/usr/bin/env python3
"""
Data loading module for BreakPoint-AI pipeline.
"""

import pandas as pd
import logging
from pathlib import Path
from typing import Optional
from paths import DATA_PROCESSED

 
def merge_raw_atp_data() -> Optional[pd.DataFrame]:
    """Merge all raw ATP CSV files into a single atp_matches.csv file.
    
    Returns:
        Merged DataFrame with all ATP match data, or None if no files found.
    """
    """Merge all raw ATP CSV files into a single atp_matches.csv file."""
    project_root = Path(__file__).parent.parent.resolve()
    raw_dir = project_root / "data" / "raw"
    processed_dir = project_root / "data" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)
    out_path = processed_dir / "atp_matches.csv"
    
    # Get all CSV files
    csv_files = sorted(raw_dir.glob("atp_matches_*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in {raw_dir}")
    
    logging.info(f"Merging {len(csv_files)} ATP CSV files...")
    
    # Read and merge all files
    frames = []
    for i, file_path in enumerate(csv_files):
        logging.info(f"Reading {file_path.name}...")
        df = pd.read_csv(file_path)
        frames.append(df)
    
    # Concatenate all frames
    merged_df = pd.concat(frames, ignore_index=True)
    logging.info(f"Merged {len(frames)} files -> {len(merged_df)} rows")
    
    # Light cleaning: remove walkovers/retirements/defaulters; keep service stats intact
    logging.info("Cleaning invalid score rows (W/O, RET, DEF)...")
    if 'score' in merged_df.columns:
        invalid_mask = merged_df['score'].astype(str).str.contains(r"W/O|RET|DEF", na=False)
        before_rows = len(merged_df)
        removed = int(invalid_mask.sum())
        merged_df = merged_df[~invalid_mask].copy()
        logging.info(f"Removed invalid score rows: {removed} (from {before_rows} to {len(merged_df)})")
    else:
        logging.info("No score column found; skipping invalid score cleaning.")
    
    # Drop rows where only one player is ranked (need both ranked for meaningful predictions)
    logging.info("Filtering matches to only include both players ranked...")
    if 'winner_rank' in merged_df.columns and 'loser_rank' in merged_df.columns:
        before_rank_filter = len(merged_df)
        # Keep only rows where BOTH players have a rank
        merged_df = merged_df[
            merged_df['winner_rank'].notna() & merged_df['loser_rank'].notna()
        ].copy()
        after_rank_filter = len(merged_df)
        removed_unranked = before_rank_filter - after_rank_filter
        logging.info(f"Removed matches with unranked players: {removed_unranked} (from {before_rank_filter} to {after_rank_filter})")
    else:
        logging.info("Rank columns not found; skipping rank filtering.")
    
    # Ensure service stats are preserved - don't drop them
    logging.info("Preserving all service statistics...")
    service_cols = ['w_ace', 'w_df', 'w_svpt', 'w_1stIn', 'w_1stWon', 'w_2ndWon', 'w_SvGms', 'w_bpSaved', 'w_bpFaced',
                   'l_ace', 'l_df', 'l_svpt', 'l_1stIn', 'l_1stWon', 'l_2ndWon', 'l_SvGms', 'l_bpSaved', 'l_bpFaced']
    available_service = [col for col in service_cols if col in merged_df.columns]
    logging.info(f"Available service columns: {available_service}")
    
    # Don't drop service stats - keep them for feature engineering
    # Only drop rows with completely missing service data if needed
    if available_service:
        # Keep rows that have at least some service data
        service_data_mask = merged_df[available_service].notnull().any(axis=1)
        before_service = len(merged_df)
        merged_df = merged_df[service_data_mask].copy()
        logging.info(f"Kept rows with service data: {len(merged_df)} (from {before_service})")
    
    # Save merged data
    merged_df.to_csv(out_path, index=False)
    logging.info(f"Saved merged data to {out_path}")

