import type { DockType } from "../../domain/field";
import type { DriverStop } from "./types";

export type TFn = (key: string, params?: Record<string, string | number>) => string;

export function dockLabel(dock: DockType): string {
  switch (dock) {
    case "rear_dock":
      return "Rear dock";
    case "street":
      return "Street";
    case "mall_bay":
      return "Mall bay";
  }
}

/** A stop is done once every order on it has a recorded outcome (R1 stop cards, R3.9/3.10). */
export function stopDone(stop: DriverStop): boolean {
  return stop.orders.length > 0 && stop.orders.every((order) => stop.outcomes[order.id] !== undefined);
}

export function isChilled(stop: DriverStop): boolean {
  return stop.orders.some((order) => order.temperature === "chilled");
}

/** Minutes the driver will wait if arriving on schedule, before the window opens. Null once on time. */
export function willWaitMinutes(stop: DriverStop): number | null {
  const [openHour, openMin] = stop.window.open.split(":").map(Number);
  const [etaHour, etaMin] = stop.plannedArrival.split(":").map(Number);
  const diff = openHour * 60 + openMin - (etaHour * 60 + etaMin);
  return diff > 0 ? diff : null;
}

/** The stop the driver is working on: the first not yet done, or -1 once every stop is done. */
export function primaryStopIndex(stops: DriverStop[]): number {
  return stops.findIndex((stop) => !stopDone(stop));
}

/** "Kandy · Rear dock · normal parking". */
export function stopPlace(stop: DriverStop): string {
  return [stop.district, dockLabel(stop.dock), stop.parkingNote].filter(Boolean).join(" · ");
}

/** Opens a Google Maps search for the outlet in a new tab. Not tracking (field conventions section 4). */
export function openMapsFor(stop: DriverStop): void {
  const query = `${stop.outletName}, ${stop.district}`;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
