import { Icon } from "../../shared/ui/Icon";
import styles from "./UnitsStepper.module.css";

export type UnitsStepperProps = {
  value: number;
  onChange: (next: number) => void;
  /** The count expected. Caps the stepper and is the "of 12" in the middle. */
  expected: number;
  /** What the units belong to, for the screen reader: "units of ORD2001". */
  label: string;
  /** "of": 12 of 12 (R3.1 units delivered). "slash": 0 / 12 units is a read-only line, see OrderCard. */
  disabled?: boolean;
};

/**
 * The units stepper (LIB6, R3.1, R3.4, L2.1 B): a 48 px button each side and "12 of 12" in
 * 22 px Plex Mono between them. The count never goes below 0 or above what is expected.
 */
export function UnitsStepper({ value, onChange, expected, label, disabled }: UnitsStepperProps) {
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.step}
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 0}
        aria-label={`One less, ${label}`}
      >
        <Icon name="minus" size={20} />
      </button>
      <output className={styles.value} aria-live="polite">
        {value} of {expected}
      </output>
      <button
        type="button"
        className={styles.step}
        onClick={() => onChange(Math.min(expected, value + 1))}
        disabled={disabled || value >= expected}
        aria-label={`One more, ${label}`}
      >
        <Icon name="plus" size={20} />
      </button>
    </div>
  );
}
