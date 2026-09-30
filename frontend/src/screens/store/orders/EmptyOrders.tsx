import { Button } from "../../../shared/ui/Button";
import { StateScreen } from "../../../shared/ui/StateScreen";

export type EmptyOrdersProps = {
  /** "Tue 29 Sep" */
  dateLabel: string;
  /** "none" is S1.5 D; "cancelled" is S1.3 D. */
  reason: "none" | "cancelled";
  onStart: () => void;
};

/** No orders for the day: S1.5 D (none yet) and S1.3 D (just cancelled). */
export function EmptyOrders({ dateLabel, reason, onStart }: EmptyOrdersProps) {
  return (
    <StateScreen
      icon="clipboard-list"
      bg="surface-2"
      fg="ink-muted"
      title={reason === "cancelled" ? `Orders cancelled for ${dateLabel}` : `No orders yet for ${dateLabel}`}
      body={reason === "cancelled" ? "You can place a new order until 16:00." : "Add chilled or dry."}
      actions={
        <Button auto onClick={onStart}>
          Start an order
        </Button>
      }
    />
  );
}
