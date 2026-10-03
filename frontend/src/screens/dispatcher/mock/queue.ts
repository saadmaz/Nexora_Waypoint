import {
  NO_FILTERS,
  type DepotId,
  type OrderHistory,
  type OrderJourneyStep,
  type QueueFilterTag,
  type QueueFilters,
  type QueueGroup,
  type QueueOrder,
  type QueueTag,
  type QueueView,
} from "../../../api/DispatcherApi";
import type { OrderStatus } from "../../../domain/status";
import { dayLabel } from "../../../domain/format";
import { ORDERS, OUTLETS, QUEUE_ROWS, QUEUE_TOTAL, TRIPS_V3, TRIPS_V4, type FxOrder } from "./fixtures";
import { deferralSets, tripsNow } from "./plan";
import { at, hm, minutesBetween, scenarioTime } from "./time";
import { type Milestones, type World } from "./world";

/** When ORD1020 reached the queue: from then on the queue can flag it (D1). */
const AT_RISK_ORDER = "ORD1020";

function received(order: FxOrder, now: Date): boolean {
  return at(order.receivedAt).getTime() <= now.getTime();
}

/** The status the queue shows for an order at this moment (PRD v3 section 4b). */
export function statusOf(w: World, m: Milestones, orderId: string): OrderStatus {
  if (!m.cutoffClosed) return "Ordered";
  if (!m.releasedAt) return "Confirmed";
  const sets = [deferralSets(w, m, "peliyagoda"), deferralSets(w, m, "kandy")];
  if (sets.some((s) => [...s.capacity, ...s.policy, ...s.storeRequest].includes(orderId))) return "Deferred";
  const trips = tripsNow(w, m);
  const trip = trips.find((t) => t.stops.some((s) => s.orderIds.includes(orderId)));
  const now = m.now;
  if (!trip) return "Planned";
  const depart = scenarioTime(trip.departs);
  const stop = trip.stops.find((s) => s.orderIds.includes(orderId));
  if (m.conflictOpen && ["ORD2001", "ORD2002"].includes(orderId)) return "Conflict";
  if (m.resolvedAt && ["ORD2001", "ORD2002"].includes(orderId)) return w.resolved?.outcome === "Partial" && orderId === "ORD2001" ? "Partial" : "Delivered";
  if (stop && now.getTime() >= scenarioTime(stop.arrival).getTime() + 15 * 60_000 && trip.vehicleId !== "VEH039") return "Delivered";
  if (now.getTime() >= depart.getTime()) return "Departed";
  if (now.getTime() >= depart.getTime() - 20 * 60_000) return "Loaded";
  return "Planned";
}

function accessOf(outletId: string): string[] {
  return OUTLETS[outletId]?.access ?? [];
}

function toQueueOrder(w: World, m: Milestones, order: FxOrder): QueueOrder {
  const outlet = OUTLETS[order.outletId];
  const tags: QueueTag[] = [];
  let note: string | undefined;
  if (order.deferredYesterday) {
    tags.push("Carry-over", "Protected");
    note = "Deferred yesterday: protected by the continuity guard";
  }
  if (order.id === AT_RISK_ORDER) {
    tags.push("No legal vehicle");
    note = "Van only · 8.6 m³ · no van free on Tue 29 Sep";
  }
  if (at(order.receivedAt).getTime() >= at("16:00").getTime()) {
    tags.push("After cutoff");
    note = "Moves to the following run (Wed 30 Sep)";
  }
  const q: QueueOrder = {
    id: order.id,
    outletId: order.outletId,
    brand: outlet?.brand ?? "Fresh",
    district: outlet?.district ?? "Colombo",
    temp: order.temp,
    access: order.temp === "ambient" && outlet?.dock === "Rear dock" ? ["Rear dock"] : accessOf(order.outletId),
    window: { start: order.window?.[0] ?? outlet?.window[0] ?? "00:00", end: order.window?.[1] ?? outlet?.window[1] ?? "00:00" },
    mallWindow: Boolean(outlet?.mall),
    units: order.units,
    kg: order.kg,
    m3: order.m3,
    status: tags.includes("After cutoff") ? "Ordered" : statusOf(w, m, order.id),
    tags,
    receivedAt: order.receivedAt,
  };
  if (note) q.note = note;
  if (order.deferredYesterday) q.daysSinceServed = order.daysSinceServed;
  if (order.id === AT_RISK_ORDER && !m.cutoffClosed) q.justIn = true;
  return q;
}

function windowBucket(start: string): "early" | "mid" | "late" {
  const h = Number(start.slice(0, 2)) + Number(start.slice(3)) / 60;
  return h < 5 ? "early" : h < 6 ? "mid" : "late";
}

function matches(order: QueueOrder, f: QueueFilters, search: string): boolean {
  if (f.brand.length > 0 && !f.brand.includes(order.brand)) return false;
  if (f.temp.length > 0 && !f.temp.includes(order.temp)) return false;
  if (f.status.length > 0 && !f.status.includes(order.status)) return false;
  if (f.district.length > 0 && !f.district.includes(order.district)) return false;
  if (f.window.length > 0 && !f.window.includes(windowBucket(order.window.start))) return false;
  if (f.tags.length > 0) {
    const has = (tag: QueueFilterTag) =>
      tag === "Van only" || tag === "Mall dock" ? order.access.includes(tag) : order.tags.includes(tag);
    if (!f.tags.some((t) => has(t))) return false;
  }
  const s = search.trim().toLowerCase();
  if (s && !`${order.id} ${order.outletId}`.toLowerCase().includes(s)) return false;
  return true;
}

