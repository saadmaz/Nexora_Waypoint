"""Settings from the environment (see the root ``.env.example``)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict

COLOMBO = ZoneInfo("Asia/Colombo")

#: Secrets that have been published in the repository, so anyone can mint a token with them.
#: Refused outside development: see ``Settings.check_secrets``.
PUBLISHED_SECRETS = frozenset(
    {
        "change-me-in-env",
        "change-me-in-env-change-me-in-env",
    }
)


class InsecureSettings(RuntimeError):
    """A default that is safe on a laptop but not anywhere else. Raised at startup, not per request."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    database_url: str = "postgresql+psycopg://waypoint:waypoint@localhost:5432/waypoint"
    jwt_secret: str = "change-me-in-env"
    jwt_ttl_hours: int = 12
    cors_origins: list[str] = ["http://localhost:5173"]

    #: ``dev`` keeps the published defaults usable so a clean checkout runs. Anything else refuses them.
    environment: str = "dev"

    #: Seed on API start when the database is empty (PRD §14).
    seed_on_start: bool = False
    #: Without data/*.csv, also generate the rest of the day: the full fleet and ORD3001 upward (212 + 62 orders, A41).
    seed_generated_orders: bool = True
    data_dir: Path = Path("../data")
    uploads_dir: Path = Path("./uploads")

    #: The delivery day the scenario plans for (A38). The seed and the clock derive everything else from it: the planning
    #: day is the operating day before it, and the clock starts there at 15:30 Asia/Colombo. Must be an operating day.
    scenario_service_date: date = date(2026, 9, 29)

    #: Scenario seconds per wall second: 1 is real time, 0 is paused, 60 is a minute a second (DP-26).
    clock_rate: float = 1.0
    #: Run the due jobs on a timer inside the API process. Off in tests, which drive the clock themselves.
    job_loop: bool = True
    job_loop_seconds: float = 5.0

    #: Demo passwords (O-4). Overridden in .env; listed in the README.
    demo_password: str = "waypoint-demo"

    @property
    def scenario_start(self) -> datetime:
        """Where the clock starts before the calendar is loaded: 15:30 the calendar day before the service date.

        The seed replaces it with 15:30 on the previous *operating* day once the calendar is in the database.
        """
        return datetime.combine(self.scenario_service_date - timedelta(days=1), time(15, 30), tzinfo=COLOMBO)

    @property
    def is_dev(self) -> bool:
        return self.environment.strip().lower() in {"dev", "development", "local", "test"}

    def check_secrets(self) -> None:
        """Refuse to start outside development with a secret that is printed in the repository.

        ``ENVIRONMENT=dev`` (the default) keeps ``docker compose up`` working on a clean checkout,
        which the judge walkthrough needs. Any other value means a real deployment, where a token
        signed with a published secret would be accepted as any account.
        """
        if self.is_dev:
            return
        if self.jwt_secret in PUBLISHED_SECRETS:
            raise InsecureSettings(
                f"JWT_SECRET is still a published default and ENVIRONMENT is {self.environment!r}. "
                "Set a long random value, for example: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.check_secrets()
    return settings
