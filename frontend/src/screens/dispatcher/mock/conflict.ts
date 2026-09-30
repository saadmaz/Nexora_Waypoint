import type { ConflictView } from "../../../api/DispatcherApi";
import { agoLabel, hm } from "./time";
import { SCRIPT, type Milestones, type World } from "./world";

/**
 * D7: two true records for one stop (PRD v3 section 3 D7, hero degradation H15 to H16). The driver
 * delivered at 05:42 without having the 05:21 deferral; the dispatcher deferred at 05:21 without knowing
 * the truck was already at the store. Both stay in the audit whichever is kept.
 */
export function conflictView(w: World, m: Milestones, id: string): ConflictView {
  const asked = w.askedAt;
  const reported = Boolean(asked && m.now.getTime() >= SCRIPT.storeReport.getTime() && !w.resolved);
  const resolved = w.resolved;
  const state: ConflictView["state"] = resolved ? "resolved" : reported ? "store reported an issue" : asked ? "awaiting store" : "needs decision";

  const view: ConflictView = {
    id,
    outletId: "OUT084",
    outletName: "Waypoint Fresh",
    district: "Kandy",
    orders: [
      { id: "ORD2001", temp: "chilled", units: 12 },
      { id: "ORD2002", temp: "ambient", units: 8 },
    ],
    state,
    timeline: [
      { time: "05:17", title: "Driver offline", detail: "Kandy corridor coverage gap", kind: "offline" },
      { time: "05:21", title: "Dispatch deferred · v5", detail: "Store asked by phone at 05:20", kind: "deferred" },
      { time: "05:26", title: "Arrived · waiting", detail: "Window opens 05:30", kind: "arrived" },
      { time: "05:42", title: "Delivered", detail: "12 + 8 units · S. Fernando", kind: "delivered" },
      { time: "06:40", title: "Synced", detail: "Records disagree → conflict", kind: "synced" },
    ],
    driverRecord: {
      heading: "Driver record · VEH039 · Nimal",
      status: "Delivered 05:42",
      receivedBy: "S. Fernando (night staff)",
      units: "12 + 8",
      deviceTime: "05:42",
      photo: "POD photo 05:42",
    },
    dispatchRecord: {
      heading: "Dispatch record · Kumari",
      status: "Deferred · store request → Wed",
      decided: "05:21 · plan v5",
      reason: "Receiving staff unavailable",
      reached: "No: offline since 05:17",
    },
    recommendation: {
      choice: "keep delivery",
      title: "Recommended: Keep delivery",
      reasons: [
        "The goods are physically at the store, with proof: photo, receiver and units.",
        "The deferral never reached the driver; he was offline from 05:17.",
        "Reversing would mean a return trip for goods already received.",
      ],
      outcome: "Status becomes Delivered · tag Deferral withdrawn · Wed re-run removed · both records kept in the audit",
    },
  };

  if (asked) {
    view.asked = {
      at: hm(asked),
      minutes: Math.max(0, Math.round((m.now.getTime() - asked.getTime()) / 60_000)),
      text: `Asked OUT084 at ${hm(asked)}: 'Did you receive this delivery?'`,
    };
    if (state === "awaiting store") view.recommendation.pausedNote = "Paused until the store answers";
  }

  if (reported) {
    view.storeReport = {
      heading: "Store report · Anusha",
      tags: ["Issue", "Short"],
      text: "ORD2001 · 10 of 12 units",
      at: "07:04",
    };
    view.recommendation = {
      choice: "keep as partial",
      title: "Recommended: Keep delivery as Partial (10 / 12)",
      chip: "Partial",
      reasons: [
        "The goods are physically at the store, with proof: photo, receiver and units.",
        "The deferral never reached the driver; he was offline from 05:17.",
        "The store confirms goods arrived, 2 units short: Partial matches the evidence.",
      ],
      outcome: "Status becomes Partial · follow-up created for 2 units · Wed re-run removed · all three records kept",
    };
  }

  if (resolved) {
    const partial = resolved.outcome === "Partial";
    const time = hm(resolved.at);
    view.outcome = resolved.outcome;
    view.resolved = {
      by: "Kumari",
      at: time,
      title: partial ? `Resolved by Kumari ${time}, kept as Partial (10 / 12).` : `Resolved by Kumari ${time}, kept delivery.`,
      text: partial
        ? "Follow-up created for 2 units. Both records and this decision are kept. Wed 30 Sep re-run removed."
        : "Both records and this decision are kept. Wed 30 Sep re-run removed.",
      whoKnows: [
        { who: "Nimal", what: `Route notice 'OUT084: resolved: ${partial ? "kept as partial" : "delivered"}' · ${time}` },
        {
          who: "Anusha",
          what: partial ? `Deliveries updated: Partial (10 / 12) · follow-up created for 2 units · ${time}` : `Deliveries updated: Delivered 05:42 + Deferral withdrawn · ${time}`,
        },
        { who: "Kandy dock", what: `Wed re-run removed from tomorrow's queue · ${time}` },
      ],
      toast: "Conflict resolved. Driver and store told.",
    };
  }
  void agoLabel;
  return view;
}
