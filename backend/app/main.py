"""FastAPI entry point. Everything is under ``/api/v1``; Swagger is at ``/api/docs``."""

from __future__ import annotations

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import errors
from .config import get_settings
from .routers import auth, dispatcher, driver, health, loader, shared, store, sync
from .schemas.base import ErrorBody

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Waypoint API",
        version="0.1.0",
        description="Order, plan, allocate, load, deliver, confirm. Types for the frontend are generated from this schema.",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
        responses={
            401: {"model": ErrorBody},
            403: {"model": ErrorBody},
            409: {"model": ErrorBody},
            422: {"model": ErrorBody},
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
