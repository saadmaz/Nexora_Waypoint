import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CutoffError, type StoreApi } from "../../api/StoreApi";
import { AppBar } from "../../components/chrome/AppBar";
import { PhoneLayout } from "../../components/chrome/PhoneLayout";
import { SyncChip, type SyncState } from "../../components/chrome/TopBar";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Mono } from "../../components/ui/Mono";
import { Sheet } from "../../components/ui/Sheet";
import { LoadingSkeleton } from "../../components/ui/StateScreen";
import { useToast } from "../../components/ui/useToast";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useNow } from "../../hooks/useNow";
import { useOnline } from "../../hooks/useOnline";
import { DEFAULT_UNITS, estimateFor } from "../../domain/estimate";
import { clockTime, dayLabel, weekdayShort } from "../../domain/format";
import type { NewOrderInput, Order, OrderKind, RecentOrderDay } from "../../domain/order";
import { OUTLET } from "../../domain/outlet";
import {
  addDays,
  isAfterCutoff,
  minutesUntilCutoff,
  nextOperatingDayAfter,
  operatingDayFor,
  toIsoDate,
} from "../../domain/schedule";
import { AfterCutoffView } from "./AfterCutoffView";
import { CutoffAlert } from "./CutoffAlert";
import { DesktopOrders } from "./DesktopOrders";
import { EmptyOrders } from "./EmptyOrders";
import { PhoneForm } from "./PhoneForm";
import { ReceivedView } from "./ReceivedView";
import { ReviewBody } from "./ReviewBody";
import styles from "./OrdersPage.module.css";

const KINDS: OrderKind[] = ["chilled", "dry"];

/**
 * Forces one of the state frames for the gallery and the dev server: S1.5 A
 * (offline, and queued), B (error), C (sending) and D (empty).
 */
export type OrdersPreview = "offline" | "queued" | "error" | "sending" | "empty";

export type OrdersPageProps = {
  api: StoreApi;
  /** The clock. The scenario clock (?at=HH:MM) supplies this from phase 7. */
  now?: () => Date;
  preview?: OrdersPreview;
};

type Mode = "view" | "edit" | "cancelled";
type Submit = "idle" | "sending" | "error" | "queued";
type Line = { kind: OrderKind; units: number };
type Quantities = Record<OrderKind, number>;

const realNow = () => new Date();

function linesOf(quantities: Quantities): Line[] {
  return KINDS.filter((kind) => quantities[kind] > 0).map((kind) => ({ kind, units: quantities[kind] }));
}

function toInput(line: Line, deliveryDate: string): NewOrderInput {
  const { kg, m3 } = estimateFor(line.kind, line.units);
  return {
    outletId: OUTLET.id,
    deliveryDate,
    line: { kind: line.kind, units: line.units, estimatedKg: kg, estimatedM3: m3 },
  };
}

/**
 * S1 Place order: the whole flow on one route. Chooses between the order form,
 * the acknowledgement, edit, cancelled, and the after-cutoff frames from the
 * orders the API holds and the clock, and lays them out for phone or desktop.
 */
