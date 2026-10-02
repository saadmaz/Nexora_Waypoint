import { createContext, useContext } from "react";
import type { StoreApi } from "../api/StoreApi";

export type StoreContextValue = {
  /** The one StoreApi every screen talks to, so an order placed on S1 is the one S2 lists. */
  api: StoreApi;
  /** The one clock. Nothing else reads the wall clock. */
  now: () => Date;
  /** Unread updates, for the bell on every screen (S4). Refreshed each minute of the clock. */
  unread: number;
  /** Re-reads the unread count now, after the store has read something. */
  refreshUnread: () => void;
  /** Moves the scenario clock forward (the presenter control); absent when the clock is real time. */
  advanceTo?: (to: Date) => void;
  /** `?presenter=1` was given when the app opened: show the presenter control on every screen. */
  presenter: boolean;
  /** Bumped whenever the clock jumps, so screens re-read "now" at once instead of on the next tick. */
  clockVersion: number;
};

export const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore(): StoreContextValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside a StoreProvider");
  return value;
}
