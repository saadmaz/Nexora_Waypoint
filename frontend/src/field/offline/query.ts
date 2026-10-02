import { useCallback, useEffect, useRef, useState } from "react";
import { getCache, putCache } from "./db";
import { nowMs } from "./time";
import { NetworkError } from "./transport";

/**
 * A read that follows the cache-then-network rule every field screen needs (field conventions
 * section 11): ask the API, cache what it returns under `key`, and on a NetworkError fall back to
 * the last cached value, marked stale with the time it was cached. A `NetworkError` with no cache
 * yet, or any other error, is `error`. Shared by Loader and Driver reads (L1.S, L2.S, L4.S …).
 */
export type FieldQueryState<T> =
  | { status: "loading" }
  | { status: "ready"; value: T; stale: boolean; updatedAt: number }
  | { status: "error" };

export type FieldQueryResult<T> = FieldQueryState<T> & {
  /** Read again from a clean slate: the screen goes back to loading. For the error screen's Retry button. */
  retry: () => void;
  /** Read again in the background: the current screen stays until the answer arrives. For polling and after a write. */
  refresh: () => void;
};

export function useFieldQuery<T>(key: string | null, fetcher: () => Promise<T>): FieldQueryResult<T> {
  // Keeps the latest fetcher without making it an effect dependency: only `key` (and `retry`,
  // below) should restart the read.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const [state, setState] = useState<FieldQueryState<T>>({ status: "loading" });
  // React's own pattern for "reset state when a prop changes": done during render, not in an
  // effect, so switching `key` never fires a second, cascading render.
  const [activeKey, setActiveKey] = useState(key);
  if (key !== activeKey) {
    setActiveKey(key);
    if (state.status !== "loading") setState({ status: "loading" });
  }

  const [version, setVersion] = useState(0);
  const retry = useCallback(() => {
    setState({ status: "loading" });
    setVersion((v) => v + 1);
  }, []);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void (async () => {
      try {
        const value = await fetcherRef.current();
        await putCache(key, value, nowMs());
        if (!cancelled) setState({ status: "ready", value, stale: false, updatedAt: nowMs() });
      } catch (error) {
        // A background refresh that fails keeps what is on screen; only a first read becomes an error.
        const failed = (prev: FieldQueryState<T>): FieldQueryState<T> => (prev.status === "ready" ? prev : { status: "error" });
        if (error instanceof NetworkError) {
          const cached = await getCache<T>(key);
          if (!cancelled) {
            if (cached) setState({ status: "ready", value: cached.value, stale: true, updatedAt: cached.updatedAt });
            else setState(failed);
          }
          return;
        }
        if (!cancelled) setState(failed);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `version` is a deliberate re-run trigger (retry); the fetcher itself is read from the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  return { ...state, retry, refresh };
}
