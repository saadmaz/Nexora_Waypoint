import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, CircleAlert, Clock3, Info, Lock, RefreshCw, Sparkles } from "lucide-react";
import { NO_FILTERS, type Brand, type DepotId, type OrderTemp, type QueueFilters } from "../../../api/DispatcherApi";
import { isPastCutoff } from "../../../domain/schedule";
import { Mono } from "../../../shared/ui/Mono";
import { useToast } from "../../../shared/ui/useToast";
import { AppBar } from "../chrome/AppBar";
import { PageHeader } from "../chrome/PageHeader";
import { ROUTES, withDepot } from "../chrome/routes";
import { Screen } from "../chrome/Screen";
import { Stepper } from "../chrome/Stepper";
import { dayLabel } from "../../../domain/format";
import { useDispatcher } from "../context";
import { useDepot, useLoad, useNow } from "../hooks";
import { Banner } from "../ui/Banner";
import { Btn } from "../ui/Btn";
import { Chip } from "../ui/Chip";
import { StateBlock } from "../ui/StateBlock";
import { Stat } from "../ui/Stat";
import { activeChips, isFiltering } from "./filters";
import { FiltersPanel } from "./FiltersPanel";
import { HistoryDrawer } from "./HistoryDrawer";
import { KandyTable, QueueSkeletonTable, QueueTable } from "./QueueTable";
import styles from "./QueueRoute.module.css";


/** `?filter=Fresh,chilled` opens the queue filtered, for the state gallery and for links from elsewhere. */
function parseFilters(raw: string | null): QueueFilters {
  const filters: QueueFilters = { ...NO_FILTERS };
  for (const token of (raw ?? "").split(",").filter(Boolean)) {
    const t = token.trim().toLowerCase();
    if (t === "fresh" || t === "style" || t === "tech") filters.brand = [...filters.brand, (t[0]!.toUpperCase() + t.slice(1)) as Brand];
    else if (t === "chilled" || t === "ambient") filters.temp = [...filters.temp, t as OrderTemp];
    else if (t === "carry-over") filters.tags = [...filters.tags, "Carry-over"];
    else if (t === "no-legal-vehicle") filters.tags = [...filters.tags, "No legal vehicle"];
  }
  return filters;
}

