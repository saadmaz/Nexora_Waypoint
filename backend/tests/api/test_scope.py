"""Scope helpers (PRD §9 principle 6): bound accounts reach only their own outlet, vehicle or depot."""

from __future__ import annotations

from collections.abc import Callable

import pytest

from app.deps import CurrentUser, require_depot, require_outlet, require_vehicle
from app.errors import ApiError
from waypoint_rules.vocab import Role

# The four seeded accounts (PRD §4c people, A36): only the store, driver and their depots are bound.
DISPATCHER = CurrentUser(1, "dispatcher@waypoint.demo", Role.DISPATCHER, "Kumari", None, None, None)
LOADER = CurrentUser(2, "loader@waypoint.demo", Role.LOADER, "Dock tablet", None, None, None)
DRIVER = CurrentUser(3, "driver@waypoint.demo", Role.DRIVER, "Nimal", "kandy", None, "VEH039")
STORE = CurrentUser(4, "store@waypoint.demo", Role.STORE, "Anusha", "kandy", "OUT084", None)

Check = Callable[[CurrentUser, str], None]


@pytest.mark.parametrize(
    ("check", "user", "value"),
    [
        (require_outlet, STORE, "OUT084"),
        (require_outlet, DISPATCHER, "OUT009"),
        (require_vehicle, DRIVER, "VEH039"),
        (require_vehicle, DISPATCHER, "VEH003"),
        (require_depot, STORE, "kandy"),
        (require_depot, DRIVER, "kandy"),
        (require_depot, LOADER, "peliyagoda"),
        (require_depot, LOADER, "kandy"),
        (require_depot, DISPATCHER, "peliyagoda"),
    ],
)
def test_own_or_unbound_scope_passes(check: Check, user: CurrentUser, value: str) -> None:
    check(user, value)


@pytest.mark.parametrize(
    ("check", "user", "value"),
    [
        (require_outlet, STORE, "OUT087"),
        (require_vehicle, DRIVER, "VEH003"),
        (require_depot, STORE, "peliyagoda"),
        (require_depot, DRIVER, "peliyagoda"),
    ],
)
def test_someone_elses_scope_is_403(check: Check, user: CurrentUser, value: str) -> None:
    with pytest.raises(ApiError) as err:
        check(user, value)
    assert err.value.status == 403
    assert err.value.code == "forbidden"
