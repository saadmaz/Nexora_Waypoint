import type { ReactNode } from "react";
import styles from "./PinnedActionBar.module.css";

export type PinnedActionBarProps = {
  /** The actions, as 56 px buttons from the shared Button, stacked with 8 px between them. */
  children: ReactNode;
  /** The line under the actions, for example "Check ORD2001 or flag an issue first". */
  helper?: ReactNode;
  /** A thin top border on surface-1 (L2, L4), or the plain surface-0 thumb zone (R3). */
  tone?: "surface" | "plain";
};

/**
 * The bar pinned to the bottom of a field screen (LIB6, L2.1 A, R3.1): primary action at 56 px
 * in the thumb zone, with an optional helper line. The safe area is added under it.
 */
export function PinnedActionBar({ children, helper, tone = "surface" }: PinnedActionBarProps) {
  return (
    <div className={[styles.bar, tone === "plain" && styles.plain].filter(Boolean).join(" ")}>
      {children}
      {helper && <p className={styles.helper}>{helper}</p>}
    </div>
  );
}
