"""What a store's receipt must say (PRD §19 StoreApi, register row A50).

The store confirms what arrived. When any line is below what was ordered the button on S3.1 becomes
"Confirm with a shortfall" and a sheet asks why before it sends. That "why" is a rule, so it lives here
and not in the screen: the API refuses a short receipt that carries no reason, and the sheet and the API
offer the same four words.
"""

from __future__ import annotations

from enum import StrEnum


class ShortfallReason(StrEnum):
    """The reasons S3.1 B offers (``frontend/src/screens/store/receipt/ShortfallSheet.tsx``)."""

    MISSING = "Missing"
    DAMAGED = "Damaged"
    WRONG_ITEM = "Wrong item"
    OTHER = "Other"


#: In the order the sheet lists them, which is the order a refusal names them in.
SHORTFALL_REASONS: tuple[str, ...] = tuple(r.value for r in ShortfallReason)


def is_short(received: int, ordered: int) -> bool:
    """A line is short when fewer units arrived than were ordered. More than ordered is not a receipt at all."""
    return received < ordered


def needs_reason(lines: list[tuple[int, int]]) -> bool:
    """True when any ``(received, ordered)`` line is short, so the receipt has to say why (A50)."""
    return any(is_short(received, ordered) for received, ordered in lines)


def reason_missing() -> str:
    """Refusal when a short receipt arrives with no reason."""
    return f"Say why the delivery was short: {', '.join(SHORTFALL_REASONS)}."


def unknown_reason(value: str) -> str:
    """Refusal when the reason is not one the sheet offers."""
    return f"{value!r} is not a shortfall reason. Choose one of: {', '.join(SHORTFALL_REASONS)}."


def receipt_line(order_id: str, received: int, ordered: int, reason: str | None) -> str:
    """How a confirmed line reads back (A50): "ORD2001 · 10 of 12 units received · Missing"."""
    text = f"{order_id} · {received} of {ordered} units received"
    return f"{text} · {reason}" if reason and is_short(received, ordered) else text