export function OrdersPage({ api, now = realNow, preview }: OrdersPageProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const currentTime = useNow(now);
  const browserOnline = useOnline();
  const online = browserOnline && preview !== "offline" && preview !== "queued";

  const [allOrders, setAllOrders] = useState<Order[] | null>(null);
  const [recent, setRecent] = useState<RecentOrderDay[]>([]);
  const [mode, setMode] = useState<Mode>("view");
  const [quantities, setQuantities] = useState<Quantities>({ ...DEFAULT_UNITS });
  const [submit, setSubmit] = useState<Submit>(
    preview === "sending" ? "sending" : preview === "error" ? "error" : preview === "queued" ? "queued" : "idle",
  );
  const initialQueued = preview === "queued" ? { at: clockTime(now()), lines: linesOf(DEFAULT_UNITS) } : null;
  const [queued, setQueuedState] = useState<{ at: string; lines: Line[] } | null>(initialQueued);
  // The ref is what the online handler reads, so a second event finds the queue already taken.
  const queuedRef = useRef(initialQueued);
  const setQueued = useCallback((value: { at: string; lines: Line[] } | null) => {
    queuedRef.current = value;
    setQueuedState(value);
  }, []);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [closedNotice, setClosedNotice] = useState(false);

  const target = operatingDayFor(currentTime);
  const afterCutoff = isAfterCutoff(currentTime);
  const targetLabel = dayLabel(target);
  /** The day whose 16:00 cutoff has just passed, for "Orders for Tue 29 Sep closed at 16:00". */
  const closedDate = toIsoDate(addDays(currentTime, 1));
  const minutesLeft = minutesUntilCutoff(target, currentTime);
  const orders = (allOrders ?? [])
    .filter((order) => order.deliveryDate === target)
    .sort((a, b) => KINDS.indexOf(a.line.kind) - KINDS.indexOf(b.line.kind));

  const reload = useCallback(async () => {
    setAllOrders(await api.listOrders(OUTLET.id));
  }, [api]);

  useEffect(() => {
    let alive = true;
    void Promise.all([api.listOrders(OUTLET.id), api.listRecentOrders(OUTLET.id)]).then(([o, r]) => {
      if (!alive) return;
      setAllOrders(o);
      setRecent(r);
    });
    return () => {
      alive = false;
    };
  }, [api]);

  // Two `online` events, or a double tap, must not place the same order twice.
  const inFlight = useRef(false);

  const send = useCallback(
    async (lines: Line[]) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSubmit("sending");
      try {
        const placed = await api.placeOrders(lines.map((line) => toInput(line, target)));
        setAllOrders((prev) => [...(prev ?? []), ...placed]);
        setQueued(null);
        setSubmit("idle");
        setMode("view");
        if (!afterCutoff) toast.show(`${placed.length} ${placed.length === 1 ? "order" : "orders"} received.`, { icon: "circle-check" });
      } catch {
        setSubmit("error");
      } finally {
        inFlight.current = false;
      }
    },
    [api, target, afterCutoff, toast, setQueued],
  );

  /** Sends the queued order, once: the queue is taken before the request starts. */
  const flushQueue = useCallback(() => {
    const taken = queuedRef.current;
    if (!taken) return;
    setQueued(null);
    void send(taken.lines);
  }, [send, setQueued]);

  // A queued order goes out by itself the moment the connection returns.
  useEffect(() => {
    if (submit !== "queued") return;
    window.addEventListener("online", flushQueue);
    return () => window.removeEventListener("online", flushQueue);
  }, [submit, flushQueue]);

  function changeUnits(kind: OrderKind, units: number) {
    setQuantities((prev) => ({ ...prev, [kind]: units }));
    if (submit === "error") setSubmit("idle");
  }

  function startOrder() {
    setQuantities({ ...DEFAULT_UNITS });
    setMode("view");
  }

  function startEdit() {
    const next: Quantities = { chilled: 0, dry: 0 };
    for (const order of orders) next[order.line.kind] = order.line.units;
    setQuantities(next);
    setClosedNotice(false);
    setMode("edit");
  }

  /** Review confirmed, or a direct place after cutoff: send now, or queue if offline. */
  function place(lines: Line[]) {
    setReviewOpen(false);
    if (!online) {
      setQueued({ at: clockTime(currentTime), lines });
      setSubmit("queued");
    } else {
      void send(lines);
    }
  }

  async function afterEditFailure(error: unknown) {
    await reload();
    if (error instanceof CutoffError) {
      setClosedNotice(true);
      setSubmit("idle");
      setMode("view");
    } else {
      setSubmit("error");
    }
  }

  async function saveChanges() {
    setSubmit("sending");
    try {
      const existing = new Map(orders.map((order) => [order.line.kind, order]));
      const fresh: Line[] = [];
      for (const kind of KINDS) {
        const units = quantities[kind];
        const order = existing.get(kind);
        if (!order) {
          if (units > 0) fresh.push({ kind, units });
        } else if (units === 0) {
          await api.cancelOrder(order.id);
        } else if (units !== order.line.units) {
          const { kg, m3 } = estimateFor(kind, units);
          await api.editOrder(order.id, { units, estimatedKg: kg, estimatedM3: m3 });
        }
      }
      if (fresh.length > 0) await api.placeOrders(fresh.map((line) => toInput(line, target)));
      await reload();
      setSubmit("idle");
      setMode("view");
      toast.show("Order updated.", { icon: "circle-check" });
    } catch (error) {
      await afterEditFailure(error);
    }
  }

  async function cancelOrders() {
    setSubmit("sending");
    try {
      await Promise.all(orders.map((order) => api.cancelOrder(order.id)));
      await reload();
      setQuantities({ ...DEFAULT_UNITS });
      setSubmit("idle");
      setMode("cancelled");
    } catch (error) {
      await afterEditFailure(error);
    }
  }

  const syncState: SyncState = submit === "sending" ? "sending" : !online ? "offline" : "synced";
  const draft = linesOf(quantities);
  const seeDeliveries = () => navigate("/store/deliveries");

  // Which frame we are on.
  const loading = allOrders === null;
  const showEmpty = !loading && orders.length === 0 && (mode === "cancelled" || preview === "empty");
  const showPlaced = !loading && orders.length > 0 && mode !== "edit";
  const showEdit = !loading && orders.length > 0 && mode === "edit";
  const showDraftAfterCutoff = !loading && orders.length === 0 && !showEmpty && afterCutoff;
  const showForm = !loading && orders.length === 0 && !showEmpty && !afterCutoff;

  const errorAlert = (
    <Alert
      tone="danger"
      icon="alert-circle"
      title={
        <>
          Order not received: try again before <Mono>16:00</Mono>.
        </>
      }
    >
      Your quantities are kept.
    </Alert>
  );

  const notice: ReactNode =
    submit === "error" ? (
      errorAlert
    ) : !online ? (
      <CutoffAlert minutesLeft={minutesLeft}>
        Reconnect before <Mono>16:00</Mono> or this order moves to {weekdayShort(nextOperatingDayAfter(target))}.
      </CutoffAlert>
    ) : (
      <CutoffAlert minutesLeft={minutesLeft} />
    );

  // Editing changes an order that is already in, so there is nothing to "move to" tomorrow.
  const editNotice: ReactNode = submit === "error" ? errorAlert : <CutoffAlert minutesLeft={minutesLeft} />;

  const closed = closedNotice ? (
    <Alert
      tone="danger"
      title={
        <>
          Orders closed at <Mono>16:00</Mono>
        </>
      }
    >
      This order can no longer be edited or cancelled.
    </Alert>
  ) : null;

  const placeCount = draft.length;
  const busy = submit === "sending";
  const primary = (() => {
    if (showEdit) {
      return (
        <Button busy={busy} disabled={busy || !online || draft.length === 0} onClick={() => void saveChanges()}>
          {busy ? "Sending…" : "Save changes"}
        </Button>
      );
    }
    if (showDraftAfterCutoff) {
      return (
        <Button busy={busy} onClick={() => place(draft)}>
          {busy ? "Sending…" : `Place order for ${targetLabel}`}
        </Button>
      );
    }
    if (showForm) {
      if (busy) return <Button busy>Sending…</Button>;
      if (submit === "error") {
        return (
          <Button icon="refresh-cw" onClick={() => place(draft)}>
            Try again
          </Button>
        );
      }
      if (!online || submit === "queued") {
        return (
          <Button
            icon="cloud"
            onClick={() => {
              if (submit !== "queued") setReviewOpen(true);
              else if (online) flushQueue();
            }}
          >
            Send when online
          </Button>
        );
      }
      return (
        <Button disabled={placeCount === 0} onClick={() => setReviewOpen(true)}>
          {placeCount === 0 ? "Place orders" : `Place ${placeCount} ${placeCount === 1 ? "order" : "orders"}`}
        </Button>
      );
    }
    if (showPlaced && afterCutoff) {
      return (
        <Button variant="secondary" onClick={seeDeliveries}>
          See deliveries
        </Button>
      );
    }
    return null;
  })();

  const cancelButton = (
    <Button variant="secondary" disabled={busy || !online} onClick={() => void cancelOrders()}>
      Cancel order
    </Button>
  );

  const review = (
    <ReviewBody
      lines={draft}
      dateLabel={targetLabel}
      onEdit={() => setReviewOpen(false)}
      onConfirm={() => place(draft)}
    />
  );

  // ---- Phone content ------------------------------------------------------
  const phoneContent: ReactNode = loading ? (
    <LoadingSkeleton />
  ) : showEmpty ? (
    <EmptyOrders dateLabel={targetLabel} reason={mode === "cancelled" ? "cancelled" : "none"} onStart={startOrder} />
  ) : showEdit ? (
    <PhoneForm
      title={`Edit order for ${targetLabel}`}
      dateLabel={targetLabel}
      notice={editNotice}
      quantities={quantities}
      onChange={changeUnits}
      footer={cancelButton}
    />
  ) : showPlaced ? (
    afterCutoff ? (
      <AfterCutoffView
        closedDate={closedDate}
        runDate={target}
        lines={orders.map((order) => ({ kind: order.line.kind, units: order.line.units }))}
        receivedTime={clockTime(orders[0]?.receivedAt ?? currentTime)}
      />
    ) : (
      <>
        {closed}
        <ReceivedView orders={orders} now={currentTime} onEdit={startEdit} onSeeDeliveries={seeDeliveries} />
      </>
    )
  ) : showDraftAfterCutoff ? (
    <AfterCutoffView
      closedDate={closedDate}
      runDate={target}
      lines={draft.length > 0 ? draft : linesOf(DEFAULT_UNITS)}
    />
  ) : (
    <PhoneForm
      title={`Order for ${targetLabel}`}
      dateLabel={targetLabel}
      notice={notice}
      {...(queued ? { queuedAt: queued.at, pendingSync: true } : {})}
      quantities={quantities}
      onChange={changeUnits}
      disabled={submit === "sending" || submit === "queued"}
    />
  );

  const offlineBar =
    !online && showForm ? <>You're offline: this order isn't sent yet. It counts only once you see Received.</> : undefined;

  if (!desktop) {
    return (
      <>
        <PhoneLayout
          sync={syncState}
          bell={{}}
          {...(offlineBar ? { connectivity: offlineBar } : {})}
          {...(primary ? { actions: primary } : {})}
        >
          {phoneContent}
        </PhoneLayout>
        <Sheet open={reviewOpen && showForm} onOpenChange={setReviewOpen} title="Check your orders">
          {review}
        </Sheet>
      </>
    );
  }

  // ---- Desktop ------------------------------------------------------------
  const desktopForm = showForm || showEdit;
  const reviewButton = showEdit ? (
    <>
      {primary}
      {cancelButton}
    </>
  ) : (
    <Button
      disabled={placeCount === 0 || busy}
      onClick={() => (submit === "error" ? place(draft) : setReviewOpen(true))}
      busy={busy}
    >
      {busy
        ? "Sending…"
        : submit === "error"
          ? "Try again"
          : !online
            ? "Send when online"
            : `Review ${placeCount} ${placeCount === 1 ? "order" : "orders"}`}
    </Button>
  );

  return (
    <div className={styles.desktop}>
      <AppBar
        bell={{}}
        right={
          <>
            <span className={styles.today}>
              {dayLabel(toIsoDate(currentTime))} · {OUTLET.id}
            </span>
            <SyncChip state={syncState} />
          </>
        }
      />
      {desktopForm ? (
        <DesktopOrders
          title={showEdit ? `Edit order for ${targetLabel}` : `Order for ${targetLabel}`}
          dateLabel={targetLabel}
          notice={showEdit ? editNotice : notice}
          quantities={quantities}
          onChange={changeUnits}
          {...(queued ? { pendingSync: true } : {})}
          disabled={submit === "sending" || submit === "queued"}
          minutesLeft={minutesLeft}
          actions={reviewButton}
          recent={recent}
          onOpenDay={seeDeliveries}
        />
      ) : (
        <main className={styles.column}>
          {phoneContent}
          {primary && <div className={styles.columnAction}>{primary}</div>}
        </main>
      )}
      <Modal open={reviewOpen && showForm} onOpenChange={setReviewOpen} title="Check your orders">
        {review}
      </Modal>
    </div>
  );
}
