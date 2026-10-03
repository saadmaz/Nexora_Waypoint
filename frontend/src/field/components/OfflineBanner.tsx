import type { ReactNode } from "react";
import { Icon, type IconName } from "../../shared/ui/Icon";
import styles from "./OfflineBanner.module.css";

export type BannerTone = "offline" | "online" | "syncing" | "waiting" | "conflict";

export type OfflineBannerProps = {
  tone?: BannerTone;
  /** The sentence, for example "Offline · 5 saved on phone". Wrap times and counts in <Mono>. */
  children: ReactNode;
  /** Right-aligned small text, for example "Last sync 05:17". */
  detail?: ReactNode;
  /** A small outlined action, for example "Retry now" or "Review". */
  action?: { label: string; onClick: () => void };
  /** The 40 px, 17 px version under the driver top bar on R1.6. The default is the 48 px R3.1 one. */
  compact?: boolean;
};

const ICON: Record<BannerTone, IconName> = {
  offline: "wifi-off",
  online: "check",
  syncing: "refresh-cw",
  waiting: "cloud",
  conflict: "alert-triangle",
};

/**
 * The bar under the top bar (LIB3 ConnectivityBar, five tones). It is a live region, so a change
 * from "Offline · 1 saved" to "Offline · 2 saved" is read out politely.
 */
export function OfflineBanner({ tone = "offline", children, detail, action, compact }: OfflineBannerProps) {
  return (
    <div
      className={[styles.banner, styles[tone], compact && styles.compact].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
    >
      <span className={tone === "syncing" ? styles.spin : styles.icon}>
        <Icon name={ICON[tone]} size={20} />
      </span>
      <span className={styles.text}>{children}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
      {action && (
        <button type="button" className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
