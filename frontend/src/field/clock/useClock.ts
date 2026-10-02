import { createContext, useContext, useEffect, useState } from "react";
import type { FieldClock } from "./clock";

export const ClockContext = createContext<FieldClock | undefined>(undefined);

export function useFieldClock(): FieldClock {
  const clock = useContext(ClockContext);
  if (!clock) throw new Error("useFieldClock needs a ClockProvider above it");
  return clock;
}

/**
 * The scenario "now" in epoch ms, re-rendered every `tickMs` (a second by default) so a countdown
 * moves. A fixed clock never ticks.
 */
export function useNow(tickMs = 1000): number {
  const clock = useFieldClock();
  const [, setTick] = useState(0);
  useEffect(() => {
    if (clock.fixed) return;
    const id = window.setInterval(() => setTick((n) => n + 1), tickMs);
    return () => window.clearInterval(id);
  }, [clock, tickMs]);
  return clock.nowMs();
}
