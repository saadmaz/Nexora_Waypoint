import { Icon } from "../ui/Icon";
import { BellButton, type BellProps } from "./BellButton";
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
  /** Set the second line in Plex Mono, for the receipt's "OUT084 · Waypoint Fresh · Kandy". */
  placeMono?: boolean;
  sync: SyncState;
  waiting?: number;
  /** The Updates bell (entry point to S4). Omit to leave it out. */
  bell?: BellProps;
};

/** The phone top bar, 56 px, on the chrome surface. */
export function TopBar({ outlet, place, placeMono, sync, waiting, bell }: TopBarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.title}>
        <div className={styles.outlet}>{outlet}</div>
        <div className={[styles.place, placeMono && styles.placeMono].filter(Boolean).join(" ")}>{place}</div>
      </div>
      {bell && <BellButton {...bell} />}
      <SyncChip state={sync} {...(waiting === undefined ? {} : { waiting })} />
    </header>
  );
}
