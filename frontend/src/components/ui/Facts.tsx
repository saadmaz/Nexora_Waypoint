import type { ReactNode } from "react";
import styles from "./Facts.module.css";

export type Fact = { key: ReactNode; value: ReactNode };

/**
 * A key/value list: label in Archivo on the left, figure in Plex Mono on the
 * right. Used for POD summaries, delivery facts, order estimates.
 */
export function Facts({ items }: { items: Fact[] }) {
  return (
    <dl className={styles.facts}>
      {items.map((item, i) => (
        <div className={styles.row} key={i}>
          <dt className={styles.key}>{item.key}</dt>
          <dd className={styles.value}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
