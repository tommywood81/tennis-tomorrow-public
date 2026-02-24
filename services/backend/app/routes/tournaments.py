from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List, Optional
import pandas as pd
import numpy as np
from datetime import datetime

from pathlib import Path
import torch
from torch import nn

from ..data_access import get_repository
from ..services.model_service import get_model_service
from ..services.tournament_cache_service import get_tournament_cache_service
from ..schemas import Tournament, TournamentRound, TournamentMatch, PlayerSummary
from ..config import get_settings

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


def _get_test_evaluation_model():
    """
    Get the model trained on ≤2023 data for evaluating 2025 test set.
    
    This is different from the production model which was trained on all data up to 2025.
    For proper retrospective evaluation, we need the model that was trained on ≤2023.
    
    The full_validation_2024 model:
    - Train: ≤2023 (217,960 samples)
    - Validation: 2024 (3,153 matches)
    - Test: 2025 (2,811 matches)
    - Match accuracy on 2025 test: 82.68%
    """
    from ..config import Paths
    paths = Paths()
    
    # Use the full_validation model: train ≤2023, validate 2024, test 2025
    test_model_path = paths.root / "experiments" / "new_lstm" / "split_2025_default" / "full_validation_full_validation_2024_model.pt"
    
    if not test_model_path.exists():
        # Fallback to production model if test model not found
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Test evaluation model not found at {test_model_path}, using production model")
        logger.warning("WARNING: Production model was trained on 2025 data - predictions may not be accurate for 2025 test set evaluation")
        return get_model_service()
    
    # Load the test evaluation model
    from new_lstm_strategy.config import NewLSTMConfig
    from new_lstm_strategy.model import DualBranchLSTM
    from ..services.dynamic_feature_service import get_dynamic_feature_service
    
    lstm_config = NewLSTMConfig()
    dynamic_store = get_dynamic_feature_service()
    
    model = DualBranchLSTM(
        seq_input_dim=dynamic_store.sequence_dim,
        static_input_dim=dynamic_store.static_dim,
        lstm_hidden=lstm_config.lstm_hidden,
        lstm_layers=lstm_config.lstm_layers,
        dropout=lstm_config.dropout,
    )
    model.load_state_dict(torch.load(test_model_path, map_location=torch.device("cpu")))
    model.eval()
    
    # Note: We use the same scalers from deployment_2025
    # The scalers should be very similar since both models use the same preprocessing
    # For maximum accuracy, we could load scalers from split_2025_default/scalers/,
    # but the deployment scalers should work fine for this evaluation
    
    # Create a temporary model service with this model
    # We'll override the model in the service
    production_service = get_model_service()
    with production_service._model_lock:
        production_service._model = model  # Override the model
    
    return production_service


