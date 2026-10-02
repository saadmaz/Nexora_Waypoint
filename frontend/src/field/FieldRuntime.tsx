import { useEffect, type ReactNode } from "react";
import { startFieldRuntime } from "./offline";

/**
 * Starts the offline core once for a field role: restores Simulate offline and the last sync time,
 * counts what is waiting and starts the sync triggers. Rendered at the top of the Loader and
 * Driver apps, never in the state galleries (their frames fake connectivity themselves).
 */
export function FieldRuntime({ children }: { children: ReactNode }) {
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    void startFieldRuntime().then((stopFn) => {
      if (cancelled) stopFn();
      else stop = stopFn;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return <>{children}</>;
}
