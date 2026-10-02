import { Icon } from "../../shared/ui/Icon";
import styles from "./ChoiceChips.module.css";

export type ChoiceOption<K extends string = string> = {
  key: K;
  label: string;
  /** The language of the label, so a screen reader and the font stack pick the right script. */
  lang?: string;
};

export type ChoiceChipsProps<K extends string = string> = {
  options: ChoiceOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /** The name of the group, for example "Text size". */
  label: string;
  /** Share the row equally (Text size) or size each chip to its label (Language). */
  fill?: boolean;
};

/**
 * The segmented control drawn on R1.9 for Text size and Language: 44 px chips, the chosen one
 * with a tick, a 2 px route border and the soft route fill. Radio semantics: one is always chosen.
 */
export function ChoiceChips<K extends string>({ options, value, onChange, label, fill }: ChoiceChipsProps<K>) {
  return (
    <div className={styles.row} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const chosen = option.key === value;
        return (
          <button
            type="button"
            key={option.key}
            role="radio"
            aria-checked={chosen}
            lang={option.lang}
            className={[styles.chip, chosen && styles.chosen, fill && styles.fill].filter(Boolean).join(" ")}
            onClick={() => onChange(option.key)}
          >
            {chosen && <Icon name="check" size={16} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
