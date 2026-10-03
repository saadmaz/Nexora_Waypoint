import { useEffect, useState, type ReactNode } from "react";
import { installFieldTransport, startFieldRuntime } from "./offline";

/**
 * Starts the offline core once for a field role: restores Simulate offline and the last sync time,
 * counts what is waiting and starts the sync triggers. Rendered at the top of the Loader and
 * Driver apps, never in the state galleries (their frames fake connectivity themselves).
 *
 * The real transport is installed while this component first renders, not in the effect below: a child's effect (the dock's
 * first read) runs before its parent's, so installing there sends the first request of a production build to the mock.
 * Development hides that, because StrictMode runs every effect twice and the second read finds the transport in place.
 */
export function FieldRuntime({ children }: { children: ReactNode }) {
  useState(installFieldTransport);
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
