import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Facts, type Fact } from "./Facts";
import { tokenColor } from "./tokens";
import styles from "./StateScreen.module.css";

export type StateScreenProps = {
  icon: IconName;
  /** Token names for the icon tile, e.g. "route-soft" and "route". */
  bg: string;
  fg: string;
  title: ReactNode;
  body?: ReactNode;
  facts?: Fact[];
  actions?: ReactNode;
};

/**
 * Icon, title, body, facts, actions: the shared shape for empty, offline and
 * error states across S1, S2 and S3 (S1.5 D, S2.S, S3.S).
 */
export function StateScreen({ icon, bg, fg, title, body, facts, actions }: StateScreenProps) {
  return (
    <div className={styles.state}>
      <span className={styles.iconTile} style={{ background: tokenColor(bg) }}>
        <Icon name={icon} size={24} color={fg} />
      </span>
      <div className={styles.title}>{title}</div>
      {body && <div className={styles.body}>{body}</div>}
      {facts && facts.length > 0 && (
        <div className={styles.facts}>
          <Facts items={facts} />
        </div>
      )}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

/** A loading placeholder: a few pulsing rows, no icon tile. */
export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={styles.skeleton} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div className={styles.skeletonRow} key={i} style={{ width: i % 2 ? "70%" : "100%" }} />
      ))}
    </div>
  );
}
