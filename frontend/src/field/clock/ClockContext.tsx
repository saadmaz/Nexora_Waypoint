import { useEffect, useState, type ReactNode } from "react";
import { roleApiMode } from "../../api/http/config";
import { createServerClock } from "../../api/serverClock";
import type { Role } from "../../domain/status";
import { useServerClockReady } from "../../hooks/useServerClockReady";
import { setTimeSource } from "../offline/time";
import { clockOptionsFromSearch, createFieldClock, type ClockOptions, type FieldClock } from "./clock";
import { setRunDateSource } from "./runDate";
import { ClockContext } from "./useClock";

export type ClockProviderProps = {
  /** A ready clock, for the state gallery's fixed frames. Otherwise built from `?at=` and `?date=`. */
  clock?: FieldClock;
  /** Where the clock starts when the URL has no `?at=`: the role's first frame time. */
  start?: ClockOptions["start"];
  /** Point the offline core at this clock. On for the app, off for a gallery frame. */
  drivesOfflineCore?: boolean;
  /** The role this clock serves. When that role runs on the real API the clock is the server's, not the URL's (DP-26). */
  role?: Role;
  children: ReactNode;
};

/**
 * Provides the one scenario clock to a role. In the app it is built from the URL; the state
 * gallery gives each frame its own fixed clock. With `drivesOfflineCore`, record device times,
 * "Last sync" and the 30 s retry follow it too. Read it with `useNow()` from `./useClock`.
 *
 * On the real API (`role` set and `VITE_<ROLE>_API=api`) the clock is the server's: it asks `GET /clock`, ticks between
 * answers and shows nothing until the first answer (or the first failure), so no screen draws against the wrong time.
 */
export function ClockProvider({ clock, start, drivesOfflineCore = true, role, children }: ClockProviderProps) {
  const [server] = useState(() => (!clock && role && roleApiMode(role) === "api" ? createServerClock(role) : null));
  const [value] = useState<FieldClock>(() => {
    const built =
      clock ??
      (server
        ? { nowMs: server.nowMs, runDate: server.runDate, fixed: false }
        : createFieldClock(clockOptionsFromSearch(window.location.search, start)));
    // Before any child effect runs, so a screen's first load already asks for the right run.
    setRunDateSource(built.runDate);
    return built;
  });
  useEffect(() => server?.start(), [server]);
  const ready = useServerClockReady(server);
  useEffect(() => {
    setRunDateSource(value.runDate);
    if (drivesOfflineCore) setTimeSource(value.nowMs);
  }, [value, drivesOfflineCore]);
  return <ClockContext.Provider value={value}>{ready ? children : null}</ClockContext.Provider>;
}
