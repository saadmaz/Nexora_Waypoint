import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CutoffError } from "../../../api/StoreApi";
import { AppBar } from "../../../shared/chrome/AppBar";
import { PhoneLayout } from "../../../shared/chrome/PhoneLayout";
import { SyncChip, type SyncState } from "../../../shared/chrome/TopBar";
import { Alert } from "../../../shared/ui/Alert";
import { Button } from "../../../shared/ui/Button";
import { Modal } from "../../../shared/ui/Modal";
import { Mono } from "../../../shared/ui/Mono";
import { Sheet } from "../../../shared/ui/Sheet";
import { LoadingSkeleton } from "../../../shared/ui/StateScreen";
import { useToast } from "../../../shared/ui/useToast";
import { useUnsavedWork } from "../../../shared/unsavedWork";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { useNow } from "../../../hooks/useNow";
import { useOnline } from "../../../hooks/useOnline";
import { estimateFor } from "../../../domain/estimate";
import { clockTime, dayLabel, weekdayShort } from "../../../domain/format";
import type { NewOrderInput, OrderDraft, OrderKind, RecentOrderDay, UnitFactors } from "../../../domain/order";
import { OUTLET } from "../../../domain/outlet";
import {
  addDays,
  isAfterCutoff,
  minutesUntilCutoff,
  nextOperatingDayAfter,
  operatingDayFor,
  toIsoDate,
} from "../../../domain/schedule";
import { useStore } from "../../../app/StoreContext";
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
 * Forces one of the state frames for the gallery and the dev server: S1.5 A (offline, and queued),
 * B (error), C (sending) and D (empty), S1.2 and S1.6 B (the review open), S1.3 B (edit order at
 * 10 units, A25) and S1.3 D (cancelled).
 */
export type OrdersPreview = "offline" | "queued" | "error" | "sending" | "empty" | "review" | "edit" | "cancelled";

export type OrdersPageProps = {
  preview?: OrdersPreview;
};

type Mode = "view" | "edit" | "cancelled";
type Submit = "idle" | "sending" | "error" | "queued";
type Line = { kind: OrderKind; units: number };
type Quantities = Record<OrderKind, number>;

/** Stand-in while the form loads; never shown, because loading renders a skeleton. */
const NO_FACTORS: UnitFactors = { chilled: { kg: 0, m3: 0 }, dry: { kg: 0, m3: 0 } };

function linesOf(quantities: Quantities): Line[] {
  return KINDS.filter((kind) => quantities[kind] > 0).map((kind) => ({ kind, units: quantities[kind] }));
}

