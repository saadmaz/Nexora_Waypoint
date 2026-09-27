import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  ClockArrowDown,
  Info,
  ListFilter,
  Lock,
  LockKeyhole,
  NotebookPen,
  RefreshCw,
  Search,
  TriangleAlert,
  CircleAlert,
  X,
} from 'lucide-react';
import { AppBar, ConnectivityBar, PageHeader, Screen, Stepper, useFrame, useGo } from '../components/shell';
import type { Depot } from '../components/shell';
import { Alert, BrandTag, Button, CloseButton, Drawer, M, MockTag, Skel, StateBlock, Tag, TempTag, cx } from '../components/ui';
import { kandyGroups, peliyagodaQueue } from '../data/orders';
import type { QueueOrder } from '../data/orders';
import './queue.css';

type Frame = 'D1.1' | 'D1.2' | 'D1.3' | 'D1.4' | 'D1.5' | 'D1.S-empty' | 'D1.S-loading' | 'D1.S-offline' | 'D1.S-error';

const W = {
  pre: [105, 70, 80, 90, 90, 155, 145, 82, 85, 72, 310, 90],
  post: [95, 68, 72, 82, 78, 140, 132, 78, 82, 66, 386, 97],
};
const HEAD = ['Order ID', 'Outlet', 'Brand', 'District', 'Temp', 'Access / dock', 'Window', 'Units', 'Kg', 'M³', 'Status', 'Received'];
const NUM = new Set([7, 8, 9]);

function HeadRow({ widths }: { widths: number[] }) {
  return (
    <div className="wp-thead" role="row">
      {HEAD.map((h, i) => (
        <div key={h} role="columnheader" className={cx('wp-th', NUM.has(i) && 'is-num', i === 11 && 'is-center', i === 11 && 'q-last')} style={{ width: widths[i] }}>
          {h}
        </div>
      ))}
    </div>
  );
}

