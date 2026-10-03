import type { Depot, DepotId, PlannedOrder, Stop, Trip, Vehicle } from "../../domain/field";

/**
 * The loader's seed data (field conventions section 9, PRD v3 section 4c): the two docks, the
 * named people and their PINs, and every vehicle, trip, stop and order the L1 to L4 frames show.
 * Numbers are copied from the "Plan v3 trips" and "Pinned orders" tables and cross-checked against
 * the frames (field conventions section 3, step 6): where a frame's count differs from a strict
 * sum (for example a vehicle's "orders checked" badge), the frame wins.
 */

export const DOCKS: Depot[] = [
  { id: "peliyagoda", name: "Peliyagoda" },
  { id: "kandy", name: "Kandy" },
];

/**
 * The ids are the server's `pin_people.id` (Priya 1, Ruwan 2, seeded by `seed/accounts.py`), not names.
 * In `api` mode the PIN sheet sends this id to `POST /loader/pins/verify`, which only accepts a numeric one,
 * and every record the dock queues carries it as `personId` so the acknowledgement, the load checks and the
 * load gate are attributed to the right person. The mock looks the PIN up in this same list, so both modes agree.
 */
export const LOADER_PEOPLE = [
  { id: "1", name: "Priya", dock: "peliyagoda" as DepotId, pin: "1234" },
  { id: "2", name: "Ruwan", dock: "kandy" as DepotId, pin: "5678" },
];

/** A62 (PRD v3.1 A55): the guest PIN for "Other…", the same at both docks. */
export const GUEST_PIN = "0000";

/**
 * Priya and Ruwan are offered at both docks (L1.2 A, PRD v3.1 A55): `dock` on `LOADER_PEOPLE` is
 * their home dock and is informational only. "Other…" is added by the PinSheet itself.
 */
export function peopleFor(_dockId: DepotId) {
  return LOADER_PEOPLE.map((p) => ({ id: p.id, name: p.name }));
}

export function pinFor(personId: string): string | undefined {
  return LOADER_PEOPLE.find((p) => p.id === personId)?.pin;
}

const VEH003: Vehicle = {
  id: "VEH003",
  depot: "peliyagoda",
  kind: "truck",
  temperature: "reefer",
  weightCapKg: 5510,
  volumeCapM3: 26.4,
  kmPerL: 4.7,
  tags: ["Available"],
};

const VEH035: Vehicle = {
  id: "VEH035",
  depot: "peliyagoda",
  kind: "van",
  temperature: "reefer",
  weightCapKg: 1040,
  volumeCapM3: 7.0,
  kmPerL: 10.3,
  tags: ["Available"],
};

const VEH036: Vehicle = {
  id: "VEH036",
  depot: "peliyagoda",
  kind: "van",
  temperature: "reefer",
  weightCapKg: 1040,
  volumeCapM3: 7.0,
  kmPerL: 10.3,
  tags: ["In workshop"],
};

const VEH011: Vehicle = {
  id: "VEH011",
  depot: "peliyagoda",
  kind: "truck",
  temperature: "ambient",
  weightCapKg: 7200,
  volumeCapM3: 38.0,
  kmPerL: 4.9,
  tags: ["Available"],
};

const VEH039: Vehicle = {
  id: "VEH039",
  depot: "kandy",
  kind: "truck",
  temperature: "reefer",
  weightCapKg: 6180,
  volumeCapM3: 29.9,
  kmPerL: 5.0,
  tags: ["Available"],
};

export const VEHICLES: Record<string, Vehicle> = {
  VEH003: VEH003,
  VEH035: VEH035,
  VEH036: VEH036,
  VEH011: VEH011,
  VEH039: VEH039,
};

/** The moment VEH036 leaves the workshop (X1, assumption A12). */
export const VEH036_AVAILABLE_AT = "02:45";
/** The moment Dispatch decides plan v4 once VEH003's check-failed flag exists (X3). */
export const DECISION_AT = "03:00";

