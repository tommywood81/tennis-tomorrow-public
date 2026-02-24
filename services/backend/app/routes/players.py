from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..config import get_settings
from ..data_access import get_repository
from ..schemas import PlayerHistoryResponse, PlayerSearchResponse

router = APIRouter(prefix="/players", tags=["players"])


@router.get("", response_model=PlayerSearchResponse)
def search_players(q: str = Query("", min_length=0), limit: int = Query(10, ge=1, le=50)):
    import traceback
    try:
        repo = get_repository()
        players = repo.search_players(q, limit)
        return PlayerSearchResponse(results=players)
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"ERROR in search_players: {e}")
        print(error_trace)
        raise HTTPException(
            status_code=500,
            detail=f"Error searching players: {str(e)}\n\nTraceback:\n{error_trace}"
        ) from e


@router.get("/{player_id}/history", response_model=PlayerHistoryResponse)
def player_history(player_id: str, limit: int = Query(10, ge=1, le=200)):
    import traceback
    repo = get_repository()
    try:
        player = repo.get_player(player_id)
        if not player:
            raise HTTPException(status_code=404, detail="Player not found")
        recent = repo.recent_matches(player_id, limit=limit)
        last_three = repo.recent_matches(player_id, limit=3)
        return PlayerHistoryResponse(player=player, recent_matches=recent, last_three=last_three)
    except HTTPException:
        raise
    except KeyError as exc:
        error_trace = traceback.format_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Missing required column in dataset: {str(exc)}\n\nTraceback:\n{error_trace}"
        ) from exc
    except Exception as exc:
        error_trace = traceback.format_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching player history: {str(exc)}\n\nTraceback:\n{error_trace}"
        ) from exc





