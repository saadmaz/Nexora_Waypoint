import type { Decision, DepotId, LiveBoardView, LiveRow, LiveStop } from "../../../api/DispatcherApi";
import { ORDERS, OUTLETS, TRIPS_V3, TRIPS_V4, VEHICLES, type FxTrip } from "./fixtures";
import { agoLabel, at, hm, minutesBetween } from "./time";
import { SCRIPT, type Milestones, type World } from "./world";

/**
 * D6: the exception-first live board, no map (PRD v3 section 3). The counts follow the clock with the
 * figures the design fixes at its frame times (22 delivered at 05:12, 24 at 05:30, 31 at 06:40, 33
 * after the conflict is settled), and every number on the board agrees with the rest of the frame
 * (design fix D-2).
 */

const T = (hhmm: string) => at(hhmm, true);

function delivered(m: Milestones): number {
  const keys: [Date, number][] = [
    [T("03:30"), 0],
    [T("05:12"), 22],
    [T("05:19"), 23],
    [T("05:22"), 24],
    [T("06:40"), 31],
  ];
  const now = m.now.getTime();
  let value = 0;
  for (let i = 0; i < keys.length; i++) {
    const [t, v] = keys[i]!;
    if (now >= t.getTime()) value = v;
    const next = keys[i + 1];
    if (next && now > t.getTime() && now < next[0].getTime()) {
      const f = (now - t.getTime()) / (next[0].getTime() - t.getTime());
      value = Math.floor(v + f * (next[1] - v));
    }
  }
  return m.resolvedAt ? 33 : value;
}

const tripOf = (v: string, trip: number): FxTrip | undefined => [...TRIPS_V4, ...TRIPS_V3].find((t) => t.vehicleId === v && t.trip === trip);

/** Stops of a trip that are done at `now`: arrived, and past the window opening. */
function stopsDone(trip: FxTrip, now: Date): number {
  return trip.stops.filter((s) => {
    const outlet = OUTLETS[s.outletId];
    const arrive = at(s.arrival, Number(s.arrival.slice(0, 2)) < 12);
    const open = outlet ? at(outlet.window[0], Number(outlet.window[0].slice(0, 2)) < 12) : arrive;
    return now.getTime() > Math.max(arrive.getTime(), open.getTime());
  }).length;
}

function riskFor(m: Milestones, vehicleId: string): LiveRow["risk"] {
  if (vehicleId === "VEH039" && m.offline) return "Unknown · offline";
  if (vehicleId === "VEH003" && m.held && !m.swapAt) return "At risk";
  return "On time";
}

function liveStop(w: World, m: Milestones, outletId: string, orderIds: string[], eta: string): LiveStop {
  const outlet = OUTLETS[outletId];
  const window = { start: outlet?.window[0] ?? "", end: outlet?.window[1] ?? "" };
  const stop: LiveStop = {
    outletId,
    outletName: outlet?.name.split(" · ")[0] ?? outletId,
    brand: outlet?.brand ?? "Fresh",
    orders: orderIds.map((id) => ({ id, temp: ORDERS[id]?.temp ?? "chilled", units: ORDERS[id]?.units ?? 0 })),
    eta: `ETA ${eta} · window ${window.start}-${window.end}`,
    window,
    status: "Departed",
    canDefer: true,
  };
  void w;
  void m;
  return stop;
}