export function queueView(
  w: World,
  m: Milestones,
  query: { depot: DepotId; filters?: QueueFilters; search?: string },
): QueueView {
  const { depot } = query;
  const filters = query.filters ?? NO_FILTERS;
  const search = query.search ?? "";
  const rows = QUEUE_ROWS[depot]
    .map((id) => ORDERS[id])
    .filter((o): o is FxOrder => Boolean(o) && received(o!, m.now))
    .map((o) => toQueueOrder(w, m, o));
  const kept = rows.filter((o) => matches(o, filters, search));
  const filtering = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS) || search.trim() !== "";
  const hiddenCarryOvers = rows.filter((o) => o.tags.includes("Carry-over")).length - kept.filter((o) => o.tags.includes("Carry-over")).length;

  let groups: QueueGroup[];
  if (depot === "kandy") {
    const byOutlet = new Map<string, QueueOrder[]>();
    for (const o of kept) byOutlet.set(o.outletId, [...(byOutlet.get(o.outletId) ?? []), o]);
    groups = [...byOutlet.entries()].map(([outletId, orders]) => {
      const outlet = OUTLETS[outletId];
      const first = orders[0];
      const hero = outletId === "OUT084";
      return {
        key: outletId,
        title: hero ? `${outletId} · ${outlet?.name ?? ""}` : outletId,
        kind: "outlet" as const,
        outlet: {
          id: outletId,
          ...(hero && outlet ? { brand: outlet.brand, dock: outlet.dock, window: { start: outlet.window[0], end: outlet.window[1] } } : {}),
          ...(hero ? { note: `${orders.length} orders · tracked separately` } : {}),
        },
        orders: first ? orders : [],
      };
    });
  } else {
    const carry = kept.filter((o) => o.tags.includes("Carry-over"));
    const other = kept.filter((o) => !o.tags.includes("Carry-over"));
    groups = [
      { key: "carry", title: `Carry-overs · ${carry.length}`, kind: "carry", orders: carry },
      { key: "other", title: "Other orders", kind: "other", orders: other },
    ].filter((g) => g.orders.length > 0) as QueueGroup[];
  }

  const cutoff = at("16:00");
  const atRisk = depot === "peliyagoda" && received(ORDERS[AT_RISK_ORDER]!, m.now) ? 1 : 0;
  const lastReceived = rows.map((r) => r.receivedAt).sort().at(-1);
  const view: QueueView = {
    depot,
    serviceDate: "2026-09-29",
    cutoff: { closed: m.cutoffClosed, at: "16:00", minutesLeft: Math.max(0, minutesBetween(m.now, cutoff)) },
    counts: { ...QUEUE_TOTAL },
    carryOvers: depot === "peliyagoda" ? 2 : 0,
    atRisk,
    groups,
    shown: kept.length,
    total: QUEUE_TOTAL[depot],
    hiddenCarryOvers,
  };
  // An estimate of the whole queue the filters match: the mock holds only the sample rows.
  if (filtering) view.matching = Math.round(kept.length * 12.67);
  if (lastReceived) view.lastReceived = lastReceived;
  return view;
}

export function orderHistory(w: World, m: Milestones, orderId: string): OrderHistory {
  const order = ORDERS[orderId];
  if (!order) throw new Error(`Order ${orderId} was not found.`);
  const outlet = OUTLETS[order.outletId];
  const q = toQueueOrder(w, m, order);
  const status = q.status;
  const protectedOutlet = Boolean(order.deferredYesterday);
  const order7: OrderJourneyStep["step"][] = ["Ordered", "Confirmed", "Planned", "Loaded", "Departed", "Delivered", "Receipt confirmed"];
  const reachedIndex: Record<OrderStatus, number> = {
    Ordered: 0, Confirmed: 1, Planned: 2, Deferred: 2, Loaded: 3, Departed: 4, Delivered: 5, Partial: 5, Issue: 4, "Pending sync": 4, Conflict: 4,
  };
  const at7 = reachedIndex[status];
  const journey: OrderJourneyStep[] = order7.map((step, i) => {
    const base: OrderJourneyStep = { step, state: i < at7 ? "done" : i === at7 ? "current" : "pending" };
    if (step === "Ordered") base.by = `Store · ${order.receivedAt}`;
    if (step === "Confirmed" && i <= at7) base.by = "System · 16:00";
    return base;
  });
  const runs: OrderHistory["lastRuns"] = protectedOutlet
    ? [
        { date: "Thu 24 Sep", outcome: "served", label: "Served" },
        { date: "Fri 25 Sep", outcome: "served", label: "Served" },
        { date: "Sat 26 Sep", outcome: "served", label: "Served" },
        { date: "Mon 28 Sep", outcome: "deferred", label: "Deferred (policy)" },
        { date: "Tue 29 Sep", outcome: "pending", label: "Today pending" },
      ]
    : [
        { date: "Thu 24 Sep", outcome: "served", label: "Served" },
        { date: "Fri 25 Sep", outcome: "served", label: "Served" },
        { date: "Sat 26 Sep", outcome: "served", label: "Served" },
        { date: "Mon 28 Sep", outcome: "served", label: "Served" },
        { date: "Tue 29 Sep", outcome: "pending", label: "Today pending" },
      ];
  return {
    order: q,
    outletName: outlet?.name ?? order.outletId,
    summary: `${outlet?.brand ?? "Fresh"} · ${outlet?.district ?? ""} · ${order.temp} · ${(outlet?.dock ?? "").toLowerCase()}`,
    continuity: protectedOutlet
      ? { protected: true, text: `Deferred yesterday · ${order.daysSinceServed} days since last served · Protected by continuity guard` }
      : { protected: false, text: "Served on the last run · not protected" },
    lastRuns: runs,
    journey,
    notes: [],
  };
}

export { TRIPS_V3, TRIPS_V4, dayLabel, hm };
