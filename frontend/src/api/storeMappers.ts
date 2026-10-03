import type { Delivery, DeliveryDeferral, DeliveryOrder, DeliveryTag, JourneyStep, JourneyStepName } from "../domain/delivery";
import { JOURNEY_STEPS } from "../domain/delivery";
import type { Issue, IssueLine, IssueType } from "../domain/issue";
import type { Order, OrderDraft, RecentOrderDay, UnitFactors } from "../domain/order";
import type { StoreUpdate, UpdatesFeed, UpdateTag } from "../domain/update";
import type { components } from "./schema";
import { deferralTypeFromApi, field, kindFromApi, oneOf, statusFromApi, unexpectedReply } from "./vocab";

type Schemas = components["schemas"];

/**
 * Maps the backend's store replies onto the frontend's own types (`domain/`). The backend schema mirrors those types field
 * for field ("so the real client is a swap"), so most of this is renaming nulls to absent fields and translating the wire
 * vocabulary (`api/vocab.ts`). The fields the backend types as free text or as a loose dict are checked here, and a reply
 * that does not fit fails as `unexpected_reply` instead of reaching a screen half-formed.
 */

/** Every key of the type, so a value missing from the list is a compile error when the domain type grows. */
const ISSUE_TYPES: Record<IssueType, true> = { Missing: true, Short: true, Damaged: true, "Wrong item": true, Late: true, "Arrived warm": true, Other: true };
const UPDATE_TAGS: Record<UpdateTag, true> = { Order: true, Plan: true, Delivery: true, Deferral: true, Review: true };
const DELIVERY_TAGS: Record<DeliveryTag, true> = { "Deferral withdrawn": true, "Receipt confirmed": true };
const JOURNEY_STATES: Record<JourneyStep["state"], true> = { done: true, current: true, pending: true };

const issueType = (value: string): IssueType => oneOf(Object.keys(ISSUE_TYPES) as IssueType[], value, "issue type");

export function mapOrder(out: Schemas["OrderOut"]): Order {
  return {
    id: out.id,
    outletId: out.outletId,
    outletName: out.outletName,
    district: out.district,
    deliveryDate: out.deliveryDate,
    dock: out.dock,
    window: { start: out.window.start, end: out.window.end },
    line: {
      id: out.line.id,
      kind: kindFromApi(out.line.kind),
      units: out.line.units,
      estimatedKg: out.line.estimatedKg,
      estimatedM3: out.line.estimatedM3,
    },
    status: statusFromApi(out.status),
    receivedAt: out.receivedAt,
    ...(out.updatedAt != null ? { updatedAt: out.updatedAt } : {}),
    afterCutoff: out.afterCutoff,
    ...(out.arrival ? { arrival: { start: out.arrival.start, end: out.arrival.end } } : {}),
    ...(out.deferral
      ? {
          deferral: {
            type: deferralTypeFromApi(out.deferral.type),
            reason: out.deferral.reason,
            decidedBy: out.deferral.decidedBy,
            ...(out.deferral.nextRun != null ? { nextRun: out.deferral.nextRun } : {}),
          },
        }
      : {}),
  };
}

export function mapOrderDraft(out: Schemas["OrderDraftOut"]): OrderDraft {
  const factor = (kind: "chilled" | "ambient") => {
    const value = out.unitFactors[kind];
    if (!value) throw unexpectedReply(`unitFactors has no "${kind}"`);
    return { kg: value.kg, m3: value.m3 };
  };
  const units = (kind: "chilled" | "ambient") => {
    const value = out.defaultUnits[kind];
    if (typeof value !== "number") throw unexpectedReply(`defaultUnits has no "${kind}"`);
    return value;
  };
  const unitFactors: UnitFactors = { chilled: factor("chilled"), dry: factor("ambient") };
  return {
    outletId: out.outletId,
    deliveryDate: out.deliveryDate,
    afterCutoff: out.afterCutoff,
    window: { start: out.window.start, end: out.window.end },
    dock: out.dock,
    unitFactors,
    defaultUnits: { chilled: units("chilled"), dry: units("ambient") },
    orders: out.orders.map(mapOrder),
  };
}

export function mapIssue(out: Schemas["IssueOut"]): Issue {
  const lines: IssueLine[] = out.lines.map((line) => ({ orderId: line.orderId, kind: kindFromApi(line.kind), units: line.units, orderUnits: line.orderUnits }));
  return {
    id: out.id,
    outletId: out.outletId,
    date: out.date,
    type: issueType(out.type),
    lines,
    ...(out.note != null ? { note: out.note } : {}),
    photo: out.photo,
    reportedAt: out.reportedAt,
    resolved: out.resolved,
  };
}

function mapJourney(steps: Schemas["JourneyStepOut"][]): JourneyStep[] {
  return steps.map((step) => ({
    step: oneOf(JOURNEY_STEPS as readonly JourneyStepName[], step.step, "journey step"),
    actor: step.actor,
    ...(step.at != null ? { at: step.at } : {}),
    state: oneOf(Object.keys(JOURNEY_STATES) as JourneyStep["state"][], step.state, "journey state"),
  }));
}

