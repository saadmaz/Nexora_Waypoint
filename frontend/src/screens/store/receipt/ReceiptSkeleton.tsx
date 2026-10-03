import { Icon } from "../../../shared/ui/Icon";
import styles from "./ReceiptSkeleton.module.css";

/** S3.S B: "Loading proof of delivery…" over a card with a photo block and three bars. */
export function ReceiptSkeleton() {
  return (
    <div role="status" aria-label="Loading proof of delivery">
      <p className={styles.label}>
        <span className={styles.spin}>
          <Icon name="refresh-cw" size={16} />
        </span>
        Loading proof of delivery…
      </p>
      <div className={styles.card} aria-hidden>
        <div className={[styles.bar, styles.photo].join(" ")} />
        <div className={[styles.bar, styles.line].join(" ")} />
        <div className={[styles.bar, styles.line].join(" ")} />
        <div className={[styles.bar, styles.line].join(" ")} />
      </div>
    </div>
  );
}