@router.get("", response_model=List[Tournament])
def list_tournaments(year: int = Query(2025, description="Year to get tournaments for (2024 or 2025)")):
    """
    List all tournaments (all surfaces) with match predictions for a given year.
    
    Args:
        year: Year to get tournaments for (2024 or 2025). Defaults to 2025.
    
    Returns tournaments from the test set for the specified year, organized by tournament.
    Includes all surfaces (hard, clay, grass) and all tournament levels (ATP 250, 500, Masters 1000, Grand Slams).
    Excludes Davis Cup and United Cup matches.
    Uses cached predictions (pre-computed) for fast response.
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Loading tournaments from cache for year {year}...")
    
    if year not in [2024, 2025]:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Year must be 2024 or 2025")
    
    cache_service = get_tournament_cache_service()
    
    # Load cache - must be pre-generated using scripts/generate_cache_from_training_features.py
    # We don't auto-generate here because it would use dynamic features (wrong for historical evaluation)
    cache = cache_service.load_cache(year)
    if cache is None:
        logger.error(
            f"Cache not found for {year}. "
            f"Please generate it using: python scripts/generate_cache_from_training_features.py --year {year}"
        )
        raise HTTPException(
            status_code=404,
            detail=f"Tournament cache for {year} not found. Please generate it using the correct script."
        )
    
    # Filter cache by requested year (cache may contain matches from multiple years)
    filtered_cache = {}
    for match_id, match_data in cache.items():
        match_date = match_data.get("date")
        if match_date is None:
            continue
        
        # Extract year from date (handle both string "2024-01-15" and integer 20240115 formats)
        if isinstance(match_date, str):
            date_year = int(match_date.split("-")[0]) if "-" in match_date else int(match_date[:4])
        else:
            # Integer format (YYYYMMDD)
            date_str = str(match_date)
            date_year = int(date_str[:4]) if len(date_str) >= 4 else None
        
        # Only include matches from the requested year
        if date_year == year:
            filtered_cache[match_id] = match_data
    
    logger.info(f"Filtered cache: {len(filtered_cache)} matches for year {year} (from {len(cache)} total matches in cache)")
    
    # Group cached matches by tournament
    # Use composite key (tournament_name + date) to handle duplicates with different tourney_ids
    tournaments_dict: Dict[str, Dict] = {}
    import math  # Import at function level for NaN checks
    
    for match_id, match_data in filtered_cache.items():
        tourney_id = match_data["tourney_id"]
        tourney_name = match_data["tourney_name"]
        tourney_level = match_data.get("tourney_level", "M")  # Default to Masters if not present
        match_date = match_data["date"]
        
        # Filter out Davis Cup matches (tourney_level = "D") and United Cup matches
        if tourney_level == "D" or "United Cup" in tourney_name or "Davis Cup" in tourney_name:
            continue
        
        # Create a composite key using tournament name and year-month to deduplicate
        # This handles cases where the same tournament has different tourney_ids
        if isinstance(match_date, str):
            date_parts = match_date.split("-")
            year_month = f"{date_parts[0]}-{date_parts[1]}" if len(date_parts) >= 2 else match_date[:7]
        else:
            # Handle integer dates (YYYYMMDD format)
            date_str = str(match_date)
            year_month = f"{date_str[:4]}-{date_str[4:6]}" if len(date_str) >= 6 else date_str[:7]
        composite_key = f"{tourney_name}_{year_month}"
        
        if composite_key not in tournaments_dict:
            # Extract surface from match data, default to "Hard" if not present
            surface = match_data.get("surface", "Hard")
            if surface is None or (isinstance(surface, float) and math.isnan(surface)):
                surface = "Hard"
            else:
                surface = str(surface)
            
            tournaments_dict[composite_key] = {
                "tournament_id": tourney_id,  # Use first encountered tourney_id
                "tournament_name": tourney_name,
                "tournament_level": tourney_level,
                "start_date": match_date,
                "end_date": match_date,
                "surface": surface,
                "matches": [],
                "match_predictions": [],  # Store match predictions for accuracy calculation
            }
        
        # Update dates
        if match_date > tournaments_dict[composite_key]["end_date"]:
            tournaments_dict[composite_key]["end_date"] = match_date
        if match_date < tournaments_dict[composite_key]["start_date"]:
            tournaments_dict[composite_key]["start_date"] = match_date
        
        # Convert cached data to TournamentMatch
        from ..schemas import FeatureImportance
        
        # Handle NaN/null values from cache
        round_name = match_data.get("round", "F")
        if round_name is None or (isinstance(round_name, float) and math.isnan(round_name)):
            round_name = "F"
        else:
            round_name = str(round_name)
        
        # Use surface from tournament dict (already extracted and validated)
        surface = tournaments_dict[composite_key]["surface"]
        
        top_features = [
            FeatureImportance(
                feature=f["feature"],
                importance=f["importance"],
                category=f["category"],
                display_name=f["display_name"],
            )
            for f in match_data.get("top_features", [])
        ]
        
        match_obj = TournamentMatch(
            match_id=match_data["match_id"],
            player_one=PlayerSummary(
                id=match_data["player_one"]["slug"],
                name=match_data["player_one"]["name"],
                country=match_data["player_one"].get("country"),
                last_rank=match_data["player_one"].get("last_rank"),
            ),
            player_two=PlayerSummary(
                id=match_data["player_two"]["slug"],
                name=match_data["player_two"]["name"],
                country=match_data["player_two"].get("country"),
                last_rank=match_data["player_two"].get("last_rank"),
            ),
            round=round_name,
            surface=surface,
            date=match_data["date"],
            actual_winner=match_data["actual_winner"],
            predicted_probability_player_one=match_data["predicted_probability_player_one"],
            predicted_probability_player_two=match_data["predicted_probability_player_two"],
            top_features=top_features,
        )
        
        tournaments_dict[composite_key]["matches"].append(match_obj)
        # Store prediction data for accuracy calculation (match-level: use softmax probabilities)
        tournaments_dict[composite_key]["match_predictions"].append({
            "predicted_probability_player_one": match_data["predicted_probability_player_one"],
            "predicted_probability_player_two": match_data["predicted_probability_player_two"],
            "actual_winner": match_data["actual_winner"],
        })
    
    # Calculate tournament-level accuracy and convert to Tournament objects
    tournaments = []
    # Log number of unique tournaments found
    logger.info(f"Found {len(tournaments_dict)} unique tournaments for {year}")
    for tourney_data in tournaments_dict.values():
        # Calculate match-level accuracy for this tournament
        # Match-level prediction: whichever player has higher softmax probability wins
        # This matches the overall accuracy calculation method (same as cache analysis)
        correct = 0
        total = 0
        for pred_data in tourney_data["match_predictions"]:
            prob_p1 = pred_data["predicted_probability_player_one"]
            prob_p2 = pred_data["predicted_probability_player_two"]
            actual_winner = pred_data["actual_winner"]
            
            # Match-level prediction: player with higher softmax probability wins
            # This is the same method used for overall accuracy calculation
            if prob_p1 > prob_p2:
                predicted_winner = "player_one"
            elif prob_p2 > prob_p1:
                predicted_winner = "player_two"
            else:
                # Edge case: equal probabilities (very rare), default to player_one
                predicted_winner = "player_one"
            
            if predicted_winner == actual_winner:
                correct += 1
            total += 1
        
        tournament_accuracy = correct / total if total > 0 else 0.0
        # Group matches by round
        matches_by_round: Dict[str, List[TournamentMatch]] = {}
        for match in tourney_data["matches"]:
            round_name = match.round
            if round_name not in matches_by_round:
                matches_by_round[round_name] = []
            matches_by_round[round_name].append(match)
        
        # Create rounds
        rounds = []
        round_order = ["R128", "R64", "R32", "R16", "QF", "SF", "F"]
        for round_name in round_order:
            if round_name in matches_by_round:
                rounds.append(TournamentRound(
                    round_name=round_name,
                    matches=matches_by_round[round_name],
                ))
        
        tournaments.append(Tournament(
            tournament_id=tourney_data["tournament_id"],
            tournament_name=tourney_data["tournament_name"],
            start_date=tourney_data["start_date"],
            end_date=tourney_data["end_date"],
            surface=tourney_data["surface"],
            tournament_level=tourney_data.get("tournament_level"),
            accuracy=tournament_accuracy,
            rounds=rounds,
        ))
    
    return tournaments


@router.get("/{tournament_id}", response_model=Tournament)
def get_tournament(tournament_id: str, year: int = Query(2025, description="Year to get tournament for (2024 or 2025)")):
    """
    Get a specific tournament with all matches and predictions.
    
    Args:
        tournament_id: Tournament identifier
        year: Year to get tournament for (2024 or 2025). Defaults to 2025.
    """
    tournaments = list_tournaments(year)
    for tournament in tournaments:
        if tournament.tournament_id == tournament_id:
            return tournament
    
    raise HTTPException(status_code=404, detail=f"Tournament {tournament_id} not found for year {year}")

