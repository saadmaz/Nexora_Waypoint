import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Stat.module.css";

export type StatProps = {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  footIcon?: ReactNode;
  /** The foot's colour: warn, bad or good. */
  footTone?: "warn" | "bad" | "good";
  footMono?: boolean;
  /** Colours the value, for the binding figure ("120%"). */
  valueTone?: "bad";
  /** Set the figure in the UI face, as the order-queue tiles do; every other card sets it in the data face. */
  sans?: boolean;
  /** Label on top, value, then foot (default for the capacity and live cards). */
  aside?: ReactNode;
  className?: string;
};

/** A KPI card: an uppercase label, one large figure, and a foot that says what it counts. */
export function Stat({ label, value, foot, footIcon, footTone, footMono, valueTone, sans, aside, className }: StatProps) {
  return (
    <div className={cx(styles.stat, className)}>
      <div className={styles.label}>{label}</div>
      <div className={styles.row}>
        <div className={cx(styles.value, sans && styles.sans, valueTone === "bad" && styles.bad)}>{value}</div>
        {aside}
      </div>
      {foot && (
        <div className={cx(styles.foot, footTone && styles[footTone], footMono && styles.mono)}>
          {footIcon}
          {foot}
        </div>
      )}
    </div>
  );
}
