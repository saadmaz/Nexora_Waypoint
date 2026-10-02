import type { ReactNode } from "react";
import { ConnectivityBar } from "../../../shared/chrome/ConnectivityBar";
import { Mono } from "../../../shared/ui/Mono";
import { useDispatcher } from "../context";
import { cx } from "../ui/cx";
import styles from "./Screen.module.css";

export type ScreenProps = {
  bar: ReactNode;
  children: ReactNode;
  /** What the screens saved, for the offline bar. `{time}` is replaced by when the screens last had a connection. */
  offlineNote?: string;
  dense?: boolean;
};

/**
 * One dispatcher screen: the app bar, an offline bar when the dispatcher's own connection is down, and
 * a workspace at most 1440 px wide. The dispatcher works on a large screen, usable at 1280 (PRD v3 section 15).
 */
export function Screen({ bar, children, offlineNote, dense }: ScreenProps) {
  const { offline, lastOnline } = useDispatcher();
  return (
    <div className={styles.app}>
      {bar}
      {offline && (
        <ConnectivityBar>
          {(offlineNote ?? "Connection lost. Showing what this screen last had.")
            .split("{time}")
            .flatMap((part, i, all) => (i < all.length - 1 ? [part, <Mono key={i}>{lastOnline}</Mono>] : [part]))}
        </ConnectivityBar>
      )}
      <main className={cx(styles.workspace, dense && styles.dense)}>{children}</main>
    </div>
  );
}
