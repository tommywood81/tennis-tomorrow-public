from __future__ import annotations

from fastapi import APIRouter

from ..schemas import ModelStatsResponse
from ..services.metrics_service import get_metrics_service

router = APIRouter(prefix="/model-stats", tags=["model-stats"])


@router.get("", response_model=ModelStatsResponse)
def read_model_stats():
    service = get_metrics_service()
    return service.build_response()





