import { formatTime } from "../../../field/clock/clock";
import { BottomSheet, FieldSwitch } from "../../../field/components";
import { connectivity, type ConnectivitySnapshot } from "../../../field/offline";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { useT } from "../context/DriverContext";
import type { TFn } from "../stopFormat";
import { RecordPill } from "./RecordPill";
import { StatusBar, StatusBarAside, StatusBarButton, type StatusBarTone } from "./StatusBar";
import { outboxMode, summarise, type OutboxMode, type OutboxRow } from "./outboxModel";
import styles from "./OutboxSheet.module.css";

export type OutboxProgress = { done: number; total: number };

/** The presenter's controls under the Simulate offline switch, wired by the live sheet only. */
export type OutboxPrototypeControls = {
  coverageGap: boolean;
  onCoverageGap: (on: boolean) => void;
  failNextUpload: boolean;
  onFailNextUpload: (on: boolean) => void;
  /** Absent when no stop is waiting on Dispatch. */
  onResolve?: (decision: "keep_delivery" | "keep_partial") => void;
};

export type OutboxSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: OutboxRow[];
  connectivity: ConnectivitySnapshot;
  /** The scenario clock now, for the time at the top right of R4.1 and R4.2. */
  now: number;
  progress?: OutboxProgress;
  /** Photos that could not be sent (R8.2): the bar says so even though every record is synced. */
  photoFailures?: number;
  /** "Prototype · Simulate offline". Always on in the app; R4.2 and R4.3 are drawn without it. */
  showSimulate?: boolean;
  prototype?: OutboxPrototypeControls;
  onSendNow: () => void;
};

function RowLabel({ row, t }: { row: OutboxRow; t: TFn }) {
  if (row.kind === "departed") return <>{t("outbox.departed")}</>;
  const word = row.kind === "arrival" ? t("outbox.arrival") : row.outcomeWord;
  return (
    <>
      {word} <Mono>{row.subject}</Mono>
    </>
  );
}

function rowNote(row: OutboxRow, t: TFn): string | undefined {
  if (row.state === "review") return t("outbox.reviewNote");
  if (row.state === "retrying") return t("outbox.retryNote");
  return undefined;
}

function OutboxRowView({ row, t }: { row: OutboxRow; t: TFn }) {
  const note = rowNote(row, t);
  return (
    <li className={[styles.row, note && styles.rowNote].filter(Boolean).join(" ")}>
      <span className={styles.time}>{row.time}</span>
      <span className={styles.rowText}>
        <span className={styles.rowLabel}>
          <RowLabel row={row} t={t} />
        </span>
        {note && <span className={styles.note}>{note}</span>}
      </span>
      <RecordPill state={row.state} />
    </li>
  );
}

const BAR_TONE: Record<OutboxMode, StatusBarTone> = {
  syncing: "syncing",
  offline: "offline",
  failed: "failed",
  review: "review",
  synced: "synced",
};

function plural(count: number, one: string, many: string, t: TFn): string {
  return count === 1 ? t(one) : t(many, { count });
}

/**
 * The R4 Outbox: a bottom sheet over the run, opened from the connectivity chip. It is a read of
 * the phone's own outbox and connectivity, so it never touches the network: the bar says what the
 * device is doing (offline, sending, failed and retrying, sent for review, all synced) and the rows
 * say where each record is. Close always closes; Send now and Retry now call `sendNow()`.
 */
