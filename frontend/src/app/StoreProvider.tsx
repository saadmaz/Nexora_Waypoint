import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { StoreApi } from "../api/StoreApi";
import { createApiStoreApi } from "../api/apiStoreApi";
import { roleApiMode } from "../api/http/config";
import { createServerClock } from "../api/serverClock";
import { clockTime } from "../domain/format";
import { useServerClockReady } from "../hooks/useServerClockReady";
import type { StoreOutlet } from "../domain/outlet";
import { devMocks } from "../devMocks/registry";
import { StoreContext } from "./StoreContext";

/** How often the store's screens read the server again (PRD v3 section 9). */
const STORE_POLL_MS = 10_000;

const OUTLET_KEY = "waypoint.store.outlet";

function savedOutlet(): StoreOutlet | null {
  try {
    const raw = localStorage.getItem(OUTLET_KEY);
    return raw ? (JSON.parse(raw) as StoreOutlet) : null;
  } catch {
    return null;
  }
}

function saveOutlet(outlet: StoreOutlet): void {
  try {
    localStorage.setItem(OUTLET_KEY, JSON.stringify(outlet));
  } catch {
    // Storage can be blocked: the outlet is still in memory.
  }
}

/** The presets already running or done for an API, so a second mount does not write them again. */
const PRESET_RUNS = new WeakMap<StoreApi, Promise<void>>();

/** The `?state=` values that start S1 with nothing placed; every other frame starts with the hero orders received. */
const EMPTY_SEED_STATES = ["form", "offline", "queued", "error", "sending", "empty", "review"];

/**
 * Creates the Store's API and the scenario clock once, from the address the app was opened at
 * (`?at=HH:MM`, `?date=YYYY-MM-DD`, `?state=` for S1's preview frames, `?preset=` for writes that
 * a frame needs first). They are created once so the clock keeps ticking and the orders placed on
 * one screen are the ones the next screen lists. It also keeps the unread count that every
 * screen's bell shows. Must sit inside a router: the state gallery gives each frame its own
 * memory router and provider. The API is the mock unless `VITE_STORE_API=api`; then it is the real
 * one and `?state=` and `?preset=` do nothing, since there is no fixture to seed. The clock stays
 * the app's own scenario clock either way.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [base] = useState(() => {
    const params = new URLSearchParams(location.search);
    const state = params.get("state");
    const onApi = roleApiMode("store") === "api";
    // On the real API the clock is the server's: it ticks, and the page extrapolates between answers (DP-26).
    const server = onApi ? createServerClock("store") : null;
    // Mocks are development only: devMocks() is never called in a production build, where every role is on the API.
    const mocks = onApi ? null : devMocks();
    const clock = server
      ? { now: () => new Date(server.nowMs()), advanceTo: undefined }
      : mocks!.scenarioClock.createScenarioClock(params.get("at"), params.get("date"));
    const now = clock.now;
    const seed = state && EMPTY_SEED_STATES.includes(state) ? "empty" : "placed";
    const presets = mocks ? (params.get("preset") ?? "").split(",").filter(mocks.storePresets.isPreset) : [];
    const presenter = params.get("presenter") === "1";
    const api = mocks ? mocks.store.createMockStoreApi(now, { seed }) : createApiStoreApi();
    return { api, now, advanceTo: clock.advanceTo, presets, presenter, server, applyPreset: mocks?.storePresets.applyPreset };
  });
  const { api, now, advanceTo, presets, presenter, server, applyPreset } = base;
  useEffect(() => server?.start(), [server]);
  const clockReady = useServerClockReady(server);
  const [clockVersion, setClockVersion] = useState(0);
  // On the real API the screens look again every 10 s, and at once after a write (PRD section 9): the server's clock tells us.
  useEffect(() => {
    if (!server) return;
    const id = window.setInterval(() => setClockVersion((v) => v + 1), STORE_POLL_MS);
    const off = server.subscribe(() => setClockVersion((v) => v + 1));
    return () => {
      window.clearInterval(id);
      off();
    };
  }, [server]);
  const jump = useMemo(
    () =>
      advanceTo
        ? (to: Date) => {
            advanceTo(to);
            setClockVersion((v) => v + 1);
          }
        : undefined,
    [advanceTo],
  );

  // Presets run before the first screen draws, once per API even if React mounts the provider twice.
  const [presetsDone, setReady] = useState(presets.length === 0);
  const ready = presetsDone && clockReady;
  useEffect(() => {
    if (presets.length === 0) return;
    let alive = true;
    let run = PRESET_RUNS.get(api);
    if (!run) {
      run = (async () => {
        for (const preset of presets) await applyPreset?.(api, now, preset);
      })();
      PRESET_RUNS.set(api, run);
    }
    void run.then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [api, now, presets, applyPreset]);

  // The unread count follows the clock: a new row arrives when its time passes.
  const [unread, setUnread] = useState(0);
  const [minute, setMinute] = useState(() => clockTime(now()));
  useEffect(() => {
    const id = window.setInterval(() => setMinute(clockTime(now())), 15_000);
    return () => window.clearInterval(id);
  }, [now]);

  // The outlet this account manages comes from the database. The last answer is kept on the device, so a reload while
  // offline still has the outlet to name.
  const [outlet, setOutlet] = useState<StoreOutlet | null>(savedOutlet);
  useEffect(() => {
    let alive = true;
    void api
      .getOutlet()
      .then((found) => {
        if (!alive) return;
        setOutlet(found);
        saveOutlet(found);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api, clockVersion]);

  const outletId = outlet?.id;
  const refreshUnread = useCallback(() => {
    if (outletId) void api.getUpdates(outletId).then((feed) => setUnread(feed.unread));
  }, [api, outletId]);

  useEffect(() => {
    if (ready) refreshUnread();
  }, [ready, refreshUnread, minute, clockVersion]);

  const value = useMemo(
    () =>
      outlet ? { api, outlet, now, unread, refreshUnread, presenter, clockVersion, ...(jump ? { advanceTo: jump } : {}) } : null,
    [api, outlet, now, unread, refreshUnread, presenter, clockVersion, jump],
  );
  return value && ready ? <StoreContext.Provider value={value}>{children}</StoreContext.Provider> : null;
}