function order(
  id: string,
  outletId: string,
  temperature: PlannedOrder["temperature"],
  units: number,
  weightKg: number,
  volumeM3: number,
  tags: PlannedOrder["tags"] = [],
): PlannedOrder {
  return {
    id,
    outletId,
    units,
    weightKg,
    volumeM3,
    temperature,
    status: "Planned",
    tags: [temperature === "chilled" ? "Chilled" : "Ambient", ...tags],
  };
}

function stop(
  number: number,
  outletId: string,
  brand: Stop["brand"],
  district: string,
  dock: Stop["dock"],
  window: Stop["window"],
  plannedArrival: string,
  orders: PlannedOrder[],
): Stop {
  return { number, outletId, outletName: "Waypoint Fresh", brand, district, dock, window, plannedArrival, orders };
}

/** VEH003 trip 1, Colombo Fresh, as released in plan v3 (5 stops, OUT009 is ORD1002). */
function veh003Trip1(): Stop[] {
  return [
    stop(1, "OUT011", "Fresh", "Colombo", "rear_dock", { open: "03:00", close: "08:00" }, "03:54", [
      order("ORD1014", "OUT011", "chilled", 40, 240, 1.6),
    ]),
    stop(2, "OUT006", "Fresh", "Colombo", "street", { open: "03:00", close: "08:00" }, "04:17", [
      order("ORD1016", "OUT006", "chilled", 38, 230, 1.5),
    ]),
    stop(3, "OUT005", "Fresh", "Colombo", "rear_dock", { open: "04:00", close: "07:45" }, "04:41", [
      order("ORD1011", "OUT005", "chilled", 43, 260, 1.7),
    ]),
    stop(4, "OUT009", "Fresh", "Colombo", "rear_dock", { open: "04:00", close: "07:45" }, "05:04", [
      order("ORD1002", "OUT009", "chilled", 35, 210, 1.4),
    ]),
    stop(5, "OUT012", "Fresh", "Colombo", "rear_dock", { open: "05:30", close: "08:00" }, "05:27", [
      order("ORD1001", "OUT012", "chilled", 37, 220, 1.5, ["Carry-over", "Protected"]),
    ]),
  ];
}

/** VEH036 trip 1 after the swap (X5): the same four non-deferred stops, renumbered 1 to 4. */
function veh036Trip1(): Stop[] {
  return veh003Trip1()
    .filter((s) => s.outletId !== "OUT009")
    .map((s, i) => ({ ...s, number: i + 1 }));
}

function veh003Trip2(): Stop[] {
  return [
    stop(1, "OUT008", "Fresh", "Colombo", "rear_dock", { open: "05:00", close: "07:30" }, "06:33", [
      order("ORD1013", "OUT008", "chilled", 12, 70, 0.7),
    ]),
    stop(2, "OUT013", "Fresh", "Colombo", "rear_dock", { open: "05:00", close: "07:30" }, "06:56", [
      order("ORD1015", "OUT013", "chilled", 12, 75, 0.7),
    ]),
    stop(3, "OUT010", "Fresh", "Colombo", "rear_dock", { open: "05:00", close: "07:30" }, "07:19", [
      order("ORD1018", "OUT010", "chilled", 17, 100, 1.0),
    ]),
    stop(4, "OUT004", "Fresh", "Colombo", "street", { open: "05:30", close: "08:00" }, "07:42", [
      order("ORD1012", "OUT004", "chilled", 16, 95, 0.9),
    ]),
  ];
}

