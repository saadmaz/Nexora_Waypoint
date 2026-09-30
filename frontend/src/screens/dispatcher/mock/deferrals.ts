import type { DeferralCard, DeferralsView, DepotId, StoreNotice } from "../../../api/DispatcherApi";
import { EXTRA_POLICY_IDS, NAMED_DEFERRALS, ORDERS, OUTLETS } from "./fixtures";
import { deferralSets } from "./plan";
import { at, hm } from "./time";
import { versionsAt, type Milestones, type World } from "./world";

/** How many stores have opened their notice by `now`: the design has 12 of 19 seen 17 minutes after sending (D4.5). */
const SEEN_PER_MINUTE = 0.7;

function seenCount(m: Milestones, total: number): number {
  if (!m.noticesAt) return 0;
  const minutes = Math.max(0, (m.now.getTime() - m.noticesAt.getTime()) / 60_000);
  return Math.min(total, Math.round(minutes * SEEN_PER_MINUTE));
}

function plus(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** What the store was told, per order: a few named orders have a history in the design (D4.5). */
function noticeFor(m: Milestones, orderId: string): StoreNotice {
  if (orderId === "ORD1002" && m.swapAt) {
    const seen = m.now.getTime() >= plus(m.swapAt, 40).getTime();
    return seen ? { state: "seen", at: hm(plus(m.swapAt, 40)) } : { state: "sent", at: hm(m.swapAt), note: "not yet seen" };
  }
  if (orderId === "ORD2001" || orderId === "ORD2002") {
    if (!m.storeRequestAt) return { state: "not sent" };
    return { state: "seen", at: hm(plus(m.storeRequestAt, 1)) };
  }
  if (!m.noticesAt) return { state: "not sent" };
  const sent = hm(m.noticesAt);
  const since = (m.now.getTime() - m.noticesAt.getTime()) / 60_000;
  if (orderId === "ORD1020" && since >= 11) return { state: "seen", at: hm(plus(m.noticesAt, 11)) };
  if (orderId === "ORD1017" && since >= 6) return { state: "seen", at: hm(plus(m.noticesAt, 6)) };
  return { state: "sent", at: sent, note: "not yet seen" };
}

function dockTags(outletId: string): string[] {
  const outlet = OUTLETS[outletId];
  return outlet ? outlet.access.filter((a) => a !== "Mall dock") : [];
}

function outletOf(orderId: string) {
  const order = ORDERS[orderId];
  const outlet = order ? OUTLETS[order.outletId] : undefined;
  return { order, outlet };
}

function detailBase(orderId: string) {
  const { order, outlet } = outletOf(orderId);
  return {
    window: { start: order?.window?.[0] ?? outlet?.window[0] ?? "", end: order?.window?.[1] ?? outlet?.window[1] ?? "" },
    kg: order?.kg ?? 0,
    m3: order?.m3 ?? 0,
    dock: outlet?.dock ?? "Rear dock",
  };
}

function namedCard(m: Milestones, id: string): DeferralCard {
  const fx = NAMED_DEFERRALS.find((d) => d.orderId === id)!;
  const { order, outlet } = outletOf(id);
  const isCapacity = fx.kind === "capacity";
  const outletId = order?.outletId ?? "";
  const days = order?.daysSinceServed ?? 1;
  return {
    orderId: id,
    outletId,
    outletName: outlet?.name ?? outletId,
    brand: outlet?.brand ?? "Fresh",
    temp: order?.temp ?? "chilled",
    access: dockTags(outletId),
    kind: fx.kind,
    line: fx.line,
    title: isCapacity ? `${outletId}: ${order?.temp ?? "chilled"} order, ${order?.units ?? 0} units` : `${outletId}: ${order?.temp ?? "chilled"} order`,
    reason: { headline: fx.headline, detail: isCapacity ? "van_only and 1,250 kg; the largest Peliyagoda reefer van carries 1,040 kg; whole orders can't split." : fx.line.replace(/^Outside window · /, "") },
    decidedBy: fx.decidedBy,
    storeTold: noticeFor(m, id),
    impact: isCapacity ? `${days} days since served` : fx.impact,
    frees: fx.frees,
    nextRun: "Wed 30 Sep",
    binding: fx.binding,
    detail: {
      type: isCapacity ? "Capacity: no legal vehicle exists" : "Policy: a legal vehicle exists",
      bindingText: `Binding: ${fx.binding}`,
      freed: fx.frees,
      nextRun: "Wed 30 Sep",
      decidedLine: `Decided by ${fx.decidedBy} · plan v1`,
      whyNotOthers: [],
      ...detailBase(id),
    },
    ...(id === "ORD1009" && m.noticesAt && m.now.getTime() >= at("23:43").getTime()
      ? { footnote: { tone: "info" as const, text: "First send failed 23:41 · resent 23:43" } }
      : {}),
  };
}

function swapCard(m: Milestones, id: string): DeferralCard {
  const { order, outlet } = outletOf(id);
  const swap = m.swapAt ? hm(m.swapAt) : "03:00";
  return {
    orderId: id,
    outletId: order?.outletId ?? "OUT009",
    outletName: outlet?.name ?? "OUT009",
    brand: outlet?.brand ?? "Fresh",
    temp: "chilled",
    access: dockTags(order?.outletId ?? "OUT009"),
    kind: "policy",
    line: "Vehicle unavailable · VEH003 failed its check; replacement VEH036 is 120 kg / 0.7 m³ short on Trip 1.",
    title: `${order?.outletId ?? "OUT009"}: chilled order`,
    reason: { headline: "Vehicle unavailable", detail: "VEH003 failed its check; replacement VEH036 is 120 kg / 0.7 m³ short on Trip 1." },
    decidedBy: `Kumari · ${swap}`,
    storeTold: noticeFor(m, id),
    impact: "Served yesterday, not skipped before",
    frees: `${order?.kg ?? 210} kg / ${order?.m3 ?? 1.4} m³ on VEH036${id === "ORD1002" ? " (least surplus)" : ""}`,
    nextRun: "Wed 30 Sep",
    binding: "weight / volume",
    newInVersion: 4,
    detail: {
      type: "Policy: a legal vehicle exists",
      bindingText: "Binding: weight / volume",
      freed: `${order?.kg ?? 210} kg / ${order?.m3 ?? 1.4} m³`,
      nextRun: "Wed 30 Sep · from 04:00",
      decidedLine: `Decided by Kumari · plan v4 · ${swap}`,
      whyNotOthers: [
        { outletId: "OUT012", orderId: "ORD1001", text: "Deferred yesterday: skipping again isn't allowed", protected: true },
        { outletId: "OUT005", orderId: "ORD1011", text: "Frees 260 kg: more surplus than needed", protected: false },
        { outletId: "OUT006", orderId: "ORD1016", text: "Frees 230 kg: more surplus than needed", protected: false },
      ],
      ...detailBase(id),
      window: { start: order?.window?.[0] ?? "04:00", end: order?.window?.[1] ?? "07:45" },
    },
  };
}

function storeRequestCard(m: Milestones): DeferralCard {
  const at5 = m.storeRequestAt ? hm(m.storeRequestAt) : "05:21";
  const offline = m.offline;
  return {
    orderId: "ORD2001",
    pairedOrderIds: ["ORD2002"],
    outletId: "OUT084",
    outletName: "Waypoint Fresh",
    brand: "Fresh",
    temp: "chilled",
    access: ["Ambient"],
    kind: "store request",
    line: "Other · store request",
    title: "OUT084 · Waypoint Fresh: chilled 12 units + dry 8 units",
    reason: { headline: "Other · store request", detail: "Receiving staff unavailable today (Anusha phoned 05:20)." },
    decidedBy: `Kumari · ${at5} · plan v5`,
    storeTold: noticeFor(m, "ORD2001"),
    impact: "1 day since served",
    frees: "115 kg / 1.3 m³ on VEH039 Trip 1",
    nextRun: "Wed 30 Sep",
    binding: "none: store asked",
    newInVersion: 5,
    ...(offline ? { footnote: { tone: "warn" as const, text: "VEH039 offline since 05:17, change not yet received by the driver. The truck may still deliver." } } : {}),
    detail: {
      type: "Store request",
      bindingText: "Binding: none: store asked",
      freed: "115 kg / 1.3 m³",
      nextRun: "Wed 30 Sep · from 05:30",
      decidedLine: `Decided by Kumari · plan v5 · ${at5}`,
      whyNotOthers: [],
      window: { start: "05:30", end: "08:00" },
      kg: 115,
      m3: 1.3,
      dock: "Rear dock",
    },
  };
}

export function deferralsView(w: World, m: Milestones, depot: DepotId): DeferralsView {
  const sets = deferralSets(w, m, depot);
  const versions = versionsAt(m);
  const latest = versions.at(-1);
  const total = sets.capacity.length + sets.policy.length + sets.storeRequest.length;
  const policyNamed = sets.policy.filter((id) => !EXTRA_POLICY_IDS.includes(id));
  const policyCards = policyNamed.map((id) => (NAMED_DEFERRALS.some((d) => d.orderId === id) ? namedCard(m, id) : swapCard(m, id)));
  const released = Boolean(m.releasedAt);
  const sent = m.noticesAt ? total : 0;
  const seen = seenCount(m, total);
  const plan =
    depot === "kandy" && m.storeRequestAt
      ? { number: 5, state: "released" as const, at: hm(m.storeRequestAt) }
      : { number: latest?.number ?? 1, state: latest?.state ?? ("draft" as const), at: released ? hm(m.swapAt ?? m.releasedAt!) : "draft" };

  const storeRequest = sets.storeRequest.length > 0 ? [storeRequestCard(m)] : [];
  const policyCount = depot === "kandy" ? 0 : sets.policy.length;
  const allTold = sent >= total && total > 0 && depot === "peliyagoda" && m.noticesAt !== undefined && !m.swapAt;

  let headline: string;
  if (depot === "kandy") headline = `${total} orders wait for Wed 30 Sep`;
  else if (allTold) headline = `${total} orders wait: every store has been told`;
  else headline = `${total} orders wait for Wed 30 Sep`;

  let banner: DeferralsView["banner"];
  if (depot === "kandy") {
    banner = {
      tone: "info",
      title: `0 deferrals forced by capacity at Kandy. ${total} at store request.`,
      text: total > 0 ? "Kandy has enough capacity today, these two wait only because OUT084 asked." : "Kandy has enough capacity today.",
    };
  } else if (allTold) {
    banner = {
      tone: "success",
      title: `${sent} notices sent at ${hm(m.noticesAt!)} · ${seen} seen so far.`,
      text: "Stores that haven't opened Waypoint will see the notice next time they do.",
    };
  } else {
    banner = {
      tone: "warning",
      title: `Capacity forces ${total} deferrals at Peliyagoda.`,
      text: `1 has no legal vehicle; policy chose the other ${total - 1}. Each one below says why.`,
    };
  }

  const view: DeferralsView = {
    depot,
    plan,
    headline,
    counts: { total, capacity: sets.capacity.length, policy: policyCount, storeRequest: sets.storeRequest.length },
    banner,
    capacity: sets.capacity.map((id) => namedCard(m, id)),
    policy: policyCards,
    policyMore: depot === "kandy" ? 0 : EXTRA_POLICY_IDS.length,
    storeRequest,
    protected: depot === "kandy" ? [] : [
      { outletId: "OUT012", orderId: "ORD1001", text: "Deferred yesterday: protected by the continuity guard" },
      { outletId: "OUT029", orderId: "ORD1005", text: "Deferred yesterday: protected by the continuity guard" },
    ],
    notices: {
      sent: depot === "kandy" ? (m.storeRequestAt ? 2 : 0) : m.swapAt ? total : sent,
      total,
      seen: depot === "kandy" ? (m.storeRequestAt ? 1 : 0) : seen,
      note:
        depot === "kandy"
          ? "OUT084 has seen the notice."
          : m.swapAt
            ? "ORD1002 notice sent 03:00, not yet seen by OUT009."
            : sent === 0
              ? "Notices go out when you release, or now with Notify stores."
              : `${seen} seen · ${total - seen} not yet seen, they'll see it on next open.`,
    },
    canRelease: !released,
  };
  if (depot === "kandy" && m.storeRequestAt) {
    view.side = {
      pool: { title: "Kandy pool · Tue 29 Sep", orders: 64, deferred: 2, label: "Reefer Fresh minutes", used: 73, limit: 270, vehicleId: "VEH039" },
      driver: {
        heading: "VEH039 · Nimal",
        chips: [
          { label: "Departed 05:10", tone: "live" },
          ...(m.offline || !m.conflictAt ? [{ label: "Plan v4 on device", tone: "warn" as const }] : []),
        ],
        note: m.offline ? "Last heard 05:17 · known coverage gap on the Kandy corridor" : "Last heard now",
      },
    };
  }
  return view;
}
