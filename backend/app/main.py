"""FastAPI entry point. Everything is under ``/api/v1``; Swagger is at ``/api/docs``."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from datetime import timedelta

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import errors
from .config import Settings, get_settings
from .logs import RequestLog
from .routers import auth, dispatcher, driver, health, loader, shared, store, sync
from .schemas.base import ErrorBody

API_PREFIX = "/api/v1"

log = logging.getLogger("waypoint.jobs")

#: When the job loop last finished a tick (``time.monotonic``). ``None`` until the first one, so a loop that never
#: started is as unready as one that stopped. ``/health/ready`` reads it through ``job_lag_seconds``.
_job_tick: float | None = None


def job_lag_seconds() -> float | None:
    """Seconds since the job loop last completed a tick, or ``None`` if it has not ticked in this process."""
    return None if _job_tick is None else round(time.monotonic() - _job_tick, 1)


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
    global _job_tick
    while True:
        try:
            ran = await asyncio.to_thread(run_jobs_once)
            _job_tick = time.monotonic()
            if ran:
                log.info("jobs ran: %s", ", ".join(ran))
        except Exception:  # the loop must outlive one bad tick
            # The heartbeat is deliberately not touched: a loop whose every tick fails is not healthy, and
            # ``/health/ready`` is what says so.
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


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the app. ``settings`` is for tests that need a different configuration (DEMO_MODE off, say)."""
    settings = settings or get_settings()
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
    if settings.request_log:
        app.add_middleware(RequestLog)
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
    # The presenter controls are mounted only where they are meant to be used. ``/demo/reset`` truncates the
    # operational tables, so in a real deployment the routes must not exist at all, not merely require a role.
    if settings.demo_enabled:
        api.include_router(shared.demo)
    app.include_router(api)
    return app


app = create_app()
