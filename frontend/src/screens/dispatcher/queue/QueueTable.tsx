import type { ReactNode } from "react";
import { AlertTriangle, ChevronDown, Clock3, LockKeyhole, RefreshCw, Search, ListFilter, X } from "lucide-react";
import type { DepotId, QueueGroup, QueueOrder, QueueView } from "../../../api/DispatcherApi";
import { Mono } from "../../../shared/ui/Mono";
import { BrandChip, Chip, TempChip } from "../ui/Chip";
import { cx } from "../ui/cx";
import { StatusChip } from "../ui/StatusChip";
import styles from "./QueueTable.module.css";

const HEAD = ["Order ID", "Outlet", "Brand", "District", "Temp", "Access / dock", "Window", "Units", "Kg", "M³", "Status", "Received"];
const SORTABLE = new Set(["Order ID", "Window", "Units", "Kg"]);
const NUM = new Set(["Units", "Kg", "M³"]);

const num = (n: number) => n.toLocaleString("en-US");

function HeadRow({ columns }: { columns: string[] }) {
  return (
    <div className={cx(styles.head, styles.cols)} role="row">
      {columns.map((h) => (
        <div key={h} role="columnheader" className={cx(styles.th, NUM.has(h) && styles.num, h === "Received" && styles.center)}>
          {h}
          {SORTABLE.has(h) && <ChevronDown size={12} aria-hidden />}
        </div>
      ))}
    </div>
  );
}

/** The access and dock tags, or a plain text line in the filtered table. */
function Access({ order }: { order: QueueOrder }) {
  if (order.access.length === 0) return null;
  return (
    <div className={styles.tags}>
      {order.access.map((a) => (
        <Chip key={a} tone="outlineInk" small>
          {a}
        </Chip>
      ))}
    </div>
  );
}

function StatusCell({ order }: { order: QueueOrder }) {
  return (
    <div className={styles.statusCell}>
      <div className={styles.tags}>
        <StatusChip status={order.status} small />
        {order.tags.includes("Carry-over") && (
          <Chip tone="outlineInk" small icon={<Clock3 size={12} />}>
            Carry-over
          </Chip>
        )}
        {order.tags.includes("Protected") && (
          <Chip tone="outlineInk" small icon={<LockKeyhole size={12} />}>
            Protected
          </Chip>
        )}
        {order.tags.includes("No legal vehicle") && (
          <Chip tone="warningOutline" small icon={<AlertTriangle size={12} />}>
            No legal vehicle
          </Chip>
        )}
        {order.tags.includes("After cutoff") && (
          <Chip tone="warningOutline" small icon={<Clock3 size={12} />}>
            After cutoff
          </Chip>
        )}
      </div>
      {order.note && <span className={styles.note}>{order.note}</span>}
    </div>
  );
}

function Received({ order }: { order: QueueOrder }) {
  if (order.daysSinceServed !== undefined && order.tags.includes("Carry-over")) {
    return (
      <span className={styles.age}>
        {order.daysSinceServed} days since
        <br />
        served
      </span>
    );
  }
  return <Mono>{order.receivedAt}</Mono>;
}

function Row({ order, closed, onOpen }: { order: QueueOrder; closed: boolean; onOpen: (id: string) => void }) {
  const tall = order.tags.includes("Carry-over") || Boolean(order.note);
  const flagged = order.tags.includes("No legal vehicle");
  return (
    <div
      role="row"
      tabIndex={0}
      className={cx(styles.row, styles.cols, tall && styles.tall, flagged && styles.flagged, order.justIn && styles.justIn)}
      onClick={() => onOpen(order.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(order.id);
        }
      }}
      aria-label={`Order ${order.id}, ${order.outletId}`}
    >
      <div className={styles.td}>
        <div className={styles.idCell}>
          <Mono>{order.id}</Mono>
          {order.justIn && <span className={styles.justInLabel}>Just in</span>}
        </div>
      </div>
      <div className={cx(styles.td, styles.outlet)}>
        <Mono>{order.outletId}</Mono>
      </div>
      <div className={styles.td}>
        <BrandChip brand={order.brand} small />
      </div>
      <div className={styles.td}>{order.district}</div>
      <div className={styles.td}>
        <TempChip temp={order.temp} small />
      </div>
      <div className={styles.td}>
        <Access order={order} />
      </div>
      <div className={styles.td}>
        {order.mallWindow ? (
          <Chip tone="outlineInk" small mono>
            Mall {order.window.start}–{order.window.end}
          </Chip>
        ) : (
          <Mono>
            {order.window.start}–{order.window.end}
          </Mono>
        )}
      </div>
      <div className={cx(styles.td, styles.num)}>
        <Mono>{order.units} units</Mono>
      </div>
      <div className={cx(styles.td, styles.num)}>
        <Mono>{num(order.kg)} kg</Mono>
      </div>
      <div className={cx(styles.td, styles.num)}>
        <Mono>{order.m3.toFixed(1)} m³</Mono>
      </div>
      <div className={styles.td}>
        <StatusCell order={order} />
      </div>
      <div className={cx(styles.td, styles.center, styles.received, !closed && styles.receivedOpen)}>
        <Received order={order} />
      </div>
    </div>
  );
}

