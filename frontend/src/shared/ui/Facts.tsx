import type { ReactNode } from "react";
import styles from "./Facts.module.css";

export type Fact = { key: ReactNode; value: ReactNode };

/**
 * A key/value list: label in Archivo on the left, figure in Plex Mono on the
 * right. Used for POD summaries, delivery facts, order estimates.
 */
export function Facts({ items, ruled }: { items: Fact[]; /** Uppercase labels and a rule between rows, as the desktop proof-of-delivery card draws it. */ ruled?: boolean }) {
  return (
    <dl className={[styles.facts, ruled && styles.ruled].filter(Boolean).join(" ")}>
      {items.map((item, i) => (
        <div className={styles.row} key={i}>
          <dt className={styles.key}>{item.key}</dt>
          <dd className={styles.value}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
