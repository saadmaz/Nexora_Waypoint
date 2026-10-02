import type { Order } from "./order";
import { isPastCutoff } from "./schedule";
import type { OrderStatus } from "./status";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** "Tue 29 Sep" */
export function dayLabel(iso: string): string {
  const d = parseIsoDate(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Wed" */
export function weekdayShort(iso: string): string {
  return WEEKDAYS[parseIsoDate(iso).getDay()] ?? "";
}

/** "15:40", local time, from a Date or an ISO timestamp. */
export function clockTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * The status the store sees now. The mock, and later the server, flips Ordered to
 * Confirmed at 16:00; until then the clock decides, so a screen left open across
 * the cutoff does not keep saying Ordered.
 */
export function displayStatus(order: Order, now: Date): OrderStatus {
  if (order.status === "Ordered" && isPastCutoff(order.deliveryDate, now)) return "Confirmed";
  return order.status;
}
