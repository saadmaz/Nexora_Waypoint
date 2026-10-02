import type { ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { formatTime } from "../../../field/clock/clock";
import { useNow } from "../../../field/clock/useClock";
import { PinnedActionBar } from "../../../field/components";
import { connectivity as connectivityStore, useConnectivity, useOutbox, type ConnectivitySnapshot } from "../../../field/offline";
import { Button } from "../../../shared/ui/Button";
import { Facts } from "../../../shared/ui/Facts";
import { Icon, type IconName } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { MonoText } from "../../../shared/ui/MonoText";
import { useT } from "../context/DriverContext";
import { useDriverRun } from "../context/useDriverRun";
import { RUN_DATE } from "../fixtures";
import { outboxRows, summarise, type OutboxRow } from "../outbox/outboxModel";
import { RecordPill } from "../outbox/RecordPill";
import { StatusBar } from "../outbox/StatusBar";
import { usePhotoState } from "./usePhotoState";
import { DriverShell } from "../shell/DriverShell";
import styles from "./SyncResultScreen.module.css";
import type { SyncViewKind } from "./syncView";

/** What the failed-sync screen quotes (R5.S 2). The mock has one reference for every failed send. */
export const SYNC_FAILURE_REFERENCE = "WP-SYNC-409";

export type SyncResultScreenProps = {
  /** The state gallery only; see `DriverShellProps.connectivityOverride`. */
  connectivityOverride?: ConnectivitySnapshot;
  /** The state gallery only: the frame to draw, instead of reading `?view=`. */
  viewOverride?: { kind: SyncViewKind | "empty"; outletId?: string };
  /** The state gallery only: the Outbox rows, instead of the phone's own outbox. */
  rowsOverride?: OutboxRow[];
};

type Mode = "loading" | "offline" | "failed" | SyncViewKind | "empty";

/** Orders of one stop that Dispatch is reviewing, shown as one row: "Delivered ORD2001 + ORD2002". */
type ListItem = { key: string; label: ReactNode; state: OutboxRow["state"]; note?: ReactNode; pillLabel?: string };

function plural(count: number, one: string, many: string, t: ReturnType<typeof useT>): string {
  return count === 1 ? t(one) : t(many, { count });
}

/**
 * R5 Sync result (driver prompt 4 section 5): says plainly how the run stands after a sync. One
 * screen, seven frames: what went out and what went to Dispatch (R5.1), everything synced (R5.2),
 * Dispatch's decision (R5.3), and the offline-again, failed, empty and loading states (R5.S).
 * Every count is read from the same rows the Outbox shows, so the two can never disagree.
 */
export function SyncResultScreen({ connectivityOverride, viewOverride, rowsOverride }: SyncResultScreenProps = {}) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const liveConnectivity = useConnectivity();
  const connectivity = connectivityOverride ?? liveConnectivity;
  const now = useNow();
  const records = useOutbox();
  const { run } = useDriverRun(RUN_DATE);
  const photos = usePhotoState(run);

  const requested = viewOverride?.kind ?? (params.get("view") as SyncViewKind | null) ?? "empty";
  const clientIds = (location.state as { clientIds?: string[] } | null)?.clientIds ?? [];
  const stops = run?.stops ?? [];
  const resolvedStops = new Set(stops.filter((stop) => stop.resolution).map((stop) => stop.outletId));
  const allRows = rowsOverride ?? outboxRows(records, resolvedStops);
  const scoped = clientIds.length > 0 && !rowsOverride ? outboxRows(records.filter((r) => clientIds.includes(r.clientId)), resolvedStops) : allRows;
  const rows = requested === "synced" || requested === "conflict" ? scoped : allRows;

  const outletId = viewOverride?.outletId ?? params.get("stop") ?? stops.find((s) => s.resolution)?.outletId ?? stops.find((s) => s.conflict)?.outletId;
  const stop = stops.find((s) => s.outletId === outletId);

  const waiting = connectivity.waitingCount;
  const mode: Mode =
    connectivity.status === "syncing"
      ? "loading"
      : connectivity.status === "offline" && waiting > 0
        ? "offline"
        : // A photo that would not send is the run's alert (R8.2), not a failed sync: its records got through.
          connectivity.status === "failed" && photos.failures.length === 0
          ? "failed"
          : requested;

  const back = () => navigate("/driver/run");
  const subtitle = <MonoText>{t("sync.subtitle", { runNo: run?.runNo ?? 1, vehicleId: run?.vehicle.id ?? "VEH039" })}</MonoText>;
  const lastSync = formatTime(connectivity.lastSyncAt ?? now);

  const thumb = (
    <PinnedActionBar tone="plain">
      <Button icon="chevron-left" onClick={back}>
        {t("sync.backToRun")}
      </Button>
    </PinnedActionBar>
  );

  const shell = (props: { banner?: ReactNode; pinned?: ReactNode; chip?: { status: "synced" | "failed" | "online"; time?: string }; children: ReactNode }) => (
    <DriverShell
      title={t("sync.title")}
      subtitle={subtitle}
      onBack={back}
      banner={props.banner}
      pinned={props.pinned}
      chip={props.chip}
      connectivityOverride={connectivityOverride}
    >
      {props.children}
    </DriverShell>
  );

  if (mode === "loading") {
    return shell({
      banner: <StatusBar tone="syncing">{t("sync.syncing")}</StatusBar>,
      children: (
        <div className={styles.content}>
          <Tile icon="refresh-cw" tone="route" />
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonLine} />
          <div className={styles.card}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.skeletonRow}>
                <div className={styles.skeletonText} />
                <div className={styles.skeletonPill} />
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  if (mode === "offline") {
    return shell({
      banner: <StatusBar tone="offline">{t("sync.offlineBar", { count: waiting })}</StatusBar>,
      pinned: thumb,
      children: (
        <div className={styles.content}>
          <Tile icon="cloud" tone="neutral" />
          <h2 className={styles.title}>{plural(waiting, "sync.offlineTitleOne", "sync.offlineTitle", t)}</h2>
          <p className={styles.body}>{t("sync.offlineBody")}</p>
          <p className={styles.muted}>{t("sync.offlineHint")}</p>
        </div>
      ),
    });
  }

  if (mode === "failed") {
    const failedAt = formatTime(connectivity.lastFailureAt ?? now);
    return shell({
      chip: { status: "failed", time: failedAt },
      children: (
        <div className={styles.content}>
          <Tile icon="alert-circle" tone="danger" />
          <h2 className={styles.title}>{t("sync.failedTitle")}</h2>
          <p className={styles.body}>{t("sync.failedBody")}</p>
          <p className={styles.muted}>{t("sync.failedHint")}</p>
          <div className={styles.actions}>
            <Button icon="refresh-cw" onClick={() => void connectivityStore.sendNow()}>
              {t("sync.tryAgain")}
            </Button>
            {/* The dataset has no dispatch desk number and none is invented, so this has no action yet (the same as "Call store"). */}
            <button type="button" className={styles.callButton}>
              <Icon name="phone" size={20} />
              <span className={styles.callLabel}>
                <span className={styles.callTitle}>{t("run.callDispatch")}</span>
                <span className={styles.callSub}>{t("run.dispatchDesk")}</span>
              </span>
            </button>
          </div>
          <p className={styles.reference}>
            <MonoText>{t("sync.ref", { reference: SYNC_FAILURE_REFERENCE, time: failedAt })}</MonoText>
          </p>
        </div>
      ),
    });
  }

  if (mode === "empty") {
    return shell({
      chip: undefined,
      children: (
        <div className={[styles.content, styles.centred].join(" ")}>
          <Tile icon="check" tone="neutral" />
          <h2 className={styles.title}>{t("sync.emptyTitle")}</h2>
          <p className={styles.mutedBody}>{t("sync.emptyBody")}</p>
          <Button icon="chevron-left" onClick={back}>
            {t("sync.backToRun")}
          </Button>
        </div>
      ),
    });
  }

  if (mode === "synced") {
    const sent = rows.filter((row) => row.state === "synced");
    return shell({
      pinned: thumb,
      children: (
        <div className={styles.content}>
          <Tile icon="check" tone="success" />
          <h2 className={styles.title}>{t("sync.allSynced", { count: sent.length })}</h2>
          <p className={styles.mutedBody}>{t("sync.allSyncedBody")}</p>
          <RecordList items={sent.map((row) => ({ key: row.clientId, label: <RowText row={row} t={t} />, state: row.state }))} />
        </div>
      ),
    });
  }

  if (mode === "conflict") {
    const synced = rows.filter((row) => row.state === "synced");
    const review = rows.filter((row) => row.state === "review");
    const detail = stop?.conflict;
    const reviewSummary = summarise(rows);
    const items: ListItem[] = synced.map((row) => ({ key: row.clientId, label: <RowText row={row} t={t} />, state: row.state }));
    for (const group of groupByStop(review)) {
      items.push({
        key: `review-${group.groupKey}`,
        label: <RowGroupText rows={group.rows} />,
        state: "review",
        note: detail ? <MonoText>{t("sync.groupNote", { time: detail.changedAt })}</MonoText> : undefined,
      });
    }
    return shell({
      chip: { status: "synced", time: lastSync },
      pinned: thumb,
      children: (
        <div className={styles.content}>
          <Tile icon="refresh-cw" tone="review" />
          <h2 className={styles.title}>
            {t("sync.headlineConflict", {
              synced: synced.length,
              stops: plural(reviewSummary.reviewStops, "outbox.stopsOne", "outbox.stopsMany", t),
              orders: plural(reviewSummary.reviewOrders, "outbox.ordersOne", "outbox.ordersMany", t),
            })}
          </h2>
          {detail && stop && (
            <p className={styles.bodyInk}>
              <MonoText>{t("sync.conflictBody", { outletId: stop.outletId, time: detail.changedAt })}</MonoText>
            </p>
          )}
          <Facts
            ruled
            items={[
              { key: t("sync.factSynced"), value: <Mono>{synced.length}</Mono> },
              {
                key: t("sync.factReview"),
                value: (
                  <>
                    <Mono>{reviewSummary.reviewOrders}</Mono> {plural(reviewSummary.reviewOrders, "sync.ordersWordOne", "sync.ordersWord", t)}
                  </>
                ),
              },
              { key: t("sync.factLastSync"), value: <Mono>{lastSync}</Mono> },
            ]}
          />
          <p className={styles.label}>{t("sync.records")}</p>
          <RecordList items={items} />
          {detail && (
            <>
              <p className={styles.label}>{t("sync.whoKnows")}</p>
              <WhoKnows name={detail.changedBy} time={lastSync} t={t} />
            </>
          )}
        </div>
      ),
    });
  }

  // resolved (R5.3)
  const resolution = stop?.resolution;
  const partial = resolution?.decision === "keep_partial";
  const resolvedRows = stop ? stop.orders.map((order) => ({ key: order.id, label: <>{t("outbox.delivered")} <Mono>{order.id}</Mono></> })) : [];
  return shell({
    chip: resolution ? { status: "synced", time: resolution.at } : undefined,
    pinned: thumb,
    children: (
      <div className={styles.content}>
        <Tile icon="check" tone="success" />
        {stop && resolution ? (
          <>
            <h2 className={styles.title}>
              <MonoText>{t(partial ? "sync.resolvedPartialTitle" : "sync.resolvedTitle", { outletId: stop.outletId })}</MonoText>
            </h2>
            <p className={styles.bodyInk}>
              <MonoText>{t(partial ? "sync.resolvedPartialBody" : "sync.resolvedBody", { outletId: stop.outletId, time: resolution.at })}</MonoText>
            </p>
            <RecordList
              items={resolvedRows.map((row) => ({ ...row, state: "synced" as const, pillLabel: partial ? t("sync.pillPartial") : t("sync.pillDelivered") }))}
            />
            <p className={styles.label}>{t("sync.whoKnows")}</p>
            <WhoKnows name={resolution.by} time={resolution.at} t={t} />
          </>
        ) : (
          <p className={styles.mutedBody}>{t("sync.emptyBody")}</p>
        )}
      </div>
    ),
  });
}

function groupByStop(rows: OutboxRow[]): { groupKey: string; rows: OutboxRow[] }[] {
  const groups = new Map<string, OutboxRow[]>();
  for (const row of rows) {
    const key = row.groupKey ?? row.clientId;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups].map(([groupKey, grouped]) => ({ groupKey, rows: grouped }));
}

function RowText({ row, t }: { row: OutboxRow; t: ReturnType<typeof useT> }) {
  if (row.kind === "departed") return <>{t("outbox.departed")}</>;
  return (
    <>
      {row.kind === "arrival" ? t("outbox.arrival") : row.outcomeWord} <Mono>{row.subject}</Mono>
    </>
  );
}

/** "Delivered ORD2001 + ORD2002". */
function RowGroupText({ rows }: { rows: OutboxRow[] }) {
  const word = rows[0]?.outcomeWord ?? "Delivered";
  return (
    <>
      {word}{" "}
      {rows.map((row, i) => (
        <span key={row.clientId}>
          {i > 0 && " + "}
          <Mono>{row.subject}</Mono>
        </span>
      ))}
    </>
  );
}

function Tile({ icon, tone }: { icon: IconName; tone: "route" | "success" | "review" | "danger" | "neutral" }) {
  return (
    <span className={[styles.tile, styles[`tile_${tone}`]].join(" ")}>
      <Icon name={icon} size={28} />
    </span>
  );
}

function RecordList({ items }: { items: ListItem[] }) {
  return (
    <ul className={styles.card}>
      {items.map((item) => (
        <li key={item.key} className={[styles.row, item.note && styles.rowNote].filter(Boolean).join(" ")}>
          <div className={styles.rowStack}>
            <span className={styles.rowLabel}>{item.label}</span>
            {item.note && <span className={styles.rowNoteText}>{item.note}</span>}
            {item.note && <RecordPill state={item.state} label={item.pillLabel} />}
          </div>
          {!item.note && <RecordPill state={item.state} label={item.pillLabel} />}
        </li>
      ))}
    </ul>
  );
}

function WhoKnows({ name, time, t }: { name: string; time: string; t: ReturnType<typeof useT> }) {
  return (
    <div className={styles.who}>
      <Icon name="user" size={20} />
      <span className={styles.whoName}>{t("sync.dispatchPerson", { name })}</span>
      <span className={styles.whoTime}>{time}</span>
    </div>
  );
}
