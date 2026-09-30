import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { cx } from "./cx";
import styles from "./Checkbox.module.css";

export type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
  /** The box shows a cross: this choice is refused (D8.3 protected order). */
  refused?: boolean;
  disabled?: boolean;
};

/** A native checkbox drawn as the design's square, so the keyboard and screen readers get a real control. */
export function Checkbox({ checked, onChange, children, refused, disabled }: CheckboxProps) {
  return (
    <label className={cx(styles.label, disabled && styles.disabled)}>
      <input
        className={styles.input}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={cx(styles.box, checked && styles.checked, refused && styles.refused)} aria-hidden>
        {refused ? <X size={14} strokeWidth={3} /> : checked ? <Check size={14} strokeWidth={3} /> : null}
      </span>
      {children}
    </label>
  );
}
