"""The D5 and D7 "Call" buttons and D4.2 "Resend notice" (fix/dead-buttons).

The dataset has no phone numbers and none is invented (Contributing §29), so "Call" asks the person to call back through the
feed their role already reads. These need the test database (see ``conftest.py``).
"""

from __future__ import annotations

CONTACT = "/api/v1/dispatcher/contact"


def advance(client, auth, to: str) -> None:
    res = client.post("/api/v1/demo/advance", json={"to": to}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text


def test_a_call_to_the_store_lands_in_its_updates(client, auth, reseed):
    res = client.post(CONTACT, json={"to": "store", "outletId": "OUT084", "about": "the delivery under review"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    assert res.json()["recipient"] == "OUT084"
    feed = client.get("/api/v1/store/updates", headers=auth("store")).json()
    top = feed["updates"][0]
    assert top["title"] == "Dispatch asked you to call"
    assert "about the delivery under review" in top["body"]
    assert top["unread"] is True


def test_a_call_to_the_driver_lands_in_notifications(client, auth, reseed):
    res = client.post(CONTACT, json={"to": "driver", "vehicleId": "VEH039"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    notices = client.get("/api/v1/driver/notices", headers=auth("driver")).json()
    assert notices[0]["tag"] == "call_request"
    assert notices[0]["title"] == "Dispatch asked you to call"


def test_a_call_to_the_dock_shows_on_the_dock(client, auth, reseed):
    res = client.post(CONTACT, json={"to": "dock", "depot": "kandy", "about": "plan v4"}, headers=auth("dispatcher"))
    assert res.status_code == 200, res.text
    assert res.json()["recipient"] == "Kandy dock"
    dock = client.get("/api/v1/loader/docks/kandy", headers=auth("loader")).json()
    assert dock["requests"][0]["title"] == "Dispatch asked you to call"
    other = client.get("/api/v1/loader/docks/peliyagoda", headers=auth("loader")).json()
    assert other["requests"] == []


def test_a_call_needs_its_recipient(client, auth):
    assert client.post(CONTACT, json={"to": "store"}, headers=auth("dispatcher")).status_code == 422
    assert client.post(CONTACT, json={"to": "driver", "vehicleId": "VEH999"}, headers=auth("dispatcher")).status_code == 404


def test_only_the_dispatcher_can_ask_for_a_call(client, auth):
    res = client.post(CONTACT, json={"to": "store", "outletId": "OUT084"}, headers=auth("driver"))
    assert res.status_code == 403


def test_resend_sends_one_notice_again(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    first = client.post("/api/v1/dispatcher/deferrals/notify", json={"depot": "peliyagoda"}, headers=auth("dispatcher"))
    assert first.status_code == 200 and first.json()["sent"] >= 1
    again = client.post("/api/v1/dispatcher/deferrals/notify", json={"depot": "peliyagoda", "orderId": "ORD1020"}, headers=auth("dispatcher"))
    assert again.status_code == 200, again.text
    assert again.json()["sent"] == 1


def test_resend_of_an_order_that_is_not_deferred_is_a_404(client, auth, reseed):
    advance(client, auth, "2026-09-28T16:06:00+05:30")
    res = client.post("/api/v1/dispatcher/deferrals/notify", json={"depot": "peliyagoda", "orderId": "ORD2001"}, headers=auth("dispatcher"))
    assert res.status_code == 404