export function OutboxSheet({ open, onOpenChange, rows, connectivity: snapshot, now, progress, photoFailures = 0, showSimulate = true, prototype, onSendNow }: OutboxSheetProps) {
  const t = useT();
  const summary = summarise(rows, photoFailures);
  const mode = outboxMode(snapshot, summary);
  const waitingSheet = mode === "offline" || mode === "syncing";
  const lastSync = snapshot.lastSyncAt ? formatTime(snapshot.lastSyncAt) : "--:--";
  const allSynced = rows.every((row) => row.state === "synced");
  const showRows = rows.length > 0 && (!allSynced || mode === "offline");
  const count = mode === "syncing" ? (progress?.total ?? summary.pending) : summary.pending;

  let message: string;
  let aside: React.ReactNode = null;
  if (mode === "offline") {
    message = t("banner.offlineSaved", { count: summary.pending });
    aside = <StatusBarAside>{t("banner.offlineLastSync", { time: lastSync })}</StatusBarAside>;
  } else if (mode === "syncing") {
    message = plural(count, "outbox.sendingOne", "outbox.sending", t);
    if (progress) {
      aside = (
        <StatusBarAside>
          <Mono>
            {progress.done} / {progress.total}
          </Mono>
        </StatusBarAside>
      );
    }
  } else if (mode === "failed") {
    message =
      summary.errors > 0
        ? plural(summary.errors, "outbox.failedOne", "outbox.failed", t)
        : plural(summary.failedPhotos, "outbox.photoFailedOne", "outbox.photoFailed", t);
    aside = (
      <StatusBarButton icon="refresh-cw" onClick={onSendNow}>
        {t("outbox.retryNow")}
      </StatusBarButton>
    );
  } else if (mode === "review") {
    message = t("outbox.review", {
      stops: plural(summary.reviewStops, "outbox.stopsOne", "outbox.stopsMany", t),
      orders: plural(summary.reviewOrders, "outbox.ordersOne", "outbox.ordersMany", t),
    });
  } else {
    message = t("outbox.allSynced");
  }

  const showSummary = mode === "offline" && summary.pending > 0;
  const showSendNow = (mode === "offline" || mode === "synced") && summary.pending > 0;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("outbox.title")}
      headerAside={waitingSheet ? <Mono>{formatTime(now)}</Mono> : undefined}
      flush
    >
      <StatusBar tone={BAR_TONE[mode]} aside={aside}>
        {message}
      </StatusBar>

      {showSummary && (
        <p className={styles.summary}>{plural(summary.pending, "outbox.waitingOne", "outbox.waiting", t)}</p>
      )}

      {showRows ? (
        <ul className={[styles.rows, showSummary && styles.rowsRuled].filter(Boolean).join(" ")}>
          {rows.map((row) => (
            <OutboxRowView key={row.clientId} row={row} t={t} />
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyTile}>
            <Icon name="check" size={28} />
          </span>
          <p>{t("outbox.empty")}</p>
        </div>
      )}

      {showSimulate && (
        <>
          <label className={styles.prototype} htmlFor="outbox-simulate-offline">
            <span className={styles.prototypeTag}>{t("outbox.prototype")}</span>
            <span className={styles.prototypeLabel}>{t("outbox.simulateOffline")}</span>
            <FieldSwitch
              id="outbox-simulate-offline"
              checked={snapshot.simulatedOffline}
              onCheckedChange={(on) => void connectivity.setSimulatedOffline(on)}
              label={t("outbox.simulateOffline")}
            />
          </label>
          {prototype && <PrototypeRows controls={prototype} t={t} />}
        </>
      )}

      <div className={styles.spacer} />
      <div className={styles.actions}>
        <button type="button" className={styles.close} onClick={() => onOpenChange(false)}>
          {t("outbox.close")}
        </button>
        {showSendNow && (
          <button type="button" className={styles.send} onClick={onSendNow}>
            <Icon name="refresh-cw" size={20} />
            {t("outbox.sendNow")}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

function PrototypeRows({ controls, t }: { controls: OutboxPrototypeControls; t: TFn }) {
  return (
    <div className={styles.presenter}>
      <label className={styles.prototype} htmlFor="outbox-coverage-gap">
        <span className={styles.prototypeLabel}>{t("outbox.coverageGap")}</span>
        <FieldSwitch id="outbox-coverage-gap" checked={controls.coverageGap} onCheckedChange={controls.onCoverageGap} label={t("outbox.coverageGap")} />
      </label>
      <label className={styles.prototype} htmlFor="outbox-fail-upload">
        <span className={styles.prototypeLabel}>{t("outbox.failNextUpload")}</span>
        <FieldSwitch id="outbox-fail-upload" checked={controls.failNextUpload} onCheckedChange={controls.onFailNextUpload} label={t("outbox.failNextUpload")} />
      </label>
      {controls.onResolve && (
        <div className={styles.presenterButtons}>
          <button type="button" className={styles.presenterButton} onClick={() => controls.onResolve?.("keep_delivery")}>
            {t("outbox.resolveKeep")}
          </button>
          <button type="button" className={styles.presenterButton} onClick={() => controls.onResolve?.("keep_partial")}>
            {t("outbox.resolvePartial")}
          </button>
        </div>
      )}
    </div>
  );
}
