import { useEffect, useState } from "react";
import { useStore } from "../app/StoreContext";

/**
 * The current scenario time, refreshed every `everyMs` and at once when the presenter control
 * jumps the clock. The one hook every screen reads "now" from: it takes the clock from the
 * StoreProvider, so nothing else reads the wall clock.
 */
export function useNow(everyMs = 15_000): Date {
  const { now, clockVersion } = useStore();
  const [value, setValue] = useState(now);
  const [seenVersion, setSeenVersion] = useState(clockVersion);
  if (seenVersion !== clockVersion) {
    setSeenVersion(clockVersion);
    setValue(now());
  }
  useEffect(() => {
    const id = window.setInterval(() => setValue(now()), everyMs);
    return () => window.clearInterval(id);
  }, [now, everyMs]);
  return value;
}
