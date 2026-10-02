import { useCallback, useEffect, useState } from "react";
import { useNow } from "../../../field/clock/useClock";
import type { DriverRun } from "../types";
import { useDriverApi } from "./DriverContext";

export type DriverRunState = {
  run: DriverRun | null;
  /** Re-reads the run at once, instead of waiting for the next clock tick. */
  refresh: () => void;
};

/**
 * The driver's run, re-read on every clock tick (so a countdown such as "3 min to go" moves) and
 * right after a write. `getRun` reads the phone's own cache, so this never throws offline.
 */
export function useDriverRun(date: string): DriverRunState {
  const api = useDriverApi();
  const now = useNow();
  const [run, setRun] = useState<DriverRun | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    void api.getRun(date).then((next) => {
      if (active) setRun(next);
    });
    return () => {
      active = false;
    };
    // `now` intentionally re-triggers the read every tick; `version` forces one right after a write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, date, now, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { run, refresh };
}
