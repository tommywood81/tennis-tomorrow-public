from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..data_access import get_repository
from ..schemas import StoryMetric

router = APIRouter(prefix="/story", tags=["story"])


@router.get("", response_model=list[StoryMetric])
def matchup_story(player_one: str = Query(...), player_two: str = Query(...)):
    repo = get_repository()
    metrics = repo.story_metrics(player_one, player_two)
    if not metrics:
        raise HTTPException(status_code=404, detail="No matchup analytics available.")
    return metrics