function kandyStops(w: World, m: Milestones): LiveStop[] {
  const a = liveStop(w, m, "OUT084", ["ORD2001", "ORD2002"], "05:26");
  const b = liveStop(w, m, "OUT087", ["ORD2003"], "06:06");
  const departed = m.now.getTime() >= SCRIPT.kandyDepart.getTime();
  a.status = departed ? "Departed" : "Loaded";
  b.status = departed ? "Departed" : "Loaded";
  if (m.storeRequestAt && !m.conflictAt) {
    a.status = "Change pending";
    a.change = "Deferred · store request → Wed";
  }
  if (m.conflictAt) {
    b.status = "Delivered";
    b.statusNote = "Delivered 05:58";
    b.canDefer = false;
    if (m.conflictOpen) {
      a.status = "Conflict";
    } else {
      a.status = "Delivered";
      a.canDefer = false;
      if (m.now.getTime() >= T("07:30").getTime() || w.resolved?.outcome === "Partial") {
        a.statusNote = w.resolved?.outcome === "Partial" ? "Partial · follow-up created" : "Receipt confirmed 07:30";
      } else {
        a.statusNote = "Delivered 05:42";
      }
      const by = w.resolved ? `Resolved by Kumari ${hm(w.resolved.at)}, ${w.resolved.outcome === "Partial" ? "kept as Partial" : "kept delivery"}` : "";
      if (by) a.tooltip = `${by}. Both records kept in the audit.`;
    }
  }
  return [a, b];
}

function vehicle039(w: World, m: Milestones): LiveRow {
  const now = m.now;
  const departed = now.getTime() >= SCRIPT.kandyDepart.getTime();
  const stops = kandyStops(w, m);
  const base: LiveRow = {
    vehicleId: "VEH039",
    trip: 1,
    driver: "Nimal",
    planOnDevice: m.conflictAt ? 5 : m.swapAt ? 4 : 3,
    changePending: Boolean(m.storeRequestAt && !m.conflictAt),
    nextStop: departed ? "OUT084 · arrive about 05:26" : "Kandy · departs 05:10",
    risk: riskFor(m, "VEH039"),
    stops: { done: 0, total: 2 },
    lastHeard: {},
    status: departed ? "Departed" : "Planned",
    held: false,
    stopsDetail: departed ? stops : [],
    expanded: departed,
  };
  if (departed && !m.offline && !m.conflictAt) base.lastHeard = { time: hm(now), age: "now" };
  if (m.offline) {
    base.lastHeard = { time: "05:17", age: `${agoLabel(now, SCRIPT.offline)} · known gap` };
    base.offlineNote = "The phone keeps recording offline. Records arrive when it's back in coverage.";
  }
  if (m.conflictAt) {
    base.nextStop = "Returning to Kandy";
    base.stops = { done: 2, total: 2 };
    base.lastHeard = { time: "06:40", note: "5 synced · 1 conflict", synced: true };
    if (!m.conflictOpen) {
      base.status = "Delivered";
      base.lastHeard = { time: hm(new Date(now.getTime() - 2 * 60_000)), age: "now", synced: true };
    }
  }
  return base;
}

