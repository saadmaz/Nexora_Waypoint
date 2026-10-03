import type { ReactNode } from "react";
import { Alert } from "../../../shared/ui/Alert";
import { Button } from "../../../shared/ui/Button";
import { Mono } from "../../../shared/ui/Mono";
import type { Delivery } from "../../../domain/delivery";
import { weekdayShort } from "../../../domain/format";
import { nextOperatingDayAfter } from "../../../domain/schedule";
import styles from "./ReviewNotice.module.css";

/**
 * "Why you're seeing this": the reason a store sees Under review instead of a delivery
 * status (S2.7). Stores never see the word Conflict.
 */
export function ReviewNotice({
  review,
  extra,
  icon = "info",
}: {
  review: NonNullable<Delivery["review"]>;
  /** A closing line in bold, such as S3.6's "No action needed from you." */
  extra?: string;
  /** The alert's icon: info, or store when Dispatch is asking (S3.5). */
  icon?: "info" | "store";
}) {
  return (
    <Alert tone="info" icon={icon} title={<span className={styles.whyTitle}>Why you're seeing this</span>}>
      <span className={styles.why}>
        You asked Dispatch at <Mono>{review.askedAt}</Mono> to hold today's delivery. The driver had no signal and
        delivered at <Mono>{review.deliveredAt}</Mono>, and {review.receivedBy} signed for it. Dispatch is checking
        which record to keep.
      </span>
      {extra && <strong className={styles.extra}>{extra}</strong>}
    </Alert>
  );
}

export type ReceiptQuestionProps = {
  delivery: Delivery;
  disabled?: boolean;
  onYes: () => void;
  onReport: () => void;
  /** S3.5: no heading (the page asks above), 56 px buttons and an icon on Report issue. */
  bare?: boolean;
};

/** The pinned question while a delivery is under review (S2.7): did it arrive? */
export function ReceiptQuestion({ delivery, disabled, onYes, onReport, bare }: ReceiptQuestionProps): ReactNode {
  const wed = weekdayShort(nextOperatingDayAfter(delivery.date));
  return (
    <section className={styles.question} aria-labelledby="receipt-question">
      {bare ? null : (
        <h2 className={styles.title} id="receipt-question">
          Did you receive this delivery?
        </h2>
      )}
      <div className={styles.answer}>
        <Button size={bare ? "large" : "medium"} disabled={disabled} onClick={onYes}>
          Yes, we received it
        </Button>
        <p className={styles.caption}>Dispatch keeps the delivery. No second trip on {wed}.</p>
      </div>
      <div className={styles.answer}>
        <Button
          size={bare ? "large" : "medium"}
          variant="secondary"
          {...(bare ? { icon: "alert-circle" as const } : {})}
          disabled={disabled}
          onClick={onReport}
        >
          Report issue
        </Button>
        <p className={styles.caption}>Tell Dispatch what's wrong with what arrived.</p>
      </div>
    </section>
  );
}
