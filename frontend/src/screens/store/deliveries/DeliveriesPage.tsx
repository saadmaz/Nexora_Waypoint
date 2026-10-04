import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AppBar } from "../../../shared/chrome/AppBar";
import { ConnectivityBar } from "../../../shared/chrome/ConnectivityBar";
import { PhoneLayout } from "../../../shared/chrome/PhoneLayout";
import { SyncChip, type SyncState } from "../../../shared/chrome/TopBar";
import { Alert } from "../../../shared/ui/Alert";
import { Button } from "../../../shared/ui/Button";
import { Mono } from "../../../shared/ui/Mono";
import { StateScreen } from "../../../shared/ui/StateScreen";
import type { Delivery } from "../../../domain/delivery";
import { clockTime, dayLabel } from "../../../domain/format";
import type { RecentOrderDay } from "../../../domain/order";
import { deliveryDayFor, toIsoDate } from "../../../domain/schedule";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { useNow } from "../../../hooks/useNow";
import { useOnline } from "../../../hooks/useOnline";
import { useStore } from "../../../app/StoreContext";
import { DeferralView } from "./DeferralView";
import { DeliveriesSkeleton } from "./DeliveriesSkeleton";
import { DeliveryCard } from "./DeliveryCard";
import { DeliverySummary } from "./DeliverySummary";
import { DesktopDelivery } from "./DesktopDelivery";
import styles from "./DeliveriesPage.module.css";
import { RecentList } from "./RecentList";
import { ReceiptQuestion, ReviewNotice } from "./ReviewNotice";

/** Forces one of the S2.S state frames for the dev server and the gallery. Empty needs no preview: it is what an outlet with no orders shows. */
export type DeliveriesPreview = "loading" | "error" | "offline";

export type DeliveriesPageProps = {
  /** Whose deliveries. OUT009 is the S2.9 view of a store deferred by policy. */
  outletId?: string;
  /** One day's delivery (S2.1 to S2.9, S2.11). Without it the page lists the days and Recent (S2.10). */
  date?: string;
  preview?: DeliveriesPreview;
};

type Loaded = { deliveries: Delivery[]; recent: RecentOrderDay[]; at: string };

/**
 * S2 Deliveries. One route for every frame: which one shows follows from the delivery the
 * API derives from the order record and the clock, and from the connection (S2.S).
 */
