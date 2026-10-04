"""Dispatch asks someone to call back (the "Call" buttons on D5 and D7).

The dataset has no phone numbers and none is invented (Contributing §29), so a "Call" button cannot dial. It sends a notice
instead, through the feeds each role already reads: the store's updates (S4), the driver's notifications (R8) and the dock
banner on the loader's L1. ``refs.kind == "contact"`` marks it, so the existing notice tags and their CHECK constraints are
unchanged and no migration is needed.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from .. import clock
from ..errors import ApiError, not_found
from ..models.comms import Notice
from ..models.enums import AudienceKind, NoticeTag
from ..models.reference import Depot, Outlet, Vehicle
from ..schemas.dispatcher import ContactIn, ContactOut

CONTACT_KIND = "contact"
TITLE = "Dispatch asked you to call"


def is_contact(notice: Notice) -> bool:
    return (notice.refs or {}).get("kind") == CONTACT_KIND


def send(db: Session, body: ContactIn, *, actor_name: str) -> ContactOut:
    """Write the call-back notice for ``body.to`` and return who it went to. 404 for an unknown outlet, vehicle or dock."""
    now = clock.now(db)
    about = (body.about or "").strip()
    text = f"{actor_name} at Dispatch asked you to call" + (f" about {about}." if about else ".")
    refs = {"kind": CONTACT_KIND, "by": actor_name}

    if body.to == "store":
        if not body.outlet_id:
            raise ApiError(422, "validation_error", "A call to a store needs outletId")
        if db.get(Outlet, body.outlet_id) is None:
            raise not_found(f"Outlet {body.outlet_id}")
        notice = Notice(
            audience_kind=AudienceKind.STORE, outlet_id=body.outlet_id, tag=NoticeTag.CHANGE, title=TITLE, body=text,
            link={"screen": "orders"}, refs=refs, created_at=now,
        )
        recipient = body.outlet_id
    elif body.to == "driver":
        if not body.vehicle_id:
            raise ApiError(422, "validation_error", "A call to a driver needs vehicleId")
        if db.get(Vehicle, body.vehicle_id) is None:
            raise not_found(f"Vehicle {body.vehicle_id}")
        notice = Notice(
            audience_kind=AudienceKind.DRIVER, vehicle_id=body.vehicle_id, tag=NoticeTag.CHANGE, title=TITLE, body=text,
            refs=refs, created_at=now,
        )
        recipient = body.vehicle_id
    else:
        if not body.depot:
            raise ApiError(422, "validation_error", "A call to a dock needs depot")
        if db.get(Depot, body.depot) is None:
            raise not_found(f"Dock {body.depot}")
        notice = Notice(
            audience_kind=AudienceKind.DOCK, depot_id=body.depot, tag=NoticeTag.CHANGE, title=TITLE, body=text,
            refs=refs, created_at=now,
        )
        recipient = f"{body.depot.capitalize()} dock"

    db.add(notice)
    db.flush()
    return ContactOut(to=body.to, recipient=recipient, at=now)
