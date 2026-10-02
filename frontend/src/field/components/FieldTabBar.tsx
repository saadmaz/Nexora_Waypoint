import { Icon, type IconName } from "../../shared/ui/Icon";
import styles from "./FieldTabBar.module.css";

export type FieldTab<K extends string = string> = {
  key: K;
  label: string;
  icon: IconName;
  /** A count on the tab, for example open problems on Issues. */
  badge?: number;
};

export type FieldTabBarProps<K extends string = string> = {
  tabs: FieldTab<K>[];
  active: K;
  onSelect: (key: K) => void;
  label?: string;
};

/**
 * The driver tab bar (LIB3, R1.6): Run · Issues · History · Me, 64 px, a 3 px route bar on top of
 * the active tab. The active tab carries aria-current, so it never rests on colour alone.
 */
export function FieldTabBar<K extends string>({ tabs, active, onSelect, label = "Sections" }: FieldTabBarProps<K>) {
  return (
    <nav className={styles.bar} aria-label={label}>
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.key}
          className={[styles.tab, tab.key === active && styles.current].filter(Boolean).join(" ")}
          aria-current={tab.key === active ? "page" : undefined}
          onClick={() => onSelect(tab.key)}
        >
          <span className={styles.iconWrap}>
            <Icon name={tab.icon} size={20} />
            {tab.badge !== undefined && tab.badge > 0 && <span className={styles.badge}>{tab.badge}</span>}
          </span>
          <span className={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
