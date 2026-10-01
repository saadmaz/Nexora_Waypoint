import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { DepotId } from "../../api/DispatcherApi";
import { useDispatcher } from "./context";

/**
 * The current scenario time, refreshed every `everyMs` and at once when the presenter control
 * jumps the clock. The one hook every dispatcher screen reads "now" from.
 */
export function useNow(everyMs = 15_000): Date {
  const { now, clockVersion } = useDispatcher();
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

/** The depot switch lives in the address, `?depot=kandy` (PRD v3 section 15), so a link keeps it. */
export function useDepot(): [DepotId, (depot: DepotId) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("depot");
  const depot: DepotId = raw === "kandy" ? "kandy" : "peliyagoda";
  const set = useCallback(
    (next: DepotId) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === "kandy") p.set("depot", "kandy");
          else p.delete("depot");
          return p;
        },
        { replace: false },
      );
    },
    [setParams],
  );
  return [depot, set];
}

export type Load<T> =
  | { status: "loading"; data: undefined; error: undefined; reload: () => void }
  | { status: "ready"; data: T; error: undefined; reload: () => void }
  | { status: "error"; data: T | undefined; error: Error; reload: () => void };

/**
 * Loads one thing through the DispatcherApi. It loads again when the clock jumps, after any write
 * (`invalidate`), when `deps` change, and every `pollMs` if given (PRD v3: the live board and the
 * inbox poll every 5 s). While it loads again it keeps showing the last data, so a screen does not
 * flash empty. `error` keeps the last data too, so an offline or failed refresh can say what it has.
 */
export function useLoad<T>(fetcher: () => Promise<T>, deps: readonly unknown[], pollMs?: number): Load<T> {
  const { clockVersion, dataVersion } = useDispatcher();
  const [state, setState] = useState<{ data?: T; error?: Error; done: boolean }>({ done: false });
  const [tick, setTick] = useState(0);
  const fetchRef = useRef(fetcher);
  useEffect(() => {
    fetchRef.current = fetcher;
  });

  // A change of inputs starts from loading again; a clock jump or a write keeps the last data.
  const depsKey = JSON.stringify(deps);
  const [seenDeps, setSeenDeps] = useState(depsKey);
  if (seenDeps !== depsKey) {
    setSeenDeps(depsKey);
    setState({ done: false });
  }

  useEffect(() => {
    let alive = true;
    fetchRef
      .current()
      .then((data) => {
        if (alive) setState({ data, done: true });
      })
      .catch((error: unknown) => {
        if (alive) setState((prev) => ({ ...prev, error: error instanceof Error ? error : new Error(String(error)), done: true }));
      });
    return () => {
      alive = false;
    };
  }, [depsKey, clockVersion, dataVersion, tick]);

  useEffect(() => {
    if (!pollMs) return;
    const id = window.setInterval(() => setTick((t) => t + 1), pollMs);
    return () => window.clearInterval(id);
  }, [pollMs]);

  const reload = useCallback(() => {
    setState((prev) => ({ data: prev.data, done: false }));
    setTick((t) => t + 1);
  }, []);

  if (state.error) return { status: "error", data: state.data, error: state.error, reload };
  if (!state.done && state.data === undefined) return { status: "loading", data: undefined, error: undefined, reload };
  return { status: "ready", data: state.data as T, error: undefined, reload };
}
