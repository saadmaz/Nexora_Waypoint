from __future__ import annotations

import jwt
import pytest

from .conftest import ACCOUNTS, PASSWORD


@pytest.mark.parametrize("role", list(ACCOUNTS))
def test_login_per_role(client, role):
    res = client.post("/api/v1/auth/login", json={"email": ACCOUNTS[role], "password": PASSWORD})
    assert res.status_code == 200
    body = res.json()
    assert body["tokenType"] == "bearer"
    assert body["user"]["role"] == role
    assert body["user"]["email"] == ACCOUNTS[role]

    # The token carries the role and the scope, and lasts 12 hours.
    claims = jwt.decode(body["accessToken"], options={"verify_signature": False})
    assert claims["role"] == role
    assert claims["exp"] - claims["iat"] == 12 * 3600
    expected_scope = {"store": ("kandy", "OUT084", None), "driver": ("kandy", None, "VEH039")}
    if role in expected_scope:
        assert (claims["depot"], claims["outletId"], claims["vehicleId"]) == expected_scope[role]

    me = client.get("/api/v1/me", headers={"Authorization": f"Bearer {body['accessToken']}"})
    assert me.status_code == 200
    assert me.json()["role"] == role


def test_login_rejects_bad_password_with_the_error_shape(client):
    res = client.post("/api/v1/auth/login", json={"email": ACCOUNTS["store"], "password": "nope"})
    assert res.status_code == 401
    assert set(res.json()) == {"code", "message", "details"}
    assert res.json()["code"] == "invalid_credentials"


def test_unknown_email_looks_the_same_as_a_bad_password(client):
    res = client.post("/api/v1/auth/login", json={"email": "nobody@waypoint.demo", "password": PASSWORD})
    assert res.status_code == 401
    assert res.json()["code"] == "invalid_credentials"


def test_no_token_is_401(client):
    res = client.get("/api/v1/me")
    assert res.status_code == 401
    assert res.json()["code"] == "unauthenticated"


def test_garbage_token_is_401(client):
    res = client.get("/api/v1/me", headers={"Authorization": "Bearer not.a.token"})
    assert res.status_code == 401


# (role that should be refused, method, path, body)
WRONG_ROLE = [
    ("store", "GET", "/api/v1/dispatcher/queue?depot=peliyagoda", None),
    ("loader", "GET", "/api/v1/dispatcher/plan", None),
    ("driver", "POST", "/api/v1/dispatcher/plan/redraft", None),
    ("dispatcher", "GET", "/api/v1/store/updates", None),
    ("driver", "GET", "/api/v1/store/issues", None),
    ("store", "GET", "/api/v1/loader/docks/kandy", None),
    ("dispatcher", "POST", "/api/v1/loader/pins/verify", {"personId": 1, "pin": "1234"}),
    ("store", "GET", "/api/v1/driver/history", None),
    ("loader", "GET", "/api/v1/driver/notices", None),
    ("store", "POST", "/api/v1/sync", {"deviceId": "d", "records": [
        {"clientId": "6f1c2f3e-0b0e-4c39-9a52-0b8d5d7a1f11", "type": "driver.ack", "deviceTime": "2026-09-29T03:10:00+05:30"}]}),
    ("dispatcher", "POST", "/api/v1/sync", {"deviceId": "d", "records": [
        {"clientId": "6f1c2f3e-0b0e-4c39-9a52-0b8d5d7a1f11", "type": "driver.ack", "deviceTime": "2026-09-29T03:10:00+05:30"}]}),
]


@pytest.mark.parametrize(("role", "method", "path", "body"), WRONG_ROLE)
def test_wrong_role_is_403(client, auth, role, method, path, body):
    res = client.request(method, path, headers=auth(role), json=body)
    assert res.status_code == 403, res.text
    assert res.json()["code"] == "forbidden"
    assert set(res.json()) == {"code", "message", "details"}


# (role that is allowed, method, path, expected status): the right role gets past the guard to a real answer.
# Before the first release the dock answers 200 with plan version 0; the others read an empty set.
RIGHT_ROLE_REACHES = [
    ("store", "GET", "/api/v1/store/updates", 200),
    ("loader", "GET", "/api/v1/loader/docks/kandy", 200),
    ("driver", "GET", "/api/v1/driver/history", 200),
]


@pytest.mark.parametrize(("role", "method", "path", "status"), RIGHT_ROLE_REACHES)
def test_right_role_reaches_the_route(client, auth, role, method, path, status):
    res = client.request(method, path, headers=auth(role))
    assert res.status_code == status, res.text
    if status != 200:
        assert set(res.json()) == {"code", "message", "details"}
