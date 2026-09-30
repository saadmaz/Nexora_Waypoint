import { useId } from "react";
import { Icon } from "./Icon";
import styles from "./UnitStepper.module.css";

export type UnitStepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** What the units are counted in, for the screen reader label. */
  label: string;
  /** On the receipt, the count expected: "/ 12" beside the stepper. Lowering the count below it is a shortfall. */
  expected?: number;
  disabled?: boolean;
  /** 44 px buttons and a narrower count, for a row that also carries a tag and a status (S3.1). */
  compact?: boolean;
};

/**
 * A unit stepper. Used on S1 to choose order quantities and on S3 to count what
 * actually arrived, where lowering the count turns the main button into
 * "Confirm with a shortfall".
 */
export function UnitStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  label,
  expected,
  disabled,
  compact,
}: UnitStepperProps) {
  const valueId = useId();
  const isShortfall = expected !== undefined && value < expected;

  return (
    <span className={styles.wrap}>
      <span className={[styles.stepper, compact && styles.compact].filter(Boolean).join(" ")}>
        <button
          type="button"
          className={styles.step}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={disabled || value <= min}
          aria-label={`Remove one ${label}`}
        >
          <Icon name="minus" size={20} />
        </button>
        <output className={styles.value} id={valueId} aria-live="polite">
          {value}
        </output>
        <button
          type="button"
          className={styles.step}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={disabled || value >= max}
          aria-label={`Add one ${label}`}
        >
          <Icon name="plus" size={20} />
        </button>
      </span>
      {expected !== undefined && (
        <span className={styles.expected}>
          / {expected}
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            {isShortfall ? ` ${label} expected, a shortfall` : ` ${label} expected`}
          </span>
        </span>
      )}
    </span>
  );
}
