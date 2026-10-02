import type { ReactNode } from "react";
import { Check, ChevronDown, CircleAlert, Clock3, CloudOff, Redo2, RefreshCw, WifiOff } from "lucide-react";
import type { DeferralCard as Card, StoreNotice } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { Btn, LinkButton } from "../ui/Btn";
import { BrandChip, Chip, TempChip } from "../ui/Chip";
import { cx } from "../ui/cx";
import styles from "./Deferrals.module.css";

/** "Deferred · policy → Wed": the type and the next run, the one label every role uses for a deferral. */
export function DeferredChip({ kind, nextRun = "Wed" }: { kind: Card["kind"]; nextRun?: string }) {
  return (
    <Chip tone="dashed" small icon={<Redo2 size={13} />}>
      Deferred · {kind} → {nextRun}
    </Chip>
  );
}

/** What the store was told and whether it has seen it: a state, never a score. */
export function NoticeState({ notice, offline }: { notice: StoreNotice; offline?: boolean }) {
  if (notice.state === "seen") {
    return (
      <span className={styles.seen}>
        <Check size={14} />
        Seen <Mono>{notice.at}</Mono>
      </span>
    );
  }
  if (notice.state === "sent") {
    return (
      <span className={styles.sent}>
        <Clock3 size={14} />
        Sent <Mono>{notice.at}</Mono> · {notice.note ?? "not yet seen"}
      </span>
    );
  }
  if (offline) {
    return (
      <Chip tone="offline" pill icon={<CloudOff size={14} />}>
        Queued · sends on reconnect
      </Chip>
    );
  }
  return <span>Not sent</span>;
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.cell}>
      <span className={styles.cellLabel}>{label}</span>
      {children}
    </div>
  );
}

export type DeferralCardProps = {
  card: Card;
  expanded: boolean;
  onToggle: () => void;
  onDetail: () => void;
  onServe: () => void;
  readOnly: boolean;
  offline: boolean;
  /** A failed notice under the card (design D4 error state). */
  noticeFailed?: { onRetry: () => void };
};

/** One deferred order. Collapsed it is a line; expanded it says why, who decided, what the store was told, and what it frees. */
export function DeferralCard({ card, expanded, onToggle, onDetail, onServe, readOnly, offline, noticeFailed }: DeferralCardProps) {
  const ids = [card.orderId, ...(card.pairedOrderIds ?? [])];
  const head = (
    <div className={styles.cardHead}>
      <button type="button" className={styles.toggle} aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} ${card.orderId}`} onClick={onToggle}>
        <ChevronDown size={15} className={cx(styles.chev, expanded && styles.chevOpen)} />
      </button>
      <BrandChip brand={card.brand} small />
      {card.pairedOrderIds ? <TempChip temp="chilled" small /> : <TempChip temp={card.temp} small />}
      {card.pairedOrderIds && (
        <Chip tone="ambient" small>
          Ambient
        </Chip>
      )}
      {card.access
        .filter((a) => a !== "Ambient")
        .map((a) => (
          <Chip key={a} tone="outlineInk" small>
            {a}
          </Chip>
        ))}
      <Mono>
        <span className={styles.ids}>
          {ids.join(" · ")}
          {card.outletId && !card.pairedOrderIds ? ` · ${card.outletId}` : card.pairedOrderIds ? ` · ${card.outletId}` : ""}
        </span>
      </Mono>
      {!expanded && <span className={styles.line}>{card.line}</span>}
      <span className={styles.headRight}>
        {!expanded && card.storeTold.state === "seen" && <NoticeState notice={card.storeTold} />}
        {!expanded && card.storeTold.state === "sent" && card.storeTold.note === "not yet seen" && (
          <span className={styles.sentShort}>
            <Clock3 size={14} /> Sent · not yet seen
          </span>
        )}
        {card.newInVersion && (
          <Chip tone="signal" small>
            New in v{card.newInVersion}
          </Chip>
        )}
        <DeferredChip kind={card.kind} />
      </span>
    </div>
  );

  if (!expanded) return <div className={styles.collapsed}>{head}</div>;

  return (
    <div className={styles.expanded}>
      {head}
      <h3 className={styles.title}>{card.title}</h3>
      <div className={styles.grid}>
        <Cell label="Reason">
          <b className={styles.value}>{card.reason.headline}</b>
          <span className={styles.small}>{card.reason.detail}</span>
        </Cell>
        <Cell label="Decided by">
          <span className={styles.value}>{card.decidedBy}</span>
        </Cell>
        <Cell label="Store told">
          <span className={styles.value}>
            <NoticeState notice={card.storeTold} offline={offline} />
          </span>
        </Cell>
        <Cell label="Impact on store">
          <span className={styles.value}>{card.impact}</span>
        </Cell>
        <Cell label="Frees">
          <span className={styles.value}>{card.frees}</span>
        </Cell>
        <Cell label="Next run">
          <span className={styles.value}>{card.nextRun}</span>
        </Cell>
      </div>
      <div className={styles.cardFoot}>
        <Chip tone="outlineInk" small>
          Binding: {card.binding}
        </Chip>
        <span className={styles.footActions}>
          <LinkButton onClick={onDetail}>Details</LinkButton>
          {!readOnly && card.kind !== "capacity" && <LinkButton onClick={onServe}>Serve instead…</LinkButton>}
        </span>
      </div>
      {card.footnote && (
        <div className={cx(styles.footnote, card.footnote.tone === "warn" && styles.footWarn)}>
          {card.footnote.tone === "warn" ? <WifiOff size={16} /> : <RefreshCw size={15} />}
          {card.footnote.text}
        </div>
      )}
      {noticeFailed && (
        <div className={styles.noticeFailed}>
          <CircleAlert size={18} />
          <span>Notice to {card.outletId} failed, the deferral is saved.</span>
          <Btn variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={noticeFailed.onRetry}>
            Retry
          </Btn>
        </div>
      )}
    </div>
  );
}
