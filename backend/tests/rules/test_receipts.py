"""What a store's receipt must say (register row A50)."""

from __future__ import annotations

from waypoint_rules import (
    SHORTFALL_REASONS,
    ShortfallReason,
    is_short,
    needs_reason,
    reason_missing,
    receipt_line,
    unknown_reason,
)


def test_a_line_is_short_only_when_fewer_units_arrived_than_were_ordered():
    assert is_short(11, 12) is True
    assert is_short(12, 12) is False
    assert is_short(0, 12) is True


def test_only_a_short_receipt_has_to_say_why():
    assert needs_reason([(12, 12), (8, 8)]) is False
    assert needs_reason([(11, 12), (8, 8)]) is True
    assert needs_reason([]) is False


def test_the_four_reasons_are_the_ones_the_sheet_offers_in_the_order_it_lists_them():
    # frontend/src/screens/store/receipt/ShortfallSheet.tsx draws these four chips, Missing first.
    assert SHORTFALL_REASONS == ("Missing", "Damaged", "Wrong item", "Other")
    assert [r.value for r in ShortfallReason] == list(SHORTFALL_REASONS)


def test_the_refusals_name_every_reason_a_store_may_choose():
    assert reason_missing() == "Say why the delivery was short: Missing, Damaged, Wrong item, Other."
    assert unknown_reason("Soggy").startswith("'Soggy' is not a shortfall reason.")
    for reason in SHORTFALL_REASONS:
        assert reason in unknown_reason("Soggy")


def test_a_confirmed_line_reads_back_as_A50_writes_it():
    assert receipt_line("ORD2001", 10, 12, "Missing") == "ORD2001 · 10 of 12 units received · Missing"
    # A full count carries no reason, even if one was sent.
    assert receipt_line("ORD2002", 8, 8, "Missing") == "ORD2002 · 8 of 8 units received"
