import type { ExceptionCandidate, ExceptionView } from "../../../api/DispatcherApi";
import { minutesBetween } from "./time";
import { SCRIPT, type Milestones } from "./world";
import { clockTime } from "../../../domain/format";

/**
 * D8: the loading exception. Priya flags VEH003 at 02:55 ("reefer not holding temperature"); VEH036 is
 * back from the workshop at 02:45 but 120 kg / 0.7 m³ short on Trip 1; the planner recommends deferring
 * ORD1002 (least surplus of four equal-impact orders, OUT012 protected). PRD v3 section 12 "D8 recommendation".
 */
const CANDIDATES: ExceptionCandidate[] = [
  { outletId: "OUT011", orderId: "ORD1014", impact: "Served yesterday", kg: 240, m3: 1.6, protected: false, leastSurplus: false },
  { outletId: "OUT006", orderId: "ORD1016", impact: "Served yesterday", kg: 230, m3: 1.5, protected: false, leastSurplus: false },
  { outletId: "OUT005", orderId: "ORD1011", impact: "Served yesterday", kg: 260, m3: 1.7, protected: false, leastSurplus: false },
  { outletId: "OUT009", orderId: "ORD1002", impact: "Served yesterday · least surplus", kg: 210, m3: 1.4, protected: false, leastSurplus: true },
  { outletId: "OUT012", orderId: "ORD1001", impact: "Deferred yesterday", kg: 220, m3: 1.5, protected: true, leastSurplus: false },
];

export function exceptionView(m: Milestones, id: string): ExceptionView {
  const toDeparture = Math.max(0, minutesBetween(m.now, SCRIPT.depart));
  const decided = Boolean(m.swapAt);
  // Until 03:00 the options are being worked out; after that the recommendation stands until decided.
  const working = !decided && m.now.getTime() < SCRIPT.swap.getTime();

  const base = {
    id,
    flaggedBy: "Priya",
    flaggedAt: "02:55",
    reason: "Reefer not holding temperature",
    ordersText: "9 orders on 2 trips stay Planned. Trip 1 departs 03:30 from the Peliyagoda dock.",
    minutesToDeparture: toDeparture,
    candidates: CANDIDATES,
    need: { kg: 120, m3: 0.7 },
  };

  if (working) {
    return {
      ...base,
      state: "working",
      title: "VEH003 held: replace it before 03:30",
      failed: { vehicleId: "VEH003", spec: "Truck · reefer · 5,510 kg · 26.4 m³", reason: "Reefer not holding temperature", tag: "Held" },
    };
  }

  const view: ExceptionView = {
    ...base,
    state: decided ? "confirmed" : "recommendation",
    title: decided ? "VEH003 replaced by VEH036, plan v4" : "VEH003 held: replace it before 03:30",
    failed: { vehicleId: "VEH003", spec: "Truck · reefer · 5,510 kg · 26.4 m³", reason: "Reefer not holding temperature", tag: decided ? "Replaced" : "Held" },
    replacement: { vehicleId: "VEH036", spec: "Van · reefer · 1,040 kg · 7.0 m³", since: "02:45" },
    before: {
      weight: { used: 1160, limit: 1040, over: "Over by 120 kg, defer one order or swap vehicle" },
      volume: { used: 7.7, limit: 7.0, over: "Over by 0.7 m³" },
      trip2: "Trip 2 fits: 340 kg · 3.3 m³",
    },
    recommendation: {
      orderId: "ORD1002",
      orderIds: ["ORD1002"],
      outletId: "OUT009",
      title: "OUT009: chilled order",
      kind: "policy",
      typeNote: "Deferral type: policy: other reefers could legally carry it but are full",
      reason: "Vehicle unavailable · Least surplus of the four equal-impact orders",
      decidedBy: "Recommended · 03:00",
      impact: "Served yesterday, not skipped before",
      frees: "210 kg / 1.4 m³",
      nextRun: "Wed 30 Sep",
      protected: [{ outletId: "OUT012", orderId: "ORD1001", text: "Deferred yesterday: can't be skipped twice." }],
    },
    after: {
      weight: { used: 950, limit: 1040, warn: "91%: little room left" },
      volume: { used: 6.3, limit: 7.0, warn: "90%: full van" },
      trip1Minutes: 109,
      trip2: "06:09 → OUT004 07:42",
      fresh: "218 / 270 min",
      fuel: "29.0 / 480 L",
      stops: ["OUT011", "OUT006", "OUT005", "OUT012"],
      stopsNote: "OUT012 reached 05:04 · waits to 05:30",
    },
  };
  if (decided && m.swapAt) {
    const time = clockTime(m.swapAt);
    view.confirmed = {
      plan: 4,
      at: time,
      text: "VEH036 carries 950 / 1,040 kg on Trip 1. OUT012 stays on the truck.",
      whoKnows: [
        { who: "Peliyagoda dock", what: `'Plan changed v3 → v4, review' · ${time}` },
        { who: "R. Silva", what: `New trip on phone · ${time}` },
        { who: "OUT009", what: `Deferral notice · ${time} · not yet seen` },
        { who: "Deferrals", what: "Now 20 (1 capacity · 19 policy)" },
      ],
      toast: "Plan v4 released. Loader asked to acknowledge.",
    };
  }
  return view;
}
