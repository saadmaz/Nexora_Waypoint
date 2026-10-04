import {
  buildJourney,
  storeArrival,
  type Delivery,
  type DeliveryDeferral,
  type DeliveryOrder,
  type DeliveryTag,
  type JourneyStepName,
} from "../domain/delivery";
import { clockTime, dayLabel, weekdayShort } from "../domain/format";
import { issueTagFor, type Issue } from "../domain/issue";
import type { Order } from "../domain/order";
import { cutoffFor, nextOperatingDayAfter, releaseFor } from "../domain/schedule";
import type { OrderStatus } from "../domain/status";

/** What the store itself has done on a delivery day: the writes that are not the clock's. */
export type DeliveryRecord = {
  /** The store tapped Got it on a deferral. */
  deferralAcknowledged: boolean;
  /** The store answered "Did you receive this delivery?" while the review was open. */
  reviewAnswer?: "received";
  /** The store confirmed receipt: when, and what it counted per order. */
  receipt?: { at: string; lines: { orderId: string; received: number }[]; reason?: string };
};

/** The store manager who confirms receipt: "Receipt confirmed 07:30 · Anusha". */
const RECEIPT_BY = "Anusha";

export const EMPTY_RECORD: DeliveryRecord = { deferralAcknowledged: false };

export type OutletFixture = {
  id: string;
  name: string;
  district: string;
  window: { start: string; end: string };
  dock: string;
};

/**
 * The scripted run of one delivery day, as offsets from that day's clock (PRD v3 section 2,
 * H2 to H17). The real backend replaces this with its own jobs and the driver's records; the
 * mock only has to make every screen agree with the clock, so each time here is a "HH:MM"
 * on the delivery date itself (or on the evening before, for the cutoff and the release).
 */
export const HERO_DATE = "2026-09-29";
export const HERO = {
  vehicle: "VEH039",
  driver: "Nimal",
  loadedAt: "04:50",
  loadedPlace: "Kandy dock",
  departedAt: "05:10",
  predictedArrival: "05:26",
  coverageLostAt: "05:17",
  askedAt: "05:20",
  deferredAt: "05:21",
  deferredBy: "Kumari",
  deliveredAt: "05:42",
  receivedBy: "S. Fernando",
  conflictAt: "06:40",
  resolvedAt: "06:44",
};

/** OUT009's run for the S2.9 view: ORD1002 is deferred by policy at 03:00 (PRD v3 2b, X3). */
const OUT009_DATE = "2026-09-29";
const OUT009 = { deferredAt: "03:00", deferredBy: "Kumari", predictedArrival: "05:04" };

export function instant(date: string, hhmm: string): number {
  return new Date(`${date}T${hhmm}:00`).getTime();
}

type Stage = "ordered" | "confirmed" | "planned" | "loaded" | "departed" | "deferred" | "review" | "delivered";

const STAGE_STATUS: Record<Stage, OrderStatus> = {
  ordered: "Ordered",
  confirmed: "Confirmed",
  planned: "Planned",
  loaded: "Loaded",
  departed: "Departed",
  deferred: "Deferred",
  review: "Conflict",
  delivered: "Delivered",
};

function heroStage(date: string, now: Date): Stage {
  const t = now.getTime();
  if (t < cutoffFor(date).getTime()) return "ordered";
  if (t < releaseFor(date).getTime()) return "confirmed";
  if (t < instant(date, HERO.loadedAt)) return "planned";
  if (t < instant(date, HERO.departedAt)) return "loaded";
  if (t < instant(date, HERO.deferredAt)) return "departed";
  if (t < instant(date, HERO.conflictAt)) return "deferred";
  if (t < instant(date, HERO.resolvedAt)) return "review";
  return "delivered";
}

function out009Stage(date: string, now: Date): Stage {
  const t = now.getTime();
  if (t < cutoffFor(date).getTime()) return "ordered";
  if (t < releaseFor(date).getTime()) return "confirmed";
  if (t < instant(date, OUT009.deferredAt)) return "planned";
  return "deferred";
}

/** A day with nothing scripted advances as far as the cutoff and the plan release. */
function plainStage(date: string, now: Date): Stage {
  const t = now.getTime();
  return t < cutoffFor(date).getTime() ? "ordered" : t < releaseFor(date).getTime() ? "confirmed" : "planned";
}

function deliveryOrders(orders: Order[], status: OrderStatus): DeliveryOrder[] {
  return orders
    .map((order) => ({ id: order.id, kind: order.line.kind, units: order.line.units, status }))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "chilled" ? -1 : 1));
}

/**
 * One delivery day, derived from the outlet's orders for that date, the clock and what the
 * store has done. ORD2001 and ORD2002 follow the hero script; other days advance as far as
 * the cutoff and the plan release, because nothing has been scripted for them.
 */
