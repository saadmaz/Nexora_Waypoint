import { Icon } from "../../../shared/ui/Icon";
import styles from "./DeliveriesSkeleton.module.css";

/** S2.S B: "Loading deliveries…" over a card of pulsing bars. The label changes for other lists. */
export function DeliveriesSkeleton({ label = "Loading deliveries…" }: { label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <p className={styles.label}>
        <span className={styles.spin}>
          <Icon name="refresh-cw" size={16} />
        </span>
        {label}
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
