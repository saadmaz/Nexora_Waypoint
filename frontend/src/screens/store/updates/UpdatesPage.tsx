import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../../../app/StoreContext";
import { AppBar } from "../../../shared/chrome/AppBar";
import { ConnectivityBar } from "../../../shared/chrome/ConnectivityBar";
import { PhoneLayout } from "../../../shared/chrome/PhoneLayout";
import { SyncChip, type SyncState } from "../../../shared/chrome/TopBar";
import { Alert } from "../../../shared/ui/Alert";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { FilterChip } from "../../../shared/ui/FilterChip";
import { Icon } from "../../../shared/ui/Icon";
import { Mono } from "../../../shared/ui/Mono";
import { Segmented } from "../../../shared/ui/Segmented";
import { StateScreen } from "../../../shared/ui/StateScreen";
import { clockTime, dayLabel } from "../../../domain/format";
import type { RecentOrderDay } from "../../../domain/order";
import { OUTLET } from "../../../domain/outlet";
import { addDays, toIsoDate } from "../../../domain/schedule";
import { dayHeading, type StoreUpdate, type UpdatesFeed } from "../../../domain/update";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { useNow } from "../../../hooks/useNow";
import { useOnline } from "../../../hooks/useOnline";
import { DeliveriesSkeleton } from "../deliveries/DeliveriesSkeleton";
import { HistoryList } from "./HistoryList";
import { UpdateRow } from "./UpdateRow";
import styles from "./UpdatesPage.module.css";

/** Forces S4.S B, D and C for the dev server and the gallery. Empty is what an outlet with no orders shows. */
export type UpdatesPreview = "loading" | "error" | "offline";

export type UpdatesPageProps = {
  outletId?: string;
  /** Which segment: the feed (S4.1) or past delivery days (S4.2). */
  view: "updates" | "history";
  preview?: UpdatesPreview;
};

type Loaded = { feed: UpdatesFeed; recent: RecentOrderDay[]; at: string };
type Filter = "All" | "Deferred" | "Partial";
const FILTERS: Filter[] = ["All", "Deferred", "Partial"];

/**
 * S4 Updates and history, entered from the bell. The Updates segment is every change the order
 * record sends the store, newest first, grouped by day, with unread and "Mark all read". The
 * History segment is past delivery days, Monday to Saturday, filtered All, Deferred or Partial.
 */
