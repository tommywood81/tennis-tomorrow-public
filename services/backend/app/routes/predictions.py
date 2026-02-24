"""
Clean prediction routes using canonical inference pipeline.

Single source of truth: feature_mode determines behavior.
No flags, no fallbacks, no auto-detection.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException

from ..schemas import (
    BatchPredictionRequest, BatchPredictionResponse, MatchPredictionRequest, PredictionResponse,
    AdvancedPredictionRequest, AdvancedPredictionResponse,
    ScrapeTennisAbstractRequest, ScrapeTennisAbstractResponse,
    PredictionProbabilities, PredictionInsights, PlayerSummary,
    DisplayParsingRequest, DisplayParsingResponse
)
from ..services.model_service import get_model_service
from ..services.dynamic_feature_service import get_dynamic_feature_service
from ..services.inference_service import run_inference
from ..services.tennis_abstract_scraper_service import get_tennis_abstract_scraper_service
from ..data_access import get_repository
from ..utils.neutral_parser import NeutralTennisAbstractParser
from ..utils.display_mapper import map_to_display

router = APIRouter(prefix="/predict", tags=["predictions"])
logger = logging.getLogger(__name__)


@router.post("", response_model=PredictionResponse)
def predict(payload: MatchPredictionRequest):
    """
    Standard prediction using frozen Nov-14 features.
    
    feature_mode: "frozen"
    """
    logger.info(f"Received prediction request: {payload.player_one} vs {payload.player_two}")
    
    if payload.player_one == payload.player_two:
        raise HTTPException(status_code=400, detail="Players must be different.")
    
    try:
        model_service = get_model_service()
        feature_service = get_dynamic_feature_service()
        repo = get_repository()
        
        # Run canonical inference with frozen features
        result = run_inference(
            input_payload=payload,
            feature_mode="frozen",
            model_service=model_service,
            feature_service=feature_service
        )
        
        prediction_data = result["prediction"]
        
        # Get player summaries
        player_one = repo.get_player(payload.player_one) or PlayerSummary(
            id=payload.player_one, name=payload.player_one
        )
        player_two = repo.get_player(payload.player_two) or PlayerSummary(
            id=payload.player_two, name=payload.player_two
        )
        
        # Build insights
        insights = PredictionInsights(
            confidence=prediction_data["confidence"],
            expected_margin=prediction_data["expected_margin"],
            score_descriptor=prediction_data["score_descriptor"],
            betting_odds_player_one=prediction_data["betting_odds_one"],
            betting_odds_player_two=prediction_data["betting_odds_two"],
            betting_guidance=prediction_data["betting_guidance"],
            feature_groups=[],
        )
        
        # Get features from inference result (already computed)
        features = result["features"]
        sequence_p1 = features["sequence_p1"]
        static_p1 = features["static_p1"]
        mask_p1 = features["mask_p1"]
        sequence_p2 = features["sequence_p2"]
        static_p2 = features["static_p2"]
        mask_p2 = features["mask_p2"]
        
        # Get feature importance (optional)
        feature_importance = []
        if hasattr(model_service, '_compute_feature_importance'):
            try:
                feature_importance = model_service._compute_feature_importance(sequence_p1, static_p1, mask_p1)
            except Exception as e:
                logger.warning(f"Could not compute feature importance: {e}")
        
        # Convert feature importance
        from ..schemas import FeatureImportance, PredictionFeatures, PlayerFeatures
        feature_importance_objects = [
            FeatureImportance(
                feature=item["feature"],
                importance=item["importance"],
                category=item.get("category", "Other"),
                display_name=item.get("display_name", item["feature"])
            )
            for item in feature_importance[:20]  # Top 20
        ]
        
        # Get feature names for response (pro-level strategy)
        from pro_level_strategy.preprocessing import SEQ_FEATURE_NAMES, STATIC_FEATURE_NAMES
        seq_feature_names = list(SEQ_FEATURE_NAMES)
        static_feature_names = list(STATIC_FEATURE_NAMES)
        
        prediction_features = PredictionFeatures(
            player_one=PlayerFeatures(
                sequence=sequence_p1.tolist(),
                static=static_p1.tolist(),
                mask=mask_p1.tolist(),
            ),
            player_two=PlayerFeatures(
                sequence=sequence_p2.tolist(),
                static=static_p2.tolist(),
                mask=mask_p2.tolist(),
            ),
            sequence_feature_names=seq_feature_names,
            static_feature_names=static_feature_names,
            feature_importance=feature_importance_objects if feature_importance_objects else None
        )
        
        return PredictionResponse(
            generated_at=datetime.utcnow(),
            player_one=player_one,
            player_two=player_two,
            probabilities=PredictionProbabilities(
                player_one=prediction_data["prob_one"],
                player_two=prediction_data["prob_two"]
            ),
            insights=insights,
            model_version=str(model_service.settings.model_weights_path),
            features=prediction_features,
            feature_mode=result["feature_mode"],
            override_used=result["override_used"]
        )
    except ValueError as exc:
        logger.error(f"Prediction ValueError: {exc}", exc_info=True)
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.error(f"Prediction RuntimeError: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.error(f"Prediction unexpected error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(exc)}") from exc


@router.post("/batch", response_model=BatchPredictionResponse)
def batch_predict(payload: BatchPredictionRequest):
    """Batch prediction using frozen features."""
    model_service = get_model_service()
    feature_service = get_dynamic_feature_service()
    
    responses = []
    for match in payload.matches:
        try:
            result = run_inference(
                input_payload=match,
                feature_mode="frozen",
                model_service=model_service,
                feature_service=feature_service
            )
            # Convert to PredictionResponse format (simplified for batch)
            responses.append(result["prediction"])
        except Exception as e:
            logger.error(f"Batch prediction error for {match}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    return BatchPredictionResponse(predictions=responses)


@router.post("/features")
def get_features(payload: MatchPredictionRequest) -> Dict:
    """Return computed features for visualization."""
    if payload.player_one == payload.player_two:
        raise HTTPException(status_code=400, detail="Players must be different.")
    
    feature_service = get_dynamic_feature_service()
    try:
        sequence, static, mask = feature_service.compute_features(
            payload.player_one,
            payload.player_two,
            surface=payload.surface or "Hard",
            tourney_level=payload.tournament_level or "M",
            round_name=payload.round or "F",
            match_date=payload.match_date
        )
        
        # Get feature names (pro-level strategy)
        from pro_level_strategy.preprocessing import SEQ_FEATURE_NAMES, STATIC_FEATURE_NAMES
        return {
            "sequence": sequence.tolist(),
            "static": static.tolist(),
            "mask": mask.tolist(),
            "sequence_feature_names": list(SEQ_FEATURE_NAMES),
            "static_feature_names": list(STATIC_FEATURE_NAMES),
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/features/detailed")
def get_detailed_features(payload: MatchPredictionRequest) -> Dict:
    """Return detailed feature breakdown for visualization."""
    if payload.player_one == payload.player_two:
        raise HTTPException(status_code=400, detail="Players must be different.")
    
    feature_service = get_dynamic_feature_service()
    try:
        return feature_service.get_detailed_features_for_visualization(
            payload.player_one,
            payload.player_two,
            surface=payload.surface or "Hard",
            tourney_level=payload.tournament_level or "M",
            round_name=payload.round or "F",
            match_date=payload.match_date
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/test-endpoint")
def test_endpoint():
    """Test endpoint to verify routing works."""
    return {"status": "ok", "message": "Test endpoint working"}


@router.post("/advanced", response_model=AdvancedPredictionResponse)
def predict_advanced(payload: AdvancedPredictionRequest):
    """
    Advanced prediction with user-entered match features.
    
    feature_mode: "fresh"
    Returns both frozen and fresh predictions for comparison.
    """
    logger.info(
        "Received advanced prediction request: %s vs %s (p1_history=%d chars, p2_history=%d chars)",
        payload.player_one, payload.player_two,
        len(payload.player_one_match_history or ""),
        len(payload.player_two_match_history or ""),
    )
    
    if payload.player_one == payload.player_two:
        raise HTTPException(status_code=400, detail="Players must be different.")
    
    try:
        model_service = get_model_service()
        feature_service = get_dynamic_feature_service()
        repo = get_repository()
        
        # Step 1: Run frozen prediction (for comparison)
        logger.info("Running frozen prediction...")
        frozen_request = MatchPredictionRequest(
            player_one=payload.player_one,
            player_two=payload.player_two,
            tournament_id=payload.tournament_id,
            tournament_name=payload.tournament_name,
            tournament_level=payload.tournament_level,
            round=payload.round,
            surface=payload.surface,
            match_date=payload.match_date
        )
        
        frozen_result = run_inference(
            input_payload=frozen_request,
            feature_mode="frozen",
            model_service=model_service,
            feature_service=feature_service
        )
        
        frozen_data = frozen_result["prediction"]
        
        # Step 2: Run fresh prediction (user-entered matches)
        logger.info("Running fresh prediction...")
        fresh_result = run_inference(
            input_payload=payload,
            feature_mode="fresh",
            model_service=model_service,
            feature_service=feature_service
        )
        
        fresh_data = fresh_result["prediction"]
        
        # Get player summaries
        player_one = repo.get_player(payload.player_one) or PlayerSummary(
            id=payload.player_one, name=payload.player_one
        )
        player_two = repo.get_player(payload.player_two) or PlayerSummary(
            id=payload.player_two, name=payload.player_two
        )
        
        # Build insights for both
        frozen_insights = PredictionInsights(
            confidence=frozen_data["confidence"],
            expected_margin=frozen_data["expected_margin"],
            score_descriptor=frozen_data["score_descriptor"],
            betting_odds_player_one=frozen_data["betting_odds_one"],
            betting_odds_player_two=frozen_data["betting_odds_two"],
            betting_guidance=frozen_data["betting_guidance"],
            feature_groups=[],
        )
        
        fresh_insights = PredictionInsights(
            confidence=fresh_data["confidence"],
            expected_margin=fresh_data["expected_margin"],
            score_descriptor=fresh_data["score_descriptor"],
            betting_odds_player_one=fresh_data["betting_odds_one"],
            betting_odds_player_two=fresh_data["betting_odds_two"],
            betting_guidance=fresh_data["betting_guidance"],
            feature_groups=[],
        )
        
        # Calculate delta
        probability_delta = fresh_data["prob_one"] - frozen_data["prob_one"]
        
        return AdvancedPredictionResponse(
            generated_at=datetime.utcnow(),
            player_one=player_one,
            player_two=player_two,
            standard_probabilities=PredictionProbabilities(
                player_one=frozen_data["prob_one"],
                player_two=frozen_data["prob_two"]
            ),
            standard_insights=frozen_insights,
            advanced_probabilities=PredictionProbabilities(
                player_one=fresh_data["prob_one"],
                player_two=fresh_data["prob_two"]
            ),
            advanced_insights=fresh_insights,
            probability_delta=probability_delta,
            model_version=str(model_service.settings.model_weights_path),
            features=None,
            feature_mode=fresh_result["feature_mode"],
            override_used=fresh_result["override_used"]
        )
    except HTTPException:
        raise
    except ValueError as exc:
        logger.error(f"Advanced prediction ValueError: {exc}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.error(f"Advanced prediction RuntimeError: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.error(f"Advanced prediction unexpected error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(exc)}") from exc


@router.post("/scrape-tennis-abstract", response_model=ScrapeTennisAbstractResponse)
def scrape_tennis_abstract(payload: ScrapeTennisAbstractRequest):
    """
    Scrape Tennis Abstract match history for a player.
    
    This endpoint:
    1. Scrapes the player's last 15 matches from Tennis Abstract
    2. For each match, scrapes the opponent's page to get serve stats
    3. Calculates return_pct = 1 - opponent_serve_pct
    4. Returns tab-separated text ready to paste
    
    Note: This may take 5-10 minutes due to rate limiting to avoid being blocked.
    """
    logger.info(f"Received scrape request for player: {payload.player_name}")
    
    try:
        scraper = get_tennis_abstract_scraper_service()
        matches, raw_text = scraper.scrape_player_matches(payload.player_name, max_matches=15)
        
        matches_with_return = sum(1 for m in matches if m.return_pct is not None)
        
        logger.info(f"Scraped {len(matches)} matches, {matches_with_return} with return_pct")
        
        return ScrapeTennisAbstractResponse(
            player_name=payload.player_name,
            matches_found=len(matches),
            matches_with_return_pct=matches_with_return,
            raw_text=raw_text,
            message=f"Successfully scraped {len(matches)} matches. {matches_with_return} have return percentages calculated."
        )
    except Exception as e:
        logger.error(f"Scraping failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to scrape Tennis Abstract: {str(e)}"
        )


@router.post("/parse-display", response_model=DisplayParsingResponse)
def parse_for_display(payload: DisplayParsingRequest):
    """
    Parse Tennis Abstract match history for display purposes.
    
    This endpoint:
    - Normalizes the pasted text
    - Parses all rows (never drops any)
    - Returns formatted table rows with metadata
    - Shows which rows will be ignored by inference
    
    This is separate from inference parsing to prioritize user trust and clarity.
    """
    try:
        # Normalize once so we can extract header labels if present
        from ..utils.text_normalizer import normalize_text
        normalized_lines = normalize_text(payload.match_history_text)

        # Use neutral parser (never drops rows)
        parser = NeutralTennisAbstractParser()
        rows = parser.parse(payload.match_history_text)

        # Map to display format
        display_data = map_to_display(rows, parser.has_header)

        # Fine-tune for frontend (trim fields, strip trailing empties)
        from ..utils.display_fine_tuner import fine_tune_display
        display_data = fine_tune_display(display_data)

        # Column headers from first line when parser detected a header
        column_headers = None
        if parser.has_header and normalized_lines:
            first_line = normalized_lines[0]
            if "\t" in first_line:
                column_headers = [c.strip() or "" for c in first_line.split("\t")]
            else:
                column_headers = [c.strip() or "" for c in re.split(r"\s{2,}", first_line)]

        # Convert to response format
        from ..schemas import DisplayTableRow, DisplayParsingSummary

        table_rows = [
            DisplayTableRow(
                row_index=row["row_index"],
                fields=row["fields"],
                formatted_line=row["formatted_line"],
                is_ignored=row["is_ignored"],
                ignore_reasons=row["ignore_reasons"],
                original_line=row["original_line"],
            )
            for row in display_data["table_rows"]
        ]

        summary = DisplayParsingSummary(**display_data["summary"])

        return DisplayParsingResponse(
            table_rows=table_rows,
            summary=summary,
            column_headers=column_headers,
        )
    except Exception as e:
        logger.error(f"Display parsing failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse match history for display: {str(e)}"
        )
