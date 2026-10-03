import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AppBar } from "../../../shared/chrome/AppBar";
import { ConnectivityBar } from "../../../shared/chrome/ConnectivityBar";
import { PhoneLayout } from "../../../shared/chrome/PhoneLayout";
import { SyncChip, type SyncState } from "../../../shared/chrome/TopBar";
import { Alert } from "../../../shared/ui/Alert";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { StateScreen } from "../../../shared/ui/StateScreen";
import { Tag } from "../../../shared/ui/Tag";
import type { Delivery } from "../../../domain/delivery";
import { clockTime, dayLabel } from "../../../domain/format";
import { OUTLET } from "../../../domain/outlet";
import { toIsoDate } from "../../../domain/schedule";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { useNow } from "../../../hooks/useNow";
import { useOnline } from "../../../hooks/useOnline";
import { useStore } from "../../../app/StoreContext";
import { OrderRows } from "../deliveries/OrderRows";
import { ReceiptQuestion, ReviewNotice } from "../deliveries/ReviewNotice";
import { IssueSheet, type IssueReport } from "./IssueSheet";
import { isQueuedReceipt, loadQueued, saveQueued } from "../queue";
import { PodCard } from "./PodCard";
import { ReceiptCounts } from "./ReceiptCounts";
import { ReceiptOutcome } from "./ReceiptOutcome";
import styles from "./ReceiptPage.module.css";
import { ReceiptSkeleton } from "./ReceiptSkeleton";
import { ShortfallSheet, type ShortfallReason } from "./ShortfallSheet";

/**
 * Forces a state frame for the dev server and the gallery: S3.S B, D and C (loading, error,
 * offline with a confirmation saved), S3.1 B (a shortfall counted), and S3.5 (Dispatch asks the
 * store), which needs the dispatcher's "Review with store first" to happen for real.
 */
export type ReceiptPreview = "loading" | "error" | "offline" | "asked" | "shortfall";

export type ReceiptPageProps = {
  outletId?: string;
  /** ISO date of the delivery day. */
  date: string;
  preview?: ReceiptPreview;
  /** Open the report sheet on arrival, from S2.7's Report issue. */
  openReport?: boolean;
};

type Loaded = { delivery: Delivery | undefined };
type Queued = { at: string; lines: { orderId: string; received: number }[]; reason?: string };

/**
 * S3 Receipt. One route for every frame: confirm what arrived (S3.1), with a shortfall (S3.1 B),
 * report an issue (S3.3), then what Dispatch and the store know (S3.2, S3.4, S3.6), Dispatch's
 * question (S3.5), and the empty, loading, offline and error states (S3.S).
 */
