import { useSyncExternalStore } from "react";
import type { ServerClock } from "../api/serverClock";

/** True once the server clock has an answer (a fresh one or the one saved on the device). Re-renders on each new reading. */
export function useServerClockReady(clock: ServerClock | null): boolean {
  return useSyncExternalStore(
    (listener) => (clock ? clock.subscribe(listener) : () => undefined),
    () => (clock ? clock.ready() : true),
  );
}
