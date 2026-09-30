import { useState, type ReactNode } from "react";
import { createMockStoreApi } from "../api/mockStoreApi";
import { scenarioNow } from "./scenarioClock";
import { StoreContext, type StoreContextValue } from "./StoreContext";

/**
 * Creates the mock API and the scenario clock once, from the address the app was opened at
 * (`?at=HH:MM`, `?date=YYYY-MM-DD`, and `?state=` for S1's preview frames, which start with
 * nothing placed). They are created once so the clock keeps ticking and the orders placed on
 * one screen are the ones the next screen lists. Interim, until phase 7 owns the clock.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [value] = useState<StoreContextValue>(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state");
    const now = scenarioNow(params.get("at"), params.get("date"));
    const seed = state && state !== "received" ? "empty" : "placed";
    return { api: createMockStoreApi(now, { seed }), now };
  });
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
