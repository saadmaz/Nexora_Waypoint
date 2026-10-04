import type { Issue, IssueType } from "./issue";
import type { OrderKind } from "./order";
import type { DeferralType, OrderStatus } from "./status";

/** One order on a delivery day, as S2 lists it. */
export type DeliveryOrder = {
  id: string;
  kind: OrderKind;
  units: number;
  status: OrderStatus;
  /** The issue tag when the store has reported a problem on this order (S3.4: Short). */
  issue?: IssueType;
  /** Units the store counted when it confirmed receipt with a shortfall (S3.1 B: 10 of 12). */
  received?: number;
};

/**
 * What the store sees as arrival time (PRD v3 4a): the later of the predicted arrival and
 * the window opening, as a range. `from` is that time; `mayArriveAt` is the earlier
 * predicted arrival, present only when the truck is expected before the window opens
 * ("from 05:30 (truck may arrive 05:26 and wait)").
 */
export type ArrivalRange = { from: string; mayArriveAt?: string };

/** The store-arrival rule. Times are "HH:MM", which compare correctly as strings. */
export function storeArrival(predicted: string, windowStart: string): ArrivalRange {
  return predicted < windowStart ? { from: windowStart, mayArriveAt: predicted } : { from: predicted };
}

/** "12 + 8": the units on each order of a delivery, in order. */
export function unitsSum(delivery: Pick<Delivery, "orders">): string {
  return delivery.orders.map((order) => order.units).join(" + ");
}

/** The seven steps of the journey, in order (S2 "Show all steps"). */
export const JOURNEY_STEPS = [
  "Ordered",
  "Confirmed",
  "Planned",
  "Loaded",
  "Departed",
  "Delivered",
  "Receipt confirmed",
] as const;

export type JourneyStepName = (typeof JOURNEY_STEPS)[number];

/** Who acts at each step: "You · 15:40", "Dispatch · 16:00", or just "Loader" while it is still to come. */
const ACTOR: Record<JourneyStepName, string> = {
  Ordered: "You",
  Confirmed: "Dispatch",
  Planned: "Dispatch",
  Loaded: "Loader",
  Departed: "Driver",
  Delivered: "Driver",
  "Receipt confirmed": "You",
};

export type JourneyStep = {
  step: JourneyStepName;
  actor: string;
  /** "HH:MM" once the step has happened. */
  at?: string;
  /** done: reached. current: where the order is now, or what the store still has to do. pending: to come. */
  state: "done" | "current" | "pending";
};

/**
 * Builds the journey from the times each step happened. From Planned on, the step the order
 * is at is `current`; once the truck has delivered, the step that is waiting on the store,
 * Receipt confirmed, becomes the current one (S2.8, S2.11).
 */
export function buildJourney(times: Partial<Record<JourneyStepName, string>>): JourneyStep[] {
  const reached = JOURNEY_STEPS.filter((step) => times[step] !== undefined);
  const last = reached.at(-1);
  // Ordered and Confirmed stay green: the amber marker starts once the plan is out (S2.1 against S2.2).
  const current: JourneyStepName | undefined =
    last === "Delivered"
      ? "Receipt confirmed"
      : last === "Receipt confirmed" || last === "Ordered" || last === "Confirmed"
        ? undefined
        : last;

  return JOURNEY_STEPS.map((step) => {
    const at = times[step];
    const state: JourneyStep["state"] = step === current ? "current" : at !== undefined ? "done" : "pending";
    return { step, actor: ACTOR[step], ...(at !== undefined ? { at } : {}), state };
  });
}

/** A deferral, as the store is told about it (S2.6 and S2.9). Every one names its type. */
export type DeliveryDeferral = {
  type: DeferralType;
  /** The notice's title: "Deferred at your request". */
  headline: string;
  /** A line under the title on the alert, when there is one: "Next run Wed 30 Sep." */
  subline?: string;
  /** A paragraph explaining a policy deferral. */
  explanation?: string;
  reason: string;
  /** Who decided and when: "Kumari" and "05:21". */
  decidedBy: string;
  decidedAt: string;
  /** The label for the next run: "New ETA" (store request) or "Next run". */
  nextRunLabel: "New ETA" | "Next run";
  /** "Wed 30 Sep" or "Wed 30 Sep · from 05:30". */
  nextRun: string;
  /** "Wed", for the pill: "Deferred · store request → Wed". */
  nextRunShort: string;
  /** The store has tapped Got it. */
  acknowledged: boolean;
};

/** The proof of delivery the driver recorded (A13): photo, receiver, time, driver and vehicle. */
export type ProofOfDelivery = {
  receivedBy: string;
  at: string;
  driver: string;
  vehicle: string;
  /** Units delivered per order, in the order the delivery lists them. */
  units: number[];
};

/** Extra tags on a delivery day that are not statuses (PRD v3 4b, Execution). */
export type DeliveryTag = "Deferral withdrawn" | "Receipt confirmed";

/**
 * One delivery day for an outlet (PRD v3 StoreApi `listDeliveries`): the orders, the
 * status they share, and what to say about where they are. Derived from the order
 * record and the clock, never held as separate state (handoff 14).
 */
export type Delivery = {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  outletId: string;
  outletName: string;
  district: string;
  window: { start: string; end: string };
  dock: string;
  vehicle?: string;
  orders: DeliveryOrder[];
  /** The status the orders share. Stores read "Conflict" as "Under review" via `statusLabel`. */
  status: OrderStatus;
  journey: JourneyStep[];
  /** Once the plan is released. Absent before 23:40 the evening before. */
  arrival?: ArrivalRange;
  /** True while the plan is not released, so the card says arrival time follows. */
  planPending: boolean;
  /** Set once the load is confirmed at the dock: "Loaded at Kandy dock 04:50 · 12 + 8 units on board." */
  loaded?: { place: string; at: string };
  /** Set once the truck is out: the predicted arrival and the window opening, as the card shows them. */
  onTheWay?: { arrivesAbout: string; unloadingFrom: string };
  /** Set while the driver is out of coverage: the last update the store has. A muted line, not an alert. */
  lastUpdate?: string;
  /** True while receivers should be ready: planned, loaded or on the way. */
  receiversCue: boolean;
  deferral?: DeliveryDeferral;
  /**
   * Set while Dispatch is reviewing a conflicting record (S2.7). `asked` is true only once Dispatch has
   * asked the store ("Review with store first", D7.2): until then the store sees the explanation on its
   * own, and the question "Did you receive this delivery?" waits (A51).
   */
  review?: { askedAt: string; deliveredAt: string; receivedBy: string; asked: boolean };
  /** Set once the truck has delivered. */
  proof?: ProofOfDelivery;
  tags: DeliveryTag[];
  /** "Wed 30 Sep re-run removed." beside the Deferral withdrawn tag. */
  withdrawnNote?: string;
  /** "07:30", once the store has confirmed receipt. */
  receiptConfirmedAt?: string;
  /** Who confirmed it: "Anusha". */
  receiptBy?: string;
  /** The reason the store gave for a shortfall. */
  shortfallReason?: string;
  /** Problems the store has reported on this day, newest first (S3.4). */
  issues: Issue[];
  /** True when the store has already answered "Did you receive this delivery?" while it was under review. */
  receivedAnswered: boolean;
};