export function DeliveriesPage({ outletId: outletIdProp, date, preview }: DeliveriesPageProps) {
  const navigate = useNavigate();
  const { api, now, unread, refreshUnread, outlet: storeOutlet, clockVersion } = useStore();
  const outletId = outletIdProp ?? storeOutlet.id;
  const desktop = useMediaQuery("(min-width: 1024px)");
  const currentTime = useNow();
  const browserOnline = useOnline();
  const online = browserOnline && preview !== "offline";

  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(preview === "error");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const loadedOnce = useRef(false);

  // "HH:MM" of the scenario clock: the screen refreshes when it changes, so the status follows the clock.
  const minute = clockTime(currentTime);

  useEffect(() => {
    if (preview === "loading" || preview === "error") return;
    // Offline the screen keeps what it last showed (S2.S C); it only fetches once to have something to show.
    if (!online && loadedOnce.current) return;
    let alive = true;
    void (async () => {
      try {
        const deliveries = await api.listDeliveries(outletId, date);
        const before = date ?? deliveries[0]?.date ?? toIsoDate(now());
        const recent = await api.listRecent(outletId, { limit: 7, before });
        if (!alive) return;
        loadedOnce.current = true;
        setData({ deliveries, recent, at: clockTime(now()) });
        setFailed(false);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, outletId, date, minute, online, attempt, preview, now, clockVersion]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const deliveries = data?.deliveries ?? [];
  const delivery = date ? deliveries.find((d) => d.date === date) : deliveries[0];
  const recent = data?.recent ?? [];
  const targetLabel = dayLabel(date ?? deliveryDayFor(currentTime));

  async function gotIt(target: Delivery) {
    setBusy(true);
    try {
      await api.acknowledgeDeferral({ outletId, date: target.date });
      refreshUnread();
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function received(target: Delivery) {
    setBusy(true);
    try {
      await api.answerReceivedQuestion({ outletId, date: target.date, answer: "received" });
      reload();
    } finally {
      setBusy(false);
    }
  }

  const receiptPath = (target: Delivery) => `/store/deliveries/${target.date}/receipt`;
  const confirmReceipt = (target: Delivery) => navigate(receiptPath(target));
  const reportIssue = (target: Delivery) => navigate(`${receiptPath(target)}?report=1`);

  const syncState: SyncState = !online ? "offline" : "synced";
  const offlineNote: ReactNode = !online && data ? (
    <>
      Showing deliveries as of <Mono>{data.at}</Mono>, reconnect for updates.
    </>
  ) : undefined;

  // ---- What the phone shows, and what is pinned under it ------------------
  let content: ReactNode;
  let actions: ReactNode = null;

  if (failed) {
    content = (
      <Alert tone="danger" icon="alert-circle" title="Couldn't load deliveries.">
        <div className={styles.retry}>
          <Button variant="secondary" size="medium" auto icon="refresh-cw" onClick={reload}>
            Retry
          </Button>
        </div>
      </Alert>
    );
  } else if (!data) {
    content = <DeliveriesSkeleton />;
  } else if (date ? !delivery : deliveries.length === 0) {
    content = (
      <StateScreen
        icon="truck"
        bg="surface-2"
        fg="ink-muted"
        title={`No deliveries scheduled for ${targetLabel}`}
        actions={
          <Button variant="ghost" size="medium" auto iconRight="chevron-right" onClick={() => navigate("/store/orders")}>
            Place an order
          </Button>
        }
      />
    );
  } else if (!date) {
    content = (
      <>
        {deliveries.map((d) => (
          <DeliverySummary key={d.date} delivery={d} onOpen={() => navigate(`/store/deliveries/${d.date}`)} />
        ))}
        {recent.length > 0 && (
          <section aria-labelledby="recent-title">
            <h2 className={styles.recent} id="recent-title">
              Recent
            </h2>
            <RecentList days={recent} />
          </section>
        )}
      </>
    );
  } else if (delivery?.deferral) {
    content = <DeferralView delivery={delivery} />;
    actions = delivery.deferral.acknowledged ? (
      <Button variant="secondary" disabled icon="check">
        Dispatch has seen this
      </Button>
    ) : (
      <div className={styles.gotIt}>
        <Button busy={busy} disabled={busy || !online} onClick={() => void gotIt(delivery)}>
          Got it
        </Button>
        {delivery.deferral.type === "store request" && (
          <p className={styles.caption}>Dispatch sees when you tap Got it.</p>
        )}
      </div>
    );
  } else if (delivery) {
    content = (
      <>
        {delivery.review && <ReviewNotice review={delivery.review} />}
        <DeliveryCard delivery={delivery} offline={!online} />
      </>
    );
    if (delivery.review?.asked) {
      // A51: only once Dispatch has asked. Until then the explanation above stands on its own.
      actions = (
        <ReceiptQuestion
          delivery={delivery}
          disabled={busy || !online}
          onYes={() => void received(delivery)}
          onReport={() => reportIssue(delivery)}
        />
      );
    } else if (delivery.status === "Delivered" && !delivery.receiptConfirmedAt) {
      actions = (
        <Button iconRight="arrow-right" disabled={!online} onClick={() => confirmReceipt(delivery)}>
          Confirm receipt
        </Button>
      );
    }
  }

  const titled = (
    <>
      <h1 className={styles.title}>Deliveries</h1>
      {content}
    </>
  );
  const outlet = delivery ? `${delivery.outletId} · ${delivery.outletName}` : undefined;

  if (!desktop) {
    return (
      <PhoneLayout
        sync={syncState}
        bell={{ unread }}
        {...(outlet && delivery ? { outlet, place: delivery.district } : {})}
        {...(offlineNote ? { connectivity: offlineNote } : {})}
        {...(actions ? { actions } : {})}
      >
        {titled}
      </PhoneLayout>
    );
  }

  // ---- Desktop -------------------------------------------------------------
  const wide = !failed && data && delivery && !delivery.deferral;
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
      {offlineNote && <ConnectivityBar>{offlineNote}</ConnectivityBar>}
      {wide && delivery ? (
        <DesktopDelivery
          delivery={delivery}
          recent={recent}
          disabled={busy || !online}
          onConfirmReceipt={() => confirmReceipt(delivery)}
          notice={delivery.review ? <ReviewNotice review={delivery.review} /> : undefined}
        />
      ) : (
        <main className={styles.column}>
          {titled}
          {actions && <div className={styles.columnAction}>{actions}</div>}
        </main>
      )}
    </div>
  );
}
