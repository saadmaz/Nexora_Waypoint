"""LoaderApi routes (PRD §19). Owner: ``feature/loader`` (read endpoints).

Loader writes (``loader.ack``, ``loader.check``, ``loader.confirmLoaded``, ``loader.exception``) are outbox
records sent through ``POST /sync``; there is no per-action route.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from ..deps import Db, Loader
from ..schemas.loader import DockOut, LoaderExceptionOut, LoadPlanOut, PlanDiffOut, VerifyPinIn, VerifyPinOut
from ..services import loader as service

router = APIRouter(prefix="/loader", tags=["loader"])


@router.get("/docks/{dock}", operation_id="getDock", response_model=DockOut)
def get_dock(dock: str, db: Db, user: Loader) -> DockOut:
    """L1: the dock's vehicles for the current plan, with the PIN people who work it."""
    return service.dock_view(db, user, dock)


@router.post("/pins/verify", operation_id="verifyPin", response_model=VerifyPinOut)
def verify_pin(body: VerifyPinIn, db: Db, user: Loader) -> VerifyPinOut:
    """The PIN sheet. The tablet also caches salted hashes so PIN actions can queue offline; the server re-verifies on sync."""
    return service.verify_pin(db, body.person_id, body.pin)


@router.get("/vehicles/{vehicle_id}/trips/{trip}", operation_id="getLoadPlan", response_model=LoadPlanOut)
def get_load_plan(vehicle_id: str, trip: int, db: Db, user: Loader) -> LoadPlanOut:
    """L2: the load list for one trip, in reverse stop order."""
    return service.load_plan(db, user, vehicle_id, trip)


@router.get("/exceptions/{exception_id}", operation_id="getException", response_model=LoaderExceptionOut)
def get_exception(exception_id: int, db: Db, user: Loader) -> LoaderExceptionOut:
    """L3: a flag the loader raised and what dispatch decided."""
    return service.exception_view(db, exception_id)


@router.get("/docks/{dock}/diff", operation_id="getPlanDiff", response_model=PlanDiffOut)
def get_plan_diff(
    dock: str,
    from_version: Annotated[int, Query(alias="from")],
    to_version: Annotated[int, Query(alias="to")],
    db: Db,
    user: Loader,
) -> PlanDiffOut:
    """L1.5: what changed between two plan versions at this dock (``?from=&to=`` are plan version numbers)."""
    return service.plan_diff(db, user, dock, from_version, to_version)
