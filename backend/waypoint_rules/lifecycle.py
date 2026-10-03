"""The order state machine (PRD §10). One function decides every status change; an illegal
transition raises :class:`IllegalTransition`, which the API turns into a 409.

```
ordered ──cutoff──▶ confirmed ──draft──▶ planned ──gate──▶ loaded ──start──▶ departed ──outcome──▶ delivered
   │                   │                    │  ▲                                  │          │
 cancel (≤16:00)       └──▶ deferred ◀──────┘  └── serve instead / swap           │          ├──▶ partial
                                                                                   ├──▶ issue
                                                                                   └──▶ conflict ──resolve──▶ delivered | partial | deferred
```
"""

from __future__ import annotations

from enum import StrEnum

from .vocab import OrderStatus as S


class OrderEvent(StrEnum):
    CUTOFF = "cutoff"
    CANCEL = "cancel"
    PLAN = "plan"  #: drafted onto a trip, or served instead / swapped back in
    DEFER = "defer"
    WITHDRAW_DEFERRAL = "withdraw_deferral"
    LOAD = "load"  #: loader gate
    DEPART = "depart"
    DELIVER = "deliver"
    FAIL = "fail"  #: refused, store closed, damaged, road problem, store-reported issue
    SHORTFALL = "shortfall"  #: store reports fewer units
    CONFLICT = "conflict"  #: set only by the sync service
    RESOLVE_DELIVERED = "resolve_delivered"
    RESOLVE_PARTIAL = "resolve_partial"
    RESOLVE_DEFERRED = "resolve_deferred"


class IllegalTransition(ValueError):
    def __init__(self, status: S, event: OrderEvent):
        super().__init__(f"An order that is {status.value} can't {event.value.replace('_', ' ')}")
        self.status = status
        self.event = event


_T: dict[tuple[S, OrderEvent], S] = {
    (S.ORDERED, OrderEvent.CUTOFF): S.CONFIRMED,
    (S.CONFIRMED, OrderEvent.PLAN): S.PLANNED,
    (S.CONFIRMED, OrderEvent.DEFER): S.DEFERRED,
    (S.PLANNED, OrderEvent.DEFER): S.DEFERRED,
    (S.PLANNED, OrderEvent.PLAN): S.PLANNED,  # moved to another trip
    (S.DEFERRED, OrderEvent.PLAN): S.PLANNED,  # serve instead / swap
    (S.PLANNED, OrderEvent.LOAD): S.LOADED,
    (S.LOADED, OrderEvent.DEFER): S.DEFERRED,  # D6 defer stop before departure
    (S.LOADED, OrderEvent.DEPART): S.DEPARTED,
    (S.DEPARTED, OrderEvent.DEFER): S.DEFERRED,  # H11: store request while on the road
    (S.DEPARTED, OrderEvent.DELIVER): S.DELIVERED,
    (S.DEPARTED, OrderEvent.FAIL): S.ISSUE,
    (S.DEPARTED, OrderEvent.CONFLICT): S.CONFLICT,
    (S.DEFERRED, OrderEvent.CONFLICT): S.CONFLICT,  # outcome synced after a deferral it never saw
    (S.DEFERRED, OrderEvent.WITHDRAW_DEFERRAL): S.PLANNED,
    (S.DELIVERED, OrderEvent.SHORTFALL): S.PARTIAL,
    (S.DELIVERED, OrderEvent.FAIL): S.ISSUE,
    (S.CONFLICT, OrderEvent.RESOLVE_DELIVERED): S.DELIVERED,
    (S.CONFLICT, OrderEvent.RESOLVE_PARTIAL): S.PARTIAL,
    (S.CONFLICT, OrderEvent.RESOLVE_DEFERRED): S.DEFERRED,
}


def transition(status: S, event: OrderEvent) -> S:
    if status is S.PENDING_SYNC:
        raise IllegalTransition(status, event)
    if event is OrderEvent.CANCEL:
        if status is S.ORDERED:
            # Cancelled orders leave the record; the service sets cancelled_at.
            return S.ORDERED
        raise IllegalTransition(status, event)
    try:
        return _T[(status, event)]
    except KeyError:
        raise IllegalTransition(status, event) from None


def allowed_events(status: S) -> list[OrderEvent]:
    out = [e for (s, e) in _T if s is status]
    if status is S.ORDERED:
        out.append(OrderEvent.CANCEL)
    return out
