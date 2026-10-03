import { colomboMs, formatDate, formatTime } from "../field/clock/clock";
import type { Order } from "./order";
import { isPastCutoff } from "./schedule";
import type { OrderStatus } from "./status";

// Every date and time a person reads is in Asia/Colombo, whatever the browser's own time zone is.

/** "Tue 29 Sep" */
export function dayLabel(iso: string): string {
  return formatDate(colomboMs(iso, "12:00"));
}

/** "Wed" */
export function weekdayShort(iso: string): string {
  return dayLabel(iso).split(" ")[0] ?? "";
}

/** "15:40": Asia/Colombo time, from a Date or an ISO timestamp. */
export function clockTime(value: Date | string): string {
  return formatTime(typeof value === "string" ? Date.parse(value) : value.getTime());
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
