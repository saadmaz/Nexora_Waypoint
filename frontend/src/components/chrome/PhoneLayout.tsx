import type { ReactNode } from "react";
import { TopBar, type SyncState } from "./TopBar";
import { TabBar } from "./TabBar";
import { ConnectivityBar } from "./ConnectivityBar";
import styles from "./PhoneLayout.module.css";

export type PhoneLayoutProps = {
  sync?: SyncState;
  waiting?: number;
  /** The store's own offline line. Omit when the store is online. */
  connectivity?: ReactNode;
  /** A pinned action area above the tab bar. */
  actions?: ReactNode;
  /** Hide the tab bar, for a focused screen such as the receipt. */
  hideTabs?: boolean;
  children: ReactNode;
};

/** The store's phone frame: OUT084 · Waypoint Fresh, Kandy. */
export function PhoneLayout({
  sync = "synced",
  waiting,
  connectivity,
  actions,
  hideTabs,
  children,
}: PhoneLayoutProps) {
  return (
    <div className={styles.shell}>
      <TopBar
        outlet="OUT084 · Waypoint Fresh"
        place="Kandy"
        sync={sync}
        {...(waiting === undefined ? {} : { waiting })}
      />
      {connectivity && <ConnectivityBar>{connectivity}</ConnectivityBar>}
      <main className={styles.content}>{children}</main>
      {actions && <div className={styles.pinned}>{actions}</div>}
      {!hideTabs && (
        <div className={styles.tabs}>
          <TabBar />
        </div>
      )}
    </div>
  );
}