export function deriveDelivery(
  outlet: OutletFixture,
  date: string,
  orders: Order[],
  now: Date,
  record: DeliveryRecord,
  issues: Issue[] = [],
): Delivery {
  const hero = date === HERO_DATE && outlet.id === "OUT084";
  const out009 = date === OUT009_DATE && outlet.id === "OUT009";

  let stage: Stage = hero ? heroStage(date, now) : out009 ? out009Stage(date, now) : plainStage(date, now);
  // Answering "Yes, we received it" while the review is open settles it for the store at once (S2.8).
  if (stage === "review" && record.reviewAnswer === "received") stage = "delivered";

  const status = STAGE_STATUS[stage];
  const list = deliveryOrders(orders, status);
  const receiptAt = record.receipt?.at;

  // The store's own writes change its orders' words, not the delivery's stage: a counted
  // shortfall makes an order Partial, a reported problem makes it Issue with a tag. While the
  // review is open Dispatch still owns the status, so an order stays Under review.
  for (const order of list) {
    const counted = record.receipt?.lines.find((line) => line.orderId === order.id);
    if (counted && counted.received < order.units) {
      order.received = counted.received;
      if (stage === "delivered") order.status = "Partial";
    }
    for (const issue of issues) {
      const line = issue.lines.find((l) => l.orderId === order.id);
      if (!line) continue;
      order.issue = issueTagFor(issue.type, line);
      if (stage === "delivered") order.status = "Issue";
    }
  }

  const times: Partial<Record<JourneyStepName, string>> = {};
  const earliest = orders.map((o) => o.receivedAt).sort()[0];
  if (earliest) times.Ordered = clockTime(earliest);
  const rank: Stage[] = ["ordered", "confirmed", "planned", "loaded", "departed", "deferred", "review", "delivered"];
  const reached = (s: Stage) => rank.indexOf(stage) >= rank.indexOf(s);
  if (reached("confirmed")) times.Confirmed = "16:00";
  if (reached("planned")) times.Planned = "23:40";
  if (hero) {
    if (reached("loaded")) times.Loaded = HERO.loadedAt;
    if (reached("departed")) times.Departed = HERO.departedAt;
    if (stage === "delivered") times.Delivered = HERO.deliveredAt;
    if (receiptAt) times["Receipt confirmed"] = receiptAt;
  }

  const predicted = hero ? HERO.predictedArrival : out009 ? OUT009.predictedArrival : outlet.window.start;
  const released = reached("planned");
  const nextRun = nextOperatingDayAfter(date);

  let deferral: DeliveryDeferral | undefined;
  if (stage === "deferred" && hero) {
    deferral = {
      type: "store request",
      headline: "Deferred at your request",
      subline: `Next run ${dayLabel(nextRun)}.`,
      reason: `Receiving staff unavailable (your call at ${HERO.askedAt})`,
      decidedBy: HERO.deferredBy,
      decidedAt: HERO.deferredAt,
      nextRunLabel: "New ETA",
      nextRun: `${dayLabel(nextRun)} · from ${outlet.window.start}`,
      nextRunShort: weekdayShort(nextRun),
      acknowledged: record.deferralAcknowledged,
    };
  } else if (stage === "deferred" && out009) {
    deferral = {
      type: "policy",
      headline: "Tomorrow's chilled order moved to Wednesday",
      explanation:
        "A truck failed its check. The replacement couldn't carry every order. Your store was served yesterday; the store skipped yesterday was protected.",
      reason: "Vehicle unavailable: replacement van is smaller",
      decidedBy: OUT009.deferredBy,
      decidedAt: OUT009.deferredAt,
      nextRunLabel: "Next run",
      nextRun: dayLabel(nextRun),
      nextRunShort: weekdayShort(nextRun),
      acknowledged: record.deferralAcknowledged,
    };
  }

  const hasProof = hero && (stage === "review" || stage === "delivered");
  const tags: DeliveryTag[] = [];
  if (hero && stage === "delivered") tags.push("Deferral withdrawn");
  if (receiptAt) tags.push("Receipt confirmed");

  return {
    date,
    outletId: outlet.id,
    outletName: outlet.name,
    district: outlet.district,
    window: outlet.window,
    dock: outlet.dock,
    ...(hero && released ? { vehicle: HERO.vehicle } : {}),
    orders: list,
    status,
    journey: buildJourney(times),
    ...(released && !deferral ? { arrival: storeArrival(predicted, outlet.window.start) } : {}),
    planPending: stage === "confirmed" || stage === "ordered",
    ...(hero && stage === "loaded" ? { loaded: { place: HERO.loadedPlace, at: HERO.loadedAt } } : {}),
    ...(hero && stage === "departed"
      ? { onTheWay: { arrivesAbout: HERO.predictedArrival, unloadingFrom: outlet.window.start } }
      : {}),
    ...(hero && stage === "departed" && now.getTime() >= instant(date, HERO.coverageLostAt)
      ? { lastUpdate: HERO.coverageLostAt }
      : {}),
    receiversCue: released && (stage === "planned" || stage === "loaded" || stage === "departed"),
    ...(deferral ? { deferral } : {}),
    // A51: the hero run is D7.4 A ("Confirm, keep delivery"), so Dispatch never asks and `asked` stays
    // false: the store sees "Why you're seeing this" without the question. S3.5 is reached with `?preview=asked`.
    ...(hero && stage === "review"
      ? { review: { askedAt: HERO.askedAt, deliveredAt: HERO.deliveredAt, receivedBy: HERO.receivedBy, asked: false } }
      : {}),
    ...(hasProof
      ? {
          proof: {
            receivedBy: HERO.receivedBy,
            at: HERO.deliveredAt,
            driver: HERO.driver,
            vehicle: HERO.vehicle,
            units: list.map((order) => order.units),
          },
        }
      : {}),
    tags,
    ...(hero && stage === "delivered" ? { withdrawnNote: `${dayLabel(nextRun)} re-run removed.` } : {}),
    ...(receiptAt ? { receiptConfirmedAt: receiptAt, receiptBy: RECEIPT_BY } : {}),
    ...(record.receipt?.reason ? { shortfallReason: record.receipt.reason } : {}),
    issues: [...issues].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)),
    receivedAnswered: record.reviewAnswer === "received",
  };
}