function Toolbar({ depot, onDepot, onFilters }: { depot: Depot; onDepot: (d: Depot) => void; onFilters: () => void }) {
  return (
    <div className="wp-table__toolbar" style={{ padding: '0 12px' }}>
      <div className="wp-row" style={{ gap: 8 }}>
        <label className="wp-search">
          <Search size={16} />
          <input placeholder="Search order or outlet" aria-label="Search order or outlet" />
        </label>
        <Button variant="secondary" icon={<ListFilter size={15} />} onClick={onFilters} style={{ fontSize: 13, padding: '0 14px' }}>
          Filters
        </Button>
      </div>
      <div className="wp-segment" role="radiogroup" aria-label="Depot">
        {(['Peliyagoda', 'Kandy'] as Depot[]).map((d) => (
          <button key={d} role="radio" aria-checked={depot === d} className={cx(depot === d && 'is-selected')} onClick={() => onDepot(d)}>
            {d}
            <span className="mono">{d === 'Peliyagoda' ? 212 : 64}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- D1.1 before cutoff ---------- */
function PreCutoffTable() {
  const w = W.pre;
  return (
    <div className="wp-card wp-table" role="table" aria-label="Tomorrow’s order queue">
      <div className="wp-table__toolbar">
        <div className="wp-table__title">
          <b>Tomorrow’s order queue</b>
          <span>Filling live until the 16:00 cutoff</span>
        </div>
        <span className="wp-live-dot">Live arrivals</span>
      </div>
      <HeadRow widths={w} />
      {peliyagodaQueue.map((o) => (
        <div key={o.id} role="row" className={cx('wp-tr', o.justIn && 'is-selected q-justin')}>
          <div className="wp-td" style={{ width: w[0], paddingLeft: 8 }}>
            <div className="wp-col">
              <M style={{ fontSize: 13 }}>{o.id}</M>
              {o.justIn && <span className="q-justin__label">Just in</span>}
            </div>
          </div>
          <div className="wp-td" style={{ width: w[1] }}>
            <M>{o.outlet}</M>
          </div>
          <div className="wp-td" style={{ width: w[2] }}>
            <BrandTag brand={o.brand} />
          </div>
          <div className="wp-td" style={{ width: w[3] }}>
            {o.district}
          </div>
          <div className="wp-td" style={{ width: w[4] }}>
            <TempTag temp={o.temp} icon={o.temp === 'Chilled'} />
          </div>
          <div className="wp-td" style={{ width: w[5] }}>
            <div className="wp-tags">
              {o.access.map((a) => (
                <Tag key={a} tone="outline">
                  {a}
                </Tag>
              ))}
            </div>
          </div>
          <div className="wp-td" style={{ width: w[6] }}>
            {o.windowTag ? <Tag tone="outline">{o.window}</Tag> : <M>{o.window}</M>}
          </div>
          <div className="wp-td is-num" style={{ width: w[7] }}>
            <M>{o.units} units</M>
          </div>
          <div className="wp-td is-num" style={{ width: w[8] }}>
            <M>{o.kg} kg</M>
          </div>
          <div className="wp-td is-num" style={{ width: w[9] }}>
            <M>{o.m3} m³</M>
          </div>
          <div className="wp-td" style={{ width: w[10] }}>
            <div className="wp-tags">
              <Tag tone="neutral" icon={<Clock3 size={12} />}>
                Ordered
              </Tag>
              {o.carryOver && (
                <>
                  <Tag tone="outline" icon={<ClockArrowDown size={12} />}>
                    Carry-over
                  </Tag>
                  <Tag tone="outline" icon={<Lock size={12} />}>
                    Protected
                  </Tag>
                </>
              )}
            </div>
          </div>
          <div className="wp-td is-center" style={{ width: w[11] }} />
        </div>
      ))}
      <div className="wp-table__footer">
        <span>Showing 5 of 212 Peliyagoda orders</span>
        <span>Received time not supplied</span>
      </div>
    </div>
  );
}

/* ---------- D1.2 after cutoff ---------- */
function PostRow({ o, onOpen, tall, plain }: { o: QueueOrder; onOpen?: (id: string) => void; tall?: boolean; plain?: boolean }) {
  const w = W.post;
  return (
    <div
      role="row"
      tabIndex={onOpen ? 0 : undefined}
      className={cx('wp-tr', (o.carryOver || tall) && 'is-tall', onOpen && 'is-clickable')}
      onClick={() => onOpen?.(o.id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.(o.id)}
    >
      <div className="wp-td" style={{ width: w[0] }}>
        <M>{o.id}</M>
      </div>
      <div className="wp-td" style={{ width: w[1] }}>
        <M w={plain ? 400 : 600}>{o.outlet}</M>
      </div>
      <div className="wp-td" style={{ width: w[2], paddingLeft: 4 }}>
        <Tag tone={o.brand.toLowerCase() as 'fresh'} small={!plain}>
          {o.brand}
        </Tag>
      </div>
      <div className="wp-td" style={{ width: w[3] }}>
        {o.district}
      </div>
      <div className="wp-td" style={{ width: w[4], paddingLeft: 4 }}>
        {o.temp === 'Chilled' ? (
          <Tag tone="chilled" small={!plain}>
            Chilled
          </Tag>
        ) : (
          <Tag tone="neutral" small={!plain}>
            Ambient
          </Tag>
        )}
      </div>
      <div className="wp-td" style={{ width: w[5], paddingLeft: 5 }}>
        {plain ? (
          <span>{o.access.join(' · ')}</span>
        ) : (
          <div className="wp-tags">
            {o.access.map((a) => (
              <Tag key={a} tone="outline-ink" small>
                {a}
              </Tag>
            ))}
          </div>
        )}
      </div>
      <div className="wp-td" style={{ width: w[6], paddingLeft: 5 }}>
        <M>{o.window}</M>
      </div>
      <div className="wp-td is-num" style={{ width: w[7] }}>
        <M>{o.units} units</M>
      </div>
      <div className="wp-td is-num" style={{ width: w[8] }}>
        <M>{o.kg} kg</M>
      </div>
      <div className="wp-td is-num" style={{ width: w[9] }}>
        <M>{o.m3} m³</M>
      </div>
      <div className="wp-td" style={{ width: w[10], paddingLeft: 6 }}>
        <div className="wp-cell-stack">
          <div className="wp-tags">
            <Tag tone="neutral" small={!plain} icon={plain ? undefined : <LockKeyhole size={12} />}>
              Confirmed
            </Tag>
            {o.carryOver && (
              <>
                <Tag tone={plain ? 'neutral' : 'outline-ink'} small={!plain}>
                  Carry-over
                </Tag>
                <Tag tone={plain ? 'neutral' : 'outline-ink'} small={!plain} icon={plain ? undefined : <LockKeyhole size={12} />}>
                  Protected
                </Tag>
              </>
            )}
          </div>
          {o.carryOver && !plain && <span className="muted">Deferred yesterday: protected by the continuity guard</span>}
        </div>
      </div>
      <div className="wp-td is-center q-received" style={{ width: w[11] }}>
        {o.carryOver && !plain && (
          <span>
            2 days since
            <br />
            served
          </span>
        )}
      </div>
    </div>
  );
}

function PostCutoffTable({ depot, onDepot, onFilters, onOpen }: { depot: Depot; onDepot: (d: Depot) => void; onFilters: () => void; onOpen: (id: string) => void }) {
  const w = W.post;
  return (
    <div className="wp-card wp-table" role="table" aria-label="Confirmed orders">
      <Toolbar depot={depot} onDepot={onDepot} onFilters={onFilters} />
      <HeadRow widths={w} />
      <div className="wp-group-row is-warn">
        <Clock3 size={14} />
        Carry-overs · 2
      </div>
      {peliyagodaQueue.filter((o) => o.carryOver).map((o) => (
        <PostRow key={o.id} o={o} onOpen={onOpen} />
      ))}
      <div className="wp-group-row">Other orders</div>
      {peliyagodaQueue.filter((o) => !o.carryOver).map((o) => (
        <PostRow key={o.id} o={o} onOpen={onOpen} />
      ))}
      <div role="row" className="wp-tr q-aftercutoff">
        <div className="wp-td" style={{ width: w.slice(0, 10).reduce((a, b) => a + b, 0) }} />
        <div className="wp-td" style={{ width: w[10], paddingLeft: 6 }}>
          <div className="wp-cell-stack">
            <Tag tone="warning-outline" small icon={<Clock3 size={12} />}>
              After cutoff
            </Tag>
            <span className="muted">Moves to the following run (Wed 30 Sep)</span>
          </div>
        </div>
        <div className="wp-td is-center" style={{ width: w[11] }}>
          <M w={600} style={{ fontSize: 14, color: 'var(--ink-muted)' }}>
            16:07
          </M>
        </div>
      </div>
      <div className="wp-table__footer">
        <span>Showing 5 of 212 confirmed Peliyagoda orders</span>
        <span>Carry-overs pinned first · 1 received after cutoff</span>
      </div>
    </div>
  );
}

/* ---------- D1.3 Kandy grouped ---------- */
const KW = [300, 155, 150, 105, 105, 95, 300, 166];
const KHEAD = ['Order record', 'Handling', 'Window', 'Units', 'Kg', 'M³', 'Status', 'Received'];

function KandyTable({ onDepot, onFilters }: { onDepot: (d: Depot) => void; onFilters: () => void }) {
  return (
    <div className="wp-card wp-table" role="table" aria-label="Kandy orders grouped by outlet">
      <div style={{ height: 58, display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <Toolbar depot="Kandy" onDepot={onDepot} onFilters={onFilters} />
        </div>
      </div>
      <div className="wp-thead" role="row">
        {KHEAD.map((h, i) => (
          <div key={h} role="columnheader" className={cx('wp-th', i >= 3 && i <= 5 && 'is-num', i === 7 && 'is-center')} style={{ width: KW[i], padding: '0 10px' }}>
            {h}
          </div>
        ))}
      </div>
      {kandyGroups.map((g) => (
        <div key={g.outlet} role="rowgroup">
          {g.name ? (
            <div className="q-group q-group--full">
              <div className="wp-row" style={{ justifyContent: 'space-between' }}>
                <div className="wp-row" style={{ gap: 8 }}>
                  <ChevronDown size={15} />
                  <b style={{ fontSize: 14 }}>
                    {g.outlet} · {g.name}
                  </b>
                </div>
                <span className="muted" style={{ fontSize: 13 }}>
                  {g.note}
                </span>
              </div>
              <div className="wp-row" style={{ gap: 7, paddingLeft: 23 }}>
                {g.brand && <BrandTag brand={g.brand} />}
                <Tag tone="outline" small>
                  {g.access}
                </Tag>
                <Clock3 size={13} />
                <M style={{ fontSize: 13 }}>{g.window}</M>
              </div>
            </div>
          ) : (
            <div className="q-group q-group--short">
              <ChevronDown size={15} />
              <M w={700} style={{ fontSize: 13 }}>
                {g.outlet}
              </M>
            </div>
          )}
          {g.orders.map((o, idx) => {
            const selected = o.id === 'ORD2001';
            const last = idx === g.orders.length - 1;
            return (
              <div key={o.id} role="row" className={cx('wp-tr is-tall q-krow', selected && 'is-selected')}>
                <span className={cx('q-connector', last && 'is-last')} />
                <div className="wp-td" style={{ width: KW[0], paddingLeft: 46, paddingRight: 10 }}>
                  <div className="wp-row" style={{ gap: 9 }}>
                    <M w={600} style={{ fontSize: 13 }}>
                      {o.id}
                    </M>
                    {selected && <Tag tone="selected">Selected</Tag>}
                  </div>
                </div>
                <div className="wp-td" style={{ width: KW[1], padding: '0 10px' }}>
                  <TempTag temp={o.temp} dry={o.temp === 'Ambient'} />
                </div>
                {[o.window, `${o.units} units`, `${o.kg} kg`, `${o.m3} m³`].map((v, i) => (
                  <div key={i} className={cx('wp-td', i > 0 && 'is-num')} style={{ width: KW[i + 2], padding: '0 10px' }}>
                    <M style={{ fontSize: 13 }}>{v}</M>
                  </div>
                ))}
                <div className="wp-td" style={{ width: KW[6], padding: '0 10px' }}>
                  <Tag tone="neutral" icon={<Lock size={13} />} style={{ padding: '0 8px', gap: 5 }}>
                    Confirmed
                  </Tag>
                </div>
                <div className="wp-td is-center" style={{ width: KW[7], padding: '0 10px' }}>
                  <M style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{o.received}</M>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div className="wp-table__footer">
        <span>Showing 3 of 64 Kandy orders</span>
        <span>Grouped by outlet · order records remain separate</span>
      </div>
    </div>
  );
}

/* ---------- D1.4 filters ---------- */
const FILTER_GROUPS: Array<{ label: string; options: string[] }> = [
  { label: 'Brand', options: ['Fresh', 'Style', 'Tech'] },
  { label: 'Depot', options: ['Peliyagoda', 'Kandy'] },
  { label: 'Temperature', options: ['Chilled', 'Ambient'] },
  { label: 'Status', options: ['Ordered', 'Confirmed', 'Planned', 'Deferred'] },
  { label: 'Window', options: ['Start before 05:00', '05:00–06:00', 'After 06:00'] },
  { label: 'Tags', options: ['Carry-over', 'After cutoff', 'Van only', 'Mall dock'] },
];

function FiltersPanel({ selected, toggle, onClose, onClear }: { selected: Set<string>; toggle: (o: string) => void; onClose: () => void; onClear: () => void }) {
  return (
    <aside className="wp-panel-right" aria-label="Filters">
      <div className="wp-col" style={{ gap: 12 }}>
        <div className="wp-row" style={{ justifyContent: 'space-between', height: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Filters</h2>
          <CloseButton onClick={onClose} label="Close filters" />
        </div>
        {FILTER_GROUPS.map((g) => (
          <div key={g.label} className="wp-col" style={{ gap: 5 }}>
            <span className="wp-label">{g.label}</span>
            <div className="wp-row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {g.options.map((o) => {
                const on = selected.has(o);
                return (
                  <button key={o} className={cx('wp-choice', on && 'is-selected')} aria-pressed={on} onClick={() => toggle(o)}>
                    {on && <Check size={15} />}
                    {o}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="wp-row" style={{ justifyContent: 'space-between', paddingTop: 24 }}>
        <Button variant="ghost" onClick={onClear} style={{ padding: 0 }}>
          Clear all
        </Button>
        <Button size="lg" onClick={onClose}>
          Apply filters
        </Button>
      </div>
    </aside>
  );
}

function FilteredTable() {
  const rows = peliyagodaQueue.filter((o) => ['ORD1001', 'ORD1002', 'ORD1020'].includes(o.id));
  const w = [96, 68, 72, 84, 80, 150, 140, 82, 78, 64, 100];
  return (
    <div className="wp-card wp-table" role="table" aria-label="Filtered orders" style={{ minHeight: 300 }}>
      <div className="wp-table__toolbar" style={{ height: 50 }}>
        <div className="wp-table__title">
          <b>Tomorrow’s order queue</b>
          <span>Peliyagoda · matching active filters</span>
        </div>
      </div>
      <div className="wp-thead" role="row">
        {HEAD.slice(0, 11).map((h, i) => (
          <div key={h} className={cx('wp-th', NUM.has(i) && 'is-num')} style={{ width: w[i] }}>
            {h}
          </div>
        ))}
      </div>
      {rows.map((o) => (
        <div key={o.id} role="row" className="wp-tr" style={{ height: 58 }}>
          <div className="wp-td" style={{ width: w[0] }}>
            <M>{o.id}</M>
          </div>
          <div className="wp-td" style={{ width: w[1] }}>
            <M w={600}>{o.outlet}</M>
          </div>
          <div className="wp-td" style={{ width: w[2] }}>
            <Tag tone="fresh">Fresh</Tag>
          </div>
          <div className="wp-td" style={{ width: w[3] }}>
            {o.district}
          </div>
          <div className="wp-td" style={{ width: w[4] }}>
            <Tag tone="chilled">Chilled</Tag>
          </div>
          <div className="wp-td" style={{ width: w[5] }}>
            <div className="wp-tags">
              {o.access.map((a) => (
                <Tag key={a} tone="outline-muted">
                  {a}
                </Tag>
              ))}
            </div>
          </div>
          <div className="wp-td" style={{ width: w[6] }}>
            <M>{o.window}</M>
          </div>
          <div className="wp-td is-num" style={{ width: w[7] }}>
            <M>{o.units} units</M>
          </div>
          <div className="wp-td is-num" style={{ width: w[8] }}>
            <M>{o.kg} kg</M>
          </div>
          <div className="wp-td is-num" style={{ width: w[9] }}>
            <M>{o.m3} m³</M>
          </div>
          <div className="wp-td" style={{ width: w[10] }}>
            <Tag tone="neutral">Confirmed</Tag>
          </div>
        </div>
      ))}
      <div className="wp-table__footer" style={{ marginTop: 'auto' }}>
        <span>Showing 38 of 212 Peliyagoda orders</span>
        <span>Received time not supplied</span>
      </div>
    </div>
  );
}

/* ---------- D1.5 history drawer ---------- */
function HistoryDrawer({ order, onClose }: { order: QueueOrder; onClose: () => void }) {
  const protectedOutlet = order.carryOver;
  const runs: Array<'served' | 'deferred' | 'today'> = ['served', 'served', 'served', 'deferred', 'today'];
  return (
    <Drawer onClose={onClose} label={`Order history ${order.id}`}>
      <div className="q-drawer">
        <section className="wp-col" style={{ gap: 10, paddingBottom: 18 }}>
          <div className="wp-row" style={{ justifyContent: 'space-between' }}>
            <h2 className="mono" style={{ fontSize: 22, fontWeight: 600 }}>
              {order.id} · {order.outlet}
            </h2>
            <CloseButton onClick={onClose} label="Close order history drawer" />
          </div>
          <div className="wp-tags" style={{ gap: 6 }}>
            <Tag tone={order.brand.toLowerCase() as 'fresh'}>{order.brand}</Tag>
            <Tag tone={order.temp === 'Chilled' ? 'chilled' : 'neutral'}>{order.temp}</Tag>
            {order.access.map((a) => (
              <Tag key={a} tone="outline">
                {a}
              </Tag>
            ))}
            {protectedOutlet && (
              <Tag tone="outline" icon={<Lock size={13} />}>
                Protected
              </Tag>
            )}
          </div>
          <M w={500} style={{ fontSize: 13 }}>
            {order.window} · {order.units} units · {order.kg} kg · {order.m3} m³
          </M>
          <span className="muted" style={{ fontSize: 13 }}>
            {order.brand} · {order.district} · {order.temp.toLowerCase()} · {order.access.join(' · ').toLowerCase() || 'no access constraints'}
          </span>
        </section>
        <div className="wp-divider" />
        <section className="q-drawer__section">
          <h3>Outlet continuity</h3>
          {protectedOutlet ? (
            <div className="q-continuity">
              <TriangleAlert size={18} />
              <span>Deferred yesterday · 2 days since last served · Protected by continuity guard</span>
            </div>
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>
              Served on the last run · not protected
            </span>
          )}
        </section>
        <div className="wp-divider" />
        <section className="q-drawer__section" style={{ gap: 13 }}>
          <div className="wp-row" style={{ justifyContent: 'space-between' }}>
            <h3>Last 5 runs</h3>
            <MockTag />
          </div>
          <div className="wp-row" style={{ gap: 10, alignItems: 'flex-start' }}>
            {runs.map((r, i) => (
              <div key={i} className="q-run">
                <span className={cx('q-run__mark', `is-${r}`)}>
                  {r === 'served' && <Check size={17} />}
                  {r === 'deferred' && <ClockArrowDown size={16} />}
                  {r === 'today' && <span className="q-run__dot" />}
                </span>
                <span className={cx('q-run__label', r === 'deferred' && 'muted')}>
                  {r === 'served' && 'Served'}
                  {r === 'deferred' && (
                    <>
                      Deferred
                      <br />
                      (policy)
                    </>
                  )}
                  {r === 'today' && (
                    <>
                      Today
                      <br />
                      pending
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
        <div className="wp-divider" />
        <section className="q-drawer__section" style={{ gap: 14 }}>
          <div className="wp-row" style={{ justifyContent: 'space-between' }}>
            <h3>Order journey</h3>
            <MockTag />
          </div>
          <JourneyGrid />
        </section>
        <div className="wp-divider" />
        <section className="q-drawer__section" style={{ paddingBottom: 0 }}>
          <h3>Notes</h3>
          <div className="q-notes">
            <NotebookPen size={17} />
            No notes
          </div>
        </section>
      </div>
    </Drawer>
  );
}

function JourneyGrid() {
  const row1: Array<[string, 'done' | 'current' | 'todo', ReactNode?]> = [
    ['Ordered', 'done', <>Store · <M>15:12</M></>],
    ['Confirmed', 'done', <>System · <M>16:00</M></>],
    ['Planned', 'current'],
    ['Loaded', 'todo'],
  ];
  const row2: Array<[ReactNode, 'todo']> = [
    ['Departed', 'todo'],
    ['Delivered', 'todo'],
    [
      <>
        Receipt
        <br />
        confirmed
      </>,
      'todo',
    ],
  ];
  return (
    <div className="wp-col" style={{ gap: 18 }}>
      <div className="q-journey">
        {row1.map(([label, state, who], i) => (
          <div key={label} className="q-journey__cell">
            {i > 0 && <span className="q-journey__link" />}
            <div className="q-journey__event">
              <span className={cx('q-journey__dot', `is-${state}`)} />
              <span className={cx('q-journey__label', state === 'todo' && 'muted', state === 'current' && 'is-bold')}>{label}</span>
              {who && <span className="q-journey__who">{who}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="q-journey q-journey--3">
        {row2.map(([label], i) => (
          <div key={i} className="q-journey__cell">
            {i > 0 && <span className="q-journey__link" />}
            <div className="q-journey__event">
              <span className="q-journey__dot is-todo" />
              <span className="q-journey__label muted">{label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- States ---------- */
function StateCard({ status, statusTone, children, height = 568 }: { status: string; statusTone?: 'warn'; children: ReactNode; height?: number }) {
  return (
    <div className="wp-card wp-table" style={{ minHeight: height }}>
      <div className="wp-table__toolbar">
        <div className="wp-table__title">
          <b>Tomorrow’s order queue</b>
          <span>Filling live until the 16:00 cutoff</span>
        </div>
        <span className={cx('wp-live-dot is-strong', statusTone === 'warn' && 'is-warn')}>{status}</span>
      </div>
      {children}
    </div>
  );
}

function LoadingTable() {
  const w = W.post;
  const widths = [
    [68, 48, 42, 54, 50, 96, 92, 50, 52, 44, 172, 36],
    [62, 48, 42, 56, 48, 88, 84, 46, 48, 40, 132, 36],
    [72, 42, 42, 50, 52, 62, 98, 48, 55, 42, 156, 34],
  ];
  return (
    <StateCard status="Preparing queue">
      <HeadRow widths={w} />
      {Array.from({ length: 10 }, (_, r) => (
        <div key={r} className="wp-tr" style={{ height: 44 }}>
          {w.map((cw, i) => (
            <div key={i} className={cx('wp-td', NUM.has(i) && 'is-num', i === 11 && 'is-center')} style={{ width: cw }}>
              <Skel w={widths[r % 3][i]} />
            </div>
          ))}
        </div>
      ))}
      <div className="wp-table__footer" style={{ height: 36 }}>
        <span className="wp-loading-caption" style={{ fontWeight: 400 }}>
          <RefreshCw size={15} className="spin" />
          Loading 212 orders…
        </span>
      </div>
    </StateCard>
  );
}

function OfflineTable() {
  const w = W.post;
  return (
    <StateCard status="Cached queue" statusTone="warn" height={0}>
      <HeadRow widths={w} />
      <div className="wp-group-row is-warn" style={{ height: 26 }}>
        <Clock3 size={14} />
        Carry-overs · 2
      </div>
      {peliyagodaQueue.filter((o) => o.carryOver).map((o) => (
        <PostRow key={o.id} o={o} plain tall />
      ))}
      <div className="wp-group-row" style={{ background: 'var(--surface-2)' }}>
        Other orders
      </div>
      {peliyagodaQueue.filter((o) => !o.carryOver).map((o) => (
        <PostRow key={o.id} o={o} plain tall />
      ))}
      <div style={{ height: 64 }} />
      <div className="wp-table__footer" style={{ borderTop: '1px solid var(--line)' }}>
        <span>Showing 5 of 212 confirmed Peliyagoda orders</span>
        <span>Cached queue · reconnect to refresh</span>
      </div>
    </StateCard>
  );
}

/* ---------- Screen ---------- */
export default function Queue() {
  const [frame, setFrame] = useFrame<Frame>('D1.2');
  const go = useGo();
  const [openId, setOpenId] = useState('ORD1001');
  const [filters, setFilters] = useState<Set<string>>(new Set(['Fresh', 'Chilled']));

  const kandy = frame === 'D1.3';
  const offline = frame === 'D1.S-offline';
  const preCutoff = frame === 'D1.1' || frame.startsWith('D1.S');
  const onDepot = (d: Depot) => setFrame(d === 'Kandy' ? 'D1.3' : 'D1.2');
  const toCapacity = () => go('/plan/capacity', kandy ? 'D2.2' : 'D2.1');

  const context = frame === 'D1.2' ? 'Mon 28 Sep · 16:00 · Peliyagoda' : kandy ? 'Mon 28 Sep · Kandy' : 'Mon 28 Sep · Peliyagoda';

  const bar = <AppBar current="plan" deferrals={2} context={context} depot={kandy ? 'Kandy' : 'Peliyagoda'} onDepot={onDepot} offline={offline} />;
  const conn = offline ? (
    <ConnectivityBar>
      Connection lost: showing the queue as of <M w={500}>16:02</M>. New orders appear when you reconnect.
    </ConnectivityBar>
  ) : undefined;

  const cutoffPill = (label: string) => (
    <Tag pill tone="warning" icon={<Clock3 size={15} />} className="q-cutoff">
      {label}
    </Tag>
  );

  let header;
  if (preCutoff) {
    header = (
      <PageHeader
        overline="PLAN FOR TUE 29 SEP · RUN 1"
        title="Orders for Tue 29 Sep"
        titleAddon={cutoffPill(frame === 'D1.1' ? 'Cutoff 16:00 · 20 min left' : 'Cutoff 16:00')}
        actions={
          <Button disabled iconRight={<ArrowRight size={16} />} title="Go to capacity board — available after cutoff at 16:00">
            Go to capacity board
          </Button>
        }
        reason={
          <>
            <LockKeyhole size={13} />
            Available after cutoff at 16:00
          </>
        }
      >
        <Stepper current={1} next={frame !== 'D1.1'} />
        {frame === 'D1.1' && (
          <div className="wp-row" style={{ gap: 9, height: 28 }}>
            <b style={{ fontSize: 14, fontWeight: 600 }}>Peliyagoda 212 orders · Kandy 64 orders</b>
            <MockTag />
          </div>
        )}
      </PageHeader>
    );
  } else if (frame === 'D1.4') {
    header = (
      <PageHeader
        overline="PLAN FOR TUE 29 SEP · RUN 1"
        title="Orders for Tue 29 Sep"
        actions={
          <Button variant="route-outline" iconRight={<ChevronRight size={16} />} style={{ opacity: 0.45 }} onClick={toCapacity}>
            Go to capacity board
          </Button>
        }
      >
        <Stepper current={1} />
      </PageHeader>
    );
  } else {
    header = (
      <PageHeader
        overline="PLAN FOR TUE 29 SEP · RUN 1"
        title="Orders for Tue 29 Sep"
        titleAddon={
          kandy ? (
            <span className="q-depot-context">
              Kandy · <M w={700}>64</M> orders · <M w={700}>0</M> carry-overs
            </span>
          ) : undefined
        }
        actions={
          <Button iconRight={<ChevronRight size={16} />} onClick={toCapacity}>
            Go to capacity board
          </Button>
        }
      >
        {!kandy && (
          <Alert tone="info" icon={<Info size={18} />} title="Cutoff closed at 16:00, 212 orders confirmed for Tue 29 Sep" actions={<MockTag />}>
            2 carry-overs from yesterday are pinned first.
          </Alert>
        )}
        <Stepper current={1} next />
      </PageHeader>
    );
  }

  let body;
  switch (frame) {
    case 'D1.1':
      body = (
        <>
          <div className="wp-stats">
            <StatQ label="Orders in queue" value="212" foot="Peliyagoda · still open" />
            <StatQ label="Kandy" value="64" />
            <StatQ
              label="Carry-overs"
              value="2"
              foot={
                <span className="wp-row" style={{ gap: 6, color: 'var(--warning)', fontWeight: 600 }}>
                  <Clock3 size={14} />
                  Deferred yesterday: protected
                </span>
              }
            />
          </div>
          <PreCutoffTable />
        </>
      );
      break;
    case 'D1.3':
      body = <KandyTable onDepot={onDepot} onFilters={() => setFrame('D1.4')} />;
      break;
    case 'D1.4':
      body = (
        <>
          <div className="wp-row" style={{ gap: 16, height: 44 }}>
            <div className="wp-row" style={{ gap: 8 }}>
              <label className="wp-search" style={{ width: 238 }}>
                <Search size={16} />
                <input placeholder="Search order or outlet" aria-label="Search order or outlet" />
              </label>
              <button className="wp-btn wp-btn--sm q-filters-on" onClick={() => setFrame('D1.2')} style={{ height: 40 }}>
                <ListFilter size={15} />
                Filters
              </button>
              {['Fresh', 'Chilled', 'Colombo'].map((f) => (
                <span key={f} className="wp-chip-filter">
                  {f}
                  <button aria-label={`Remove ${f} filter`} style={{ display: 'flex', color: 'inherit' }}>
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
            <div className="wp-row" style={{ gap: 9 }}>
              <M w={600} style={{ fontSize: 13 }}>
                Showing 38 of 212
              </M>
              <MockTag />
            </div>
          </div>
          <div className="q-safeguard">
            <TriangleAlert size={17} />
            <span>1 carry-over hidden by filters</span>
            <button className="wp-link">show</button>
          </div>
          <FilteredTable />
          <FiltersPanel
            selected={filters}
            toggle={(o) =>
              setFilters((s) => {
                const n = new Set(s);
                if (n.has(o)) n.delete(o);
                else n.add(o);
                return n;
              })
            }
            onClose={() => setFrame('D1.2')}
            onClear={() => setFilters(new Set())}
          />
        </>
      );
      break;
    case 'D1.S-empty':
      body = (
        <StateCard status="Queue status">
          <StateBlock
            style={{ padding: '66px 48px 40px' }}
            icon={<Clock3 size={22} />}
            title="No confirmed orders for Tue 29 Sep yet"
            body="Cutoff at 16:00."
            facts="Cutoff 16:00 · Orders so far 0"
            action={
              <Button variant="secondary" size="sm" style={{ height: 38, padding: '0 14px' }}>
                Refresh
              </Button>
            }
          />
        </StateCard>
      );
      break;
    case 'D1.S-loading':
      body = <LoadingTable />;
      break;
    case 'D1.S-offline':
      body = <OfflineTable />;
      break;
    case 'D1.S-error':
      body = (
        <StateCard status="Queue status">
          <div style={{ padding: '32px 32px' }}>
            <Alert
              tone="danger"
              icon={<CircleAlert size={20} />}
              title="Couldn't load orders"
              style={{ padding: '14px 16px' }}
              actions={
                <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => setFrame('D1.S-loading')} style={{ fontSize: 13, padding: '0 13px' }}>
                  Retry
                </Button>
              }
            >
              Your filters are kept.
            </Alert>
          </div>
        </StateCard>
      );
      break;
    default:
      body = <PostCutoffTable depot="Peliyagoda" onDepot={onDepot} onFilters={() => setFrame('D1.4')} onOpen={(id) => { setOpenId(id); setFrame('D1.5'); }} />;
  }

  const drawerOrder = peliyagodaQueue.find((o) => o.id === openId) ?? peliyagodaQueue[0];

  return (
    <Screen bar={bar} conn={conn}>
      <div className="wp-col" style={{ gap: frame === 'D1.1' ? 16 : 12 }}>
        {header}
        {body}
      </div>
      {frame === 'D1.5' && <HistoryDrawer order={drawerOrder} onClose={() => setFrame('D1.2')} />}
    </Screen>
  );
}

function StatQ({ label, value, foot }: { label: string; value: string; foot?: ReactNode }) {
  return (
    <div className="wp-card wp-stat">
      <div className="wp-stat__main">
        <div className="wp-stat__label">{label}</div>
        <div className="wp-stat__value">{value}</div>
      </div>
      {foot && <div className="wp-stat__foot">{foot}</div>}
    </div>
  );
}
