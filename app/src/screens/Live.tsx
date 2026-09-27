import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Flag,
  Info,
  Lock,
  Redo2,
  RefreshCw,
  Route,
  Snowflake,
  TriangleAlert,
  Truck,
  WifiOff,
  X,
} from 'lucide-react';
import { AppBar, PageHeader, Screen, useFrame, useGo } from '../components/shell';
import { Button, M, Modal, Skel, Tag, cx } from '../components/ui';
import './live.css';

type Frame =
  | 'D6.1'
  | 'D6.2'
  | 'D6.3'
  | 'D6.4'
  | 'D6.5'
  | 'D6.6'
  | 'D6.7'
  | 'D6.8'
  | 'D6.S-loading'
  | 'D6.S-offline'
  | 'D6.S-error';

const TIME: Record<Frame, string> = {
  'D6.1': '05:12',
  'D6.2': '05:20',
  'D6.3': '05:21',
  'D6.4': '05:30',
  'D6.5': '06:40',
  'D6.6': '07:31',
  'D6.7': '02:56',
  'D6.8': '06:15',
  'D6.S-loading': '05:12',
  'D6.S-offline': '05:34',
  'D6.S-error': '05:12',
};

/* ---------- Pills ---------- */
type PillKind = 'departed' | 'planned' | 'delivered' | 'conflict' | 'deferred';

function Pill({ kind, children }: { kind: PillKind; children: ReactNode }) {
  const icon =
    kind === 'departed' ? <Truck size={14} /> :
    kind === 'planned' ? <Route size={14} /> :
    kind === 'delivered' ? <Check size={14} /> :
    kind === 'conflict' ? <TriangleAlert size={14} /> :
    <Redo2 size={14} />;
  return (
    <span className={cx('l-pill', `l-pill--${kind}`)}>
      {icon}
      {children}
    </span>
  );
}

function PendingTag() {
  return (
    <Tag tone="warning" small icon={<Clock3 size={13} />}>
      Change pending
    </Tag>
  );
}

