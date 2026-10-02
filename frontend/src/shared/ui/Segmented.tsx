import styles from "./Segmented.module.css";

export type SegmentedOption = { label: string; selected: boolean; onSelect: () => void };

/**
 * A two-way switch between views of one screen, such as Updates and History (S4). The selected
 * segment is a raised white pill; each button carries aria-pressed, so the state never rests
 * on the fill alone.
 */
export function Segmented({ options, label }: { options: SegmentedOption[]; label: string }) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.label}
          className={[styles.segment, option.selected && styles.selected].filter(Boolean).join(" ")}
          aria-pressed={option.selected}
          onClick={option.onSelect}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
