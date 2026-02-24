from __future__ import annotations

import json
import logging
import math
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import torch
from slugify import slugify

from ..config import Paths, get_settings
from ..data_access import get_repository
from ..services.model_service import get_model_service
from ..schemas import MatchPredictionRequest

logger = logging.getLogger(__name__)


class TournamentCacheService:
    """Service to cache tournament predictions for fast retrieval."""
    
    def __init__(self):
        self.settings = get_settings()
        self.paths = Paths()
    
    def _get_cache_path(self, year: int) -> Path:
        """Get cache file path for a given year.
        
        Uses validation model predictions (pro-level, trained on ≤2023).
        For 2024: tournament_predictions_pro_level_2024_*.json (latest)
        For 2025: tournament_predictions_pro_level_2025_*.json (latest)
        """
        # Find latest pro-level validation predictions
        pattern = f"tournament_predictions_pro_level_{year}_*.json"
        candidates = list(self.paths.results_dir.glob(pattern))
        if candidates:
            # Return most recent
            return max(candidates, key=lambda p: p.stat().st_mtime)
        # Fallback to old naming convention
        return self.paths.results_dir / f"tournament_predictions_{year}.json"
    
    def _get_test_evaluation_model(self, year: int):
        """Get the model for evaluating test set predictions for a given year.
        
        Model naming convention and paths:
        - 2024: Phase 1 Validation model
          Path: experiments/new_lstm/phase1_2024/phase1_validation_phase1_validation_model.pt
          Scalers: experiments/new_lstm/phase1_2024/scalers/
          Training: Train ≤2022, Validate 2023, Test 2024
          Match-level accuracy: 82.09% on 2024 test set
        
        - 2025: Full Validation model
          Path: experiments/new_lstm/split_2025_default/full_validation_full_validation_2024_model.pt
          Scalers: experiments/new_lstm/split_2025_default/scalers/
          Training: Train ≤2023, Validate 2024, Test 2025
          Match-level accuracy: 82.14% on 2025 test set
        
        IMPORTANT: We must use the same scalers that were used during training to get matching predictions.
        """
        from ..config import Paths, Settings
        from new_lstm_strategy.config import NewLSTMConfig
        from new_lstm_strategy.model import DualBranchLSTM
        from ..services.dynamic_feature_service import DynamicFeatureService
        import torch
        
        paths = Paths()
        
        if year == 2024:
            # Phase 1 model: train ≤2022, validate 2023, test 2024
            test_model_path = paths.root / "experiments" / "new_lstm" / "phase1_2024" / "phase1_validation_phase1_validation_model.pt"
            scaler_dir = paths.root / "experiments" / "new_lstm" / "phase1_2024" / "scalers"
        elif year == 2025:
            # Full Validation model: train ≤2023, validate 2024, test 2025
            test_model_path = paths.root / "experiments" / "new_lstm" / "split_2025_default" / "full_validation_full_validation_2024_model.pt"
            scaler_dir = paths.root / "experiments" / "new_lstm" / "split_2025_default" / "scalers"
        else:
            logger.warning(f"Unknown year {year}, using production model")
            return get_model_service()
        
        if not test_model_path.exists():
            logger.warning(f"Test evaluation model not found at {test_model_path}, using production model")
            return get_model_service()
        
        if not scaler_dir.exists():
            logger.warning(f"Scaler directory not found at {scaler_dir}, using production scalers")
            return get_model_service()
        
        lstm_config = NewLSTMConfig()
        
        # Create a custom settings object with the correct scaler directory
        settings = Settings()
        settings.scaler_dir = scaler_dir
        
        # Create dynamic feature service with correct scalers
        dynamic_store = DynamicFeatureService(settings)
        
        model = DualBranchLSTM(
            seq_input_dim=dynamic_store.sequence_dim,
            static_input_dim=dynamic_store.static_dim,
            lstm_hidden=lstm_config.lstm_hidden,
            lstm_layers=lstm_config.lstm_layers,
            dropout=lstm_config.dropout,
        )
        model.load_state_dict(torch.load(test_model_path, map_location=torch.device("cpu")))
        model.eval()
        
        # Create a model service with the correct model and scalers
        from ..services.model_service import ModelService
        model_service = ModelService(settings)
        model_service._model = model
        model_service._dynamic_store = dynamic_store
        
        return model_service
    
    def generate_cache(self, year: int = 2025) -> bool:
        """
        DEPRECATED: This method uses dynamic features which are incorrect for historical evaluation.
        
        For tournament evaluation cache generation, use scripts/generate_cache_from_training_features.py instead.
        That script uses pre-computed features from the training dataset cache, ensuring predictions match
        the training evaluation accuracy (82%).
        
        This method is kept for backward compatibility but should not be used for generating
        tournament evaluation caches.
        
        Args:
            year: Year to generate cache for (2024 or 2025)
        
        Returns True if cache was generated successfully, False otherwise.
        """
        logger.info(f"Starting prediction cache generation for {year} matches (all surfaces)...")
        
        repo = get_repository()
        model_service = self._get_test_evaluation_model(year)
        cache_path = self._get_cache_path(year)
        
        # Get matches from test set for the specified year
        df = repo._df
        
        # Filter to the specified year (include all surfaces and all tournament levels)
        # This matches the overall accuracy calculation which includes all surfaces
        mask = (df["tourney_date"] >= pd.Timestamp(f"{year}-01-01")) & \
               (df["tourney_date"] < pd.Timestamp(f"{year+1}-01-01"))
        
        test_matches = df[mask].copy()
        
        if len(test_matches) == 0:
            logger.warning(f"No {year} matches found")
            return False
        
        logger.info(f"Found {len(test_matches)} {year} matches (all surfaces, before deduplication, all tournament levels included)")
        
        # Create match_id if it doesn't exist
        if "match_id" not in test_matches.columns:
            test_matches["match_id"] = test_matches.apply(
                lambda row: "_".join(
                    sorted([
                        str(row["tourney_date"].strftime("%Y%m%d")),
                        str(row.get("player_slug", row.get("player", ""))),
                        str(row.get("opponent_slug", row.get("opponent", ""))),
                    ])
                ),
                axis=1,
            )
        
        # Deduplicate matches
        test_matches = test_matches.drop_duplicates(subset=["match_id"])
        logger.info(f"After deduplication: {len(test_matches)} unique matches")
        
        # Generate predictions for all matches
        cache: Dict[str, Dict] = {}
        total_matches = len(test_matches)
        processed = 0
        errors = 0
        
        for _, row in test_matches.iterrows():
            match_id = str(row.get("match_id", ""))
            if not match_id:
                continue
            
            player_one_slug = str(row.get("player_slug", row.get("player", "")))
            player_two_slug = str(row.get("opponent_slug", row.get("opponent", "")))
            
            player_one = repo.get_player(player_one_slug)
            player_two = repo.get_player(player_two_slug)
            
            if not player_one or not player_two:
                errors += 1
                continue
            
            # Determine actual winner
            winner_slug = str(row.get("winner_slug", ""))
            if not winner_slug:
                winner_name = str(row.get("winner_name", ""))
                if winner_name == player_one.name:
                    actual_winner = "player_one"
                elif winner_name == player_two.name:
                    actual_winner = "player_two"
                else:
                    errors += 1
                    continue
            else:
                if winner_slug == player_one_slug:
                    actual_winner = "player_one"
                elif winner_slug == player_two_slug:
                    actual_winner = "player_two"
                else:
                    errors += 1
                    continue
            
            # Compute prediction
            try:
                round_name = str(row.get("round", "F"))
                tourney_level = str(row.get("tourney_level", "M"))
                surface = str(row.get("surface", "Hard"))
                
                request = MatchPredictionRequest(
                    player_one=player_one_slug,
                    player_two=player_two_slug,
                    surface=surface,
                    round=round_name,
                    tournament_level=tourney_level,
                )
                
                prediction_response, feature_importance = model_service.predict(request)
                
                # Store in cache
                cache[match_id] = {
                    "match_id": match_id,
                    "tourney_id": str(row.get("tourney_id", "unknown")),
                    "tourney_name": str(row.get("tourney_name", "unknown")),
                    "tourney_level": tourney_level,
                    "date": row["tourney_date"].strftime("%Y-%m-%d"),
                    "round": round_name,
                    "surface": surface,
                    "player_one": {
                        "slug": player_one_slug,
                        "name": player_one.name,
                        "country": player_one.country,
                        "last_rank": player_one.last_rank,
                    },
                    "player_two": {
                        "slug": player_two_slug,
                        "name": player_two.name,
                        "country": player_two.country,
                        "last_rank": player_two.last_rank,
                    },
                    "actual_winner": actual_winner,
                    "predicted_probability_player_one": float(prediction_response.probabilities.player_one),
                    "predicted_probability_player_two": float(prediction_response.probabilities.player_two),
                    "top_features": [
                        {
                            "feature": f.feature,
                            "importance": float(f.importance),
                            "category": f.category,
                            "display_name": f.display_name,
                        }
                        for f in (feature_importance[:3] if feature_importance else [])
                    ],
                }
                
                processed += 1
                if processed % 100 == 0:
                    logger.info(f"Processed {processed}/{total_matches} matches ({processed*100//total_matches}%)...")
                    
            except Exception as e:
                logger.warning(f"Error processing match {player_one_slug} vs {player_two_slug}: {e}")
                errors += 1
                continue
        
        # Save cache to file
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        with cache_path.open("w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
        
        logger.info(f"Cache generation complete: {processed} matches cached, {errors} errors")
        logger.info(f"Cache saved to {cache_path}")
        
        return processed > 0
    
    def _generate_cache_from_deployment_2025(self) -> Optional[Dict[str, Dict]]:
        """
        Generate 2025 tournament cache from deployment dataset when split_2025_default is unavailable.
        Uses deployment_2025 dataset and model. Accuracy may differ from proper test evaluation
        (model may have seen 2025 during training).
        """
        dataset_path = self.paths.dataset_cache
        model_path = self.paths.model_checkpoint

        if not dataset_path.exists() or not model_path.exists():
            logger.warning(f"Cannot generate 2025 cache: deployment artifacts not found")
            return None

        try:
            logger.info("Generating 2025 tournament cache from deployment dataset...")
            data = np.load(dataset_path, allow_pickle=True)
            sequences = data["sequences"]
            static = data["static"]
            labels = data["labels"]
            metadata = pd.DataFrame(
                data["metadata"].tolist(),
                columns=["player", "opponent", "match_id", "tourney_date"],
            )

            # Normalize tourney_date for filtering (handle int, datetime, string)
            def to_int_date(x):
                if pd.isna(x):
                    return 0
                if isinstance(x, (int, float)) and not math.isnan(x):
                    return int(x)
                s = str(x)
                if len(s) >= 8 and s[:4].isdigit():
                    return int(s.replace("-", "")[:8])
                return 0

            metadata["_date_int"] = metadata["tourney_date"].apply(to_int_date)
            val_cutoff = 20241231
            test_mask = metadata["_date_int"] > val_cutoff
            test_indices = np.where(test_mask.values)[0]

            if len(test_indices) == 0:
                logger.warning("No 2025 matches found in deployment dataset")
                return None

            # Load deployment model
            from new_lstm_strategy.config import NewLSTMConfig
            from new_lstm_strategy.model import DualBranchLSTM

            lstm_config = NewLSTMConfig()
            model = DualBranchLSTM(
                seq_input_dim=sequences.shape[-1],
                static_input_dim=static.shape[-1],
                lstm_hidden=lstm_config.lstm_hidden,
                lstm_layers=lstm_config.lstm_layers,
                dropout=lstm_config.dropout,
            )
            model.load_state_dict(torch.load(model_path, map_location=torch.device("cpu")))
            model.eval()

            test_sequences = sequences[test_indices]
            test_static = static[test_indices]
            test_labels = labels[test_indices]
            test_metadata = metadata.iloc[test_indices].reset_index(drop=True)

            all_logits = []
            batch_size = 512
            with torch.no_grad():
                for i in range(0, len(test_sequences), batch_size):
                    batch_seq = torch.from_numpy(test_sequences[i : i + batch_size]).float()
                    batch_static = torch.from_numpy(test_static[i : i + batch_size]).float()
                    logits = model(batch_seq, batch_static)
                    all_logits.extend(logits.numpy().flatten())
            all_logits = np.array(all_logits)

            pred_df = pd.DataFrame({
                "logit": all_logits,
                "label": test_labels,
                "player": test_metadata["player"].values,
                "opponent": test_metadata["opponent"].values,
                "match_id": test_metadata["match_id"].values,
                "tourney_date": test_metadata["tourney_date"].values,
            })

            # Load preprocessed data for match details
            preprocessed_path = self.paths.root / "data" / "processed" / "preprocessed_data.csv"
            if not preprocessed_path.exists():
                logger.warning("Preprocessed data not found, using minimal match details")
                match_details_dict: Dict = {}
            else:
                df = pd.read_csv(preprocessed_path)
                match_details = df[
                    ["match_id", "surface", "round", "tourney_level", "tourney_id", "tourney_name", "winner_name"]
                ].drop_duplicates(subset=["match_id"])
                match_details_dict = match_details.set_index("match_id").to_dict("index")

            cache: Dict[str, Dict] = {}
            for match_id, group in pred_df.groupby("match_id"):
                if len(group) != 2:
                    continue
                row1, row2 = group.iloc[0], group.iloc[1]
                player1_name, expected_player2 = row1["player"], row1["opponent"]
                if row2["player"] != expected_player2 or row2["opponent"] != player1_name:
                    if row2["player"] == player1_name and row2["opponent"] == expected_player2:
                        row1, row2 = row2, row1
                        player1_name, expected_player2 = row1["player"], row1["opponent"]
                    else:
                        continue
                player2_name = expected_player2

                logit_p1 = float(row1["logit"])
                logit_p2 = float(row2["logit"])
                prob1_from_p1 = torch.sigmoid(torch.tensor(logit_p1)).item()
                prob2_from_p2 = torch.sigmoid(torch.tensor(logit_p2)).item()
                prob_p1 = (prob1_from_p1 + (1.0 - prob2_from_p2)) / 2.0
                prob_p2 = 1.0 - prob_p1

                label = int(row1["label"])
                actual_winner = "player_one" if label == 1 else "player_two"

                details = match_details_dict.get(match_id, {})
                surface = "Hard" if pd.isna(details.get("surface")) else str(details.get("surface", "Hard"))
                round_name = "F" if pd.isna(details.get("round")) else str(details.get("round", "F"))
                tourney_level = "M" if pd.isna(details.get("tourney_level")) else str(details.get("tourney_level", "M"))
                tourney_id = "unknown" if pd.isna(details.get("tourney_id")) else str(details.get("tourney_id", "unknown"))
                tourney_name = "unknown" if pd.isna(details.get("tourney_name")) else str(details.get("tourney_name", "unknown"))

                td = str(row1["tourney_date"]).replace("-", "")[:8]
                date_str = f"{td[:4]}-{td[4:6]}-{td[6:8]}" if len(td) >= 8 else td

                cache[match_id] = {
                    "match_id": match_id,
                    "tourney_id": tourney_id,
                    "tourney_name": tourney_name,
                    "tourney_level": tourney_level,
                    "date": date_str,
                    "round": round_name,
                    "surface": surface,
                    "player_one": {"slug": slugify(player1_name, separator="-"), "name": player1_name, "country": None, "last_rank": None},
                    "player_two": {"slug": slugify(player2_name, separator="-"), "name": player2_name, "country": None, "last_rank": None},
                    "actual_winner": actual_winner,
                    "predicted_probability_player_one": prob_p1,
                    "predicted_probability_player_two": prob_p2,
                    "top_features": [],
                }

            cache_path = self._get_cache_path(2025)
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            with cache_path.open("w", encoding="utf-8") as f:
                json.dump(cache, f, indent=2)
            logger.info(f"Generated and saved 2025 tournament cache: {len(cache)} matches")
            return cache
        except Exception as e:
            logger.exception(f"Failed to generate 2025 cache: {e}")
            return None

    def load_cache(self, year: int = 2025) -> Optional[Dict[str, Dict]]:
        """Load prediction cache from file for a given year."""
        cache_path = self._get_cache_path(year)
        if not cache_path.exists():
            logger.warning(f"Cache file not found at {cache_path}")
            return None

        try:
            with cache_path.open("r", encoding="utf-8") as f:
                cache = json.load(f)
            logger.info(f"Loaded {len(cache)} predictions from cache for {year}")
            return cache
        except Exception as e:
            logger.error(f"Error loading cache: {e}")
            return None
    
    def cache_exists(self, year: int = 2025) -> bool:
        """Check if cache file exists for a given year."""
        cache_path = self._get_cache_path(year)
        return cache_path.exists()


def get_tournament_cache_service() -> TournamentCacheService:
    """Get singleton instance of TournamentCacheService."""
    return TournamentCacheService()