function tripRow(w: World, m: Milestones, vehicleId: string): LiveRow {
  const now = m.now;
  const driver = VEHICLES[vehicleId]?.driver ?? "";
  const t1 = tripOf(vehicleId, 1)!;
  const t2 = tripOf(vehicleId, 2);
  const afterDone1 = stopsDone(t1, now) >= t1.stops.length;
  const departed2 = t2 ? now.getTime() >= at(t2.departs, true).getTime() : false;
  const onTrip2 = Boolean(t2) && (afterDone1 || departed2) && now.getTime() >= at(t1.departs, true).getTime();
  const trip = onTrip2 && t2 ? t2 : t1;
  const tripNo = onTrip2 && t2 ? 2 : 1;
  const done = stopsDone(trip, now);
  const pending = trip.stops[done];
  const departs = at(trip.departs, true);
  const hasDeparted = now.getTime() >= departs.getTime();

  let nextStop: string;
  if (!hasDeparted) {
    nextStop = vehicleId === "VEH011" ? "OUT015 · departs 08:36" : `Loading · departs ${trip.departs}`;
  } else if (!pending) {
    nextStop = "Returning to the depot";
  } else {
    const outlet = OUTLETS[pending.outletId];
    const arrive = at(pending.arrival, Number(pending.arrival.slice(0, 2)) < 12);
    const open = at(outlet?.window[0] ?? pending.arrival, Number((outlet?.window[0] ?? "12").slice(0, 2)) < 12);
    nextStop =
      now.getTime() >= arrive.getTime() && now.getTime() < open.getTime()
        ? `At ${pending.outletId} · waiting for ${outlet?.window[0]}`
        : `${pending.outletId} · ${tripNo === 2 ? "ETA" : "planned"} ${pending.arrival}`;
  }
  let heard: LiveRow["lastHeard"] = {};
  if (vehicleId === "VEH011") {
    heard = { time: hm(now.getTime() >= T("06:00").getTime() ? new Date(now.getTime() - 4 * 60_000) : T("05:02")) };
    if (now.getTime() < T("05:02").getTime()) heard = { time: "02:50" };
  } else if (hasDeparted) {
    const ago = vehicleId === "VEH036" ? (now.getTime() < T("06:00").getTime() ? 3 : 2) : 1;
    heard = { time: hm(new Date(now.getTime() - ago * 60_000)), age: `${ago} min` };
  } else if (now.getTime() >= T("02:45").getTime()) {
    heard = { time: "02:50" };
  }
  const status: LiveRow["status"] = hasDeparted ? "Departed" : "Planned";
  void w;
  return {
    vehicleId,
    trip: tripNo,
    driver,
    planOnDevice: vehicleId === "VEH011" ? (m.swapAt ? 4 : 3) : m.swapAt ? 4 : 3,
    changePending: false,
    nextStop,
    risk: "On time",
    stops: { done, total: trip.stops.length },
    lastHeard: heard,
    status: status,
    held: false,
    stopsDetail: [],
    expanded: false,
  };
}

function heldRow(m: Milestones): LiveRow {
  return {
    vehicleId: "VEH003",
    trip: 1,
    driver: "R. Silva",
    planOnDevice: 3,
    changePending: false,
    nextStop: "At dock · departs 03:30",
    risk: riskFor(m, "VEH003"),
    stops: { done: 0, total: 5 },
    lastHeard: { time: "02:55", note: "Priya" },
    status: "Planned",
    held: true,
    stopsDetail: [],
    expanded: false,
  };
}

function decisions(w: World, m: Milestones): Decision[] {
  const out: Decision[] = [];
  if (m.held && !m.swapAt) {
    const minutes = Math.max(0, minutesBetween(m.now, SCRIPT.depart));
    out.push({
      id: "x1",
      kind: "held",
      title: "VEH003 held: vehicle check failed",
      text: "Reefer not holding temperature · flagged by Priya 02:55 · 9 orders on 2 trips · departs 03:30",
      countdown: `${minutes} min to departure`,
      action: { label: "Review", to: "/dispatcher/exceptions/x1" },
    });
  }
  if (m.spareAvailable && !m.swapAt) {
    out.push({
      id: "spare",
      kind: "info",
      title: "VEH036 available since 02:45",
      text: "Reefer van · 1,040 kg · 7.0 m³ · back from the workshop",
      infoOnly: true,
    });
  }
  if (m.storeRequestAt && !m.conflictAt) {
    out.push({
      id: "pending",
      kind: "info",
      title: `VEH039 hasn't received v5, pending since ${hm(m.storeRequestAt)}`,
      text: "ORD2001 + ORD2002 deferred at OUT084's request. The phone gets v5 when it's back in coverage.",
      infoOnly: true,
    });
  }
  if (m.conflictOpen) {
    out.push({
      id: "c1",
      kind: "conflict",
      title: "OUT084 · ORD2001 + ORD2002: needs a decision",
      text: "Driver recorded Delivered 05:42 (S. Fernando, photo). Plan v5 says Deferred · store request 05:21.",
      at: "06:40",
      chip: "Conflict",
      action: { label: "Resolve", to: "/dispatcher/conflicts/c1?depot=kandy" },
    });
  }
  void w;
  return out;
}

