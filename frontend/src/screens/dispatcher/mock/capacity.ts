import type { CapacityView, DepotId } from "../../../api/DispatcherApi";
import { QUEUE_TOTAL } from "./fixtures";
import { deferralCountAt } from "./plan";
import { versionsAt, type Milestones, type World } from "./world";

/** D2: supply against demand (PRD v3 section 3, 4c). The numbers are the section 4c aggregates. */
export function capacityView(w: World, m: Milestones, depot: DepotId): CapacityView {
  const versions = versionsAt(m);
  const latest = versions.at(-1);
  // The 16:05 draft is the first plan; before it there is nothing to count against.
  const plan: CapacityView["plan"] = m.v1 && latest ? { number: latest.number, state: latest.state, at: latest.at, ...(m.releasedAt ? { releasedAt: "23:40" } : {}) } : null;
  const other: DepotId = depot === "peliyagoda" ? "kandy" : "peliyagoda";
  const otherDeferred = deferralCountAt(w, m, other);

  const base = {
    depot,
    serviceDate: "2026-09-29",
    orders: QUEUE_TOTAL[depot],
    plan,
    vehicles: { available: 34, total: 38, inWorkshop: 4 },
    pool: { depot: other, orders: QUEUE_TOTAL[other], deferred: otherDeferred, enough: depot === "peliyagoda" },
  };

  if (depot === "kandy") {
    const kandyDeferred = deferralCountAt(w, m, "kandy");
    return {
      ...base,
      vehicles: { available: 22, total: 22, inWorkshop: 0 },
      deferrals: { total: kandyDeferred, capacity: 0, policy: 0 },
      binding: null,
      reefers: { available: 5, total: 7, note: "Kandy reefer trucks and vans" },
      busiest: { label: "Style + Tech minutes", vehicleId: "VEH039", used: 0, limit: 480, unit: "min", note: "No Style or Tech trips at Kandy" },
      closest: { label: "Fuel quota", vehicleId: "VEH039", used: 75.4, limit: 370, unit: "L", note: "Weekly quota resets Mon", caption: "This week incl. tonight" },
      pool: { depot: "peliyagoda", orders: QUEUE_TOTAL.peliyagoda, deferred: deferralCountAt(w, m, "peliyagoda"), enough: false },
      fleet: {
        total: 22,
        classes: [
          { label: "Reefer trucks", count: 5, chilled: true, kind: "reefer-truck" },
          { label: "Dry-box trucks", count: 13, chilled: false, kind: "dry-truck" },
          { label: "Reefer vans", count: 2, chilled: true, kind: "reefer-van" },
          { label: "Ambient vans", count: 2, chilled: false, kind: "ambient-van" },
        ],
      },
      lane: {
        vehicleId: "VEH039",
        title: "VEH039 · Reefer truck · Run 1",
        summary: "VEH039 · Fresh 73 / 270 min · fuel 75.4 / 370 L",
        meters: [
          { label: "Weight", used: 170, limit: 6180, unit: "kg" },
          { label: "Volume", used: 1.9, limit: 29.9, unit: "m³" },
          { label: "Fresh minutes", used: 73, limit: 270, unit: "min" },
          { label: "Fuel", used: 75.4, limit: 370, unit: "L" },
        ],
      },
      freshUse: 0.64,
    };
  }

  const total = deferralCountAt(w, m, "peliyagoda");
  const view: CapacityView = {
    ...base,
    deferrals: { total, capacity: 1, policy: total - 1 },
    binding: { resource: "Reefer Fresh minutes", demand: 2590, supply: 2160, available: 8, perVehicle: 270, percent: 120, overBy: 430 },
    reefers: {
      available: m.spareAvailable ? 9 : 8,
      total: 9,
      note: m.spareAvailable ? "VEH036 is spare" : "VEH036 in workshop until 02:45",
    },
    busiest: { label: "Style + Tech minutes", vehicleId: "VEH011", used: 83, limit: 480, unit: "min", note: "All other vehicles under 60%" },
    closest: m.swapAt
      ? { label: "Fuel quota", vehicleId: "VEH035", used: 54.3, limit: 480, unit: "L", note: "Weekly quota resets Mon", caption: "This week incl. tonight" }
      : { label: "Fuel quota", vehicleId: "VEH003", used: 74.2, limit: 480, unit: "L", note: "Weekly quota resets Mon", caption: "This week incl. tonight" },
  };
  if (m.spareAvailable && !m.swapAt) view.spare = { vehicleId: "VEH036", label: "Reefer van", kg: 1040, m3: 7.0, since: "02:45" };
  if (m.releasedAt) view.released = { orders: 276, served: 276 - deferralCountAt(w, m, "peliyagoda") - deferralCountAt(w, m, "kandy"), deferred: deferralCountAt(w, m, "peliyagoda") + deferralCountAt(w, m, "kandy"), at: "23:40" };
  return view;
}
