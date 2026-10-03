"""Accounts (PRD §14 step 3, A36, A40): four users, two loader PIN people, driver names.

Passwords come from ``DEMO_PASSWORD`` (``.env.example``); the PINs are fixed by A36.
"""

from __future__ import annotations

import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import hash_secret
from app.config import get_settings
from app.models.people import Driver, PinPerson, User
from app.models.reference import Vehicle
from waypoint_rules.vocab import Role

#: email -> (role, display name, depot, outlet, vehicle)
USERS = {
    "dispatcher@waypoint.demo": (Role.DISPATCHER, "Kumari", None, None, None),
    # One shared dock-tablet account for both docks; the dock is a device setting (PRD §9 Auth).
    "loader@waypoint.demo": (Role.LOADER, "Dock tablet", None, None, None),
    "driver@waypoint.demo": (Role.DRIVER, "Nimal", "kandy", None, "VEH039"),
    "store@waypoint.demo": (Role.STORE, "Anusha", "kandy", "OUT084", None),
}

#: name -> (dock, PIN)
PIN_PEOPLE = {"Priya": ("peliyagoda", "1234"), "Ruwan": ("kandy", "5678")}

#: The drivers the story names (PRD §4c). The account holder is Nimal.
NAMED_DRIVERS = {"VEH039": "Nimal", "VEH036": "R. Silva", "VEH035": "P. Kumara", "VEH011": "S. Jayasena"}

_FIRST = ["Kasun", "Nuwan", "Chamara", "Lakmal", "Sampath", "Ajith", "Dinesh", "Ruwan", "Prasad", "Tharindu", "Saman", "Janaka"]
_LAST = ["Perera", "Fernando", "Jayawardena", "Bandara", "Wickramasinghe", "Gunasekara", "Dissanayake", "Herath", "Rathnayake"]


def _generated_name(rng: random.Random) -> str:
    return f"{rng.choice(_FIRST)[0]}. {rng.choice(_LAST)}"


def seed(db: Session) -> dict[str, int]:
    password = hash_secret(get_settings().demo_password)
    users: dict[str, User] = {}
    for email, (role, name, depot, outlet, vehicle) in USERS.items():
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, password_hash=password, role=role, display_name=name)
            db.add(user)
        user.password_hash = password
        user.role, user.display_name = role, name
        user.depot_id, user.outlet_id, user.vehicle_id = depot, outlet, vehicle
        users[email] = user
    db.flush()

    for name, (dock, pin) in PIN_PEOPLE.items():
        person = db.scalar(select(PinPerson).where(PinPerson.name == name))
        pin_hash = hash_secret(pin)  # once: bcrypt is deliberately slow
        if person is None:
            person = PinPerson(name=name, dock=dock, pin_hash=pin_hash)
            db.add(person)
        person.dock = dock
        person.pin_hash = pin_hash
        person.loader_user_id = users["loader@waypoint.demo"].id

    # Fixed seed so a reset gives the same names (PRD §14: deterministic).
    rng = random.Random(2026)
    driver_user = users["driver@waypoint.demo"]
    vehicles = sorted(db.scalars(select(Vehicle.id)))
    for vid in vehicles:
        name = NAMED_DRIVERS.get(vid) or _generated_name(rng)
        driver = db.get(Driver, vid)
        if driver is None:
            driver = Driver(vehicle_id=vid, name=name)
            db.add(driver)
        driver.name = name
        driver.user_id = driver_user.id if vid == driver_user.vehicle_id else None
    db.flush()
    return {"users": len(users), "pin_people": len(PIN_PEOPLE), "drivers": len(vehicles)}
