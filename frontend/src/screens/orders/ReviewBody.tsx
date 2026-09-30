import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Mono } from "../../components/ui/Mono";
import { Tag } from "../../components/ui/Tag";
import type { OrderKind } from "../../domain/order";
import { unitsLabel } from "../../domain/estimate";
import { OUTLET, WINDOW_LABEL } from "../../domain/outlet";
import styles from "./ReviewBody.module.css";

export type ReviewLine = { kind: OrderKind; units: number };

export type ReviewBodyProps = {
  lines: ReviewLine[];
  dateLabel: string;
  onEdit: () => void;
  onConfirm: () => void;
};

/** The content of S1.2 (phone sheet) and S1.6 B (desktop modal): "Check your orders". */
export function ReviewBody({ lines, dateLabel, onEdit, onConfirm }: ReviewBodyProps) {
  return (
    <div className={styles.body}>
      <ul className={styles.list}>
        {lines.map((line) => (
          <li className={styles.row} key={line.kind}>
            {line.kind === "chilled" ? <Tag kind="chilled">Chilled</Tag> : <Tag kind="ambient">Ambient</Tag>}
            <span className={styles.name}>{line.kind === "chilled" ? "Chilled" : "Dry"}</span>
            <Mono>{unitsLabel(line.units)}</Mono>
          </li>
        ))}
      </ul>
      <p className={styles.when}>
        <Icon name="calendar" size={20} />
        <span>
          {dateLabel} · window <Mono>{WINDOW_LABEL}</Mono> · {OUTLET.dock}
        </span>
      </p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <Button onClick={onConfirm}>Place orders</Button>
      </div>
    </div>
  );
}
