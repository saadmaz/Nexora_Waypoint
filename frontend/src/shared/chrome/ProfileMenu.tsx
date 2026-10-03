import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../ui/Icon";
import styles from "./ProfileMenu.module.css";

export type ProfileMenuProps = {
  /** "Kumari". The circle shows its first letter. */
  name: string;
  /** "Dispatcher". Shown after the name at the top of the menu. */
  roleLabel: string;
  onLogOut: () => void;
  /** Role-specific items above Log out, such as the dispatcher's Presenter control. */
  children?: ReactNode;
};

/**
 * The profile circle at the top right of a web app bar, and its menu. Log out is always the last
 * item. Closes on a click outside or Escape.
 */
export function ProfileMenu({ name, roleLabel, onLogOut, children }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={ref}>
      <button type="button" className={styles.avatar} aria-label={name} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {name.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.menuName}>
            {name} · {roleLabel}
          </div>
          {children}
          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogOut();
            }}
          >
            <Icon name="log-out" size={16} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
