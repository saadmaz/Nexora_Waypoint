import { Icon } from "../../shared/ui/Icon";
import styles from "./NotificationBell.module.css";

export type NotificationBellProps = {
  /** Unread count. Zero draws the plain bell. */
  count?: number;
  onClick?: () => void;
  label?: string;
};

/** The 44 px bell on the driver's top bar (R1.6, R3.1). The count is a number, never a bare dot. */
export function NotificationBell({ count = 0, onClick, label = "Notifications" }: NotificationBellProps) {
  const aria = count > 0 ? `${label}, ${count} unread` : label;
  return (
    <button type="button" className={styles.bell} onClick={onClick} aria-label={aria}>
      <Icon name="bell" size={22} />
      {count > 0 && <span className={styles.count}>{count}</span>}
    </button>
  );
}
