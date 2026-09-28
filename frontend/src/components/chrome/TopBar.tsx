import { Icon } from "../ui/Icon";
import styles from "./TopBar.module.css";

export type SyncState = "synced" | "sending" | "offline" | "pending";

export type SyncChipProps = {
  state: SyncState;
  /** Count of records waiting, shown for "pending". */
  waiting?: number;
};

const SYNC_LABEL: Record<SyncState, string> = {
  synced: "Synced",
  sending: "Sending",
  offline: "Offline",
  pending: "Pending sync",
};

/** The sync chip in the top bar: Synced, Sending, Offline or Pending sync. */
export function SyncChip({ state, waiting }: SyncChipProps) {
  const label = state === "pending" && waiting ? `${SYNC_LABEL[state]} · ${waiting}` : SYNC_LABEL[state];
  const classes = [
    styles.chip,
    (state === "offline" || state === "pending") && styles.chipOffline,
    state === "sending" && styles.chipSending,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      {state === "sending" ? (
        <span className={styles.spin}>
          <Icon name="refresh-cw" size={14} />
        </span>
      ) : (
        <Icon
          name={state === "synced" ? "check" : state === "offline" ? "wifi-off" : "cloud"}
          size={14}
        />
      )}
      {label}
    </span>
  );
}

export type TopBarProps = {
  /** "OUT084 · Waypoint Fresh" */
  outlet: string;
  /** "Kandy" */
  place: string;
  sync: SyncState;
  waiting?: number;
};

/** The phone top bar, 56 px, on the chrome surface. */
export function TopBar({ outlet, place, sync, waiting }: TopBarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.title}>
        <div className={styles.outlet}>{outlet}</div>
        <div className={styles.place}>{place}</div>
      </div>
      <SyncChip state={sync} {...(waiting === undefined ? {} : { waiting })} />
    </header>
  );
}
