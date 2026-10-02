import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Banner.module.css";

export type BannerProps = {
  tone: "info" | "success" | "warning" | "danger" | "muted";
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * A full-width line of news on a screen: what changed, what is forced, what is safe. The shared
 * Alert is sized for the phone; this one carries actions on the right, as the desktop frames draw.
 */
export function Banner({ tone, icon, title, children, actions, className }: BannerProps) {
  return (
    <div className={cx(styles.banner, styles[tone], className)} role={tone === "danger" ? "alert" : "status"}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <div className={styles.body}>
        {title && <div className={styles.title}>{title}</div>}
        {children && <div className={styles.text}>{children}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