export function UpdatesPage({ outletId = OUTLET.id, view, preview }: UpdatesPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { api, now, refreshUnread } = useStore();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const currentTime = useNow();
  const browserOnline = useOnline();
  const online = browserOnline && preview !== "offline";

  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(preview === "error");
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>("All");
  const [busy, setBusy] = useState(false);
  const loadedOnce = useRef(false);
  const minute = clockTime(currentTime);

  useEffect(() => {
    if (preview === "loading" || preview === "error") return;
    // Offline the screen keeps the last feed it loaded (S4.S C).
    if (!online && loadedOnce.current) return;
    let alive = true;
    void (async () => {
      try {
        const [feed, recent] = await Promise.all([api.getUpdates(outletId), api.listRecent(outletId, { limit: 8 })]);
        if (!alive) return;
        loadedOnce.current = true;
        setData({ feed, recent, at: clockTime(now()) });
        setFailed(false);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, outletId, minute, online, attempt, preview, now]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  /** Back to where the bell was tapped; with no history (a direct link) to the orders. */
  function back() {
    if (location.key !== "default") navigate(-1);
    else navigate("/store/orders");
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await api.markAllRead(outletId);
      refreshUnread();
      reload();
    } finally {
      setBusy(false);
    }
  }

  function open(update: StoreUpdate) {
    navigate(update.target.screen === "orders" ? "/store/orders" : `/store/deliveries/${update.target.date}`);
  }

  const today = toIsoDate(currentTime);
  const yesterday = toIsoDate(addDays(currentTime, -1));
  const syncState: SyncState = !online ? "offline" : "synced";
  const offlineNote: ReactNode =
    !online && data ? (
      <>
        You are offline. Showing updates saved on this phone. Last updated <Mono>{data.at}</Mono>.
      </>
    ) : undefined;

  let content: ReactNode;
  if (failed) {
    content = (
      <Alert tone="danger" icon="alert-circle" title="Couldn't load updates.">
        <span className={styles.errorBody}>Your orders and deliveries are safe. Nothing was changed.</span>
        <div className={styles.retry}>
          <Button variant="secondary" size="medium" auto icon="refresh-cw" onClick={reload}>
            Try again
          </Button>
        </div>
      </Alert>
    );
  } else if (!data) {
    content = <DeliveriesSkeleton label="Loading updates…" />;
  } else if (view === "updates" && data.feed.updates.length === 0) {
    content = (
      <StateScreen
        icon="truck"
        bg="surface-2"
        fg="ink-muted"
        title="Nothing new. You will see order, plan, delivery and deferral updates here."
        actions={
          <Button variant="ghost" size="medium" auto iconRight="chevron-right" onClick={back}>
            Back
          </Button>
        }
      />
    );
  } else {
    const segments = (
      <Segmented
        label="Updates or history"
        options={[
          { label: "Updates", selected: view === "updates", onSelect: () => navigate("/store/updates", { replace: true }) },
          { label: "History", selected: view === "history", onSelect: () => navigate("/store/history", { replace: true }) },
        ]}
      />
    );

    if (view === "updates") {
      const groups: { heading: string; rows: StoreUpdate[] }[] = [];
      for (const update of data.feed.updates) {
        const heading = dayHeading(update.date, today, yesterday, dayLabel(update.date));
        const last = groups.at(-1);
        if (last && last.heading === heading) last.rows.push(update);
        else groups.push({ heading, rows: [update] });
      }
      content = (
        <>
          <div className={styles.headerRow}>
            <h1 className={styles.title}>Updates</h1>
            {data.feed.unread > 0 ? (
              <Button variant="ghost" size="medium" auto disabled={busy || !online} onClick={() => void markAllRead()}>
                Mark all read
              </Button>
            ) : (
              <span className={styles.caughtUp} role="status">
                <Icon name="circle-check" size={16} />
                All caught up
              </span>
            )}
          </div>
          {segments}
          {groups.map((group) => (
            <section key={group.heading} aria-label={group.heading}>
              <h2 className={styles.day}>{group.heading}</h2>
              <Card padded={false}>
                <ul className={styles.list}>
                  {group.rows.map((update) => (
                    <UpdateRow key={update.id} update={update} onView={() => open(update)} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </>
      );
    } else {
      const shown = data.recent.filter((day) => filter === "All" || day.status === filter);
      content = (
        <>
          <h1 className={styles.title}>Updates</h1>
          {segments}
          <div className={styles.chips} role="group" aria-label="Filter delivery days">
            {FILTERS.map((option) => (
              <FilterChip key={option} selected={filter === option} onSelect={() => setFilter(option)}>
                {option}
              </FilterChip>
            ))}
          </div>
          <h2 className={styles.day}>Delivery days · Mon to Sat</h2>
          {shown.length === 0 ? (
            <p className={styles.none}>No {filter.toLowerCase()} delivery days.</p>
          ) : (
            <HistoryList days={shown} onOpen={(date) => navigate(`/store/deliveries/${date}`)} />
          )}
        </>
      );
    }
  }

  if (!desktop) {
    return (
      <PhoneLayout sync={syncState} onBack={back} {...(offlineNote ? { connectivity: offlineNote } : {})}>
        {failed || !data || (view === "updates" && data.feed.updates.length === 0) ? (
          <>
            <h1 className={styles.title}>Updates</h1>
            {content}
          </>
        ) : (
          content
        )}
      </PhoneLayout>
    );
  }

  return (
    <div className={styles.desktop}>
      <AppBar
        bell={{ unread: data?.feed.unread ?? 0 }}
        right={
          <>
            <span className={styles.today}>
              {dayLabel(today)} · {outletId}
            </span>
            <SyncChip state={syncState} />
          </>
        }
      />
      {offlineNote && <ConnectivityBar>{offlineNote}</ConnectivityBar>}
      <main className={styles.column}>
        {failed || !data || (view === "updates" && data.feed.updates.length === 0) ? (
          <>
            <h1 className={styles.title}>Updates</h1>
            {content}
          </>
        ) : (
          content
        )}
      </main>
    </div>
  );
}
