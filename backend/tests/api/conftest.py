"""API test setup.

The tests need a PostgreSQL 16 database and **wipe it** (truncate + seed), so they never use ``DATABASE_URL``.
Point ``TEST_DATABASE_URL`` at a disposable database (CI does; locally ``waypoint_test`` in the Compose db).
They always seed from the PRD §4c fallback, never from ``data/*.csv``.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://waypoint:waypoint@localhost:5432/waypoint_test"
)
# Must be set before anything imports ``app`` (the engine is built at import).
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["JWT_SECRET"] = "test-secret-not-for-production-0123456789"
os.environ["DEMO_PASSWORD"] = "waypoint"
os.environ["DATA_DIR"] = str(Path(__file__).parent / "_no_data")  # does not exist: forces the fallback set
os.environ["SEED_ON_START"] = "false"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

PASSWORD = "waypoint"
ACCOUNTS = {
    "dispatcher": "dispatcher@waypoint.demo",
    "loader": "loader@waypoint.demo",
    "driver": "driver@waypoint.demo",
    "store": "store@waypoint.demo",
}


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    """The app over a freshly migrated and seeded test database."""
    from app.main import app
    from seed import run as seed_run

    backend = Path(__file__).resolve().parents[2]
    cfg = Config(str(backend / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend / "alembic"))
    command.upgrade(cfg, "head")
    seed_run.reset()
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def tokens(client: TestClient) -> dict[str, str]:
    out: dict[str, str] = {}
    for role, email in ACCOUNTS.items():
        res = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
        assert res.status_code == 200, res.text
        out[role] = res.json()["accessToken"]
    return out


@pytest.fixture
def auth(tokens: dict[str, str]):
    def _headers(role: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {tokens[role]}"}

    return _headers


@pytest.fixture
def reseed() -> Iterator[None]:
    """For tests that change state (the clock): put the seed back afterwards."""
    yield
    from seed import run as seed_run

    seed_run.reset()
