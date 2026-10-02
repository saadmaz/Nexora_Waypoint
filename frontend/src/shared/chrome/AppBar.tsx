import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { BellButton, type BellProps } from "./BellButton";
import styles from "./AppBar.module.css";

type NavItem = { to: string; label: string };

const NAV: NavItem[] = [
  { to: "/store/orders", label: "Orders" },
  { to: "/store/deliveries", label: "Deliveries" },
  { to: "/store/issues", label: "Issues" },
];

/**
 * The desktop chrome app bar: the "Waypoint Store" mark and nav, no tab bar.
 * The mark reads Waypoint Store, never Waypoint Dispatch, per cross-role
 * fix X3: each role app names itself.
 */
export function AppBar({ right, bell }: { right?: ReactNode; bell?: BellProps }) {
  return (
    <header className={styles.appbar}>
      <span className={styles.brand}>
        <img className={styles.diamond} src="/nexora-logo.svg" alt="" aria-hidden="true" />
        <span className={styles.brandText}>
          <strong>Waypoint</strong> Store
        </span>
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
            {item.label}
          </NavLink>
        ))}
      </nav>
      {(right || bell) && (
        <div className={styles.side}>
          {bell && <BellButton {...bell} />}
          {right}
        </div>
      )}
    </header>
  );
}
