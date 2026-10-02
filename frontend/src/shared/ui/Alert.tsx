import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Alert.module.css";

/** "issue" and "conflict" are the field tones (LIB8): issue reads like danger with the alert-circle, conflict is the amber-outlined Conflict style. */
export type AlertTone = "info" | "success" | "warning" | "danger" | "offline" | "issue" | "conflict";

export type AlertProps = {
  tone?: AlertTone;
  /** Override the tone's default icon. */
  icon?: IconName;
  title?: ReactNode;
  children?: ReactNode;
  /** Announce changes politely, for the cutoff countdown crossing a threshold. */
  live?: boolean;
};

const TONE_CLASS: Record<AlertTone, string> = {
  info: styles.info,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
  offline: styles.offline,
  issue: styles.danger,
  conflict: styles.conflict,
};

const TONE_ICON: Record<AlertTone, IconName> = {
  info: "clock",
  success: "check",
  warning: "clock",
  danger: "alert-triangle",
  offline: "wifi-off",
  issue: "alert-circle",
  conflict: "alert-triangle",
};

export function Alert({ tone = "info", icon, title, children, live }: AlertProps) {
  return (
    <div
      className={[styles.alert, TONE_CLASS[tone]].join(" ")}
      role={tone === "danger" || tone === "issue" ? "alert" : undefined}
      aria-live={live ? "polite" : undefined}
    >
      <span className={styles.iconSlot}>
        <Icon name={icon ?? TONE_ICON[tone]} size={20} />
      </span>
      <div className={styles.body}>
        {title && <div className={styles.title}>{title}</div>}
        {children && <div className={styles.text}>{children}</div>}
      </div>
    </div>
  );
}
