import type { Brand, DepotId, OrderTemp } from "../../../api/DispatcherApi";

/**
 * The mock's data: PRD v3 section 4c, row for row. IDs, sizes, windows, trip minutes and the
 * hero times come from that table; the rest (generated orders, the 15 extra deferrals) are
 * invented, keep IDs from ORD3001 upward (section 14) and are disclosed in docs/ai-disclosure.md.
 * The real numbers come from the server's `waypoint_rules`; this file only stands in for it.
 */

export type FxOutlet = {
  id: string;
  name: string;
  brand: Brand;
  district: string;
  depot: DepotId;
  /** "Rear dock", "Street", "Mall bay". */
  dock: string;
  access: string[];
  window: [string, string];
  mall?: boolean;
  vanOnly?: boolean;
};

const BRAND_APP: Record<Brand, string> = { Fresh: "Waypoint Fresh", Style: "Waypoint Style", Tech: "Waypoint Tech" };

function outlet(
  id: string,
  brand: Brand,
  district: string,
  dock: "Rear dock" | "Street" | "Mall bay",
  window: [string, string],
  options: { mall?: boolean; vanOnly?: boolean } = {},
): FxOutlet {
  const access: string[] = [dock];
  if (options.vanOnly) access.push("Van only");
  if (options.mall) access.push("Mall dock");
  return {
    id,
    name: `${BRAND_APP[brand]} · ${district}`,
    brand,
    district,
    depot: district === "Kandy" ? "kandy" : "peliyagoda",
    dock,
    access,
    window,
    ...options,
  };
}

const RD = "Rear dock";
const ST = "Street";

export const OUTLETS: Record<string, FxOutlet> = Object.fromEntries(
  [
    outlet("OUT084", "Fresh", "Kandy", RD, ["05:30", "08:00"]),
    outlet("OUT087", "Fresh", "Kandy", RD, ["03:00", "08:00"]),
    outlet("OUT011", "Fresh", "Colombo", RD, ["03:00", "08:00"]),
    outlet("OUT006", "Fresh", "Colombo", ST, ["03:00", "08:00"]),
    outlet("OUT005", "Fresh", "Colombo", RD, ["04:00", "07:45"]),
    outlet("OUT009", "Fresh", "Colombo", RD, ["04:00", "07:45"]),
    outlet("OUT012", "Fresh", "Colombo", RD, ["05:30", "08:00"]),
    outlet("OUT008", "Fresh", "Colombo", RD, ["05:00", "07:30"]),
    outlet("OUT013", "Fresh", "Colombo", RD, ["05:00", "07:30"]),
    outlet("OUT010", "Fresh", "Colombo", RD, ["05:00", "07:30"]),
    outlet("OUT004", "Fresh", "Colombo", ST, ["05:30", "08:00"]),
    outlet("OUT014", "Fresh", "Colombo", ST, ["05:30", "08:00"]),
    outlet("OUT007", "Fresh", "Colombo", ST, ["05:30", "08:00"]),
    outlet("OUT001", "Fresh", "Colombo", ST, ["05:00", "07:30"], { vanOnly: true }),
    outlet("OUT026", "Fresh", "Gampaha", RD, ["03:00", "08:00"]),
    outlet("OUT028", "Fresh", "Gampaha", ST, ["03:00", "08:00"]),
    outlet("OUT032", "Fresh", "Gampaha", RD, ["04:00", "07:45"]),
    outlet("OUT034", "Fresh", "Gampaha", RD, ["05:00", "07:30"]),
    outlet("OUT027", "Fresh", "Gampaha", ST, ["05:00", "07:30"]),
    outlet("OUT025", "Fresh", "Gampaha", RD, ["05:30", "08:00"]),
    outlet("OUT029", "Fresh", "Gampaha", RD, ["05:30", "08:00"]),
    outlet("OUT033", "Fresh", "Gampaha", RD, ["05:30", "08:00"]),
    outlet("OUT015", "Style", "Colombo", "Mall bay", ["09:00", "11:00"], { mall: true }),
    outlet("OUT017", "Fresh", "Gampaha", RD, ["04:30", "08:00"]),
    outlet("OUT023", "Style", "Colombo", "Mall bay", ["09:00", "11:00"], { mall: true }),
    // Invented: the store that orders after the cutoff (D1.2).
    outlet("OUT021", "Fresh", "Colombo", RD, ["05:00", "07:30"]),
  ].map((o) => [o.id, o]),
);