function Temp({ temp }: { temp: 'Chilled' | 'Ambient' }) {
  return temp === 'Chilled' ? (
    <Tag tone="chilled" small className="l-tag" icon={<Snowflake size={13} />}>
      Chilled
    </Tag>
  ) : (
    <Tag tone="ambient" small className="l-tag">
      Ambient
    </Tag>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="l-label">{children}</span>;
}

/* ---------- Inbox ---------- */
function Inbox({ frame, onResolve, onReview }: { frame: Frame; onResolve: () => void; onReview: () => void }) {
  if (frame === 'D6.8') {
    return (
      <section className="l-inbox" aria-label="Needs a decision">
        <Label>Needs a decision · 0</Label>
        <div className="l-calm">
          <span className="l-calm__tile">
            <Check size={24} />
          </span>
          <span className="wp-col" style={{ gap: 2 }}>
            <span style={{ fontSize: 17, fontWeight: 600 }}>Nothing needs attention right now</span>
            <span className="muted" style={{ fontSize: 13 }}>
              We'll put anything that needs you here first.
            </span>
          </span>
        </div>
      </section>
    );
  }

  let count = 0;
  let items: ReactNode = (
    <div className="l-inbox__empty">
      <Check size={16} />
      Nothing needs a decision.
    </div>
  );

  if (frame === 'D6.4') {
    items = (
      <div className="l-item l-item--info">
        <span className="l-item__tile">
          <Info size={16} />
        </span>
        <span className="l-item__text">
          <b>VEH039 hasn't received v5, pending since 05:21</b>
          <span>ORD2001 + ORD2002 deferred at OUT084's request. The phone gets v5 when it's back in coverage.</span>
        </span>
        <Tag tone="outline" small>
          Info only
        </Tag>
      </div>
    );
  } else if (frame === 'D6.5') {
    count = 1;
    items = (
      <div className="l-item l-item--conflict">
        <Pill kind="conflict">Conflict</Pill>
        <span className="l-item__text">
          <b>OUT084 · ORD2001 + ORD2002: needs a decision</b>
          <span>Driver recorded Delivered 05:42 (S. Fernando, photo). Plan v5 says Deferred · store request 05:21.</span>
        </span>
        <M style={{ fontSize: 12, color: 'var(--ink-muted)' }}>06:40</M>
        <Button size="sm" iconRight={<ArrowRight size={16} />} onClick={onResolve} style={{ fontWeight: 700 }}>
          Resolve
        </Button>
      </div>
    );
  } else if (frame === 'D6.7') {
    count = 1;
    items = (
      <>
        <div className="l-item l-item--danger">
          <span className="l-item__tile">
            <Flag size={16} />
          </span>
          <span className="l-item__text">
            <b>VEH003 held: vehicle check failed</b>
            <span>Reefer not holding temperature · flagged by Priya 02:55 · 9 orders on 2 trips · departs 03:30</span>
          </span>
          <span className="wp-row" style={{ gap: 6, color: 'var(--danger)' }}>
            <Clock3 size={14} />
            <M w={500} style={{ fontSize: 12 }}>
              34 min to departure
            </M>
          </span>
          <Button size="sm" iconRight={<ArrowRight size={16} />} onClick={onReview} style={{ fontWeight: 700 }}>
            Review
          </Button>
        </div>
        <div className="l-item l-item--info">
          <span className="l-item__tile">
            <Truck size={16} />
          </span>
          <span className="l-item__text">
            <b>VEH036 available since 02:45</b>
            <span>Reefer van · 1,040 kg · 7.0 m³ · back from the workshop</span>
          </span>
          <Tag tone="outline" small>
            Info only
          </Tag>
        </div>
      </>
    );
  }

  return (
    <section className="l-inbox" aria-label="Needs a decision">
      <div className="wp-row" style={{ gap: 8 }}>
        <Label>Needs a decision · {count}</Label>
        {frame === 'D6.5' && <span className="l-badge">1</span>}
      </div>
      {items}
    </section>
  );
}

/* ---------- Counts ---------- */
function Counts({ held }: { held: boolean }) {
  const stats = held
    ? [
        ['Departed', '0', 'first departures 03:30'],
        ['Loading', '6', 'Peliyagoda 5 · Kandy 1'],
        ['Delivered', '0', 'orders so far'],
        ['Issues', '1', 'VEH003 held'],
      ]
    : [
        ['Departed', '14', 'of 38 trips today'],
        ['Loading', '3', 'Peliyagoda 2 · Kandy 1'],
        ['Delivered', '22', 'orders so far'],
        ['Issues', '0', 'nothing reported'],
      ];
  return (
    <div className="l-counts">
      {stats.map(([label, value, foot]) => (
        <div key={label} className="l-stat">
          <Label>{label}</Label>
          <M w={600} style={{ fontSize: 30 }}>
            {value}
          </M>
          <span className="muted" style={{ fontSize: 12 }}>
            {foot}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Vehicle table ---------- */
interface VehicleRow {
  id: string;
  driver: string;
  plan: ReactNode;
  next: string;
  stops: string;
  heard: ReactNode;
  status: ReactNode;
  held?: boolean;
  expandable?: boolean;
}

const COLS = [120, 70, 130, 140, 330, 90, 200, 160];
const HEADS = ['Vehicle', 'Trip', 'Driver', 'Plan on device', 'Next stop', 'Stops', 'Last heard', 'Status'];

function Heard({ time, ago }: { time: string; ago?: string }) {
  return (
    <M style={{ color: 'var(--ink-muted)' }}>
      {time}
      {ago && ` · ${ago}`}
    </M>
  );
}

function OfflineHeard({ ago, tooltip }: { ago: string; tooltip?: boolean }) {
  return (
    <span className="l-heard">
      <WifiOff size={16} style={{ color: 'var(--offline)' }} />
      <M w={500}>05:17</M>
      <span className="muted" style={{ fontSize: 12 }}>
        {ago} · known gap
      </span>
      {tooltip && (
        <span className="l-tooltip" role="tooltip">
          The phone keeps recording offline. Records arrive when it's back in coverage.
        </span>
      )}
    </span>
  );
}

function SyncedHeard({ time, caption }: { time: string; caption: string }) {
  return (
    <span className="l-heard">
      <Check size={16} style={{ color: 'var(--success)' }} />
      <M w={500}>{time}</M>
      <span style={{ fontSize: 12, color: 'var(--success)' }}>{caption}</span>
    </span>
  );
}

function vehicles(frame: Frame): VehicleRow[] {
  const departed = <Pill kind="departed">Departed</Pill>;
  const planned = <Pill kind="planned">Planned</Pill>;
  const offline = frame === 'D6.S-offline';

  if (frame === 'D6.7') {
    return [
      {
        id: 'VEH003',
        driver: 'R. Silva (Mock)',
        plan: <M w={500}>v3</M>,
        next: 'Loading at Peliyagoda dock · departs 03:30',
        stops: '0 / 5',
        heard: <Heard time="02:55" ago="Priya" />,
        status: (
          <>
            <Tag tone="danger" small icon={<Lock size={13} />}>
              Held
            </Tag>
            {planned}
          </>
        ),
        held: true,
      },
      { id: 'VEH039', driver: 'Nimal', plan: <M w={500}>v3</M>, next: 'Kandy · departs 05:10', stops: '0 / 2', heard: null, status: planned },
      { id: 'VEH035', driver: 'P. Kumara (Mock)', plan: <M w={500}>v3</M>, next: 'Loading · departs 03:30', stops: '0 / 4', heard: <Heard time="02:50" />, status: planned },
      { id: 'VEH011', driver: 'S. Jayasena (Mock)', plan: <M w={500}>v3</M>, next: 'OUT015 · departs 08:36', stops: '0 / 1', heard: <Heard time="05:02" />, status: planned },
    ];
  }

  const returned = frame === 'D6.5' || frame === 'D6.6';
  let heard039: ReactNode = <Heard time="05:12" ago="now" />;
  if (frame === 'D6.2') heard039 = <OfflineHeard ago="3 min" tooltip />;
  if (frame === 'D6.3') heard039 = <OfflineHeard ago="4 min" />;
  if (frame === 'D6.4') heard039 = <OfflineHeard ago="13 min" />;
  if (frame === 'D6.5') heard039 = <SyncedHeard time="06:40" caption="5 synced · 1 conflict" />;
  if (frame === 'D6.6') heard039 = <SyncedHeard time="07:29" caption="now" />;
  if (offline) heard039 = <Heard time="05:17" ago="17 min" />;

  const v5 = frame === 'D6.4' || returned;
  return [
    {
      id: 'VEH039',
      driver: 'Nimal',
      plan:
        frame === 'D6.4' ? (
          <>
            <M w={500}>v4</M>
            <PendingTag />
          </>
        ) : (
          <M w={500}>{v5 ? 'v5' : 'v4'}</M>
        ),
      next: returned ? 'Returning to Kandy' : 'OUT084 · arrive about 05:26',
      stops: returned ? '2 / 2' : '0 / 2',
      heard: heard039,
      status: frame === 'D6.6' ? <Pill kind="delivered">Delivered</Pill> : departed,
      expandable: true,
    },
    { id: 'VEH036', driver: 'R. Silva (Mock)', plan: <M w={500}>v4</M>, next: 'At OUT012 · waiting for 05:30', stops: '3 / 4', heard: offline ? <Heard time="05:29" ago="5 min" /> : <Heard time="05:09" ago="3 min" />, status: departed },
    { id: 'VEH035', driver: 'P. Kumara (Mock)', plan: <M w={500}>v4</M>, next: 'OUT034 · planned 05:20', stops: '3 / 4', heard: offline ? <Heard time="05:30" ago="4 min" /> : <Heard time="05:11" ago="1 min" />, status: departed },
    { id: 'VEH011', driver: 'S. Jayasena (Mock)', plan: <M w={500}>v4</M>, next: 'OUT015 · departs 08:36', stops: '0 / 1', heard: <Heard time="05:02" />, status: planned },
  ];
}

function StopRow({
  id,
  orders,
  window,
  status,
  canDefer,
  onDefer,
  onHistory,
  overlay,
}: {
  id: string;
  orders: ReactNode;
  window: string;
  status: ReactNode;
  canDefer: boolean;
  onDefer?: () => void;
  onHistory: () => void;
  overlay?: ReactNode;
}) {
  return (
    <div className="l-stop">
      <M w={600} style={{ fontSize: 13 }}>
        {id}
      </M>
      <span className="muted" style={{ fontSize: 13 }}>
        Waypoint Fresh
      </span>
      <Tag tone="fresh" small className="l-tag">
        <span className="l-brand__sq" />
        Fresh
      </Tag>
      {orders}
      <M style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{window}</M>
      <span style={{ flex: 1 }} />
      <span className="wp-row" style={{ gap: 6 }}>
        {status}
      </span>
      <span className="wp-row" style={{ gap: 8 }}>
        {canDefer && (
          <Button variant="secondary" size="sm" icon={<Redo2 size={16} />} onClick={onDefer}>
            Defer stop
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onHistory}>
          History
        </Button>
      </span>
      {overlay}
    </div>
  );
}

function Stops({ frame, onDefer, onHistory }: { frame: Frame; onDefer: () => void; onHistory: () => void }) {
  let s084: ReactNode = (
    <>
      <Pill kind="departed">Departed</Pill>
      <Pill kind="departed">Departed</Pill>
    </>
  );
  let s087: ReactNode = <Pill kind="departed">Departed</Pill>;
  if (frame === 'D6.4') {
    s084 = (
      <>
        <Pill kind="deferred">Deferred · store request → Wed</Pill>
        <PendingTag />
      </>
    );
  } else if (frame === 'D6.5') {
    s084 = (
      <>
        <Pill kind="conflict">Conflict</Pill>
        <Pill kind="conflict">Conflict</Pill>
      </>
    );
    s087 = <Pill kind="delivered">Delivered 05:58</Pill>;
  } else if (frame === 'D6.6') {
    s084 = (
      <>
        <Pill kind="delivered">Delivered 05:42</Pill>
        <Tag tone="outline" small>
          Deferral withdrawn
        </Tag>
        <Tag tone="success" small icon={<Check size={13} />}>
          Receipt confirmed 07:30
        </Tag>
      </>
    );
    s087 = <Pill kind="delivered">Delivered 05:58</Pill>;
  }
  const resolved = frame === 'D6.6';

  return (
    <>
      <StopRow
        id="OUT084"
        orders={
          <>
            <M w={500} style={{ fontSize: 12 }}>
              ORD2001
            </M>
            <Temp temp="Chilled" />
            <M w={500} style={{ fontSize: 12 }}>
              ORD2002
            </M>
            <Temp temp="Ambient" />
          </>
        }
        window="ETA 05:26 · window 05:30–08:00"
        status={s084}
        canDefer={!resolved}
        onDefer={onDefer}
        onHistory={onHistory}
        overlay={
          resolved ? (
            <span className="l-hovercard" role="tooltip">
              <b>Resolved by Kumari 06:44, kept delivery</b>
              <span>Both records kept in the audit</span>
            </span>
          ) : undefined
        }
      />
      <StopRow
        id="OUT087"
        orders={
          <>
            <M w={500} style={{ fontSize: 12 }}>
              ORD2003
            </M>
            <Temp temp="Ambient" />
          </>
        }
        window="ETA 06:06 · window 03:00–08:00"
        status={s087}
        canDefer={!resolved}
        onDefer={onDefer}
        onHistory={onHistory}
      />
    </>
  );
}

function VehicleTable({ frame, onDefer, onHistory, onRetry }: { frame: Frame; onDefer: () => void; onHistory: () => void; onRetry: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const rows = vehicles(frame);
  const error = frame === 'D6.S-error';
  return (
    <div className="l-table" role="table" aria-label="Vehicles">
      <div className="l-row l-row--head" role="row">
        {HEADS.map((h, i) => (
          <span key={h} role="columnheader" className="l-cell" style={{ width: COLS[i] }}>
            <Label>{h}</Label>
          </span>
        ))}
      </div>
      {rows.map((r, idx) => {
        const expanded = r.expandable && !error && !collapsed;
        return (
          <div key={r.id} className="wp-col">
            {idx > 0 && <div className="l-divider" />}
            <div className={cx('l-row', r.held && 'is-held')} role="row">
              <span className="l-cell" style={{ width: COLS[0], gap: 6 }}>
                {r.expandable && (
                  <button className="l-chevron" aria-expanded={!!expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${r.id} stops`} onClick={() => setCollapsed((c) => !c)}>
                    {expanded || error ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                )}
                <M w={600} style={{ fontSize: 14 }}>
                  {r.id}
                </M>
              </span>
              <span className="l-cell" style={{ width: COLS[1] }}>
                <M>1</M>
              </span>
              <span className="l-cell" style={{ width: COLS[2] }}>
                {r.driver}
              </span>
              <span className="l-cell" style={{ width: COLS[3], gap: 6 }}>
                {r.plan}
              </span>
              <span className="l-cell" style={{ width: COLS[4] }}>
                {r.next}
              </span>
              <span className="l-cell" style={{ width: COLS[5] }}>
                <M w={500}>{r.stops}</M>
              </span>
              <span className="l-cell" style={{ width: COLS[6] }}>
                {r.heard}
              </span>
              <span className="l-cell" style={{ width: COLS[7], gap: 6 }}>
                {r.status}
              </span>
            </div>
            {expanded && <Stops frame={frame} onDefer={onDefer} onHistory={onHistory} />}
            {r.expandable && error && (
              <div className="l-errrow">
                <div className="wp-alert wp-alert--danger l-erralert" role="alert">
                  <CircleAlert size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                  <div className="wp-col" style={{ flex: 1, gap: 2 }}>
                    <b style={{ fontSize: 14, fontWeight: 600 }}>Couldn't load VEH039's events.</b>
                    <span style={{ fontSize: 13, lineHeight: '18px' }}>The last known status is shown above.</span>
                  </div>
                  <Button variant="ghost" size="sm" icon={<RefreshCw size={16} />} onClick={onRetry}>
                    Retry
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Defer stop dialog (D6.3) ---------- */
function DeferDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [orders, setOrders] = useState({ ORD2001: true, ORD2002: true });
  const [type, setType] = useState<'Store request' | 'Policy'>('Store request');
  const [note, setNote] = useState('Anusha phoned 05:20');
  const toggle = (k: keyof typeof orders) => setOrders((o) => ({ ...o, [k]: !o[k] }));
  const none = !orders.ORD2001 && !orders.ORD2002;

  const orderChip = (id: keyof typeof orders, temp: 'Chilled' | 'Ambient', units: string) => (
    <label className="l-orderchip">
      <input type="checkbox" className="sr-only" checked={orders[id]} onChange={() => toggle(id)} />
      <span className={cx('l-box', orders[id] && 'is-on')}>{orders[id] && <Check size={14} strokeWidth={3} />}</span>
      <M w={500} style={{ fontSize: 13 }}>
        {id}
      </M>
      <Temp temp={temp} />
      <M style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{units}</M>
    </label>
  );

  return (
    <Modal width={600} onClose={onCancel} label="Defer stop OUT084">
      <div className="l-dialog">
        <div className="wp-row" style={{ gap: 8 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600 }}>Defer stop OUT084</h2>
          <span style={{ flex: 1 }} />
          <button className="l-x" aria-label="Close" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>
        <div className="wp-row" style={{ gap: 8 }}>
          {orderChip('ORD2001', 'Chilled', '12 units')}
          {orderChip('ORD2002', 'Ambient', '8 units')}
        </div>
        <div className="wp-col" style={{ gap: 6 }}>
          <Label>Deferral type</Label>
          <div className="wp-row" style={{ gap: 8 }} role="radiogroup" aria-label="Deferral type">
            {(['Store request', 'Policy'] as const).map((t) => (
              <button key={t} role="radio" aria-checked={type === t} className={cx('l-choice', type === t && 'is-on')} onClick={() => setType(t)}>
                {type === t && <Check size={16} />}
                {t}
              </button>
            ))}
            <button role="radio" aria-checked={false} disabled className="l-choice is-disabled">
              Capacity
              <span style={{ fontSize: 11, fontWeight: 400 }}>A legal vehicle exists</span>
            </button>
          </div>
        </div>
        <div className="wp-col" style={{ gap: 6 }}>
          <Label>Reason</Label>
          <div className="wp-row" style={{ gap: 8 }}>
            <span className="l-choice is-on">
              <Check size={16} />
              Receiving staff unavailable
            </span>
            <input className="l-input" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note (optional)" />
          </div>
        </div>
        <div className="wp-row" style={{ gap: 8 }}>
          <Label>Next run</Label>
          <M w={500} style={{ fontSize: 14 }}>
            Wed 30 Sep · from 05:30
          </M>
        </div>
        <div className="l-warn" role="alert">
          <WifiOff size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <div className="wp-col" style={{ gap: 2 }}>
            <b style={{ fontSize: 14, fontWeight: 600 }}>VEH039 offline since 05:17, this change cannot reach the driver.</b>
            <span style={{ fontSize: 13, lineHeight: '18px' }}>The truck may still deliver. If it does, you'll get a conflict to settle.</span>
          </div>
        </div>
        <div className="l-consequence">
          <Info size={16} style={{ flexShrink: 0 }} />
          Creates plan v5 · Store told now · Kandy dock and driver get v5 on next sync
        </div>
        <div className="wp-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancel} style={{ fontWeight: 600 }}>
            Cancel
          </Button>
          <Button icon={<Redo2 size={16} />} onClick={onConfirm} disabled={none} autoFocus style={{ fontWeight: 700 }}>
            Defer and create v5
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Loading ---------- */
function LoadingBody() {
  return (
    <div className="wp-col" style={{ gap: 16 }}>
      <div className="wp-row" style={{ gap: 8, color: 'var(--ink-muted)', fontSize: 14, fontWeight: 500 }}>
        <RefreshCw size={16} className="spin" style={{ color: 'var(--route)' }} />
        Loading operations…
      </div>
      <div className="l-inbox" style={{ padding: '16px 20px' }} aria-hidden="true">
        <Skel w={180} />
        <Skel w={600} />
      </div>
      <div className="l-counts" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="l-stat" style={{ padding: '16px 20px', gap: 10 }}>
            <Skel w={90} />
            <Skel w={60} h={24} />
            <Skel w={140} />
          </div>
        ))}
      </div>
      <div className="l-table" aria-hidden="true">
        <div style={{ background: 'var(--surface-2)', padding: '14px 20px' }}>
          <Skel w={900} style={{ background: 'var(--line)' }} />
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="wp-row" style={{ gap: 40, padding: '18px 20px' }}>
            {[90, 40, 110, 260, 60, 120].map((w, j) => (
              <Skel key={j} w={w} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Screen ---------- */
export default function Live() {
  const [frame, setFrame] = useFrame<Frame>('D6.1');
  const go = useGo();
  const time = TIME[frame];
  const offline = frame === 'D6.S-offline';
  const loading = frame === 'D6.S-loading';
  const held = frame === 'D6.7';
  const v5 = ['D6.4', 'D6.5', 'D6.6'].includes(frame);

  const overline = loading
    ? 'LIVE · TUE 29 SEP'
    : `LIVE · TUE 29 SEP · ${offline ? '05:12' : time}${v5 ? ' · PLAN v5' : ''}${held ? ' · PELIYAGODA' : ''}`;

  const refresh = () => {
    // Refresh pulls whatever the next sync would bring in the scenario.
    const next: Partial<Record<Frame, Frame>> = { 'D6.1': 'D6.2', 'D6.4': 'D6.5', 'D6.S-error': 'D6.1', 'D6.S-offline': 'D6.1' };
    if (next[frame]) setFrame(next[frame]!);
  };

  const bar = (
    <AppBar
      current="live"
      deferrals={held ? 19 : 20}
      time={time}
      context={held ? 'Tue 29 Sep · Peliyagoda' : 'Tue 29 Sep · both depots'}
      syncLabel="Live sync"
      offline={offline}
      offlineQuiet
    />
  );

  const conn = offline ? (
    <div className="wp-connbar" role="status" style={{ height: 41 }}>
      <WifiOff size={18} />
      <span>
        <b style={{ fontWeight: 700, fontSize: 14 }}>Offline.</b>&nbsp;&nbsp;
        <span style={{ fontWeight: 400, fontSize: 14 }}>Your connection dropped: board frozen at 05:30; data ages keep counting.</span>
      </span>
      <M style={{ marginLeft: 'auto', color: 'var(--on-chrome-muted)', fontSize: 12, fontWeight: 400 }}>Frozen 05:30</M>
    </div>
  ) : undefined;

  const history = () => go('/plan/queue', 'D1.5');

  return (
    <Screen bar={bar} conn={conn}>
      <div className="wp-col" style={{ gap: 22 }}>
        <PageHeader
          overline={overline}
          title="Live operations"
          actions={
            loading ? undefined : (
              <Button variant="ghost" icon={<RefreshCw size={16} />} onClick={refresh} style={{ fontWeight: 600 }}>
                Refresh
              </Button>
            )
          }
        />
        {loading ? (
          <LoadingBody />
        ) : (
          <div className="wp-col" style={{ gap: 16 }}>
            <Inbox frame={frame} onResolve={() => go('/live/conflict', 'D7.1')} onReview={() => go('/live/exception', 'D8.1')} />
            <Counts held={held} />
            <VehicleTable frame={frame} onDefer={() => setFrame('D6.3')} onHistory={history} onRetry={() => setFrame('D6.1')} />
          </div>
        )}
      </div>
      {frame === 'D6.3' && <DeferDialog onCancel={() => setFrame('D6.2')} onConfirm={() => setFrame('D6.4')} />}
    </Screen>
  );
}
