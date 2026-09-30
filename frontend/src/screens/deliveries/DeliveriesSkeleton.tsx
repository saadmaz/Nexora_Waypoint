import { Icon } from "../../components/ui/Icon";
import styles from "./DeliveriesSkeleton.module.css";

/** S2.S B: "Loading deliveries…" over a card of pulsing bars. */
export function DeliveriesSkeleton() {
  return (
    <div role="status" aria-label="Loading deliveries">
      <p className={styles.label}>
        <span className={styles.spin}>
          <Icon name="refresh-cw" size={16} />
        </span>
        Loading deliveries…
      </p>
      <div className={styles.card} aria-hidden>
        <div className={[styles.bar, styles.title].join(" ")} />
        <div className={[styles.bar, styles.sub].join(" ")} />
        <div className={[styles.bar, styles.block].join(" ")} />
        <div className={[styles.bar, styles.block].join(" ")} />
        <div className={[styles.bar, styles.tall].join(" ")} />
      </div>
    </div>
  );
}
