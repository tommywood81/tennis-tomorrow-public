from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .data_access import get_repository
from .routes import backtesting, h2h, health, model_stats, players, predictions, story, tournaments

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _warm_up_model() -> None:
    """
    One-time warm-up: load model and run a lightweight prediction at process start.
    Prevents first real request from causing a CPU spike on low-resource droplets.
    """
    try:
        from .services.model_service import get_model_service
        from .services.dynamic_feature_service import get_dynamic_feature_service
        from .services.inference_service import run_inference
        from .schemas import MatchPredictionRequest

        logger.info("Warm-up: loading model and feature service...")
        model_service = get_model_service()
        feature_service = get_dynamic_feature_service()
        model_service._ensure_model()
        logger.info("Warm-up: model loaded, running one prediction...")
        warm_request = MatchPredictionRequest(
            player_one="novak-djokovic",
            player_two="carlos-alcaraz",
            surface="Hard",
            tournament_level="M",
            round="F",
        )
        run_inference(
            input_payload=warm_request,
            feature_mode="frozen",
            model_service=model_service,
            feature_service=feature_service,
        )
        logger.info("Warm-up: completed successfully")
    except Exception as e:
        logger.warning("Warm-up failed (app will continue): %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize model and run warm-up prediction (avoids first-request CPU spike)
    logger.info("Backend starting - initializing model...")
    await asyncio.to_thread(_warm_up_model)
    logger.info("Backend ready")
    yield
    # Shutdown: cleanup if needed
    pass


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Tennis Prediction API",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Add middleware to log all requests
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        logger.info(f"Incoming request: {request.method} {request.url.path}")
        try:
            response = await call_next(request)
            logger.info(f"Request completed: {request.method} {request.url.path} - Status: {response.status_code}")
            return response
        except Exception as e:
            logger.error(f"Request failed: {request.method} {request.url.path} - Error: {e}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"detail": f"Internal server error: {str(e)}"}
            )
    
    app.include_router(health.router, prefix=settings.api_prefix)
    app.include_router(players.router, prefix=settings.api_prefix)
    app.include_router(predictions.router, prefix=settings.api_prefix)
    app.include_router(model_stats.router, prefix=settings.api_prefix)
    app.include_router(h2h.router, prefix=settings.api_prefix)
    app.include_router(story.router, prefix=settings.api_prefix)
    app.include_router(tournaments.router, prefix=settings.api_prefix)
    app.include_router(backtesting.router, prefix=settings.api_prefix)
    return app


app = create_app()

