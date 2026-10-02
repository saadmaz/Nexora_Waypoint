"""Settings from the environment (see the root ``.env.example``)."""

from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict

COLOMBO = ZoneInfo("Asia/Colombo")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    database_url: str = "postgresql+psycopg://waypoint:waypoint@localhost:5432/waypoint"
    jwt_secret: str = "change-me-in-env"
    jwt_ttl_hours: int = 12
    cors_origins: list[str] = ["http://localhost:5173"]

    #: Seed on API start when the database is empty (PRD §14).
    seed_on_start: bool = False
    data_dir: Path = Path("../data")
    uploads_dir: Path = Path("./uploads")

    #: Scenario start (A38): Mon 28 Sep 2026 15:30, Asia/Colombo.
    scenario_start: datetime = datetime(2026, 9, 28, 15, 30, tzinfo=COLOMBO)

    #: Demo passwords (O-4). Overridden in .env; listed in the README.
    demo_password: str = "waypoint"


@lru_cache
def get_settings() -> Settings:
    return Settings()
