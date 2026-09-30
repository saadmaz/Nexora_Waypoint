import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createMockStoreApi } from "../api/mockStoreApi";
import { clockTime } from "../domain/format";
import { OUTLET } from "../domain/outlet";
import { useNow } from "../hooks/useNow";
import { scenarioNow } from "./scenarioClock";
import { StoreContext } from "./StoreContext";

/**
 * Creates the mock API and the scenario clock once, from the address the app was opened at
 * (`?at=HH:MM`, `?date=YYYY-MM-DD`, and `?state=` for S1's preview frames, which start with
 * nothing placed). They are created once so the clock keeps ticking and the orders placed on
 * one screen are the ones the next screen lists. It also keeps the unread count that every
 * screen's bell shows. Interim, until phase 7 owns the clock.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [base] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state");
    const now = scenarioNow(params.get("at"), params.get("date"));
    const seed = state && state !== "received" ? "empty" : "placed";
    return { api: createMockStoreApi(now, { seed }), now };
  });
  const { api, now } = base;

  const [unread, setUnread] = useState(0);
  const minute = clockTime(useNow(now));

  const refreshUnread = useCallback(() => {
    void api.getUpdates(OUTLET.id).then((feed) => setUnread(feed.unread));
  }, [api]);

  // The feed follows the clock: a new row arrives when its time passes.
  useEffect(() => {
    refreshUnread();
  }, [refreshUnread, minute]);

  const value = useMemo(() => ({ api, now, unread, refreshUnread }), [api, now, unread, refreshUnread]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
