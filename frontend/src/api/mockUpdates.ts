import { storeArrival } from "../domain/delivery";
import { unitsLabel } from "../domain/estimate";
import { clockTime, dayLabel, weekdayShort } from "../domain/format";
import type { Order } from "../domain/order";
import { cutoffFor, nextOperatingDayAfter, releaseFor, toIsoDate } from "../domain/schedule";
import type { StoreUpdate, UpdateTag } from "../domain/update";
import { HERO, HERO_DATE, instant } from "./mockDeliveries";

const at = (date: string, hhmm: string) => new Date(instant(date, hhmm));

/** What the store has read: everything sent up to `through`, and the rows it has acted on. */
export type ReadState = { through: Date; ids: Set<string> };

/**
 * The store had looked at its phone by 05:20 on the hero morning, when Anusha rang Dispatch
 * (H10), so everything sent up to then is read. That leaves the 05:21 deferral, the 06:40
 * review and the 06:44 resolution: "2 unread" at 06:45 once Got it has read the deferral (A37).
 */
export const INITIAL_READ_THROUGH = new Date(`${HERO_DATE}T05:20:00`);

type Row = {
  key: string;
  tag: UpdateTag;
  at: Date;
  title: string;
  body: string;
  viewLabel?: string;
  target: StoreUpdate["target"];
  resolvedAt?: string;
};

function orderPhrase(order: Order): string {
  return `${order.id} (${order.line.kind === "chilled" ? "chilled" : "dry"}, ${unitsLabel(order.line.units)})`;
}

/** The rows for one delivery day: the record's changes as the store is told about them. */
function rowsFor(date: string, orders: Order[], hero: boolean): Row[] {
  const rows: Row[] = [];
  const day = dayLabel(date);
  const received = orders.map((o) => o.receivedAt).sort()[0];
  const beforeCutoff = received ? new Date(received).getTime() < cutoffFor(date).getTime() : false;
  const target = { screen: "delivery", date } as const;

  if (received) {
    rows.push({
      key: "received",
      tag: "Order",
      at: new Date(received),
      title: "Order received",
      body: `${orders.map(orderPhrase).join(" and ")} count for ${day}.${beforeCutoff ? " You can edit until 16:00." : ""}`,
      target: { screen: "orders" },
    });
  }
  rows.push({
    key: "confirmed",
    tag: "Order",
    at: cutoffFor(date),
    title: `Confirmed for ${day}`,
    body:
      orders.length === 1 ? "Your order is in tomorrow’s queue." : `Your ${orders.length === 2 ? "two" : orders.length} orders are in tomorrow’s queue.`,
    target,
  });
  const arrival = storeArrival(hero ? HERO.predictedArrival : "05:30", "05:30");
  rows.push({
    key: "plan",
    tag: "Plan",
    at: releaseFor(date),
    title: "Arrival time set",
    body: `Arrival from ${arrival.from}${arrival.mayArriveAt ? ` (truck may arrive ${arrival.mayArriveAt} and wait)` : ""}. Have receivers ready by ${arrival.from}.`,
    target,
  });

  if (hero) {
    const next = nextOperatingDayAfter(date);
    const ids = orders.map((o) => o.id);
    const idList = ids.length === 2 ? `${ids[0]} and ${ids[1]}` : ids.join(", ");
    rows.push(
      {
        key: "loaded",
        tag: "Delivery",
        at: at(date, HERO.loadedAt),
        title: "Loaded",
        body: `Your orders are loaded on ${HERO.vehicle}.`,
        target,
      },
      {
        key: "departed",
        tag: "Delivery",
        at: at(date, HERO.departedAt),
        title: "On the way",
        body: `${HERO.vehicle} left Kandy at ${HERO.departedAt}, arriving about ${HERO.predictedArrival}, unloading from 05:30.`,
        target,
      },
      {
        key: "coverage",
        tag: "Delivery",
        at: at(date, HERO.coverageLostAt),
        title: "Driver out of coverage",
        body: "The last status is kept. Delivery is still expected from 05:30.",
        target,
      },
      {
        key: "deferral",
        tag: "Deferral",
        at: at(date, HERO.deferredAt),
        title: "Deferred at your request",
        body: `${idList} are deferred (store request). Decided by ${HERO.deferredBy}. Next run ${dayLabel(next)}.`,
        target,
      },
      {
        key: "review",
        tag: "Review",
        at: at(date, HERO.conflictAt),
        title: "Your delivery is under review",
        body: `The driver delivered at ${HERO.deliveredAt} before your ${HERO.deferredAt} deferral reached the phone. Dispatch is choosing which record to keep.`,
        target,
      },
      {
        key: "kept",
        tag: "Delivery",
        at: at(date, HERO.resolvedAt),
        title: "Delivery kept",
        body: `Dispatch kept the ${HERO.deliveredAt} delivery of ${idList}. Deferral withdrawn, no ${weekdayShort(next)} re-run.`,
        viewLabel: "View delivery",
        target,
      },
    );
  }
  return rows;
}

/** The store's updates feed at `now`: every row already sent, newest first, with its read state. */
export function buildUpdates(orders: Order[], now: Date, read: ReadState): StoreUpdate[] {
  const dates = [...new Set(orders.map((order) => order.deliveryDate))];
  const all: StoreUpdate[] = [];

  for (const date of dates) {
    const dayOrders = orders.filter((order) => order.deliveryDate === date);
    const hero = date === HERO_DATE && dayOrders.some((o) => o.id === "ORD2001" || o.id === "ORD2002");
    for (const row of rowsFor(date, dayOrders, hero)) {
      if (row.at.getTime() > now.getTime()) continue;
      const id = `${date}|${row.key}`;
      const resolved = row.key === "review" && instant(date, HERO.resolvedAt) <= now.getTime();
      all.push({
        id,
        tag: row.tag,
        date: toIsoDate(row.at),
        time: clockTime(row.at),
        title: row.title,
        body: row.body,
        ...(row.viewLabel ? { viewLabel: row.viewLabel } : {}),
        target: row.target,
        unread: row.at.getTime() > read.through.getTime() && !read.ids.has(id),
        ...(resolved ? { resolvedAt: HERO.resolvedAt } : {}),
      });
    }
  }
  return all.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
}
