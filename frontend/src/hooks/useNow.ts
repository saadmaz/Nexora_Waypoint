import { useEffect, useState } from "react";

/**
 * The current time from a `now` function, refreshed every `everyMs`. Give it a stable
 * `now`; a new one is picked up on the next tick. Screens take
 * `now` rather than calling Date directly so the scenario clock (?at=HH:MM,
 * phase 7) can drive the cutoff countdown.
 */
export function useNow(now: () => Date, everyMs = 15_000): Date {
  const [value, setValue] = useState(now);
  useEffect(() => {
    const id = window.setInterval(() => setValue(now()), everyMs);
    return () => window.clearInterval(id);
  }, [now, everyMs]);
  return value;
}