function veh035Trip1(): Stop[] {
  return [
    stop(1, "OUT026", "Fresh", "Gampaha", "rear_dock", { open: "03:00", close: "08:00" }, "04:07", [
      order("ORD1023", "OUT026", "chilled", 11, 65, 0.6),
    ]),
    stop(2, "OUT028", "Fresh", "Gampaha", "street", { open: "03:00", close: "08:00" }, "04:31", [
      order("ORD1024", "OUT028", "chilled", 17, 100, 0.9),
    ]),
    stop(3, "OUT032", "Fresh", "Gampaha", "rear_dock", { open: "04:00", close: "07:45" }, "04:56", [
      order("ORD1022", "OUT032", "chilled", 15, 90, 0.8),
    ]),
    stop(4, "OUT034", "Fresh", "Gampaha", "rear_dock", { open: "05:00", close: "07:30" }, "05:20", [
      order("ORD1021", "OUT034", "chilled", 12, 75, 0.7),
    ]),
  ];
}

function veh035Trip2(): Stop[] {
  return [
    stop(1, "OUT027", "Fresh", "Gampaha", "street", { open: "05:00", close: "07:30" }, "06:49", [
      order("ORD1004", "OUT027", "chilled", 15, 90, 0.8),
    ]),
    stop(2, "OUT025", "Fresh", "Gampaha", "rear_dock", { open: "05:30", close: "08:00" }, "07:14", [
      order("ORD1003", "OUT025", "chilled", 20, 120, 1.0),
    ]),
    stop(3, "OUT029", "Fresh", "Gampaha", "rear_dock", { open: "05:30", close: "08:00" }, "07:38", [
      order("ORD1005", "OUT029", "chilled", 13, 80, 0.7, ["Carry-over", "Protected"]),
    ]),
  ];
}

function veh011Trip1(): Stop[] {
  return [
    stop(1, "OUT015", "Style", "Colombo", "mall_bay", { open: "09:00", close: "11:00" }, "09:00", [
      order("ORD1007", "OUT015", "ambient", 30, 450, 6.5),
    ]),
  ];
}

function veh039Trip1(): Stop[] {
  return [
    stop(1, "OUT084", "Fresh", "Kandy", "rear_dock", { open: "05:30", close: "08:00" }, "05:26", [
      order("ORD2001", "OUT084", "chilled", 12, 70, 0.7),
      order("ORD2002", "OUT084", "ambient", 8, 45, 0.6),
    ]),
    stop(2, "OUT087", "Fresh", "Kandy", "rear_dock", { open: "03:00", close: "08:00" }, "06:06", [
      order("ORD2003", "OUT087", "ambient", 9, 55, 0.6),
    ]),
  ];
}

/** Every trip as released in plan v3, keyed "VEHICLE·trip". */
export function tripsV3(): Record<string, Trip> {
  return {
    "VEH003·1": { vehicleId: "VEH003", tripNo: 1, departsAt: "03:30", stops: veh003Trip1() },
    "VEH003·2": { vehicleId: "VEH003", tripNo: 2, departsAt: "06:09", stops: veh003Trip2() },
    "VEH035·1": { vehicleId: "VEH035", tripNo: 1, departsAt: "03:30", stops: veh035Trip1() },
    "VEH035·2": { vehicleId: "VEH035", tripNo: 2, departsAt: "06:12", stops: veh035Trip2() },
    "VEH011·1": { vehicleId: "VEH011", tripNo: 1, departsAt: "08:36", stops: veh011Trip1() },
    "VEH039·1": { vehicleId: "VEH039", tripNo: 1, departsAt: "05:10", stops: veh039Trip1() },
  };
}

/** Plan v4 (X3, Tue 03:00): VEH003's trips move to VEH036 (trip 1 loses OUT009); ORD1002 deferred. */
export function tripsV4(): Record<string, Trip> {
  const v3 = tripsV3();
  return {
    ...v3,
    "VEH036·1": { vehicleId: "VEH036", tripNo: 1, departsAt: "03:30", stops: veh036Trip1() },
    "VEH036·2": { vehicleId: "VEH036", tripNo: 2, departsAt: "06:09", stops: veh003Trip2() },
  };
}