export type FxOrder = {
  id: string;
  outletId: string;
  temp: OrderTemp;
  units: number;
  kg: number;
  m3: number;
  /** When the store sent it, on the hero evening. */
  receivedAt: string;
  deferredYesterday?: boolean;
  daysSinceServed: number;
  /** Order-level window when it differs from the outlet's (the Kandy OUT087 rows). */
  window?: [string, string];
};

export const ORDERS: Record<string, FxOrder> = Object.fromEntries(
  (
    [
      // Peliyagoda story rows (section 4c).
      ["ORD1001", "OUT012", "chilled", 37, 220, 1.5, "13:41", true, 2],
      ["ORD1005", "OUT029", "chilled", 13, 80, 0.7, "13:48", true, 2],
      ["ORD1002", "OUT009", "chilled", 35, 210, 1.4, "14:02", false, 1],
      ["ORD1020", "OUT001", "chilled", 208, 1250, 8.6, "15:12", false, 3],
      ["ORD1007", "OUT015", "ambient", 30, 450, 6.5, "14:27", false, 7],
      ["ORD1025", "OUT017", "chilled", 24, 150, 1.0, "14:39", false, 1],
      ["ORD1026", "OUT023", "ambient", 18, 260, 3.1, "15:03", false, 1],
      // Trip rows with no received time in 4c: earlier in the day.
      ["ORD1014", "OUT011", "chilled", 40, 240, 1.6, "11:20", false, 1],
      ["ORD1016", "OUT006", "chilled", 38, 230, 1.5, "11:42", false, 1],
      ["ORD1011", "OUT005", "chilled", 43, 260, 1.7, "12:05", false, 1],
      ["ORD1013", "OUT008", "chilled", 12, 70, 0.7, "10:30", false, 1],
      ["ORD1015", "OUT013", "chilled", 12, 75, 0.7, "10:48", false, 1],
      ["ORD1018", "OUT010", "chilled", 17, 100, 1.0, "11:02", false, 1],
      ["ORD1012", "OUT004", "chilled", 16, 95, 0.9, "12:14", false, 1],
      ["ORD1009", "OUT014", "chilled", 16, 95, 0.9, "12:31", false, 1],
      ["ORD1017", "OUT007", "chilled", 11, 65, 0.6, "12:47", false, 1],
      ["ORD1023", "OUT026", "chilled", 11, 65, 0.6, "09:40", false, 1],
      ["ORD1024", "OUT028", "chilled", 17, 100, 0.9, "09:52", false, 1],
      ["ORD1022", "OUT032", "chilled", 15, 90, 0.8, "10:05", false, 1],
      ["ORD1021", "OUT034", "chilled", 12, 75, 0.7, "10:16", false, 1],
      ["ORD1004", "OUT027", "chilled", 15, 90, 0.8, "13:02", false, 1],
      ["ORD1003", "OUT025", "chilled", 20, 120, 1.0, "13:10", false, 1],
      ["ORD1006", "OUT033", "chilled", 22, 130, 1.1, "13:22", false, 1],
      // Kandy: the hero pair arrives at 15:40 (walkthrough step 1).
      ["ORD2001", "OUT084", "chilled", 12, 70, 0.7, "15:40", false, 1],
      ["ORD2002", "OUT084", "ambient", 8, 45, 0.6, "15:40", false, 1],
      ["ORD2003", "OUT087", "ambient", 9, 55, 0.6, "14:48", false, 1],
      ["ORD2004", "OUT087", "ambient", 9, 52, 0.6, "14:55", false, 1],
      ["ORD2005", "OUT087", "ambient", 14, 88, 0.9, "15:05", false, 1, ["04:00", "08:00"]],
      ["ORD2006", "OUT087", "ambient", 6, 36, 0.4, "15:18", false, 1, ["03:30", "08:00"]],
      ["ORD2007", "OUT087", "ambient", 11, 70, 0.7, "15:31", false, 1],
      // Invented: placed after the cutoff, counts for Wed 30 Sep.
      ["ORD3001", "OUT021", "chilled", 14, 85, 0.8, "16:07", false, 1],
    ] as [string, string, OrderTemp, number, number, number, string, boolean, number, [string, string]?][]
  ).map(([id, outletId, temp, units, kg, m3, receivedAt, dy, days, window]) => {
    const order: FxOrder = { id, outletId, temp, units, kg, m3, receivedAt, deferredYesterday: dy, daysSinceServed: days };
    if (window) order.window = window;
    return [id, order];
  }),
);

/** The orders each queue shows, in order ("Showing 7 of 212"). */
export const QUEUE_ROWS: Record<DepotId, string[]> = {
  peliyagoda: ["ORD1001", "ORD1005", "ORD1002", "ORD1020", "ORD1007", "ORD1025", "ORD1026", "ORD3001"],
  kandy: ["ORD2001", "ORD2002", "ORD2003", "ORD2004", "ORD2005", "ORD2006", "ORD2007"],
};

