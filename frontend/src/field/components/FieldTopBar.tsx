import type { ReactNode } from "react";
import { Icon } from "../../shared/ui/Icon";
import styles from "./FieldTopBar.module.css";

export type FieldTopBarProps = {
  title: ReactNode;
  /** The line under the title, for example "Kandy dock · 04:14". Wrap IDs and times in <Mono>. */
  subtitle?: ReactNode;
  /** Shows the 44 px back button when given. */
  onBack?: () => void;
  backLabel?: string;
  /** Right side: the connectivity chip, the notification bell. */
  children?: ReactNode;
};

/**
 * The phone top bar on chrome (LIB3, R1.6, R3.1, L1.2 A): title and subtitle on the left, the
 * connectivity chip and the bell on the right. 56 px tall. The back button sits at 4 px so its
 * 44 px target lines up with the 16 px gutter.
 */
export function FieldTopBar({ title, subtitle, onBack, backLabel = "Back", children }: FieldTopBarProps) {
  return (
    <header className={[styles.bar, onBack && styles.withBack].filter(Boolean).join(" ")}>
      {onBack && (
        <button type="button" className={styles.back} onClick={onBack} aria-label={backLabel}>
          <Icon name="chevron-left" size={24} />
        </button>
      )}
      <div className={styles.titles}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {children && <div className={styles.right}>{children}</div>}
    </header>
  );
}
