import { createContext, useContext } from "react";
import type { StoreApi } from "../api/StoreApi";

export type StoreContextValue = {
  /** The one StoreApi every screen talks to, so an order placed on S1 shows on S2. */
  api: StoreApi;
  /** The one clock. Nothing else reads the wall clock. */
  now: () => Date;
};

export const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore(): StoreContextValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside a StoreProvider");
  return value;
}