export const QUEUE_TOTAL: Record<DepotId, number> = { peliyagoda: 212, kandy: 64 };

/** The extra policy deferrals the plan carries beyond the four named ones (PRD v3 section 4c: "plus 15"). */
export const EXTRA_POLICY_DEFERRALS = 15;

// ---- Vehicles and plan ------------------------------------------------------

export type FxVehicle = {
  id: string;
  depot: DepotId;
  kind: string;
  reefer: boolean;
  van: boolean;
  kgCap: number;
  m3Cap: number;
  kmPerL: number;
  fuelQuota: number;
  driver: string;
};

export const VEHICLES: Record<string, FxVehicle> = {
  VEH003: { id: "VEH003", depot: "peliyagoda", kind: "Reefer / Chilled", reefer: true, van: false, kgCap: 5510, m3Cap: 26.4, kmPerL: 4.7, fuelQuota: 480, driver: "R. Silva" },
  VEH011: { id: "VEH011", depot: "peliyagoda", kind: "Ambient · plain", reefer: false, van: false, kgCap: 7200, m3Cap: 38.0, kmPerL: 4.9, fuelQuota: 600, driver: "S. Jayasena" },
  VEH035: { id: "VEH035", depot: "peliyagoda", kind: "Reefer / Chilled", reefer: true, van: true, kgCap: 1040, m3Cap: 7.0, kmPerL: 10.3, fuelQuota: 480, driver: "P. Kumara" },
  VEH036: { id: "VEH036", depot: "peliyagoda", kind: "Reefer / Chilled", reefer: true, van: true, kgCap: 1040, m3Cap: 7.0, kmPerL: 10.3, fuelQuota: 480, driver: "R. Silva" },
  VEH039: { id: "VEH039", depot: "kandy", kind: "Reefer / Chilled", reefer: true, van: false, kgCap: 6180, m3Cap: 29.9, kmPerL: 5.0, fuelQuota: 370, driver: "Nimal" },
};

export type FxStop = { orderIds: string[]; outletId: string; arrival: string; note?: string };

export type FxTrip = {
  vehicleId: string;
  trip: number;
  departs: string;
  brand: Brand;
  district: string;
  minutes: number;
  stops: FxStop[];
};

const s = (outletId: string, orderIds: string | string[], arrival: string, note?: string): FxStop => ({
  outletId,
  orderIds: Array.isArray(orderIds) ? orderIds : [orderIds],
  arrival,
  ...(note ? { note } : {}),
});

/** Plan v3, released Mon 23:40 (section 4c). */
export const TRIPS_V3: FxTrip[] = [
  {
    vehicleId: "VEH003", trip: 1, departs: "03:30", brand: "Fresh", district: "Colombo", minutes: 132,
    stops: [s("OUT011", "ORD1014", "03:54"), s("OUT006", "ORD1016", "04:17"), s("OUT005", "ORD1011", "04:41"), s("OUT009", "ORD1002", "05:04"), s("OUT012", "ORD1001", "05:27", "waits to 05:30")],
  },
  {
    vehicleId: "VEH003", trip: 2, departs: "06:09", brand: "Fresh", district: "Colombo", minutes: 109,
    stops: [s("OUT008", "ORD1013", "06:33"), s("OUT013", "ORD1015", "06:56"), s("OUT010", "ORD1018", "07:19"), s("OUT004", "ORD1012", "07:42")],
  },
  {
    vehicleId: "VEH035", trip: 1, departs: "03:30", brand: "Fresh", district: "Colombo", minutes: 125,
    stops: [s("OUT026", "ORD1023", "04:07"), s("OUT028", "ORD1024", "04:31"), s("OUT032", "ORD1022", "04:56"), s("OUT034", "ORD1021", "05:20")],
  },
  {
    vehicleId: "VEH035", trip: 2, departs: "06:12", brand: "Fresh", district: "Colombo", minutes: 101,
    stops: [s("OUT027", "ORD1004", "06:49"), s("OUT025", "ORD1003", "07:14"), s("OUT029", "ORD1005", "07:38")],
  },
  {
    vehicleId: "VEH011", trip: 1, departs: "08:36", brand: "Style", district: "Colombo", minutes: 83,
    stops: [s("OUT015", "ORD1007", "09:00", "mall window opens 09:00")],
  },
  {
    vehicleId: "VEH039", trip: 1, departs: "05:10", brand: "Fresh", district: "Kandy", minutes: 73,
    stops: [s("OUT084", ["ORD2001", "ORD2002"], "05:26", "waits to 05:30"), s("OUT087", "ORD2003", "06:06")],
  },
];

