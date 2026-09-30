import { useEffect, useState } from "react";
import { useStore } from "../app/StoreContext";

/**
 * The current scenario time, refreshed every `everyMs`. The one hook every screen reads "now"
 * from: it takes the clock from the StoreProvider, so nothing else reads the wall clock.
 */
export function useNow(everyMs = 15_000): Date {
  const { now } = useStore();
  const [value, setValue] = useState(now);
  useEffect(() => {
    const id = window.setInterval(() => setValue(now()), everyMs);
    return () => window.clearInterval(id);
  }, [now, everyMs]);
  return value;
}
