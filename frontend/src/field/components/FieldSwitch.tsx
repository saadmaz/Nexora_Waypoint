import * as Switch from "@radix-ui/react-switch";
import styles from "./FieldSwitch.module.css";

export type FieldSwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** The accessible name when the visible label is a separate element. */
  label: string;
  id?: string;
  disabled?: boolean;
};

/**
 * The switch drawn on R1.9 and R3.1: a 56 by 32 track with a 24 px knob. Radix Switch gives it
 * role="switch", Space to toggle and the right aria-checked. The state is also the knob position,
 * not the track colour alone.
 */
export function FieldSwitch({ checked, onCheckedChange, label, id, disabled }: FieldSwitchProps) {
  return (
    <Switch.Root
      className={styles.root}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      id={id}
      disabled={disabled}
    >
      <Switch.Thumb className={styles.thumb} />
    </Switch.Root>
  );
}