/** Plan v4: VEH003's orders move to VEH036 (same stops), ORD1002 is deferred by policy. OUT012 is now reached 05:04. */
export const TRIPS_V4: FxTrip[] = [
  {
    vehicleId: "VEH036", trip: 1, departs: "03:30", brand: "Fresh", district: "Colombo", minutes: 109,
    stops: [s("OUT011", "ORD1014", "03:54"), s("OUT006", "ORD1016", "04:17"), s("OUT005", "ORD1011", "04:41"), s("OUT012", "ORD1001", "05:04", "waits to 05:30")],
  },
  { ...TRIPS_V3[1]!, vehicleId: "VEH036" },
  TRIPS_V3[2]!,
  TRIPS_V3[3]!,
  TRIPS_V3[4]!,
  TRIPS_V3[5]!,
];

/** Meters beside each lane header: used / limit. */
export const LANE_METERS: Record<string, { label: string; used: number; limit: number; unit: string }[]> = {
  VEH003: [{ label: "Fresh", used: 241, limit: 270, unit: "min" }, { label: "Fuel", used: 74.2, limit: 480, unit: "L" }],
  VEH035: [{ label: "Fresh", used: 226, limit: 270, unit: "min" }, { label: "Fuel", used: 54.3, limit: 480, unit: "L" }],
  VEH011: [{ label: "Style+Tech", used: 83, limit: 480, unit: "min" }, { label: "Fuel", used: 68.9, limit: 600, unit: "L" }],
  VEH036: [{ label: "Fresh", used: 218, limit: 270, unit: "min" }, { label: "Fuel", used: 29.0, limit: 480, unit: "L" }],
  VEH039: [{ label: "Fresh", used: 73, limit: 270, unit: "min" }, { label: "Fuel", used: 75.4, limit: 370, unit: "L" }],
};

/** The four named deferrals of plan v3 (section 4c). */
export type FxDeferral = {
  orderId: string;
  kind: "capacity" | "policy";
  binding: string;
  /** "Outside window" */
  headline: string;
  /** The one-line summary. */
  line: string;
  frees: string;
  impact: string;
  decidedBy: string;
};

export const NAMED_DEFERRALS: FxDeferral[] = [
  {
    orderId: "ORD1020", kind: "capacity", binding: "van access",
    headline: "Van-only access",
    line: "Van-only access · van_only and 1,250 kg; the largest Peliyagoda reefer van carries 1,040 kg; whole orders can't split.",
    frees: "(no legal vehicle)", impact: "3 days since served", decidedBy: "System draft · 16:05",
  },
  {
    orderId: "ORD1009", kind: "policy", binding: "window",
    headline: "Outside window",
    line: "Outside window · A 5th stop on VEH003 Trip 2 would arrive 08:06; window closes 08:00.",
    frees: "95 kg / 0.9 m³ on VEH003 Trip 2", impact: "Served yesterday, not skipped before", decidedBy: "System draft · Kumari 21:15",
  },
  {
    orderId: "ORD1017", kind: "policy", binding: "window",
    headline: "Outside window",
    line: "5th stop would arrive 08:06 · frees 65 kg / 0.6 m³",
    frees: "65 kg / 0.6 m³", impact: "Served yesterday, not skipped before", decidedBy: "System draft · Kumari 21:15",
  },
  {
    orderId: "ORD1006", kind: "policy", binding: "window",
    headline: "Outside window",
    line: "4th stop on VEH035 Trip 2 would arrive 08:02 · frees 130 kg / 1.1 m³",
    frees: "130 kg / 1.1 m³", impact: "Served yesterday, not skipped before", decidedBy: "System draft · Kumari 21:15",
  },
];

/** The other 15 policy deferrals at Peliyagoda: invented, ORD3002 upward, not shown one by one. */
export const EXTRA_POLICY_IDS: string[] = Array.from({ length: EXTRA_POLICY_DEFERRALS }, (_, i) => `ORD${3002 + i}`);

// ---- Hero people ------------------------------------------------------------

export const PEOPLE = {
  priya: { name: "Priya", role: "Loader", place: "Peliyagoda dock" },
  ruwan: { name: "Ruwan", role: "Loader", place: "Kandy dock" },
  nimal: { name: "Nimal", role: "Driver", place: "VEH039" },
  silva: { name: "R. Silva", role: "Driver", place: "VEH036" },
} as const;
