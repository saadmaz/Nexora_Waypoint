"""FastAPI entry point. Everything is under ``/api/v1``; Swagger is at ``/api/docs``."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from datetime import timedelta

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import errors
from .config import get_settings
from .routers import auth, dispatcher, driver, health, loader, shared, store, sync
from .schemas.base import ErrorBody

API_PREFIX = "/api/v1"

log = logging.getLogger("waypoint.jobs")


def run_jobs_once() -> list[str]:
    """Run whatever the clock owes right now, in its own transaction. Safe from any number of workers (job_runs)."""
    from . import clock, jobs
    from .db import SessionLocal

    with SessionLocal() as db:
        now = clock.now(db).replace(tzinfo=None)
        ran = jobs.run_due(db, now - timedelta(seconds=1), now)
        db.commit()
        return ran


async def _job_loop(every: float) -> None:
    while True:
        try:
            ran = await asyncio.to_thread(run_jobs_once)
            if ran:
                log.info("jobs ran: %s", ", ".join(ran))
        except Exception:  # the loop must outlive one bad tick
            log.exception("job loop tick failed")
        await asyncio.sleep(every)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    task = asyncio.create_task(_job_loop(settings.job_loop_seconds)) if settings.job_loop else None
    try:
        yield
    finally:
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Waypoint API",
        version="0.1.0",
        description="Order, plan, allocate, load, deliver, confirm. Types for the frontend are generated from this schema.",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
        lifespan=lifespan,
        responses={
            401: {"model": ErrorBody},
            403: {"model": ErrorBody},
            409: {"model": ErrorBody},
            422: {"model": ErrorBody},
            429: {"model": ErrorBody},
            501: {"model": ErrorBody},
        },
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    errors.install(app)

    api = APIRouter(prefix=API_PREFIX)
    for module in (health, auth, shared, store, dispatcher, loader, driver, sync):
        api.include_router(module.router)
    app.include_router(api)
    return app


app = create_app()
