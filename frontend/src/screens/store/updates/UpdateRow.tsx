import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { MonoText } from "../../../shared/ui/MonoText";
import { Tag, type TagKind } from "../../../shared/ui/Tag";
import type { StoreUpdate, UpdateTag } from "../../../domain/update";
import styles from "./UpdateRow.module.css";

/** The tag's look: Order neutral, Plan info, Delivery green, Deferral amber, Review outlined amber. */
const TAG_KIND: Record<UpdateTag, TagKind> = {
  Order: "ambient",
  Plan: "info",
  Delivery: "success",
  Deferral: "warn",
  Review: "review",
};

export type UpdateRowProps = {
  update: StoreUpdate;
  onView: () => void;
};

/**
 * One update: its tag, time, title and one-line body, and View, which opens the matching S1 or
 * S2 state. Unread rows carry a dot and a tint; a settled review says "Resolved 06:44".
 */
export function UpdateRow({ update, onView }: UpdateRowProps) {
  const viewLabel = update.viewLabel ?? "View";
  return (
    <li className={[styles.row, update.unread && styles.unread].filter(Boolean).join(" ")}>
      <div className={styles.top}>
        <span className={styles.meta}>
          {update.unread && <span className={styles.dot} role="img" aria-label="Unread" />}
          <Tag kind={TAG_KIND[update.tag]} icon={null}>
            {update.tag}
          </Tag>
          <span className={styles.time}>
            <Mono>{update.time}</Mono>
          </span>
        </span>
        <button type="button" className={styles.view} onClick={onView} aria-label={`${viewLabel}: ${update.title}`}>
          {viewLabel}
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
      <h3 className={styles.title}>{update.title}</h3>
      <p className={styles.body}>
        <MonoText>{update.body}</MonoText>
      </p>
      {update.resolvedAt && (
        <span className={styles.resolved}>
          Resolved <Mono>{update.resolvedAt}</Mono>
        </span>
      )}
    </li>
  );
}
