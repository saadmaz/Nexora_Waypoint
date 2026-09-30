"""LoaderApi routes (PRD §19). Owner: ``feature/loader`` (read endpoints).

Loader writes (``loader.ack``, ``loader.check``, ``loader.confirmLoaded``, ``loader.exception``) are outbox
records sent through ``POST /sync``; there is no per-action route.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..deps import Db, Loader
from ..errors import not_implemented
from ..schemas.loader import DockOut, LoaderExceptionOut, LoadPlanOut, PlanDiffOut, VerifyPinIn, VerifyPinOut

router = APIRouter(prefix="/loader", tags=["loader"])


@router.get("/docks/{dock}", operation_id="getDock", response_model=DockOut)
def get_dock(dock: str, db: Db, user: Loader) -> DockOut:
    """L1: the dock's vehicles for the current plan, with the PIN people who work it."""
    raise not_implemented("getDock")


@router.post("/pins/verify", operation_id="verifyPin", response_model=VerifyPinOut)
def verify_pin(body: VerifyPinIn, db: Db, user: Loader) -> VerifyPinOut:
    """The PIN sheet. The tablet also caches salted hashes so PIN actions can queue offline; the server re-verifies on sync."""
    raise not_implemented("verifyPin")


@router.get("/vehicles/{vehicle_id}/trips/{trip}", operation_id="getLoadPlan", response_model=LoadPlanOut)
def get_load_plan(vehicle_id: str, trip: int, db: Db, user: Loader) -> LoadPlanOut:
    """L2: the load list for one trip, in reverse stop order."""
    raise not_implemented("getLoadPlan")


@router.get("/exceptions/{exception_id}", operation_id="getException", response_model=LoaderExceptionOut)
def get_exception(exception_id: int, db: Db, user: Loader) -> LoaderExceptionOut:
    """L3: a flag the loader raised and what dispatch decided."""
    raise not_implemented("getException")


@router.get("/docks/{dock}/diff", operation_id="getPlanDiff", response_model=PlanDiffOut)
def get_plan_diff(dock: str, from_version: int, to_version: int, db: Db, user: Loader) -> PlanDiffOut:
    """L1.5: what changed between two plan versions at this dock.

    The contract names the query parameters ``from`` and ``to``; they are ``from_version`` and ``to_version``
    here because ``from`` is a Python keyword. The real client maps them.
    """
    raise not_implemented("getPlanDiff")