function toInput(line: Line, deliveryDate: string, factors: UnitFactors): NewOrderInput {
  const { kg, m3 } = estimateFor(factors, line.kind, line.units);
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
export function OrdersPage({ preview }: OrdersPageProps) {
  const navigate = useNavigate();
  const { api, now, unread } = useStore();
  const toast = useToast();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const currentTime = useNow();
  const browserOnline = useOnline();
  const online = browserOnline && preview !== "offline" && preview !== "queued";

  // The API's order form for the target day: window, unit factors, starting quantities, placed orders.
  const [day, setDay] = useState<OrderDraft | null>(null);
  const [recent, setRecent] = useState<RecentOrderDay[]>([]);
  const [mode, setMode] = useState<Mode>(preview === "edit" ? "edit" : preview === "cancelled" ? "cancelled" : "view");
  // What the store has typed into the steppers; until then the API's starting quantities.
  const [edited, setEdited] = useState<Quantities | null>(preview === "edit" ? { chilled: 10, dry: 8 } : null);
  const [submit, setSubmit] = useState<Submit>(
    preview === "sending" ? "sending" : preview === "error" ? "error" : preview === "queued" ? "queued" : "idle",
  );
  const [queued, setQueuedState] = useState<{ at: string; lines: Line[] } | null>(null);
  // The ref is what the online handler reads, so a second event finds the queue already taken.
  const queuedRef = useRef<{ at: string; lines: Line[] } | null>(null);
  const setQueued = useCallback((value: { at: string; lines: Line[] } | null) => {
    queuedRef.current = value;
    setQueuedState(value);
  }, []);
  const [reviewOpen, setReviewOpen] = useState(preview === "review");
  const [closedNotice, setClosedNotice] = useState(false);

  const target = operatingDayFor(currentTime);
  const afterCutoff = isAfterCutoff(currentTime);
  const targetLabel = dayLabel(target);
  /** The day whose 16:00 cutoff has just passed, for "Orders for Tue 29 Sep closed at 16:00". */
  const closedDate = toIsoDate(addDays(currentTime, 1));
  const minutesLeft = minutesUntilCutoff(target, currentTime);
  const current = day && day.deliveryDate === target ? day : null;
  const orders = current?.orders ?? [];
  const factors = current?.unitFactors ?? NO_FACTORS;
  const quantities: Quantities = edited ?? current?.defaultUnits ?? { chilled: 0, dry: 0 };

  const reload = useCallback(async () => {
    setDay(await api.getOrderDraft(OUTLET.id, target));
  }, [api, target]);

  // Load the day's form, and reload it when the clock rolls the target day over at 16:00.
  useEffect(() => {
    let alive = true;
    void Promise.all([api.getOrderDraft(OUTLET.id, target), api.listRecent(OUTLET.id, { limit: 5, before: toIsoDate(now()) })]).then(([d, r]) => {
      if (!alive) return;
      setDay(d);
      setRecent(r);
      if (preview === "queued" && !queuedRef.current) {
        setQueued({ at: clockTime(now()), lines: linesOf(d.defaultUnits) });
      }
    });
    return () => {
      alive = false;
    };
  }, [api, target, preview, now, setQueued]);

  // Two `online` events, or a double tap, must not place the same order twice.
  const inFlight = useRef(false);

  const send = useCallback(
    async (lines: Line[]) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSubmit("sending");
      try {
        if (!current) throw new Error("The order form has not loaded.");
        const placed = await api.placeOrders(lines.map((line) => toInput(line, target, factors)));
        await reload();
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
    [api, target, current, factors, reload, afterCutoff, toast, setQueued],
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
    setEdited({ ...quantities, [kind]: units });
    if (submit === "error") setSubmit("idle");
  }

  function startOrder() {
    setEdited(null);
    setMode("view");
  }

  function startEdit() {
    const next: Quantities = { chilled: 0, dry: 0 };
    for (const order of orders) next[order.line.kind] = order.line.units;
    setEdited(next);
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
    if (!current) return;
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
          const { kg, m3 } = estimateFor(factors, kind, units);
          await api.editOrder(order.id, { units, estimatedKg: kg, estimatedM3: m3 });
        }
      }
      if (fresh.length > 0) await api.placeOrders(fresh.map((line) => toInput(line, target, factors)));
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
      setEdited(null);
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
  const loading = current === null;
  const showEmpty = !loading && orders.length === 0 && (mode === "cancelled" || preview === "empty");
  const showPlaced = !loading && orders.length > 0 && mode !== "edit";
  const showEdit = !loading && orders.length > 0 && mode === "edit";
  const showDraftAfterCutoff = !loading && orders.length === 0 && !showEmpty && afterCutoff;
  const showForm = !loading && orders.length === 0 && !showEmpty && !afterCutoff;

  // Edits and an order queued offline live only in this page's state, so log out asks before dropping them.
  const unplacedChanges = ((showForm || showDraftAfterCutoff) && edited !== null) || showEdit;
  useUnsavedWork(
    "store.orders",
    submit === "queued" && queued
      ? "An order is waiting for the connection. It will not be sent if you log out."
      : unplacedChanges
        ? "Your order changes are not placed yet."
        : null,
  );

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

  // S1.6 draws no cutoff alert: the countdown is the card beside the form. A failed send and a
  // queued order still need telling.
  const desktopNotice: ReactNode = submit === "error" ? errorAlert : !online && !showEdit ? notice : null;

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
      factors={factors}
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
      lines={draft}
    />
  ) : (
    <PhoneForm
      title={`Order for ${targetLabel}`}
      dateLabel={targetLabel}
      notice={notice}
      {...(queued ? { queuedAt: queued.at, pendingSync: true } : {})}
      quantities={quantities}
      factors={factors}
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
          bell={{ unread }}
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
        bell={{ unread }}
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
          {...(desktopNotice ? { notice: desktopNotice } : {})}
          quantities={quantities}
          factors={factors}
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
