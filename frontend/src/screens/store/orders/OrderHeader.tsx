import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { OUTLET, WINDOW_LABEL } from "../../../domain/outlet";
import styles from "./OrderHeader.module.css";

export type OrderHeaderProps = {
  title: string;
  /** "Tue 29 Sep". Omit on S1.4, which has no date chip. */
  dateLabel?: string;
  /** Desktop (S1.6): the window sits on the chip's row instead of under it. */
  inline?: boolean;
};

/** Title, date chip and window line shared by the order form, edit and desktop frames. */
export function OrderHeader({ title, dateLabel, inline }: OrderHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {dateLabel && (
        <div className={styles.row}>
          <span className={styles.chip}>
            <Icon name="calendar" size={16} />
            {dateLabel}
          </span>
          <span className={styles.muted}>
            Next operating day
            {inline && (
              <>
                {" "}
                · window <Mono>{WINDOW_LABEL}</Mono> · {OUTLET.dock}
              </>
            )}
          </span>
        </div>
      )}
      {dateLabel && !inline && (
        <p className={styles.muted}>
          Window <Mono>{WINDOW_LABEL}</Mono> · {OUTLET.dock}
        </p>
      )}
    </div>
  );
}
