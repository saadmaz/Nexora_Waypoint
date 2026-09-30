import type { ReactNode } from "react";

/**
 * IBM Plex Mono, for IDs, times and figures only: ORD2001, OUT084, 05:42,
 * 0.7 m³. Never for a sentence or a label (PRD v2 section 6, cross-role fix X6).
 */
export function Mono({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: "var(--font-mono)" }}>{children}</span>;
}
