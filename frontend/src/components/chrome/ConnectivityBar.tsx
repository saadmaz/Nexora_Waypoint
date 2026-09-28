import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";
import styles from "./ConnectivityBar.module.css";

/**
 * The store's own connectivity, shown as a bar under the top bar.
 * The driver being out of coverage is a muted line on the delivery card
 * instead, never an alert box.
 */
export function ConnectivityBar({ children }: { children: ReactNode }) {
  return (
    <div className={styles.bar} role="status">
      <Icon name="wifi-off" size={16} />
      {children}
    </div>
  );
}
