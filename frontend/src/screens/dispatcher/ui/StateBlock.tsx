import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./StateBlock.module.css";

export type StateBlockProps = {
  icon: ReactNode;
  tone?: "neutral" | "success" | "danger" | "offline";
  title: ReactNode;
  body?: ReactNode;
  /** Extra lines of fact (times, counts) set in the data face. */
  facts?: ReactNode;
  action?: ReactNode;
};

/**
 * An empty, offline or error screen: an icon, what happened, what is safe, and the one thing to do.
 * Every one says what is safe ("Nothing was changed"), as PRD v3 section 15 asks.
 */
export function StateBlock({ icon, tone = "neutral", title, body, facts, action }: StateBlockProps) {
  return (
    <div className={styles.state}>
      <div className={cx(styles.tile, styles[tone])}>{icon}</div>
      <div className={styles.copy}>
        <div className={styles.title}>{title}</div>
        {body && <div className={styles.body}>{body}</div>}
      </div>
      {facts && <div className={styles.facts}>{facts}</div>}
      {action}
    </div>
  );
}