function mapDeferral(out: Schemas["DeliveryDeferralOut"]): DeliveryDeferral {
  return {
    type: deferralTypeFromApi(out.type),
    headline: out.headline,
    ...(out.subline != null ? { subline: out.subline } : {}),
    ...(out.explanation != null ? { explanation: out.explanation } : {}),
    reason: out.reason,
    decidedBy: out.decidedBy,
    decidedAt: out.decidedAt,
    nextRunLabel: oneOf(["New ETA", "Next run"] as const, out.nextRunLabel, "next run label"),
    nextRun: out.nextRun,
    nextRunShort: out.nextRunShort,
    acknowledged: out.acknowledged,
  };
}

function mapDeliveryOrder(out: Schemas["DeliveryOrderOut"]): DeliveryOrder {
  return {
    id: out.id,
    kind: kindFromApi(out.kind),
    units: out.units,
    status: statusFromApi(out.status),
    ...(out.issue != null ? { issue: issueType(out.issue) } : {}),
    ...(out.received != null ? { received: out.received } : {}),
  };
}

export function mapDelivery(out: Schemas["DeliveryOut"]): Delivery {
  return {
    date: out.date,
    outletId: out.outletId,
    outletName: out.outletName,
    district: out.district,
    window: { start: out.window.start, end: out.window.end },
    dock: out.dock,
    ...(out.vehicle != null ? { vehicle: out.vehicle } : {}),
    orders: out.orders.map(mapDeliveryOrder),
    status: statusFromApi(out.status),
    journey: mapJourney(out.journey),
    ...(out.arrival ? { arrival: { from: out.arrival.from, ...(out.arrival.mayArriveAt != null ? { mayArriveAt: out.arrival.mayArriveAt } : {}) } } : {}),
    planPending: out.planPending,
    ...(out.loaded ? { loaded: { place: field(out.loaded, "place", "loaded"), at: field(out.loaded, "at", "loaded") } } : {}),
    ...(out.onTheWay
      ? { onTheWay: { arrivesAbout: field(out.onTheWay, "arrivesAbout", "onTheWay"), unloadingFrom: field(out.onTheWay, "unloadingFrom", "onTheWay") } }
      : {}),
    ...(out.lastUpdate != null ? { lastUpdate: out.lastUpdate } : {}),
    receiversCue: out.receiversCue,
    ...(out.deferral ? { deferral: mapDeferral(out.deferral) } : {}),
    ...(out.review
      ? { review: { askedAt: field(out.review, "askedAt", "review"), deliveredAt: field(out.review, "deliveredAt", "review"), receivedBy: field(out.review, "receivedBy", "review") } }
      : {}),
    ...(out.proof ? { proof: { receivedBy: out.proof.receivedBy, at: out.proof.at, driver: out.proof.driver, vehicle: out.proof.vehicle, units: out.proof.units } } : {}),
    tags: (out.tags ?? []).map((tag) => oneOf(Object.keys(DELIVERY_TAGS) as DeliveryTag[], tag, "delivery tag")),
    ...(out.withdrawnNote != null ? { withdrawnNote: out.withdrawnNote } : {}),
    ...(out.receiptConfirmedAt != null ? { receiptConfirmedAt: out.receiptConfirmedAt } : {}),
    ...(out.receiptBy != null ? { receiptBy: out.receiptBy } : {}),
    ...(out.shortfallReason != null ? { shortfallReason: out.shortfallReason } : {}),
    issues: (out.issues ?? []).map(mapIssue),
    receivedAnswered: out.receivedAnswered ?? false,
  };
}

export function mapRecent(out: Schemas["RecentOrderDayOut"]): RecentOrderDay {
  return {
    date: out.date,
    orderCount: out.orderCount,
    status: statusFromApi(out.status),
    ...(out.deferral
      ? {
          deferral: {
            type: deferralTypeFromApi(field(out.deferral, "type", "deferral")),
            ...(typeof out.deferral.nextRunShort === "string" ? { nextRunShort: out.deferral.nextRunShort } : {}),
          },
        }
      : {}),
    ...(out.deliveredAt != null ? { deliveredAt: out.deliveredAt } : {}),
    ...(out.shortUnits != null ? { shortUnits: out.shortUnits } : {}),
    ...(out.servedNextDay != null ? { servedNextDay: out.servedNextDay } : {}),
    ...(out.orderIds != null ? { orderIds: out.orderIds } : {}),
    ...(out.deferralWithdrawn != null ? { deferralWithdrawn: out.deferralWithdrawn } : {}),
    ...(out.receiptConfirmedAt != null ? { receiptConfirmedAt: out.receiptConfirmedAt } : {}),
    ...(out.current != null ? { current: out.current } : {}),
  };
}

function mapUpdate(out: Schemas["StoreUpdateOut"]): StoreUpdate {
  const screen = field(out.target, "screen", "update target");
  let target: StoreUpdate["target"];
  if (screen === "orders") target = { screen: "orders" };
  else if (screen === "delivery") target = { screen: "delivery", date: field(out.target, "date", "update target") };
  else throw unexpectedReply(`update target "${screen}"`);
  return {
    id: out.id,
    tag: oneOf(Object.keys(UPDATE_TAGS) as UpdateTag[], out.tag, "update tag"),
    date: out.date,
    time: out.time,
    title: out.title,
    body: out.body,
    ...(out.viewLabel != null ? { viewLabel: out.viewLabel } : {}),
    target,
    unread: out.unread,
    ...(out.resolvedAt != null ? { resolvedAt: out.resolvedAt } : {}),
  };
}

export function mapUpdatesFeed(out: Schemas["UpdatesFeedOut"]): UpdatesFeed {
  return { updates: out.updates.map(mapUpdate), unread: out.unread };
}
