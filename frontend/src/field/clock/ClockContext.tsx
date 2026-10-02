import { useEffect, useState, type ReactNode } from "react";
import { setTimeSource } from "../offline/time";
import { clockOptionsFromSearch, createFieldClock, type ClockOptions, type FieldClock } from "./clock";
import { ClockContext } from "./useClock";

export type ClockProviderProps = {
  /** A ready clock, for the state gallery's fixed frames. Otherwise built from `?at=` and `?date=`. */
  clock?: FieldClock;
  /** Where the clock starts when the URL has no `?at=`: the role's first frame time. */
  start?: ClockOptions["start"];
  /** Point the offline core at this clock. On for the app, off for a gallery frame. */
  drivesOfflineCore?: boolean;
  children: ReactNode;
};

/**
 * Provides the one scenario clock to a role. In the app it is built from the URL; the state
 * gallery gives each frame its own fixed clock. With `drivesOfflineCore`, record device times,
 * "Last sync" and the 30 s retry follow it too. Read it with `useNow()` from `./useClock`.
 */
export function ClockProvider({ clock, start, drivesOfflineCore = true, children }: ClockProviderProps) {
  const [value] = useState<FieldClock>(
    () => clock ?? createFieldClock(clockOptionsFromSearch(window.location.search, start)),
  );
  useEffect(() => {
    if (drivesOfflineCore) setTimeSource(value.nowMs);
  }, [value, drivesOfflineCore]);
  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>;
}
