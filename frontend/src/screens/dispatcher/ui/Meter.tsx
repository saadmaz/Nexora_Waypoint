import { cx } from "./cx";
import styles from "./Meter.module.css";

export type MeterProps = {
  value: number;
  max: number;
  height?: number;
  /** Colours the fill. Default: route, near the limit signal, over the limit danger. */
  tone?: "route" | "near" | "over" | "muted" | "success";
  label?: string;
};

/**
 * A fill against a limit. Over the limit the fill stops at the limit's share of the value and the
 * rest is hatched, so "120%" is seen rather than read (D2 binding resource).
 */
export function Meter({ value, max, height = 10, tone, label }: MeterProps) {
  const over = value > max;
  const auto = over ? "over" : value / max >= 0.9 ? "near" : "route";
  const shown = tone ?? auto;
  const width = over ? (max / value) * 100 : Math.min(100, (value / max) * 100);
  return (
    <div
      className={styles.meter}
      style={{ height }}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className={cx(styles.fill, styles[shown])} style={{ width: `${width}%` }} />
      {over && <div className={styles.over} />}
    </div>
  );
}
