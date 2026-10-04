import type { MoveResult, MoveTarget, PlanLane, PlanView } from "../../../api/DispatcherApi";

/** "VEH003-2": the vehicle and trip a card is drawn for. It is also the DOM anchor a popover attaches to. */
export const tripKey = (vehicleId: string, trip: number) => `${vehicleId}-${trip}`;

export function targetKey(target: MoveTarget): string {
  return target === "deferred" ? "deferred" : tripKey(target.vehicleId, target.trip);
}

/** The note the 16:05 system draft carries; anything else means the dispatcher has changed the plan since. */
const SYSTEM_DRAFT_NOTE = "System draft from the closed queue";

/** True when a redraft would throw away moves the dispatcher made: a later version, or one not written by the system draft. */
export function hasDispatcherEdits(view: PlanView): boolean {
  return view.version.number > 1 || (view.version.number === 1 && view.version.note !== SYSTEM_DRAFT_NOTE);
}

/** The trip a move would start on this lane, or null. A number the lane already shows is never offered as a new trip. */
export function newTripOf(lane: PlanLane): number | null {
  const next = lane.nextTrip ?? null;
  if (next === null || lane.status === "replaced" || lane.trips.some((t) => t.trip === next)) return null;
  return next;
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
  /** A legal deferral waiting for the dispatcher's reason before it is saved. */
  | { kind: "reason"; orderId: string }
  | { kind: "why"; orderId: string; result?: MoveResult };
