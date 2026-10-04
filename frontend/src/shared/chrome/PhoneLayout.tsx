import { useContext, type ReactNode } from "react";
import { StoreContext } from "../../app/StoreContext";
import type { BellProps } from "./BellButton";
import { TopBar, type SyncState } from "./TopBar";
import { TabBar } from "./TabBar";
import { ConnectivityBar } from "./ConnectivityBar";
import styles from "./PhoneLayout.module.css";

export type PhoneLayoutProps = {
  /** "OUT084 · Waypoint Fresh". Defaults to the signed-in store's outlet; S2.9 shows another outlet's view. */
  outlet?: string;
  /** "Kandy" */
  place?: string;
  /** The second line in Plex Mono (S3). */
  placeMono?: boolean;
  sync?: SyncState;
  waiting?: number;
  /** The Updates bell in the top bar. Omit to leave it out. */
  bell?: BellProps;
  /** A back arrow in the top bar (S4). */
  onBack?: () => void;
  /** The store's own offline line. Omit when the store is online. */
  connectivity?: ReactNode;
  /** A pinned action area above the tab bar. */
  actions?: ReactNode;
  /** Hide the tab bar, for a focused screen such as the receipt. */
  hideTabs?: boolean;
  children: ReactNode;
};

/** The store's phone frame, naming the signed-in store's outlet unless told otherwise. */
export function PhoneLayout({
  outlet: outletProp,
  place: placeProp,
  placeMono,
  sync = "synced",
  waiting,
  bell,
  onBack,
  connectivity,
  actions,
  hideTabs,
  children,
}: PhoneLayoutProps) {
  const store = useContext(StoreContext);
  const outlet = outletProp ?? (store ? `${store.outlet.id} · ${store.outlet.brand}` : "");
  const place = placeProp ?? store?.outlet.district ?? "";
  return (
    <div className={styles.shell}>
      <TopBar
        outlet={outlet}
        place={place}
        {...(placeMono ? { placeMono } : {})}
        sync={sync}
        {...(waiting === undefined ? {} : { waiting })}
        {...(bell ? { bell } : {})}
        {...(onBack ? { onBack } : {})}
      />
      {connectivity && <ConnectivityBar>{connectivity}</ConnectivityBar>}
      <main className={styles.content}>{children}</main>
      {actions && (
        <div className={[styles.pinned, hideTabs && styles.pinnedFlush].filter(Boolean).join(" ")}>{actions}</div>
      )}
      {!hideTabs && (
        <div className={styles.tabs}>
          <TabBar />
        </div>
      )}
    </div>
  );
}
