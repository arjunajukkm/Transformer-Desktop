"""
api/main.py
───────────
FastAPI High-Throughput Analytical Gateway for Transformers 2.0 Workforce Intelligence.
Sub-millisecond analytical endpoints powered by Polars & Apache Arrow OLAP Cubes.
"""

from contextlib import asynccontextmanager
import logging
from typing import Dict
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.analytics import router as analytics_router
from api.routes.snapshots import router as snapshots_router
from storage.cache_manager import snapshot_cache

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("workforce_api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle hook: pre-warm demo dataset if no snapshot is loaded."""
    logger.info("Initializing Transformers 2.0 Analytical Gateway...")
    active = snapshot_cache.get_active_snapshot()
    if not active or not active.is_valid():
        logger.info("Auto-loading multi-month enterprise demo dataset into active memory...")
        try:
            from api.routes.snapshots import load_enterprise_demo_snapshot
            load_enterprise_demo_snapshot()
            logger.info("Enterprise demo dataset pre-warmed successfully.")
        except Exception as e:
            logger.warning(f"Demo pre-warming encountered an error: {e}")
    yield
    logger.info("Shutting down Analytical Gateway...")


app = FastAPI(
    title="Transformers 2.0 — Workforce Intelligence Analytical Gateway",
    description="High-Throughput Vectorized OLAP Engine & Decision Intelligence API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS configuration for Next.js and frontend consumers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount analytical routers
app.include_router(analytics_router, prefix="/api")
app.include_router(snapshots_router, prefix="/api")


@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
def health_check() -> Dict[str, str]:
    """Liveness probe and system health status."""
    active = snapshot_cache.get_active_snapshot()
    has_data = active is not None and active.is_valid()
    return {
        "status": "healthy",
        "engine": "Polars Vectorized Columnar OLAP",
        "dataset_loaded": str(has_data),
        "dataset_id": active.dataset_id if has_data else "None",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main.py:app", host="127.0.0.1", port=8000, reload=True)
