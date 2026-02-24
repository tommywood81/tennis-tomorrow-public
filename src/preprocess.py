"""
Data preprocessing module.

Transforms raw ATP match data into player/opponent format and applies basic cleaning.
"""

import logging
from pathlib import Path
from typing import List

import pandas as pd

logger = logging.getLogger(__name__)


def _load_raw_matches(raw_dir: Path) -> pd.DataFrame:
    """Load and concatenate raw ATP match files (winner/loser format)."""
    csv_paths: List[Path] = sorted(raw_dir.glob("atp_matches_*.csv"))
    older_years_dir = raw_dir / "older_years"
    if older_years_dir.exists():
        csv_paths.extend(sorted(older_years_dir.glob("atp_matches_*.csv")))

    if not csv_paths:
        raise FileNotFoundError(f"No raw match files found in {raw_dir}")

    frames = []
    for path in csv_paths:
        frame = pd.read_csv(path)
        frames.append(frame)
        logger.info("Loaded %s (%d rows)", path.name, len(frame))

    combined = pd.concat(frames, ignore_index=True)
    logger.info("Combined %d rows from %d raw files", len(combined), len(csv_paths))
    return combined


def main() -> None:
    """
    Preprocess raw ATP data.
    """
    logger.info("Starting data preprocessing...")

    project_root = Path(__file__).parent.parent.resolve()
    processed_dir = project_root / "data" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)
    raw_dir = project_root / "data" / "raw"

    input_path = processed_dir / "atp_matches.csv"
    output_path = processed_dir / "preprocessed_data.csv"

    try:
        df = _load_raw_matches(raw_dir)
        df.to_csv(input_path, index=False)
        logger.info("Wrote merged raw dataset to %s", input_path)
    except FileNotFoundError:
        logger.warning("Raw match files not found; expecting merged dataset at %s", input_path)
        if not input_path.exists():
            logger.error("Merged dataset missing; aborting preprocessing.")
            return
        df = pd.read_csv(input_path)
        logger.info("Loaded %d rows from existing merged dataset", len(df))
    
    # Basic cleaning - ensure we have required columns
    required_cols = ['winner_name', 'loser_name', 'tourney_date']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        logger.warning(f"Missing required columns: {missing_cols}")
    
    # Transform to player/opponent format (dual perspective)
    logger.info("Transforming to player/opponent format...")
    processed_data = transform_to_player_opponent(df)
    
    # Save preprocessed data
    processed_data.to_csv(output_path, index=False)
    logger.info(f"Preprocessed data saved to {output_path} ({len(processed_data)} rows)")