const EXTRA: { vehicleId: string; driver: string }[] = [
  { vehicleId: "VEH004", driver: "K. Perera" },
  { vehicleId: "VEH007", driver: "N. Fernando" },
  { vehicleId: "VEH012", driver: "C. Bandara" },
  { vehicleId: "VEH018", driver: "L. Herath" },
  { vehicleId: "VEH021", driver: "S. Gunasekara" },
  { vehicleId: "VEH024", driver: "A. Dissanayake" },
];

export function liveBoard(w: World, m: Milestones, query: { depot: DepotId | "both"; all?: boolean }): LiveBoardView {
  const now = m.now;
  const preDeparture = now.getTime() < SCRIPT.depart.getTime();
  const calm = w.calm;
  const mm: Milestones = calm ? { ...m, now: T("05:12"), offline: false } : m;

  let rows: LiveRow[];
  if (preDeparture && !calm) {
    rows = [heldRowOrTrip(w, m), vehicle039(w, m), tripRow(w, m, "VEH035"), tripRow(w, m, "VEH011")];
  } else {
    rows = [vehicle039(w, mm), tripRow(w, mm, "VEH036"), tripRow(w, mm, "VEH035"), tripRow(w, mm, "VEH011")];
  }
  if (query.all) {
    for (const e of EXTRA) {
      rows.push({
        vehicleId: e.vehicleId,
        trip: 1,
        driver: e.driver,
        planOnDevice: m.swapAt ? 4 : 3,
        changePending: false,
        nextStop: preDeparture ? "Loading · departs 03:30" : "Returning to the depot",
        risk: "On time",
        stops: { done: preDeparture ? 0 : 3, total: 3 },
        lastHeard: { time: hm(new Date(now.getTime() - 2 * 60_000)) },
        status: preDeparture ? "Planned" : "Departed",
        held: false,
        stopsDetail: [],
        expanded: false,
      });
    }
  }
  if (query.depot === "kandy") rows = rows.filter((r) => r.vehicleId === "VEH039");
  if (query.depot === "peliyagoda") rows = rows.filter((r) => r.vehicleId !== "VEH039");

  const decisionList = calm ? [] : decisions(w, m);
  const d = delivered(mm);
  const departed = mm.now.getTime() < SCRIPT.depart.getTime() ? 0 : mm.now.getTime() < SCRIPT.kandyDepart.getTime() ? 13 : 14;
  const loading = mm.now.getTime() < SCRIPT.depart.getTime() ? 6 : 3;
  const issuesOpen = m.conflictOpen ? 1 : m.held && !m.swapAt ? 1 : 0;
  const view: LiveBoardView = {
    asOf: hm(now),
    date: "Tue 29 Sep",
    decisions: decisionList,
    stats: {
      departed: { value: departed, foot: departed === 0 ? "first departures 03:30" : "of 38 trips today" },
      loading: { value: loading, foot: loading === 6 ? "Peliyagoda 5 · Kandy 1" : "Peliyagoda 2 · Kandy 1" },
      delivered: {
        value: d,
        foot: m.storeRequestAt && !m.resolvedAt && !calm ? "orders so far · VEH039 records pending sync" : "orders so far",
      },
      issues: {
        value: issuesOpen,
        foot: m.conflictOpen ? "1 conflict needs a decision" : m.held && !m.swapAt ? "VEH003 held" : m.resolvedAt ? `Resolved ${hm(m.resolvedAt)}` : "nothing reported",
        bad: m.conflictOpen,
      },
    },
    caption: loading === 6 && departed === 0 ? `4 of ${loading} loading shown · needing attention first` : `4 of ${departed} departed shown · needing attention first`,
    rows,
    depot: query.depot,
  };
  if (m.storeRequestAt) view.plan = `Plan v${m.latestVersion}`;
  else if (m.swapAt) view.plan = "Plan v4";
  return view;
}

function heldRowOrTrip(w: World, m: Milestones): LiveRow {
  return m.held && !m.swapAt ? heldRow(m) : tripRow(w, m, "VEH036");
}
