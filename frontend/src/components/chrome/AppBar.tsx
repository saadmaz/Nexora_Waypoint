import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "../ui/Icon";
import styles from "./AppBar.module.css";

type NavItem = { to: string; label: string; icon: IconName };

const NAV: NavItem[] = [
  { to: "/store/orders", label: "Orders", icon: "clipboard-list" },
  { to: "/store/deliveries", label: "Deliveries", icon: "truck" },
  { to: "/store/issues", label: "Issues", icon: "alert-circle" },
];

/**
 * The desktop chrome app bar: the "Waypoint Store" mark and nav, no tab bar.
 * The mark reads Waypoint Store, never Waypoint Dispatch, per cross-role
 * fix X3: each role app names itself.
 */
export function AppBar({ right }: { right?: ReactNode }) {
  return (
    <header className={styles.appbar}>
      <span className={styles.brand}>
        <span className={styles.diamond} aria-hidden />
        <span className={styles.brandText}>Waypoint Store</span>
      </span>
      <nav className={styles.nav} aria-label="Primary">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [styles.navItem, isActive && styles.navCurrent].filter(Boolean).join(" ")
            }
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      {right && <div className={styles.side}>{right}</div>}
    </header>
  );
}
