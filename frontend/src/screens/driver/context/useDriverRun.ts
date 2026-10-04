import { useCallback, useEffect, useState } from "react";
import { useNow } from "../../../field/clock/useClock";
import { NoRunError } from "../api/runMapper";
import type { DriverRun } from "../types";
import { useDriverApi } from "./DriverContext";

/** Why the server has no run for this driver and date (PRD v3 section 15). */
export type NoRun = {
  reason: string;
  /** When the next plan is expected, for a closed day; null when the server does not know yet. */
  nextPlanAt: string | null;
};

export type DriverRunState = {
  run: DriverRun | null;
  /** Set when the server answered with no run (plan not released, Sunday, holiday, no trip). */
  noRun: NoRun | null;
  /** Set when the run could not be read for any other reason. */
  failed: boolean;
  /** Re-reads the run at once, instead of waiting for the next clock tick. */
  refresh: () => void;
};

/**
 * The driver's run, re-read on every clock tick (so a countdown such as "3 min to go" moves) and
 * right after a write. `getRun` reads the phone's own cache, so it does not throw offline once a
 * run has been downloaded; a day without a run comes back as `noRun` instead of a run.
 */
export function useDriverRun(date: string): DriverRunState {
  const api = useDriverApi();
  const now = useNow();
  const [run, setRun] = useState<DriverRun | null>(null);
  const [noRun, setNoRun] = useState<NoRun | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    api.getRun(date).then(
      (next) => {
        if (!active) return;
        setRun(next);
        setNoRun(null);
        setFailed(false);
      },
      (error: unknown) => {
        if (!active) return;
        if (error instanceof NoRunError) {
          setRun(null);
          setNoRun((prev) =>
            prev?.reason === error.reason && prev.nextPlanAt === error.nextPlanAt ? prev : { reason: error.reason, nextPlanAt: error.nextPlanAt },
          );
          setFailed(false);
        } else {
          // Keep a run already on screen; only a first read that fails shows the error state.
          setFailed(true);
        }
      },
    );
    return () => {
      active = false;
    };
    // `now` intentionally re-triggers the read every tick; `version` forces one right after a write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, date, now, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { run, noRun, failed, refresh };
}