/** D1: the order queue (PRD v3 section 3). Before the cutoff it fills live; after it, carry-overs are pinned first. */
export function QueueRoute() {
  const { api, offline, preview, scenarioDays } = useDispatcher();
  const navigate = useNavigate();
  const now = useNow();
  const [depot, setDepot] = useDepot();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState<QueueFilters>(() => parseFilters(params.get("filter")));
  const [panel, setPanel] = useState(params.get("panel") === "filters");
  const [search, setSearch] = useState("");
  const orderId = params.get("order");

  const filterKey = JSON.stringify(filters);
  const load = useLoad(() => api.getQueue({ depot, filters, search }), [depot, filterKey, search], 20_000);
  const history = useLoad(() => (orderId ? api.getOrderHistory(orderId) : Promise.resolve(undefined)), [orderId]);

  const view = load.data;
  const day = view?.serviceDate ?? scenarioDays.serviceDate;
  const closed = view?.cutoff.closed ?? isPastCutoff(day, now);
  const filtering = isFiltering(filters) || search.trim() !== "";
  const cached = Boolean(view) && (offline || load.status === "error");
  const chips = useMemo(() => activeChips(filters, setFilters), [filters]);

  // Once the queue has closed, whether a plan exists yet: without one the dispatcher drafts it here
  // rather than waiting for the 16:05 job, so the walkthrough runs whatever time the clock is at.
  const plan = useLoad(() => (closed ? api.getPlan({ depot }) : Promise.resolve(undefined)), [closed, depot]);
  const noPlanYet = closed && plan.data !== undefined && plan.data.version.number === 0;
  const toast = useToast();
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const draftPlan = async () => {
    setDrafting(true);
    setDraftError(null);
    try {
      const next = await api.redraftPlan();
      toast.show(`Drafted plan v${next.version.number}. Trips placed by the planner.`);
      navigate(withDepot(ROUTES.trips, depot));
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "The plan could not be drafted.");
    } finally {
      setDrafting(false);
    }
  };

  const open = (id: string) => setParams((p) => { const next = new URLSearchParams(p); next.set("order", id); return next; });
  const closeDrawer = () => setParams((p) => { const next = new URLSearchParams(p); next.delete("order"); return next; });
  const goCapacity = () => navigate(withDepot(ROUTES.capacity, depot));
  const changeDepot = (next: DepotId) => setDepot(next);
  const atRisk = () => {
    setFilters({ ...NO_FILTERS, tags: ["No legal vehicle"] });
    setDepot("peliyagoda");
  };

  const minutesLeft = view?.cutoff.minutesLeft;
  const addon = closed ? (
    depot === "kandy" && view ? (
      <Chip tone="neutral" pill>
        Kandy · {view.counts.kandy} orders · {view.carryOvers} carry-overs
      </Chip>
    ) : undefined
  ) : (
    <Chip tone="warning" pill icon={<Clock3 size={14} />} mono>
      Cutoff 16:00{minutesLeft !== undefined ? ` · ${minutesLeft} min left` : ""}
    </Chip>
  );

  const header = (
    <PageHeader
      overline={`PLAN FOR ${dayLabel(day).toUpperCase()} · RUN 1`}
      title={`Orders for ${dayLabel(day)}`}
      titleAddon={addon}
      actions={
        <>
          {noPlanYet && (
            <Btn variant="secondary" icon={<Sparkles size={16} />} disabled={offline || drafting} onClick={() => void draftPlan()}>
              {drafting ? "Placing trips..." : "Draft plan"}
            </Btn>
          )}
          <Btn iconRight={<ChevronRight size={16} />} disabled={!closed} onClick={goCapacity}>
            Go to capacity board
          </Btn>
        </>
      }
      reason={
        closed ? undefined : (
          <>
            <Lock size={13} />
            Opens at cutoff, 16:00
          </>
        )
      }
    >
      <Stepper current={1} depot={depot} next={closed} />
    </PageHeader>
  );

  let body;
  if (load.status === "loading") {
    body = <QueueSkeletonTable />;
  } else if (load.status === "error" && !view) {
    body = (
      <div className={styles.stateCard}>
        <div className={styles.stateHeader}>
          <div>
            <b>Tomorrow’s order queue</b>
            <span>Filling live until the 16:00 cutoff</span>
          </div>
          <span className={styles.statusDot}>Queue status</span>
        </div>
        <div className={styles.stateBody}>
          <Banner
            tone="danger"
            icon={<CircleAlert size={20} />}
            title="Couldn't load orders"
            actions={
              <Btn variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load.reload}>
                Retry
              </Btn>
            }
          >
            Your filters are kept.
          </Banner>
        </div>
      </div>
    );
  } else if (view && view.shown === 0 && !filtering) {
    body = (
      <div className={styles.stateCard}>
        <div className={styles.stateHeader}>
          <div>
            <b>Tomorrow’s order queue</b>
            <span>Filling live until the 16:00 cutoff</span>
          </div>
          <span className={styles.statusDot}>Queue status</span>
        </div>
        <div className={styles.emptyBody}>
          <StateBlock
            icon={<Clock3 size={24} />}
            title={`No confirmed orders for ${dayLabel(day)} yet`}
            body="Cutoff at 16:00."
            facts={
              <>
                Cutoff <Mono>16:00</Mono> · Orders so far <Mono>0</Mono>
              </>
            }
            action={
              <Btn variant="secondary" size="sm" onClick={load.reload}>
                Refresh
              </Btn>
            }
          />
        </div>
      </div>
    );
  } else if (view) {
    const table = {
      depot,
      view,
      search,
      onSearch: setSearch,
      onDepot: changeDepot,
      onFilters: () => setPanel((p) => !p),
      filtersOpen: panel,
      chips,
      filtering,
      onAtRisk: atRisk,
      onOpen: open,
      cached,
    };
    body = (
      <>
        {!closed && (
          <>
            <div className={styles.summary}>
              Peliyagoda {view.counts.peliyagoda} orders · Kandy {view.counts.kandy} orders
            </div>
            <div className={styles.tiles}>
              <Stat label="Orders in queue" value={view.counts[depot === "kandy" ? "kandy" : "peliyagoda"]} sans aside={<span className={styles.aside}>{depot === "kandy" ? "Kandy" : "Peliyagoda"} · still open</span>} />
              <Stat label={depot === "kandy" ? "Peliyagoda" : "Kandy"} value={view.counts[depot === "kandy" ? "peliyagoda" : "kandy"]} sans />
              <Stat
                label="Carry-overs"
                value={view.carryOvers}
                sans
                aside={
                  view.carryOvers > 0 ? (
                    <span className={styles.asideWarn}>
                      <Clock3 size={15} />
                      Deferred yesterday: protected
                    </span>
                  ) : undefined
                }
              />
            </div>
          </>
        )}
        {closed && depot === "peliyagoda" && !filtering && (
          <Banner tone="info" icon={<Info size={20} />} title={`Cutoff closed at 16:00, ${view.counts.peliyagoda} orders confirmed for ${dayLabel(day)}`}>
            {view.carryOvers} carry-overs from yesterday are pinned first.
          </Banner>
        )}
        {drafting && (
          <Banner tone="info" icon={<Sparkles size={20} />} title="Placing trips for every vehicle">
            The planner checks each order against weight, volume, temperature, outlet access, delivery windows and the
            weekly fuel quota. On a full day this takes up to a minute.
          </Banner>
        )}
        {draftError && (
          <Banner
            tone="danger"
            icon={<CircleAlert size={20} />}
            title="The plan was not drafted"
            actions={
              <Btn variant="secondary" size="sm" onClick={() => setDraftError(null)}>
                Dismiss
              </Btn>
            }
          >
            {draftError}
          </Banner>
        )}
        {depot === "kandy" ? <KandyTable {...table} /> : <QueueTable {...table} />}
      </>
    );
  } else {
    body = <QueueSkeletonTable />;
  }

  return (
    <Screen
      bar={<AppBar current="plan" depot={depot} onDepot={changeDepot} />}
      offlineNote="Connection lost: showing the queue as of {time}. New orders appear when you reconnect."
    >
      <div className={styles.page}>
        {header}
        {body}
      </div>
      {panel && (
        <FiltersPanel
          filters={filters}
          depot={depot}
          onApply={(next) => {
            setFilters(next);
            setPanel(false);
          }}
          onDepot={changeDepot}
          onClose={() => setPanel(false)}
        />
      )}
      <HistoryDrawer
        open={Boolean(orderId)}
        onOpenChange={(o) => {
          if (!o) closeDrawer();
        }}
        orderId={orderId}
        history={history.data}
        failed={history.status === "error" && !history.data}
      />
      <span hidden>{preview}</span>
    </Screen>
  );
}
