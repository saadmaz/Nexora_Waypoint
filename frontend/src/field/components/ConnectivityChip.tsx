import { Icon, type IconName } from "../../shared/ui/Icon";
import { Mono } from "../../shared/ui/Mono";
import styles from "./ConnectivityChip.module.css";

export type ChipStatus = "online" | "synced" | "offline" | "syncing" | "retrying" | "failed";

export type ConnectivityChipProps = {
  status: ChipStatus;
  /** HH:MM. Shown after "Synced" and "Failed". */
  time?: string;
  /** Records waiting on the phone. Shown after "Offline" when above zero ("Offline · 5"). */
  count?: number;
  /** While syncing: "3 / 5" replaces the word, as drawn on R4.2. */
  progress?: { done: number; total: number };
  /** 12 px label for the loader tablet (L1, L2), 13 px for the driver phone (R1 to R9). */
  size?: "tablet" | "phone";
  /** Makes the chip a button, for the driver's outbox sheet. A plain status otherwise. */
  onClick?: () => void;
};

const ICON: Record<ChipStatus, IconName> = {
  online: "check",
  synced: "check",
  offline: "wifi-off",
  syncing: "refresh-cw",
  retrying: "refresh-cw",
  failed: "alert-circle",
};

const WORD: Record<ChipStatus, string> = {
  online: "Online",
  synced: "Synced",
  offline: "Offline",
  syncing: "Syncing",
  retrying: "Retrying",
  failed: "Failed",
};

/**
 * The connectivity chip on the top bar: "Online", "Synced", "Synced 04:54", "Offline",
 * "Offline · 5", "Syncing", "Failed 06:42". Offline fills with signal so it is the loudest thing
 * on the bar; every state also carries an icon and a word, never colour alone. Changes are
 * announced politely.
 */
export function ConnectivityChip({ status, time, count, progress, size = "phone", onClick }: ConnectivityChipProps) {
  const showProgress = status === "syncing" && progress !== undefined;
  const classes = [styles.chip, styles[status], showProgress && styles.progress, size === "tablet" ? styles.tablet : styles.phone]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className={status === "syncing" || status === "retrying" ? styles.spin : undefined}>
        <Icon name={ICON[status]} size={14} />
      </span>
      <span>
        {showProgress ? (
          <Mono>
            {progress.done} / {progress.total}
          </Mono>
        ) : (
          WORD[status]
        )}
        {(status === "synced" || status === "failed") && time && (
          <>
            {" "}
            <Mono>{time}</Mono>
          </>
        )}
        {status === "retrying" && count !== undefined && count > 0 && (
          <>
            {" "}
            <Mono>{count}</Mono>
          </>
        )}
        {status === "offline" && count !== undefined && count > 0 && (
          <>
            {" · "}
            <Mono>{count}</Mono>
          </>
        )}
      </span>
    </>
  );

  return onClick ? (
    <button type="button" className={classes} onClick={onClick} aria-live="polite">
      {content}
    </button>
  ) : (
    <span className={classes} role="status" aria-live="polite">
      {content}
    </span>
  );
}
