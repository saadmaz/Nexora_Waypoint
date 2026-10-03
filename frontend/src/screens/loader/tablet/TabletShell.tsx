import type { ReactNode } from "react";
import { ConnectivityChip, type ChipStatus } from "../../../field/components";
import { AccountMenu } from "../../auth/AccountMenu";
import styles from "./TabletShell.module.css";

export type TabletShellProps = {
  /** "Kandy dock". */
  dockLabel: string;
  /** "Tue 29 Sep". */
  dateLabel: string;
  connectivity: { status: ChipStatus; time?: string; count?: number };
  /** The vehicle list (left, 360 px). */
  master: ReactNode;
  /** The selected vehicle's load plan, or a prompt to choose one. */
  detail: ReactNode;
  /** State gallery only: a fixed frame height. The live shell fills the viewport. */
  height?: number;
  children?: ReactNode;
};

/**
 * L1.7 (loader prompt section 3, field conventions section 14): from 1024 px the dock list is the
 * master pane and the selected vehicle's load plan is the detail pane, under a "Waypoint Load" app
 * bar. Below 1024 px the phone layout is used instead, with navigation between L1 and L2.
 * The "Issues" tab is drawn as the frame draws it, but the loader has no Issues screen, so it
 * is inert (see the README's departures).
 */
export function TabletShell({ dockLabel, dateLabel, connectivity, master, detail, height, children }: TabletShellProps) {
  return (
    <div className={styles.shell} style={height ? { height } : undefined}>
      <header className={styles.appbar}>
        <span className={styles.brand}>
          <span className={styles.mark} aria-hidden>
            <span className={styles.diamond} />
          </span>
          <span className={styles.brandText}>
            <strong>Waypoint</strong> Load
          </span>
        </span>
        <nav className={styles.nav} aria-label="Primary">
          <span className={[styles.navItem, styles.navCurrent].join(" ")} aria-current="page">
            Load lists
          </span>
          <span className={styles.navItem} aria-disabled="true">
            Issues
          </span>
        </nav>
        <span className={styles.spacer} />
        <span className={styles.dateLine}>
          {dateLabel} · {dockLabel}
        </span>
        <ConnectivityChip status={connectivity.status} time={connectivity.time} count={connectivity.count} size="tablet" />
        <AccountMenu role="loader" />
      </header>
      <div className={styles.panes}>
        <aside className={styles.master} aria-label="Vehicles">
          {master}
        </aside>
        <section className={styles.detail} aria-label="Load list">
          {detail}
        </section>
      </div>
      {children}
    </div>
  );
}
