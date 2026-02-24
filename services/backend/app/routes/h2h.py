from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..data_access import get_repository
from ..schemas import HeadToHeadMeeting, H2HSummary, StoryMetric

router = APIRouter(prefix="/h2h", tags=["head-to-head"])


@router.get("", response_model=H2HSummary)
def read_head_to_head(player_one: str = Query(...), player_two: str = Query(...)):
    if player_one == player_two:
        raise HTTPException(status_code=400, detail="Player one and player two must be different.")
    repo = get_repository()
    total, player_one_wins, frame = repo.head_to_head(player_one, player_two)
    if total == 0:
        # Return empty H2H summary instead of 404 - no history is a valid state
        return H2HSummary(
            total_matches=0,
            player_one_wins=0,
            player_two_wins=0,
            surface_breakdown=[],
            recent_meetings=[],
        )
    player_two_wins = total - player_one_wins
    surface_counts = (
        frame.groupby("surface")["player_one_win"].agg(["count", "sum"]).reset_index()
    )
    surface_metrics = [
        StoryMetric(
            label=row["surface"],
            player_one_value=float(row["sum"]),
            player_two_value=float(row["count"] - row["sum"]),
        )
        for _, row in surface_counts.iterrows()
    ]
    # Get all matches sorted by date (most recent first)
    all_matches = frame.sort_values("tourney_date", ascending=False)
    meetings = []
    for _, row in all_matches.iterrows():
        # Determine winner name - use winner_name if available, otherwise infer from player_one_win
        if "winner_name" in row.index and row.get("winner_name") is not None:
            winner_name = str(row["winner_name"])
        elif row["player_one_win"]:
            winner_name = str(row.get("player", player_one))
        else:
            winner_name = str(row.get("opponent", player_two))
        
        meetings.append(
            HeadToHeadMeeting(
                date=row["tourney_date"].date(),
                tournament=row.get("tourney_name"),
                surface=row.get("surface"),
                round=row.get("round"),
                winner=winner_name,
                score=row.get("score"),
            )
        )
    return H2HSummary(
        total_matches=total,
        player_one_wins=player_one_wins,
        player_two_wins=player_two_wins,
        surface_breakdown=surface_metrics,
        recent_meetings=meetings,
    )





