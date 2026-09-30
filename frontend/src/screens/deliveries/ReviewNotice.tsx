import type { ReactNode } from "react";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Mono } from "../../components/ui/Mono";
import type { Delivery } from "../../domain/delivery";
import { weekdayShort } from "../../domain/format";
import { nextOperatingDayAfter } from "../../domain/schedule";
import styles from "./ReviewNotice.module.css";

/**
 * "Why you're seeing this": the reason a store sees Under review instead of a delivery
 * status (S2.7). Stores never see the word Conflict.
 */
export function ReviewNotice({ review }: { review: NonNullable<Delivery["review"]> }) {
  return (
    <Alert tone="info" icon="info" title={<span className={styles.whyTitle}>Why you're seeing this</span>}>
      <span className={styles.why}>
        You asked Dispatch at <Mono>{review.askedAt}</Mono> to hold today's delivery. The driver had no signal and
        delivered at <Mono>{review.deliveredAt}</Mono>, and {review.receivedBy} signed for it. Dispatch is checking
        which record to keep.
      </span>
    </Alert>
  );
}

export type ReceiptQuestionProps = {
  delivery: Delivery;
  disabled?: boolean;
  onYes: () => void;
  onReport: () => void;
};

/** The pinned question while a delivery is under review (S2.7): did it arrive? */
export function ReceiptQuestion({ delivery, disabled, onYes, onReport }: ReceiptQuestionProps): ReactNode {
  const wed = weekdayShort(nextOperatingDayAfter(delivery.date));
  return (
    <section className={styles.question} aria-labelledby="receipt-question">
      <h2 className={styles.title} id="receipt-question">
        Did you receive this delivery?
      </h2>
      <div className={styles.answer}>
        <Button size="medium" disabled={disabled} onClick={onYes}>
          Yes, we received it
        </Button>
        <p className={styles.caption}>Dispatch keeps the delivery. No second trip on {wed}.</p>
      </div>
      <div className={styles.answer}>
        <Button size="medium" variant="secondary" disabled={disabled} onClick={onReport}>
          Report issue
        </Button>
        <p className={styles.caption}>Tell Dispatch what's wrong with what arrived.</p>
      </div>
    </section>
  );
}
