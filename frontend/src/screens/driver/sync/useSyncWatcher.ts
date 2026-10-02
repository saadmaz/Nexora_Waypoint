import { useEffect, useState } from "react";
import { useFieldClock, useNow } from "../../../field/clock/useClock";
import { onSyncResult, useConnectivity } from "../../../field/offline";
import { useDriverApi } from "../context/DriverContext";
import { RUN_DATE } from "../fixtures";
import type { DriverRun } from "../types";
import { queueResolution, restoreSyncView } from "./syncView";

const POLL_MS = 30_000;

/**
 * Keeps the phone current while a conflict is open (driver prompt 4 section 4): while any stop is
 * waiting on Dispatch and the phone is online it asks `getNotices` every 30 s of scenario time and
 * after every sync, and when Dispatch's decision shows up on a stop it queues R5.3 once. Mounted by
 * the shell, so it runs on every driver screen. The gallery's fixed clock never polls.
 */
export function useSyncWatcher(run: DriverRun | null): void {
  const api = useDriverApi();
  const clock = useFieldClock();
  const now = useNow();
  const { connected } = useConnectivity();
  const [restored, setRestored] = useState(false);
  const enabled = !clock.fixed;

  const conflictOpen = run?.stops.some((stop) => stop.conflict && !stop.resolution) ?? false;
  const tick = Math.floor(now / POLL_MS);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void restoreSyncView().then(() => {
      if (active) setRestored(true);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !conflictOpen || !connected) return;
    void api.getNotices(RUN_DATE);
  }, [api, enabled, conflictOpen, connected, tick]);

  useEffect(() => {
    if (!enabled || !conflictOpen) return undefined;
    return onSyncResult(() => void api.getNotices(RUN_DATE));
  }, [api, enabled, conflictOpen]);

  useEffect(() => {
    if (!enabled || !restored || !run) return;
    for (const stop of run.stops) {
      if (stop.resolution) queueResolution(stop.outletId, clock.nowMs());
    }
  }, [enabled, restored, run, clock]);
}