def transform_to_player_opponent(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transform winner/loser format to player/opponent format (dual perspective).
    
    Maps w_* columns to player columns and l_* columns to opponent columns.
    
    Args:
        df: DataFrame with winner_name, loser_name columns and w_*/l_* service stats
        
    Returns:
        DataFrame with player, opponent, label columns (2x rows)
    """
    # Define column mappings: w_* -> player, l_* -> opponent
    service_stat_mappings = {
        'w_ace': 'ace',
        'w_df': 'df',
        'w_svpt': 'svpt',
        'w_1stIn': '1stIn',
        'w_1stWon': '1stWon',
        'w_2ndWon': '2ndWon',
        'w_SvGms': 'SvGms',
        'w_bpSaved': 'bpSaved',
        'w_bpFaced': 'bpFaced',
        'l_ace': 'opponent_ace',
        'l_df': 'opponent_df',
        'l_svpt': 'opponent_svpt',
        'l_1stIn': 'opponent_1stIn',
        'l_1stWon': 'opponent_1stWon',
        'l_2ndWon': 'opponent_2ndWon',
        'l_SvGms': 'opponent_SvGms',
        'l_bpSaved': 'opponent_bpSaved',
        'l_bpFaced': 'opponent_bpFaced',
    }
    
    # Rank mappings
    rank_mappings = {
        'winner_rank': 'player_rank',
        'loser_rank': 'opponent_rank',
    }
    
    # Preserve tourney_date before transformation
    tourney_date_original = df['tourney_date'].copy() if 'tourney_date' in df.columns else None
    
    # Winner perspective
    winner_perspective = df.copy()
    winner_perspective['player'] = winner_perspective['winner_name']
    winner_perspective['opponent'] = winner_perspective['loser_name']
    winner_perspective['label'] = 1
    # Preserve tourney_date explicitly
    if tourney_date_original is not None:
        winner_perspective['tourney_date'] = tourney_date_original.values
    
    # Map winner columns to player columns
    for old_col, new_col in service_stat_mappings.items():
        if old_col in winner_perspective.columns:
            winner_perspective[new_col] = winner_perspective[old_col]
    
    # Map ranks
    for old_col, new_col in rank_mappings.items():
        if old_col in winner_perspective.columns:
            winner_perspective[new_col] = winner_perspective[old_col]
    
    # Loser perspective
    loser_perspective = df.copy()
    loser_perspective['player'] = loser_perspective['loser_name']
    loser_perspective['opponent'] = loser_perspective['winner_name']
    loser_perspective['label'] = 0
    # Preserve tourney_date explicitly
    if tourney_date_original is not None:
        loser_perspective['tourney_date'] = tourney_date_original.values
    
    # Map loser columns to player columns, winner columns to opponent columns
    # For loser perspective: l_* -> player, w_* -> opponent
    loser_service_mappings = {
        'l_ace': 'ace',
        'l_df': 'df',
        'l_svpt': 'svpt',
        'l_1stIn': '1stIn',
        'l_1stWon': '1stWon',
        'l_2ndWon': '2ndWon',
        'l_SvGms': 'SvGms',
        'l_bpSaved': 'bpSaved',
        'l_bpFaced': 'bpFaced',
        'w_ace': 'opponent_ace',
        'w_df': 'opponent_df',
        'w_svpt': 'opponent_svpt',
        'w_1stIn': 'opponent_1stIn',
        'w_1stWon': 'opponent_1stWon',
        'w_2ndWon': 'opponent_2ndWon',
        'w_SvGms': 'opponent_SvGms',
        'w_bpSaved': 'opponent_bpSaved',
        'w_bpFaced': 'opponent_bpFaced',
    }
    
    for old_col, new_col in loser_service_mappings.items():
        if old_col in loser_perspective.columns:
            loser_perspective[new_col] = loser_perspective[old_col]
    
    # Map ranks for loser perspective
    loser_rank_mappings = {
        'loser_rank': 'player_rank',
        'winner_rank': 'opponent_rank',
    }
    for old_col, new_col in loser_rank_mappings.items():
        if old_col in loser_perspective.columns:
            loser_perspective[new_col] = loser_perspective[old_col]
    
    # Combine
    result = pd.concat([winner_perspective, loser_perspective], ignore_index=True)

    # Collapse ATP 250 and 500 into a single bucket (letters B/500 -> A)
    if "tourney_level" in result.columns:
        result["tourney_level"] = result["tourney_level"].replace(
            {"B": "A", "500": "A"}
        )
    
    # Create match_id for strategies that need it to merge opponent features
    # Use a combination that uniquely identifies each match from both perspectives
    if 'match_id' not in result.columns:
        # Create match_id from player, opponent, and tourney_date
        # This ensures both perspectives of the same match have the same match_id
        # Sort names to ensure consistency (player < opponent alphabetically)
        result['match_id'] = (
            result[['player', 'opponent', 'tourney_date']].apply(
                lambda x: f"{min(x['player'], x['opponent'])}_{max(x['player'], x['opponent'])}_{x['tourney_date']}",
                axis=1
            )
        )
        logger.info("Created match_id column for opponent feature merging")
    
    # Ensure tourney_date is in integer format (YYYYMMDD)
    if 'tourney_date' in result.columns:
        if pd.api.types.is_integer_dtype(result['tourney_date']):
            # Already integer, keep as-is (should be YYYYMMDD format)
            pass
        elif pd.api.types.is_datetime64_any_dtype(result['tourney_date']):
            result['tourney_date'] = result['tourney_date'].dt.strftime('%Y%m%d').astype(int)
        elif result['tourney_date'].dtype == 'object':
            # Try to parse as date
            result['tourney_date'] = pd.to_datetime(result['tourney_date'], errors='coerce').dt.strftime('%Y%m%d').astype(int)
        # Fill any NaN values that might have been created
        if result['tourney_date'].isna().any():
            logger.warning(f"Found {result['tourney_date'].isna().sum()} rows with invalid tourney_date, filling with 0")
            result['tourney_date'] = result['tourney_date'].fillna(0).astype(int)
    
    return result.sort_values(['player', 'tourney_date']).reset_index(drop=True)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    main()