function GroupRow({ group }: { group: QueueGroup }) {
  return (
    <div className={cx(styles.group, group.kind === "carry" && styles.groupCarry)}>
      {group.kind === "carry" && <Clock3 size={14} />}
      {group.title}
    </div>
  );
}

export type ToolbarProps = {
  depot: DepotId;
  view: QueueView;
  search: string;
  onSearch: (value: string) => void;
  onDepot: (depot: DepotId) => void;
  onFilters: () => void;
  filtersOpen: boolean;
  chips: { label: string; remove: () => void }[];
  filtering: boolean;
  onAtRisk: () => void;
  children?: ReactNode;
};

function Toolbar({ depot, view, search, onSearch, onDepot, onFilters, filtersOpen, chips, filtering, onAtRisk }: ToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <label className={styles.search}>
          <Search size={16} />
          <input placeholder="Search order or outlet" aria-label="Search order or outlet" value={search} onChange={(e) => onSearch(e.target.value)} />
        </label>
        <button type="button" className={cx(styles.filterButton, (filtersOpen || filtering) && styles.filterButtonOn)} onClick={onFilters} aria-pressed={filtersOpen}>
          <ListFilter size={15} />
          Filters
        </button>
        {chips.map((c) => (
          <span key={c.label} className={styles.filterChip}>
            {c.label}
            <button type="button" aria-label={`Remove ${c.label}`} onClick={c.remove}>
              <X size={13} />
            </button>
          </span>
        ))}
        {filtering && view.matching !== undefined && (
          <Mono>
            <span className={styles.matching}>
              Showing {view.matching} of {view.total}
            </span>
          </Mono>
        )}
      </div>
      <div className={styles.toolbarRight}>
        <button
          type="button"
          className={cx(styles.atRisk, view.atRisk === 0 && styles.atRiskZero)}
          onClick={onAtRisk}
          aria-label={`At risk: ${view.atRisk}. Show the orders with no legal vehicle.`}
        >
          <AlertTriangle size={12} />
          At risk: {view.atRisk}
        </button>
        <div className={styles.segment} role="radiogroup" aria-label="Depot">
          {(["peliyagoda", "kandy"] as DepotId[]).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={depot === d} className={cx(depot === d && styles.segmentOn)} onClick={() => onDepot(d)}>
              {d === "peliyagoda" ? "Peliyagoda" : "Kandy"}
              <Mono>{view.counts[d]}</Mono>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export type QueueTableProps = ToolbarProps & {
  onOpen: (orderId: string) => void;
  cached: boolean;
};

/** Peliyagoda's queue after the cutoff: carry-overs pinned first, then the other orders (PRD v3 section 3 D1). */
export function QueueTable(props: QueueTableProps) {
  const { view, onOpen, cached } = props;
  const closed = view.cutoff.closed;
  const hidden = view.hiddenCarryOvers;
  return (
    <div className={styles.card} role="table" aria-label="Confirmed orders">
      {closed ? (
        <Toolbar {...props} />
      ) : (
        <div className={styles.openHeader}>
          <div className={styles.openTitle}>
            <b>Tomorrow’s order queue</b>
            <span>Filling live until the 16:00 cutoff</span>
          </div>
          <div className={styles.openRight}>
            <button type="button" className={cx(styles.atRisk, view.atRisk === 0 && styles.atRiskZero)} onClick={props.onAtRisk}>
              <AlertTriangle size={12} />
              At risk: {view.atRisk}
            </button>
            <span className={cached ? styles.cachedDot : styles.liveDot}>{cached ? "Cached queue" : "Live arrivals"}</span>
          </div>
        </div>
      )}
      {hidden > 0 && (
        <div className={styles.hiddenBanner}>
          <AlertTriangle size={16} />
          <span>
            {hidden} carry-over{hidden === 1 ? "" : "s"} hidden by filters
          </span>
          <button type="button" onClick={props.onFilters}>
            show
          </button>
        </div>
      )}
      <HeadRow columns={HEAD} />
      {view.groups.map((group) => (
        <div key={group.key} role="rowgroup">
          {closed && <GroupRow group={group} />}
          {group.orders.map((o) => (
            <Row key={o.id} order={o} closed={closed} onOpen={onOpen} />
          ))}
        </div>
      ))}
      <div className={styles.footer}>
        <span>
          {props.filtering
            ? `Showing ${view.shown} of ${view.total} ${props.depot === "kandy" ? "Kandy" : "Peliyagoda"} orders`
            : `Showing ${view.shown} of ${view.total} ${closed ? "confirmed " : ""}${props.depot === "kandy" ? "Kandy" : "Peliyagoda"} orders`}
        </span>
        <span>
          {cached
            ? "Cached queue · reconnect to refresh"
            : closed
              ? `Carry-overs pinned first${view.groups.some((g) => g.orders.some((o) => o.tags.includes("After cutoff"))) ? " · 1 received after cutoff" : ""}`
              : "Received = order arrival time"}
        </span>
      </div>
    </div>
  );
}

/** Kandy's queue: grouped by outlet, because one outlet can send several order records that stay separate (D1.3). */
export function KandyTable(props: QueueTableProps) {
  const { view, onOpen } = props;
  const columns = ["Order record", "Handling", "Window", "Units", "Kg", "M³", "Status", "Received"];
  return (
    <div className={styles.card} role="table" aria-label="Kandy orders grouped by outlet">
      <Toolbar {...props} />
      <div className={cx(styles.head, styles.kcols)} role="row">
        {columns.map((h) => (
          <div key={h} role="columnheader" className={cx(styles.th, NUM.has(h) && styles.num, h === "Received" && styles.center)}>
            {h}
            {SORTABLE.has(h) || h === "Order record" ? <ChevronDown size={12} aria-hidden /> : null}
          </div>
        ))}
      </div>
      {view.groups.map((group) => (
        <div key={group.key} role="rowgroup">
          <div className={styles.outletGroup}>
            <div className={styles.outletLine}>
              <span className={styles.outletName}>
                <ChevronDown size={15} />
                <b>{group.title}</b>
              </span>
              {group.outlet?.note && <span className={styles.outletNote}>{group.outlet.note}</span>}
            </div>
            {group.outlet?.brand && (
              <div className={styles.outletMeta}>
                <BrandChip brand={group.outlet.brand} />
                {group.outlet.dock && (
                  <Chip tone="outlineInk" small>
                    {group.outlet.dock}
                  </Chip>
                )}
                {group.outlet.window && (
                  <span className={styles.outletWindow}>
                    <Clock3 size={13} />
                    <Mono>
                      {group.outlet.window.start}–{group.outlet.window.end}
                    </Mono>
                  </span>
                )}
              </div>
            )}
          </div>
          {group.orders.map((o, index) => (
            <div
              key={o.id}
              role="row"
              tabIndex={0}
              className={cx(styles.row, styles.kcols, styles.tall, styles.kandyRow)}
              onClick={() => onOpen(o.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(o.id);
                }
              }}
              aria-label={`Order ${o.id}, ${o.outletId}`}
            >
              <span className={cx(styles.connector, index === group.orders.length - 1 && styles.connectorLast)} aria-hidden />
              <div className={cx(styles.td, styles.recordCell)}>
                <Mono>{o.id}</Mono>
              </div>
              <div className={styles.td}>
                <TempChip temp={o.temp} dry={o.temp === "ambient"} />
              </div>
              <div className={styles.td}>
                <Mono>
                  {o.window.start}–{o.window.end}
                </Mono>
              </div>
              <div className={cx(styles.td, styles.num)}>
                <Mono>{o.units} units</Mono>
              </div>
              <div className={cx(styles.td, styles.num)}>
                <Mono>{num(o.kg)} kg</Mono>
              </div>
              <div className={cx(styles.td, styles.num)}>
                <Mono>{o.m3.toFixed(1)} m³</Mono>
              </div>
              <div className={styles.td}>
                <StatusChip status={o.status} small />
              </div>
              <div className={cx(styles.td, styles.center, styles.received)}>
                <Mono>{o.receivedAt}</Mono>
              </div>
            </div>
          ))}
        </div>
      ))}
      <div className={styles.footer}>
        <span>
          Showing {view.shown} of {view.total} Kandy orders
        </span>
        <span>Grouped by outlet · order records remain separate</span>
      </div>
    </div>
  );
}

export function QueueSkeletonTable() {
  const rows = Array.from({ length: 10 }, (_, i) => i);
  return (
    <div className={styles.card} aria-busy="true">
      <div className={styles.openHeader}>
        <div className={styles.openTitle}>
          <b>Tomorrow’s order queue</b>
          <span>Filling live until the 16:00 cutoff</span>
        </div>
        <span className={styles.liveDot}>Preparing queue</span>
      </div>
      <HeadRow columns={HEAD} />
      {rows.map((i) => (
        <div key={i} className={cx(styles.row, styles.cols)} aria-hidden>
          {HEAD.map((h, c) => (
            <div key={h} className={cx(styles.td, NUM.has(h) && styles.num, h === "Received" && styles.center)}>
              <span className={styles.bone} style={{ width: 30 + ((i * 7 + c * 13) % 40) }} />
            </div>
          ))}
        </div>
      ))}
      <div className={styles.loadingLine}>
        <RefreshCw size={16} className={styles.spin} />
        Loading orders...
      </div>
    </div>
  );
}

