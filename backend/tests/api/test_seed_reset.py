"""A demo reset must be quick (PRD v3 §13: back to Mon 15:30 in seconds), and the slow part is hashing passwords.

The reset truncates the operational tables but not the accounts, so seeding again reuses them instead of running bcrypt over
every password and PIN a second time.
"""

from __future__ import annotations

from sqlalchemy import select


def test_a_reset_style_seed_keeps_the_accounts_untouched(client):
    from app.db import SessionLocal
    from app.models.people import Driver, PinPerson, User
    from seed import run as seed_run

    with SessionLocal() as db:
        users = {u.email: u.password_hash for u in db.scalars(select(User))}
        pins = {p.name: p.pin_hash for p in db.scalars(select(PinPerson))}
        drivers = {d.vehicle_id: d.name for d in db.scalars(select(Driver))}
        report = seed_run.seed(db, reuse_accounts=True)
        db.commit()
        assert report["accounts"] == {"reused": True}
        assert {u.email: u.password_hash for u in db.scalars(select(User))} == users
        assert {p.name: p.pin_hash for p in db.scalars(select(PinPerson))} == pins
        assert {d.vehicle_id: d.name for d in db.scalars(select(Driver))} == drivers
    assert users and pins and drivers
