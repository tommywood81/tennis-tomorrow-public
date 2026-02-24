from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])

# Track if repository is loaded
_repository_loaded = False


def _check_repository_loaded():
    """Check if repository is loaded (non-blocking)."""
    global _repository_loaded
    if _repository_loaded:
        return True
    try:
        from ..data_access import get_repository
        repo = get_repository()
        # If we can access the cache, it's loaded
        _ = len(repo._player_cache)
        _repository_loaded = True
        return True
    except Exception:
        return False


@router.get("")
def health_check():
    """Health check endpoint for container health checks."""
    # Always return healthy so Docker doesn't restart the container
    # The app can serve requests even while data is loading (will be slow on first request)
    repo_loaded = _check_repository_loaded()
    return {"status": "healthy", "data_loaded": repo_loaded}




