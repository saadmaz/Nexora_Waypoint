import { Link } from "react-router-dom";
import { Icon } from "../ui/Icon";
import styles from "./BellButton.module.css";

export type BellProps = {
  /** Unread updates. A count above zero shows the dot; zero or absent shows a plain bell. */
  unread?: number;
};

/**
 * The Updates bell: the entry point to S4 (Updates and history), which is not a
 * tab bar item. Lives in the shared top bar and app bar so every store screen
 * can offer it. The unread dot carries the count as a number, never colour alone.
 */
export function BellButton({ unread = 0 }: BellProps) {
  const label = unread > 0 ? `Updates, ${unread} unread` : "Updates";
  return (
    <Link to="/store/updates" className={styles.bell} aria-label={label}>
      <Icon name="bell" size={24} />
      {unread > 0 && (
        <span className={styles.dot} aria-hidden>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
