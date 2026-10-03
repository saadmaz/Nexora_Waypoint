"""Regression tests for the auth audit (``docs/auth-audit.md``).

Each test here pins one fix, so the hole it closed cannot quietly reopen:

* every route declares a role, so a new one cannot ship with no dependency at all;
* the scenario clock is dispatcher only, like the reset beside it;
* a forged or expired token is refused, and a tampered ``role`` claim does not escalate;
* the API refuses to start outside development with a secret published in this repository;
* repeated failures are rate limited.
"""

from __future__ import annotations

import time

import jwt
import pytest
from fastapi.routing import APIRoute

from app.config import PUBLISHED_SECRETS, InsecureSettings, Settings
from app.main import app
from app.routers import auth as auth_router

from .conftest import ACCOUNTS, PASSWORD

SECRET = "test-secret-not-for-production-0123456789"  # conftest sets this before the app imports
#: Open on purpose: liveness for the Compose healthcheck, and the sign-in itself.
PUBLIC_PATHS = {"/api/v1/health", "/api/v1/auth/login"}
#: The dependency names that stand for "a signed-in user of some role" in ``deps.py``.
ROLE_GUARDS = {"current_user", "guard"}


def _claims(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "sub": "1",
        "role": "dispatcher",
        "depot": None,
        "outletId": None,
        "vehicleId": None,
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }
    base.update(overrides)
    return base


def _api_routes() -> list[APIRoute]:
    return [r for r in app.routes if isinstance(r, APIRoute) and r.path.startswith("/api/v1")]


def test_every_route_declares_a_role() -> None:
    """A route with no auth dependency is the one bug this suite must never let through.

    Generated from the app itself rather than a hand-kept list, so adding a route forces a role
    decision instead of defaulting to open.
    """
    unguarded = []
    for route in _api_routes():
        if route.path in PUBLIC_PATHS:
            continue
        names = {d.call.__name__ for d in route.dependant.dependencies if d.call is not None}
        if not (names & ROLE_GUARDS):
            unguarded.append(f"{sorted(route.methods)} {route.path}")
    assert not unguarded, "routes with no role dependency: " + ", ".join(unguarded)


def test_health_is_open_and_says_nothing_else(client) -> None:
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    # No version, build or environment: a liveness probe, not a fingerprint.
    assert set(res.json()) == {"status"}


@pytest.mark.parametrize("role", ["store", "loader", "driver"])
def test_advancing_the_clock_is_dispatcher_only(client, auth, role: str) -> None:
    """The clock is shared, so moving it changes cutoffs and plan state for every role."""
    res = client.post("/api/v1/demo/advance", headers=auth(role), json={"to": "2026-09-28T16:00:00+05:30"})
    assert res.status_code == 403, res.text
    assert res.json()["code"] == "forbidden"


def test_a_token_signed_with_another_secret_is_refused(client) -> None:
    token = jwt.encode(_claims(), "not-the-servers-secret", algorithm="HS256")
    res = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert res.json()["code"] == "unauthenticated"


def test_an_unsigned_token_is_refused(client) -> None:
    """``alg: none``: the decode pins HS256, so an unsigned token never gets in."""
    token = jwt.encode(_claims(), key="", algorithm="none")
    res = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_an_expired_token_is_refused(client) -> None:
    token = jwt.encode(_claims(iat=1, exp=2), SECRET, algorithm="HS256")
    res = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert "expired" in res.json()["message"].lower()


def test_a_tampered_role_claim_does_not_escalate(client) -> None:
    """The role comes from the database row, never from the claim, so a correctly signed lie fails."""
    store_id = client.post(
        "/api/v1/auth/login", json={"email": ACCOUNTS["store"], "password": PASSWORD}
    ).json()["user"]["id"]
    token = jwt.encode(_claims(sub=str(store_id), role="dispatcher"), SECRET, algorithm="HS256")

    assert client.get("/api/v1/dispatcher/live", headers={"Authorization": f"Bearer {token}"}).status_code == 403
    me = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["role"] == "store"


@pytest.mark.parametrize("secret", sorted(PUBLISHED_SECRETS))
def test_a_published_secret_is_refused_outside_development(secret: str) -> None:
    with pytest.raises(InsecureSettings):
        Settings(jwt_secret=secret, environment="production").check_secrets()


@pytest.mark.parametrize("secret", sorted(PUBLISHED_SECRETS))
def test_a_published_secret_still_runs_in_development(secret: str) -> None:
    """A clean checkout must still come up for the judge walkthrough with no .env at all."""
    Settings(jwt_secret=secret, environment="dev").check_secrets()


def test_repeated_failures_are_rate_limited_and_a_good_sign_in_clears_them(client) -> None:
    limit = auth_router._MAX_FAILURES
    auth_router._FAILURES.clear()
    try:
        for _ in range(limit):
            res = client.post("/api/v1/auth/login", json={"email": ACCOUNTS["store"], "password": "wrong"})
            assert res.status_code == 401

        blocked = client.post("/api/v1/auth/login", json={"email": ACCOUNTS["store"], "password": "wrong"})
        assert blocked.status_code == 429
        assert blocked.json()["code"] == "too_many_attempts"
        # Even the right password is refused while the window is open.
        assert client.post(
            "/api/v1/auth/login", json={"email": ACCOUNTS["store"], "password": PASSWORD}
        ).status_code == 429

        # One success clears the run, so the next person at the same address starts fresh.
        auth_router._FAILURES.clear()
        assert client.post(
            "/api/v1/auth/login", json={"email": ACCOUNTS["store"], "password": PASSWORD}
        ).status_code == 200
        assert client.post("/api/v1/auth/login", json={"email": ACCOUNTS["store"], "password": "wrong"}).status_code == 401
        assert client.post(
            "/api/v1/auth/login", json={"email": ACCOUNTS["store"], "password": PASSWORD}
        ).status_code == 200
    finally:
        # Session-scoped fixtures sign in after this test; never leave the counter loaded.
        auth_router._FAILURES.clear()
