import type { FlagPrefill } from "./FlagSheet";

/**
 * "Ask Dispatch to call". The dataset has no dispatch desk number and none is invented (Contributing section 29), so the
 * dock asks through the channel it already has: an "Other" flag for the vehicle, filled in, sent with a PIN through the
 * outbox. It works offline (it waits on the tablet) and reaches Dispatch's inbox (D6) like any other flag.
 */
export function askDispatchNote(vehicleId: string): string {
  return `Please call the dock about ${vehicleId}.`;
}

export function askDispatchFlag(vehicleId: string, trip: 1 | 2): { to: string; state: FlagPrefill } {
  return { to: `/loader/vehicles/${vehicleId}/trips/${trip}/flag`, state: { type: "Other", note: askDispatchNote(vehicleId) } };
}
