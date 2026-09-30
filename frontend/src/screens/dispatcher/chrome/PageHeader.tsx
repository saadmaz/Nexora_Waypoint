import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

export type PageHeaderProps = {
  /** The small line above the title: "CAPACITY · PELIYAGODA · PLAN v1 DRAFT". */
  overline: ReactNode;
  title: ReactNode;
  titleAddon?: ReactNode;
  /** Buttons on the right. */
  actions?: ReactNode;
  /** A line under the actions: why one is disabled, what a release does. */
  reason?: ReactNode;
  children?: ReactNode;
};

/** The title block every dispatcher screen opens with: overline, title, the action, and the stepper below. */
export function PageHeader({ overline, title, titleAddon, actions, reason, children }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.row}>
        <div className={styles.titleBlock}>
          <div className={styles.overline}>{overline}</div>
          <div className={styles.titleLine}>
            <h1 className={styles.title}>{title}</h1>
            {titleAddon}
          </div>
        </div>
        {(actions || reason) && (
          <div className={styles.actions}>
            <div className={styles.actionsRow}>{actions}</div>
            {reason && <div className={styles.reason}>{reason}</div>}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
