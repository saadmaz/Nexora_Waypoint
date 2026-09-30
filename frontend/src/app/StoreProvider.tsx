import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { StoreApi } from "../api/StoreApi";
import { createMockStoreApi } from "../api/mockStoreApi";
import { clockTime } from "../domain/format";
import { OUTLET } from "../domain/outlet";
import { applyPreset, isPreset } from "./presets";
import { scenarioNow } from "./scenarioClock";
import { StoreContext } from "./StoreContext";

/** The presets already running or done for an API, so a second mount does not write them again. */
const PRESET_RUNS = new WeakMap<StoreApi, Promise<void>>();

/** The `?state=` values that start S1 with nothing placed; every other frame starts with the hero orders received. */
const EMPTY_SEED_STATES = ["form", "offline", "queued", "error", "sending", "empty", "review"];

/**
 * Creates the mock API and the scenario clock once, from the address the app was opened at
 * (`?at=HH:MM`, `?date=YYYY-MM-DD`, `?state=` for S1's preview frames, `?preset=` for writes that
 * a frame needs first). They are created once so the clock keeps ticking and the orders placed on
 * one screen are the ones the next screen lists. It also keeps the unread count that every
 * screen's bell shows. Must sit inside a router: the state gallery gives each frame its own
 * memory router and provider.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [base] = useState(() => {
    const params = new URLSearchParams(location.search);
    const state = params.get("state");
    const now = scenarioNow(params.get("at"), params.get("date"));
    const seed = state && EMPTY_SEED_STATES.includes(state) ? "empty" : "placed";
    const presets = (params.get("preset") ?? "").split(",").filter(isPreset);
    return { api: createMockStoreApi(now, { seed }), now, presets };
  });
  const { api, now, presets } = base;

  // Presets run before the first screen draws, once per API even if React mounts the provider twice.
  const [ready, setReady] = useState(presets.length === 0);
  useEffect(() => {
    if (presets.length === 0) return;
    let alive = true;
    let run = PRESET_RUNS.get(api);
    if (!run) {
      run = (async () => {
        for (const preset of presets) await applyPreset(api, now, preset);
      })();
      PRESET_RUNS.set(api, run);
    }
    void run.then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [api, now, presets]);

  // The unread count follows the clock: a new row arrives when its time passes.
  const [unread, setUnread] = useState(0);
  const [minute, setMinute] = useState(() => clockTime(now()));
  useEffect(() => {
    const id = window.setInterval(() => setMinute(clockTime(now())), 15_000);
    return () => window.clearInterval(id);
  }, [now]);

  const refreshUnread = useCallback(() => {
    void api.getUpdates(OUTLET.id).then((feed) => setUnread(feed.unread));
  }, [api]);

  useEffect(() => {
    if (ready) refreshUnread();
  }, [ready, refreshUnread, minute]);

  const value = useMemo(() => ({ api, now, unread, refreshUnread }), [api, now, unread, refreshUnread]);
  return <StoreContext.Provider value={value}>{ready ? children : null}</StoreContext.Provider>;
}
