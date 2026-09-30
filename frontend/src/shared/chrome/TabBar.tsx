import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "../ui/Icon";
import styles from "./TabBar.module.css";

type Tab = { to: string; label: string; icon: IconName };

/** Orders · Deliveries · Issues (PRD v2 section 3, store). */
const TABS: Tab[] = [
  { to: "/store/orders", label: "Orders", icon: "clipboard-list" },
  { to: "/store/deliveries", label: "Deliveries", icon: "truck" },
  { to: "/store/issues", label: "Issues", icon: "alert-circle" },
];

/**
 * The phone tab bar, 64 px. Desktop uses the app bar instead.
 * NavLink sets aria-current="page" on the active tab by itself.
 */
export function TabBar() {
  return (
    <nav className={styles.tabbar} aria-label="Sections">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            [styles.tab, isActive && styles.current].filter(Boolean).join(" ")
          }
        >
          <Icon name={tab.icon} size={20} />
          <span className={styles.label}>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
