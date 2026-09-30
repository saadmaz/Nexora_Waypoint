import { Alert } from "../../components/ui/Alert";
import { Mono } from "../../components/ui/Mono";
import { StatusPill } from "../../components/ui/StatusPill";
import { Tag } from "../../components/ui/Tag";
import type { Delivery } from "../../domain/delivery";
import styles from "./DeferralView.module.css";

/** "12:00" style times inside a sentence: wraps every HH:MM in Mono. */
function withTimes(text: string) {
  return text.split(/(\b\d{2}:\d{2}\b)/).map((part, i) => (/^\d{2}:\d{2}$/.test(part) ? <Mono key={i}>{part}</Mono> : part));
}

/**
 * The deferral notice (S2.6 store request, S2.9 policy): what was decided, its reason, who
 * decided and when, and the next run. Never blames the store and never says Conflict.
 */
export function DeferralView({ delivery }: { delivery: Delivery }) {
  const deferral = delivery.deferral;
  if (!deferral) return null;

  const kinds = new Set(delivery.orders.map((order) => order.kind));
  const ids = delivery.orders.map((order) => order.id);

  return (
    <>
      <Alert tone="warning" icon="calendar-clock" title={deferral.headline}>
        {deferral.subline && <span className={styles.subline}>{deferral.subline}</span>}
      </Alert>
      <section className={styles.card} aria-label="Deferred delivery">
        <div className={styles.tags}>
          <Tag kind="fresh">Fresh</Tag>
          {kinds.has("chilled") && <Tag kind="chilled">Chilled</Tag>}
          {kinds.has("dry") && <Tag kind="ambient">Ambient</Tag>}
        </div>
        <p className={styles.ids}>
          {ids.map((id, i) => (
            <span key={id}>
              {i > 0 && " · "}
              <Mono>{id}</Mono>
            </span>
          ))}
        </p>
        <StatusPill status="Deferred" deferral={{ type: deferral.type, nextRunShort: deferral.nextRunShort }} />
        {deferral.explanation && <p className={styles.explanation}>{deferral.explanation}</p>}
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Reason</dt>
            <dd>{withTimes(deferral.reason)}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Decided by</dt>
            <dd>
              {deferral.decidedBy} · <Mono>{deferral.decidedAt}</Mono>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>{deferral.nextRunLabel}</dt>
            <dd>{withTimes(deferral.nextRun)}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