export function ReceiptPage({ outletId = OUTLET.id, date, preview, openReport }: ReceiptPageProps) {
  const navigate = useNavigate();
  const { api, now, unread } = useStore();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const currentTime = useNow();
  const browserOnline = useOnline();
  const online = browserOnline && preview !== "offline";

  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(preview === "error");
  const [attempt, setAttempt] = useState(0);
  // S3.1 B starts with ORD2001 counted at 10 of 12 (A28).
  const [counts, setCounts] = useState<Record<string, number>>(preview === "shortfall" ? { ORD2001: 10 } : {});
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(Boolean(openReport));
  const [shortfallOpen, setShortfallOpen] = useState(false);
  // A confirmation made offline is saved here and goes out when the connection returns. The ref is
  // what the online handler reads, so a second `online` event finds the queue already taken.
  // It is also kept on the device, so closing the tab offline does not lose it. Gallery states never touch it.
  const queueKey = useMemo(() => ({ kind: "receipt", outletId, date }) as const, [outletId, date]);
  const [restored] = useState(() => (preview ? null : loadQueued(queueKey, isQueuedReceipt)));
  const [queued, setQueuedState] = useState<Queued | null>(restored);
  const queuedRef = useRef<Queued | null>(restored);
  const setQueued = useCallback(
    (value: Queued | null) => {
      queuedRef.current = value;
      setQueuedState(value);
      if (!preview) saveQueued(queueKey, value);
    },
    [preview, queueKey],
  );
  const inFlight = useRef(false);
  const loadedOnce = useRef(false);

  const minute = clockTime(currentTime);

  useEffect(() => {
    if (preview === "loading" || preview === "error") return;
    if (!online && loadedOnce.current) return;
    let alive = true;
    void (async () => {
      try {
        const [delivery] = await api.listDeliveries(outletId, date);
        if (!alive) return;
        loadedOnce.current = true;
        setData({ delivery });
        setFailed(false);
        if (preview === "offline" && delivery?.proof && !queuedRef.current) {
          setQueued({ at: clockTime(now()), lines: delivery.orders.map((o) => ({ orderId: o.id, received: o.units })) });
        }
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, outletId, date, minute, online, attempt, preview, now, setQueued]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const delivery = data?.delivery;

  const send = useCallback(
    async (input: Queued) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        await api.confirmReceipt({
          outletId,
          date,
          lines: input.lines,
          deviceTime: input.at,
          ...(input.reason ? { reason: input.reason } : {}),
        });
        setQueued(null);
        setShortfallOpen(false);
        reload();
      } catch {
        setFailed(true);
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [api, outletId, date, reload, setQueued],
  );

  // A confirmation saved offline goes out by itself the moment the connection returns.
  useEffect(() => {
    if (!queued || preview === "offline") return;
    const flush = () => {
      const taken = queuedRef.current;
      if (!taken) return;
      setQueued(null);
      void send(taken);
    };
    window.addEventListener("online", flush);
    // One saved on an earlier visit goes out once the page is online and the delivery has loaded.
    if (online && delivery) flush();
    return () => window.removeEventListener("online", flush);
  }, [queued, preview, send, setQueued, online, delivery]);

  function confirm(reason?: ShortfallReason) {
    if (!delivery) return;
    const input: Queued = {
      at: clockTime(now()),
      lines: delivery.orders.map((order) => ({ orderId: order.id, received: counts[order.id] ?? order.units })),
      ...(reason ? { reason } : {}),
    };
    setShortfallOpen(false);
    if (!online) setQueued(input);
    else void send(input);
  }

  async function sendReport(report: IssueReport) {
    setBusy(true);
    try {
      await api.reportIssue({ outletId, date, ...report });
      setReportOpen(false);
      reload();
    } catch {
      setFailed(true);
      setReportOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function received() {
    setBusy(true);
    try {
      await api.answerReceivedQuestion({ outletId, date, answer: "received" });
      navigate(`/store/deliveries/${date}`);
    } finally {
      setBusy(false);
    }
  }

  const syncState: SyncState = busy ? "sending" : !online ? "offline" : "synced";
  const short = delivery?.orders.some((order) => (counts[order.id] ?? order.units) < order.units) ?? false;

  // ---- What the page shows, and what is pinned under it -------------------
  let content: ReactNode;
  let actions: ReactNode = null;
  let offlineNote: ReactNode;
  let title: string | undefined;

  const proof = delivery?.proof;
  if (delivery && proof) title = `Receipt · ${delivery.orders.map((o) => o.id).join(" + ")}`;

  const reportButton = (
    <Button variant="secondary" icon="alert-circle" disabled={busy} onClick={() => setReportOpen(true)}>
      Report issue
    </Button>
  );

  if (failed) {
    content = (
      <Alert tone="danger" icon="alert-circle" title="Couldn't load the proof of delivery.">
        <div className={styles.retry}>
          <Button variant="secondary" size="medium" auto icon="refresh-cw" onClick={reload}>
            Retry
          </Button>
        </div>
      </Alert>
    );
  } else if (!data) {
    content = <ReceiptSkeleton />;
  } else if (!delivery || !proof) {
    content = <StateScreen icon="inbox" bg="surface-2" fg="ink-muted" title="No delivery to confirm yet" />;
  } else if (queued) {
    // S3.S C: the confirmation is saved on the phone and sends when the connection returns.
    offlineNote = "Your confirmation is saved and sends when you reconnect.";
    content = (
      <Card>
        <div className={styles.saved}>
          <div className={styles.savedHead}>
            <h2 className={styles.date}>{dayLabel(delivery.date)}</h2>
            <span className={styles.tags}>
              <Tag kind="fresh">Fresh</Tag>
              <Tag>{delivery.dock}</Tag>
            </span>
          </div>
          <OrderRows orders={delivery.orders} />
          <span className={styles.savedPill}>
            <Icon name="cloud" size={14} />
            Saved on phone
          </span>
          <p className={styles.savedLine}>
            Receipt confirmed <Mono>{queued.at}</Mono> · Anusha
          </p>
        </div>
      </Card>
    );
  } else if (delivery.issues.length > 0 || delivery.receiptConfirmedAt) {
    content = <ReceiptOutcome delivery={delivery} reviewOpen={Boolean(delivery.review)} />;
  } else if (preview === "asked" && delivery.review) {
    // S3.5: Dispatch asks whether the delivery arrived. Yes settles it (S2.8); Report issue opens S3.3.
    content = (
      <>
        <ReviewNotice review={delivery.review} icon="store" />
        <h2 className={styles.ask}>Dispatch asks: did you receive this delivery?</h2>
        <PodCard proof={proof} photoHeight={62} />
      </>
    );
    actions = (
      <ReceiptQuestion delivery={delivery} disabled={busy || !online} onYes={() => void received()} onReport={() => setReportOpen(true)} bare />
    );
  } else {
    // S3.1 and S3.1 B: to confirm, or to confirm with a shortfall.
    content = (
      <>
        {delivery.review && <ReviewNotice review={delivery.review} />}
        <PodCard proof={proof} />
        <ReceiptCounts
          orders={delivery.orders}
          counts={counts}
          onChange={(orderId, units) => setCounts((prev) => ({ ...prev, [orderId]: units }))}
          disabled={busy}
        />
      </>
    );
    actions = (
      <div className={styles.actions}>
        <Button
          busy={busy}
          disabled={busy}
          onClick={() => (short ? setShortfallOpen(true) : confirm())}
        >
          {short ? "Confirm with a shortfall" : "Confirm receipt"}
        </Button>
        {reportButton}
      </div>
    );
  }

  const offlineBar = !online && !queued && data ? <>You're offline. Your confirmation will be saved on this phone.</> : offlineNote;
  const outletTitle = title ?? (failed || !data ? "Receipt" : undefined);

  const sheets =
    delivery && proof ? (
      <>
        <IssueSheet
          open={reportOpen}
          onOpenChange={setReportOpen}
          orders={delivery.orders}
          online={online}
          busy={busy}
          onSend={(report) => void sendReport(report)}
        />
        <ShortfallSheet
          open={shortfallOpen}
          onOpenChange={setShortfallOpen}
          orders={delivery.orders}
          counts={counts}
          busy={busy}
          onConfirm={(reason) => confirm(reason)}
        />
      </>
    ) : null;

  if (!desktop) {
    return (
      <>
        <PhoneLayout
          sync={syncState}
          bell={{ unread }}
          {...(outletTitle ? { outlet: outletTitle, place: `${OUTLET.id} · ${OUTLET.brand} · ${OUTLET.district}`, placeMono: true } : {})}
          {...(offlineBar ? { connectivity: offlineBar } : {})}
          {...(actions ? { actions } : {})}
        >
          {content}
        </PhoneLayout>
        {sheets}
      </>
    );
  }

  return (
    <div className={styles.desktop}>
      <AppBar
        bell={{ unread }}
        right={
          <>
            <span className={styles.today}>
              {dayLabel(toIsoDate(currentTime))} · {outletId}
            </span>
            <SyncChip state={syncState} />
          </>
        }
      />
      {offlineBar && <ConnectivityBar>{offlineBar}</ConnectivityBar>}
      <main className={styles.column}>
        {title && <h1 className={styles.title}>{title}</h1>}
        {content}
        {actions && <div className={styles.columnAction}>{actions}</div>}
      </main>
      {sheets}
    </div>
  );
}
