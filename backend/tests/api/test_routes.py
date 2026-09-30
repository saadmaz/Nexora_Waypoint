"""Every row of the PRD §19 API table exists, with the frontend operation name as its ``operationId``.

This is the contract the frontend generates ``schema.ts`` from. It needs no database.
"""

from __future__ import annotations

import re

import pytest

from app.main import app

API = "/api/v1"

# (method, path, operationId). Paths are the PRD §19 endpoints; parameter names are normalised before comparing.
SECTION_19 = [
    # Shared
    ("POST", "/auth/login", "login"),
    ("GET", "/me", "getMe"),
    ("GET", "/clock", "getClock"),
    ("POST", "/demo/advance", "advanceClock"),
    ("POST", "/demo/reset", "resetDemo"),
    # StoreApi
    ("GET", "/store/order-form", "getOrderDraft"),
    ("POST", "/store/orders", "placeOrders"),
    ("PATCH", "/store/orders/{id}", "editOrder"),
    ("POST", "/store/orders/{id}/cancel", "cancelOrder"),
    ("GET", "/store/deliveries", "listDeliveries"),
    ("GET", "/store/deliveries/{date}", "getDeliveryDay"),
    ("GET", "/store/history", "listRecent"),
    ("GET", "/store/issues", "listIssues"),
    ("POST", "/store/deferrals/{id}/seen", "acknowledgeDeferral"),
    ("POST", "/store/reviews/{conflictId}/answer", "answerReceivedQuestion"),
    ("POST", "/store/receipts", "confirmReceipt"),
    ("POST", "/store/issues", "reportIssue"),
    ("GET", "/store/updates", "getUpdates"),
    ("POST", "/store/updates/read-all", "markAllRead"),
    # DispatcherApi (proposed names, O-6)
    ("GET", "/dispatcher/queue", "getQueue"),
    ("GET", "/dispatcher/orders/{id}/history", "getOrderHistory"),
    ("GET", "/dispatcher/capacity", "getCapacity"),
    ("GET", "/dispatcher/plan", "getPlan"),
    ("POST", "/dispatcher/plan/redraft", "redraftPlan"),
    ("POST", "/dispatcher/plan/validate-move", "validateMove"),
    ("POST", "/dispatcher/plan/moves", "saveMoves"),
    ("GET", "/dispatcher/deferrals", "listDeferrals"),
    ("POST", "/dispatcher/deferrals/notify", "notifyDeferrals"),
    ("POST", "/dispatcher/plan/release", "releasePlan"),
    ("GET", "/dispatcher/acknowledgements", "listAcknowledgements"),
    ("GET", "/dispatcher/live", "getLiveBoard"),
    ("POST", "/dispatcher/stops/defer", "deferStop"),
    ("GET", "/dispatcher/inbox", "getInbox"),
    ("GET", "/dispatcher/conflicts/{id}", "getConflict"),
    ("POST", "/dispatcher/conflicts/{id}/ask-store", "askStore"),
    ("POST", "/dispatcher/conflicts/{id}/resolve", "resolveConflict"),
    ("GET", "/dispatcher/exceptions/{id}", "getExceptionForReview"),
    ("POST", "/dispatcher/exceptions/{id}/decide", "decideException"),
    ("GET", "/dispatcher/forecast", "getForecast"),
    # LoaderApi
    ("GET", "/loader/docks/{dock}", "getDock"),
    ("POST", "/loader/pins/verify", "verifyPin"),
    ("GET", "/loader/vehicles/{vehicleId}/trips/{trip}", "getLoadPlan"),
    ("GET", "/loader/exceptions/{id}", "getException"),
    ("GET", "/loader/docks/{dock}/diff", "getPlanDiff"),
    # DriverApi (downloadRun is the same endpoint as getRun)
    ("GET", "/driver/runs/{date}", "getRun"),
    ("GET", "/driver/notices", "getNotices"),
    ("GET", "/driver/history", "getHistory"),
    # Sync
    ("POST", "/sync", "sync"),
    ("POST", "/attachments", "uploadAttachment"),
]


def _norm(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "{}", path)


@pytest.fixture(scope="module")
def operations() -> dict[tuple[str, str], str]:
    out: dict[tuple[str, str], str] = {}
    for path, item in app.openapi()["paths"].items():
        for method, op in item.items():
            out[(method.upper(), _norm(path.removeprefix(API)))] = op["operationId"]
    return out


@pytest.mark.parametrize(("method", "path", "operation_id"), SECTION_19, ids=[f"{m} {p}" for m, p, _ in SECTION_19])
def test_section_19_route_exists(operations, method, path, operation_id):
    assert operations.get((method, _norm(path))) == operation_id


def test_no_route_outside_section_19(operations):
    """Anything else in the schema must be deliberate: health is the only extra."""
    expected = {(m, _norm(p)) for m, p, _ in SECTION_19}
    extra = set(operations) - expected
    assert extra == {("GET", "/health")}


def test_operation_ids_are_unique(operations):
    ids = list(operations.values())
    assert len(ids) == len(set(ids))


def test_every_route_is_under_api_v1():
    assert all(p.startswith(API + "/") for p in app.openapi()["paths"])


def test_camel_case_in_the_schema():
    schemas = app.openapi()["components"]["schemas"]
    assert "accessToken" in schemas["LoginOut"]["properties"]
    assert "displayName" in schemas["MeOut"]["properties"]
    assert "access_token" not in schemas["LoginOut"]["properties"]


def test_schema_ts_is_not_stale():
    """``frontend/src/api/schema.ts`` is generated from the API and committed in the same PR (Contributing §19).

    Regenerate after a backend change: ``npx openapi-typescript http://localhost:8000/api/openapi.json -o frontend/src/api/schema.ts``.
    """
    from pathlib import Path

    schema_ts = Path(__file__).resolve().parents[3] / "frontend" / "src" / "api" / "schema.ts"
    text = schema_ts.read_text(encoding="utf-8")
    missing = [
        op["operationId"]
        for item in app.openapi()["paths"].values()
        for op in item.values()
        if f"    {op['operationId']}: {{" not in text
    ]
    assert not missing, f"schema.ts is stale; missing operations: {missing}"
