import type { ReactNode } from "react";

/**
 * The store's root element. It sets the theme here, not on <html>, because four roles share one
 * app and each root picks its own (PRD v3 section 6): Waypoint Store is Light, the daylight counter.
 */
export function StoreRoot({ children }: { children: ReactNode }) {
  return <div data-theme="light">{children}</div>;
}
