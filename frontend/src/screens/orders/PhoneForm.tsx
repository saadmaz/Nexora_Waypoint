import type { ReactNode } from "react";
import { Icon } from "../../components/ui/Icon";
import { Mono } from "../../components/ui/Mono";
import type { OrderKind, UnitFactors } from "../../domain/order";
import { OrderCard } from "./OrderCard";
import { OrderHeader } from "./OrderHeader";
import styles from "./PhoneForm.module.css";

export type PhoneFormProps = {
  title: string;
  /** "Tue 29 Sep" */
  dateLabel: string;
  /** The alert under the header: cutoff countdown, offline warning or error. */
  notice: ReactNode;
  /** "15:38", set when the order is queued offline. */
  queuedAt?: string;
  quantities: Record<OrderKind, number>;
  factors: UnitFactors;
  onChange: (kind: OrderKind, units: number) => void;
  pendingSync?: boolean;
  disabled?: boolean;
  /** Sits under the cards: Cancel order, in the edit form. */
  footer?: ReactNode;
};

/** The phone order form: S1.1, its offline, error and sending states, and S1.3 B (edit). */
export function PhoneForm({
  title,
  dateLabel,
  notice,
  queuedAt,
  quantities,
  factors,
  onChange,
  pendingSync,
  disabled,
  footer,
}: PhoneFormProps) {
  return (
    <>
      <OrderHeader title={title} dateLabel={dateLabel} />
      {notice}
      {queuedAt && (
        <p className={styles.queued}>
          <Icon name="cloud" size={16} />
          <span>
            Queued <Mono>{queuedAt}</Mono> · sends automatically when you're back online
          </span>
        </p>
      )}
      <OrderCard
        kind="chilled"
        units={quantities.chilled}
        factors={factors}
        onChange={(units) => onChange("chilled", units)}
        {...(pendingSync ? { pendingSync: true } : {})}
        {...(disabled ? { disabled: true } : {})}
      />
      <OrderCard
        kind="dry"
        units={quantities.dry}
        factors={factors}
        onChange={(units) => onChange("dry", units)}
        {...(pendingSync ? { pendingSync: true } : {})}
        {...(disabled ? { disabled: true } : {})}
      />
      {footer}
    </>
  );
}
