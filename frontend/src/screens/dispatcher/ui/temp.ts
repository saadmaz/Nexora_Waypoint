import type { OrderTemp } from "../../../api/DispatcherApi";

/** "Chilled", "Frozen" or "Ambient", for a line of text. */
export function tempLabel(temp: OrderTemp): string {
  return temp === "chilled" ? "Chilled" : temp === "frozen" ? "Frozen" : "Ambient";
}
