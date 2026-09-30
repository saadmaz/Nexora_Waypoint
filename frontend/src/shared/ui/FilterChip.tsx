import type { ReactNode } from "react";
import styles from "./FilterChip.module.css";

export type FilterChipProps = {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
};

/** A filter pill (All, Deferred, Partial on S4's History). Filled when selected; aria-pressed carries the state. */
export function FilterChip({ selected, onSelect, children }: FilterChipProps) {
  return (
    <button
      type="button"
      className={[styles.chip, selected && styles.selected].filter(Boolean).join(" ")}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}
