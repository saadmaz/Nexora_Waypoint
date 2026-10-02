import type { ReactNode } from "react";
import { Icon, type IconName } from "../../../shared/ui/Icon";
import styles from "./StatusBar.module.css";

export type StatusBarTone = "offline" | "syncing" | "failed" | "review" | "synced";

const ICON: Record<StatusBarTone, IconName> = {
  offline: "wifi-off",
  syncing: "refresh-cw",
  failed: "alert-circle",
  review: "alert-triangle",
  synced: "check",
};

export type StatusBarProps = {
  tone: StatusBarTone;
  children: ReactNode;
  /** Right-hand content: "Last sync 05:17", "3 / 5", a Retry now or View button. */
  aside?: ReactNode;
};

/** A live region, so a change from "Offline · 1 saved" to "Offline · 2 saved" is read out politely. */
export function StatusBar({ tone, children, aside }: StatusBarProps) {
  return (
    <div className={[styles.bar, styles[`bar_${tone}`]].join(" ")} role="status" aria-live="polite">
      <span className={tone === "syncing" ? styles.spin : styles.barIcon}>
        <Icon name={ICON[tone]} size={20} />
      </span>
      <span className={styles.barText}>{children}</span>
      {aside}
    </div>
  );
}

/** The small outlined action on a bar ("Retry now", "View"): 44 px tall, as drawn on R4.3 2 and R1.7. */
export function StatusBarButton({ icon, children, onClick }: { icon?: IconName; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={styles.action} onClick={onClick}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

/** The small right-hand text on a bar ("Last sync 05:17", "3 / 5"). */
export function StatusBarAside({ children }: { children: ReactNode }) {
  return <span className={styles.barAside}>{children}</span>;
}
