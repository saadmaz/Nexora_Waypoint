import type { MoveResult, MoveTarget } from "../../../api/DispatcherApi";

/** "VEH003-2": the vehicle and trip a card is drawn for. It is also the DOM anchor a popover attaches to. */
export const tripKey = (vehicleId: string, trip: number) => `${vehicleId}-${trip}`;

export function targetKey(target: MoveTarget): string {
  return target === "deferred" ? "deferred" : tripKey(target.vehicleId, target.trip);
}

export function parseTripKey(key: string): MoveTarget {
  if (key === "deferred") return "deferred";
  const [vehicleId, trip] = key.split("-");
  return { vehicleId: vehicleId ?? "", trip: Number(trip) };
}

/**
 * What the dispatcher is doing on the board right now. A frame is a state: the gallery reaches each of these from
 * `?ui=`, and a real drag reaches the same ones (PRD v3 section 15).
 */
export type Interaction =
  | { kind: "none" }
  /** An order is being dragged, possibly over a target that has been checked. */
  | { kind: "drag"; orderId: string; over?: MoveTarget; result?: MoveResult }
  /** The order was dropped on a target the rules refuse. */
  | { kind: "refused"; orderId: string; target: MoveTarget; result: MoveResult }
  | { kind: "moveTo"; orderId: string }
  | { kind: "why"; orderId: string; result?: MoveResult };
